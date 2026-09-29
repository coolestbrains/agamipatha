import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from './environment';

export interface PathProfile {
  buyerId: string;
  displayName: string;
  headline: string;
  city?: string | null;
  standingNodeId: string;
  standingTitle: string;
  goalNodeId: string;
  goalTitle: string;
  audience: string;
  bio: string;
  helpOffers: string[];
  lookingFor: string[];
  isDiscoverable: boolean;
  shareEmail: boolean;
  shareMobile: boolean;
  under18: boolean;
  inviteCode: string;
  updatedAtUtc: string;
  circleRole: string;
}

export interface PathProfileUpsert {
  displayName: string;
  headline?: string;
  city?: string;
  standingNodeId: string;
  goalNodeId: string;
  audience: string;
  circleRole?: string;
  bio?: string;
  helpOffers: string[];
  lookingFor: string[];
  isDiscoverable: boolean;
  shareEmail: boolean;
  shareMobile: boolean;
  under18: boolean;
}

export interface PathPeerCard {
  buyerId: string;
  displayName: string;
  headline: string;
  city?: string | null;
  standingNodeId: string;
  standingTitle: string;
  goalNodeId: string;
  goalTitle: string;
  audience: string;
  bio: string;
  helpOffers: string[];
  lookingFor: string[];
  matchScore: number;
  relation: string;
  requestId?: number | null;
}

export interface PathConnectRequest {
  id: number;
  direction: string;
  otherBuyerId: string;
  otherDisplayName: string;
  otherHeadline: string;
  goalTitle: string;
  standingTitle: string;
  status: string;
  note?: string | null;
  createdAtUtc: string;
}

export interface PathConnection {
  requestId: number;
  buyerId: string;
  displayName: string;
  headline: string;
  city?: string | null;
  standingTitle: string;
  goalTitle: string;
  audience: string;
  helpOffers: string[];
  lookingFor: string[];
  email?: string | null;
  mobile?: string | null;
  connectedAtUtc: string;
}

export interface PathMessage {
  id: number;
  fromBuyerId: string;
  toBuyerId: string;
  body: string;
  createdAtUtc: string;
  mine: boolean;
}

export interface PathCircleStats {
  profiles: number;
  discoverable: number;
  pendingRequests: number;
  acceptedConnections: number;
  reports: number;
  recentReports: {
    id: number;
    reporterBuyerId: string;
    reporterName: string;
    targetBuyerId: string;
    targetName: string;
    reason: string;
    createdAtUtc: string;
  }[];
}

export const CIRCLE_TAGS: { id: string; label: string }[] = [
  { id: 'exam-prep', label: 'Exam prep' },
  { id: 'application-checklist', label: 'Applications' },
  { id: 'fee-reality-check', label: 'Fees & cost' },
  { id: 'stream-advice', label: 'Stream advice' },
  { id: 'motivation', label: 'Motivation' },
  { id: 'study-buddy', label: 'Study buddy' },
  { id: 'internship-tips', label: 'Internships' },
  { id: 'career-switch', label: 'Career switch' },
];

@Injectable({ providedIn: 'root' })
export class CircleService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/circle`;

  myProfile(): Observable<PathProfile | null> {
    return this.http.get<PathProfile>(`${this.base}/profile/me`).pipe(
      catchError((err) => {
        if (err?.status === 404) {
          return of(null);
        }
        return throwError(() => err);
      }),
    );
  }

  saveProfile(body: PathProfileUpsert): Observable<PathProfile> {
    return this.http.put<PathProfile>(`${this.base}/profile`, body);
  }

  peers(goalId?: string, standingId?: string, mentor = false): Observable<PathPeerCard[]> {
    const params: Record<string, string> = {};
    if (goalId) {
      params['goalId'] = goalId;
    }
    if (standingId) {
      params['standingId'] = standingId;
    }
    if (mentor) {
      params['mentor'] = '1';
    }
    return this.http.get<PathPeerCard[]>(`${this.base}/peers`, { params });
  }

  messages(withBuyerId: string): Observable<PathMessage[]> {
    return this.http.get<PathMessage[]>(`${this.base}/messages`, { params: { with: withBuyerId } });
  }

  sendMessage(toBuyerId: string, body: string): Observable<PathMessage> {
    return this.http.post<PathMessage>(`${this.base}/messages`, { toBuyerId, body });
  }

  requests(): Observable<PathConnectRequest[]> {
    return this.http.get<PathConnectRequest[]>(`${this.base}/requests`);
  }

  connect(toBuyerId: string, note?: string): Observable<PathConnectRequest> {
    return this.http.post<PathConnectRequest>(`${this.base}/requests`, { toBuyerId, note: note || null });
  }

  accept(id: number): Observable<PathConnectRequest> {
    return this.http.post<PathConnectRequest>(`${this.base}/requests/${id}/accept`, {});
  }

  decline(id: number): Observable<PathConnectRequest> {
    return this.http.post<PathConnectRequest>(`${this.base}/requests/${id}/decline`, {});
  }

  connections(): Observable<PathConnection[]> {
    return this.http.get<PathConnection[]>(`${this.base}/connections`);
  }

  block(targetBuyerId: string): Observable<void> {
    return this.http.post<void>(`${this.base}/block`, { targetBuyerId, reason: 'blocked' });
  }

  report(targetBuyerId: string, reason: string): Observable<void> {
    return this.http.post<void>(`${this.base}/report`, { targetBuyerId, reason });
  }

  invite(code: string): Observable<PathProfile | null> {
    return this.http.get<PathProfile>(`${this.base}/invite/${encodeURIComponent(code)}`).pipe(
      catchError(() => of(null)),
    );
  }

  adminStats(): Observable<PathCircleStats> {
    return this.http.get<PathCircleStats>(`${environment.apiUrl}/admin/circle/stats`);
  }

  errorMessage(err: unknown, fallback: string): string {
    const msg = (err as { error?: { message?: string } })?.error?.message;
    return typeof msg === 'string' && msg.trim() ? msg.trim() : fallback;
  }

  tagLabel(id: string): string {
    return CIRCLE_TAGS.find((t) => t.id === id)?.label || id;
  }
}
