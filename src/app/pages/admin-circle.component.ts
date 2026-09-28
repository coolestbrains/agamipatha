import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AdminApiService, AdminPathCircleStats } from '../admin-api.service';
import { AdminTabsComponent } from '../components/admin-tabs.component';

@Component({
  selector: 'app-admin-circle',
  imports: [AdminTabsComponent, DatePipe],
  templateUrl: './admin-circle.component.html',
  styleUrl: './admin-circle.component.scss',
})
export class AdminCircleComponent {
  private readonly api = inject(AdminApiService);

  readonly stats = signal<AdminPathCircleStats | null>(null);
  readonly error = signal('');

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.error.set('');
    this.api.circleStats().subscribe({
      next: (stats) => this.stats.set(stats),
      error: () => this.error.set('Path Circle stats could not be loaded. Sign in again if the session expired.'),
    });
  }
}
