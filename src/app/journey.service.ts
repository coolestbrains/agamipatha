import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { BuyerAuthService } from './buyer-auth.service';
import { buyerIdFromToken } from './jwt';

export interface SavedJourney {
  fromId: string;
  toId: string;
  via: string;
  updatedAt: number;
}

export type PendingSaveKind = 'my-path' | 'favourite';

const KEY_PREFIX = 'agamipatha-saved-journey:';
const GUEST_KEY = `${KEY_PREFIX}guest`;
const MY_PATH_PREFIX = 'agamipatha-my-path:';
const FAV_PREFIX = 'agamipatha-my-paths:';
const GUEST_FAVS = `${FAV_PREFIX}guest`;
const PENDING_KEY = 'agamipatha-pending-pin';
const MAX_FAVOURITES = 10;

@Injectable({ providedIn: 'root' })
export class JourneyService {
  private readonly buyer = inject(BuyerAuthService);
  private readonly router = inject(Router);

  readonly saved = signal<SavedJourney | null>(null);
  readonly myPath = signal<SavedJourney | null>(null);
  readonly favourites = signal<SavedJourney[]>([]);
  readonly buyerId = computed(() => {
    if (!this.buyer.isLoggedIn()) {
      return '';
    }
    return buyerIdFromToken(this.buyer.token()) || this.buyer.token().slice(-24);
  });

  constructor() {
    effect(() => {
      const id = this.buyerId();
      if (!id) {
        this.saved.set(this.read(GUEST_KEY));
        this.myPath.set(null);
        this.favourites.set([]);
        return;
      }
      this.promoteGuest(id);
      this.promoteGuestFavourites(id);
      this.saved.set(this.read(this.accountKey(id)));
      this.myPath.set(this.read(this.myPathKey(id)));
      this.favourites.set(this.readList(this.favKey(id)).slice(0, MAX_FAVOURITES));
      this.commitPendingSave();
    });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.capture(event.urlAfterRedirects));
    this.capture(this.router.url);

    window.addEventListener('storage', (event) => {
      if (!event.key) {
        return;
      }
      const id = this.buyerId();
      if (event.key.startsWith(KEY_PREFIX)) {
        this.saved.set(id ? this.read(this.accountKey(id)) : this.read(GUEST_KEY));
      }
      if (event.key.startsWith(MY_PATH_PREFIX)) {
        this.myPath.set(id ? this.read(this.myPathKey(id)) : null);
      }
      if (event.key.startsWith(FAV_PREFIX)) {
        this.favourites.set(id ? this.readList(this.favKey(id)).slice(0, MAX_FAVOURITES) : []);
      }
    });
  }

  remember(fromId: string, toId: string, via = ''): void {
    const trip = this.trip(fromId, toId, via);
    if (!trip) {
      return;
    }
    this.write(GUEST_KEY, trip);
    const id = this.buyerId();
    if (id) {
      this.write(this.accountKey(id), trip);
    }
    this.saved.set(trip);
  }

  isMyPath(fromId: string, toId: string, via = ''): boolean {
    const current = this.myPath();
    return !!current && this.same(current, fromId, toId, via);
  }

  isFavourite(fromId: string, toId: string, via = ''): boolean {
    return this.favourites().some((item) => this.same(item, fromId, toId, via));
  }

  queueMyPath(fromId: string, toId: string, via = ''): boolean {
    return this.queueSave('my-path', fromId, toId, via);
  }

  queueFavourite(fromId: string, toId: string, via = ''): boolean {
    return this.queueSave('favourite', fromId, toId, via);
  }

  hasPendingSave(): boolean {
    return !!this.readPendingSave();
  }

  pendingKind(): PendingSaveKind | '' {
    return this.readPendingSave()?.kind ?? '';
  }

  commitPendingSave(): boolean {
    const pending = this.readPendingSave();
    this.clearPending();
    if (!pending || !this.buyerId()) {
      return false;
    }
    if (pending.kind === 'my-path') {
      return this.setMyPath(pending.fromId, pending.toId, pending.via);
    }
    return this.addFavourite(pending.fromId, pending.toId, pending.via);
  }

  setMyPath(fromId: string, toId: string, via = ''): boolean {
    const trip = this.trip(fromId, toId, via);
    if (!trip) {
      return false;
    }
    this.persistMyPath(trip);
    return true;
  }

  clearMyPath(): void {
    this.persistMyPath(null);
  }

  toggleMyPath(fromId: string, toId: string, via = ''): boolean {
    if (this.isMyPath(fromId, toId, via)) {
      this.clearMyPath();
      return false;
    }
    return this.setMyPath(fromId, toId, via);
  }

  addFavourite(fromId: string, toId: string, via = ''): boolean {
    const trip = this.trip(fromId, toId, via);
    if (!trip) {
      return false;
    }
    const next = [trip, ...this.favourites().filter((item) => !this.same(item, fromId, toId, via))].slice(
      0,
      MAX_FAVOURITES,
    );
    this.persistFavourites(next);
    return true;
  }

  removeFavourite(fromId: string, toId: string, via = ''): void {
    this.persistFavourites(this.favourites().filter((item) => !this.same(item, fromId, toId, via)));
  }

  toggleFavourite(fromId: string, toId: string, via = ''): boolean {
    if (this.isFavourite(fromId, toId, via)) {
      this.removeFavourite(fromId, toId, via);
      return false;
    }
    return this.addFavourite(fromId, toId, via);
  }

  continueLink(): { path: string; queryParams: Record<string, string> } | null {
    return this.linkFor(this.saved());
  }

  linkFor(trip: Pick<SavedJourney, 'fromId' | 'toId' | 'via'> | null): { path: string; queryParams: Record<string, string> } | null {
    if (!trip) {
      return null;
    }
    const queryParams: Record<string, string> = { from: trip.fromId, to: trip.toId };
    if (trip.via) {
      queryParams['via'] = trip.via;
    }
    return { path: '/path', queryParams };
  }

  private capture(url: string): void {
    const tree = this.router.parseUrl(url);
    const path = '/' + (tree.root.children['primary']?.segments.map((part) => part.path).join('/') ?? '');
    if (path !== '/path') {
      return;
    }
    this.remember(tree.queryParams['from'] ?? '', tree.queryParams['to'] ?? '', tree.queryParams['via'] ?? '');
  }

  private trip(fromId: string, toId: string, via = ''): SavedJourney | null {
    const from = fromId.trim();
    const to = toId.trim();
    if (!from || !to || from === to) {
      return null;
    }
    return {
      fromId: from,
      toId: to,
      via: via.trim(),
      updatedAt: Date.now(),
    };
  }

  private same(item: SavedJourney, fromId: string, toId: string, via = ''): boolean {
    return item.fromId === fromId.trim() && item.toId === toId.trim() && item.via === via.trim();
  }

  private persistMyPath(trip: SavedJourney | null): void {
    const id = this.buyerId();
    if (id) {
      if (trip) {
        this.write(this.myPathKey(id), trip);
      } else {
        this.removeKey(this.myPathKey(id));
      }
    }
    this.myPath.set(trip);
  }

  private persistFavourites(list: SavedJourney[]): void {
    const id = this.buyerId();
    if (id) {
      this.writeList(this.favKey(id), list);
    }
    this.favourites.set(list);
  }

  private queueSave(kind: PendingSaveKind, fromId: string, toId: string, via = ''): boolean {
    const trip = this.trip(fromId, toId, via);
    if (!trip) {
      return false;
    }
    this.writePending({ kind, ...trip });
    return true;
  }

  private readPendingSave(): (SavedJourney & { kind: PendingSaveKind }) | null {
    const parsed = this.parseRaw(this.readPending());
    const trip = this.cleanTrip(parsed);
    if (!trip) {
      return null;
    }
    const kind = parsed && typeof parsed === 'object' && 'kind' in parsed && (parsed as { kind?: string }).kind === 'my-path'
      ? 'my-path'
      : 'favourite';
    return { ...trip, kind };
  }

  private clearPending(): void {
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* private mode */
    }
  }

  private promoteGuest(buyerId: string): void {
    const guest = this.read(GUEST_KEY);
    const accountKey = this.accountKey(buyerId);
    const account = this.read(accountKey);
    if (!guest) {
      return;
    }
    if (!account || guest.updatedAt >= account.updatedAt) {
      this.write(accountKey, guest);
    }
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {
      /* private mode */
    }
  }

  private promoteGuestFavourites(buyerId: string): void {
    const guest = this.readList(GUEST_FAVS);
    const key = this.favKey(buyerId);
    const account = this.readList(key);
    if (!guest.length) {
      return;
    }
    const merged = [...guest, ...account]
      .filter((item, index, all) => all.findIndex((row) => this.same(row, item.fromId, item.toId, item.via)) === index)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_FAVOURITES);
    this.writeList(key, merged);
    try {
      localStorage.removeItem(GUEST_FAVS);
    } catch {
      /* private mode */
    }
  }

  private accountKey(buyerId: string): string {
    return KEY_PREFIX + buyerId;
  }

  private myPathKey(buyerId: string): string {
    return MY_PATH_PREFIX + buyerId;
  }

  private favKey(buyerId: string): string {
    return FAV_PREFIX + buyerId;
  }

  private read(key: string): SavedJourney | null {
    try {
      const raw = this.readRaw(key);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return this.cleanTrip(parsed[0]);
      }
      return this.cleanTrip(parsed);
    } catch {
      return null;
    }
  }

  private readList(key: string): SavedJourney[] {
    const raw = this.readRaw(key);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => this.cleanTrip(item)).filter((item): item is SavedJourney => !!item);
      }
      const one = this.cleanTrip(parsed);
      return one ? [one] : [];
    } catch {
      return [];
    }
  }

  private cleanTrip(parsed: unknown): SavedJourney | null {
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const row = parsed as Partial<SavedJourney>;
    if (!row.fromId || !row.toId) {
      return null;
    }
    return {
      fromId: String(row.fromId),
      toId: String(row.toId),
      via: typeof row.via === 'string' ? row.via : '',
      updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
    };
  }

  private readRaw(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private readPending(): string | null {
    try {
      return sessionStorage.getItem(PENDING_KEY);
    } catch {
      return null;
    }
  }

  private writePending(value: SavedJourney & { kind: PendingSaveKind }): void {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
    } catch {
      /* private mode */
    }
  }

  private parseRaw(raw: string | null): unknown {
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private removeKey(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* private mode */
    }
  }

  private write(key: string, trip: SavedJourney): void {
    try {
      localStorage.setItem(key, JSON.stringify(trip));
    } catch {
      /* private mode */
    }
  }

  private writeList(key: string, list: SavedJourney[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* private mode */
    }
  }
}
