import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookAdService } from '../book-ad.service';
import { StoreProduct, StoreService } from '../store.service';

@Component({
  selector: 'app-book-ad',
  imports: [RouterLink],
  templateUrl: './book-ad.component.html',
  styleUrl: './book-ad.component.scss',
})
export class BookAdComponent {
  readonly ads = inject(BookAdService);
  private readonly store = inject(StoreService);

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
    img.src = next;
    img.dataset['coverFallback'] = String(used + 1);
  }
}
