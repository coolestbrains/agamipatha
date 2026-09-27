import { Component, input } from '@angular/core';
import { CalendarEvent, CalendarMonth, PathCalendar } from '../path-calendar';

@Component({
  selector: 'app-path-calendar',
  templateUrl: './path-calendar.component.html',
  styleUrl: './path-calendar.component.scss',
})
export class PathCalendarComponent {
  readonly calendar = input.required<PathCalendar>();

  startsHere(item: CalendarEvent, month: CalendarMonth): boolean {
    return item.months[0] === month.month && item.years[0] === month.year;
  }
}
