import { CareerNode } from './models/career.model';

export type OptionKindFilter = 'all' | 'qualifications' | 'exams' | 'professions';

export interface OptionTreeNode {
  node: CareerNode;
  via: string;
  depth: number;
  children: OptionTreeNode[];
  descendantCount: number;
}

export function optionKindBucket(kind: string): Exclude<OptionKindFilter, 'all'> {
  if (kind === 'profession') {
    return 'professions';
  }
  if (kind === 'entrance-exam') {
    return 'exams';
  }
  return 'qualifications';
}

export function countTreeNodes(nodes: OptionTreeNode[]): number {
  let total = 0;
  for (const node of nodes) {
    total += 1 + node.descendantCount;
  }
  return total;
}

export function collectExpandable(nodes: OptionTreeNode[], into = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.children.length) {
      into.add(node.node.id);
      collectExpandable(node.children, into);
    }
  }
  return into;
}

export function findTreePath(nodes: OptionTreeNode[], id: string, trail: string[] = []): string[] | null {
  for (const node of nodes) {
    const next = [...trail, node.node.id];
    if (node.node.id === id) {
      return next;
    }
    const hit = findTreePath(node.children, id, next);
    if (hit) {
      return hit;
    }
  }
  return null;
}

export function filterOptionTree(
  nodes: OptionTreeNode[],
  query: string,
  kind: OptionKindFilter,
): OptionTreeNode[] {
  const q = query.trim().toLowerCase();
  const out: OptionTreeNode[] = [];
  for (const item of nodes) {
    const children = filterOptionTree(item.children, query, kind);
    const selfMatch = matchesOption(item, q, kind);
    if (!selfMatch && !children.length) {
      continue;
    }
    out.push({
      ...item,
      children,
      descendantCount: countTreeNodes(children),
    });
  }
  return out;
}

function matchesOption(item: OptionTreeNode, query: string, kind: OptionKindFilter): boolean {
  if (kind !== 'all' && optionKindBucket(item.node.kind) !== kind) {
    return false;
  }
  if (!query) {
    return true;
  }
  const hay = [
    item.node.title,
    item.node.shortTitle,
    item.node.field,
    item.node.kind,
    item.via,
    item.node.duration,
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(query);
}
