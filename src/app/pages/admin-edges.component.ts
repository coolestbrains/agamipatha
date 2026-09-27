import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminTabsComponent } from '../components/admin-tabs.component';
import { AdminApiService } from '../admin-api.service';
import { CareerService } from '../career.service';
import { SearchGroup, SearchSelectComponent, toSearchGroups } from '../components/search-select.component';
import { CareerEdge, CareerNode } from '../models/career.model';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-admin-edges',
  standalone: true,
  imports: [FormsModule, AdminTabsComponent, SearchSelectComponent],
  templateUrl: './admin-edges.component.html',
  styleUrl: './admin-edges.component.scss',
})
export class AdminEdgesComponent {
  private readonly api = inject(AdminApiService);
  private readonly career = inject(CareerService);

  readonly edges = signal<CareerEdge[]>([]);
  readonly nodes = signal<CareerNode[]>([]);
  fromId = '';
  toId = '';
  via = '';
  notes = '';
  error = signal('');
  query = signal('');
  readonly visibleCount = signal(PAGE_SIZE);

  constructor() {
    this.refresh();
  }

  filtered(): CareerEdge[] {
    const q = this.query().toLowerCase();
    if (!q) {
      return this.edges();
    }
    return this.edges().filter((e) => `${e.from} ${e.to} ${e.via}`.toLowerCase().includes(q));
  }

  visible(): CareerEdge[] {
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

  title(id: string): string {
    return this.nodes().find((n) => n.id === id)?.title ?? id;
  }

  nodeGroups(): SearchGroup[] {
    return toSearchGroups(this.nodes());
  }

  add(): void {
    this.error.set('');
    if (!this.fromId || !this.toId) {
      this.error.set('Choose both a start and a destination.');
      return;
    }
    this.api.createEdge({ from: this.fromId, to: this.toId, via: this.via, notes: this.notes }).subscribe({
      next: () => {
        this.via = '';
        this.notes = '';
        this.refresh();
        this.career.reload().subscribe();
      },
      error: (err) => this.error.set(err.error?.message ?? 'Could not add connection.'),
    });
  }

  remove(edge: CareerEdge): void {
    if (edge.id == null) {
      return;
    }
    this.api.deleteEdge(edge.id).subscribe(() => {
      this.refresh();
      this.career.reload().subscribe();
    });
  }

  private refresh(): void {
    this.api.listEdges().subscribe((list) => {
      this.edges.set(list);
      this.visibleCount.set(PAGE_SIZE);
    });
    this.api.listNodes().subscribe((list) => this.nodes.set(list));
  }
}
