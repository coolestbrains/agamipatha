import { DecimalPipe } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './auth.service';
import { BuyerAuthService } from './buyer-auth.service';
import { ChatWidgetComponent } from './components/chat-widget.component';
import { CareerService } from './career.service';
import { NodeDetailComponent } from './components/node-detail.component';
import { AccountDialogComponent } from './components/account-dialog.component';
import { BookAdComponent } from './components/book-ad.component';
import { StatsChartComponent } from './components/stats-chart.component';
import { JourneyService } from './journey.service';
import { TimelineService } from './timeline.service';
import { SiteStats, StatMetric, StatSeries, StatsService } from './stats.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DecimalPipe, NodeDetailComponent, ChatWidgetComponent, BookAdComponent, AccountDialogComponent, StatsChartComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly stats = inject(StatsService);
  readonly career = inject(CareerService);
  readonly buyer = inject(BuyerAuthService);
  readonly admin = inject(AuthService);
  readonly logoSrc = signal('assets/logo.png');
  readonly chartMetric = signal<StatMetric | null>(null);
  readonly chartSeries = signal<StatSeries | null>(null);
  readonly chartBusy = signal(false);
  readonly chartError = signal('');
  readonly accountMenuOpen = signal(false);
  readonly whyMenuOpen = signal(false);
  private readonly logoFallbacks = ['logo.png', 'assets/fav.png', 'fav.png'];
  private readonly router = inject(Router);
  private readonly path = signal(this.currentPath());

  isPlanActive(): boolean {
    const path = this.path();
    return path === '/' || path.startsWith('/path') || path.startsWith('/options') || path.startsWith('/compare');
  }

  isWhyUsActive(): boolean {
    const path = this.path();
    return path === '/why' || path === '/about';
  }

  toggleAccountMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.whyMenuOpen.set(false);
    this.accountMenuOpen.update((open) => !open);
  }

  closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  toggleWhyMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.accountMenuOpen.set(false);
    this.whyMenuOpen.update((open) => !open);
  }

  closeWhyMenu(): void {
    this.whyMenuOpen.set(false);
  }

  closeMenus(): void {
    this.closeAccountMenu();
    this.closeWhyMenu();
  }

  logout(): void {
    this.closeMenus();
    this.buyer.logout();
    this.admin.clearSession();
    if (this.currentPath().startsWith('/admin')) {
      void this.router.navigateByUrl('/');
    }
  }

  openBuyerLogin(): void {
    this.closeMenus();
    this.buyer.requestAccount('login');
  }

  constructor() {
    inject(JourneyService);
    inject(TimelineService);
    this.stats.recordGuestIfNeeded().subscribe();
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => {
      this.path.set(this.currentPath());
      this.closeMenus();
    });
  }

  private currentPath(): string {
    return this.router.url.split('?')[0].split('#')[0];
  }

  onLogoError(): void {
    const next = this.logoFallbacks.shift();
    if (next) {
      this.logoSrc.set(next);
    }
  }

  tillDateItems(s: SiteStats): { metric: StatMetric; value: number; label: string }[] {
    return [
      { metric: 'searches', value: s.searches, label: 'Searches' },
      { metric: 'guests', value: s.guestVisits, label: 'Guest visits' },
      { metric: 'qualifications', value: s.qualifications, label: 'Qualifications' },
      { metric: 'professions', value: s.professions, label: 'Professions' },
      { metric: 'purchases', value: s.purchases, label: 'Purchases' },
      { metric: 'registered', value: s.registered, label: 'Registered' },
    ];
  }

  todayItems(s: SiteStats): { metric: StatMetric; value: number; label: string }[] {
    return [
      { metric: 'searches', value: s.searchesToday, label: 'Searches' },
      { metric: 'guests', value: s.guestsToday, label: 'New guests' },
      { metric: 'purchases', value: s.purchasesToday, label: 'Purchases' },
      { metric: 'registered', value: s.registeredToday, label: 'Registered' },
    ];
  }

  openStat(metric: StatMetric): void {
    if (!this.admin.isAdmin()) {
      return;
    }
    this.chartMetric.set(metric);
    this.chartSeries.set(null);
    this.chartError.set('');
    this.chartBusy.set(true);
    document.body.style.overflow = 'hidden';
    this.stats.loadSeries(metric).subscribe({
      next: (series) => {
        this.chartSeries.set(series);
        this.chartBusy.set(false);
      },
      error: () => {
        this.chartBusy.set(false);
        this.chartError.set('This chart could not be loaded.');
      },
    });
  }

  closeChart(): void {
    this.chartMetric.set(null);
    this.chartSeries.set(null);
    this.chartError.set('');
    this.chartBusy.set(false);
    document.body.style.overflow = '';
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.whyMenuOpen() || this.accountMenuOpen()) {
      this.closeMenus();
      return;
    }
    if (this.chartMetric()) {
      this.closeChart();
      return;
    }
    this.career.closeDetail();
  }
}
