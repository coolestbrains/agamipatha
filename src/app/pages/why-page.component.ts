import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

const REASONS = [
  {
    title: 'Self-serve from where you stand',
    detail:
      'Class 10, a 12th stream, a degree, or a working standing — you guide yourself. We only open doors after your current qualification.',
  },
  {
    title: 'Built for students and professionals',
    detail:
      'Plan a first career, a postgraduate door, or a clean switch. Same map, with a voice that fits who is reading it — including parents guiding alongside.',
  },
  {
    title: 'Draws a real Indian career path',
    detail: 'Exams, courses, hops, and years from where you are to the career you name — without waiting for a counsellor slot.',
  },
  {
    title: 'Honest about effort and cost',
    detail: 'Typical fees, gates, and time so you can decide with eyes open before you pay or apply.',
  },
  {
    title: 'Go deeper when you need to',
    detail: 'Browse every goal from a standing, compare options, save paths, and track progress on a timeline.',
  },
] as const;

@Component({
  selector: 'app-why-page',
  imports: [RouterLink],
  templateUrl: './why-page.component.html',
  styleUrl: './why-page.component.scss',
})
export class WhyPageComponent {
  readonly reasons = REASONS;
}
