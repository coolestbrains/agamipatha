import { Component, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../environment';

const TOPICS = [
  {
    title: 'For students — stream, entrance, and first career',
    detail:
      'Class 10 and Class 12 choices lock doors. AgamiPatha shows which Indian careers open from PCM, PCB, Commerce, or Arts, and which exams sit on the road — so you guide yourself before forms close.',
  },
  {
    title: 'For professionals — next role, PG, or a clean switch',
    detail:
      'Already graduated or working? Set your current degree or standing and a target profession. See conversion routes, licence gates, postgraduate doors, years, and typical cost without booking a session.',
  },
  {
    title: 'Self-serve, not a personality quiz',
    detail:
      'No counsellor calendar and no vague aptitude score. You pick who the guide is for, where you stand, and the career you want. AgamiPatha maps the Indian education and career hops between them.',
  },
  {
    title: 'Parents can guide alongside',
    detail:
      'Use Parent mode when you are helping a student. Same self-serve map — standing, goal, exams, and cost — written so the family can decide with eyes open.',
  },
] as const;

const FAQS = [
  {
    q: 'Is AgamiPatha a self-serve career guide?',
    a: 'Yes. Students and professionals use it on their own: choose who it is for, the qualification already held, and a career goal. AgamiPatha maps exams, years, and typical cost on Indian routes — no appointment needed.',
  },
  {
    q: 'Can working professionals use AgamiPatha?',
    a: 'Yes. Choose Professional mode, set your current degree or standing, and name the next role or qualification. The guide shows mapped hops, conversion paths, and gates that still apply in India.',
  },
  {
    q: 'How do I find a career path after Class 10 in India?',
    a: 'Set Class 10 (Metric) as your standing and choose a profession or later qualification. AgamiPatha maps streams, exams, and years that typically follow — so you plan the fork before Class 11.',
  },
  {
    q: 'How can I plan a career after Class 12?',
    a: 'Select your completed Class 12 stream as the start and the job or degree you want as the goal. AgamiPatha draws entrance exams, courses, and typical duration for that Indian education route.',
  },
  {
    q: 'Is this the same as career counselling?',
    a: 'It is a self-serve path guide, not a one-to-one counselling session. It does not score personality. It maps qualifications, professions, exams, years, and cost from where you stand to a career you can name.',
  },
  {
    q: 'Can parents use AgamiPatha with a student?',
    a: 'Yes. Choose Parent mode so the path is written for your child — standing, goal, exams, and cost — then open the same map together.',
  },
] as const;

@Component({
  selector: 'app-careers-page',
  imports: [RouterLink],
  templateUrl: './careers-page.component.html',
  styleUrl: './careers-page.component.scss',
})
export class CareersPageComponent implements OnDestroy {
  readonly topics = TOPICS;
  readonly faqs = FAQS;
  private readonly faqScriptId = 'agamipatha-careers-faq-jsonld';

  constructor() {
    this.installFaqSchema();
  }

  ngOnDestroy(): void {
    document.getElementById(this.faqScriptId)?.remove();
  }

  private installFaqSchema(): void {
    document.getElementById(this.faqScriptId)?.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = this.faqScriptId;
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
      url: `${environment.siteUrl.replace(/\/$/, '')}/careers`,
    });
    document.head.appendChild(script);
  }
}
