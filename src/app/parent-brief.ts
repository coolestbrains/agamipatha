import { CareerNode, CareerPathResult } from './models/career.model';
import { PathCalendar } from './path-calendar';
import { PathCost, formatInr } from './path-cost';
import { readAsk } from './ask-prefs';

export type ShareVoice = 'student' | 'parent' | 'explore';

export interface ParentBrief {
  voice: ShareVoice;
  brand: string;
  eyebrow: string;
  fromTitle: string;
  toTitle: string;
  spine: string;
  whatThisIs: string;
  steps: string[];
  thisYear: string;
  safetyTitle: string;
  safety: string[];
  backupTitle: string;
  backup: string[];
  moneyTitle: string;
  money: string;
  calendarTitle: string;
  firstYear: boolean;
  firstYearLead: string;
  shot: string;
}

export function readShareVoice(accountId = '', parentHint = false): ShareVoice {
  const audience = readAsk(accountId).audience ?? '';
  if (audience === 'guardian') {
    return 'parent';
  }
  if (audience === 'student') {
    return 'student';
  }
  if (audience === 'explore') {
    return 'explore';
  }
  return parentHint ? 'parent' : 'explore';
}

export function buildParentBrief(input: {
  path: CareerPathResult;
  from?: CareerNode;
  to?: CareerNode;
  cost?: PathCost | null;
  calendar?: PathCalendar | null;
  backups?: CareerNode[];
  voice: ShareVoice;
}): ParentBrief {
  const dest = input.to || input.path.steps.at(-1)?.node;
  const from = input.from || input.path.steps[0]?.node;
  const firstYear = isCollegeAudience(input.path, from);
  const next = input.calendar?.nowItems[0] || input.calendar?.events.find((event) => event.status === 'next');
  const backups = (input.backups ?? [])
    .filter((node) => node.id !== dest?.id)
    .slice(0, 3)
    .map((node) => node.shortTitle || node.title);
  const copy = VOICE[input.voice];

  return {
    voice: input.voice,
    brand: copy.brand,
    eyebrow: copy.eyebrow,
    fromTitle: from?.shortTitle || from?.title || 'Start',
    toTitle: dest?.shortTitle || dest?.title || 'Goal',
    spine: input.path.spine,
    whatThisIs: whatThisIs(dest, input.voice),
    steps: input.path.steps.map((step) => step.node.shortTitle || step.node.title),
    thisYear: next ? `${next.kindLabel}: ${next.title} (${next.when})` : 'Confirm this year’s official dates.',
    safetyTitle: copy.safetyTitle,
    safety: firstYear ? copy.collegeSafety : copy.schoolSafety,
    backupTitle: copy.backupTitle,
    backup: [
      backups.length ? copy.backupNearby(backups) : copy.backupEmpty,
      firstYear ? copy.backupCollege : copy.backupSchool,
    ],
    moneyTitle: copy.moneyTitle,
    money: moneyLine(input.cost, input.voice),
    calendarTitle: copy.calendarTitle,
    firstYear,
    firstYearLead: copy.firstYearLead,
    shot: copy.shot,
  };
}

export function parentShareCard(brief: ParentBrief): string {
  return [
    brief.brand,
    `${brief.fromTitle} → ${brief.toTitle}`,
    brief.whatThisIs,
    '',
    brief.safetyTitle,
    ...brief.safety.map((line) => `• ${line}`),
    '',
    brief.backupTitle,
    ...brief.backup.map((line) => `• ${line}`),
    '',
    brief.money,
    `This year: ${brief.thisYear}`,
  ].join('\n');
}

export function parentShareText(brief: ParentBrief, url: string): string {
  const label = brief.voice === 'parent' ? 'Calm page' : brief.voice === 'student' ? 'Your map' : 'Open the map';
  return `${parentShareCard(brief)}\n\n${label}:\n${url}`;
}

function isCollegeAudience(path: CareerPathResult, from?: CareerNode): boolean {
  if (from && (from.kind === 'undergraduate' || from.kind === 'vocational')) {
    return true;
  }
  return path.steps.some((step) => step.node.kind === 'undergraduate' || step.node.kind === 'vocational');
}

function whatThisIs(node: CareerNode | undefined, voice: ShareVoice): string {
  if (!node) {
    return voice === 'student'
      ? 'A mapped Indian education route. Confirm official rules before you or anyone at home pays.'
      : 'A mapped Indian education route. Confirm official rules before anyone pays.';
  }
  const field = node.field ? ` in ${node.field}` : '';
  const time = node.duration ? `, typically ${node.duration}` : '';
  const yours = voice === 'student';
  switch (node.kind) {
    case 'undergraduate':
      return yours
        ? `Your undergraduate course${field}${time}. A degree is a workshop, not a placement guarantee.`
        : `An undergraduate course${field}${time}. A degree is a workshop, not a placement guarantee.`;
    case 'vocational':
      return yours
        ? `Your vocational or diploma route${field}${time}. A ladder, not a lesser life.`
        : `A vocational or diploma route${field}${time}. A ladder, not a lesser life.`;
    case 'professional':
      return yours
        ? `Your professional course${field}${time}. Training and rules come with it.`
        : `A professional course${field}${time}. Training and rules come with it.`;
    case 'postgraduate':
      return yours
        ? `Your postgraduate course${field}${time}. It assumes the prior degree.`
        : `A postgraduate course${field}${time}. It assumes the prior degree.`;
    case 'entrance-exam':
      return yours
        ? `An entrance paper this year${field}. A rank is a gate to a course, not a job.`
        : `An entrance paper this year${field}. A rank is a gate to a course, not a job.`;
    case 'profession': {
      const xp =
        node.entryLevel === 'experienced' || (node.experienceYearsMin ?? 0) > 0
          ? node.experienceYearsMin && node.experienceYearsTypical && node.experienceYearsTypical !== node.experienceYearsMin
            ? ` Expect about ${node.experienceYearsMin}–${node.experienceYearsTypical} years of related work before this title is realistic.`
            : node.experienceYearsMin
              ? ` Expect about ${node.experienceYearsMin}+ years of related work before this title is realistic.`
              : ' Expect related work experience before this title is realistic.'
          : '';
      return yours
        ? `A profession you can work toward${field}. It usually sits after a degree or a licence — not a guaranteed posting.${xp}`
        : `A profession${field}. It usually sits after a degree or a licence — not a guaranteed posting.${xp}`;
    }
    case 'higher-secondary':
      return yours
        ? `Your Class 11–12 stream${field}. Two years of syllabus, then a next gate.`
        : `A Class 11–12 stream${field}. Two years of syllabus, then a next gate.`;
    default:
      return `${node.title}${field}${time}.`;
  }
}

function moneyLine(cost: PathCost | null | undefined, voice: ShareVoice): string {
  if (!cost) {
    return voice === 'student'
      ? 'Write what the household can pay without a loan, with a loan, and not at all — then stay inside that line.'
      : 'Write what the household can pay without a loan, with a loan, and not at all.';
  }
  const range = `Typical remaining cost on this spine — government ${formatInr(cost.govt.min)}–${formatInr(cost.govt.max)}; private ${formatInr(cost.pvt.min)}–${formatInr(cost.pvt.max)}. A private loan on the midpoint is about ${formatInr(cost.emiFull)} / month for 10 years. Confirm the prospectus.`;
  if (voice === 'explore') {
    return range;
  }
  return range;
}

const VOICE: Record<
  ShareVoice,
  {
    brand: string;
    eyebrow: string;
    safetyTitle: string;
    backupTitle: string;
    moneyTitle: string;
    calendarTitle: string;
    collegeSafety: string[];
    schoolSafety: string[];
    backupNearby: (titles: string[]) => string;
    backupEmpty: string;
    backupCollege: string;
    backupSchool: string;
    firstYearLead: string;
    shot: string;
  }
> = {
  parent: {
    brand: 'AgamiPatha for the family',
    eyebrow: 'Same path. Calmer language.',
    safetyTitle: 'Safety this year',
    backupTitle: 'Backup',
    moneyTitle: 'Money',
    calendarTitle: 'On the calendar',
    collegeSafety: [
      'First year is attendance, hostel gates, and internals — not a placement brochure.',
      'Many campuses will not let a student sit the end-sem below about 75% attendance. That is a written ordinance, not a senior’s advice.',
      'If they are unsafe or ragged: tell a warden, a parent, and put it in writing. A WhatsApp vent is not a record.',
      'A weekly money ceiling from home is safer than surprise UPI.',
    ],
    schoolSafety: [
      'This year is a syllabus, a form, and a paper — not a college brand.',
      'Keep one funded backup before counselling week. Grief now is cheaper than a loan you cannot name.',
      'Confirm every date from the official bulletin, not a forwarded message.',
    ],
    backupNearby: (titles) => `Path B on the map: ${titles.join(', ')}.`,
    backupEmpty: 'Write one backup that still uses this year’s work.',
    backupCollege:
      'If this course is wrong by first-year winter, review while the year still counts. Branch change and transfers are forms, not moods.',
    backupSchool: 'If this door fails, the backup should still use this year’s syllabus and fees already paid.',
    firstYearLead: 'If they have already joined:',
    shot: 'Screenshot this card, or send it on WhatsApp. Typical Indian routes — confirm the official notice before anyone pays.',
  },
  student: {
    brand: 'AgamiPatha for you',
    eyebrow: 'Your route on one card.',
    safetyTitle: 'Watch this year',
    backupTitle: 'Your backup',
    moneyTitle: 'Money',
    calendarTitle: 'On your calendar',
    collegeSafety: [
      'First year is attendance, hostel gates, and internals — not a placement brochure.',
      'Many campuses will not let you sit the end-sem below about 75% attendance. That is a written ordinance, not a senior’s advice.',
      'If you are unsafe: tell a warden, a parent, and put it in writing. A WhatsApp vent is not a record.',
      'A weekly money ceiling from home is safer than surprise UPI.',
    ],
    schoolSafety: [
      'This year is a syllabus, a form, and a paper — not a college brand.',
      'Keep one funded backup before counselling week. A second door is cheaper than a panic loan.',
      'Confirm every date from the official bulletin, not a forwarded message.',
    ],
    backupNearby: (titles) => `Path B on the map: ${titles.join(', ')}.`,
    backupEmpty: 'Write one backup that still uses this year’s work.',
    backupCollege:
      'If this course feels wrong by first-year winter, review while the year still counts. Branch change and transfers are forms, not moods.',
    backupSchool: 'If this door fails, the backup should still use this year’s syllabus and fees already paid.',
    firstYearLead: 'If you have already joined:',
    shot: 'Screenshot this card, or send it to your family on WhatsApp. Typical Indian routes — confirm the official notice before anyone pays.',
  },
  explore: {
    brand: 'AgamiPatha · a mapped route',
    eyebrow: 'Look at this path before anyone commits.',
    safetyTitle: 'Check this year',
    backupTitle: 'Other doors',
    moneyTitle: 'Typical cost',
    calendarTitle: 'On the calendar',
    collegeSafety: [
      'First year on this route is attendance, hostel gates, and internals — not a placement brochure.',
      'Many campuses will not let a student sit the end-sem below about 75% attendance. Confirm the ordinance.',
      'If someone is unsafe on campus: a warden, a parent, and a written record. A chat vent is not one.',
      'A weekly money ceiling from home is safer than surprise UPI.',
    ],
    schoolSafety: [
      'This year is a syllabus, a form, and a paper — not a college brand.',
      'A funded backup before counselling week is cheaper than a loan nobody can name.',
      'Confirm every date from the official bulletin, not a forwarded message.',
    ],
    backupNearby: (titles) => `Nearby on the map: ${titles.join(', ')}.`,
    backupEmpty: 'Keep one backup that still uses this year’s work.',
    backupCollege:
      'If this course is wrong by first-year winter, review while the year still counts. Branch change and transfers are forms, not moods.',
    backupSchool: 'If this door fails, the backup should still use this year’s syllabus and fees already paid.',
    firstYearLead: 'If this route is already in college:',
    shot: 'Screenshot this card, or send the link. Typical Indian routes — confirm the official notice before anyone pays.',
  },
};
