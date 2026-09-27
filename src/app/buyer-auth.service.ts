import { Injectable, computed, inject, signal } from '@angular/core';
import { tokenUnexpired } from './jwt';
import { StoreService } from './store.service';

const TOKEN_KEY = 'agamipatha-buyer-token';
const NAME_KEY = 'agamipatha-buyer-name';
const ADMIN_LINK_KEY = 'agamipatha-buyer-from-admin';

@Injectable({ providedIn: 'root' })
export class BuyerAuthService {
  private readonly store = inject(StoreService);
  readonly token = signal('');
  readonly name = signal('');
  readonly linkedToAdmin = signal(false);
  readonly isLoggedIn = computed(() => tokenUnexpired(this.token()));
  readonly firstName = computed(() => this.name().trim().split(/\s+/)[0] || 'there');
  readonly loginRequested = signal(false);
  readonly accountPrompt = signal<'login' | 'register' | ''>('');

  constructor() {
    this.readStorage();
    this.dropIfInvalid();
    window.addEventListener('storage', (event) => {
      if (event.key === TOKEN_KEY || event.key === NAME_KEY || event.key === ADMIN_LINK_KEY || event.key === null) {
        this.readStorage();
        this.dropIfInvalid();
      }
    });
    window.addEventListener('focus', () => this.dropIfInvalid());
  }

  requestLogin(): void {
    this.requestAccount('login');
  }

  requestAccount(mode: 'login' | 'register'): void {
    this.accountPrompt.set(mode);
    this.loginRequested.set(true);
  }

  consumeLoginRequest(): void {
    this.loginRequested.set(false);
  }

  consumeAccountPrompt(): void {
    this.accountPrompt.set('');
    this.loginRequested.set(false);
  }

  setSession(token: string, name: string, fromAdmin = false): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(NAME_KEY, name);
    if (fromAdmin) {
      localStorage.setItem(ADMIN_LINK_KEY, '1');
    } else {
      localStorage.removeItem(ADMIN_LINK_KEY);
    }
    this.token.set(token);
    this.name.set(name);
    this.linkedToAdmin.set(fromAdmin);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(ADMIN_LINK_KEY);
    this.store.clearPurchases();
    this.token.set('');
    this.name.set('');
    this.linkedToAdmin.set(false);
  }

  dropIfInvalid(): void {
    const token = this.token();
    if (token && !tokenUnexpired(token)) {
      this.logout();
    }
  }

  private readStorage(): void {
    this.token.set(localStorage.getItem(TOKEN_KEY) ?? '');
    this.name.set(localStorage.getItem(NAME_KEY) ?? '');
    this.linkedToAdmin.set(localStorage.getItem(ADMIN_LINK_KEY) === '1');
  }
}
