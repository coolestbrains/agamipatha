import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError, timeout } from 'rxjs';
import { environment } from './environment';
import {
  CareerEdge,
  CareerNode,
  LinkedCert,
  LinkedRef,
  PathSet,
  NodeKind,
} from './models/career.model';
import certPack from './data/profession_certs.json';
import {
  isBelowMetric,
  METRIC_ID,
  metricStartNote,
  pathFromId,
  PRE_METRIC_NODES,
  preMetricNode,
  schoolLadderRank,
} from './pre-metric';
import {
  linkedCertifications,
  linkedEmployers,
  linkedInstitutes,
} from './data/detail_links';

const TRENDING_FALLBACK_IDS = [
  'software-engineer',
  'doctor',
  'data-scientist',
  'chartered-accountant',
  'civil-servant',
  'ml-engineer',
  'lawyer',
  'full-stack-developer',
  'mba',
  'nurse',
];


const KIND_ORDER: NodeKind[] = [
  'school',
  'higher-secondary',
  'vocational',
  'entrance-exam',
  'undergraduate',
  'postgraduate',
  'professional',
  'profession',
];

interface CatalogResponse {
  nodes: CareerNode[];
  edges: CareerEdge[];
}

export interface OptionsResponse {
  from: CareerNode;
  next: { node: CareerNode; edge: CareerEdge }[];
  professions: CareerNode[];
}

@Injectable({ providedIn: 'root' })
export class CareerService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  readonly ready = signal(false);
  readonly loadError = signal('');
  readonly nodes = signal<CareerNode[]>([]);
  readonly edges = signal<CareerEdge[]>([]);

  readonly qualifications = computed(() => {
    const catalog = this.nodes().filter((n) => n.kind !== 'profession' && n.kind !== 'entrance-exam');
    const extras = PRE_METRIC_NODES.filter((node) => !catalog.some((item) => item.id === node.id));
    return [...extras, ...catalog].sort(this.compareNodes);
  });

  readonly professions = computed(() =>
    this.nodes()
      .filter((n) => n.kind === 'profession')
      .sort((a, b) => a.title.localeCompare(b.title)),
  );

  readonly entranceExams = computed(() =>
    this.nodes()
      .filter((n) => n.kind === 'entrance-exam')
      .sort((a, b) => a.title.localeCompare(b.title)),
  );

  readonly destinationGroups = computed(() => [
    { label: 'Qualifications', nodes: this.qualifications() },
    { label: 'Entrance exams', nodes: this.entranceExams() },
    { label: 'Professions', nodes: this.professions() },
  ]);

  readonly detailNode = signal<CareerNode | null>(null);
  readonly detailFromId = signal('');
  readonly trending = signal<CareerNode[]>([]);

  openDetail(node: CareerNode, fromId?: string): void {
    // Set UI state first; defer network so the popup can paint without competition.
    this.detailNode.set(node);
    this.detailFromId.set(fromId ?? '');
    window.setTimeout(() => {
      this.recordInterest(node.id);
      this.refreshTrending();
    }, 600);
  }

  closeDetail(): void {
    this.detailNode.set(null);
  }

  suggestMissing(body: {
    slot: 'start' | 'goal';
    kind: 'qualification' | 'profession';
    title: string;
    notes?: string;
    fromId?: string;
    fromTitle?: string;
  }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/suggestions`, body);
  }

  recordInterest(
    nodeId: string,
    extra?: { fromId?: string; toId?: string; via?: string | null },
  ): void {
    if (!nodeId && !extra?.fromId && !extra?.toId) {
      return;
    }
    this.http
      .post(`${this.base}/stats/interest`, {
        nodeId,
        fromId: extra?.fromId || undefined,
        toId: extra?.toId || undefined,
        via: extra?.via || undefined,
      })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private refreshTrending(): void {
    this.http.get<CareerNode[]>(`${this.base}/stats/trending`).pipe(
      catchError(() => of(this.localTrending())),
      tap((list) => {
        const clean = (list ?? [])
          .filter((n) => n.kind !== 'entrance-exam')
          .slice(0, 10);
        this.trending.set(clean.length ? clean : this.localTrending().slice(0, 10));
      }),
    ).subscribe();
  }

  /** Frequent end points people search from this start qualification. */
  popularFrom(fromId: string): Observable<CareerNode[]> {
    const start = this.graphFromId(fromId);
    const fallback = this.localPopularFrom(start);
    if (!start) {
      return of(fallback);
    }
    return this.http.get<CareerNode[]>(`${this.base}/stats/destinations`, { params: { from: start } }).pipe(
      catchError(() => of(fallback)),
      map((list) => {
        const clean = (list ?? []).filter(
          (n) => n.id && n.id !== fromId && n.id !== start && n.kind !== 'entrance-exam',
        );
        return (clean.length ? clean : fallback).slice(0, 12);
      }),
    );
  }

  /** Among 2+ options, the one that is trending now and most relevant to `fromId`. */
  highlightedAmong(ids: string[], fromId?: string): string | null {
    if (ids.length < 2) {
      return null;
    }
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length < 2) {
      return null;
    }
    const rank = new Map(this.trending().map((n, i) => [n.id, i]));
    const start = fromId ? this.graphFromId(fromId) : '';
    const outgoing = new Set((start ? this.outgoingFrom(start) : []).map((hop) => hop.node.id));
    const from = start ? this.getNode(start) : undefined;
    const score = (id: string): number => {
      const node = this.getNode(id);
      let value = 0;
      const r = rank.get(id);
      if (r !== undefined) {
        value += 100 - r;
      }
      if (outgoing.has(id)) {
        value += 45;
      }
      if (from && node?.field === from.field) {
        value += 22;
      }
      return value;
    };
    const trendingIds = unique.filter((id) => rank.has(id));
    const pool = trendingIds.length ? trendingIds : unique;
    return pool.slice().sort((a, b) => score(b) - score(a) || a.localeCompare(b))[0] ?? null;
  }

  highlightLabel(id: string | null): string {
    if (!id) {
      return '';
    }
    return this.trending().some((n) => n.id === id) ? 'Trending now' : 'Best fit';
  }

  private localPopularFrom(fromId: string): CareerNode[] {
    const merged: CareerNode[] = [];
    const seen = new Set<string>(fromId ? [fromId] : []);
    const add = (node?: CareerNode): boolean => {
      if (!node || seen.has(node.id) || node.kind === 'entrance-exam') {
        return merged.length >= 12;
      }
      seen.add(node.id);
      merged.push(node);
      return merged.length >= 12;
    };

    for (const hop of this.outgoingFrom(fromId)) {
      if (add(hop.node)) {
        return merged;
      }
    }

    const queue = fromId ? [fromId] : [];
    const walk = new Set<string>(queue);
    while (queue.length) {
      const current = queue.shift()!;
      for (const hop of this.outgoingFrom(current)) {
        if (!walk.add(hop.node.id)) {
          continue;
        }
        if (hop.node.kind === 'profession') {
          if (add(hop.node)) {
            return merged;
          }
        } else {
          queue.push(hop.node.id);
        }
      }
    }

    for (const node of [...this.trending(), ...this.localTrending()]) {
      if (add(node)) {
        return merged;
      }
    }
    return merged;
  }

  private localTrending(): CareerNode[] {
    const byId = new Map(this.nodes().map((n) => [n.id, n]));
    const incoming = new Map<string, number>();
    for (const edge of this.edges()) {
      incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    }
    const popular = [...incoming.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId.get(id))
      .filter((n): n is CareerNode => !!n && n.kind !== 'entrance-exam');
    const preferred = TRENDING_FALLBACK_IDS.map((id) => byId.get(id)).filter((n): n is CareerNode => !!n);
    const merged: CareerNode[] = [];
    const seen = new Set<string>();
    for (const node of [...preferred, ...popular]) {
      if (seen.has(node.id)) {
        continue;
      }
      seen.add(node.id);
      merged.push(node);
      if (merged.length >= 10) {
        break;
      }
    }
    return merged;
  }

  reload(): Observable<CatalogResponse> {
    this.loadError.set('');
    return this.http.get<CatalogResponse>(`${this.base}/catalog`).pipe(
      tap((cat) => {
        this.nodes.set(cat.nodes ?? []);
        this.edges.set(cat.edges ?? []);
        this.ready.set(true);
        this.refreshTrending();
      }),
      catchError((err) => {
        this.ready.set(false);
        this.loadError.set('Could not reach the AgamiPatha API. Start the Web API on port 43212.');
        return throwError(() => err);
      }),
    );
  }

  private readonly nodeById = computed(() => {
    const map = new Map<string, CareerNode>();
    for (const node of this.nodes()) {
      map.set(node.id, node);
    }
    for (const node of PRE_METRIC_NODES) {
      if (!map.has(node.id)) {
        map.set(node.id, node);
      }
    }
    return map;
  });

  getNode(id: string): CareerNode | undefined {
    if (!id) {
      return undefined;
    }
    return this.nodeById().get(id) ?? preMetricNode(id);
  }

  graphFromId(fromId: string): string {
    if (!fromId) {
      return fromId;
    }
    if (pathFromId(fromId) !== fromId) {
      return pathFromId(fromId);
    }
    const node = this.getNode(fromId);
    return node && isBelowMetric(node) ? METRIC_ID : fromId;
  }

  belowMetricNote(fromId: string, voice = ''): string {
    const node = this.getNode(fromId);
    return isBelowMetric(node) ? metricStartNote(node, voice) : '';
  }

  edgeBetween(fromId: string, toId: string): CareerEdge | undefined {
    if (!fromId || !toId) {
      return undefined;
    }
    const from = this.graphFromId(fromId);
    return this.edges().find((e) => e.from === from && e.to === toId);
  }

  private readonly outgoingIndex = computed(() => {
    const byId = new Map(this.nodes().map((node) => [node.id, node]));
    const map = new Map<string, { node: CareerNode; edge: CareerEdge }[]>();
    for (const edge of this.edges()) {
      const node = byId.get(edge.to);
      if (!node) {
        continue;
      }
      const list = map.get(edge.from) ?? [];
      list.push({ node, edge });
      map.set(edge.from, list);
    }
    return map;
  });

  outgoingFrom(nodeId: string): { node: CareerNode; edge: CareerEdge }[] {
    if (!nodeId) {
      return [];
    }
    return this.outgoingIndex().get(this.graphFromId(nodeId)) ?? [];
  }

  nextHops(nodeId: string, limit = 5): { node: CareerNode; edge: CareerEdge }[] {
    const rank = (kind: string): number => {
      if (kind === 'profession') {
        return 0;
      }
      if (kind === 'postgraduate') {
        return 1;
      }
      if (kind === 'professional') {
        return 2;
      }
      if (kind === 'undergraduate') {
        return 3;
      }
      if (kind === 'entrance-exam') {
        return 9;
      }
      return 5;
    };
    return this.outgoingFrom(nodeId)
      .sort(
        (a, b) =>
          rank(a.node.kind) - rank(b.node.kind) || a.node.title.localeCompare(b.node.title),
      )
      .slice(0, limit);
  }

  relatedInField(node: CareerNode, limit = 3): CareerNode[] {
    const matches: CareerNode[] = [];
    for (const n of this.nodes()) {
      if (n.id === node.id || n.field !== node.field || n.kind === 'entrance-exam') {
        continue;
      }
      if (
        n.kind !== 'profession' &&
        n.kind !== node.kind &&
        n.kind !== 'undergraduate' &&
        n.kind !== 'postgraduate'
      ) {
        continue;
      }
      matches.push(n);
    }
    matches.sort((a, b) => {
      const kind = Number(a.kind !== 'profession') - Number(b.kind !== 'profession');
      return kind || a.title.localeCompare(b.title);
    });
    return matches.slice(0, limit);
  }

  firstHopToward(
    fromId: string,
    toId: string,
    maxVisit = 200,
  ): { edge: CareerEdge; viaNodes: CareerNode[] } | null {
    const start = this.graphFromId(fromId);
    if (!start || !toId || start === toId) {
      return null;
    }
    const parent = new Map<string, { from: string; edge: CareerEdge }>();
    const seen = new Set<string>([start]);
    const queue = [start];
    let head = 0;
    while (head < queue.length && seen.size <= maxVisit) {
      const current = queue[head++]!;
      if (current === toId) {
        break;
      }
      for (const hop of this.outgoingFrom(current)) {
        if (!seen.add(hop.node.id)) {
          continue;
        }
        parent.set(hop.node.id, { from: current, edge: hop.edge });
        queue.push(hop.node.id);
      }
    }
    if (!parent.has(toId)) {
      return null;
    }
    const chain: { from: string; edge: CareerEdge }[] = [];
    let cursor = toId;
    while (cursor !== start) {
      const step = parent.get(cursor);
      if (!step) {
        break;
      }
      chain.push(step);
      cursor = step.from;
    }
    chain.reverse();
    const first = chain[0];
    if (!first) {
      return null;
    }
    const viaNodes = chain
      .slice(1)
      .map((step) => this.getNode(step.edge.to))
      .filter((n): n is CareerNode => !!n);
    return { edge: first.edge, viaNodes };
  }

  certificationsFor(node: CareerNode): string[] {
    if (node.certifications?.length) {
      return node.certifications;
    }
    if (node.kind !== 'profession') {
      return [];
    }
    const byId = certPack.byId as Record<string, string[]>;
    const byField = certPack.byField as Record<string, string[]>;
    return byId[node.id] ?? byField[node.field] ?? [];
  }

  linkedInstitutes(node: CareerNode): LinkedRef[] {
    // Own institutes only — never scan sibling catalogue peers (that froze the popup).
    return linkedInstitutes(node, []);
  }

  linkedEmployers(node: CareerNode): LinkedRef[] {
    return linkedEmployers(node);
  }

  linkedCertifications(node: CareerNode): LinkedCert[] {
    return linkedCertifications(node, this.certificationsFor(node));
  }

  loadPath(from: string, to: string): Observable<PathSet | null> {
    const start = this.graphFromId(from);
    return this.http.get<PathSet>(`${this.base}/paths`, { params: { from: start, to } }).pipe(
      timeout(20000),
      catchError(() => of(null)),
    );
  }

  loadOptions(from: string): Observable<OptionsResponse | null> {
    const start = this.graphFromId(from);
    return this.http.get<OptionsResponse>(`${this.base}/options`, { params: { from: start } }).pipe(
      catchError(() => of(null)),
    );
  }

  /** Every mapped descendant from this start. */
  reachableFrom(fromId: string): CareerNode[] {
    const start = this.graphFromId(fromId);
    if (!start) {
      return [];
    }
    const seen = new Set<string>([start]);
    const found: CareerNode[] = [];
    const queue = [start];
    while (queue.length) {
      const current = queue.shift()!;
      for (const hop of this.outgoingFrom(current)) {
        if (!seen.add(hop.node.id)) {
          continue;
        }
        found.push(hop.node);
        queue.push(hop.node.id);
      }
    }
    return found;
  }

  /** Mapped descendants plus later-stage catalogue goals from this standing. */
  allGoalsFrom(fromId: string): CareerNode[] {
    const seen = new Set<string>(fromId ? [this.graphFromId(fromId)] : []);
    const out: CareerNode[] = [];
    const add = (node: CareerNode): void => {
      if (!node.id || seen.has(node.id)) {
        return;
      }
      seen.add(node.id);
      out.push(node);
    };
    for (const node of this.reachableFrom(fromId)) {
      add(node);
    }
    for (const node of this.goalsAfter(fromId)) {
      add(node);
    }
    return out;
  }

  /** Qualifications and professions at or above the start stage — nothing earlier in the school–college ladder. */
  goalsAfter(fromId: string): CareerNode[] {
    const from = this.getNode(this.graphFromId(fromId));
    if (!from) {
      return this.nodes();
    }
    const fromRank = this.stageRank(from.kind);
    return this.nodes().filter((node) => {
      if (node.id === from.id) {
        return false;
      }
      if (node.kind === 'entrance-exam') {
        return from.kind !== 'profession';
      }
      return this.stageRank(node.kind) > fromRank;
    });
  }

  kindLabel(kind: string): string {
    switch (kind) {
      case 'school':
        return 'School';
      case 'higher-secondary':
        return 'Higher secondary';
      case 'vocational':
        return 'Vocational';
      case 'undergraduate':
        return 'Undergraduate';
      case 'postgraduate':
        return 'Postgraduate';
      case 'professional':
        return 'Professional course';
      case 'profession':
        return 'Profession';
      case 'entrance-exam':
        return 'Entrance exam';
      default:
        return kind;
    }
  }

  private compareNodes = (a: CareerNode, b: CareerNode) => {
    const ki = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (ki !== 0) {
      return ki;
    }
    if (a.kind === 'school' || b.kind === 'school') {
      const ladder = schoolLadderRank(a.id) - schoolLadderRank(b.id);
      if (ladder !== 0) {
        return ladder;
      }
    }
    return a.title.localeCompare(b.title);
  };

  private stageRank(kind: string): number {
    const index = KIND_ORDER.indexOf(kind as NodeKind);
    return index >= 0 ? index : 0;
  }
}
