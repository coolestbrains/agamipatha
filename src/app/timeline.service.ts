import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { CareerService } from './career.service';
import { JourneyService, SavedJourney } from './journey.service';
import { BuyerAuthService } from './buyer-auth.service';
import { buyerIdFromToken } from './jwt';
import { pickRoute, stepIdsOf } from './path-timeline';

const KEY_PREFIX = 'agamipatha-timeline:';

export interface TimelineProgress {
  completed: string[];
  stepIds: string[];
  done: number;
  total: number;
  left: number;
  percent: number;
}

interface TimelineRecord {
  completed: string[];
  stepIds: string[];
}

const EMPTY: TimelineRecord = { completed: [], stepIds: [] };

@Injectable({ providedIn: 'root' })
export class TimelineService {
  private readonly buyer = inject(BuyerAuthService);
  private readonly career = inject(CareerService);
  private readonly journeys = inject(JourneyService);
  private fetching = '';

  readonly record = signal<TimelineRecord>(EMPTY);
  readonly completed = computed(() => this.record().completed);
  readonly progress = computed<TimelineProgress>(() => {
    const { completed, stepIds } = this.record();
    const known = stepIds.length ? stepIds : completed;
    const total = known.length;
    const doneSet = new Set(completed);
    const done = known.filter((id) => doneSet.has(id)).length;
    return {
      completed,
      stepIds: known,
      done,
      total,
      left: Math.max(0, total - done),
      percent: total ? Math.round((done / total) * 100) : 0,
    };
  });

  readonly buyerId = computed(() => {
    if (!this.buyer.isLoggedIn()) {
      return '';
    }
    return buyerIdFromToken(this.buyer.token()) || this.buyer.token().slice(-24);
  });

  constructor() {
    effect(() => {
      const trip = this.journeys.myPath();
      const id = this.buyerId();
      const ready = this.career.ready();
      if (!id || !trip) {
        this.record.set(EMPTY);
        this.fetching = '';
        return;
      }
      const stored = this.read(this.key(id, trip));
      this.record.set(stored);
      if (ready && !stored.stepIds.length) {
        untracked(() => this.fetchSteps(id, trip));
      }
    });

    window.addEventListener('storage', (event) => {
      if (!event.key?.startsWith(KEY_PREFIX)) {
        return;
      }
      const trip = this.journeys.myPath();
      const id = this.buyerId();
      if (!id || !trip || event.key !== this.key(id, trip)) {
        return;
      }
      this.record.set(this.read(event.key));
    });
  }

  isDone(nodeId: string): boolean {
    return this.record().completed.includes(nodeId);
  }

  setSteps(ids: string[]): void {
    const trip = this.journeys.myPath();
    const buyerId = this.buyerId();
    if (!trip || !buyerId) {
      return;
    }
    const stepIds = unique(ids);
    const completed = this.record().completed.filter((id) => stepIds.includes(id));
    this.persist(this.key(buyerId, trip), { completed, stepIds });
  }

  toggle(nodeId: string): boolean {
    const trip = this.journeys.myPath();
    const buyerId = this.buyerId();
    const step = nodeId.trim();
    if (!buyerId || !trip || !step) {
      return false;
    }
    const current = this.record();
    const completed = current.completed.includes(step)
      ? current.completed.filter((item) => item !== step)
      : [...current.completed, step];
    this.persist(this.key(buyerId, trip), { completed, stepIds: current.stepIds });
    return completed.includes(step);
  }

  private fetchSteps(buyerId: string, trip: SavedJourney): void {
    const stamp = this.key(buyerId, trip);
    if (this.fetching === stamp) {
      return;
    }
    this.fetching = stamp;
    this.career.loadPath(trip.fromId, trip.toId).subscribe((set) => {
      if (this.fetching !== stamp || this.buyerId() !== buyerId) {
        return;
      }
      this.fetching = '';
      const ids = stepIdsOf(pickRoute(set, trip.via));
      if (ids.length) {
        this.setSteps(ids);
      }
    });
  }

  private persist(key: string, next: TimelineRecord): void {
    this.write(key, next);
    this.record.set(next);
  }

  private key(buyerId: string, trip: SavedJourney): string {
    return `${KEY_PREFIX}${buyerId}:${trip.fromId}>${trip.toId}:${trip.via}`;
  }

  private read(key: string): TimelineRecord {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return { ...EMPTY };
      }
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return { completed: unique(parsed.map((item) => String(item))), stepIds: [] };
      }
      if (!parsed || typeof parsed !== 'object') {
        return { ...EMPTY };
      }
      const row = parsed as Partial<TimelineRecord>;
      return {
        completed: unique((row.completed ?? []).map((item) => String(item))),
        stepIds: unique((row.stepIds ?? []).map((item) => String(item))),
      };
    } catch {
      return { ...EMPTY };
    }
  }

  private write(key: string, record: TimelineRecord): void {
    try {
      localStorage.setItem(key, JSON.stringify(record));
    } catch {
      /* private mode */
    }
  }
}

function unique(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}
