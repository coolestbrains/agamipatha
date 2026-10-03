import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from './environment';

export type CareerReportVoice = 'student' | 'parent' | 'explore';

export interface CareerReportStatus {
  subscriptionActive: boolean;
  periodEndUtc?: string | null;
  hasProfile: boolean;
  standingNodeId?: string | null;
  goalNodeId?: string | null;
  displayName?: string | null;
  aiCredits: number;
  reportCostCredits: number;
}

export interface CareerReportStageGroup {
  label: string;
  items: string[];
}

export interface CareerReportStage {
  title: string;
  kicker: string;
  summary: string;
  groups: CareerReportStageGroup[];
}

export interface CareerReportAi {
  intro: string;
  fit: string;
  risks: string[];
  actions30: string[];
  actions90: string[];
  usedAi: boolean;
}

export interface CareerReport {
  displayName: string;
  city?: string | null;
  circleRole: string;
  audience: string;
  standingTitle: string;
  goalTitle: string;
  spine: string;
  totalLabel: string;
  overview: string[];
  stages: CareerReportStage[];
  ai: CareerReportAi;
  nextDoors: string[];
  disclaimer: string;
  generatedAtUtc: string;
  filename: string;
  voice: CareerReportVoice;
  aiAvailable: boolean;
  creditsRemaining: number;
  reportCostCredits: number;
  creditsCharged: number;
  needsAiTopUp: boolean;
}

export interface CareerReportGenerateRequest {
  fromId?: string;
  toId?: string;
  via?: string;
  voice?: CareerReportVoice;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  status(): Observable<CareerReportStatus> {
    return this.http.get<CareerReportStatus>(`${this.base}/report/status`);
  }

  generate(body: CareerReportGenerateRequest): Observable<CareerReport> {
    return this.http.post<CareerReport>(`${this.base}/report/generate`, body);
  }

  errorMessage(err: unknown, fallback: string): string {
    const msg = (err as { error?: { message?: string } })?.error?.message;
    return typeof msg === 'string' && msg.trim() ? msg.trim() : fallback;
  }
}
