import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, of, retry, tap, timer } from 'rxjs';
import { environment } from './environment';

export interface SiteStats {
  searches: number;
  guestVisits: number;
  guestsToday: number;
  searchesToday: number;
  qualifications: number;
  professions: number;
  qualificationsToday: number;
  professionsToday: number;
  purchases: number;
  purchasesToday: number;
  registered: number;
  registeredToday: number;
  storedIn: string;
}

export type StatMetric =
  | 'searches'
  | 'guests'
  | 'qualifications'
  | 'professions'
  | 'purchases'
  | 'registered';

export interface StatSeriesPoint {
  date: string;
  daily: number;
  value: number;
}

export interface StatSeries {
  metric: string;
  label: string;
  total: number;
  points: StatSeriesPoint[];
}

const GUEST_FLAG = 'agamipatha.guestVisitCounted';
const GUEST_ID = 'agamipatha.guestVisitorId';
const GUEST_DAY = 'agamipatha.guestVisitDay';

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  readonly snapshot = signal<SiteStats | null>(null);
  readonly loadError = signal(false);

  loadSeries(metric: StatMetric) {
    return this.http.get<StatSeries>(`${this.base}/admin/stats/series`, { params: { metric } });
  }

  load() {
    return this.http.get<SiteStats>(`${this.base}/stats`).pipe(
      retry({ count: 4, delay: () => timer(800) }),
      tap((s) => {
        this.snapshot.set(s);
        this.loadError.set(false);
      }),
      catchError(() => {
        this.loadError.set(true);
        return of(null);
      }),
    );
  }

  /** Count this browser + domain once per Indian calendar day. */
  recordGuestIfNeeded() {
    const day = todayIst();
    const visitorKey = readOrCreateVisitorId();
    try {
      if (localStorage.getItem(GUEST_DAY) === day) {
        return this.load();
      }
      if (localStorage.getItem(GUEST_FLAG) && !localStorage.getItem(GUEST_DAY)) {
        localStorage.setItem(GUEST_DAY, day);
        return this.load();
      }
    } catch {
      /* private mode — still send a key so the API can dedupe the day */
    }

    return this.http.post<SiteStats>(`${this.base}/stats/visit`, { visitorKey }).pipe(
      tap((s) => {
        this.snapshot.set(s);
        this.loadError.set(false);
        try {
          localStorage.setItem(GUEST_DAY, day);
          localStorage.removeItem(GUEST_FLAG);
        } catch {
          /* private mode */
        }
      }),
      catchError(() => this.load()),
    );
  }
}

function todayIst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function readOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(GUEST_ID)?.trim();
    if (existing && existing.length >= 8) {
      return existing.slice(0, 64);
    }
    const next =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(GUEST_ID, next);
    return next;
  } catch {
    return '';
  }
}
