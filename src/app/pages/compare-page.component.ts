import { Component, DestroyRef, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, concat, forkJoin, map, of, switchMap } from 'rxjs';
import { CareerService } from '../career.service';
import { NodeIconComponent } from '../components/node-icon.component';
import { CareerNode, CareerPathResult, PathSet } from '../models/career.model';
import {
  SearchGroup,
  SearchSelectComponent,
  toSearchGroups,
  toSearchOptions,
} from '../components/search-select.component';

interface CompareSide {
  node: CareerNode;
  path: CareerPathResult | null;
  years: string;
  age: string;
  costGovt: string;
  costPvt: string;
  salary: string;
  exams: string[];
  opens: string[];
  closes: string[];
  spine: string;
  mapped: boolean;
}

interface ComparePacks {
  left: PathSet | null;
  right: PathSet | null;
  loaded: boolean;
}

interface CompareExample {
  from: string;
  a: string;
  b: string;
  label: string;
}

@Component({
  selector: 'app-compare-page',
  imports: [RouterLink, SearchSelectComponent, NodeIconComponent],
  templateUrl: './compare-page.component.html',
  styleUrl: './compare-page.component.scss',
})
export class ComparePageComponent implements OnDestroy {
  private readonly career = inject(CareerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly defaultTitle = document.title;

  private readonly params = toSignal(
    this.route.queryParamMap.pipe(
      switchMap((q) =>
        of({
          from: q.get('from') ?? '',
          a: q.get('a') ?? '',
          b: q.get('b') ?? '',
        }),
      ),
    ),
    { initialValue: { from: '', a: '', b: '' } },
  );

  readonly packs = signal<ComparePacks>({ left: null, right: null, loaded: false });

  readonly fromId = computed(() => this.params().from);
  readonly aId = computed(() => this.params().a);
  readonly bId = computed(() => this.params().b);
  readonly fromNode = computed(() => this.career.getNode(this.fromId()));
  readonly startNote = computed(() => this.career.belowMetricNote(this.fromId()));
  readonly startOptions = computed(() => toSearchOptions(this.career.qualifications()));
  readonly goalGroups = computed<SearchGroup[]>(() => toSearchGroups(this.career.goalsAfter(this.fromId())));
  readonly sameGoal = computed(() => !!(this.aId() && this.bId() && this.aId() === this.bId()));
  readonly loading = computed(() => {
    const { from, a, b } = this.params();
    return !!(from && a && b && a !== b && !this.packs().loaded);
  });
  readonly left = computed(() => {
    this.career.nodes();
    return this.side(this.aId(), this.packs().left, this.bId(), this.packs().right);
  });
  readonly right = computed(() => {
    this.career.nodes();
    return this.side(this.bId(), this.packs().right, this.aId(), this.packs().left);
  });
  readonly ready = computed(() => !!(this.packs().loaded && this.left() && this.right()));
  readonly examples = computed(() => this.buildExamples());

  constructor() {
    toObservable(this.params)
      .pipe(
        switchMap(({ from, a, b }) => {
          if (!from || !a || !b || a === b) {
            return of<ComparePacks>({ left: null, right: null, loaded: false });
          }
          return concat(
            of<ComparePacks>({ left: null, right: null, loaded: false }),
            forkJoin({
              left: this.career.loadPath(from, a),
              right: this.career.loadPath(from, b),
            }).pipe(
              map((pack) => ({ ...pack, loaded: true })),
              catchError(() => of<ComparePacks>({ left: null, right: null, loaded: true })),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((pack) => this.packs.set(pack));

    effect(() => {
      const left = this.left();
      const right = this.right();
      document.title =
        left && right
          ? `${left.node.shortTitle || left.node.title} vs ${right.node.shortTitle || right.node.title} · AgamiPatha`
          : `Compare two paths · AgamiPatha`;
    });
  }

  ngOnDestroy(): void {
    document.title = this.defaultTitle;
  }

  setFrom(id: string): void {
    const allowed = new Set(this.career.goalsAfter(id).map((node) => node.id));
    this.write({
      from: id,
      a: allowed.has(this.aId()) ? this.aId() : '',
      b: allowed.has(this.bId()) ? this.bId() : '',
    });
  }

  setSide(which: 'a' | 'b', id: string): void {
    this.write({ [which]: id });
  }

  swap(): void {
    this.write({ a: this.bId(), b: this.aId() });
  }

  loadExample(example: CompareExample): void {
    this.write({ from: example.from, a: example.a, b: example.b });
  }

  private write(patch: Record<string, string>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: patch,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private buildExamples(): CompareExample[] {
    this.career.nodes();
    const jee =
      this.career
        .nodes()
        .find((node) => node.kind === 'entrance-exam' && /jee main/i.test(node.title)) ||
      this.career.nodes().find((node) => node.kind === 'entrance-exam' && /\bjee\b/i.test(node.title));
    return [
      { from: 'hs-pcb', a: 'bsc-nursing', b: 'bpt', label: 'B.Sc Nursing vs BPT' },
      {
        from: 'hs-pcm',
        a: jee?.id || 'btech-cse',
        b: 'nda',
        label: jee ? 'PCM → JEE vs PCM → NDA' : 'PCM → B.Tech CSE vs PCM → NDA',
      },
    ].filter((example) =>
      !!(this.career.getNode(example.from) && this.career.getNode(example.a) && this.career.getNode(example.b)),
    );
  }

  private side(
    id: string,
    set: PathSet | null,
    otherId: string,
    otherSet: PathSet | null,
  ): CompareSide | null {
    const node = this.career.getNode(id);
    if (!node) {
      return null;
    }
    const path = preferredRoute(set);
    const other = this.career.getNode(otherId);
    const otherPath = preferredRoute(otherSet);
    const exams = unique([
      ...(path?.steps.flatMap((step) => step.node.exams ?? []) ?? []),
      ...(node.exams ?? []),
    ]).slice(0, 6);
    return {
      node,
      path,
      years: yearsLabel(node, path),
      age: node.typicalAge || '—',
      costGovt: costLabel(node, path, 'costGovt'),
      costPvt: costLabel(node, path, 'costPvt'),
      salary: node.salaryHint || '—',
      exams,
      opens: opensFor(node, path, exams),
      closes: closesFor(node, path, other, otherPath),
      spine: path?.spine || node.shortTitle || node.title,
      mapped: !!path,
    };
  }
}

function preferredRoute(set: PathSet | null): CareerPathResult | null {
  if (!set?.routes.length) {
    return null;
  }
  const i = Math.min(set.recommendedIndex ?? 0, set.routes.length - 1);
  return set.routes[i] ?? set.routes[0];
}

function yearsLabel(node: CareerNode, path: CareerPathResult | null): string {
  const duration =
    node.duration ||
    unique(
      (path?.steps ?? [])
        .slice(1)
        .map((step) => step.node.duration)
        .filter(Boolean),
    )[0];
  const hops = path?.totalLabel;
  if (duration && hops && hops !== 'Current stage') {
    return `${duration} · ${hops}`;
  }
  return duration || hops || '—';
}

function costLabel(node: CareerNode, path: CareerPathResult | null, key: 'costGovt' | 'costPvt'): string {
  if (node[key]) {
    return node[key]!;
  }
  const hit = (path?.steps ?? []).map((step) => step.node[key]).find((value) => !!value);
  return hit || '—';
}

function opensFor(node: CareerNode, path: CareerPathResult | null, exams: string[]): string[] {
  const out = [`${kindPhrase(node.kind)} in ${node.field || 'this field'}`];
  if (exams[0]) {
    out.push(`Sits ${exams.slice(0, 2).join(', ')}`);
  }
  if (path?.title) {
    out.push(path.title);
  }
  return unique(out).slice(0, 4);
}

function closesFor(
  node: CareerNode,
  path: CareerPathResult | null,
  other: CareerNode | undefined,
  otherPath: CareerPathResult | null,
): string[] {
  const out: string[] = [];
  if (other && other.id !== node.id) {
    out.push(`Does not target ${other.shortTitle || other.title} on this spine.`);
    const mine = new Set(
      unique([
        ...(path?.steps.flatMap((step) => step.node.exams ?? []) ?? []),
        ...(node.exams ?? []),
      ]).map((item) => item.toLowerCase()),
    );
    const theirs = unique([
      ...(otherPath?.steps.flatMap((step) => step.node.exams ?? []) ?? []),
      ...(other.exams ?? []),
    ]).filter((exam) => !mine.has(exam.toLowerCase()));
    if (theirs[0]) {
      out.push(`Puts aside ${theirs[0]} unless you sit it anyway.`);
    }
    if (node.field && other.field && node.field !== other.field) {
      out.push(`${other.field} becomes a later switch, not this route.`);
    }
  }
  if (node.kind === 'profession') {
    out.push('Names a job. Other undergraduate doors stay closed unless you re-enter later.');
  } else if (node.kind === 'entrance-exam') {
    out.push('This year is the paper. A parallel course without that exam is not this plan.');
  } else if (node.kind === 'undergraduate') {
    out.push("Locks a bachelor's direction. A different UG later is a transfer or a second degree.");
  } else if (node.kind === 'postgraduate' || node.kind === 'professional') {
    out.push("Assumes the prior qualification. Starting a different bachelor's from here is a detour.");
  }
  return unique(out).slice(0, 4);
}

function kindPhrase(kind: string): string {
  switch (kind) {
    case 'profession':
      return 'A profession';
    case 'entrance-exam':
      return 'An entrance exam';
    case 'undergraduate':
      return 'An undergraduate course';
    case 'postgraduate':
      return 'A postgraduate course';
    case 'professional':
      return 'A professional course';
    case 'higher-secondary':
      return 'A Class 11–12 stream';
    default:
      return 'A qualification';
  }
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const item = value.trim();
    if (!item || seen.has(item.toLowerCase())) {
      continue;
    }
    seen.add(item.toLowerCase());
    next.push(item);
  }
  return next;
}
