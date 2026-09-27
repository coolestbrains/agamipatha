import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { BuyerAuthService } from '../buyer-auth.service';
import { CareerService } from '../career.service';
import { JourneyService } from '../journey.service';
import { CareerPathResult } from '../models/career.model';
import { TimelineHint, TimelineHelpGroup, buildTimelineHint, buildTimelineHelp, pickRoute, stepIdsOf } from '../path-timeline';
import { TimelineService } from '../timeline.service';

interface TimelineRow {
  id: string;
  index: number;
  total: number;
  title: string;
  shortTitle: string;
  kind: string;
  via: string;
  role: 'start' | 'gate' | 'goal';
  done: boolean;
  current: boolean;
  hint: TimelineHint;
  help: TimelineHelpGroup[];
}

@Component({
  selector: 'app-my-timeline-page',
  imports: [RouterLink],
  templateUrl: './my-timeline-page.component.html',
  styleUrl: './my-timeline-page.component.scss',
})
export class MyTimelinePageComponent {
  private readonly career = inject(CareerService);
  private readonly buyer = inject(BuyerAuthService);
  private readonly journeys = inject(JourneyService);
  private readonly timeline = inject(TimelineService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly path = signal<CareerPathResult | null>(null);
  readonly hintId = signal('');
  readonly helpId = signal('');

  readonly loggedIn = computed(() => this.buyer.isLoggedIn());
  readonly trip = computed(() => this.journeys.myPath());
  readonly fromTitle = computed(() => this.career.getNode(this.trip()?.fromId ?? '')?.title || this.trip()?.fromId || '');
  readonly toTitle = computed(() => this.career.getNode(this.trip()?.toId ?? '')?.title || this.trip()?.toId || '');
  readonly openParams = computed(() => this.journeys.linkFor(this.trip())?.queryParams ?? {});
  readonly rows = computed(() => this.toRows(this.path()));
  readonly doneCount = computed(() => this.timeline.progress().done);
  readonly allDone = computed(() => {
    const progress = this.timeline.progress();
    return progress.total > 0 && progress.left === 0 && this.rows().length > 0;
  });
  readonly percent = computed(() => this.timeline.progress().percent);
  readonly currentTitle = computed(() => this.rows().find((row) => row.current)?.title || '');

  constructor() {
    toObservable(
      computed(() => ({
        ready: this.career.ready(),
        trip: this.journeys.myPath(),
        loggedIn: this.buyer.isLoggedIn(),
      })),
    )
      .pipe(
        switchMap(({ ready, trip, loggedIn }) => {
          this.hintId.set('');
          this.helpId.set('');
          if (!loggedIn || !trip) {
            this.path.set(null);
            this.loading.set(false);
            return of(null);
          }
          if (!ready) {
            this.loading.set(true);
            return of(undefined);
          }
          this.loading.set(true);
          return this.career.loadPath(trip.fromId, trip.toId);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((set) => {
        if (set === undefined) {
          return;
        }
        const route = pickRoute(set, this.trip()?.via ?? '');
        this.path.set(route);
        this.timeline.setSteps(stepIdsOf(route));
        this.loading.set(false);
      });
  }

  toggleDone(id: string): void {
    this.timeline.toggle(id);
  }

  toggleHint(id: string): void {
    this.helpId.set('');
    this.hintId.update((open) => (open === id ? '' : id));
  }

  toggleHelp(id: string): void {
    this.hintId.set('');
    this.helpId.update((open) => (open === id ? '' : id));
  }

  register(): void {
    this.buyer.requestAccount('register');
  }

  private toRows(path: CareerPathResult | null): TimelineRow[] {
    const steps = path?.steps ?? [];
    const total = steps.length;
    const done = new Set(this.timeline.completed());
    const currentIndex = steps.findIndex((step) => !done.has(step.node.id));
    return steps.map((step, index) => {
      const next = steps[index + 1]?.node;
      const role: TimelineRow['role'] = index === 0 ? 'start' : index === total - 1 ? 'goal' : 'gate';
      return {
        id: step.node.id,
        index,
        total,
        title: step.node.title,
        shortTitle: step.node.shortTitle || step.node.title,
        kind: this.career.kindLabel(step.node.kind),
        via: step.incoming?.via?.trim() || '',
        role,
        done: done.has(step.node.id),
        current: currentIndex === index,
        hint: buildTimelineHint(step, next, index, total, (kind) => this.career.kindLabel(kind)),
        help: buildTimelineHelp({
          title: step.node.title,
          exams: step.node.exams,
          via: step.incoming?.via?.trim() || '',
          institutes: this.career.linkedInstitutes(step.node),
          certs: this.career.linkedCertifications(step.node),
        }),
      };
    });
  }
}
