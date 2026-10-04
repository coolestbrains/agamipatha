import { Component, DestroyRef, ElementRef, HostListener, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { CareerService } from '../career.service';
import { CareerNode, CareerPathResult, PathSet } from '../models/career.model';
import { JourneyPathComponent } from '../components/journey-path.component';
import { PathCalendarComponent } from '../components/path-calendar.component';
import { PathCostSheetComponent } from '../components/path-cost-sheet.component';
import { PathGuideViewComponent } from '../components/path-guide-view.component';
import { BuyerAuthService } from '../buyer-auth.service';
import { ParentBriefComponent } from '../components/parent-brief.component';
import { buyerIdFromToken } from '../jwt';
import { SearchGroup, SearchSelectComponent, toSearchGroups, toSearchOptions } from '../components/search-select.component';
import { buildPathCalendar } from '../path-calendar';
import { buildPathCost } from '../path-cost';
import { buildParentBrief, parentShareCard, parentShareText, readShareVoice } from '../parent-brief';
import { buildPathGuide } from '../path-guide';
import { JourneyService } from '../journey.service';
import { SwitchPlan, buildSwitchPlan } from '../path-switch';
import { trackPathPageView, trackPathScreenView } from '../facebook-pixel';
import { experiencePathCallout, isExperiencedRole } from '../experience';
import { clearAsk } from '../ask-prefs';

const ENGAGE_NUDGE_KEY = 'agamipatha-path-nudge-dismissed';

@Component({
  selector: 'app-path-page',
  imports: [RouterLink, JourneyPathComponent, PathCalendarComponent, PathCostSheetComponent, PathGuideViewComponent, ParentBriefComponent, SearchSelectComponent],
  templateUrl: './path-page.component.html',
  styleUrl: './path-page.component.scss',
})
export class PathPageComponent implements OnDestroy {
  private readonly career = inject(CareerService);
  private readonly buyer = inject(BuyerAuthService);
  private readonly journeys = inject(JourneyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly defaultTitle = document.title;
  private readonly nudgeDismissed = signal(this.readNudgeDismissed());

  private readonly params = toSignal(
    this.route.queryParamMap.pipe(
      switchMap((q) =>
        of({
          from: q.get('from') ?? '',
          to: q.get('to') ?? '',
          via: q.get('via') ?? '',
          alt: q.get('alt') ?? '',
          parent: q.get('parent') === '1',
        }),
      ),
    ),
    { initialValue: { from: '', to: '', via: '', alt: '', parent: false } },
  );

  readonly loading = signal(true);
  readonly pathSet = signal<PathSet | null>(null);
  readonly routeIndex = signal(0);
  readonly copied = signal(false);
  readonly linkCopied = signal(false);
  readonly shareOpen = signal(false);
  readonly sharing = signal(false);
  readonly makingPdf = signal(false);
  readonly previewOpen = signal(false);
  readonly sheetOpen = signal<'calendar' | 'cost' | null>(null);
  readonly switchOpen = signal(false);
  readonly printSheet = signal(false);
  private readonly shareShot = viewChild<ElementRef<HTMLElement>>('shareShot');

  readonly fromId = computed(() => this.params().from);
  readonly toId = computed(() => this.params().to);
  readonly activeVia = computed(() => this.viaToken(this.active()) ?? '');
  readonly isMyPath = computed(() =>
    this.journeys.isMyPath(this.fromId(), this.toId(), this.activeVia()),
  );
  readonly isFavourite = computed(() =>
    this.journeys.isFavourite(this.fromId(), this.toId(), this.activeVia()),
  );
  readonly shareVoice = computed(() =>
    readShareVoice(buyerIdFromToken(this.buyer.token()), this.params().parent),
  );
  readonly parentMode = computed(() => this.shareVoice() === 'parent');
  readonly pathHeading = computed(() => {
    const n = this.matchCount();
    if (n > 1) {
      return `Career path · viewing ${this.routeIndex() + 1} of ${n}`;
    }
    return 'Career path';
  });
  readonly fromNode = computed(() => this.career.getNode(this.fromId()));
  readonly startNote = computed(() => this.career.belowMetricNote(this.fromId(), this.shareVoice()));
  readonly toNode = computed(() => this.career.getNode(this.toId()));
  readonly experienceCallout = computed(() => {
    const goal = this.toNode();
    const start = this.fromNode();
    if (!goal || !isExperiencedRole(goal)) {
      return '';
    }
    if (start?.kind === 'profession') {
      const feeders = new Set(goal.feederRoles ?? []);
      if (feeders.has(start.id)) {
        return '';
      }
    }
    return experiencePathCallout(goal);
  });
  readonly startOptions = computed(() => toSearchOptions(this.career.qualifications()));
  readonly goalGroups = computed<SearchGroup[]>(() => toSearchGroups(this.career.goalsAfter(this.fromId())));
  readonly routes = computed(() => this.pathSet()?.routes ?? []);
  readonly matchCount = computed(() => this.routes().length);
  readonly canPrevRoute = computed(() => this.routeIndex() > 0);
  readonly canNextRoute = computed(() => this.routeIndex() < this.matchCount() - 1);
  readonly active = computed<CareerPathResult | null>(() => {
    const list = this.routes();
    if (!list.length) {
      return null;
    }
    return list[Math.min(this.routeIndex(), list.length - 1)] ?? null;
  });
  readonly showEngageNudge = computed(
    () => !this.loading() && !!this.active() && !this.nudgeDismissed(),
  );
  readonly feederStepIds = computed(() => {
    const goal = this.toNode();
    const path = this.active();
    if (!goal || !path || !isExperiencedRole(goal)) {
      return [] as string[];
    }
    const feeders = new Set(goal.feederRoles ?? []);
    return path.steps
      .map((step) => step.node.id)
      .filter((id) => feeders.has(id) && id !== goal.id);
  });

  readonly switchPlan = computed<SwitchPlan | null>(() => {
    const from = this.fromNode();
    const to = this.toNode();
    if (!this.switchOpen() || !from || !to || this.loading() || this.active()) {
      return null;
    }
    if (!this.params().from || !this.params().to) {
      return null;
    }
    return buildSwitchPlan({
      from,
      to,
      fromGraphId: this.career.graphFromId(from.id),
      nodes: this.career.nodes(),
      edges: this.career.edges(),
      kindLabel: (kind) => this.career.kindLabel(kind),
    });
  });

  readonly missing = computed(() => {
    if (this.loading()) {
      return '';
    }
    const { from, to } = this.params();
    if (!from || !to) {
      return 'Choose a start and a destination on the landing screen.';
    }
    if (!this.pathSet()?.routes.length) {
      return 'No mapped route connects those two points. Try a nearby degree, or explore all professions from your start qualification.';
    }
    return '';
  });

  readonly calendar = computed(() => {
    const path = this.active();
    if (!path) {
      return null;
    }
    return buildPathCalendar(path, this.fromNode());
  });

  readonly cost = computed(() => {
    const path = this.active();
    return path ? buildPathCost(path) : null;
  });

  readonly shareBrief = computed(() => {
    const path = this.active();
    const to = this.toNode();
    if (!path) {
      return null;
    }
    const backups = [
      ...this.career.nextHops(to?.id || '', 4).map((hop) => hop.node),
      ...(to ? this.career.relatedInField(to, 3) : []),
    ];
    return buildParentBrief({
      path,
      from: this.fromNode(),
      to,
      cost: this.cost(),
      calendar: this.calendar(),
      backups,
      voice: this.shareVoice(),
    });
  });

  readonly pathGuide = computed(() => {
    const path = this.active();
    if (!path) {
      return null;
    }
    return buildPathGuide({
      path,
      from: this.fromNode(),
      to: this.toNode(),
      cost: this.cost(),
      calendar: this.calendar(),
      brief: this.shareBrief(),
      startNote: this.startNote(),
      url: this.shareUrl(),
      kindLabel: (kind) => this.career.kindLabel(kind),
      institutes: (node) => this.career.linkedInstitutes(node).map((item) => item.name),
      certs: (node) => this.career.certificationsFor(node),
      voice: this.shareVoice(),
    });
  });

  readonly canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  constructor() {
    trackPathPageView();

    let lastFrom = '';
    let lastTo = '';
    toObservable(this.params)
      .pipe(
        switchMap(({ from, to, via, alt }) => {
          if (from === lastFrom && to === lastTo) {
            return of({ kind: 'via' as const, via, alt });
          }
          lastFrom = from;
          lastTo = to;
          this.loading.set(true);
          this.career.closeDetail();
          if (!from || !to) {
            return of({ kind: 'set' as const, set: null as PathSet | null, via, alt });
          }
          return this.career.loadPath(from, to).pipe(
            switchMap((set) => of({ kind: 'set' as const, set, via, alt })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        if (event.kind === 'via') {
          this.routeIndex.set(this.indexForVia(this.pathSet(), event.via, event.alt));
          return;
        }
        this.pathSet.set(event.set);
        this.routeIndex.set(this.indexForVia(event.set, event.via, event.alt));
        this.loading.set(false);
        this.closeSwitch();
        this.logActiveRoute();
      });
    effect(() => {
      const from = this.fromNode();
      const to = this.toNode();
      const pair = from && to ? `${from.shortTitle || from.title} → ${to.shortTitle || to.title}` : '';
      document.title = pair
        ? `${this.parentMode() ? 'For the family: ' : ''}${pair} · AgamiPatha`
        : this.defaultTitle;
    });
  }

  ngOnDestroy(): void {
    document.title = this.defaultTitle;
    document.body.style.overflow = '';
  }

  openShare(): void {
    if (!this.shareBrief()) {
      return;
    }
    this.closePreview();
    this.closeSheet();
    this.closeSwitch();
    this.shareOpen.set(true);
  }

  dismissEngageNudge(): void {
    this.nudgeDismissed.set(true);
    try {
      localStorage.setItem(ENGAGE_NUDGE_KEY, '1');
    } catch {
      /* private mode */
    }
  }

  shareFromNudge(): void {
    this.dismissEngageNudge();
    this.openShare();
  }

  saveFromNudge(): void {
    this.dismissEngageNudge();
    this.saveMyPath();
  }

  private readNudgeDismissed(): boolean {
    try {
      return localStorage.getItem(ENGAGE_NUDGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  closeShare(): void {
    this.shareOpen.set(false);
  }

  sharePathLink(): void {
    const url = this.shareUrl();
    const title = this.shareTitle();
    if (typeof navigator.share === 'function') {
      void navigator.share({ title, url }).catch((err) => {
        if ((err as Error).name !== 'AbortError') {
          this.copyPathLink(url);
        }
      });
      return;
    }
    this.copyPathLink(url);
  }

  shareUrl(): string {
    const url = new URL('/path', window.location.origin);
    url.searchParams.set('from', this.fromId());
    url.searchParams.set('to', this.toId());
    const via = this.params().via;
    if (via) {
      url.searchParams.set('via', via);
    }
    const alt = this.params().alt;
    if (alt) {
      url.searchParams.set('alt', alt);
    }
    if (this.parentMode()) {
      url.searchParams.set('parent', '1');
    }
    return url.toString();
  }

  shareCard(): string {
    const brief = this.shareBrief();
    if (brief) {
      return parentShareCard(brief);
    }
    const from = this.fromNode();
    const to = this.toNode();
    const path = this.active();
    const fromTitle = from?.shortTitle || from?.title || 'Start';
    const toTitle = to?.shortTitle || to?.title || 'Goal';
    const spine = path?.spine || `${fromTitle} → ${toTitle}`;
    return ['AgamiPatha path', '', `${fromTitle} → ${toTitle}`, spine].join('\n');
  }

  shareText(): string {
    const brief = this.shareBrief();
    if (brief) {
      return parentShareText(brief, this.shareUrl());
    }
    return `${this.shareCard()}\n\nOpen the map:\n${this.shareUrl()}`;
  }

  shareWhatsApp(): void {
    void this.shareCardImage('whatsapp');
  }

  shareNative(): void {
    void this.shareCardImage('system');
  }

  copyShare(): void {
    void this.shareCardImage('copy');
  }

  private copyPathLink(url: string): void {
    void navigator.clipboard.writeText(url).then(
      () => {
        this.linkCopied.set(true);
        window.setTimeout(() => this.linkCopied.set(false), 1800);
      },
      () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank', 'noopener');
      },
    );
  }

  private shareTitle(): string {
    const from = this.fromNode();
    const to = this.toNode();
    return `${from?.shortTitle || from?.title || 'Start'} → ${to?.shortTitle || to?.title || 'Goal'} · AgamiPatha`;
  }

  private async cardImage(): Promise<Blob | null> {
    const raw = this.shareShot();
    const host = raw instanceof HTMLElement ? raw : raw?.nativeElement;
    if (!host) {
      return null;
    }
    const node = (host.querySelector('.brief') as HTMLElement | null) ?? host;
    try {
      const { toBlob } = await import('html-to-image');
      const options = {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        filter: (el: HTMLElement) => !(el instanceof HTMLElement && el.classList.contains('shot')),
        style: {
          overflow: 'visible',
          height: 'auto',
          maxHeight: 'none',
        },
      };
      return (
        (await toBlob(node, options)) ||
        (await toBlob(node, { ...options, skipFonts: true }))
      );
    } catch {
      try {
        const { toBlob } = await import('html-to-image');
        return await toBlob(node, {
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          skipFonts: true,
        });
      } catch {
        return null;
      }
    }
  }

  private async shareCardImage(mode: 'whatsapp' | 'system' | 'copy'): Promise<void> {
    if (this.sharing()) {
      return;
    }
    this.sharing.set(true);
    try {
      const blob = await this.cardImage();
      if (!blob) {
        this.shareTextFallback(mode);
        return;
      }
      const file = new File([blob], 'agamipatha-path.png', { type: 'image/png' });
      if (mode === 'copy') {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } catch {
          this.downloadShot(blob);
        }
        this.copied.set(true);
        window.setTimeout(() => this.copied.set(false), 1800);
        return;
      }
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: this.shareTitle(),
          });
          return;
        } catch (err) {
          if ((err as Error).name === 'AbortError') {
            return;
          }
        }
      }
      this.downloadShot(blob);
    } finally {
      this.sharing.set(false);
    }
  }

  private downloadShot(blob: Blob): void {
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'agamipatha-path.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 2500);
  }

  private shareTextFallback(mode: 'whatsapp' | 'system' | 'copy'): void {
    if (mode === 'copy') {
      void navigator.clipboard.writeText(this.shareText()).then(
        () => {
          this.copied.set(true);
          window.setTimeout(() => this.copied.set(false), 1800);
        },
        () => this.openWhatsAppText(),
      );
      return;
    }
    if (mode === 'system' && typeof navigator.share === 'function') {
      void navigator
        .share({
          title: this.shareTitle(),
          text: this.shareCard(),
          url: this.shareUrl(),
        })
        .catch((err) => {
          if ((err as Error).name !== 'AbortError') {
            this.openWhatsAppText();
          }
        });
      return;
    }
    this.openWhatsAppText();
  }

  private openWhatsAppText(): void {
    const href = `https://wa.me/?text=${encodeURIComponent(this.shareText())}`;
    window.open(href, '_blank', 'noopener');
  }

  printPath(): void {
    window.print();
  }

  printGuide(): void {
    this.closeShare();
    this.printSheet.set(true);
    window.setTimeout(() => window.print(), 80);
  }

  openPreview(): void {
    if (!this.pathGuide()) {
      return;
    }
    this.closeShare();
    this.sheetOpen.set(null);
    this.switchOpen.set(false);
    this.previewOpen.set(true);
    this.syncBodyLock();
  }

  closePreview(): void {
    this.previewOpen.set(false);
    this.syncBodyLock();
  }

  openCalendar(): void {
    if (!this.calendar()) {
      return;
    }
    this.closeShare();
    this.previewOpen.set(false);
    this.switchOpen.set(false);
    this.sheetOpen.set('calendar');
    this.syncBodyLock();
  }

  openCost(): void {
    if (!this.cost()) {
      return;
    }
    this.closeShare();
    this.previewOpen.set(false);
    this.switchOpen.set(false);
    this.sheetOpen.set('cost');
    this.syncBodyLock();
  }

  closeSheet(): void {
    this.sheetOpen.set(null);
    this.syncBodyLock();
  }

  openSwitch(): void {
    if (!this.switchPlan()) {
      return;
    }
    this.closeShare();
    this.closePreview();
    this.sheetOpen.set(null);
    this.switchOpen.set(true);
    this.syncBodyLock();
  }

  closeSwitch(): void {
    this.switchOpen.set(false);
    this.syncBodyLock();
  }

  private syncBodyLock(): void {
    document.body.style.overflow =
      this.previewOpen() || this.sheetOpen() || this.switchOpen() ? 'hidden' : '';
  }

  saveMyPath(): void {
    this.saveToAccount('my-path');
  }

  saveFavourite(): void {
    this.saveToAccount('favourite');
  }

  private saveToAccount(kind: 'my-path' | 'favourite'): void {
    const from = this.fromId();
    const to = this.toId();
    if (!from || !to) {
      return;
    }
    const via = this.activeVia();
    if (!this.buyer.isLoggedIn()) {
      if (kind === 'my-path') {
        this.journeys.queueMyPath(from, to, via);
      } else {
        this.journeys.queueFavourite(from, to, via);
      }
      this.buyer.requestAccount('register');
      return;
    }
    if (kind === 'my-path') {
      this.journeys.toggleMyPath(from, to, via);
      return;
    }
    this.journeys.toggleFavourite(from, to, via);
  }

  async downloadPathPdf(): Promise<void> {
    const guide = this.pathGuide();
    if (!guide || this.makingPdf()) {
      return;
    }
    this.makingPdf.set(true);
    try {
      const { downloadPathGuidePdf } = await import('../path-guide-pdf');
      await downloadPathGuidePdf(guide);
    } finally {
      this.makingPdf.set(false);
    }
  }

  setPair(which: 'from' | 'to', id: string): void {
    if (!id || this.params()[which] === id) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [which]: id, via: null, alt: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  startOver(): void {
    const accountId = this.buyer.isLoggedIn() ? buyerIdFromToken(this.buyer.token()) : '';
    clearAsk(accountId);
    this.career.closeDetail();
    void this.router.navigateByUrl('/');
  }

  shiftRoute(delta: number): void {
    this.pickRoute(this.routeIndex() + delta);
  }

  pickRoute(index: number): void {
    const max = this.routes().length - 1;
    const next = Math.min(max, Math.max(0, index));
    this.routeIndex.set(next);
    this.career.closeDetail();
    this.logActiveRoute(next);
    const route = this.routes()[next];
    const via = this.viaToken(route);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { via, alt: String(next) },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  kindLabel = (node: CareerNode) => this.career.kindLabel(node.kind);

  openDetail(node: CareerNode): void {
    this.career.openDetail(node, this.fromId());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.switchOpen()) {
      this.closeSwitch();
      return;
    }
    if (this.sheetOpen()) {
      this.closeSheet();
      return;
    }
    if (this.previewOpen()) {
      this.closePreview();
      return;
    }
    if (this.shareOpen()) {
      this.closeShare();
    }
  }

  readonly whyLines = computed(() => {
    const path = this.active();
    if (!path?.recommended) {
      return [] as string[];
    }
    if (path.recommendDetails?.length) {
      return path.recommendDetails;
    }
    if (path.recommendReason) {
      return path.recommendReason.split(' · ').map((part) => part.trim()).filter(Boolean);
    }
    return ['This route ranked first among the mapped alternatives from your start to this destination.'];
  });

  private indexForVia(set: PathSet | null, via: string, alt = ''): number {
    if (!set?.routes.length) {
      return 0;
    }
    const parsed = Number.parseInt(alt, 10);
    if (Number.isInteger(parsed)) {
      return Math.min(Math.max(0, parsed), set.routes.length - 1);
    }
    if (via) {
      const exact = set.routes.findIndex((route) => this.viaToken(route) === via);
      if (exact >= 0) {
        return exact;
      }
    }
    return Math.min(set.recommendedIndex ?? 0, set.routes.length - 1);
  }

  private logActiveRoute(index?: number): void {
    const from = this.fromId();
    const to = this.toId();
    const route = this.routes()[index ?? this.routeIndex()];
    if (!from || !to || !route) {
      return;
    }
    this.career.recordInterest(to, {
      fromId: from,
      toId: to,
      via: this.viaToken(route),
    });
    const fromNode = this.fromNode();
    const toNode = this.toNode();
    trackPathScreenView({
      fromId: from,
      toId: to,
      fromTitle: fromNode?.shortTitle || fromNode?.title,
      toTitle: toNode?.shortTitle || toNode?.title,
      via: this.viaToken(route),
    });
  }

  private viaToken(route: CareerPathResult | null | undefined): string | null {
    if (!route) {
      return null;
    }
    const ids = route.steps.slice(1, -1).map((s) => s.node.id);
    return ids.length ? ids.join(',') : null;
  }
}
