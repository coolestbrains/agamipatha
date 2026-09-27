import { Component, input } from '@angular/core';
import { PathGuide } from '../path-guide';

@Component({
  selector: 'app-path-guide-view',
  templateUrl: './path-guide-view.component.html',
  styleUrl: './path-guide-view.component.scss',
})
export class PathGuideViewComponent {
  readonly guide = input.required<PathGuide>();
}
