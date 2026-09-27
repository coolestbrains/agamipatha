import { CareerEdge, CareerNode, NodeKind } from './models/career.model';

export interface SwitchHop {
  node: CareerNode;
  via: string;
  notes: string;
}

export interface SwitchStep {
  title: string;
  detail: string;
  node?: CareerNode;
  exams: string[];
  duration: string;
}

export interface SwitchAlt {
  node: CareerNode;
  why: string;
}

export interface SwitchPlan {
  possible: boolean;
  verdict: string;
  why: string;
  reenterId: string;
  steps: SwitchStep[];
  notes: string[];
  alts: SwitchAlt[];
}

const KIND_RANK: NodeKind[] = [
  'school',
  'higher-secondary',
  'vocational',
  'entrance-exam',
  'undergraduate',
  'postgraduate',
  'professional',
  'profession',
];

interface Walk {
  ids: string[];
  edges: CareerEdge[];
}

export function buildSwitchPlan(opts: {
  from: CareerNode;
  to: CareerNode;
  fromGraphId: string;
  nodes: CareerNode[];
  edges: CareerEdge[];
  kindLabel: (kind: string) => string;
}): SwitchPlan {
  const { from, to, kindLabel } = opts;
  const startId = opts.fromGraphId || from.id;
  const byId = new Map(opts.nodes.map((node) => [node.id, node]));
  byId.set(from.id, from);
  byId.set(to.id, to);
  const outgoing = groupBy(opts.edges, (edge) => edge.from);
  const incoming = groupBy(opts.edges, (edge) => edge.to);
  const get = (id: string) => byId.get(id);

  const direct = shortest(startId, to.id, outgoing);
  if (direct) {
    return {
      possible: true,
      verdict: 'A mapped route is on the graph',
      why: `AgamiPatha did not rank a public path from ${from.shortTitle} to ${to.shortTitle}, but the catalogue still has hops. Treat this as a switch sketch, then confirm each gate.`,
      reenterId: startId,
      steps: hopsToSteps(from, direct, get, kindLabel, 'Stay on this start and take the mapped doors below.'),
      notes: honestNotes(from, to),
      alts: nearbyAlts(startId, to.id, outgoing, get),
    };
  }

  const conversion = bestConversion(startId, from, to, outgoing, incoming, get);
  const rewind = bestRewind(startId, to.id, outgoing, incoming, get);
  const pick =
    conversion && rewind
      ? conversion.cost <= rewind.cost
        ? conversion
        : rewind
      : conversion ?? rewind;

  if (pick) {
    const intro =
      pick.kind === 'conversion'
        ? `${from.shortTitle} has no forward hop into ${to.shortTitle}. Holders of a ${kindLabel(from.kind).toLowerCase()} commonly convert through ${pick.gate.shortTitle}.`
        : `No forward route leaves ${from.shortTitle} for ${to.shortTitle}. A switch means re-entering at ${pick.gate.shortTitle} and taking a different mapped branch.`;
    return {
      possible: true,
      verdict:
        pick.kind === 'conversion'
          ? `Possible via a conversion through ${pick.gate.shortTitle}`
          : `Possible if you switch back to ${pick.gate.shortTitle}`,
      why: intro,
      reenterId: pick.gate.id,
      steps: hopsToSteps(pick.gate, pick.walk, get, kindLabel, intro),
      notes: [
        ...honestNotes(from, to),
        pick.kind === 'rewind'
          ? `Time already spent after ${pick.gate.shortTitle} does not count as the mapped door into ${to.shortTitle}.`
          : `This conversion is typical on Indian routes. Your exact ${from.shortTitle} may still need a prospectus check before you pay.`,
      ],
      alts: nearbyAlts(startId, to.id, outgoing, get),
    };
  }

  const fieldBit =
    from.field && to.field && from.field !== to.field
      ? `${from.shortTitle} sits in ${from.field}; ${to.shortTitle} sits in ${to.field}. Those catalogues do not meet on a mapped hop.`
      : `Nothing in the catalogue walks from ${from.shortTitle} to ${to.shortTitle}, even by going back to an earlier school or degree door.`;
  return {
    possible: false,
    verdict: 'No switch on this map',
    why: fieldBit,
    reenterId: '',
    steps: [
      {
        title: 'Stay honest about the missing hop',
        detail: `${kindLabel(from.kind)} “${from.shortTitle}” is not a listed door into ${kindLabel(to.kind).toLowerCase()} “${to.shortTitle}”. A neighbour’s story is not a route.`,
        node: from,
        exams: (from.exams ?? []).slice(0, 3),
        duration: from.duration,
      },
      {
        title: `What ${to.shortTitle} actually asks`,
        detail: to.summary || to.outlook,
        node: to,
        exams: (to.exams ?? []).slice(0, 3),
        duration: to.duration,
      },
    ],
    notes: [
      ...honestNotes(from, to),
      'Use a nearby profession from your current qualification, or pick a goal the map already draws.',
    ],
    alts: nearbyAlts(startId, to.id, outgoing, get),
  };
}

function hopsToSteps(
  start: CareerNode,
  walk: Walk,
  get: (id: string) => CareerNode | undefined,
  kindLabel: (kind: string) => string,
  intro: string,
): SwitchStep[] {
  const steps: SwitchStep[] = [
    {
      title: `Start the switch from ${start.shortTitle}`,
      detail: intro,
      node: start,
      exams: (start.exams ?? []).slice(0, 3),
      duration: start.duration,
    },
  ];
  walk.ids.forEach((id, i) => {
    if (i === 0) {
      return;
    }
    const node = get(id);
    if (!node) {
      return;
    }
    const edge = walk.edges[i - 1];
    const via = edge?.via ? `Via ${edge.via}. ` : '';
    const notes = edge?.notes ? `${edge.notes} ` : '';
    steps.push({
      title: `${kindLabel(node.kind)}: ${node.shortTitle}`,
      detail: `${via}${notes}${node.summary || node.outlook}`.trim(),
      node,
      exams: (node.exams ?? []).slice(0, 3),
      duration: node.duration,
    });
  });
  return steps;
}

function bestRewind(
  fromId: string,
  toId: string,
  outgoing: Map<string, CareerEdge[]>,
  incoming: Map<string, CareerEdge[]>,
  get: (id: string) => CareerNode | undefined,
): { kind: 'rewind'; gate: CareerNode; walk: Walk; cost: number } | null {
  const dist = new Map<string, number>([[fromId, 0]]);
  const queue = [fromId];
  while (queue.length) {
    const current = queue.shift()!;
    const here = dist.get(current) ?? 0;
    if (here >= 12) {
      continue;
    }
    for (const edge of incoming.get(current) ?? []) {
      if (dist.has(edge.from)) {
        continue;
      }
      dist.set(edge.from, here + 1);
      queue.push(edge.from);
    }
  }

  let best: { kind: 'rewind'; gate: CareerNode; walk: Walk; cost: number } | null = null;
  for (const [id, rewindDist] of dist) {
    if (id === fromId) {
      continue;
    }
    const gate = get(id);
    const walk = shortest(id, toId, outgoing);
    if (!gate || !walk) {
      continue;
    }
    const cost = rewindDist * 8 + walk.ids.length;
    if (!best || cost < best.cost) {
      best = { kind: 'rewind', gate, walk, cost };
    }
  }
  return best;
}

function bestConversion(
  fromId: string,
  from: CareerNode,
  to: CareerNode,
  outgoing: Map<string, CareerEdge[]>,
  incoming: Map<string, CareerEdge[]>,
  get: (id: string) => CareerNode | undefined,
): { kind: 'conversion'; gate: CareerNode; walk: Walk; cost: number } | null {
  const canReachTo = reverseReach(to.id, incoming);
  let best: { kind: 'conversion'; gate: CareerNode; walk: Walk; cost: number } | null = null;
  for (const id of canReachTo) {
    if (id === to.id || id === fromId) {
      continue;
    }
    const gate = get(id);
    if (!gate || rank(gate.kind) < rank(from.kind)) {
      continue;
    }
    if (!looksLikeConversion(from, gate, incoming.get(id) ?? [], get)) {
      continue;
    }
    const walk = shortest(id, to.id, outgoing);
    if (!walk) {
      continue;
    }
    const cost = 4 + walk.ids.length;
    if (!best || cost < best.cost) {
      best = { kind: 'conversion', gate, walk, cost };
    }
  }
  return best;
}

function looksLikeConversion(
  from: CareerNode,
  gate: CareerNode,
  ins: CareerEdge[],
  get: (id: string) => CareerNode | undefined,
): boolean {
  if (from.kind === 'school' || from.kind === 'higher-secondary') {
    return false;
  }
  const openNotes = ins.some((edge) =>
    /any bachelor|any ug|any graduate|after any|any degree/i.test(`${edge.via} ${edge.notes}`),
  );
  if (openNotes) {
    return true;
  }
  const sameKindIn = ins.some((edge) => get(edge.from)?.kind === from.kind);
  const post =
    gate.kind === 'postgraduate' ||
    gate.kind === 'professional' ||
    gate.kind === 'entrance-exam' ||
    gate.kind === 'profession';
  return sameKindIn && post && rank(from.kind) >= rank('undergraduate');
}

function nearbyAlts(
  fromId: string,
  toId: string,
  outgoing: Map<string, CareerEdge[]>,
  get: (id: string) => CareerNode | undefined,
): SwitchAlt[] {
  const seen = new Set<string>([fromId, toId]);
  const queue = [fromId];
  const alts: SwitchAlt[] = [];
  while (queue.length && alts.length < 4) {
    const current = queue.shift()!;
    for (const edge of outgoing.get(current) ?? []) {
      if (!seen.add(edge.to)) {
        continue;
      }
      const node = get(edge.to);
      if (!node) {
        continue;
      }
      if (node.kind === 'profession') {
        alts.push({
          node,
          why: edge.via ? `Mapped from your start via ${edge.via}.` : 'Already mapped from your start.',
        });
      } else {
        queue.push(edge.to);
      }
    }
  }
  return alts;
}

function honestNotes(from: CareerNode, to: CareerNode): string[] {
  const notes = [
    'Dates, fees, and eligibility move every year. Confirm the official bulletin before anyone pays.',
  ];
  if (from.field && to.field && from.field !== to.field) {
    notes.push(`This is a field change: ${from.field} → ${to.field}.`);
  }
  return notes;
}

function shortest(fromId: string, toId: string, outgoing: Map<string, CareerEdge[]>): Walk | null {
  if (fromId === toId) {
    return { ids: [fromId], edges: [] };
  }
  const parent = new Map<string, { from: string; edge: CareerEdge }>();
  const seen = new Set<string>([fromId]);
  const queue = [fromId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of outgoing.get(current) ?? []) {
      if (!seen.add(edge.to)) {
        continue;
      }
      parent.set(edge.to, { from: current, edge });
      if (edge.to === toId) {
        queue.length = 0;
        break;
      }
      queue.push(edge.to);
    }
  }
  if (!parent.has(toId)) {
    return null;
  }
  const ids: string[] = [];
  const edges: CareerEdge[] = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const step = parent.get(cursor);
    if (!step) {
      return null;
    }
    ids.push(cursor);
    edges.push(step.edge);
    cursor = step.from;
  }
  ids.push(fromId);
  ids.reverse();
  edges.reverse();
  return { ids, edges };
}

function reverseReach(startId: string, incoming: Map<string, CareerEdge[]>): Set<string> {
  const seen = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of incoming.get(current) ?? []) {
      if (!seen.add(edge.from)) {
        continue;
      }
      queue.push(edge.from);
    }
  }
  return seen;
}

function rank(kind: string): number {
  const index = KIND_RANK.indexOf(kind as NodeKind);
  return index >= 0 ? index : 0;
}

function groupBy(edges: CareerEdge[], key: (edge: CareerEdge) => string): Map<string, CareerEdge[]> {
  const map = new Map<string, CareerEdge[]>();
  for (const edge of edges) {
    const id = key(edge);
    const list = map.get(id);
    if (list) {
      list.push(edge);
    } else {
      map.set(id, [edge]);
    }
  }
  return map;
}
