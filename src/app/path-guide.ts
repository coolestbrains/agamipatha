import { CareerNode, CareerPathResult } from './models/career.model';
import { ParentBrief, ShareVoice } from './parent-brief';
import { PathCalendar } from './path-calendar';
import { PathCost, formatInr } from './path-cost';

export interface GuideBlock {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface GuideStage {
  title: string;
  kicker: string;
  paragraphs: string[];
  groups: { label: string; items: string[] }[];
}

export interface PathGuide {
  filename: string;
  brand: string;
  title: string;
  subtitle: string;
  prepared: string;
  intro: string[];
  overview: string[];
  stages: GuideStage[];
  sections: GuideBlock[];
  footer: string;
}

export function buildPathGuide(input: {
  path: CareerPathResult;
  from?: CareerNode;
  to?: CareerNode;
  cost?: PathCost | null;
  calendar?: PathCalendar | null;
  brief?: ParentBrief | null;
  startNote?: string;
  url: string;
  kindLabel: (kind: string) => string;
  institutes: (node: CareerNode) => string[];
  certs: (node: CareerNode) => string[];
  voice: ShareVoice;
}): PathGuide {
  const dest = input.to || input.path.steps.at(-1)?.node;
  const from = input.from || input.path.steps[0]?.node;
  const fromTitle = from?.title || 'Start';
  const toTitle = dest?.title || 'Goal';
  const copy = GUIDE_VOICE[input.voice];
  const stages = input.path.steps.map((step, index) => {
    const node = step.node;
    const next = input.path.steps[index + 1]?.node;
    const via = step.incoming?.via?.trim() || '';
    const notes = step.incoming?.notes?.trim() || '';
    const paragraphs = [
      index === 0
        ? copy.openStage(node.title, input.kindLabel(node.kind))
        : copy.reachStage(via || 'the previous stage', node.title),
      notes,
      node.summary,
      node.outlook ? copy.doNext(node.outlook) : '',
      next ? copy.thenGo(next.shortTitle || next.title) : copy.goalLine(input.voice),
    ].filter(Boolean);
    const groups: GuideStage['groups'] = [];
    pushGroup(groups, 'What you study', node.whatYouStudy);
    pushGroup(groups, 'Exams and gates', node.exams);
    pushGroup(groups, 'Skills to build', node.skills);
    const money = [node.costGovt ? `Government / aided: ${node.costGovt}` : '', node.costPvt ? `Private: ${node.costPvt}` : ''].filter(
      Boolean,
    );
    pushGroup(groups, 'Typical cost', money);
    pushGroup(groups, 'Institutes often named', input.institutes(node));
    pushGroup(groups, 'Workplaces', node.workplaces);
    pushGroup(groups, 'Useful certifications', input.certs(node));
    if (node.salaryHint) {
      pushGroup(groups, 'Pay hint', [node.salaryHint]);
    }
    if (node.entryLevel === 'experienced' || (node.experienceYearsMin ?? 0) > 0) {
      const min = node.experienceYearsMin;
      const typical = node.experienceYearsTypical;
      const years =
        min && typical && typical !== min
          ? `about ${min}–${typical} years`
          : min
            ? `about ${min}+ years`
            : typical
              ? `about ${typical} years`
              : 'relevant work experience';
      const known = new Map<string, string>();
      for (const step of input.path.steps) {
        known.set(step.node.id, step.node.title);
      }
      if (input.from) {
        known.set(input.from.id, input.from.title);
      }
      if (input.to) {
        known.set(input.to.id, input.to.title);
      }
      const feeders = (node.feederRoles ?? [])
        .map((id) => known.get(id) || id.replace(/-/g, ' '))
        .filter(Boolean);
      const lines = [
        `Usually needs ${years} of relevant work — rarely a first campus title.`,
        feeders.length ? `Usual feeder roles: ${feeders.join(', ')}.` : '',
      ].filter(Boolean);
      pushGroup(groups, 'Experience needed', lines);
    }
    const bits = [
      input.kindLabel(node.kind),
      node.field,
      node.duration,
      node.typicalAge ? `typical age ${node.typicalAge}` : '',
    ].filter(Boolean);
    return {
      title: `Stage ${index + 1} of ${input.path.steps.length} · ${node.title}`,
      kicker: bits.join(' · '),
      paragraphs,
      groups,
    };
  });

  const sections: GuideBlock[] = [];
  if (input.startNote) {
    sections.push({
      heading: 'Before Class 10',
      paragraphs: [input.startNote],
    });
  }
  if (input.brief) {
    sections.push({
      heading: input.brief.safetyTitle,
      bullets: input.brief.safety,
    });
    sections.push({
      heading: input.brief.backupTitle,
      bullets: input.brief.backup,
    });
    sections.push({
      heading: input.brief.moneyTitle,
      paragraphs: [input.brief.money],
    });
  }
  if (input.cost) {
    sections.push({
      heading: 'Cost honesty on this spine',
      paragraphs: [
        `Typical remaining cost: government ${formatInr(input.cost.govt.min)}–${formatInr(input.cost.govt.max)}; private ${formatInr(input.cost.pvt.min)}–${formatInr(input.cost.pvt.max)}. A private loan on the midpoint is about ${formatInr(input.cost.emiFull)} per month for 10 years.`,
        input.cost.assumptions,
      ],
      bullets: input.cost.hops.map((hop) => {
        const govt = hop.govtRaw || 'not listed';
        const pvt = hop.pvtRaw || 'not listed';
        return `${hop.title}: govt ${govt}; private ${pvt}${hop.years ? ` (~${hop.years} yr)` : ''}`;
      }),
    });
  }
  if (input.calendar) {
    const items = input.calendar.events.map((event) => `${event.kindLabel} · ${event.title} (${event.when}). ${event.detail}`);
    sections.push({
      heading: `This year’s calendar · ${input.calendar.yearLabel}`,
      paragraphs: [`${input.calendar.todayLabel}. Typical windows — confirm the gazette or bulletin before you act.`],
      bullets: items.slice(0, 18),
    });
  }
  sections.push({
    heading: 'How to use this guide',
    paragraphs: copy.howTo,
    bullets: copy.checklist,
  });
  sections.push({
    heading: 'Live map',
    paragraphs: [`Open this route on AgamiPatha: ${input.url}`],
  });

  return {
    filename: slugFile(`agamipatha-${from?.shortTitle || fromTitle}-to-${dest?.shortTitle || toTitle}`),
    brand: copy.brand,
    title: `${fromTitle} → ${toTitle}`,
    subtitle: [input.path.totalLabel, input.path.title, input.path.spine].filter(Boolean).join(' · '),
    prepared: `Prepared for ${copy.audience} · ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    intro: [copy.intro, dest ? copy.goalSense(dest) : ''],
    overview: input.path.steps.map((step, index) => {
      const via = step.incoming?.via?.trim();
      return `${index + 1}. ${step.node.title}${via ? ` — via ${via}` : ''}`;
    }),
    stages,
    sections: sections.filter((block) => (block.paragraphs?.length || 0) + (block.bullets?.length || 0) > 0),
    footer: 'Typical Indian education routes, not guarantees. Confirm official rules before you apply. agamipatha.com',
  };
}

function pushGroup(groups: GuideStage['groups'], label: string, items?: string[]): void {
  const clean = (items ?? []).map((item) => item.trim()).filter(Boolean);
  if (clean.length) {
    groups.push({ label, items: unique(clean).slice(0, 10) });
  }
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

function slugFile(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${slug || 'agamipatha-path-guide'}.pdf`;
}

const GUIDE_VOICE: Record<
  ShareVoice,
  {
    brand: string;
    audience: string;
    intro: string;
    howTo: string[];
    checklist: string[];
    openStage: (title: string, kind: string) => string;
    reachStage: (via: string, title: string) => string;
    doNext: (outlook: string) => string;
    thenGo: (next: string) => string;
    goalLine: (voice: ShareVoice) => string;
    goalSense: (node: CareerNode) => string;
  }
> = {
  student: {
    brand: 'AgamiPatha path guide',
    audience: 'the student',
    intro:
      'This is a stage-by-stage reference from where you stand to the goal you picked. Keep it with a parent or counsellor. Fees and dates here are typical — confirm the official notice before you pay or apply.',
    howTo: [
      'Read one stage at a time. Finish the current gate before you spend on the next brand.',
      'Write one funded backup that still uses this year’s work.',
    ],
    checklist: [
      'Confirm this year’s form and exam dates from the official bulletin.',
      'Write what the household can pay without a loan, with a loan, and not at all.',
      'Keep attendance, hostel rules, and internals in writing if you have already joined.',
    ],
    openStage: (title, kind) => `You start here: ${title} (${kind}). This is the first mapped door on this route.`,
    reachStage: (via, title) => `You reach ${title} through ${via}. Treat that hop as a gate, not a promise.`,
    doNext: (outlook) => `What to do at this stage: ${outlook}`,
    thenGo: (next) => `After this stage, the mapped next door is ${next}.`,
    goalLine: () => 'This is the goal on this map. A profession still needs a licence, a seat, or work — confirm the rule that actually hires.',
    goalSense: (node) =>
      node.kind === 'profession'
        ? `${node.title} is the profession this route is aiming at. The steps above are the usual Indian education doors, not a posting letter.`
        : `${node.title} is the qualification this route is aiming at.`,
  },
  parent: {
    brand: 'AgamiPatha family path guide',
    audience: 'the parent or guardian',
    intro:
      'This is a family reference for the mapped route. Read it with the student. Money, safety, and one backup come before a college brand. Confirm the prospectus and gazette before anyone pays.',
    howTo: [
      'Sit with the student and mark the current stage. Do not skip gates because a neighbour’s child did.',
      'Agree a cash ceiling, a loan ceiling, and a walk-away line before counselling week.',
    ],
    checklist: [
      'Every date from the official bulletin, not a forwarded message.',
      'One funded backup that still uses this year’s fees and syllabus.',
      'If they have joined: attendance ordinance, hostel gates, and a weekly money ceiling.',
    ],
    openStage: (title, kind) => `The mapped start is ${title} (${kind}). Career routes on AgamiPatha open from the first board onward.`,
    reachStage: (via, title) => `The hop into ${title} is ${via}. That is a process, not a guarantee of a seat.`,
    doNext: (outlook) => `Guidance at this stage: ${outlook}`,
    thenGo: (next) => `The next mapped door after this is ${next}.`,
    goalLine: () => 'This is the goal on this map. A job still needs a licence, a seat, or work. Confirm the rule that actually hires.',
    goalSense: (node) =>
      node.kind === 'profession'
        ? `${node.title} is the profession this route is aiming at — after the education doors above, not instead of them.`
        : `${node.title} is the qualification this route is aiming at.`,
  },
  explore: {
    brand: 'AgamiPatha path guide',
    audience: 'anyone exploring this route',
    intro:
      'This is a mapped Indian education route for study. Typical cost bands and calendar windows, not counselling, not a guarantee.',
    howTo: [
      'Use the stages as a checklist of doors, not as a promise of a college or a job.',
      'Confirm every fee and date from the official notice before anyone pays.',
    ],
    checklist: [
      'Read the spine first, then the stage that matches where the student stands.',
      'Keep one backup that still uses this year’s work.',
      'Treat ranks, brands, and placement brochures as marketing until the ordinance says otherwise.',
    ],
    openStage: (title, kind) => `Mapped start: ${title} (${kind}).`,
    reachStage: (via, title) => `Mapped hop into ${title}: ${via}.`,
    doNext: (outlook) => `At this stage: ${outlook}`,
    thenGo: (next) => `Mapped next door: ${next}.`,
    goalLine: () => 'This is the goal on this map. Confirm official rules before anyone applies or pays.',
    goalSense: (node) => `${node.title} is the end of this mapped spine.`,
  },
};
