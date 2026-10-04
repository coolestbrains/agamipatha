import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NodeIconComponent } from './node-icon.component';
import { CareerNode } from '../models/career.model';
import { OptionTreeNode } from '../options-tree.model';

interface KindGroup {
  key: string;
  label: string;
  items: OptionTreeNode[];
}

@Component({
  selector: 'app-options-tree',
  imports: [RouterLink, NodeIconComponent, OptionsTreeComponent],
  templateUrl: './options-tree.component.html',
  styleUrl: './options-tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsTreeComponent {
  readonly nodes = input.required<OptionTreeNode[]>();
  readonly fromId = input.required<string>();
  readonly openIds = input.required<ReadonlySet<string>>();
  readonly hotId = input<string | null>(null);
  readonly kindLabel = input.required<(kind: string) => string>();
  readonly badge = input.required<(id: string | null) => string>();
  readonly experienceLabel = input.required<(node: CareerNode) => string>();

  readonly toggle = output<string>();
  readonly openDetail = output<CareerNode>();

  readonly groups = computed<KindGroup[]>(() => {
    const groups: KindGroup[] = [];
    for (const item of this.nodes()) {
      const key = item.node.kind;
      const last = groups.at(-1);
      if (last && last.key === key) {
        last.items.push(item);
        continue;
      }
      groups.push({
        key,
        label: this.kindLabel()(key),
        items: [item],
      });
    }
    return groups;
  });

  readonly showGroupHeads = computed(() => this.groups().length > 1);

  isOpen(id: string): boolean {
    return this.openIds().has(id);
  }

  onRow(item: OptionTreeNode, event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button.go, button.twist')) {
      return;
    }
    if (item.children.length) {
      this.toggle.emit(item.node.id);
    }
  }
}
