import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminTabsComponent } from '../components/admin-tabs.component';
import { AdminApiService } from '../admin-api.service';
import { CareerService } from '../career.service';
import { CareerNode } from '../models/career.model';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-admin-nodes',
  standalone: true,
  imports: [FormsModule, RouterLink, AdminTabsComponent],
  templateUrl: './admin-nodes.component.html',
  styleUrl: './admin-nodes.component.scss',
})
export class AdminNodesComponent {
  private readonly api = inject(AdminApiService);
  private readonly career = inject(CareerService);

  readonly nodes = signal<CareerNode[]>([]);
  readonly query = signal('');
  readonly kindFilter = signal('');
  readonly notice = signal('');
  readonly visibleCount = signal(PAGE_SIZE);

  constructor() {
    this.refresh();
  }

  filtered(): CareerNode[] {
    const q = this.query().toLowerCase().trim();
    const kind = this.kindFilter();
    return this.nodes().filter((n) => {
      if (kind && n.kind !== kind) {
        return false;
      }
      if (!q) {
        return true;
      }
      return `${n.title} ${n.id} ${n.field}`.toLowerCase().includes(q);
    });
  }

  visible(): CareerNode[] {
    return this.filtered().slice(0, this.visibleCount());
  }

  hasMore(): boolean {
    return this.visibleCount() < this.filtered().length;
  }

  loadMore(): void {
    this.visibleCount.update((n) => n + PAGE_SIZE);
  }

  setQuery(value: string): void {
    this.query.set(value);
    this.visibleCount.set(PAGE_SIZE);
  }

  setKindFilter(value: string): void {
    this.kindFilter.set(value);
    this.visibleCount.set(PAGE_SIZE);
  }

  refresh(): void {
    this.api.listNodes().subscribe((list) => {
      this.nodes.set(list);
      this.visibleCount.set(PAGE_SIZE);
    });
  }

  remove(node: CareerNode): void {
    if (!confirm(`Delete ${node.title}? Connected path edges will also be removed.`)) {
      return;
    }
    this.api.deleteNode(node.id).subscribe({
      next: () => {
        this.notice.set(`Deleted ${node.title}.`);
        this.refresh();
        this.career.reload().subscribe();
      },
    });
  }

  kindLabel(kind: string): string {
    return this.career.kindLabel(kind);
  }
}
