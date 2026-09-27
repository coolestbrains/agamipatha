import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { BuyerAuthService } from './buyer-auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const buyer = inject(BuyerAuthService);
  const isAdminApi = req.url.includes('/admin') || req.url.includes('/auth/login');
  const isStoreBuyerApi = /\/store\/(orders|verify|purchases|my-orders)(?:\?|$)/.test(req.url);

  let token = '';
  if (isAdminApi) {
    token = auth.token();
  } else if (isStoreBuyerApi) {
    token = buyer.token();
  }

  const withAuth = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(withAuth).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && req.url.includes('/admin')) {
        auth.logout();
      }
      if (err.status === 401 && isStoreBuyerApi) {
        buyer.logout();
      }
      return throwError(() => err);
    }),
  );
};
