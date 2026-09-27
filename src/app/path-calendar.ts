import { CareerNode, CareerPathResult, NodeKind } from './models/career.model';

export type CalendarKind = 'form' | 'board' | 'entrance' | 'counselling' | 'campus';

export interface CalendarEvent {
  kind: CalendarKind;
  kindLabel: string;
  months: number[];
  years: number[];
  when: string;
  title: string;
  detail: string;
  status: 'past' | 'now' | 'next';
}

type EventDraft = Omit<CalendarEvent, 'when' | 'status' | 'years' | 'kindLabel'> & {
  anchor?: 'next' | 'academic' | 'allotment';
};

export interface CalendarMonth {
  month: number;
  year: number;
  short: string;
  label: string;
  current: boolean;
  count: number;
  items: CalendarEvent[];
}

export interface PathCalendar {
  yearLabel: string;
  todayLabel: string;
  spine: string;
  months: CalendarMonth[];
  nowItems: CalendarEvent[];
  groups: { kind: CalendarKind; heading: string; items: CalendarEvent[] }[];
  events: CalendarEvent[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const KIND_LABELS: Record<CalendarKind, string> = {
  form: 'Form',
  board: 'Board',
  entrance: 'Paper',
  counselling: 'Counselling',
  campus: 'Campus',
};

const GROUP_HEADINGS: Record<CalendarKind, string> = {
  form: 'Form windows',
  board: 'Board / entrance months',
  entrance: 'Board / entrance months',
  counselling: 'Counselling season',
  campus: 'Hostel / attendance (first year)',
};

interface WindowSpec {
  test: (hay: string) => boolean;
  events: EventDraft[];
}

const WINDOWS: WindowSpec[] = [
  {
    test: (hay) => /jee main|jee \/ cet|jee\/cet/.test(hay) && !/paper 2/.test(hay),
    events: [
      {
        kind: 'form',
        months: [10, 11],
        title: 'JEE Main Session 1 form',
        detail: 'NTA application typically opens Oct–Nov. Photo, Aadhaar, and Class 12 details ready.',
      },
      {
        kind: 'entrance',
        months: [1],
        title: 'JEE Main Session 1',
        detail: 'Computer-based paper. January window in recent cycles.',
      },
      {
        kind: 'form',
        months: [2],
        title: 'JEE Main Session 2 form',
        detail: 'Session 2 registration and corrections typically February.',
      },
      {
        kind: 'entrance',
        months: [4],
        title: 'JEE Main Session 2',
        detail: 'April window. The better of two sessions usually counts.',
      },
      {
        kind: 'counselling',
        months: [6, 7],
        title: 'JoSAA / CSAB / state counselling',
        detail: 'Choice filling after ranks. State CETs run a parallel seat round.',
      },
    ],
  },
  {
    test: (hay) => /jee/.test(hay) && /advanc/.test(hay),
    events: [
      {
        kind: 'form',
        months: [4, 5],
        title: 'JEE Advanced form',
        detail: 'Only if you clear the JEE Main cutoff. Registration typically April–May.',
      },
      {
        kind: 'entrance',
        months: [5, 6],
        title: 'JEE Advanced',
        detail: 'Two papers, same day. Usually late May or early June.',
      },
    ],
  },
  {
    test: (hay) => /neet/.test(hay) && !/neet-pg|neet pg|ini-?cet/.test(hay),
    events: [
      {
        kind: 'form',
        months: [2, 3],
        title: 'NEET-UG form',
        detail: 'NTA form typically Feb–Mar. Medical, photo, and Class 12 PCB details.',
      },
      {
        kind: 'entrance',
        months: [5],
        title: 'NEET-UG paper',
        detail: 'Pen-and-paper, usually the first Sunday of May.',
      },
      {
        kind: 'counselling',
        months: [6, 7, 8, 9],
        title: 'MCC / state medical counselling',
        detail: 'AIQ then state rounds. Keep a parallel plan through later rounds.',
      },
    ],
  },
  {
    test: (hay) => /\bcuet\b/.test(hay),
    events: [
      {
        kind: 'form',
        months: [2, 3],
        title: 'CUET-UG form',
        detail: 'Subject list must match the university you actually want.',
      },
      {
        kind: 'entrance',
        months: [5, 6],
        title: 'CUET-UG',
        detail: 'Computer-based papers, typically May–June.',
      },
      {
        kind: 'counselling',
        months: [6, 7, 8],
        title: 'CUET university admissions',
        detail: 'Each central/state university runs its own portal after scores.',
      },
    ],
  },
  {
    test: (hay) => /\bclat\b/.test(hay),
    events: [
      {
        kind: 'form',
        months: [7, 8, 9, 10],
        title: 'CLAT form',
        detail: 'Consortium form typically opens in July and runs into autumn.',
      },
      {
        kind: 'entrance',
        months: [12],
        title: 'CLAT',
        detail: 'Usually the first or second Sunday of December.',
      },
      {
        kind: 'counselling',
        months: [12, 1],
        title: 'NLU counselling',
        detail: 'Choice filling starts after the result. Five-year law seats move fast.',
      },
    ],
  },
  {
    test: (hay) => /\bnda\b/.test(hay),
    events: [
      {
        kind: 'form',
        months: [12, 1],
        title: 'NDA-I form (UPSC)',
        detail: 'UPSC typically opens NDA-I in December–January.',
      },
      {
        kind: 'entrance',
        months: [4],
        title: 'NDA-I written',
        detail: 'April paper, then SSB if you clear it.',
      },
      {
        kind: 'form',
        months: [5, 6],
        title: 'NDA-II form (UPSC)',
        detail: 'Second cycle typically May–June.',
      },
      {
        kind: 'entrance',
        months: [9],
        title: 'NDA-II written',
        detail: 'September paper. Age and unmarried-status rules are strict.',
      },
      {
        kind: 'counselling',
        months: [6, 7, 8],
        title: 'SSB and medicals after NDA-I',
        detail: 'SSB is a five-day gate, not a counselling portal. Academy joining follows the merit list.',
      },
      {
        kind: 'counselling',
        months: [1, 2, 3],
        title: 'SSB and medicals after NDA-II',
        detail: 'Winter SSB cycle after the September paper. Age and unmarried-status rules are strict.',
      },
    ],
  },
  {
    test: (hay) => /\bgate\b/.test(hay),
    events: [
      {
        kind: 'form',
        months: [8, 9, 10],
        title: 'GATE form',
        detail: 'Paper code is the application. Typically Aug–Oct.',
      },
      {
        kind: 'entrance',
        months: [2],
        title: 'GATE',
        detail: 'February weekend papers.',
      },
      {
        kind: 'counselling',
        months: [3, 4, 5],
        title: 'COAP / CCMT / PSU interviews',
        detail: 'M.Tech seats and many PSU shortlists use GATE scores.',
      },
    ],
  },
  {
    test: (hay) => /\bcat\b/.test(hay) && /mba|iim|management|common admission/.test(hay),
    events: [
      {
        kind: 'form',
        months: [8],
        title: 'CAT form',
        detail: 'IIM CAT typically opens in August.',
      },
      {
        kind: 'entrance',
        months: [11],
        title: 'CAT',
        detail: 'Last Sunday of November in recent years.',
      },
      {
        kind: 'counselling',
        months: [1, 2, 3],
        title: 'WAT / PI calls',
        detail: 'Calls through winter. CAP and individual IIMs run on their own calendars.',
      },
    ],
  },
  {
    test: (hay) => /ca foundation|ca-foundation/.test(hay),
    events: [
      {
        kind: 'form',
        months: [2, 8],
        title: 'CA Foundation exam form',
        detail: 'ICAI runs May/June and November/December attempts. Forms close about two months prior.',
      },
      {
        kind: 'entrance',
        months: [5, 6, 11, 12],
        title: 'CA Foundation papers',
        detail: 'Four papers. Register with ICAI well before the form window.',
      },
    ],
  },
  {
    test: (hay) => /\bbitsat\b/.test(hay),
    events: [
      {
        kind: 'form',
        months: [1, 2, 3, 4],
        title: 'BITSAT form',
        detail: 'BITS application typically January–April.',
      },
      {
        kind: 'entrance',
        months: [5, 6],
        title: 'BITSAT',
        detail: 'Computer-based slots in May–June.',
      },
    ],
  },
  {
    test: (hay) => /\bnata\b/.test(hay),
    events: [
      {
        kind: 'form',
        months: [2, 3],
        title: 'NATA form',
        detail: 'Council of Architecture. Multiple tests in a cycle.',
      },
      {
        kind: 'entrance',
        months: [4, 5, 6, 7],
        title: 'NATA attempts',
        detail: 'Book a slot. JEE Main Paper 2 is the parallel architecture paper.',
      },
    ],
  },
  {
    test: (hay) => /\bcds\b/.test(hay),
    events: [
      {
        kind: 'form',
        months: [12, 5],
        title: 'CDS form (UPSC)',
        detail: 'Two cycles a year. Graduation timing must match the course you want.',
      },
      {
        kind: 'entrance',
        months: [2, 9],
        title: 'CDS written',
        detail: 'February and September papers, then SSB.',
      },
    ],
  },
  {
    test: (hay) => /civil service|upsc cse|\bias\b/.test(hay) && !/\bnda\b|\bcds\b/.test(hay),
    events: [
      {
        kind: 'form',
        months: [2],
        title: 'UPSC CSE form',
        detail: 'Notification typically February. Prelims is a one-day filter.',
      },
      {
        kind: 'entrance',
        months: [5, 6],
        title: 'UPSC Prelims',
        detail: 'Usually May–June.',
      },
      {
        kind: 'entrance',
        months: [9],
        title: 'UPSC Mains',
        detail: 'September written, interviews the following winter.',
      },
    ],
  },
];

export function buildPathCalendar(path: CareerPathResult, from?: CareerNode | null, now = new Date()): PathCalendar {
  const hay = haystack(path);
  const yearLabel = academicYearLabel(now);
  const specs = WINDOWS.filter((window) => window.test(hay)).flatMap((window) => window.events);
  const extra = [
    ...boardEvents(path, hay),
    ...genericCounselling(path, hay, specs),
    ...campusEvents(path, from, now),
  ];
  const events = uniqueEvents([...specs, ...extra]).map((event) => decorate(event, now));
  events.sort((a, b) => a.years[0]! * 12 + a.months[0]! - (b.years[0]! * 12 + b.months[0]!) || a.title.localeCompare(b.title));

  const months = academicMonths(now).map((slot) => {
    const items = events.filter((event) =>
      event.months.some((month, i) => month === slot.month && event.years[i] === slot.year),
    );
    return { ...slot, count: items.length, items };
  });

  return {
    yearLabel,
    todayLabel: `Today is ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
    spine: path.spine,
    months,
    nowItems: events.filter((event) => event.status === 'now'),
    groups: [
      { kind: 'form', heading: GROUP_HEADINGS.form, items: events.filter((event) => event.kind === 'form') },
      {
        kind: 'entrance',
        heading: GROUP_HEADINGS.entrance,
        items: events.filter((event) => event.kind === 'board' || event.kind === 'entrance'),
      },
      { kind: 'counselling', heading: GROUP_HEADINGS.counselling, items: events.filter((event) => event.kind === 'counselling') },
      { kind: 'campus', heading: GROUP_HEADINGS.campus, items: events.filter((event) => event.kind === 'campus') },
    ],
    events,
  };
}

function haystack(path: CareerPathResult): string {
  return path.steps
    .flatMap((step, index) => {
      const bits = [
        step.node.id,
        step.node.title,
        step.node.shortTitle,
        step.node.field,
        step.incoming?.via ?? '',
        step.incoming?.notes ?? '',
      ];
      if (index > 0 || step.node.kind === 'entrance-exam') {
        bits.push(...(step.node.exams ?? []));
      }
      return bits;
    })
    .join(' · ')
    .toLowerCase();
}

function boardEvents(path: CareerPathResult, hay: string): EventDraft[] {
  const schoolish = path.steps.some((step) => step.node.kind === 'school' || step.node.kind === 'higher-secondary');
  if (!schoolish && !/class 12|class 10|board/.test(hay)) {
    return [];
  }
  const tenth = path.steps.some((step) => step.node.kind === 'school' || /class 10|metric/.test(step.node.title.toLowerCase()));
  const label = tenth && !path.steps.some((step) => step.node.kind === 'higher-secondary') ? 'Class 10' : 'Class 12';
  return [
    {
      kind: 'form',
      months: [10, 11],
      title: `${label} board exam form / LOC`,
      detail: 'The school files this. Missing it is not a private problem — the roll number never appears.',
    },
    {
      kind: 'board',
      months: [1],
      title: `${label} practicals / internals`,
      detail: 'Science and vocational practicals typically sit in January. Marks are not a rehearsal.',
    },
    {
      kind: 'board',
      months: [2, 3],
      title: `${label} board theory`,
      detail: 'CBSE / ISC / most state boards: February–March. State calendars can start a week earlier.',
    },
    {
      kind: 'board',
      months: [5],
      title: `${label} results`,
      detail: 'Typically May. Entrance forms often overlap — do not wait for the marksheet to start the form.',
    },
  ];
}

function genericCounselling(
  path: CareerPathResult,
  hay: string,
  already: EventDraft[],
): EventDraft[] {
  if (already.some((event) => event.kind === 'counselling')) {
    return [];
  }
  const mentions = /counselling|counseling|allotment|choice filling/.test(hay);
  const ug = path.steps.some((step) =>
    (['undergraduate', 'vocational', 'professional'] as NodeKind[]).includes(step.node.kind),
  );
  if (!mentions && !ug) {
    return [];
  }
  return [
    {
      kind: 'counselling',
      months: [6, 7, 8],
      title: 'Admission / counselling rounds',
      detail: 'Most Indian UG and diploma seat rounds run June–August. Freeze a backup before the last round.',
    },
  ];
}

function campusEvents(path: CareerPathResult, from: CareerNode | null | undefined, now: Date): EventDraft[] {
  const campus = path.steps.find((step) =>
    (['undergraduate', 'vocational', 'professional'] as NodeKind[]).includes(step.node.kind),
  );
  if (!campus) {
    return [];
  }
  const later =
    from &&
    (from.kind === 'school' || from.kind === 'higher-secondary' || from.kind === 'entrance-exam');
  const when = later ? 'after allotment' : 'this year';
  const anchor: EventDraft['anchor'] = later ? 'allotment' : 'academic';
  const defence = /defence|nda|academy/.test(`${campus.node.field} ${campus.node.title}`.toLowerCase());
  const joiningMonth = later ? [6, 7] : [7, 8];
  if (defence) {
    return [
      {
        kind: 'campus',
        months: joiningMonth,
        title: `Academy joining (${when})`,
        detail: 'Joining letter, medical, and kit list. NDA/IMA clocks are not college clocks.',
        anchor,
      },
      {
        kind: 'campus',
        months: [7, 8],
        title: 'Term-one fitness and attendance',
        detail: 'A missed parade is an attendance event. Leave is a form, not a mood.',
        anchor,
      },
    ];
  }
  const events: EventDraft[] = [];
  if (later || now.getMonth() + 1 <= 8) {
    events.push({
      kind: 'campus',
      months: [7, 8],
      title: `Hostel reporting (${when})`,
      detail: 'Anti-ragging affidavits, mess advance, ID, and gate timings. Copy the hostel notice on day one.',
      anchor,
    });
  }
  events.push(
    {
      kind: 'campus',
      months: [8, 9],
      title: 'Attendance clock (first year)',
      detail: 'Many campuses detain you below ~75%. Front-load August–September; festivals eat October.',
      anchor,
    },
    {
      kind: 'campus',
      months: [10, 11],
      title: 'Internals / mid-sem',
      detail: 'Internals are often 20–50% of the grade. Short attendance lists appear before the end-sem form.',
      anchor,
    },
    {
      kind: 'campus',
      months: [11],
      title: 'End-sem exam form',
      detail: 'If attendance is short, the form may not open. Condonation is a committee, not a right.',
      anchor,
    },
    {
      kind: 'campus',
      months: [12],
      title: 'Odd-semester end exams',
      detail: 'December papers close the first term. A backlog here is a calendar, not a personality.',
      anchor,
    },
    {
      kind: 'campus',
      months: [4, 5],
      title: 'Even-semester end exams',
      detail: 'April–May papers. First-year CGPA is the number branch-change and internships see.',
      anchor,
    },
  );
  return events;
}

function decorate(event: EventDraft, now: Date): CalendarEvent {
  const years = yearsForMonths(event.months, now, event.anchor ?? 'next');
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  const here = cy * 12 + cm;
  const stamps = event.months.map((month, i) => years[i]! * 12 + month);
  const status: CalendarEvent['status'] = stamps.some((stamp) => stamp === here)
    ? 'now'
    : stamps.every((stamp) => stamp < here)
      ? 'past'
      : 'next';
  return {
    kind: event.kind,
    kindLabel: KIND_LABELS[event.kind],
    months: event.months,
    years,
    title: event.title,
    detail: event.detail,
    when: formatWhen(event.months, years),
    status,
  };
}

function yearsForMonths(months: number[], now: Date, anchor: NonNullable<EventDraft['anchor']>): number[] {
  if (anchor === 'academic') {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const start = m >= 6 ? y : y - 1;
    return months.map((month) => (month >= 6 ? start : start + 1));
  }
  if (anchor === 'allotment') {
    const juneYear = now.getMonth() + 1 > 6 ? now.getFullYear() + 1 : now.getFullYear();
    return months.map((month) => (month >= 6 ? juneYear : juneYear + 1));
  }
  let year = yearForMonth(months[0]!, now);
  const out = [year];
  let cursor = year * 12 + months[0]!;
  for (let i = 1; i < months.length; i++) {
    let nextYear = year;
    let stamp = nextYear * 12 + months[i]!;
    while (stamp <= cursor) {
      nextYear += 1;
      stamp = nextYear * 12 + months[i]!;
    }
    out.push(nextYear);
    cursor = stamp;
    year = nextYear;
  }
  return out;
}

function formatWhen(months: number[], years: number[]): string {
  const bits = months.map((month, i) => ({ month, year: years[i]! }));
  if (isRun(bits)) {
    const a = bits[0]!;
    const b = bits[bits.length - 1]!;
    if (a.year === b.year) {
      return bits.length === 1 ? `${MONTHS[a.month - 1]} ${a.year}` : `${MONTHS[a.month - 1]}–${MONTHS[b.month - 1]} ${b.year}`;
    }
    return `${MONTHS[a.month - 1]} ${a.year} – ${MONTHS[b.month - 1]} ${b.year}`;
  }
  return bits.map((bit) => `${MONTHS[bit.month - 1]} ${bit.year}`).join(' · ');
}

function isRun(bits: { month: number; year: number }[]): boolean {
  for (let i = 1; i < bits.length; i++) {
    const prev = bits[i - 1]!;
    const next = bits[i]!;
    const prevIndex = prev.year * 12 + prev.month;
    if (next.year * 12 + next.month !== prevIndex + 1) {
      return false;
    }
  }
  return true;
}

function yearForMonth(month: number, now: Date): number {
  const current = now.getMonth() + 1;
  return month >= current ? now.getFullYear() : now.getFullYear() + 1;
}

function academicYearLabel(now: Date): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const start = m >= 6 ? y : y - 1;
  return `${start}–${String(start + 1).slice(2)}`;
}

function academicMonths(now: Date): Omit<CalendarMonth, 'count' | 'items'>[] {
  const current = now.getMonth() + 1;
  return Array.from({ length: 12 }, (_, i) => {
    const month = ((current - 1 + i) % 12) + 1;
    const year = yearForMonth(month, now);
    return {
      month,
      year,
      short: MONTHS[month - 1]!,
      label: `${MONTHS[month - 1]} ${year}`,
      current: i === 0,
    };
  });
}

function uniqueEvents(events: EventDraft[]): EventDraft[] {
  const seen = new Set<string>();
  const next: EventDraft[] = [];
  for (const event of events) {
    const key = `${event.kind}:${event.title.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(event);
  }
  return next;
}
