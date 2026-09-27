import { CareerNode } from './models/career.model';

export const METRIC_ID = 'metric';

const LADDER: { id: string; title: string; shortTitle: string; typicalAge: string }[] = [
  { id: 'nursery', title: 'Nursery', shortTitle: 'Nursery', typicalAge: '3–4' },
  { id: 'lkg', title: 'LKG', shortTitle: 'LKG', typicalAge: '4–5' },
  { id: 'ukg', title: 'UKG', shortTitle: 'UKG', typicalAge: '5–6' },
  { id: 'class-1', title: 'Class 1', shortTitle: 'Class 1', typicalAge: '6–7' },
  { id: 'class-2', title: 'Class 2', shortTitle: 'Class 2', typicalAge: '7–8' },
  { id: 'class-3', title: 'Class 3', shortTitle: 'Class 3', typicalAge: '8–9' },
  { id: 'class-4', title: 'Class 4', shortTitle: 'Class 4', typicalAge: '9–10' },
  { id: 'class-5', title: 'Class 5', shortTitle: 'Class 5', typicalAge: '10–11' },
  { id: 'class-6', title: 'Class 6', shortTitle: 'Class 6', typicalAge: '11–12' },
  { id: 'class-7', title: 'Class 7', shortTitle: 'Class 7', typicalAge: '12–13' },
  { id: 'class-8', title: 'Class 8', shortTitle: 'Class 8', typicalAge: '13–14' },
  { id: 'class-9', title: 'Class 9', shortTitle: 'Class 9', typicalAge: '14–15' },
];

const BELOW_TENTH =
  /\b(nursery|l\.?k\.?g|u\.?k\.?g|pre[-\s]?primary|primary school|middle school|class\s*[1-9]\b|class-[1-9]\b|[1-9](st|nd|rd|th)\s*(std|standard|class))\b/i;

export const PRE_METRIC_NODES: CareerNode[] = LADDER.map((row) => ({
  id: row.id,
  title: row.title,
  shortTitle: row.shortTitle,
  kind: 'school',
  field: 'Foundation',
  duration: 'Before Class 10',
  typicalAge: row.typicalAge,
  summary: `${row.title} is before the first board. AgamiPatha maps careers from Class 10 (Metric).`,
  whatYouStudy: [],
  exams: [],
  skills: [],
  outlook: 'Finish Class 10, then pick a Class 12 stream or a vocational door.',
}));

const BY_ID = new Map(PRE_METRIC_NODES.map((node) => [node.id, node]));

export function preMetricNode(id: string): CareerNode | undefined {
  return BY_ID.get(id);
}

export function isPreMetricId(id: string | undefined | null): boolean {
  return !!id && BY_ID.has(id);
}

export function isBelowMetric(node: CareerNode | undefined | null): boolean {
  if (!node) {
    return false;
  }
  if (node.id === METRIC_ID) {
    return false;
  }
  if (isPreMetricId(node.id)) {
    return true;
  }
  if (node.kind === 'school') {
    return true;
  }
  return BELOW_TENTH.test(`${node.title} ${node.shortTitle}`);
}

export function pathFromId(fromId: string): string {
  return isPreMetricId(fromId) ? METRIC_ID : fromId;
}

export function schoolLadderRank(id: string): number {
  const index = LADDER.findIndex((row) => row.id === id);
  if (index >= 0) {
    return index;
  }
  return id === METRIC_ID ? LADDER.length : 100;
}

export function metricStartNote(
  standing: Pick<CareerNode, 'title' | 'shortTitle'> | undefined,
  voice: string = '',
): string {
  const label = standing?.shortTitle || standing?.title || 'a class before 10th';
  if (voice === 'guardian' || voice === 'parent') {
    return `AgamiPatha maps careers from Class 10 (Metric). ${label} is before 10th, so this path starts at Metric. After they finish Class 10, follow the route below.`;
  }
  if (voice === 'student') {
    return `AgamiPatha maps careers from Class 10 (Metric). You selected ${label}, which is before 10th, so this path starts at Metric. Finish Class 10, then follow the route below.`;
  }
  return `AgamiPatha maps careers from Class 10 (Metric). ${label} is before 10th, so this path starts at Metric — the first board that opens these routes.`;
}
