import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { catchError, filter, interval, of } from 'rxjs';
import { StoreProduct, StoreService } from './store.service';

const ROTATE_MS = 12_000;
const DISMISS_KEY = 'agamipatha-book-ad-dismissed';
const COLLAPSE_KEY = 'agamipatha-book-ad-collapsed';

const FALLBACK_BOOKS: StoreProduct[] = [
  {
    id: 'career-path-ebook',
    title: 'Career Path Planner ebook',
    description: '',
    kind: 'ebook',
    pricePaise: 4900,
    priceLabel: '₹49',
    cover: '/store/career-path-planner-cover.png',
  },
  {
    id: 'career-directory-ebook',
    title: 'All Career Paths',
    description: '',
    kind: 'ebook',
    pricePaise: 4900,
    priceLabel: '₹49',
    cover: '/store/all-career-paths-cover.png',
  },
  {
    id: 'bachelor-recipes-ebook',
    title: '99 Cost-Effective Recipes for Bachelors',
    description: '',
    kind: 'ebook',
    pricePaise: 4900,
    priceLabel: '₹49',
    cover: '/store/99-recipes-for-bachelors-cover.png',
  },
  {
    id: 'class-10-stream-chooser-ebook',
    title: 'Class 10 Stream Chooser',
    description: '',
    kind: 'ebook',
    pricePaise: 4500,
    priceLabel: '₹45',
    cover: '/store/class-10-stream-chooser-cover.png',
  },
  {
    id: 'first-year-college-survival-ebook',
    title: 'First-year College Survival',
    description: '',
    kind: 'ebook',
    pricePaise: 4500,
    priceLabel: '₹45',
    cover: '/store/first-year-college-survival-cover.png',
  },
];

@Injectable({ providedIn: 'root' })
export class BookAdService {
  private readonly store = inject(StoreService);
  private readonly router = inject(Router);
  private queue: StoreProduct[] = [];

  readonly books = signal<StoreProduct[]>([]);
  readonly current = signal<StoreProduct | null>(null);
  readonly path = signal('');
  readonly collapsed = signal(false);
  readonly dismissed = signal(false);
  readonly visible = computed(() => {
    if (this.dismissed() || !this.current()) {
      return false;
    }
    return this.isPlannerPath(this.path());
  });

  constructor() {
    this.clearStoredDismiss();
    this.collapsed.set(this.readFlag(COLLAPSE_KEY));
    this.path.set(this.router.url);
    this.useBooks(FALLBACK_BOOKS);
    this.store.catalog().pipe(catchError(() => of(null))).subscribe({
      next: (catalog) => {
        const listed = catalog?.products ?? [];
        const onSale = listed.filter((item) => item.onSale !== false);
        this.useBooks(onSale.length ? onSale : listed);
      },
    });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        const nextPath = event.urlAfterRedirects.split('?')[0].split('#')[0];
        const prevPath = this.path().split('?')[0].split('#')[0];
        this.path.set(event.urlAfterRedirects);
        if (nextPath !== prevPath) {
          this.showNext();
        }
      });

    interval(ROTATE_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.visible() && !this.collapsed() && this.books().length > 1) {
          this.showNext();
        }
      });
  }

  showNext(): void {
    const books = this.books().length ? this.books() : FALLBACK_BOOKS;
    if (!books.length) {
      this.current.set(null);
      return;
    }
    if (this.queue.length === 0) {
      this.queue = this.shuffle(books.filter((book) => book.id !== this.current()?.id));
      if (!this.queue.length) {
        this.queue = this.shuffle(books);
      }
    }
    this.current.set(this.queue.shift() ?? books[0]);
  }

  collapse(): void {
    this.collapsed.set(true);
    this.writeFlag(COLLAPSE_KEY, true);
  }

  expand(): void {
    this.collapsed.set(false);
    this.writeFlag(COLLAPSE_KEY, false);
  }

  dismiss(): void {
    this.dismissed.set(true);
  }

  private isPlannerPath(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];
    return path === '' || path === '/' || path.startsWith('/path') || path.startsWith('/options') || path.startsWith('/compare');
  }

  private useBooks(books: StoreProduct[]): void {
    const next = books.length ? books : FALLBACK_BOOKS;
    this.books.set(next);
    if (!this.current() || !next.some((book) => book.id === this.current()?.id)) {
      this.queue = [];
      this.showNext();
    }
  }

  private clearStoredDismiss(): void {
    try {
      localStorage.removeItem(DISMISS_KEY);
      sessionStorage.removeItem(DISMISS_KEY);
    } catch {
      /* private mode */
    }
  }

  private readFlag(key: string): boolean {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  }

  private writeFlag(key: string, value: boolean): void {
    try {
      if (value) {
        localStorage.setItem(key, '1');
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      /* private mode */
    }
  }

  private shuffle(list: StoreProduct[]): StoreProduct[] {
    const next = [...list];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  }
}
