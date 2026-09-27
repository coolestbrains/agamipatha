import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { BuyerAuthService } from '../buyer-auth.service';
import { JourneyService } from '../journey.service';
import { StoreAccount, StoreService } from '../store.service';

type AccountMode = 'register' | 'login';
type FieldErrors = Partial<Record<'name' | 'email' | 'mobile' | 'password' | 'privacy' | 'login' | 'loginPassword', string>>;

@Component({
  selector: 'app-account-dialog',
  imports: [FormsModule],
  templateUrl: './account-dialog.component.html',
  styleUrl: './account-dialog.component.scss',
})
export class AccountDialogComponent {
  private readonly store = inject(StoreService);
  private readonly buyer = inject(BuyerAuthService);
  private readonly admin = inject(AuthService);
  private readonly journeys = inject(JourneyService);

  readonly open = signal(false);
  mode: AccountMode = 'register';
  name = '';
  email = '';
  mobile = '';
  password = '';
  loginId = '';
  loginPassword = '';
  acceptedPrivacy = false;
  fieldErrors: FieldErrors = {};
  loginError = signal('');
  registerError = signal('');
  busy = signal(false);
  readonly savingKind = signal<'' | 'my-path' | 'favourite'>('');

  constructor() {
    effect(() => {
      const prompt = this.buyer.accountPrompt();
      if (!prompt || this.buyer.isLoggedIn()) {
        return;
      }
      untracked(() => {
        this.buyer.consumeAccountPrompt();
        this.savingKind.set(this.journeys.pendingKind());
        this.openForm(prompt);
      });
    });
  }

  openForm(mode: AccountMode): void {
    this.mode = mode;
    this.fieldErrors = {};
    this.loginError.set('');
    this.registerError.set('');
    this.acceptedPrivacy = false;
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
    this.busy.set(false);
    this.savingKind.set('');
    this.fieldErrors = {};
    this.loginError.set('');
    this.registerError.set('');
  }

  submit(): void {
    if (this.mode === 'login') {
      this.login();
      return;
    }
    this.register();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.close();
    }
  }

  private login(): void {
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
    this.busy.set(true);
    this.store.login(login, this.loginPassword).subscribe({
      next: (session) => {
        this.buyer.setSession(session.token, session.buyerName);
        if (session.adminToken) {
          this.admin.setSession(session.adminToken);
        } else {
          this.admin.clearSession();
        }
        this.loginPassword = '';
        this.busy.set(false);
        this.journeys.commitPendingSave();
        this.close();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.loginError.set(this.apiMessage(err, 'Could not log in. Check your email/mobile and password.'));
      },
    });
  }

  private register(): void {
    if (!this.validAccount()) {
      return;
    }
    this.registerError.set('');
    this.busy.set(true);
    this.store.register(this.account()).subscribe({
      next: (session) => {
        this.buyer.setSession(session.token, session.buyerName);
        if (session.adminToken) {
          this.admin.setSession(session.adminToken);
        } else {
          this.admin.clearSession();
        }
        this.password = '';
        this.busy.set(false);
        this.journeys.commitPendingSave();
        this.close();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.registerError.set(this.apiMessage(err, 'Could not create the account. Try again.'));
      },
    });
  }

  private account(): StoreAccount {
    return {
      name: this.name.trim(),
      email: this.email.trim() || undefined,
      mobile: this.mobile.trim(),
      password: this.password,
    };
  }

  private validAccount(): boolean {
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
    return Object.keys(errors).length === 0;
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

  private apiMessage(err: HttpErrorResponse, fallback: string): string {
    const message = err.error?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
}
