import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { BuyerAuthService } from './buyer-auth.service';
import { environment } from './environment';
import { tokenUnexpired } from './jwt';

const TOKEN_KEY = 'agamipatha-admin-token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly buyer = inject(BuyerAuthService);
  readonly token = signal(readPersistedToken());
  readonly isAdmin = computed(() => tokenUnexpired(this.token()));

  constructor() {
    this.dropIfInvalid();
    window.addEventListener('storage', (event) => {
      if (event.key === TOKEN_KEY || event.key === null) {
        this.token.set(localStorage.getItem(TOKEN_KEY) ?? '');
        this.dropIfInvalid();
      }
    });
    window.addEventListener('focus', () => this.dropIfInvalid());
  }

  setSession(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
    this.token.set(token);
  }

  login(login: string, password: string) {
    return this.http
      .post<{ token: string; buyerToken?: string; buyerName?: string }>(`${environment.apiUrl}/auth/login`, {
        login,
        password,
      })
      .pipe(
        tap((res) => {
          this.setSession(res.token);
          if (res.buyerToken) {
            this.buyer.setSession(res.buyerToken, res.buyerName || 'Admin', true);
          }
        }),
      );
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    this.token.set('');
  }

  logout(): void {
    this.clearSession();
    this.buyer.logout();
    void this.router.navigate(['/admin/login']);
  }

  dropIfInvalid(): void {
    const token = this.token();
    if (token && !tokenUnexpired(token)) {
      this.clearSession();
    }
    if (!tokenUnexpired(this.token()) && this.buyer.linkedToAdmin()) {
      this.buyer.logout();
    }
  }
}

function readPersistedToken(): string {
  const local = localStorage.getItem(TOKEN_KEY) ?? '';
  if (local) {
    sessionStorage.removeItem(TOKEN_KEY);
    return local;
  }
  const session = sessionStorage.getItem(TOKEN_KEY) ?? '';
  if (session) {
    localStorage.setItem(TOKEN_KEY, session);
    sessionStorage.removeItem(TOKEN_KEY);
  }
  return session;
}
