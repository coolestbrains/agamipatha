import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CareerService } from '../career.service';
import { OptionsTreeComponent } from '../components/options-tree.component';
import { NodeIconComponent } from '../components/node-icon.component';
import { CareerNode } from '../models/career.model';
import {
  OptionKindFilter,
  OptionTreeNode,
  collectExpandable,
  countTreeNodes,
  filterOptionTree,
  findTreePath,
  optionKindBucket,
} from '../options-tree.model';
import { experienceBadge } from '../experience';

const KIND_RANK: Record<string, number> = {
  profession: 0,
  postgraduate: 1,
  professional: 2,
  undergraduate: 3,
  vocational: 4,
  'higher-secondary': 5,
  school: 6,
  'entrance-exam': 9,
};

@Component({
  selector: 'app-options-page',
  imports: [RouterLink, FormsModule, NodeIconComponent, OptionsTreeComponent],
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

  readonly standing = computed(() => this.career.getNode(this.fromId()));
  readonly startNote = computed(() => this.career.belowMetricNote(this.fromId()));

  readonly query = signal('');
  readonly kind = signal<OptionKindFilter>('all');

  readonly tree = computed<OptionTreeNode[]>(() => {
    if (!this.career.ready()) {
      return [];
    }
    const start = this.career.graphFromId(this.fromId());
    if (!start) {
      return [];
    }
    return buildOptionTree(start, this.career);
  });

  readonly visibleTree = computed(() =>
    filterOptionTree(this.tree(), this.query(), this.kind()),
  );

  readonly total = computed(() => countTreeNodes(this.tree()));
  readonly visibleCount = computed(() => countTreeNodes(this.visibleTree()));
  readonly directCount = computed(() => this.tree().length);

  readonly counts = computed(() => {
    const qualifications = { qualifications: 0, exams: 0, professions: 0 };
    walkCounts(this.tree(), qualifications);
    return qualifications;
  });

  readonly filters: { id: OptionKindFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'qualifications', label: 'Qualifications' },
    { id: 'exams', label: 'Exams' },
    { id: 'professions', label: 'Professions' },
  ];

  /** User overrides; null means default expand. */
  private readonly expandedOverride = signal<Set<string> | null>(null);

  readonly filtering = computed(() => !!this.query().trim() || this.kind() !== 'all');

  readonly openIds = computed(() => {
    const override = this.expandedOverride();
    if (override) {
      return override;
    }
    if (this.filtering()) {
      return collectExpandable(this.visibleTree());
    }
    const seed = new Set<string>();
    for (const root of this.visibleTree()) {
      if (root.children.length) {
        seed.add(root.node.id);
      }
    }
    const hot = this.hotId();
    if (hot) {
      const path = findTreePath(this.tree(), hot) ?? [];
      for (const id of path.slice(0, -1)) {
        seed.add(id);
      }
    }
    return seed;
  });

  readonly hotId = computed(() => {
    const ids = this.tree().map((item) => item.node.id);
    if (ids.length < 2) {
      return null;
    }
    return this.career.highlightedAmong(ids, this.fromId());
  });

  readonly kindLabelFn = (kind: string): string => this.career.kindLabel(kind);
  readonly badgeFn = (id: string | null): string => this.career.highlightLabel(id);
  readonly experienceLabelFn = (node: CareerNode): string => experienceBadge(node);

  constructor() {
    effect(() => {
      this.fromId();
      this.query.set('');
      this.kind.set('all');
      this.expandedOverride.set(null);
    });
  }

  filterCount(id: OptionKindFilter): number {
    if (id === 'all') {
      return this.total();
    }
    return this.counts()[id];
  }

  setKind(id: OptionKindFilter): void {
    this.kind.set(id);
    this.expandedOverride.set(null);
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.expandedOverride.set(null);
  }

  openDetail(node: CareerNode): void {
    this.career.openDetail(node, this.fromId());
  }

  toggle(id: string): void {
    const next = new Set(this.openIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.expandedOverride.set(next);
  }

  expandAll(): void {
    this.expandedOverride.set(collectExpandable(this.visibleTree()));
  }

  collapseAll(): void {
    this.expandedOverride.set(new Set());
  }
}

function buildOptionTree(fromId: string, career: CareerService): OptionTreeNode[] {
  const seen = new Set<string>([fromId]);

  const walk = (parentId: string, depth: number): OptionTreeNode[] => {
    const hops = career
      .outgoingFrom(parentId)
      .slice()
      .sort(
        (a, b) =>
          (KIND_RANK[a.node.kind] ?? 5) - (KIND_RANK[b.node.kind] ?? 5) ||
          a.node.title.localeCompare(b.node.title),
      );

    const nodes: OptionTreeNode[] = [];
    for (const hop of hops) {
      if (seen.has(hop.node.id)) {
        continue;
      }
      seen.add(hop.node.id);
      const children = walk(hop.node.id, depth + 1);
      nodes.push({
        node: hop.node,
        via: hop.edge.via?.trim() ?? '',
        depth,
        children,
        descendantCount: countTreeNodes(children),
      });
    }
    return nodes;
  };

  return walk(fromId, 0);
}

function walkCounts(
  nodes: OptionTreeNode[],
  counts: { qualifications: number; exams: number; professions: number },
): void {
  for (const node of nodes) {
    counts[optionKindBucket(node.node.kind)] += 1;
    walkCounts(node.children, counts);
  }
}
