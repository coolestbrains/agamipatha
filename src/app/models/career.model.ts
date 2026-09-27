export type NodeKind =
  | 'school'
  | 'higher-secondary'
  | 'vocational'
  | 'undergraduate'
  | 'postgraduate'
  | 'professional'
  | 'profession'
  | 'entrance-exam';

export interface CareerNode {
  id: string;
  title: string;
  shortTitle: string;
  kind: NodeKind;
  field: string;
  duration: string;
  typicalAge: string;
  summary: string;
  whatYouStudy: string[];
  exams: string[];
  skills: string[];
  outlook: string;
  salaryHint?: string;
  costGovt?: string;
  costPvt?: string;
  workplaces?: string[];
  institutes?: string[];
  certifications?: string[];
  /** Minimum years of relevant work usually expected before this title. */
  experienceYearsMin?: number;
  /** Typical years before this title is realistic. */
  experienceYearsTypical?: number;
  /** campus | early | experienced */
  entryLevel?: 'campus' | 'early' | 'experienced' | string;
  /** Feeder profession ids that usually come first. */
  feederRoles?: string[];
}

export interface CareerEdge {
  id?: number;
  from: string;
  to: string;
  via: string;
  notes: string;
}

export interface PathStep {
  node: CareerNode;
  incoming?: CareerEdge;
  stepIndex: number;
}

export interface CareerPathResult {
  title: string;
  spine: string;
  steps: PathStep[];
  totalLabel: string;
  alternateCount: number;
  recommended?: boolean;
  score?: number;
  recommendReason?: string;
  recommendDetails?: string[];
}

export interface LinkedRef {
  name: string;
  url?: string;
}

export interface LinkedCert {
  name: string;
  coach: string;
  url: string;
}

export interface PathSet {
  routes: CareerPathResult[];
  routeCount: number;
  recommendedIndex?: number;
}
