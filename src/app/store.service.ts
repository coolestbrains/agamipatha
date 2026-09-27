import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from './environment';

export interface StoreProduct {
  id: string;
  title: string;
  description: string;
  kind: string;
  pricePaise: number;
  priceLabel: string;
  cover?: string;
  file?: string;
  hasUploadedCover?: boolean;
  coverVersion?: number;
  hasPdf?: boolean;
  onSale?: boolean;
}

export interface StoreCatalog {
  configured: boolean;
  testMode: boolean;
  keyId: string;
  currency: string;
  products: StoreProduct[];
}

export interface StoreOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  productTitle: string;
  testMode: boolean;
}

export interface StoreVerify {
  downloadToken: string;
  productTitle: string;
  fileName: string;
  token?: string;
  buyerName?: string;
}

export interface StoreAccount {
  name?: string;
  email?: string;
  mobile?: string;
  password?: string;
}

export interface StoreBuyerAuth {
  token: string;
  buyerName: string;
  adminToken?: string;
  purchases: StorePurchase[];
}

interface StoreBuyerAuthResponse {
  token: string;
  buyerName: string;
  adminToken?: string;
  purchases: StoreApiPurchase[];
}

export interface StorePurchase {
  productId: string;
  token: string;
  fileName: string;
  title: string;
}

export interface StoreApiPurchase {
  productId: string;
  title: string;
  fileName: string;
  downloadToken: string;
}

export interface StoreBuyerOrder {
  orderId: string;
  productId: string;
  title: string;
  fileName: string;
  downloadToken: string;
  status: string;
  amountPaise: number;
  amountLabel: string;
  currency: string;
  placedAtUtc: string;
}

const PURCHASE_KEY = 'agamipatha-store-purchases-v2';

const SITE_COVERS: Record<string, string[]> = {
  'career-path-ebook': [
    '/store/career-path-planner-cover.png',
    '/assets/store/career-path-planner-cover.png',
  ],
  'career-directory-ebook': [
    '/store/all-career-paths-cover.png',
    '/assets/store/all-career-paths-cover.png',
  ],
  'bachelor-recipes-ebook': [
    '/store/99-recipes-for-bachelors-cover.png',
    '/assets/store/99-recipes-for-bachelors-cover.png',
  ],
  'class-10-stream-chooser-ebook': [
    '/store/class-10-stream-chooser-cover.png',
    '/assets/store/class-10-stream-chooser-cover.png',
  ],
  'first-year-college-survival-ebook': [
    '/store/first-year-college-survival-cover.png',
    '/assets/store/first-year-college-survival-cover.png',
  ],
};

@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  catalog(): Observable<StoreCatalog> {
    return this.http.get<StoreCatalog>(`${this.base}/store/products`);
  }

  createOrder(productId: string, account: StoreAccount = {}): Observable<StoreOrder> {
    return this.http.post<StoreOrder>(`${this.base}/store/orders`, {
      productId,
      name: account.name?.trim() || undefined,
      email: account.email?.trim() || undefined,
      mobile: account.mobile?.trim() || undefined,
      password: account.password || undefined,
    });
  }

  register(account: StoreAccount): Observable<StoreBuyerAuth> {
    return this.mapAuth(
      this.http.post<StoreBuyerAuthResponse>(`${this.base}/store/register`, {
        name: account.name?.trim() || undefined,
        email: account.email?.trim() || undefined,
        mobile: account.mobile?.trim() || undefined,
        password: account.password || undefined,
      }),
    );
  }

  login(login: string, password: string): Observable<StoreBuyerAuth> {
    return this.mapAuth(
      this.http.post<StoreBuyerAuthResponse>(`${this.base}/store/login`, { login, password }),
    );
  }

  private mapAuth(source: Observable<StoreBuyerAuthResponse>): Observable<StoreBuyerAuth> {
    return source.pipe(
      map((res) => ({
        token: res.token,
        buyerName: res.buyerName,
        adminToken: res.adminToken,
        purchases: this.fromApiPurchases(res.purchases ?? []),
      })),
    );
  }

  accountPurchases(): Observable<StoreApiPurchase[]> {
    return this.http.get<StoreApiPurchase[]>(`${this.base}/store/purchases`);
  }

  myOrders(): Observable<StoreBuyerOrder[]> {
    return this.http.get<StoreBuyerOrder[]>(`${this.base}/store/my-orders`);
  }

  fromApiPurchases(items: StoreApiPurchase[]): StorePurchase[] {
    return items.map((item) => ({
      productId: item.productId,
      token: item.downloadToken,
      fileName: item.fileName,
      title: item.title,
    }));
  }

  verify(orderId: string, paymentId: string, signature: string): Observable<StoreVerify> {
    return this.http.post<StoreVerify>(`${this.base}/store/verify`, {
      orderId,
      paymentId,
      signature,
    });
  }

  downloadUrl(token: string): string {
    return `${this.base}/store/download/${encodeURIComponent(token)}`;
  }

  coverSrc(
    product: Pick<StoreProduct, 'id' | 'cover' | 'hasUploadedCover' | 'coverVersion'>,
    preferUpload = false,
  ): string {
    const local = this.localCoverUrl(product);
    if (preferUpload && product.hasUploadedCover) {
      const version = product.coverVersion ? `?v=${product.coverVersion}` : '';
      return `${this.base}/store/covers/${encodeURIComponent(product.id)}${version}`;
    }
    return local;
  }

  coverFallbacks(product: Pick<StoreProduct, 'id' | 'cover'>): string[] {
    return [...new Set([this.siteAssetUrl(product.cover), ...(SITE_COVERS[product.id] ?? [])].filter(Boolean))];
  }

  localCoverUrl(product: Pick<StoreProduct, 'id' | 'cover'>): string {
    return this.coverFallbacks(product)[0] ?? '';
  }

  publicAssetUrl(path?: string): string {
    return this.siteAssetUrl(path);
  }

  private siteAssetUrl(path?: string): string {
    const value = (path ?? '').trim();
    if (!value) {
      return '';
    }
    if (value.startsWith('data:')) {
      return value;
    }
    if (/^https?:\/\//i.test(value)) {
      try {
        const host = new URL(value).hostname.toLowerCase();
        if (host === 'agamipatha.com' || host.endsWith('.agamipatha.com')) {
          return host.startsWith('api.') ? '' : value;
        }
      } catch {
        return '';
      }
      return '';
    }
    if (value.includes('/store/covers/')) {
      return '';
    }
    return value.startsWith('/') ? value : `/${value}`;
  }

  purchases(): StorePurchase[] {
    try {
      const raw = localStorage.getItem(PURCHASE_KEY);
      const parsed = raw ? (JSON.parse(raw) as StorePurchase[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  savePurchase(purchase: StorePurchase): void {
    const next = this.purchases().filter((item) => item.productId !== purchase.productId);
    next.unshift(purchase);
    this.replacePurchases(next);
  }

  replacePurchases(items: StorePurchase[]): void {
    localStorage.setItem(PURCHASE_KEY, JSON.stringify(items));
  }

  clearPurchases(): void {
    localStorage.removeItem(PURCHASE_KEY);
  }

  syncPurchaseFiles(products: StoreProduct[]): StorePurchase[] {
    const next = this.purchases().map((purchase) => {
      const file = products.find((item) => item.id === purchase.productId)?.file;
      return file ? { ...purchase, fileName: file } : purchase;
    });
    localStorage.setItem(PURCHASE_KEY, JSON.stringify(next));
    return next;
  }
}
