import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

const REASONS = [
  {
    title: 'Starts from where you stand',
    detail:
      'Class 10, a 12th stream, or a degree — we only open doors after your current qualification, not a random career list.',
  },
  {
    title: 'Draws a real Indian education path',
    detail: 'Exams, courses, hops, and years from where you are to the career you name.',
  },
  {
    title: 'Honest about effort and cost',
    detail: 'Typical fees, gates, and time so families can decide with eyes open.',
  },
  {
    title: 'Built for student, parent, and mentor',
    detail: 'Same map, with a voice that fits who is reading it.',
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
