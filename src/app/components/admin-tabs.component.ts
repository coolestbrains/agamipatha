import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-admin-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabs" aria-label="Admin sections">
      <a routerLink="/admin/nodes" routerLinkActive="active">Nodes</a>
      <a routerLink="/admin/edges" routerLinkActive="active">Connections</a>
      <a routerLink="/admin/paths" routerLinkActive="active">Full paths</a>
      <a routerLink="/admin/suggestions" routerLinkActive="active">Suggestions</a>
      <a routerLink="/admin/store" routerLinkActive="active">Users & sales</a>
      <a routerLink="/admin/circle" routerLinkActive="active">Path Circle</a>
    </nav>
  `,
  styles: `
    .tabs {
      display: inline-flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.25rem;
      margin: 0.75rem 0 0;
      padding: 0.28rem;
      border-radius: 999px;
      background: color-mix(in srgb, white 70%, var(--paper));
      border: 1px solid color-mix(in srgb, var(--teal) 18%, var(--line));
    }
    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 6.2rem;
      padding: 0.45rem 1rem;
      border-radius: 999px;
      color: var(--muted);
      font-weight: 700;
      font-size: 0.9rem;
      text-decoration: none;
      transition: background 0.2s ease, color 0.2s ease;
    }
    a:hover {
      color: var(--teal);
      background: color-mix(in srgb, var(--teal) 8%, white);
    }
    a.active {
      color: var(--on-dark);
      background: linear-gradient(135deg, var(--teal), var(--marigold));
    }
  `,
})
export class AdminTabsComponent {}
