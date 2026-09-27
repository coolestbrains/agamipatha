import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { BuyerAuthService } from '../buyer-auth.service';
import { RazorpayTrustComponent } from '../components/razorpay-trust.component';
import { StoreAccount, StoreBuyerAuth, StoreCatalog, StoreOrder, StoreProduct, StorePurchase, StoreService } from '../store.service';

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccess) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void;
}

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

type AccountMode = 'buy' | 'login';
type FieldErrors = Partial<Record<'name' | 'email' | 'mobile' | 'password' | 'privacy' | 'login' | 'loginPassword', string>>;

@Component({
  selector: 'app-store-page',
  imports: [FormsModule, RazorpayTrustComponent],
  templateUrl: './store-page.component.html',
  styleUrl: './store-page.component.scss',
})
export class StorePageComponent {
  private readonly store = inject(StoreService);
  readonly buyer = inject(BuyerAuthService);
  private readonly admin = inject(AuthService);

  mode: AccountMode = 'buy';
  name = '';
  email = '';
  mobile = '';
  password = '';
  loginId = '';
  loginPassword = '';
  acceptedPrivacy = false;
  fieldErrors: FieldErrors = {};

  catalog = signal<StoreCatalog | null>(null);
  purchases = signal<StorePurchase[]>([]);
  loadError = signal('');
  checkoutError = signal('');
  loginError = signal('');
  registerError = signal('');
  busyId = signal('');
  loginBusy = signal(false);
  preview = signal<StoreProduct | null>(null);
  accountOpen = signal(false);
  pendingProduct = signal<StoreProduct | null>(null);

  constructor() {
    this.store.catalog().subscribe({
      next: (catalog) => {
        this.catalog.set(catalog);
        this.loadError.set('');
        if (this.buyer.isLoggedIn()) {
          this.loadAccountPurchases();
        } else {
          this.purchases.set([]);
        }
      },
      error: () => this.loadError.set('The store catalogue could not be loaded. Start the API and refresh.'),
    });

    effect(() => {
      const loggedIn = this.buyer.isLoggedIn();
      untracked(() => {
        if (loggedIn) {
          this.loadAccountPurchases();
        } else {
          this.purchases.set([]);
        }
      });
    });

    effect(() => {
      if (!this.buyer.loginRequested() || this.buyer.isLoggedIn() || this.buyer.accountPrompt()) {
        return;
      }
      untracked(() => {
        this.buyer.consumeLoginRequest();
        this.openAccount();
      });
    });
  }

  kindLabel(kind: string): string {
    const labels: Record<string, string> = {
      ebook: 'Ebook',
      software: 'Software',
      pack: 'Pack',
    };
    return labels[kind] ?? kind;
  }

  canBuy(product: StoreProduct): boolean {
    if (product.onSale === false || product.hasPdf === false) {
      return false;
    }
    const file = (product.file ?? '').toLowerCase();
    if (!file.endsWith('.pdf')) {
      return false;
    }
    if (product.kind === 'ebook' && !this.coverSrc(product)) {
      return false;
    }
    return true;
  }

  coverSrc(product: StoreProduct): string {
    return this.store.coverSrc(product);
  }

  onCoverError(event: Event, product: StoreProduct): void {
    const img = event.target as HTMLImageElement;
    const used = Number(img.dataset['coverFallback'] || '0');
    const next = this.store.coverFallbacks(product)[used + 1];
    if (!next) {
      img.hidden = true;
      return;
    }
    img.dataset['coverFallback'] = String(used + 1);
    img.src = next;
  }

  purchaseFor(productId: string): StorePurchase | undefined {
    if (!this.buyer.isLoggedIn()) {
      return undefined;
    }
    return this.purchases().find((item) => item.productId === productId);
  }

  download(product: StoreProduct, purchase: StorePurchase): void {
    if (!this.buyer.isLoggedIn()) {
      this.purchases.set([]);
      this.checkoutError.set('Log in and buy this book again to download it.');
      return;
    }
    this.store.accountPurchases().subscribe({
      next: (items) => {
        const account = this.store.fromApiPurchases(items);
        this.applyAccountPurchases(account);
        const live = account.find((item) => item.productId === product.id && item.token);
        if (!live) {
          this.checkoutError.set(`The ${product.title} purchase was removed. Buy it again to download.`);
          return;
        }
        const link = document.createElement('a');
        link.href = this.store.downloadUrl(live.token);
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
      },
      error: () => {
        this.checkoutError.set(`Could not confirm the ${product.title} purchase. Buy it again if the download is gone.`);
      },
    });
  }

  openPreview(product: StoreProduct): void {
    this.preview.set(product);
  }

  closePreview(): void {
    this.preview.set(null);
  }

  openAccount(product: StoreProduct | null = null): void {
    this.pendingProduct.set(product);
    this.mode = product ? 'buy' : 'login';
    this.fieldErrors = {};
    this.loginError.set('');
    this.registerError.set('');
    this.acceptedPrivacy = false;
    this.accountOpen.set(true);
  }

  closeAccount(): void {
    this.accountOpen.set(false);
    this.pendingProduct.set(null);
    this.fieldErrors = {};
    this.loginError.set('');
    this.registerError.set('');
    this.acceptedPrivacy = false;
  }

  submitAccount(): void {
    if (this.mode === 'login') {
      this.login();
      return;
    }
    if (!this.validCheckoutAccount()) {
      return;
    }
    const product = this.pendingProduct();
    if (product) {
      this.startCheckout(product);
      return;
    }
    this.register();
  }

  logoutBuyer(): void {
    this.buyer.logout();
    this.admin.clearSession();
    this.password = '';
    this.loginPassword = '';
    this.fieldErrors = {};
    this.loginError.set('');
    this.purchases.set([]);
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    if (this.buyer.isLoggedIn()) {
      this.loadAccountPurchases();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.accountOpen()) {
      this.closeAccount();
      return;
    }
    this.closePreview();
  }

  login(): void {
    this.fieldErrors = {};
    this.loginError.set('');
    const login = this.loginId.trim();
    if (!login) {
      this.fieldErrors = { login: 'Enter your email or mobile.' };
      return;
    }
    if (!this.loginPassword) {
      this.fieldErrors = { loginPassword: 'Enter your password.' };
      return;
    }

    this.loginBusy.set(true);
    this.store.login(login, this.loginPassword).subscribe({
      next: (session) => {
        this.applyBuyerSession(session);
        this.loginPassword = '';
        this.loginBusy.set(false);
        const product = this.pendingProduct();
        this.accountOpen.set(false);
        if (product) {
          this.startCheckout(product);
        } else {
          this.pendingProduct.set(null);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loginBusy.set(false);
        this.loginError.set(this.apiMessage(err, 'Could not log in. Check your email/mobile and password.'));
      },
    });
  }

  private register(): void {
    this.registerError.set('');
    this.loginBusy.set(true);
    this.store.register(this.checkoutAccount()).subscribe({
      next: (session) => {
        this.applyBuyerSession(session);
        this.password = '';
        this.loginBusy.set(false);
        this.pendingProduct.set(null);
        this.accountOpen.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loginBusy.set(false);
        this.registerError.set(this.apiMessage(err, 'Could not create the account. Try again.'));
      },
    });
  }

  private applyBuyerSession(session: StoreBuyerAuth): void {
    this.buyer.setSession(session.token, session.buyerName);
    if (session.adminToken) {
      this.admin.setSession(session.adminToken);
    } else {
      this.admin.clearSession();
    }
    this.applyAccountPurchases(session.purchases);
  }

  buy(product: StoreProduct): void {
    if (!this.canBuy(product)) {
      this.checkoutError.set(
        product.hasPdf === false || !(product.file ?? '').toLowerCase().endsWith('.pdf')
          ? 'This product is not on sale until a PDF is available.'
          : 'This ebook is not on sale until it has a cover.',
      );
      return;
    }
    if (!this.buyer.isLoggedIn()) {
      this.checkoutError.set('');
      this.openAccount(product);
      return;
    }
    this.closeAccount();
    this.closePreview();
    this.startCheckout(product);
  }

  private startCheckout(product: StoreProduct): void {
    this.preview.set(null);
    const keepPopup = this.accountOpen() && !this.buyer.isLoggedIn();
    const showError = (message: string) => {
      if (keepPopup) {
        this.registerError.set(message);
      } else {
        this.checkoutError.set(message);
      }
    };

    const catalog = this.catalog();
    if (!catalog?.configured) {
      showError('Add Razorpay KeyId and KeySecret under Razorpay in appsettings.json, then restart the API.');
      return;
    }
    if (!window.Razorpay) {
      showError('Razorpay checkout did not load. Check your network and refresh.');
      return;
    }
    if (!this.buyer.isLoggedIn() && !this.validCheckoutAccount()) {
      return;
    }

    this.registerError.set('');
    this.checkoutError.set('');
    this.busyId.set(product.id);
    this.store.createOrder(product.id, this.checkoutAccount()).subscribe({
      next: (order) => {
        this.accountOpen.set(false);
        this.openCheckout(order, product);
      },
      error: (err: HttpErrorResponse) => {
        this.busyId.set('');
        showError(this.apiMessage(err, 'Could not start checkout.'));
      },
    });
  }

  private checkoutAccount(): StoreAccount {
    if (this.buyer.isLoggedIn()) {
      return {};
    }
    return {
      name: this.name.trim(),
      email: this.email.trim() || undefined,
      mobile: this.mobile.trim(),
      password: this.password,
    };
  }

  private validCheckoutAccount(): boolean {
    const errors: FieldErrors = {};
    const name = this.name.trim();
    if (name.length < 2 || name.length > 80) {
      errors.name = 'Name must be 2–80 characters.';
    } else if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(name)) {
      errors.name = 'Use letters, spaces, apostrophes, or a hyphen.';
    }

    const email = this.email.trim().toLowerCase();
    const mobile = this.normalizeMobile(this.mobile);
    if (!mobile) {
      errors.mobile = 'Enter a 10-digit Indian mobile number.';
    }
    if (this.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }

    if (this.password.length < 8 || this.password.length > 72) {
      errors.password = 'Password must be 8–72 characters.';
    } else if (!/[A-Za-z]/.test(this.password) || !/\d/.test(this.password)) {
      errors.password = 'Password needs at least one letter and one number.';
    }

    if (!this.acceptedPrivacy) {
      errors.privacy = 'Please agree to the privacy policy to create an account.';
    }

    this.fieldErrors = errors;
    if (Object.keys(errors).length) {
      return false;
    }
    return true;
  }

  private normalizeMobile(raw: string): string | null {
    let digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    return /^[6-9]\d{9}$/.test(digits) ? digits : null;
  }

  private openCheckout(order: StoreOrder, product: StoreProduct): void {
    const Razorpay = window.Razorpay;
    if (!Razorpay) {
      this.busyId.set('');
      this.checkoutError.set('Razorpay checkout did not load. Check your network and refresh.');
      return;
    }

    const checkout = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: order.testMode ? 'AgamiPatha Store (Test)' : 'AgamiPatha Store',
      description: order.productTitle,
      order_id: order.orderId,
      prefill: {
        name: this.buyer.name() || this.name.trim() || undefined,
        email: this.email.trim() || undefined,
        contact: this.normalizeMobile(this.mobile) ?? undefined,
      },
      theme: { color: '#111111' },
      handler: (response) => this.confirmPayment(response, product),
      modal: {
        ondismiss: () => this.busyId.set(''),
      },
    });
    checkout.on('payment.failed', (response) => {
      this.busyId.set('');
      this.checkoutError.set(response.error?.description || 'Razorpay could not complete the test payment.');
    });
    checkout.open();
  }

  private confirmPayment(response: RazorpaySuccess, product: StoreProduct): void {
    this.store.verify(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature).subscribe({
      next: (result) => {
        if (result.token) {
          this.buyer.setSession(result.token, result.buyerName || this.name.trim());
        }
        const purchase: StorePurchase = {
          productId: product.id,
          token: result.downloadToken,
          fileName: result.fileName,
          title: result.productTitle,
        };
        this.applyAccountPurchases([
          purchase,
          ...this.purchases().filter((item) => item.productId !== purchase.productId),
        ]);
        this.password = '';
        this.busyId.set('');
        this.pendingProduct.set(null);
        this.accountOpen.set(false);
        this.checkoutError.set('');
        this.loadAccountPurchases();
      },
      error: (err: HttpErrorResponse) => {
        this.busyId.set('');
        this.checkoutError.set(this.apiMessage(err, 'Payment succeeded but verification failed. Keep the payment id and contact support.'));
      },
    });
  }

  private loadAccountPurchases(): void {
    if (!this.buyer.isLoggedIn()) {
      return;
    }
    this.store.accountPurchases().subscribe({
      next: (items) => this.applyAccountPurchases(this.store.fromApiPurchases(items)),
      error: () => {
        /* 401 is handled by the interceptor. Keep the last server list on a brief API blip. */
      },
    });
  }

  private applyAccountPurchases(account: StorePurchase[]): void {
    this.store.replacePurchases(account);
    this.purchases.set(account);
  }

  private apiMessage(err: HttpErrorResponse, fallback: string): string {
    const message = err.error?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
}
