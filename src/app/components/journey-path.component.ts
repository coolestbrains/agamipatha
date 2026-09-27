import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CareerNode, PathStep } from '../models/career.model';

interface Pt {
  x: number;
  y: number;
}

@Component({
  selector: 'app-journey-path',
  templateUrl: './journey-path.component.html',
  styleUrl: './journey-path.component.scss',
})
export class JourneyPathComponent {
  private playTimer: number | null = null;
  private moveFrame = 0;

  readonly steps = input.required<PathStep[]>();
  readonly kindLabel = input<(node: CareerNode) => string>((n) => n.kind);
  readonly calm = input(false);
  readonly recommended = input(false);
  readonly whyLines = input<string[]>([]);
  readonly highlightIds = input<string[]>([]);
  readonly hasCalendar = input(false);
  readonly hasCost = input(false);
  readonly makingPdf = input(false);
  readonly indexChange = output<number>();
  readonly openDetail = output<CareerNode>();
  readonly openCalendar = output<void>();
  readonly openCost = output<void>();
  readonly openPreview = output<void>();
  readonly downloadPdf = output<void>();
  readonly printGuide = output<void>();

  readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');
  readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');

  readonly index = signal(0);
  readonly traveler = signal<Pt>({ x: 80, y: 150 });
  readonly sparks = signal<Pt[]>([]);
  readonly drawing = signal(true);
  readonly playing = signal(false);
  readonly nodePts = computed(() => this.positions(this.steps().length));

  readonly pathD = computed(() => this.buildPath(this.steps().length));
  readonly viewW = computed(() => Math.max(920, this.steps().length * 200 + 80));
  readonly viewH = 360;
  readonly current = computed(() => this.steps()[this.index()] ?? null);
  readonly incoming = computed(() => this.current()?.incoming);
  readonly canPrev = computed(() => this.index() > 0);
  readonly canNext = computed(() => this.index() < this.steps().length - 1);
  readonly prevTitle = computed(() => this.steps()[this.index() - 1]?.node.shortTitle ?? '');
  readonly nextTitle = computed(() => this.steps()[this.index() + 1]?.node.shortTitle ?? '');
  readonly progressLabel = computed(() => {
    const n = this.steps().length;
    if (!n) {
      return '';
    }
    return `Step ${this.index() + 1} of ${n}`;
  });
  readonly timelineSummary = computed(() => {
    const steps = this.steps();
    if (!steps.length) {
      return '';
    }
    const start = this.ageShort(steps[0].node.typicalAge);
    const end = this.ageShort(steps[steps.length - 1].node.typicalAge);
    const years = this.spanYears(steps);
    const ageBit = start && end && start !== end ? `Typical age ${start} → ${end}` : start ? `Typical age ${start}` : '';
    const yearBit = years ? `about ${years} year${years === 1 ? '' : 's'} on the mapped hops` : '';
    return [ageBit, yearBit].filter(Boolean).join(' · ');
  });
  readonly hops = computed(() => {
    const pts = this.nodePts();
    const steps = this.steps();
    const out: { x: number; y: number; label: string; w: number }[] = [];
    for (let i = 0; i < steps.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const label = this.hopDuration(steps[i + 1].node.duration);
      if (!a || !b || !label) {
        continue;
      }
      out.push({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2 - 18,
        label,
        w: Math.max(42, label.length * 6.4 + 16),
      });
    }
    return out;
  });
  readonly yearMarks = computed(() => {
    const pts = this.nodePts();
    return this.steps()
      .map((step, i) => {
        const pt = pts[i];
        const label = this.ageShort(step.node.typicalAge);
        if (!pt || !label) {
          return null;
        }
        return { i, x: pt.x, label, active: i === this.index(), done: i < this.index() };
      })
      .filter((m): m is { i: number; x: number; label: string; active: boolean; done: boolean } => !!m);
  });
  readonly yearRail = computed(() => {
    const marks = this.yearMarks();
    if (marks.length < 2) {
      return null;
    }
    return { x1: marks[0].x, x2: marks[marks.length - 1].x };
  });

  constructor() {
    effect(() => {
      const pts = this.nodePts();
      untracked(() => {
        this.stopPlay();
        this.index.set(0);
        this.traveler.set(pts[0] ?? { x: 80, y: 150 });
        this.sparks.set([]);
        if (this.moveFrame) {
          cancelAnimationFrame(this.moveFrame);
          this.moveFrame = 0;
        }
      });
    });
    effect(() => {
      if (this.calm()) {
        untracked(() => this.stopPlay());
      }
    });
  }

  go(delta: number, fromPlay = false): void {
    const next = Math.min(this.steps().length - 1, Math.max(0, this.index() + delta));
    this.goTo(next, fromPlay);
  }

  goTo(i: number, fromPlay = false): void {
    if (i === this.index() || i < 0 || i >= this.steps().length) {
      return;
    }
    if (!fromPlay) {
      this.stopPlay();
    }
    const from = this.index();
    this.index.set(i);
    this.indexChange.emit(i);
    this.animateTraveler(from, i);
  }

  togglePlay(): void {
    if (this.playing()) {
      this.stopPlay();
      return;
    }
    this.playing.set(true);
    if (this.index() >= this.steps().length - 1) {
      this.goTo(0, true);
    }
    const run = () => {
      if (!this.playing()) {
        return;
      }
      if (this.index() >= this.steps().length - 1) {
        this.playing.set(false);
        return;
      }
      this.go(1, true);
      this.playTimer = window.setTimeout(run, 1100);
    };
    this.playTimer = window.setTimeout(run, 500);
  }

  onNodeKey(ev: KeyboardEvent, i: number): void {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this.openNode(i);
    }
  }

  onNodeClick(i: number): void {
    this.goTo(i);
  }

  onNodeDblClick(i: number): void {
    this.openNode(i);
  }

  details(): void {
    this.emitDetail(this.index());
  }

  private openNode(i: number): void {
    this.goTo(i);
    this.emitDetail(i);
  }

  private emitDetail(i: number): void {
    const step = this.steps()[i];
    if (step) {
      this.openDetail.emit(step.node);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeys(ev: KeyboardEvent): void {
    const t = ev.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) {
      return;
    }
    if (ev.key === 'ArrowRight') {
      this.go(1);
    } else if (ev.key === 'ArrowLeft') {
      this.go(-1);
    } else if (ev.key === ' ') {
      const tag = t?.tagName;
      if (tag === 'BUTTON' || tag === 'A') {
        return;
      }
      ev.preventDefault();
      this.togglePlay();
    }
  }

  private stopPlay(): void {
    this.playing.set(false);
    if (this.playTimer != null) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
  }

  private buildPath(count: number): string {
    const n = Math.max(2, count);
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      pts.push({
        x: 70 + i * 200,
        y: 150 + (i % 2 === 0 ? -62 : 62),
      });
    }
    if (pts.length === 1) {
      return `M 40 150 L 200 150`;
    }
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const cx = (a.x + b.x) / 2;
      d += ` C ${cx} ${a.y}, ${cx} ${b.y}, ${b.x} ${b.y}`;
    }
    return d;
  }

  private positions(count: number): Pt[] {
    const n = Math.max(count, 1);
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      pts.push({
        x: 70 + i * 200,
        y: 150 + (i % 2 === 0 ? -62 : 62),
      });
    }
    return pts;
  }

  private animateTraveler(fromIdx: number, toIdx: number): void {
    const pts = this.nodePts();
    const from = pts[fromIdx];
    const to = pts[toIdx];
    if (!from || !to) {
      return;
    }
    if (this.moveFrame) {
      cancelAnimationFrame(this.moveFrame);
      this.moveFrame = 0;
    }
    const started = performance.now();
    const duration = 380;
    const tick = (now: number) => {
      const u = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - u, 3);
      this.traveler.set({
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
      });
      if (u < 1) {
        this.moveFrame = requestAnimationFrame(tick);
        return;
      }
      this.moveFrame = 0;
      this.scrollToTraveler(false);
    };
    this.moveFrame = requestAnimationFrame(tick);
  }

  ageShort(value: string): string {
    const text = (value ?? '').trim();
    if (!text || text === '—' || /^any time/i.test(text)) {
      return '';
    }
    const from = text.match(/from\s*~?\s*(\d{1,2})/i);
    if (from) {
      return `~${from[1]}`;
    }
    const range = text.match(/(\d{1,2})\s*[–-]\s*(\d{1,2})/);
    if (range) {
      return `${range[1]}–${range[2]}`;
    }
    const one = text.match(/(\d{1,2})/);
    return one ? one[1] : '';
  }

  private hopDuration(value: string): string {
    const text = (value ?? '').trim();
    if (!text || text === '—' || /^career$/i.test(text) || /^until /i.test(text)) {
      return '';
    }
    return text;
  }

  private spanYears(steps: PathStep[]): number | null {
    const first = this.firstNumber(steps[0]?.node.typicalAge ?? '');
    const last = this.lastNumber(steps[steps.length - 1]?.node.typicalAge ?? '');
    if (first == null || last == null || last <= first) {
      return null;
    }
    return last - first;
  }

  private firstNumber(value: string): number | null {
    const m = value.match(/(\d{1,2})/);
    return m ? Number(m[1]) : null;
  }

  private lastNumber(value: string): number | null {
    const range = value.match(/(\d{1,2})\s*[–-]\s*(\d{1,2})/);
    if (range) {
      return Number(range[2]);
    }
    return this.firstNumber(value);
  }

  private scrollToTraveler(smooth = true): void {
    const wrap = this.canvas()?.nativeElement;
    const svg = this.svg()?.nativeElement;
    if (!wrap || !svg) {
      return;
    }
    const scale = svg.clientWidth / this.viewW();
    const left = this.traveler().x * scale - wrap.clientWidth / 2;
    wrap.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
  }
}
