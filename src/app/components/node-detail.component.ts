import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CareerService } from '../career.service';
import { NodeIconComponent } from './node-icon.component';
import { CareerEdge, CareerNode, LinkedCert, LinkedRef } from '../models/career.model';
import { experienceBadge } from '../experience';

interface DetailView {
  kindLabel: string;
  pathFromId: string;
  experienceBadge: string;
  feeders: CareerNode[];
  whyRelevant: string | null;
  howFromHere: { via: string; notes: string; later: string } | null;
  nextHops: { node: CareerNode; edge: CareerEdge }[];
  relatedInField: CareerNode[];
  certLinks: LinkedCert[];
  institutes: LinkedRef[];
  employers: LinkedRef[];
  trending: CareerNode[];
  extrasReady: boolean;
}

@Component({
  selector: 'app-node-detail',
  imports: [RouterLink, NodeIconComponent],
  templateUrl: './node-detail.component.html',
  styleUrl: './node-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeDetailComponent implements OnChanges {
  private readonly career = inject(CareerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private enrichHandles: number[] = [];
  private buildToken = 0;

  @ViewChild('scroll') scroll?: ElementRef<HTMLElement>;

  @Input({ required: true }) node!: CareerNode;
  @Input() fromId = '';
  @Output() closed = new EventEmitter<void>();

  view: DetailView = this.emptyView();

  constructor() {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.destroyRef.onDestroy(() => {
      document.body.style.overflow = previous;
      this.cancelEnrich();
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['node'] || changes['fromId']) {
      this.openShell();
      if (changes['node'] && !changes['node'].firstChange) {
        queueMicrotask(() => this.scroll?.nativeElement.scrollTo({ top: 0 }));
      }
    }
  }

  close(event?: Event): void {
    event?.stopPropagation();
    this.cancelEnrich();
    this.buildToken += 1;
    this.closed.emit();
  }

  openTrending(node: CareerNode): void {
    this.career.openDetail(node, this.fromId || undefined);
  }

  openRelated(node: CareerNode): void {
    this.career.openDetail(node, this.fromId || this.node.id);
  }

  trendingKind(node: CareerNode): string {
    return this.career.kindLabel(node.kind);
  }

  private emptyView(): DetailView {
    return {
      kindLabel: '',
      pathFromId: '',
      experienceBadge: '',
      feeders: [],
      whyRelevant: null,
      howFromHere: null,
      nextHops: [],
      relatedInField: [],
      certLinks: [],
      institutes: [],
      employers: [],
      trending: [],
      extrasReady: false,
    };
  }

  /** Instant shell from the node object only — no graph / link work. */
  private openShell(): void {
    this.cancelEnrich();
    const token = ++this.buildToken;
    const node = this.node;
    const pathFromId = this.fromId && this.fromId !== node.id ? this.fromId : '';
    const feeders = (node.feederRoles ?? [])
      .map((id) => this.career.getNode(id))
      .filter((n): n is CareerNode => !!n)
      .slice(0, 4);

    this.view = {
      kindLabel: this.career.kindLabel(node.kind),
      pathFromId,
      experienceBadge: experienceBadge(node),
      feeders,
      whyRelevant: null,
      howFromHere: null,
      nextHops: [],
      relatedInField: [],
      certLinks: [],
      institutes: (node.institutes ?? []).slice(0, 10).map((name) => ({ name })),
      employers: [],
      trending: [],
      extrasReady: false,
    };
    this.cdr.markForCheck();

    // Yield until after paint, then compute extras off the Angular zone and apply once.
    this.zone.runOutsideAngular(() => {
      this.afterPaint(token, () => this.buildExtras(token, pathFromId, node));
    });
  }

  private async buildExtras(token: number, pathFromId: string, node: CareerNode): Promise<void> {
    if (token !== this.buildToken) {
      return;
    }

    const from = pathFromId ? this.career.getNode(pathFromId) : undefined;
    const parts: string[] = [];
    if (pathFromId && this.career.edgeBetween(pathFromId, node.id)) {
      parts.push(`Direct next step from ${from?.shortTitle ?? 'here'}`);
    }
    if (from?.field && from.field === node.field) {
      parts.push(`same field (${node.field})`);
    }
    const whyRelevant = parts.length ? parts.join(' · ') : null;
    const nextHops = pathFromId ? this.career.nextHops(node.id, 5) : [];
    const employers = this.career.linkedEmployers(node);
    const trending = this.career.trending().filter((n) => n.id !== node.id).slice(0, 6);

    await this.yieldToMain(token);
    if (token !== this.buildToken) {
      return;
    }

    const institutes = this.career.linkedInstitutes(node);
    const certLinks = this.career.linkedCertifications(node);

    await this.yieldToMain(token);
    if (token !== this.buildToken) {
      return;
    }

    let howFromHere: DetailView['howFromHere'] = null;
    let relatedInField: CareerNode[] = [];
    if (pathFromId) {
      const direct = this.career.edgeBetween(pathFromId, node.id);
      if (direct && (direct.via || direct.notes)) {
        howFromHere = { via: direct.via, notes: direct.notes, later: '' };
      } else {
        // Cap path search so a dense graph cannot monopolise the main thread.
        const hop = this.career.firstHopToward(pathFromId, node.id, 120);
        if (hop) {
          const later = hop.viaNodes.map((n) => n.shortTitle).join(' → ');
          if (hop.edge.via || hop.edge.notes || later) {
            howFromHere = { via: hop.edge.via, notes: hop.edge.notes, later };
          }
        }
      }
      relatedInField = this.career.relatedInField(node, 3);
    }

    this.zone.run(() => {
      if (token !== this.buildToken) {
        return;
      }
      this.view = {
        kindLabel: this.view.kindLabel,
        pathFromId,
        experienceBadge: this.view.experienceBadge,
        feeders: this.view.feeders,
        whyRelevant,
        howFromHere,
        nextHops,
        relatedInField,
        certLinks,
        institutes,
        employers,
        trending,
        extrasReady: true,
      };
      this.cdr.markForCheck();
    });
  }

  /** Wait for the browser to paint the shell, then run work. */
  private afterPaint(token: number, work: () => void): void {
    const id = window.requestAnimationFrame(() => {
      const id2 = window.requestAnimationFrame(() => {
        if (token === this.buildToken) {
          work();
        }
      });
      this.enrichHandles.push(id2);
    });
    this.enrichHandles.push(id);
  }

  private yieldToMain(token: number): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        if (token === this.buildToken) {
          resolve();
        }
      };
      const scheduler = (
        window as Window & { scheduler?: { yield?: () => Promise<void> } }
      ).scheduler;
      if (scheduler?.yield) {
        void scheduler.yield().then(finish, finish);
        return;
      }
      const handle = window.setTimeout(finish, 0);
      this.enrichHandles.push(handle);
    });
  }

  private cancelEnrich(): void {
    for (const id of this.enrichHandles) {
      window.cancelAnimationFrame(id);
      window.clearTimeout(id);
    }
    this.enrichHandles = [];
  }
}
