import { CareerPathResult, NodeKind, PathStep } from './models/career.model';

const FEE_KINDS: NodeKind[] = [
  'school',
  'higher-secondary',
  'vocational',
  'undergraduate',
  'postgraduate',
  'professional',
  'entrance-exam',
];

export interface CostBand {
  min: number;
  max: number;
  per: 'year' | 'once';
}

export interface CostHop {
  id: string;
  title: string;
  years: number;
  govtRaw: string;
  pvtRaw: string;
  govt: CostBand | null;
  pvt: CostBand | null;
}

export interface PathCost {
  spine: string;
  hops: CostHop[];
  years: number;
  govt: { min: number; max: number; mid: number; annualMid: number };
  pvt: { min: number; max: number; mid: number; annualMid: number };
  emiFull: number;
  assumptions: string;
}

export interface HouseholdCeiling {
  cash: number;
  withLoan: number;
  walkAway: number;
  signer: string;
}

export interface CostVerdict {
  tone: 'ask' | 'fits' | 'loan' | 'stop';
  title: string;
  lines: string[];
}

export type AmountTone = 'low' | 'mid' | 'high';

export function amountTone(value: number, peers: number[]): AmountTone {
  const vals = peers.filter((n) => Number.isFinite(n) && n > 0);
  if (!vals.length || !Number.isFinite(value) || value <= 0) {
    return 'mid';
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (max <= min || value <= min) {
    return 'low';
  }
  if (value >= max) {
    return 'high';
  }
  return 'mid';
}

export function pathCostTones(cost: PathCost): { govt: AmountTone; pvt: AmountTone; emi: AmountTone } {
  const govt = cost.govt.annualMid;
  const pvt = cost.pvt.annualMid;
  const emiYear = cost.emiFull * 12;
  const peers = [govt, pvt, emiYear];
  return {
    govt: amountTone(govt, peers),
    pvt: amountTone(pvt, peers),
    emi: amountTone(emiYear, peers),
  };
}

const RATE = 0.1;
const TENURE_MONTHS = 120;

export function buildPathCost(path: CareerPathResult): PathCost | null {
  const hops = path.steps
    .slice(1)
    .filter((step) => FEE_KINDS.includes(step.node.kind))
    .map((step) => toHop(step));
  if (!hops.length) {
    return null;
  }
  const years = hops.reduce((sum, hop) => sum + (hop.govt?.per === 'year' || hop.pvt?.per === 'year' ? hop.years : 0), 0) || 1;
  const govt = sumSide(hops, 'govt');
  const pvt = sumSide(hops, 'pvt');
  return {
    spine: path.spine,
    hops,
    years,
    govt,
    pvt,
    emiFull: emi(pvt.mid),
    assumptions: `EMI at ${RATE * 100}% reducing for ${TENURE_MONTHS / 12} years. Banks often wait until the course ends; interest still grows. Typical bands, not a prospectus.`,
  };
}

export function emiOnGap(privateMid: number, cashAnnual: number, years: number): number {
  const cashTotal = Math.max(0, cashAnnual) * Math.max(1, years);
  return emi(Math.max(0, privateMid - cashTotal));
}

export function judgeCost(cost: PathCost, house: HouseholdCeiling): CostVerdict {
  const cash = house.cash;
  const loan = Math.max(house.withLoan, cash);
  const walk = house.walkAway > 0 ? house.walkAway : loan;
  if (!cash && !loan) {
    return {
      tone: 'ask',
      title: 'Write the three numbers before anyone loves a brochure',
      lines: [
        'Ask a parent or guardian: annual fee without a loan, with a loan they would sign, and not at all.',
        'Until those numbers exist, this path is a poster with rupees on it.',
        'Vocational and government seats belong on the same page as the private campus.',
      ],
    };
  }
  const govtYear = cost.govt.annualMid;
  const pvtYear = cost.pvt.annualMid;
  const gapEmi = emiOnGap(cost.pvt.mid, cash, cost.years);
  const signer = house.signer.trim() || 'someone in the household';

  if (walk && pvtYear > walk && govtYear > walk) {
    return {
      tone: 'stop',
      title: 'This spine is above what the household will pay',
      lines: [
        `The walk-away number is ${formatInr(walk)} / year. Both typical government (${formatInr(govtYear)} / year) and private (${formatInr(pvtYear)} / year) sit above it.`,
        'A career that bankrupts the household is a household event. Cheaper mapped hops are the honest map.',
        'Grief this week is cheaper than debt in counselling week.',
      ],
    };
  }

  if (pvtYear > 0 && cash >= pvtYear) {
    return {
      tone: 'fits',
      title: 'Private fee sits inside the no-loan number',
      lines: [
        `Typical private on this spine is about ${formatInr(pvtYear)} / year. The household cash ceiling is ${formatInr(cash)} / year.`,
        'You are not asking for a fourth number.',
        cost.govt.mid ? `A government seat is cheaper still — about ${formatInr(govtYear)} / year if you get one.` : '',
      ].filter(Boolean),
    };
  }

  if (govtYear > 0 && cash >= govtYear && pvtYear > cash) {
    if (loan >= pvtYear) {
      return {
        tone: 'loan',
        title: 'Government fits in cash. Private needs a signed loan',
        lines: [
          `Cash covers a typical government seat (~${formatInr(govtYear)} / year), not the private band (~${formatInr(pvtYear)} / year).`,
          `If ${signer} borrows the gap, EMI is about ${formatInr(gapEmi)} / month for 10 years after the course — on top of living costs.`,
          'Education loans are tools. They are also EMIs during the first salary years.',
        ],
      };
    }
    return {
      tone: 'stop',
      title: 'Private is a fourth number',
      lines: [
        `Cash can fund a government seat (~${formatInr(govtYear)} / year). The private brochure (~${formatInr(pvtYear)} / year) is above the loan ceiling you wrote (${formatInr(loan)} / year).`,
        'If the honest number rules out a famous private campus, say so early.',
        'Scholarships and state quota are not lesser lives. They are this map.',
      ],
    };
  }

  if (govtYear > 0 && cash < govtYear && loan >= govtYear) {
    return {
      tone: 'loan',
      title: 'Even a government seat needs a plan besides cash',
      lines: [
        `Typical government on this spine is about ${formatInr(govtYear)} / year. Cash written is ${formatInr(cash)} / year.`,
        `A loan signed by ${signer}, or a scholarship, has to close the gap. EMI on the private gap would be about ${formatInr(gapEmi)} / month — do not take that lightly.`,
        'Gather NSP / state / EWS papers in Class 11 if they apply. Documents are part of the fee.',
      ],
    };
  }

  return {
    tone: 'stop',
    title: 'The household cannot fund this spine at the numbers written',
    lines: [
      `Government ~${formatInr(govtYear)} / year, private ~${formatInr(pvtYear)} / year, cash ${formatInr(cash) || '₹0'}, with-loan ${formatInr(loan) || '₹0'}.`,
      'Write a cheaper hop, a vocational ladder, or a government-only plan. Do not invent a fourth number.',
      'The Class 10 Stream Chooser already taught this worksheet. Use it.',
    ],
  };
}

export function parseUserMoney(raw: string): number {
  const text = raw.trim().toLowerCase().replace(/₹/g, '').replace(/,/g, ' ');
  if (!text) {
    return 0;
  }
  const lakh = /([\d.]+)\s*(lakh|lac|l)\b/.exec(text);
  if (lakh) {
    return Math.round(Number(lakh[1]) * 100000);
  }
  const crore = /([\d.]+)\s*(crore|cr)\b/.exec(text);
  if (crore) {
    return Math.round(Number(crore[1]) * 10000000);
  }
  const digits = text.replace(/[^\d.]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function formatInr(n: number): string {
  if (!n) {
    return '₹0';
  }
  if (n >= 10000000) {
    const c = n / 10000000;
    return `₹${trimNum(c)} crore`;
  }
  if (n >= 100000) {
    return `₹${trimNum(n / 100000)} lakh`;
  }
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function formatBand(band: CostBand | null): string {
  if (!band) {
    return 'No band on the map';
  }
  const span = band.min === band.max ? formatInr(band.min) : `${formatInr(band.min)}–${formatInr(band.max)}`;
  return band.per === 'year' ? `${span} / year` : span;
}

export function parseRupeeBand(text: string): CostBand | null {
  if (!text?.trim()) {
    return null;
  }
  const lower = text.toLowerCase();
  const per: CostBand['per'] = /\/\s*year/.test(lower) ? 'year' : 'once';
  const amounts = extractAmounts(text);
  const free = /free|stipend|paid by the government/.test(lower);
  if (!amounts.length) {
    return free ? { min: 0, max: 0, per } : null;
  }
  let min = Math.min(...amounts);
  const max = Math.max(...amounts);
  if (free) {
    min = 0;
  }
  return { min, max, per };
}

export function parseYears(duration: string): number {
  const text = duration.toLowerCase();
  if (/exam cycle|one attempt|\/ cycle/.test(text)) {
    return 1;
  }
  const nums = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1])).filter((n) => n > 0 && n < 40);
  if (!nums.length) {
    return 1;
  }
  if (nums.length === 1) {
    return nums[0]!;
  }
  return (nums[0]! + nums[1]!) / 2;
}

function toHop(step: PathStep): CostHop {
  const node = step.node;
  const years = node.kind === 'entrance-exam' ? 1 : parseYears(node.duration);
  return {
    id: node.id,
    title: node.shortTitle || node.title,
    years,
    govtRaw: node.costGovt || '',
    pvtRaw: node.costPvt || '',
    govt: parseRupeeBand(node.costGovt || ''),
    pvt: parseRupeeBand(node.costPvt || ''),
  };
}

function sumSide(hops: CostHop[], key: 'govt' | 'pvt'): PathCost['govt'] {
  let min = 0;
  let max = 0;
  for (const hop of hops) {
    const band = hop[key];
    if (!band) {
      continue;
    }
    const factor = band.per === 'year' ? hop.years : 1;
    min += band.min * factor;
    max += band.max * factor;
  }
  const mid = (min + max) / 2;
  const yearHops = hops.filter((hop) => hop[key]?.per === 'year').reduce((sum, hop) => sum + hop.years, 0) || 1;
  return { min, max, mid, annualMid: mid / yearHops };
}

function emi(principal: number): number {
  if (principal <= 0) {
    return 0;
  }
  const r = RATE / 12;
  const pow = (1 + r) ** TENURE_MONTHS;
  return Math.round((principal * r * pow) / (pow - 1) / 100) * 100;
}

function extractAmounts(text: string): number[] {
  const matches: { value: number; unit: string }[] = [];
  const re = /(?:₹|rs\.?\s*)?(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s*(lakh|lac|crore)?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    matches.push({
      value: Number(match[1]!.replace(/,/g, '')),
      unit: (match[2] || '').toLowerCase(),
    });
  }
  const shared = matches.find((item) => item.unit)?.unit || '';
  return matches.map((item) => {
    const unit = item.unit || (shared && item.value < 100 ? shared : '');
    return scale(item.value, unit);
  });
}

function scale(value: number, unit: string): number {
  if (unit === 'lakh' || unit === 'lac') {
    return value * 100000;
  }
  if (unit === 'crore') {
    return value * 10000000;
  }
  return value;
}

function trimNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(rounded >= 10 ? 1 : 2);
}

export function emptyCeiling(): HouseholdCeiling {
  return { cash: 0, withLoan: 0, walkAway: 0, signer: '' };
}
