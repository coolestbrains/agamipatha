import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BuyerAuthService } from '../buyer-auth.service';
import { CareerService } from '../career.service';
import { buyerIdFromToken } from '../jwt';
import { CareerNode } from '../models/career.model';
import { Audience, isAudience, persistAsk, readAsk } from '../ask-prefs';
import { NodeIconComponent } from '../components/node-icon.component';
import { SearchSelectComponent, toSearchOptions } from '../components/search-select.component';

const AUDIENCES: { id: Audience; label: string }[] = [
  { id: 'student', label: 'Student' },
  { id: 'guardian', label: 'Parent' },
  { id: 'explore', label: 'Other' },
];

@Component({
  selector: 'app-trending-page',
  imports: [RouterLink, SearchSelectComponent, NodeIconComponent],
  templateUrl: './trending-page.component.html',
  styleUrl: './trending-page.component.scss',
})
export class TrendingPageComponent implements OnDestroy {
  readonly career = inject(CareerService);
  private readonly buyer = inject(BuyerAuthService);
  private readonly router = inject(Router);

  readonly audiences = AUDIENCES;
  readonly audience = signal<Audience | ''>('');
  readonly fromId = signal('');
  readonly error = signal('');
  readonly pending = signal<CareerNode | null>(null);
  readonly launching = signal(false);

  readonly items = computed(() => {
    if (!this.career.ready()) {
      return [] as CareerNode[];
    }
    return this.career
      .trending()
      .filter((node) => node.kind !== 'entrance-exam')
      .slice(0, 10);
  });

  readonly startOptions = computed(() => toSearchOptions(this.career.qualifications()));
  readonly startNote = computed(() => this.career.belowMetricNote(this.fromId()));

  constructor() {
    const saved = readAsk(this.accountId());
    if (isAudience(saved.audience)) {
      this.audience.set(saved.audience);
    }
    if (saved.fromId) {
      this.fromId.set(saved.fromId);
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  kindLabel(node: CareerNode): string {
    return node.kind === 'profession' ? 'Profession' : 'Qualification';
  }

  viewPath(node: CareerNode): void {
    const saved = readAsk(this.accountId());
    const audience = isAudience(this.audience())
      ? this.audience()
      : isAudience(saved.audience)
        ? saved.audience
        : '';
    const from = this.fromId() || saved.fromId || '';
    if (audience) {
      this.audience.set(audience);
    }
    if (from) {
      this.fromId.set(from);
    }
    if (audience && from) {
      this.goToPath(from, node.id, audience);
      return;
    }
    this.error.set('');
    this.pending.set(node);
    document.body.style.overflow = 'hidden';
  }

  closePopup(): void {
    this.pending.set(null);
    this.error.set('');
    document.body.style.overflow = '';
  }

  setAudience(id: Audience): void {
    this.audience.set(id);
    this.error.set('');
  }

  setStart(id: string): void {
    this.fromId.set(id);
    this.error.set('');
  }

  submitPopup(): void {
    const goal = this.pending();
    const audience = this.audience();
    const from = this.fromId();
    if (!isAudience(audience)) {
      this.error.set('Choose who this path is for.');
      return;
    }
    if (!from || !this.career.getNode(from)) {
      this.error.set('Choose a starting qualification.');
      return;
    }
    if (goal && from === goal.id) {
      this.error.set('Pick a start that is different from this goal.');
      return;
    }
    if (!goal) {
      return;
    }
    this.goToPath(from, goal.id, audience);
  }

  private goToPath(from: string, to: string, audience: Audience): void {
    persistAsk(this.accountId(), { audience, fromId: from, toId: to });
    this.launching.set(true);
    this.closePopup();
    const queryParams: Record<string, string> = { from, to };
    if (audience === 'guardian') {
      queryParams['parent'] = '1';
    }
    void this.router.navigate(['/path'], { queryParams });
  }

  private accountId(): string {
    return this.buyer.isLoggedIn() ? buyerIdFromToken(this.buyer.token()) : '';
  }
}
