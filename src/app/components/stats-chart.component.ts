import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, input, signal } from '@angular/core';
import { StatSeries, StatSeriesPoint } from '../stats.service';

type ChartKind = 'line' | 'bar';

interface ChartTip {
  date: string;
  value: number;
  x: number;
  y: number;
  unit: string;
}

interface MonthOption {
  key: string;
  label: string;
}

interface PlotPoint {
  date: string;
  plot: number;
  x: number;
  y: number;
}

@Component({
  selector: 'app-stats-chart',
  imports: [DecimalPipe],
  template: `
    @if (series(); as pack) {
      <div class="controls">
        <div class="chart-toolbar" role="group" aria-label="Chart type">
          <button
            type="button"
            [class.on]="kind() === 'bar'"
            (click)="setKind('bar')"
            [attr.aria-pressed]="kind() === 'bar'"
          >
            Bar
          </button>
          <button
            type="button"
            [class.on]="kind() === 'line'"
            (click)="setKind('line')"
            [attr.aria-pressed]="kind() === 'line'"
          >
            Line
          </button>
        </div>
        @if (kind() === 'bar' && months().length) {
          <label class="month-pick">
            <span>Month</span>
            <select [value]="monthKey()" (change)="setMonth(($any($event.target)).value)">
              @for (month of months(); track month.key) {
                <option [value]="month.key">{{ month.label }}</option>
              }
            </select>
          </label>
        }
      </div>
      <div class="chart-stage" (mouseleave)="clearTip()">
        <svg
          class="chart"
          viewBox="0 0 640 280"
          role="img"
          [attr.aria-label]="chartAria()"
        >
          <rect class="plot" x="56" y="16" width="560" height="200" />
          @for (tick of yTicks(); track tick.label) {
            <line class="grid" [attr.x1]="56" [attr.x2]="616" [attr.y1]="tick.y" [attr.y2]="tick.y" />
            <text class="axis" x="48" [attr.y]="tick.y + 4" text-anchor="end">{{ tick.label }}</text>
          }
          @if (kind() === 'line') {
            <path class="area" [attr.d]="area()" />
            <path class="line" [attr.d]="line()" />
            @for (dot of dots(); track dot.date) {
              <circle
                class="dot"
                [class.solo]="dots().length === 1"
                [class.hot]="tip()?.date === dot.date"
                [attr.cx]="dot.x"
                [attr.cy]="dot.y"
                [attr.r]="dots().length === 1 || tip()?.date === dot.date ? 4.5 : 3"
              />
            }
          } @else {
            @for (bar of bars(); track bar.date) {
              <rect
                class="bar"
                [class.hot]="tip()?.date === bar.date"
                [attr.x]="bar.x"
                [attr.y]="bar.y"
                [attr.width]="bar.width"
                [attr.height]="bar.height"
                rx="2"
              />
            }
          }
          @for (hit of hits(); track hit.date) {
            <rect
              class="hit"
              [attr.x]="hit.x"
              [attr.y]="hit.y"
              [attr.width]="hit.width"
              [attr.height]="hit.height"
              (mouseenter)="showTip(hit.tip)"
              (focus)="showTip(hit.tip)"
              tabindex="0"
            />
          }
          @for (label of xLabels(); track label.text + label.x) {
            <text class="axis x" [attr.x]="label.x" y="236" text-anchor="middle">{{ label.text }}</text>
          }
        </svg>
        @if (tip(); as active) {
          <div
            class="tip"
            [style.left.%]="(active.x / 640) * 100"
            [style.top.%]="(active.y / 280) * 100"
          >
            <strong>{{ active.value | number }}</strong>
            <span>{{ active.unit }} · {{ formatTipDay(active.date) }}</span>
          </div>
        }
      </div>
      <p class="caption">
        @if (kind() === 'bar') {
          Daily counts for {{ monthLabel() }}:
          <strong>{{ monthTotal() | number }}</strong>
        } @else {
          {{ pack.label }} till date: <strong>{{ pack.total | number }}</strong>
        }
      </p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.55rem;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 0.65rem;
    }
    .chart-toolbar {
      display: inline-flex;
      gap: 0.15rem;
      padding: 0.2rem;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--teal) 16%, var(--line));
      background: color-mix(in srgb, white 74%, var(--paper));
    }
    .chart-toolbar button {
      min-width: 4.2rem;
      padding: 0.35rem 0.75rem;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
    }
    .chart-toolbar button.on {
      color: var(--on-dark);
      background: #111;
    }
    .month-pick {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--muted);
    }
    .month-pick select {
      padding: 0.35rem 0.55rem;
      border-radius: 0.55rem;
      border: 1px solid color-mix(in srgb, var(--teal) 18%, var(--line-strong));
      background: color-mix(in srgb, white 86%, var(--paper));
      font: inherit;
      font-size: 0.8rem;
      font-weight: 650;
      color: var(--ink);
    }
    .chart-stage {
      position: relative;
    }
    .chart {
      width: 100%;
      height: auto;
      display: block;
    }
    .plot {
      fill: color-mix(in srgb, white 70%, var(--paper));
    }
    .grid {
      stroke: var(--line);
      stroke-width: 1;
    }
    .axis {
      fill: var(--muted);
      font-size: 11px;
    }
    .line {
      fill: none;
      stroke: #111;
      stroke-width: 2.4;
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: none;
    }
    .area {
      fill: color-mix(in srgb, #111 10%, transparent);
      pointer-events: none;
    }
    .dot {
      fill: #111;
      opacity: 0;
      pointer-events: none;
    }
    .dot.solo,
    .dot.hot {
      opacity: 1;
    }
    .bar {
      fill: #111;
      pointer-events: none;
    }
    .bar.hot {
      fill: #333;
    }
    .hit {
      fill: transparent;
      cursor: crosshair;
    }
    .tip {
      position: absolute;
      z-index: 2;
      transform: translate(-50%, calc(-100% - 0.55rem));
      min-width: 4.5rem;
      padding: 0.35rem 0.55rem;
      border-radius: 0.55rem;
      border: 1px solid color-mix(in srgb, var(--teal) 18%, var(--line));
      background: color-mix(in srgb, white 94%, var(--paper));
      box-shadow: 0 10px 24px rgb(0 0 0 / 12%);
      pointer-events: none;
      display: grid;
      gap: 0.1rem;
      text-align: center;
    }
    .tip strong {
      color: var(--ink);
      font-size: 0.9rem;
      font-weight: 750;
    }
    .tip span {
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 600;
    }
    .caption {
      margin: 0;
      color: var(--muted);
      font-size: 0.86rem;
      text-align: center;
    }
  `,
})
export class StatsChartComponent {
  readonly series = input.required<StatSeries>();
  readonly kind = signal<ChartKind>('line');
  readonly tip = signal<ChartTip | null>(null);
  readonly monthKey = signal('');

  readonly months = computed<MonthOption[]>(() => {
    const keys = new Set<string>();
    for (const point of this.series().points ?? []) {
      const key = monthKeyOf(point.date);
      if (key) {
        keys.add(key);
      }
    }
    return [...keys]
      .sort()
      .map((key) => ({ key, label: formatMonth(key) }));
  });

  readonly activeMonth = computed(() => {
    const months = this.months();
    const selected = this.monthKey();
    if (selected && months.some((m) => m.key === selected)) {
      return selected;
    }
    return months.length ? months[months.length - 1].key : '';
  });

  readonly monthLabel = computed(() => formatMonth(this.activeMonth()) || 'this month');

  readonly monthTotal = computed(() =>
    this.sourcePoints().reduce((sum, point) => sum + Number(point.daily || 0), 0),
  );

  readonly chartAria = computed(() => {
    const pack = this.series();
    return this.kind() === 'bar'
      ? `${pack.label} daily counts for ${this.monthLabel()}`
      : `${pack.label} till date`;
  });

  private readonly sourcePoints = computed<StatSeriesPoint[]>(() => {
    const points = this.series().points ?? [];
    if (this.kind() !== 'bar') {
      return points;
    }
    const month = this.activeMonth();
    return month ? points.filter((p) => monthKeyOf(p.date) === month) : points;
  });

  private readonly layout = computed(() => {
    const points = this.sourcePoints();
    const left = 56;
    const top = 16;
    const width = 560;
    const height = 200;
    const dailyMode = this.kind() === 'bar';
    const values = points.map((p) => (dailyMode ? Number(p.daily || 0) : Number(p.value || 0)));
    const max = Math.max(1, ...values);
    const slot = points.length ? width / points.length : width;
    const mapped: PlotPoint[] = points.map((point, index) => {
      const plot = dailyMode ? Number(point.daily || 0) : Number(point.value || 0);
      const x = points.length === 1 ? left + width / 2 : left + slot * (index + 0.5);
      const y = top + height - (plot / max) * height;
      return { date: point.date, plot, x, y };
    });
    return { mapped, max, left, top, width, height, slot, unit: dailyMode ? 'that day' : 'till date' };
  });

  readonly line = computed(() => {
    const pts = this.layout().mapped;
    if (!pts.length) {
      return '';
    }
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  });

  readonly area = computed(() => {
    const { mapped, top, height } = this.layout();
    if (!mapped.length) {
      return '';
    }
    const base = top + height;
    const start = `M${mapped[0].x.toFixed(1)},${base}`;
    const ridge = mapped.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const end = `L${mapped[mapped.length - 1].x.toFixed(1)},${base} Z`;
    return `${start} ${ridge} ${end}`;
  });

  readonly bars = computed(() => {
    const { mapped, top, height, slot } = this.layout();
    if (!mapped.length) {
      return [];
    }
    const barWidth = Math.max(2, Math.min(28, slot * 0.62));
    const base = top + height;
    return mapped.map((point) => {
      const h = Math.max(0, base - point.y);
      return {
        date: point.date,
        value: point.plot,
        x: point.x - barWidth / 2,
        y: point.y,
        width: barWidth,
        height: h || 1,
      };
    });
  });

  readonly hits = computed(() => {
    const { mapped, left, top, width, height, slot, unit } = this.layout();
    const base = top + height;
    return mapped.map((point) => {
      const hitWidth = Math.max(10, slot);
      const x = Math.min(left + width - hitWidth, Math.max(left, point.x - hitWidth / 2));
      return {
        date: point.date,
        x,
        y: top,
        width: hitWidth,
        height,
        tip: {
          date: point.date,
          value: point.plot,
          x: point.x,
          y: Math.min(point.y, base - 8),
          unit,
        } satisfies ChartTip,
      };
    });
  });

  readonly dots = computed(() => this.layout().mapped);

  readonly yTicks = computed(() => {
    const { max, top, height } = this.layout();
    return [0, 0.5, 1].map((part) => {
      const value = Math.round(max * part);
      return { label: String(value), y: top + height - part * height };
    });
  });

  readonly xLabels = computed(() => {
    const pts = this.layout().mapped;
    if (!pts.length) {
      return [];
    }
    if (this.kind() === 'bar' && pts.length > 8) {
      const picks = [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]];
      return picks.map((p) => ({ x: p.x, text: dayOnly(p.date) }));
    }
    const picks = pts.length < 3 ? pts : [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]];
    return picks.map((p) => ({ x: p.x, text: this.kind() === 'bar' ? dayOnly(p.date) : formatDay(p.date) }));
  });

  constructor() {
    effect(() => {
      const months = this.months();
      if (!months.length) {
        return;
      }
      const selected = this.monthKey();
      if (!selected || !months.some((m) => m.key === selected)) {
        this.monthKey.set(months[months.length - 1].key);
      }
    });
  }

  showTip(tip: ChartTip): void {
    this.tip.set(tip);
  }

  clearTip(): void {
    this.tip.set(null);
  }

  setKind(next: ChartKind): void {
    this.kind.set(next);
    this.clearTip();
  }

  setMonth(key: string): void {
    this.monthKey.set(key);
    this.clearTip();
  }

  formatTipDay(iso: string): string {
    return formatDay(iso);
  }
}

function monthKeyOf(iso: string): string {
  return iso.length >= 7 ? iso.slice(0, 7) : '';
}

function formatMonth(key: string): string {
  const [year, month] = key.split('-');
  if (!year || !month) {
    return key;
  }
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return date.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function dayOnly(iso: string): string {
  const day = iso.split('-')[2];
  return day || iso;
}

function formatDay(iso: string): string {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) {
    return iso;
  }
  return `${day}/${month}/${year.slice(2)}`;
}
