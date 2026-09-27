import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminTabsComponent } from '../components/admin-tabs.component';
import { AdminApiService, AdminPathHop } from '../admin-api.service';
import { CareerService } from '../career.service';
import { SearchGroup, SearchSelectComponent, toSearchGroups, toSearchOptions } from '../components/search-select.component';
import { CareerNode, CareerPathResult } from '../models/career.model';

interface EditorStep {
  nodeId: string;
  via: string;
  notes: string;
}

const PAGE_SIZE = 50;

@Component({
  selector: 'app-admin-paths',
  standalone: true,
  imports: [FormsModule, AdminTabsComponent, SearchSelectComponent],
  templateUrl: './admin-paths.component.html',
  styleUrl: './admin-paths.component.scss',
})
export class AdminPathsComponent {
  private readonly api = inject(AdminApiService);
  readonly career = inject(CareerService);

  readonly nodes = signal<CareerNode[]>([]);
  readonly routes = signal<CareerPathResult[]>([]);
  readonly error = signal('');
  readonly notice = signal('');
  readonly loadingRoutes = signal(false);
  readonly visibleCount = signal(PAGE_SIZE);

  loadFrom = '';
  loadTo = '';
  removeDroppedHops = false;
  steps: EditorStep[] = [this.emptyStep(), this.emptyStep()];
  previousNodeIds: string[] | null = null;

  constructor() {
    this.api.listNodes().subscribe((list) => this.nodes.set(list));
  }

  startOptions() {
    return toSearchOptions(this.nodes().filter((n) => n.kind !== 'profession' && n.kind !== 'entrance-exam'));
  }

  nodeGroups(): SearchGroup[] {
    return toSearchGroups(this.nodes());
  }

  visibleRoutes(): CareerPathResult[] {
    return this.routes().slice(0, this.visibleCount());
  }

  hasMoreRoutes(): boolean {
    return this.visibleCount() < this.routes().length;
  }

  loadMoreRoutes(): void {
    this.visibleCount.update((n) => n + PAGE_SIZE);
  }

  addStep(): void {
    this.steps = [...this.steps, this.emptyStep()];
  }

  removeStep(index: number): void {
    if (this.steps.length <= 2) {
      return;
    }
    this.steps = this.steps.filter((_, i) => i !== index);
  }

  move(index: number, delta: number): void {
    const next = index + delta;
    if (next < 0 || next >= this.steps.length) {
      return;
    }
    const copy = [...this.steps];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    this.steps = copy;
  }

  reset(): void {
    this.steps = [this.emptyStep(), this.emptyStep()];
    this.previousNodeIds = null;
    this.removeDroppedHops = false;
    this.error.set('');
    this.notice.set('Started a new path.');
  }

  loadExisting(): void {
    this.error.set('');
    this.notice.set('');
    if (!this.loadFrom || !this.loadTo) {
      this.error.set('Choose a start and a goal to load existing paths.');
      return;
    }
    this.loadingRoutes.set(true);
    this.career.loadPath(this.loadFrom, this.loadTo).subscribe({
      next: (set) => {
        this.loadingRoutes.set(false);
        this.routes.set(set?.routes ?? []);
        this.visibleCount.set(PAGE_SIZE);
        if (!set?.routes.length) {
          this.error.set('No mapped path exists for that pair yet. Build one below.');
        }
      },
      error: () => {
        this.loadingRoutes.set(false);
        this.error.set('Could not load paths.');
      },
    });
  }

  editRoute(route: CareerPathResult): void {
    this.steps = route.steps.map((step) => ({
      nodeId: step.node.id,
      via: step.incoming?.via ?? '',
      notes: step.incoming?.notes ?? '',
    }));
    this.previousNodeIds = this.steps.map((s) => s.nodeId);
    this.notice.set(`Editing “${route.title}”. Change any step, add more, then save.`);
    this.error.set('');
  }

  save(): void {
    this.error.set('');
    this.notice.set('');
    if (this.steps.some((s) => !s.nodeId)) {
      this.error.set('Choose a node for every step.');
      return;
    }
    const payload: AdminPathHop[] = this.steps.map((s) => ({
      nodeId: s.nodeId,
      via: s.via,
      notes: s.notes,
    }));
    this.api.savePath(payload, this.previousNodeIds, this.removeDroppedHops).subscribe({
      next: (res) => {
        this.previousNodeIds = payload.map((s) => s.nodeId);
        this.notice.set(
          `Saved ${res.spine}. Updated ${res.upserted} step${res.upserted === 1 ? '' : 's'}` +
            (res.removed ? `, removed ${res.removed} dropped connection${res.removed === 1 ? '' : 's'}` : '') +
            '.',
        );
        this.career.reload().subscribe();
        if (this.loadFrom && this.loadTo) {
          this.loadExisting();
        }
      },
      error: (err) => this.error.set(err.error?.message ?? 'Could not save this path.'),
    });
  }

  title(id: string): string {
    return this.nodes().find((n) => n.id === id)?.title ?? id;
  }

  private emptyStep(): EditorStep {
    return { nodeId: '', via: '', notes: '' };
  }
}
