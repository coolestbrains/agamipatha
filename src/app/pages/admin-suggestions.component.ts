import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApiService, AdminCatalogSuggestion } from '../admin-api.service';
import { AdminTabsComponent } from '../components/admin-tabs.component';

@Component({
  selector: 'app-admin-suggestions',
  imports: [AdminTabsComponent, DatePipe, RouterLink],
  templateUrl: './admin-suggestions.component.html',
  styleUrl: './admin-suggestions.component.scss',
})
export class AdminSuggestionsComponent {
  private readonly api = inject(AdminApiService);
  readonly rows = signal<AdminCatalogSuggestion[]>([]);
  readonly notice = signal('');

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.api.listSuggestions().subscribe({
      next: (list) => this.rows.set(list),
      error: () => this.notice.set('Could not load suggestions. Sign in again if the session expired.'),
    });
  }

  remove(row: AdminCatalogSuggestion): void {
    if (!confirm(`Remove suggestion “${row.title}”?`)) {
      return;
    }
    this.api.deleteSuggestion(row.id).subscribe({
      next: () => {
        this.notice.set(`Removed ${row.title}.`);
        this.refresh();
      },
    });
  }

  slotLabel(slot: string): string {
    if (slot === 'start') {
      return 'Start qualification';
    }
    if (slot === 'path') {
      return 'Path';
    }
    return 'Goal';
  }

  kindLabel(kind: string): string {
    return kind === 'profession' ? 'Profession' : 'Qualification';
  }
}
