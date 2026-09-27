export type NodeIconKey =
  | 'atom'
  | 'ball'
  | 'bolt'
  | 'book'
  | 'brain'
  | 'briefcase'
  | 'building'
  | 'calculator'
  | 'cap'
  | 'chip'
  | 'coins'
  | 'default'
  | 'dna'
  | 'earth'
  | 'exam'
  | 'flask'
  | 'food'
  | 'gear'
  | 'hardhat'
  | 'laptop'
  | 'leaf'
  | 'medical'
  | 'mic'
  | 'microscope'
  | 'palette'
  | 'paw'
  | 'people'
  | 'pill'
  | 'pillar'
  | 'plane'
  | 'scale'
  | 'shield'
  | 'ship'
  | 'tooth'
  | 'wrench';

export interface IconableNode {
  id?: string;
  title?: string;
  label?: string;
  field?: string;
  kind?: string;
}

export interface NodeIconSpec {
  key: NodeIconKey;
  wash: string;
  ink: string;
}

const PALETTE: Record<NodeIconKey, Pick<NodeIconSpec, 'wash' | 'ink'>> = {
  atom: { wash: '#e0f2fe', ink: '#0284c7' },
  ball: { wash: '#ffedd5', ink: '#ea580c' },
  bolt: { wash: '#fef3c7', ink: '#d97706' },
  book: { wash: '#fef3c7', ink: '#ca8a04' },
  brain: { wash: '#fce7f3', ink: '#db2777' },
  briefcase: { wash: '#e0f2f1', ink: '#0f766e' },
  building: { wash: '#e0e7ff', ink: '#4f46e5' },
  calculator: { wash: '#ecfccb', ink: '#65a30d' },
  cap: { wash: '#e0e7ff', ink: '#4338ca' },
  chip: { wash: '#ede9fe', ink: '#7c3aed' },
  coins: { wash: '#d1fae5', ink: '#059669' },
  default: { wash: '#e2e8f0', ink: '#475569' },
  dna: { wash: '#ccfbf1', ink: '#0d9488' },
  earth: { wash: '#dbeafe', ink: '#2563eb' },
  exam: { wash: '#ffedd5', ink: '#c2410c' },
  flask: { wash: '#ccfbf1', ink: '#0f766e' },
  food: { wash: '#ffe4e6', ink: '#e11d48' },
  gear: { wash: '#ffedd5', ink: '#c2410c' },
  hardhat: { wash: '#fef3c7', ink: '#b45309' },
  laptop: { wash: '#dbeafe', ink: '#2563eb' },
  leaf: { wash: '#dcfce7', ink: '#16a34a' },
  medical: { wash: '#ffe4e6', ink: '#e11d48' },
  mic: { wash: '#fce7f3', ink: '#db2777' },
  microscope: { wash: '#e0e7ff', ink: '#4f46e5' },
  palette: { wash: '#fce7f3', ink: '#be185d' },
  paw: { wash: '#ffedd5', ink: '#c2410c' },
  people: { wash: '#e0e7ff', ink: '#4f46e5' },
  pill: { wash: '#ede9fe', ink: '#7c3aed' },
  pillar: { wash: '#e0e7ff', ink: '#3730a3' },
  plane: { wash: '#e0f2fe', ink: '#0284c7' },
  scale: { wash: '#ede9fe', ink: '#6d28d9' },
  shield: { wash: '#dbeafe', ink: '#1d4ed8' },
  ship: { wash: '#e0f2fe', ink: '#0369a1' },
  tooth: { wash: '#f1f5f9', ink: '#0f766e' },
  wrench: { wash: '#ffedd5', ink: '#b45309' },
};

const FIELD_ICON: Record<string, NodeIconKey> = {
  ayush: 'medical',
  accountancy: 'coins',
  aerospace: 'plane',
  agriculture: 'leaf',
  'allied health': 'medical',
  architecture: 'building',
  automotive: 'gear',
  aviation: 'plane',
  biotech: 'dna',
  business: 'briefcase',
  chemical: 'flask',
  chemistry: 'flask',
  civil: 'building',
  commerce: 'coins',
  communications: 'mic',
  computing: 'laptop',
  'cost accounting': 'calculator',
  defence: 'shield',
  dentistry: 'tooth',
  design: 'palette',
  'earth science': 'earth',
  economics: 'coins',
  education: 'book',
  electrical: 'bolt',
  electronics: 'bolt',
  energy: 'bolt',
  engineering: 'gear',
  environment: 'leaf',
  fashion: 'palette',
  finance: 'coins',
  'fine arts': 'palette',
  'food science': 'food',
  forensics: 'microscope',
  foundation: 'book',
  governance: 'pillar',
  healthcare: 'medical',
  hospitality: 'food',
  humanities: 'book',
  law: 'scale',
  'life sciences': 'dna',
  management: 'briefcase',
  maritime: 'ship',
  mathematics: 'calculator',
  mechanical: 'gear',
  media: 'mic',
  medicine: 'medical',
  mining: 'hardhat',
  'performing arts': 'mic',
  pharmacy: 'pill',
  physics: 'atom',
  psychology: 'brain',
  'public health': 'medical',
  'public service': 'pillar',
  research: 'microscope',
  science: 'flask',
  'skilled trades': 'wrench',
  'social science': 'people',
  'social sector': 'people',
  'social work': 'people',
  sports: 'ball',
  statistics: 'calculator',
  technology: 'laptop',
  veterinary: 'paw',
  vocational: 'wrench',
};

const KEYWORD_ICON: [RegExp, NodeIconKey][] = [
  [/\b(software|developer|programmer|full[- ]?stack|front[- ]?end|back[- ]?end|sde)\b/, 'laptop'],
  [/\b(cloud[- ]?architect|cloud[- ]?engineer|solutions architect)\b/, 'laptop'],
  [/\b(data scientist|machine learning|ml[- ]engineer|artificial intelligence|prompt engineer)\b/, 'chip'],
  [/\b(doctor|physician|surgeon|mbbs|md\b|medical officer)\b/, 'medical'],
  [/\b(nurse|nursing|anm|gnm)\b/, 'medical'],
  [/\b(lawyer|advocate|legal|llb|llm|judge)\b/, 'scale'],
  [/\b(teacher|professor|lecturer|b\.?ed|m\.?ed)\b/, 'book'],
  [/\b(chartered accountant|chartered-accountant|cost accountant|company secretary|company-secretary)\b/, 'coins'],
  [/\b(civil servant|ias|ips|ifs|upsc|bureaucrat)\b/, 'pillar'],
  [/\b(pilot|cabin crew|aviator)\b/, 'plane'],
  [/\b(architect|b\.?arch)\b/, 'building'],
  [/\b(dentist|bds|mds)\b/, 'tooth'],
  [/\b(pharmacist|b\.?pharm)\b/, 'pill'],
  [/\b(veterinar|vet\b)\b/, 'paw'],
  [/\b(psycholog|counsellor|counselor)\b/, 'brain'],
  [/\b(chef|hotel|hospitality)\b/, 'food'],
  [/\b(journalist|anchor|reporter|content)\b/, 'mic'],
  [/\b(digital marketing|marketing manager|supply chain)\b/, 'briefcase'],
  [/\b(sustainability|esg)\b/, 'leaf'],
  [/\b(ev engineer|electric vehicle)\b/, 'bolt'],
  [/\b(robotic|robotics|automation engineer|plc)\b/, 'bolt'],
  [/\b(healthcare admin|hospital admin)\b/, 'building'],
  [/\b(designer|ux|ui|fashion|animator)\b/, 'palette'],
  [/\b(soldier|army|navy|air force|nda|defence officer)\b/, 'shield'],
  [/\b(farmer|agricult)\b/, 'leaf'],
  [/\b(scientist|research fellow)\b/, 'microscope'],
];

function spec(key: NodeIconKey): NodeIconSpec {
  return { key, ...PALETTE[key] };
}

export function iconForNode(node?: IconableNode | null): NodeIconSpec {
  if (!node) {
    return spec('default');
  }
  const hay = `${node.id || ''} ${node.title || node.label || ''}`.toLowerCase();
  for (const [pattern, key] of KEYWORD_ICON) {
    if (pattern.test(hay)) {
      return spec(key);
    }
  }
  const field = node.field?.trim().toLowerCase() || '';
  if (field && FIELD_ICON[field]) {
    return spec(FIELD_ICON[field]);
  }
  switch (node.kind) {
    case 'entrance-exam':
      return spec('exam');
    case 'profession':
      return spec('briefcase');
    case 'vocational':
      return spec('wrench');
    case 'school':
    case 'higher-secondary':
      return spec('book');
    case 'undergraduate':
    case 'postgraduate':
    case 'professional':
      return spec('cap');
    default:
      return spec('default');
  }
}
