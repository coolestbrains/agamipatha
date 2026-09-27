import { DatePipe } from '@angular/common';
import { Component, OnDestroy, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BuyerAuthService } from '../buyer-auth.service';
import { StoreBuyerOrder, StoreService } from '../store.service';

@Component({
  selector: 'app-my-orders-page',
  imports: [RouterLink, DatePipe],
  templateUrl: './my-orders-page.component.html',
  styleUrl: './my-orders-page.component.scss',
})
export class MyOrdersPageComponent implements OnDestroy {
  readonly buyer = inject(BuyerAuthService);
  private readonly store = inject(StoreService);

  readonly orders = signal<StoreBuyerOrder[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  private sub: Subscription | null = null;

  constructor() {
    effect(() => {
      const loggedIn = this.buyer.isLoggedIn();
      untracked(() => {
        if (!loggedIn) {
          this.sub?.unsubscribe();
          this.sub = null;
          this.orders.set([]);
          this.loading.set(false);
          this.error.set('');
          return;
        }
        this.loadOrders();
      });
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  register(): void {
    this.buyer.requestAccount('register');
  }

  login(): void {
    this.buyer.requestAccount('login');
  }

  refresh(): void {
    if (this.buyer.isLoggedIn()) {
      this.loadOrders();
    }
  }

  download(order: StoreBuyerOrder): void {
    if (!order.downloadToken) {
      return;
    }
    const link = document.createElement('a');
    link.href = this.store.downloadUrl(order.downloadToken);
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  statusLabel(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'paid':
        return 'Paid';
      case 'created':
        return 'Pending payment';
      default:
        return status || 'Unknown';
    }
  }

  private loadOrders(): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.sub = this.store.myOrders().subscribe({
      next: (items) => {
        this.orders.set(items ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.orders.set([]);
        this.loading.set(false);
        this.error.set('Could not load your orders. Try again.');
      },
    });
  }
}
