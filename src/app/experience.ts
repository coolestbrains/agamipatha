import { CareerNode } from './models/career.model';

export function isExperiencedRole(node: CareerNode | null | undefined): boolean {
  if (!node || node.kind !== 'profession') {
    return false;
  }
  return node.entryLevel === 'experienced' || (node.experienceYearsMin ?? 0) > 0;
}

/** Short badge for cards and KPI chips. */
export function experienceBadge(node: CareerNode | null | undefined): string {
  if (!isExperiencedRole(node) || !node) {
    return '';
  }
  const min = node.experienceYearsMin;
  const typical = node.experienceYearsTypical;
  if (min && typical && typical !== min) {
    return `Needs ~${min}–${typical} years experience`;
  }
  if (min) {
    return `Needs ~${min}+ years experience`;
  }
  if (typical) {
    return `Needs ~${typical} years experience`;
  }
  return 'Needs work experience first';
}

/** One-line path callout when the goal is mid-career. */
export function experiencePathCallout(node: CareerNode | null | undefined): string {
  if (!isExperiencedRole(node) || !node) {
    return '';
  }
  const badge = experienceBadge(node);
  return `${badge}. This is rarely a first job — expect a feeder role first.`;
}
