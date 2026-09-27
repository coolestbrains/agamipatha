import { Component, ElementRef, HostListener, computed, effect, inject, input, model, signal } from '@angular/core';
import { NodeIconComponent } from './node-icon.component';

export interface SearchOption {
  id: string;
  label: string;
  field?: string;
  kind?: string;
}

export interface SearchGroup {
  label: string;
  options: SearchOption[];
}

export function toSearchOptions(
  nodes: { id: string; title: string; field?: string; kind?: string }[],
): SearchOption[] {
  return nodes.map((n) => ({ id: n.id, label: n.title, field: n.field, kind: n.kind }));
}

export function toSearchGroups(
  nodes: { id: string; title: string; field?: string; kind: string }[],
): SearchGroup[] {
  return [
    { label: 'Qualifications', options: toSearchOptions(nodes.filter((n) => n.kind !== 'profession' && n.kind !== 'entrance-exam')) },
    { label: 'Entrance exams', options: toSearchOptions(nodes.filter((n) => n.kind === 'entrance-exam')) },
    { label: 'Professions', options: toSearchOptions(nodes.filter((n) => n.kind === 'profession')) },
  ].filter((g) => g.options.length);
}

@Component({
  selector: 'app-search-select',
  imports: [NodeIconComponent],
  host: {
    '[class.open]': 'open()',
    '[class.large]': 'size() === "large"',
    '[class.has-hint]': '!!hint()',
  },
  template: `
    <div class="field" [class.has-hint]="!!hint()">
      <div class="box" [class.open]="open()">
        <input
          type="search"
          autocomplete="off"
          role="combobox"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="listId"
          [placeholder]="placeholder()"
          [value]="query()"
          (focus)="onFocus()"
          (input)="onType($event)"
          (keydown)="onKey($event)"
        />
        @if (open()) {
          <ul class="menu" role="listbox" [id]="listId">
            @for (group of visible(); track group.label + $index) {
              @if (group.label) {
                <li class="heading">{{ group.label }}</li>
              }
              @for (opt of group.options; track opt.id) {
                <li
                  role="option"
                  [class.picked]="opt.id === value()"
                  [class.hi]="opt.id === highlight()"
                  (mousedown)="choose(opt.id, $event)"
                >
                  <app-node-icon [node]="opt" size="sm" />
                  <span>{{ opt.label }}</span>
                </li>
              }
            } @empty {
              <li class="empty">No matches</li>
            }
          </ul>
        }
      </div>
      @if (hint(); as note) {
        <span class="hint">
          <button
            type="button"
            class="hint-btn"
            [attr.aria-describedby]="hintId"
            aria-label="Why this path starts at Metric"
            (mousedown)="$event.stopPropagation()"
            (click)="$event.stopPropagation()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 10.6v5.2" />
              <circle cx="12" cy="7.6" r="1.15" />
            </svg>
          </button>
          <span class="hint-tip" role="tooltip" [id]="hintId">{{ note }}</span>
        </span>
      }
    </div>
  `,
  styles: `
    :host { display: block; position: relative; z-index: 1; text-align: left; overflow: visible; }
    :host(.open),
    :host:has(.hint:hover),
    :host:has(.hint:focus-within) { z-index: 2000; }
    .field { display: flex; align-items: center; gap: 0.4rem; min-width: 0; }
    .box { position: relative; flex: 1; min-width: 0; }
    input {
      width: 100%;
      appearance: none;
      background: var(--paper);
      border: 1px solid var(--line-strong);
      border-radius: 0.7rem;
      padding: 0.7rem 2.2rem 0.7rem 0.85rem;
      font: inherit;
      font-size: 1rem;
      color: inherit;
      background-image: linear-gradient(45deg, transparent 50%, var(--ink) 50%),
        linear-gradient(135deg, var(--ink) 50%, transparent 50%);
      background-position: calc(100% - 16px) calc(50% - 3px), calc(100% - 11px) calc(50% - 3px);
      background-size: 5px 5px, 5px 5px;
      background-repeat: no-repeat;
    }
    .box.open input {
      border-color: var(--teal);
      border-bottom-left-radius: 0.35rem;
      border-bottom-right-radius: 0.35rem;
    }
    .menu {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 2000;
      margin: 0;
      padding: 0.35rem 0;
      max-height: var(--search-menu-max, 16rem);
      overflow: auto;
      list-style: none;
      text-align: left;
      background: color-mix(in srgb, white 88%, var(--paper));
      border: 1px solid var(--teal);
      border-top: 0;
      border-radius: 0 0 0.7rem 0.7rem;
      box-shadow: 0 14px 28px rgb(var(--shadow) / 12%);
    }
    .heading {
      padding: 0.45rem 0.85rem 0.2rem;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--teal);
    }
    li[role='option'] {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.85rem;
      cursor: pointer;
    }
    li[role='option'] span {
      min-width: 0;
    }
    li[role='option']:hover,
    li.hi {
      background: color-mix(in srgb, var(--cyan) 16%, white);
    }
    li.picked {
      font-weight: 700;
      color: var(--teal);
    }
    .empty {
      padding: 0.7rem 0.85rem;
      color: var(--muted);
    }
    :host.large input {
      min-height: 3.7rem;
      padding: 1.05rem 2.7rem 1.05rem 1.15rem;
      font-size: clamp(1.15rem, 3.4vw, 1.55rem);
      border-radius: 0.95rem;
      border-width: 1.5px;
    }
    :host.large .box.open input {
      border-bottom-left-radius: 0.4rem;
      border-bottom-right-radius: 0.4rem;
    }
    :host.large .menu {
      max-height: min(22rem, 46vh);
    }
    :host.large li[role='option'] {
      padding: 0.7rem 1.05rem;
      font-size: 1.05rem;
    }
    .hint {
      position: relative;
      flex-shrink: 0;
      z-index: 4;
    }
    .hint-btn {
      display: grid;
      place-items: center;
      width: 1.55rem;
      height: 1.55rem;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 999px;
      background: none;
      color: #e67e22;
      cursor: help;
    }
    .hint-btn svg {
      width: 1.28rem;
      height: 1.28rem;
    }
    .hint-btn circle:first-child {
      fill: currentColor;
    }
    .hint-btn path {
      fill: none;
      stroke: #fff;
      stroke-width: 2.1;
      stroke-linecap: round;
    }
    .hint-btn circle:last-child {
      fill: #fff;
    }
    .hint-tip {
      position: absolute;
      top: calc(100% + 0.45rem);
      right: 0;
      z-index: 30;
      width: min(22rem, 78vw);
      padding: 0.65rem 0.75rem;
      border-radius: 0.75rem;
      border: 1px solid color-mix(in srgb, #e67e22 35%, var(--line-strong));
      background: #fff8f1;
      color: var(--ink);
      font-size: 0.8rem;
      font-weight: 500;
      line-height: 1.4;
      text-align: left;
      box-shadow: 0 12px 24px rgb(0 0 0 / 12%);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: translateY(-4px);
      transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
    }
    .hint-tip::before {
      content: '';
      position: absolute;
      top: -0.5rem;
      right: 0.45rem;
      width: 1.55rem;
      height: 0.5rem;
    }
    .hint:hover .hint-tip,
    .hint:focus-within .hint-tip {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: none;
    }
  `,
})
export class SearchSelectComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly value = model('');
  readonly placeholder = input('Search…');
  readonly size = input<'default' | 'large'>('default');
  readonly openOnType = input(false);
  readonly hint = input('');
  readonly options = input<SearchOption[]>([]);
  readonly groups = input<SearchGroup[]>([]);
  readonly open = signal(false);
  readonly query = signal('');
  readonly highlight = signal('');
  readonly listId = `search-select-${Math.random().toString(36).slice(2, 8)}`;
  readonly hintId = `${this.listId}-hint`;

  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const groups = this.resolvedGroups()
      .map((g) => ({
        ...g,
        options: q ? g.options.filter((o) => o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)) : g.options,
      }))
      .filter((g) => g.options.length);
    return groups;
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.query.set(this.labelFor(this.value()));
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  onFocus(): void {
    if (this.openOnType()) {
      return;
    }
    this.open.set(true);
    this.query.set('');
    const first = this.flat(this.visible())[0];
    this.highlight.set(first?.id ?? this.value());
  }

  onType(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.query.set(next);
    const typed = next.trim().length > 0;
    this.open.set(this.openOnType() ? typed : true);
    const first = this.flat(this.visible())[0];
    this.highlight.set(first?.id ?? '');
  }

  onKey(event: KeyboardEvent): void {
    if (this.openOnType() && !this.open() && event.key !== 'Escape') {
      return;
    }
    const ids = this.flat(this.visible()).map((o) => o.id);
    if (event.key === 'Escape') {
      this.close();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const id = this.highlight() || ids[0];
      if (id) {
        this.choose(id);
      }
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    event.preventDefault();
    this.open.set(true);
    if (!ids.length) {
      return;
    }
    const current = Math.max(0, ids.indexOf(this.highlight()));
    const next = event.key === 'ArrowDown' ? (current + 1) % ids.length : (current - 1 + ids.length) % ids.length;
    this.highlight.set(ids[next]);
  }

  choose(id: string, event?: Event): void {
    event?.preventDefault();
    this.value.set(id);
    this.close();
  }

  focusInput(): void {
    this.host.nativeElement.querySelector('input')?.focus();
  }

  private close(): void {
    this.open.set(false);
    this.query.set(this.labelFor(this.value()));
  }

  private resolvedGroups(): SearchGroup[] {
    const grouped = this.groups();
    if (grouped.length) {
      return grouped;
    }
    return [{ label: '', options: this.options() }];
  }

  private flat(groups: SearchGroup[]): SearchOption[] {
    return groups.flatMap((g) => g.options);
  }

  private labelFor(id: string): string {
    return this.flat(this.resolvedGroups()).find((o) => o.id === id)?.label ?? '';
  }
}
