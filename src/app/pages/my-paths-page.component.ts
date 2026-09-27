import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BuyerAuthService } from '../buyer-auth.service';
import { CareerService } from '../career.service';
import { JourneyService, SavedJourney } from '../journey.service';
import { TimelineService } from '../timeline.service';

interface PathCard {
  key: string;
  fromId: string;
  toId: string;
  via: string;
  fromTitle: string;
  toTitle: string;
  spine: string;
  queryParams: Record<string, string>;
}

@Component({
  selector: 'app-my-paths-page',
  imports: [RouterLink],
  templateUrl: './my-paths-page.component.html',
  styleUrl: './my-paths-page.component.scss',
})
export class MyPathsPageComponent {
  private readonly career = inject(CareerService);
  readonly buyer = inject(BuyerAuthService);
  private readonly journeys = inject(JourneyService);
  readonly timeline = inject(TimelineService);
  private readonly router = inject(Router);

  readonly progress = computed(() => this.timeline.progress());
  readonly shareCopied = signal(false);

  readonly myPath = computed(() => {
    if (!this.buyer.isLoggedIn() || !this.career.ready()) {
      return null;
    }
    return this.card(this.journeys.myPath());
  });

  readonly favourites = computed(() => {
    if (!this.buyer.isLoggedIn() || !this.career.ready()) {
      return [];
    }
    return this.journeys.favourites().map((trip) => this.card(trip)).filter((item): item is PathCard => !!item);
  });

  removeMyPath(): void {
    this.journeys.clearMyPath();
  }

  shareMyPath(): void {
    const trip = this.myPath();
    if (!trip) {
      return;
    }
    const url = this.pathUrl(trip);
    const title = `${trip.fromTitle} → ${trip.toTitle} · AgamiPatha`;
    const text = `My path on AgamiPatha: ${trip.fromTitle} → ${trip.toTitle}\n${trip.spine}\n\nOpen this map:\n${url}`;
    if (typeof navigator.share === 'function') {
      // Many mobile share sheets drop `url` when `text` is also set, so the
      // exact /path?from=&to=&via= link has to live inside the message body.
      void navigator.share({ title, text }).catch((err) => {
        if ((err as Error).name !== 'AbortError') {
          this.copyShareLink(url);
        }
      });
      return;
    }
    this.copyShareLink(url);
  }

  removeFavourite(fromId: string, toId: string, via: string): void {
    this.journeys.removeFavourite(fromId, toId, via);
  }

  register(): void {
    this.buyer.requestAccount('register');
  }

  private card(trip: SavedJourney | null): PathCard | null {
    if (!trip) {
      return null;
    }
    const from = this.career.getNode(trip.fromId);
    const to = this.career.getNode(trip.toId);
    const link = this.journeys.linkFor(trip);
    return {
      key: `${trip.fromId}:${trip.toId}:${trip.via}`,
      fromId: trip.fromId,
      toId: trip.toId,
      via: trip.via,
      fromTitle: from?.title || trip.fromId,
      toTitle: to?.title || trip.toId,
      spine: `${from?.shortTitle || trip.fromId} → ${to?.shortTitle || trip.toId}`,
      queryParams: link?.queryParams ?? { from: trip.fromId, to: trip.toId },
    };
  }

  private pathUrl(trip: PathCard): string {
    const queryParams: Record<string, string> = { from: trip.fromId, to: trip.toId };
    if (trip.via) {
      queryParams['via'] = trip.via;
    }
    const tree = this.router.createUrlTree(['/path'], { queryParams });
    return new URL(this.router.serializeUrl(tree), window.location.origin).toString();
  }

  private copyShareLink(url: string): void {
    void navigator.clipboard.writeText(url).then(
      () => {
        this.shareCopied.set(true);
        window.setTimeout(() => this.shareCopied.set(false), 1800);
      },
      () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank', 'noopener');
      },
    );
  }
}
