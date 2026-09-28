import { Component, HostListener, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BuyerAuthService } from '../buyer-auth.service';
import { CareerService } from '../career.service';
import { JourneyService } from '../journey.service';
import { CareerNode } from '../models/career.model';
import { NodeIconComponent } from '../components/node-icon.component';
import {
  SearchGroup,
  SearchSelectComponent,
  toSearchGroups,
  toSearchOptions,
} from '../components/search-select.component';
import { overlayMotion } from '../motion';
import { buyerIdFromToken } from '../jwt';
import { Audience, AskPrefs, clearAsk, persistAsk, readAsk } from '../ask-prefs';

export type { Audience };

const AUDIENCES: { id: Audience; label: string }[] = [
  { id: 'student', label: 'Student' },
  { id: 'guardian', label: 'Parent' },
  { id: 'explore', label: 'Professional' },
];

const ASK_COPY: Record<
  Audience,
  {
    title1: string;
    title2: string;
    title3: string;
    who: string;
    whoHint: string;
    have: string;
    haveHint: string;
    become: string;
    becomeHint: string;
    startPlaceholder: string;
    goalPlaceholder: string;
    startError: string;
    skipHint: string;
    browseGoals: string;
    goalError: string;
    hook1: string;
    hook2: string;
    hook3: string;
    suggestStarts: string;
    suggestGoals: string;
    quickLabel: string;
  }
> = {
  student: {
    title1: "Let's plan your career",
    title2: 'Start from where you stand',
    title3: 'Choose a career goal',
    who: 'Who are we guiding today?',
    whoHint: 'So this self-serve guide speaks to you — a student planning the next door.',
    have: 'What qualification do you have now?',
    haveHint: 'Pick the highest stage you have completed. We only open doors after that.',
    become: 'What do you want to do or become?',
    becomeHint: 'A profession or a later qualification is enough. We will map exams, courses, and years.',
    startPlaceholder: 'Search your current qualification',
    goalPlaceholder: 'Search a career or later qualification',
    startError: 'Choose your current qualification so we can start the guidance from the right place.',
    skipHint: 'A named goal draws one career path. Still deciding? Browse every mapped goal from this standing.',
    browseGoals: 'Browse all goals for your qualification',
    goalError: 'Choose a career goal so we can draw your path.',
    hook1: 'AgamiPatha is a self-serve career guide. Three short questions — who this is for, the qualification you hold, and the career you want — then we map the Indian route between them.',
    hook2: 'Good career advice starts from the qualification you already hold — Class 10, a 12th stream, or a degree.',
    hook3: 'Name the career. We draw this year’s doors from where you stand — not a generic list.',
    suggestStarts: 'Students often start from here',
    suggestGoals: 'Careers people aim for from your standing',
    quickLabel: 'Ready-made career paths',
  },
  guardian: {
    title1: "Let's plan their career",
    title2: 'Start from where they stand',
    title3: 'Choose a career goal',
    who: 'Who are we guiding today?',
    whoHint: 'Parent mode keeps this self-serve guide clear for your child — standing, goal, exams, and cost.',
    have: 'What qualification do they have now?',
    haveHint: 'Start from the highest stage they have completed, so we do not skip a door they still need.',
    become: 'What do you want them to do or become?',
    becomeHint: 'Name a profession or later qualification. The path will be honest about exams, years, and cost.',
    startPlaceholder: 'Search their current qualification',
    goalPlaceholder: 'Search a career or later qualification',
    startError: 'Choose their current qualification so we can start the guidance from the right place.',
    skipHint: 'A named goal draws one career path. Still deciding? Browse every mapped goal from this standing.',
    browseGoals: 'Browse all goals for their qualification',
    goalError: 'Choose a career goal so we can draw their path.',
    hook1: 'AgamiPatha is a self-serve career guide families can use together. Three short questions — who this is for, their qualification, and the career goal — then we map exams, years, and cost.',
    hook2: 'Career guidance for a child starts from the qualification they already hold — not from a wish list.',
    hook3: 'Name the career. We will show the exams, years, and cost from their standing.',
    suggestStarts: 'Common standings families start from',
    suggestGoals: 'Goals families often consider from here',
    quickLabel: 'Ready-made career paths',
  },
  explore: {
    title1: '',
    title2: 'Pick a starting qualification',
    title3: 'Choose a career to inspect',
    who: 'Who are we guiding today?',
    whoHint: 'Professional mode is for graduates and working people mapping a next role, postgraduate door, or career switch.',
    have: 'What qualification or stage are you at now?',
    haveHint: 'Use your highest completed degree, diploma, or licence. The guide only opens doors after that standing.',
    become: 'What career or next role are you aiming for?',
    becomeHint: 'Name a profession or later qualification. We map conversion routes, exams, years, and typical cost.',
    startPlaceholder: 'Search your current qualification',
    goalPlaceholder: 'Search a career or later qualification',
    startError: 'Choose your current standing so we can open the right map.',
    skipHint: 'A named goal draws one career path. Still deciding? Browse every mapped goal from this standing.',
    browseGoals: 'Browse all goals for this standing',
    goalError: 'Choose a career goal so we can draw this path.',
    hook1: 'AgamiPatha is a self-serve career guide for students and professionals. Three short questions — who this is for, where you stand now, and the career you want — then one honest Indian route.',
    hook2: 'Career switches still need a standing. Choose the qualification you hold and we only show what can come after it.',
    hook3: 'Name the next role or qualification. One search, one mapped route you can inspect without booking a counsellor.',
    suggestStarts: 'Common standings professionals start from',
    suggestGoals: 'Frequent next careers from this standing',
    quickLabel: 'Ready-made career paths',
  },
};

const SUGGEST_COUNT = 10;

const START_CHIPS = [
  'metric',
  'hs-pcm',
  'hs-pcb',
  'hs-pcmb',
  'hs-commerce',
  'hs-arts',
  'bcom',
  'bba',
  'btech-cse',
  'bsc-cs',
  'bsc-nursing',
  'mba',
];

const QUICK_PATHS: { from: string; to: string }[] = [
  { from: 'hs-pcm', to: 'software-engineer' },
  { from: 'hs-pcb', to: 'doctor' },
  { from: 'bcom', to: 'chartered-accountant' },
  { from: 'metric', to: 'civil-servant' },
  { from: 'hs-pcm', to: 'data-scientist' },
  { from: 'hs-arts', to: 'lawyer' },
  { from: 'hs-commerce', to: 'chartered-accountant' },
  { from: 'bsc-nursing', to: 'nurse' },
  { from: 'hs-pcm', to: 'architect' },
  { from: 'hs-arts', to: 'teacher' },
  { from: 'bba', to: 'mba' },
  { from: 'bsc-cs', to: 'software-engineer' },
  { from: 'metric', to: 'doctor' },
  { from: 'hs-pcb', to: 'nurse' },
];

@Component({
  selector: 'app-landing',
  imports: [SearchSelectComponent, FormsModule, RouterLink, NodeIconComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
  animations: [overlayMotion],
})
export class LandingComponent implements OnDestroy {
  readonly career = inject(CareerService);
  readonly buyer = inject(BuyerAuthService);
  private readonly journeys = inject(JourneyService);
  private readonly router = inject(Router);
  private readonly picker = viewChild(SearchSelectComponent);

  readonly audiences = AUDIENCES;
  readonly audience = signal<Audience>('student');
  readonly askStep = signal<1 | 2 | 3>(1);
  readonly logoSrc = signal('assets/fav.png');
  private readonly logoFallbacks = ['fav.png', 'assets/logo.png', 'logo.png'];
  readonly fromId = signal('');
  readonly toId = signal('');
  readonly error = signal('');
  readonly launching = signal(false);
  readonly suggestions = signal<CareerNode[]>([]);
  readonly suggestOpen = signal(false);
  readonly suggestBusy = signal(false);
  readonly suggestDone = signal(false);
  readonly suggestError = signal('');
  readonly suggestSlot = signal<'start' | 'goal'>('goal');
  suggestTitle = '';
  suggestNotes = '';
  suggestKind: 'qualification' | 'profession' = 'qualification';

  readonly copy = computed(() => ASK_COPY[this.audience()]);
  readonly askTitle = computed(() => {
    const copy = this.copy();
    if (this.askStep() === 1) {
      return copy.title1;
    }
    if (this.askStep() === 2) {
      return copy.title2;
    }
    return copy.title3;
  });
  readonly askGuide = computed(() => {
    const copy = this.copy();
    if (this.askStep() === 1) {
      return copy.whoHint;
    }
    if (this.askStep() === 2) {
      return copy.haveHint;
    }
    return copy.becomeHint;
  });
  readonly askHook = computed(() => {
    const copy = this.copy();
    if (this.askStep() === 1) {
      return copy.hook1;
    }
    if (this.askStep() === 2) {
      return copy.hook2;
    }
    return copy.hook3;
  });
  readonly startChips = computed(() => {
    if (!this.career.ready()) {
      return [];
    }
    const out: CareerNode[] = [];
    const seen = new Set<string>();
    for (const id of START_CHIPS) {
      const node = this.career.getNode(id);
      if (!node || seen.has(node.id)) {
        continue;
      }
      seen.add(node.id);
      out.push(node);
    }
    if (out.length < SUGGEST_COUNT) {
      for (const node of this.career.qualifications()) {
        if (seen.has(node.id)) {
          continue;
        }
        seen.add(node.id);
        out.push(node);
        if (out.length >= SUGGEST_COUNT) {
          break;
        }
      }
    }
    return out.slice(0, SUGGEST_COUNT);
  });
  readonly quickPaths = computed(() => {
    if (!this.career.ready()) {
      return [];
    }
    const out: { fromId: string; toId: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const pair of QUICK_PATHS) {
      const from = this.career.getNode(pair.from);
      const to = this.career.getNode(pair.to);
      if (!from || !to) {
        continue;
      }
      const key = `${from.id}>${to.id}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push({
        fromId: from.id,
        toId: to.id,
        label: `${from.shortTitle} → ${to.shortTitle}`,
      });
    }
    if (out.length < SUGGEST_COUNT) {
      const starts = ['metric', 'hs-pcm', 'hs-pcb', 'hs-commerce', 'hs-arts', 'bcom'];
      for (const startId of starts) {
        const from = this.career.getNode(startId);
        if (!from) {
          continue;
        }
        for (const to of this.career.trending()) {
          if (to.kind === 'entrance-exam' || to.id === from.id) {
            continue;
          }
          const key = `${from.id}>${to.id}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          out.push({
            fromId: from.id,
            toId: to.id,
            label: `${from.shortTitle} → ${to.shortTitle}`,
          });
          if (out.length >= SUGGEST_COUNT) {
            break;
          }
        }
        if (out.length >= SUGGEST_COUNT) {
          break;
        }
      }
    }
    return out.slice(0, SUGGEST_COUNT);
  });
  readonly startOptions = computed(() => toSearchOptions(this.career.qualifications()));
  readonly startNote = computed(() => this.career.belowMetricNote(this.fromId(), this.audience()));
  readonly goalGroups = computed<SearchGroup[]>(() => {
    const from = this.fromId();
    if (!from) {
      return [];
    }
    return toSearchGroups(this.career.goalsAfter(from));
  });
  readonly leftover = computed(() => {
    if (!this.career.ready()) {
      return false;
    }
    const from = this.fromId();
    const to = this.toId();
    return Boolean(this.audience() && from && to && this.career.getNode(from) && this.career.getNode(to));
  });
  readonly showAsk = computed(() => {
    if (this.launching()) {
      return false;
    }
    if (this.career.loadError()) {
      return true;
    }
    return this.career.ready();
  });
  readonly resume = computed(() => {
    if (!this.buyer.isLoggedIn() || !this.career.ready()) {
      return null;
    }
    const trip = this.journeys.saved();
    if (!trip) {
      return null;
    }
    const from = this.career.getNode(trip.fromId);
    const to = this.career.getNode(trip.toId);
    if (!from || !to) {
      return null;
    }
    return {
      fromTitle: from.shortTitle || from.title,
      toTitle: to.shortTitle || to.title,
    };
  });

  private skippedSavedPlan = false;

  constructor() {
    this.restoreAsk();
    effect(() => {
      document.body.style.overflow = this.showAsk() ? 'hidden' : '';
    });
    effect(() => {
      if (this.skippedSavedPlan || this.launching() || !this.career.ready()) {
        return;
      }
      this.skippedSavedPlan = true;
      if (this.leftover()) {
        this.openSavedPath();
      }
    });
    effect(() => {
      const from = this.fromId();
      if (!this.showAsk() || !from) {
        this.suggestions.set([]);
        return;
      }
      this.loadSuggestions();
    });
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  pickAudience(id: Audience): void {
    this.audience.set(id);
    this.error.set('');
    this.saveAsk({ audience: id });
    if (this.askStep() === 1) {
      this.askStep.set(2);
    }
  }

  goNext(): void {
    if (this.askStep() === 1) {
      if (!this.audience()) {
        this.error.set('Tell us who we are guiding.');
        return;
      }
      this.error.set('');
      this.askStep.set(2);
      return;
    }
    if (this.askStep() === 2) {
      const from = this.fromId();
      if (!from) {
        this.error.set(this.copy().startError);
        this.picker()?.focusInput();
        return;
      }
      this.error.set('');
      this.askStep.set(3);
    }
  }

  goBack(): void {
    this.error.set('');
    if (this.askStep() === 3) {
      this.askStep.set(2);
      return;
    }
    if (this.askStep() === 2) {
      this.askStep.set(1);
    }
  }

  skipGoal(): void {
    if (!this.audience()) {
      this.error.set('Tell us who we are guiding.');
      this.askStep.set(1);
      return;
    }
    const from = this.fromId();
    if (!from) {
      this.error.set(this.copy().startError);
      this.askStep.set(2);
      return;
    }
    this.toId.set('');
    this.saveAsk({ audience: this.audience(), fromId: from, toId: '' });
    this.error.set('');
    this.goToPlan(from, '', this.audience());
  }

  startQuickPath(fromId: string, toId: string): void {
    if (!fromId || !toId) {
      return;
    }
    const audience = this.audience() || 'student';
    this.audience.set(audience);
    this.fromId.set(fromId);
    this.toId.set(toId);
    this.saveAsk({ audience, fromId, toId });
    this.goToPlan(fromId, toId, audience);
  }

  setStart(id: string): void {
    this.fromId.set(id);
    this.error.set('');
    const to = this.toId();
    if (id && to && this.career.ready() && !this.career.goalsAfter(id).some((node) => node.id === to)) {
      this.toId.set('');
    }
    if (id) {
      this.saveAsk({ fromId: id });
    }
  }

  setGoal(id: string): void {
    this.toId.set(id);
    this.saveAsk({ toId: id });
  }

  restartFromBeginning(): void {
    this.askStep.set(1);
    this.audience.set('student');
    this.fromId.set('');
    this.toId.set('');
    this.error.set('');
    this.suggestions.set([]);
    clearAsk(this.accountId());
  }

  finish(): void {
    if (!this.audience()) {
      this.error.set('Tell us who we are guiding.');
      this.askStep.set(1);
      return;
    }
    const from = this.fromId();
    if (!from) {
      this.error.set(this.copy().startError);
      this.askStep.set(2);
      return;
    }

    const to = this.toId();
    if (!to) {
      this.error.set(this.copy().goalError);
      this.askStep.set(3);
      return;
    }
    this.saveAsk({
      audience: this.audience(),
      fromId: from,
      toId: to,
    });
    this.error.set('');
    this.goToPlan(from, to, this.audience());
  }

  private openSavedPath(): void {
    const from = this.fromId();
    const to = this.toId();
    const audience = this.audience();
    if (!audience || !from || !to) {
      return;
    }
    this.goToPlan(from, to, audience);
  }

  private goToPlan(from: string, to: string, audience: Audience): void {
    this.launching.set(true);
    const queryParams: Record<string, string> = { from };
    if (to) {
      queryParams['to'] = to;
    }
    if (audience === 'guardian') {
      queryParams['parent'] = '1';
    }
    void this.router.navigate([to ? '/path' : '/options'], { queryParams, replaceUrl: true });
  }

  continueJourney(): void {
    const link = this.journeys.continueLink();
    if (!link) {
      return;
    }
    this.launching.set(true);
    void this.router.navigate([link.path], { queryParams: link.queryParams });
  }

  openLogin(): void {
    this.buyer.requestAccount('login');
  }

  onLogoError(): void {
    const next = this.logoFallbacks.shift();
    if (next) {
      this.logoSrc.set(next);
    }
  }

  pickSuggestion(id: string): void {
    if (!id || id === this.fromId()) {
      return;
    }
    this.setGoal(id);
  }

  suggestionLabel(node: CareerNode): string {
    return node.shortTitle || node.title;
  }

  openSuggest(slot: 'start' | 'goal'): void {
    this.suggestSlot.set(slot);
    this.suggestTitle = '';
    this.suggestNotes = '';
    this.suggestKind = slot === 'start' ? 'qualification' : 'profession';
    this.suggestError.set('');
    this.suggestDone.set(false);
    this.suggestBusy.set(false);
    this.suggestOpen.set(true);
  }

  closeSuggest(): void {
    this.suggestOpen.set(false);
  }

  submitSuggest(): void {
    const title = this.suggestTitle.trim();
    if (title.length < 2) {
      this.suggestError.set('Enter the missing name.');
      return;
    }
    this.suggestBusy.set(true);
    this.suggestError.set('');
    const from = this.career.getNode(this.fromId());
    this.career
      .suggestMissing({
        slot: this.suggestSlot(),
        kind: this.suggestKind,
        title,
        notes: this.suggestNotes.trim() || undefined,
        fromId: from?.id,
        fromTitle: from?.title,
      })
      .subscribe({
        next: () => {
          this.suggestBusy.set(false);
          this.suggestDone.set(true);
        },
        error: () => {
          this.suggestBusy.set(false);
          this.suggestError.set('Could not send that. Try again in a moment.');
        },
      });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.suggestOpen()) {
      this.closeSuggest();
    }
  }

  private loadSuggestions(): void {
    const from = this.fromId();
    this.suggestions.set([]);
    this.career.popularFrom(from).subscribe((list) => {
      if (this.fromId() !== from) {
        return;
      }
      const allowed = this.career.goalsAfter(from);
      const allowedIds = new Set(allowed.map((node) => node.id));
      const merged: CareerNode[] = [];
      const seen = new Set<string>();
      const add = (node?: CareerNode) => {
        if (!node || seen.has(node.id) || !allowedIds.has(node.id)) {
          return merged.length >= SUGGEST_COUNT;
        }
        seen.add(node.id);
        merged.push(node);
        return merged.length >= SUGGEST_COUNT;
      };
      for (const node of list) {
        if (add(node)) {
          break;
        }
      }
      if (merged.length < SUGGEST_COUNT) {
        const extras = [...allowed].sort((a, b) => {
          const rank = Number(a.kind !== 'profession') - Number(b.kind !== 'profession');
          return rank || a.title.localeCompare(b.title);
        });
        for (const node of extras) {
          if (add(node)) {
            break;
          }
        }
      }
      this.suggestions.set(merged.slice(0, SUGGEST_COUNT));
    });
  }

  private restoreAsk(): void {
    const saved = readAsk(this.accountId());
    if (saved.audience) {
      this.audience.set(saved.audience);
    }
    if (saved.fromId) {
      this.fromId.set(saved.fromId);
    }
    if (saved.toId) {
      this.toId.set(saved.toId);
    }
  }

  private saveAsk(patch: Partial<AskPrefs>): void {
    persistAsk(this.accountId(), patch);
  }

  private accountId(): string {
    return this.buyer.isLoggedIn() ? buyerIdFromToken(this.buyer.token()) : '';
  }
}
