import { CareerNode, CareerPathResult, PathSet, PathStep } from './models/career.model';

export interface TimelineHintGroup {
  label: string;
  items: string[];
}

export interface TimelineHint {
  paragraphs: string[];
  groups: TimelineHintGroup[];
}

export interface TimelineLink {
  name: string;
  extra?: string;
  url: string;
}

export interface TimelineHelpGroup {
  label: string;
  links: TimelineLink[];
}

export function buildTimelineHint(
  step: PathStep,
  next: CareerNode | undefined,
  index: number,
  total: number,
  kindLabel: (kind: string) => string,
): TimelineHint {
  const node = step.node;
  const via = step.incoming?.via?.trim() || '';
  const notes = step.incoming?.notes?.trim() || '';
  const last = index === total - 1;
  const paragraphs = [
    index === 0
      ? `This is the standing on your map: ${node.title} (${kindLabel(node.kind)}). Mark it done when it matches where you are, then work the next gate.`
      : last
        ? `${node.title} is the final goal on this My Path. Confirm the official rule that actually admits, licences, or hires before you treat it as finished.`
        : `Sub-goal ${index + 1} of ${total}: ${node.title}. Clear this gate before you spend on the next brand.`,
    via ? `You reach this through ${via}. Treat that hop as a process, not a promise of a seat.` : '',
    notes,
    node.summary,
    node.outlook ? `What to do at this stage: ${node.outlook}` : '',
    next ? `After this, the mapped next door is ${next.shortTitle || next.title}.` : '',
  ].filter(Boolean);

  const groups: TimelineHintGroup[] = [];
  push(groups, 'Exams and gates to clear', node.exams);
  push(groups, 'Skills to practise now', node.skills);
  push(groups, 'What you study or practise', node.whatYouStudy);
  const money = [
    node.duration ? `Typical duration: ${node.duration}` : '',
    node.typicalAge ? `Typical age: ${node.typicalAge}` : '',
    node.costGovt ? `Government / aided: ${node.costGovt}` : '',
    node.costPvt ? `Private: ${node.costPvt}` : '',
  ].filter(Boolean);
  push(groups, 'Time and money to plan', money);
  push(groups, 'Institutes often named', node.institutes ?? []);
  push(groups, 'Useful certifications', node.certifications ?? []);
  push(groups, 'Workplaces', node.workplaces ?? []);
  if (node.salaryHint) {
    push(groups, 'Pay hint', [node.salaryHint]);
  }

  return { paragraphs, groups };
}

export function buildTimelineHelp(input: {
  title: string;
  exams: string[];
  via: string;
  institutes: { name: string; url?: string }[];
  certs: { name: string; coach: string; url: string }[];
}): TimelineHelpGroup[] {
  const hay = [input.title, input.via, ...input.exams].join(' ').toLowerCase();
  const groups: TimelineHelpGroup[] = [];
  const official = officialPrepLinks(hay);
  if (official.length) {
    groups.push({ label: 'Official notices and portals', links: official });
  }
  const certs = uniqueLinks(
    input.certs.map((item) => ({
      name: item.name,
      extra: item.coach,
      url: item.url,
    })),
  );
  if (certs.length) {
    groups.push({ label: 'Courses and coaching to prepare', links: certs });
  }
  const institutes = uniqueLinks(
    input.institutes
      .filter((item) => !!item.url)
      .map((item) => ({ name: item.name, extra: 'Institute site', url: item.url || '' })),
  );
  if (institutes.length) {
    groups.push({ label: 'Institutes and programme pages', links: institutes });
  }
  const searches = searchLinks(input.title, input.exams, input.via);
  if (searches.length) {
    groups.push({ label: 'Search the web', links: searches });
  }
  return groups;
}

function push(groups: TimelineHintGroup[], label: string, items?: string[]): void {
  const next = (items ?? []).map((item) => item.trim()).filter(Boolean);
  if (next.length) {
    groups.push({ label, items: next });
  }
}

export function viaToken(route: CareerPathResult): string {
  return route.steps.slice(1, -1).map((step) => step.node.id).join(',');
}

export function pickRoute(set: PathSet | null | undefined, via = ''): CareerPathResult | null {
  if (!set?.routes.length) {
    return null;
  }
  if (via) {
    const exact = set.routes.find((route) => viaToken(route) === via);
    if (exact) {
      return exact;
    }
  }
  return set.routes[Math.min(set.recommendedIndex ?? 0, set.routes.length - 1)] ?? set.routes[0];
}

export function stepIdsOf(route: CareerPathResult | null): string[] {
  return route?.steps.map((step) => step.node.id).filter(Boolean) ?? [];
}

function uniqueLinks(links: TimelineLink[]): TimelineLink[] {
  const seen = new Set<string>();
  const out: TimelineLink[] = [];
  for (const link of links) {
    const url = link.url.trim();
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    out.push({ ...link, url });
  }
  return out;
}

function officialPrepLinks(hay: string): TimelineLink[] {
  const rules: { test: (s: string) => boolean; name: string; extra: string; url: string }[] = [
    { test: (s) => s.includes('jee advanced'), name: 'JEE Advanced', extra: 'Official portal', url: 'https://jeeadv.ac.in/' },
    { test: (s) => s.includes('jee'), name: 'JEE Main (NTA)', extra: 'Information bulletin and forms', url: 'https://jeemain.nta.nic.in/' },
    { test: (s) => s.includes('neet'), name: 'NEET (NTA)', extra: 'Information bulletin and forms', url: 'https://neet.nta.nic.in/' },
    { test: (s) => s.includes('cuet'), name: 'CUET (NTA)', extra: 'UG admissions test', url: 'https://cuet.nta.nic.in/' },
    { test: (s) => s.includes('gate'), name: 'GATE', extra: 'Official GATE site', url: 'https://gate.iisc.ac.in/' },
    { test: (s) => s.includes('common admission test') || /\bcat\b/.test(s), name: 'CAT', extra: 'IIM CAT', url: 'https://iimcat.ac.in/' },
    { test: (s) => s.includes('clat'), name: 'CLAT', extra: 'Consortium of NLUs', url: 'https://consortiumofnlus.ac.in/' },
    { test: (s) => s.includes('upsc') || s.includes('civil service') || s.includes('ias'), name: 'UPSC', extra: 'Notifications and syllabus', url: 'https://www.upsc.gov.in/' },
    { test: (s) => s.includes('nda'), name: 'NDA / UPSC online', extra: 'Application portal', url: 'https://upsconline.nic.in/' },
    { test: (s) => s.includes('nta'), name: 'National Testing Agency', extra: 'Exam calendar', url: 'https://www.nta.ac.in/' },
    { test: (s) => s.includes('cbse') || s.includes('class 10') || s.includes('class 12') || s.includes('metric'), name: 'CBSE', extra: 'Board curriculum and exams', url: 'https://www.cbse.gov.in/' },
    { test: (s) => s.includes('ncert') || s.includes('class ') || s.includes('school'), name: 'NCERT', extra: 'Textbooks', url: 'https://ncert.nic.in/' },
    { test: (s) => s.includes('diksha') || s.includes('school') || s.includes('class '), name: 'DIKSHA', extra: 'Free school lessons', url: 'https://diksha.gov.in/' },
    { test: (s) => s.includes('ugc-net') || s.includes('ugc net'), name: 'UGC-NET (NTA)', extra: 'Official portal', url: 'https://ugcnet.nta.ac.in/' },
  ];
  return uniqueLinks(rules.filter((rule) => rule.test(hay)).map(({ name, extra, url }) => ({ name, extra, url })));
}

function searchLinks(title: string, exams: string[], via: string): TimelineLink[] {
  const queries = [
    `${title} how to prepare official syllabus`,
    via ? `${via} official information bulletin` : '',
    ...exams.slice(0, 2).map((exam) => `${exam} official syllabus previous papers`),
  ].filter(Boolean);
  return uniqueLinks(
    queries.map((query) => ({
      name: query,
      extra: 'Web search',
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    })),
  );
}
