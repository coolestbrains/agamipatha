import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { BuyerAuthService } from '../buyer-auth.service';
import { CareerService } from '../career.service';
import {
  CIRCLE_TAGS,
  CircleService,
  PathConnection,
  PathConnectRequest,
  PathMessage,
  PathPeerCard,
  PathProfile,
} from '../circle.service';
import { StoreOrder, StoreService } from '../store.service';
import {
  SearchSelectComponent,
  toSearchGroups,
  toSearchOptions,
} from '../components/search-select.component';
import { JourneyService } from '../journey.service';

type CircleTab = 'peers' | 'mentors' | 'requests' | 'connections' | 'profile';

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

@Component({
  selector: 'app-circle-page',
  imports: [FormsModule, SearchSelectComponent, DatePipe],
  templateUrl: './circle-page.component.html',
  styleUrl: './circle-page.component.scss',
})
export class CirclePageComponent implements OnInit {
  readonly buyer = inject(BuyerAuthService);
  readonly career = inject(CareerService);
  private readonly circle = inject(CircleService);
  private readonly store = inject(StoreService);
  private readonly journeys = inject(JourneyService);
  private readonly route = inject(ActivatedRoute);

  readonly tags = CIRCLE_TAGS;
  readonly tab = signal<CircleTab>('peers');
  readonly profile = signal<PathProfile | null>(null);
  readonly peers = signal<PathPeerCard[]>([]);
  readonly mentors = signal<PathPeerCard[]>([]);
  readonly requests = signal<PathConnectRequest[]>([]);
  readonly connections = signal<PathConnection[]>([]);
  readonly chatConnection = signal<PathConnection | null>(null);
  readonly chatMessages = signal<PathMessage[]>([]);
  chatDraft = '';
  readonly chatBusy = signal(false);
  readonly subscriptionBusy = signal(false);
  readonly busy = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly inviteHint = signal<PathProfile | null>(null);
  readonly reportTarget = signal('');

  displayName = '';
  headline = '';
  city = '';
  readonly standingNodeId = signal('');
  readonly goalNodeId = signal('');
  audience = 'student';
  circleRole: 'aspirant' | 'guide' = 'aspirant';
  bio = '';
  helpOffers: string[] = [];
  lookingFor: string[] = [];
  isDiscoverable = true;
  shareEmail = false;
  shareMobile = true;
  under18 = false;
  connectNote = '';
  reportReason = '';

  readonly startOptions = computed(() => toSearchOptions(this.career.qualifications()));
  readonly goalGroups = computed(() => {
    const from = this.standingNodeId();
    if (from) {
      return toSearchGroups(this.career.goalsAfter(from));
    }
    return toSearchGroups([...this.career.qualifications(), ...this.career.professions()]);
  });
  readonly hasProfile = computed(() => !!this.profile());
  readonly pendingIncoming = computed(() => this.requests().filter((r) => r.direction === 'incoming').length);

  ngOnInit(): void {
    const goal = this.route.snapshot.queryParamMap.get('goal') || '';
    const ref = this.route.snapshot.queryParamMap.get('ref') || '';
    if (goal) {
      this.goalNodeId.set(goal);
    }
    if (ref) {
      this.circle.invite(ref).subscribe((invite) => {
        if (invite) {
          this.inviteHint.set(invite);
          if (!this.goalNodeId()) {
            this.goalNodeId.set(invite.goalNodeId);
          }
          if (!this.standingNodeId()) {
            this.standingNodeId.set(invite.standingNodeId);
          }
        }
      });
    }
    this.prefillFromMyPath();
    if (this.buyer.isLoggedIn()) {
      this.reloadAll();
    }
  }

  openLogin(): void {
    this.buyer.requestAccount('login');
  }

  openRegister(): void {
    this.buyer.requestAccount('register');
  }

  setTab(tab: CircleTab): void {
    this.tab.set(tab);
    this.error.set('');
    this.notice.set('');
    if (tab === 'mentors' && this.buyer.subscriptionActive()) {
      this.loadMentors();
    }
    if (tab === 'connections') {
      this.chatConnection.set(null);
      this.chatMessages.set([]);
    }
  }

  toggleTag(list: 'help' | 'looking', id: string): void {
    const current = list === 'help' ? [...this.helpOffers] : [...this.lookingFor];
    const idx = current.indexOf(id);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else if (current.length < 6) {
      current.push(id);
    }
    if (list === 'help') {
      this.helpOffers = current;
    } else {
      this.lookingFor = current;
    }
  }

  hasTag(list: 'help' | 'looking', id: string): boolean {
    return (list === 'help' ? this.helpOffers : this.lookingFor).includes(id);
  }

  saveProfile(): void {
    if (!this.buyer.isLoggedIn()) {
      this.openRegister();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.circle
      .saveProfile({
        displayName: this.displayName.trim(),
        headline: this.headline.trim(),
        city: this.city.trim(),
        standingNodeId: this.standingNodeId(),
        goalNodeId: this.goalNodeId(),
        audience: this.audience,
        circleRole: this.circleRole,
        bio: this.bio.trim(),
        helpOffers: this.helpOffers,
        lookingFor: this.lookingFor,
        isDiscoverable: this.isDiscoverable,
        shareEmail: this.shareEmail,
        shareMobile: this.shareMobile,
        under18: this.under18,
      })
      .subscribe({
        next: (profile) => {
          this.saving.set(false);
          this.applyProfile(profile);
          this.notice.set('Path Circle profile saved. You can meet peers on this goal now.');
          this.tab.set('peers');
          this.loadPeers();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(this.circle.errorMessage(err, 'Could not save your profile.'));
        },
      });
  }

  reloadAll(): void {
    this.busy.set(true);
    this.error.set('');
    this.circle.myProfile().subscribe({
      next: (profile) => {
        this.busy.set(false);
        if (profile) {
          this.applyProfile(profile);
          this.loadPeers();
          this.loadMentors();
          this.loadRequests();
          this.loadConnections();
          this.refreshSubscription();
        } else {
          this.profile.set(null);
          this.tab.set('profile');
          this.prefillFromMyPath();
        }
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(this.circle.errorMessage(err, 'Could not load Path Circle.'));
      },
    });
  }

  loadPeers(): void {
    const profile = this.profile();
    if (!profile) {
      return;
    }
    this.circle.peers(profile.goalNodeId, profile.standingNodeId).subscribe({
      next: (peers) => this.peers.set(peers),
      error: (err) => this.error.set(this.circle.errorMessage(err, 'Could not load peers.')),
    });
  }

  loadMentors(): void {
    const profile = this.profile();
    if (!profile) {
      return;
    }
    if (!this.buyer.subscriptionActive()) {
      this.mentors.set([]);
      return;
    }
    this.circle.peers(profile.goalNodeId, profile.standingNodeId, true).subscribe({
      next: (rows) => this.mentors.set(rows),
      error: (err: HttpErrorResponse) => {
        if (err.status === 402) {
          this.buyer.setSubscription(false);
          this.mentors.set([]);
          this.error.set(this.circle.errorMessage(err, 'Subscribe to see mentors.'));
          return;
        }
        this.error.set(this.circle.errorMessage(err, 'Could not load mentors.'));
      },
    });
  }

  refreshSubscription(): void {
    if (!this.buyer.isLoggedIn()) {
      return;
    }
    this.store.subscription().subscribe({
      next: (sub) => this.buyer.setSubscription(sub.active, sub.periodEndUtc ?? null),
      error: () => undefined,
    });
  }

  subscribeMentors(): void {
    this.error.set('');
    this.subscriptionBusy.set(true);
    this.store.createSubscriptionOrder().subscribe({
      next: (order) => this.openSubscriptionCheckout(order),
      error: (err: HttpErrorResponse) => {
        this.subscriptionBusy.set(false);
        this.error.set(this.circle.errorMessage(err, 'Could not start subscription checkout.'));
      },
    });
  }

  private openSubscriptionCheckout(order: StoreOrder): void {
    const Razorpay = window.Razorpay as typeof window.Razorpay;
    if (!Razorpay) {
      this.subscriptionBusy.set(false);
      this.error.set('Razorpay checkout did not load. Refresh and try again.');
      return;
    }
    const checkout = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: order.testMode ? 'AgamiPatha Path Circle (Test)' : 'AgamiPatha Path Circle',
      description: order.productTitle,
      order_id: order.orderId,
      theme: { color: '#1A3D7C' },
      handler: (response) => this.confirmSubscription(response),
      modal: { ondismiss: () => this.subscriptionBusy.set(false) },
    });
    checkout.on('payment.failed', (response) => {
      this.subscriptionBusy.set(false);
      this.error.set(response.error?.description || 'Payment failed.');
    });
    checkout.open();
  }

  private confirmSubscription(response: RazorpaySuccess): void {
    this.store
      .verifySubscription(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature)
      .subscribe({
        next: (result) => {
          this.subscriptionBusy.set(false);
          this.buyer.setSubscription(result.subscriptionActive, result.periodEndUtc ?? null);
          this.notice.set('Subscription active. You can connect with mentors and chat.');
          this.loadMentors();
          this.tab.set('mentors');
        },
        error: (err: HttpErrorResponse) => {
          this.subscriptionBusy.set(false);
          this.error.set(this.circle.errorMessage(err, 'Payment succeeded but verification failed.'));
        },
      });
  }

  openChat(connection: PathConnection): void {
    this.chatConnection.set(connection);
    this.chatDraft = '';
    this.chatBusy.set(true);
    this.circle.messages(connection.buyerId).subscribe({
      next: (rows) => {
        this.chatMessages.set(rows);
        this.chatBusy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.chatBusy.set(false);
        this.error.set(this.circle.errorMessage(err, 'Could not load messages.'));
      },
    });
  }

  sendChat(): void {
    const connection = this.chatConnection();
    const body = this.chatDraft.trim();
    if (!connection || !body) {
      return;
    }
    this.chatBusy.set(true);
    this.circle.sendMessage(connection.buyerId, body).subscribe({
      next: (msg) => {
        this.chatMessages.update((rows) => [...rows, msg]);
        this.chatDraft = '';
        this.chatBusy.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.chatBusy.set(false);
        this.error.set(this.circle.errorMessage(err, 'Could not send message.'));
      },
    });
  }

  loadRequests(): void {
    this.circle.requests().subscribe({
      next: (rows) => this.requests.set(rows),
      error: () => undefined,
    });
  }

  loadConnections(): void {
    this.circle.connections().subscribe({
      next: (rows) => this.connections.set(rows),
      error: () => undefined,
    });
  }

  requestConnect(peer: PathPeerCard): void {
    this.error.set('');
    this.circle.connect(peer.buyerId, this.connectNote.trim() || undefined).subscribe({
      next: () => {
        this.notice.set(`Request sent to ${peer.displayName}.`);
        this.connectNote = '';
        this.loadPeers();
        this.loadRequests();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 402) {
          this.error.set(this.circle.errorMessage(err, 'Subscribe to connect.'));
          this.tab.set('mentors');
          return;
        }
        this.error.set(this.circle.errorMessage(err, 'Could not send request.'));
      },
    });
  }

  accept(req: PathConnectRequest): void {
    this.circle.accept(req.id).subscribe({
      next: () => {
        this.notice.set(`You are connected with ${req.otherDisplayName}.`);
        this.loadRequests();
        this.loadConnections();
        this.loadPeers();
        this.tab.set('connections');
      },
      error: (err) => this.error.set(this.circle.errorMessage(err, 'Could not accept.')),
    });
  }

  decline(req: PathConnectRequest): void {
    this.circle.decline(req.id).subscribe({
      next: () => {
        this.loadRequests();
        this.loadPeers();
      },
      error: (err) => this.error.set(this.circle.errorMessage(err, 'Could not decline.')),
    });
  }

  block(buyerId: string, name: string): void {
    if (!confirm(`Block ${name}? They will leave your circle.`)) {
      return;
    }
    this.circle.block(buyerId).subscribe({
      next: () => {
        this.notice.set(`${name} was blocked.`);
        this.loadPeers();
        this.loadRequests();
        this.loadConnections();
      },
      error: (err) => this.error.set(this.circle.errorMessage(err, 'Could not block.')),
    });
  }

  openReport(buyerId: string): void {
    this.reportTarget.set(buyerId);
    this.reportReason = '';
  }

  submitReport(): void {
    const target = this.reportTarget();
    const reason = this.reportReason.trim();
    if (!target) {
      return;
    }
    this.circle.report(target, reason).subscribe({
      next: () => {
        this.notice.set('Report sent. Thank you.');
        this.reportTarget.set('');
        this.reportReason = '';
      },
      error: (err) => this.error.set(this.circle.errorMessage(err, 'Could not send report.')),
    });
  }

  inviteLink(): string {
    const profile = this.profile();
    if (!profile) {
      return '';
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/circle?goal=${encodeURIComponent(profile.goalNodeId)}&ref=${encodeURIComponent(profile.inviteCode)}`;
  }

  copyInvite(): void {
    const link = this.inviteLink();
    if (!link) {
      return;
    }
    void navigator.clipboard.writeText(link).then(() => {
      this.notice.set('Invite link copied.');
    });
  }

  tagLabel(id: string): string {
    return this.circle.tagLabel(id);
  }

  private applyProfile(profile: PathProfile): void {
    this.profile.set(profile);
    this.displayName = profile.displayName;
    this.headline = profile.headline;
    this.city = profile.city || '';
    this.standingNodeId.set(profile.standingNodeId);
    this.goalNodeId.set(profile.goalNodeId);
    this.audience = profile.audience === 'guardian' ? 'parent' : profile.audience;
    this.circleRole = profile.circleRole === 'guide' ? 'guide' : 'aspirant';
    this.bio = profile.bio;
    this.helpOffers = [...profile.helpOffers];
    this.lookingFor = [...profile.lookingFor];
    this.isDiscoverable = profile.isDiscoverable;
    this.shareEmail = profile.shareEmail;
    this.shareMobile = profile.shareMobile;
    this.under18 = profile.under18;
  }

  private prefillFromMyPath(): void {
    const trip = this.journeys.myPath() || this.journeys.saved();
    if (trip) {
      if (!this.standingNodeId()) {
        this.standingNodeId.set(trip.fromId);
      }
      if (!this.goalNodeId()) {
        this.goalNodeId.set(trip.toId);
      }
    }
    if (!this.displayName && this.buyer.name()) {
      this.displayName = this.buyer.firstName();
    }
  }
}
