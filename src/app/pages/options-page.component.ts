import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CareerService } from '../career.service';
import { NodeIconComponent } from '../components/node-icon.component';
import { CareerNode, NodeKind } from '../models/career.model';
import { experienceBadge } from '../experience';

export type GoalTab = 'qualifications' | 'exams' | 'professions';

interface OptionGroup {
  key: string;
  field: string;
  heading: string;
  nodes: CareerNode[];
}

const PAGE_SIZE = 10;

const QUAL_KINDS: NodeKind[] = [
  'school',
  'higher-secondary',
  'vocational',
  'undergraduate',
  'postgraduate',
  'professional',
];

const TABS: { id: GoalTab; label: string; short: string }[] = [
  { id: 'qualifications', label: 'Qualifications', short: 'Qualifications' },
  { id: 'exams', label: 'Competitive Examinations', short: 'Exams' },
  { id: 'professions', label: 'Professions', short: 'Professions' },
];

@Component({
  selector: 'app-options-page',
  imports: [RouterLink, NodeIconComponent],
  templateUrl: './options-page.component.html',
  styleUrl: './options-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsPageComponent {
  readonly career = inject(CareerService);
  private readonly route = inject(ActivatedRoute);

  readonly fromId = toSignal(
    this.route.queryParamMap.pipe(map((q) => q.get('from') ?? 'metric')),
    { initialValue: 'metric' },
  );

  readonly tab = signal<GoalTab>('qualifications');
  readonly shown = linkedSignal({
    source: () => `${this.fromId()}|${this.tab()}`,
    computation: () => PAGE_SIZE,
  });
  readonly standing = computed(() => this.career.getNode(this.fromId()));
  readonly startNote = computed(() => this.career.belowMetricNote(this.fromId()));
  readonly goals = computed(() => {
    if (!this.career.ready()) {
      return [] as CareerNode[];
    }
    return this.career.goalsAfter(this.fromId());
  });

  readonly buckets = computed(() => {
    const qualifications: CareerNode[] = [];
    const exams: CareerNode[] = [];
    const professions: CareerNode[] = [];
    for (const node of this.goals()) {
      if (node.kind === 'profession') {
        professions.push(node);
      } else if (node.kind === 'entrance-exam') {
        exams.push(node);
      } else {
        qualifications.push(node);
      }
    }
    return { qualifications, exams, professions };
  });

  readonly tabs = computed(() =>
    TABS.map((tab) => ({
      ...tab,
      count: this.buckets()[tab.id].length,
    })),
  );

  readonly groups = computed<OptionGroup[]>(() => {
    const pack = this.buckets();
    const current = this.tab();
    if (current === 'qualifications') {
      return this.qualificationGroups(pack.qualifications);
    }
    if (current === 'exams') {
      return groupByField(pack.exams, 'exam');
    }
    return groupByField(pack.professions, 'job');
  });

  readonly total = computed(() => this.buckets()[this.tab()].length);

  readonly visibleGroups = computed<OptionGroup[]>(() => {
    let left = this.shown();
    const visible: OptionGroup[] = [];
    for (const group of this.groups()) {
      if (left <= 0) {
        break;
      }
      const nodes = group.nodes.slice(0, left);
      if (!nodes.length) {
        continue;
      }
      visible.push({ ...group, nodes });
      left -= nodes.length;
    }
    return visible;
  });

  readonly shownCount = computed(() => Math.min(this.shown(), this.total()));

  readonly remaining = computed(() => Math.max(0, this.total() - this.shown()));

  readonly nextBatch = computed(() => Math.min(PAGE_SIZE, this.remaining()));

  readonly hotId = computed(() => {
    const ids = this.visibleGroups().flatMap((group) => group.nodes.map((node) => node.id));
    if (ids.length < 2) {
      return null;
    }
    return this.career.highlightedAmong(ids, this.fromId());
  });

  readonly emptyCopy = computed(() => {
    switch (this.tab()) {
      case 'exams':
        return 'No competitive examinations are listed from this qualification.';
      case 'professions':
        return 'No professions are listed from here.';
      default:
        return 'No further qualifications are listed from this stage.';
    }
  });

  openDetail(node: CareerNode): void {
    this.career.openDetail(node, this.fromId());
  }

  setTab(id: GoalTab): void {
    this.tab.set(id);
  }

  loadMore(): void {
    if (!this.remaining()) {
      return;
    }
    this.shown.update((count) => count + PAGE_SIZE);
  }

  badge(id: string | null): string {
    return this.career.highlightLabel(id);
  }

  experienceLabel(node: CareerNode): string {
    return experienceBadge(node);
  }

  private qualificationGroups(nodes: CareerNode[]): OptionGroup[] {
    const groups: OptionGroup[] = [];
    for (const kind of QUAL_KINDS) {
      const list = nodes.filter((node) => node.kind === kind);
      if (!list.length) {
        continue;
      }
      const fields = groupByField(list, kind);
      if (fields.length === 1) {
        groups.push({
          key: kind,
          field: kind,
          heading: this.career.kindLabel(kind),
          nodes: sortNodes(list),
        });
        continue;
      }
      for (const field of fields) {
        groups.push({
          key: `${kind}:${field.field}`,
          field: field.field,
          heading: `${this.career.kindLabel(kind)} · ${field.field}`,
          nodes: field.nodes,
        });
      }
    }
    return groups;
  }
}

function sortNodes(nodes: CareerNode[]): CareerNode[] {
  return [...nodes].sort((a, b) => a.title.localeCompare(b.title));
}

function groupByField(nodes: CareerNode[], prefix: string): OptionGroup[] {
  const mapBy = new Map<string, CareerNode[]>();
  for (const node of nodes) {
    const field = node.field?.trim() || 'Other';
    const list = mapBy.get(field) ?? [];
    list.push(node);
    mapBy.set(field, list);
  }
  return [...mapBy.entries()]
    .sort(([a], [b]) => {
      if (a === 'Other') {
        return 1;
      }
      if (b === 'Other') {
        return -1;
      }
      return a.localeCompare(b);
    })
    .map(([field, list]) => ({
      key: `${prefix}:${field}`,
      field,
      heading: field,
      nodes: sortNodes(list),
    }));
}
