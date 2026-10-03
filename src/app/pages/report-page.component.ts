import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { downloadCareerReportPdf } from '../career-report-pdf';
import { BuyerAuthService } from '../buyer-auth.service';
import { CareerService } from '../career.service';
import {
  SearchSelectComponent,
  toSearchGroups,
  toSearchOptions,
} from '../components/search-select.component';
import { JourneyService } from '../journey.service';
import {
  CareerReport,
  CareerReportVoice,
  ReportService,
} from '../report.service';
import { AiCreditPack, StoreOrder, StoreService } from '../store.service';

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

@Component({
  selector: 'app-report-page',
  imports: [FormsModule, RouterLink, SearchSelectComponent, DatePipe],
  templateUrl: './report-page.component.html',
  styleUrl: './report-page.component.scss',
})
export class ReportPageComponent implements OnInit {
  readonly buyer = inject(BuyerAuthService);
  readonly career = inject(CareerService);
  private readonly reports = inject(ReportService);
  private readonly store = inject(StoreService);
  private readonly journeys = inject(JourneyService);
  private readonly route = inject(ActivatedRoute);

  readonly fromId = signal('');
  readonly toId = signal('');
  readonly via = signal('');
  voice: CareerReportVoice = 'student';

  readonly loading = signal(false);
  readonly subscriptionBusy = signal(false);
  readonly creditBusy = signal(false);
  readonly creditPacks = signal<AiCreditPack[]>([]);
  readonly reportCostCredits = signal(1);
  readonly pdfBusy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly report = signal<CareerReport | null>(null);
  readonly needsAiTopUp = signal(false);
  readonly subscriptionActive = signal(false);

  readonly canGenerate = computed(() => this.fromId().trim().length > 0 && this.toId().trim().length > 0);
  readonly routeLabel = computed(() => {
    const from = this.career.getNode(this.fromId());
    const to = this.career.getNode(this.toId());
    if (!from || !to) {
      return '';
    }
    return `${from.title} → ${to.title}`;
  });

  readonly startOptions = computed(() => toSearchOptions(this.career.qualifications()));
  readonly goalGroups = computed(() => {
    const from = this.fromId();
    if (from) {
      return toSearchGroups(this.career.goalsAfter(from));
    }
    return toSearchGroups([...this.career.qualifications(), ...this.career.professions()]);
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((q) => {
      const from = q.get('from') ?? '';
      const to = q.get('to') ?? '';
      const via = q.get('via') ?? '';
      const voice = q.get('voice') as CareerReportVoice | null;
      if (from) {
        this.fromId.set(from);
      }
      if (to) {
        this.toId.set(to);
      }
      if (via) {
        this.via.set(via);
      }
      if (voice === 'parent' || voice === 'explore' || voice === 'student') {
        this.voice = voice;
      }
      this.prefillFromJourney();
    });

    if (this.buyer.isLoggedIn()) {
      this.refreshStatus();
    }
  }

  openLogin(): void {
    this.buyer.requestAccount('login');
  }

  openRegister(): void {
    this.buyer.requestAccount('register');
  }

  refreshStatus(): void {
    this.reports.status().subscribe({
      next: (s) => {
        this.subscriptionActive.set(s.subscriptionActive);
        this.buyer.setSubscription(s.subscriptionActive, s.periodEndUtc ?? null);
        this.buyer.setAiCredits(s.aiCredits);
        this.reportCostCredits.set(s.reportCostCredits);
        if (!this.fromId() && s.standingNodeId) {
          this.fromId.set(s.standingNodeId);
        }
        if (!this.toId() && s.goalNodeId) {
          this.toId.set(s.goalNodeId);
        }
      },
      error: () => undefined,
    });
    this.store.subscription().subscribe({
      next: (sub) => {
        this.subscriptionActive.set(sub.active);
        this.buyer.setSubscription(sub.active, sub.periodEndUtc ?? null);
      },
      error: () => undefined,
    });
    this.store.getCredits().subscribe({
      next: (c) => {
        this.buyer.setAiCredits(c.balance);
        this.reportCostCredits.set(c.reportCostCredits);
        this.creditPacks.set(c.packs);
      },
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
        this.error.set(this.reports.errorMessage(err, 'Could not start subscription checkout.'));
      },
    });
  }

  generate(): void {
    if (!this.buyer.isLoggedIn()) {
      this.openLogin();
      return;
    }
    if (!this.canGenerate()) {
      this.error.set('Choose where you stand today and the career you are aiming for.');
      return;
    }
    this.error.set('');
    this.notice.set('');
    this.loading.set(true);
    this.report.set(null);
    this.needsAiTopUp.set(false);
    this.reports
      .generate({
        fromId: this.fromId(),
        toId: this.toId(),
        via: this.via() || undefined,
        voice: this.voice,
      })
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.loading.set(false);
          this.buyer.setAiCredits(r.creditsRemaining);
          this.needsAiTopUp.set(r.needsAiTopUp);
          if (r.ai.usedAi) {
            this.notice.set(
              r.creditsCharged > 0
                ? `Report generated with AI narrative (${r.creditsCharged} credit used). ${r.creditsRemaining} credit(s) left.`
                : 'Report generated with AI narrative.',
            );
          } else if (r.needsAiTopUp) {
            this.notice.set('Report generated from catalogue facts. Top up AI credits for a personalised LLM narrative.');
          } else {
            this.notice.set('Report generated from catalogue facts.');
          }
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          if (err.status === 402) {
            this.subscriptionActive.set(false);
            this.buyer.setSubscription(false, null);
          }
          this.error.set(this.reports.errorMessage(err, 'Could not generate report.'));
        },
      });
  }

  async downloadPdf(): Promise<void> {
    const r = this.report();
    if (!r || this.pdfBusy()) {
      return;
    }
    this.pdfBusy.set(true);
    try {
      await downloadCareerReportPdf(r);
    } finally {
      this.pdfBusy.set(false);
    }
  }

  private prefillFromJourney(): void {
    const trip = this.journeys.myPath() || this.journeys.saved();
    if (!trip) {
      return;
    }
    if (!this.fromId()) {
      this.fromId.set(trip.fromId);
    }
    if (!this.toId()) {
      this.toId.set(trip.toId);
    }
    if (!this.via() && trip.via) {
      this.via.set(trip.via);
    }
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
          this.subscriptionActive.set(result.subscriptionActive);
          this.buyer.setSubscription(result.subscriptionActive, result.periodEndUtc ?? null);
          if (result.aiCredits !== undefined) {
            this.buyer.setAiCredits(result.aiCredits);
          }
          this.notice.set(
            'Subscription active. You can generate career reports; each AI narrative uses 1 credit (5 bonus credits included with this payment).',
          );
        },
        error: (err: HttpErrorResponse) => {
          this.subscriptionBusy.set(false);
          this.error.set(this.reports.errorMessage(err, 'Payment succeeded but verification failed.'));
        },
      });
  }

  buyCredits(pack: AiCreditPack): void {
    this.error.set('');
    this.creditBusy.set(true);
    this.store.createCreditOrder(pack.id).subscribe({
      next: (order) => this.openCreditCheckout(order, pack.label),
      error: (err: HttpErrorResponse) => {
        this.creditBusy.set(false);
        this.error.set(this.reports.errorMessage(err, 'Could not start credit checkout.'));
      },
    });
  }

  private openCreditCheckout(order: StoreOrder, label: string): void {
    const Razorpay = window.Razorpay as typeof window.Razorpay;
    if (!Razorpay) {
      this.creditBusy.set(false);
      this.error.set('Razorpay checkout did not load. Refresh and try again.');
      return;
    }
    const checkout = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: order.testMode ? 'AgamiPatha AI credits (Test)' : 'AgamiPatha AI credits',
      description: label || order.productTitle,
      order_id: order.orderId,
      theme: { color: '#1A3D7C' },
      handler: (response) => this.confirmCreditPurchase(response),
      modal: { ondismiss: () => this.creditBusy.set(false) },
    });
    checkout.on('payment.failed', (response) => {
      this.creditBusy.set(false);
      this.error.set(response.error?.description || 'Payment failed.');
    });
    checkout.open();
  }

  private confirmCreditPurchase(response: RazorpaySuccess): void {
    this.store
      .verifyCreditOrder(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature)
      .subscribe({
        next: (result) => {
          this.creditBusy.set(false);
          this.buyer.setAiCredits(result.aiCredits);
          this.needsAiTopUp.set(false);
          this.notice.set(
            result.creditsAdded > 0
              ? `Added ${result.creditsAdded} AI credits. Balance: ${result.aiCredits}.`
              : `AI credit balance: ${result.aiCredits}.`,
          );
        },
        error: (err: HttpErrorResponse) => {
          this.creditBusy.set(false);
          this.error.set(this.reports.errorMessage(err, 'Payment succeeded but verification failed.'));
        },
      });
  }
}
