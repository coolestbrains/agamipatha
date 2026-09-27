import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ParentBrief } from '../parent-brief';

@Component({
  selector: 'app-parent-brief',
  imports: [RouterLink],
  templateUrl: './parent-brief.component.html',
  styleUrl: './parent-brief.component.scss',
})
export class ParentBriefComponent {
  readonly brief = input.required<ParentBrief>();
}
