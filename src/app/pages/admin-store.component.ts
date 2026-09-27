import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService, AdminEbookCover, AdminStoreBuyerPurchase, AdminStoreBuyerRow, AdminStoreOrderRow, AdminStoreSales } from '../admin-api.service';
import { AdminTabsComponent } from '../components/admin-tabs.component';
import { StoreService } from '../store.service';

@Component({
  selector: 'app-admin-store',
  standalone: true,
  imports: [AdminTabsComponent, DatePipe, FormsModule],
  templateUrl: './admin-store.component.html',
  styleUrl: './admin-store.component.scss',
})
export class AdminStoreComponent {
  private readonly api = inject(AdminApiService);
  private readonly store = inject(StoreService);

  readonly sales = signal<AdminStoreSales | null>(null);
  readonly ebooks = signal<AdminEbookCover[]>([]);
  readonly error = signal('');
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly uploadingId = signal('');
  readonly openBuyerId = signal('');
  readonly editBuyer = signal<AdminStoreBuyerRow | null>(null);
  readonly passwordBuyer = signal<AdminStoreBuyerRow | null>(null);
  editName = '';
  editEmail = '';
  editMobile = '';
  newPassword = '';
  confirmPassword = '';

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.error.set('');
    this.api.storeSales().subscribe({
      next: (sales) => this.sales.set(sales),
      error: () => this.error.set('Store sales could not be loaded. Sign in again if the session expired.'),
    });
    this.api.storeEbooks().subscribe({
      next: (ebooks) => this.ebooks.set(ebooks),
      error: () => this.error.set('Ebook covers could not be loaded. Sign in again if the session expired.'),
    });
  }

  toggleBuyer(id: string): void {
    this.openBuyerId.set(this.openBuyerId() === id ? '' : id);
  }

  startEdit(buyer: AdminStoreBuyerRow): void {
    this.editBuyer.set(buyer);
    this.editName = buyer.name;
    this.editEmail = buyer.email;
    this.editMobile = buyer.mobile;
    this.passwordBuyer.set(null);
    this.error.set('');
    this.notice.set('');
  }

  startPassword(buyer: AdminStoreBuyerRow): void {
    this.passwordBuyer.set(buyer);
    this.newPassword = '';
    this.confirmPassword = '';
    this.editBuyer.set(null);
    this.error.set('');
    this.notice.set('');
  }

  cancelForms(): void {
    this.editBuyer.set(null);
    this.passwordBuyer.set(null);
    this.newPassword = '';
    this.confirmPassword = '';
  }

  saveBuyer(): void {
    const buyer = this.editBuyer();
    if (!buyer) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api.updateStoreBuyer(buyer.id, {
      name: this.editName.trim(),
      email: this.editEmail.trim() || undefined,
      mobile: this.editMobile.trim() || undefined,
    }).subscribe({
      next: (sales) => {
        this.sales.set(sales);
        this.busy.set(false);
        this.editBuyer.set(null);
        this.notice.set(`Updated ${this.editName.trim()}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.apiMessage(err, 'Could not update that user.'));
      },
    });
  }

  removeOrder(order: AdminStoreOrderRow | AdminStoreBuyerPurchase): void {
    const id = ('id' in order ? order.id : order.orderId).trim();
    const title = (('productTitle' in order ? order.productTitle : order.title) || 'this order').trim();
    if (this.busy() || !id) {
      return;
    }
    if (!window.confirm(`Remove the ${title} order? It drops from sales totals. The buyer must buy it again to download.`)) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    this.api.deleteStoreOrder(id).subscribe({
      next: (sales) => {
        this.sales.set(sales);
        this.busy.set(false);
        this.notice.set(`Removed the ${title} order.`);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.apiMessage(err, 'Could not remove that order.'));
      },
    });
  }

  removeBuyer(buyer: AdminStoreBuyerRow): void {
    if (this.busy() || buyer.isAdmin) {
      return;
    }
    if (!window.confirm(`Remove ${buyer.name}? They will no longer be able to log in. Paid sales stay in the totals.`)) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    this.api.deleteStoreBuyer(buyer.id).subscribe({
      next: (sales) => {
        this.sales.set(sales);
        this.busy.set(false);
        if (this.openBuyerId() === buyer.id) {
          this.openBuyerId.set('');
        }
        if (this.editBuyer()?.id === buyer.id) {
          this.editBuyer.set(null);
        }
        if (this.passwordBuyer()?.id === buyer.id) {
          this.passwordBuyer.set(null);
        }
        this.notice.set(`Removed ${buyer.name}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.apiMessage(err, 'Could not remove that user.'));
      },
    });
  }

  savePassword(): void {
    const buyer = this.passwordBuyer();
    if (!buyer) {
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error.set('The two passwords do not match.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api.setStoreBuyerPassword(buyer.id, this.newPassword).subscribe({
      next: () => {
        this.busy.set(false);
        this.passwordBuyer.set(null);
        this.newPassword = '';
        this.confirmPassword = '';
        this.notice.set(`Password updated for ${buyer.name}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(this.apiMessage(err, 'Could not change that password.'));
      },
    });
  }

  coverSrc(ebook: AdminEbookCover): string {
    return this.store.coverSrc({
      id: ebook.productId,
      cover: ebook.cover,
      hasUploadedCover: ebook.hasUploadedCover,
      coverVersion: ebook.coverVersion,
    }, true);
  }

  onCoverError(event: Event, ebook: AdminEbookCover): void {
    const img = event.target as HTMLImageElement;
    const used = Number(img.dataset['coverFallback'] || '0');
    const next = this.store.coverFallbacks({ id: ebook.productId, cover: ebook.cover })[used];
    if (!next) {
      img.hidden = true;
      return;
    }
    img.dataset['coverFallback'] = String(used + 1);
    img.src = next;
  }

  onCoverPicked(ebook: AdminEbookCover, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.uploadingId.set(ebook.productId);
    this.error.set('');
    this.api.uploadEbookCover(ebook.productId, file).subscribe({
      next: (updated) => {
        this.ebooks.update((list) => list.map((item) => (item.productId === updated.productId ? updated : item)));
        this.uploadingId.set('');
      },
      error: () => {
        this.uploadingId.set('');
        this.error.set(`Could not upload a cover for ${ebook.title}. Use a PNG, JPG, or WebP under 3 MB.`);
      },
    });
  }

  clearPurchases(): void {
    if (this.busy()) {
      return;
    }
    if (!window.confirm('Remove every paid store order and download token? This cannot be undone.')) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api.clearStoreSales().subscribe({
      next: () => {
        this.store.clearPurchases();
        this.busy.set(false);
        this.refresh();
      },
      error: () => {
        this.busy.set(false);
        this.error.set('Purchases could not be cleared. Sign in again if the session expired.');
      },
    });
  }

  private apiMessage(err: HttpErrorResponse, fallback: string): string {
    const message = err.error?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
}
