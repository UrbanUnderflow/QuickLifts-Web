export type LifecycleStatus = 'active' | 'beta' | 'planned' | 'deprecated';

export type MapLayer = 'surface' | 'backend' | 'integration' | 'agent';

export type ConnectionType = 'data' | 'auth' | 'events';

export interface SourceRef {
  label: string;
  path: string;
}

export interface FeatureSpec {
  id: string;
  name: string;
  persona: string;
  outcome: string;
  entryPoints: string[];
  dependentServices: string[];
  firestoreCollections: string[];
  integrations: string[];
  owner: string;
  releaseChannel: string;
  status: LifecycleStatus;
  sourceRefs: SourceRef[];
}

export interface ProductHandbook {
  id: string;
  name: string;
  platform: string;
  summary: string;
  owner: string;
  repo: string;
  releaseChannel: string;
  status: LifecycleStatus;
  keyOutcomes: string[];
  featureInventory: FeatureSpec[];
}

export interface BackendServiceSpec {
  id: string;
  name: string;
  purpose: string;
  owner: string;
  status: LifecycleStatus;
  environments: string[];
  keyDependencies: string[];
  sourceRefs: SourceRef[];
}

export interface DataCollectionSpec {
  id: string;
  name: string;
  purpose: string;
  writtenBy: string;
  readBy: string;
  criticalFields: string[];
  sourceRefs: SourceRef[];
}

export interface IntegrationSpec {
  id: string;
  name: string;
  purpose: string;
  owner: string;
  credentialSource: string;
  products: string[];
  status: LifecycleStatus;
  sourceRefs: SourceRef[];
}

export interface EcosystemNode {
  id: string;
  name: string;
  layer: MapLayer;
  status: LifecycleStatus;
  description: string;
  owner: string;
  x: number;
  y: number;
}

export interface EcosystemConnection {
  from: string;
  to: string;
  type: ConnectionType;
}

export interface EcosystemMapSpec {
  nodes: EcosystemNode[];
  connections: EcosystemConnection[];
}

export interface EndToEndFlowStep {
  id: string;
  actor: string;
  action: string;
  output: string;
}

export interface EndToEndFlowSpec {
  id: string;
  name: string;
  trigger: string;
  involvedProducts: string[];
  backendPath: string[];
  collectionsTouched: string[];
  integrations: string[];
  failurePoints: string[];
  steps: EndToEndFlowStep[];
}

export interface OwnershipSpec {
  domain: string;
  primaryOwner: string;
  backupOwner: string;
  releaseCadence: string;
  runbookPath: string;
}

export interface RiskGapSpec {
  id: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  impact: string;
  mitigation: string;
  owner: string;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export interface ExecutiveSummarySpec {
  mission: string;
  audience: string;
  whatChangedRecently: string[];
  highlights: string[];
}

export interface SystemOverviewSection {
  id: string;
  label: string;
  description: string;
  parentSectionId?: string;
}

export interface SystemOverviewManifest {
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: SystemOverviewSection[];
  executiveSummary: ExecutiveSummarySpec;
  ecosystemMap: EcosystemMapSpec;
  products: ProductHandbook[];
  backendServices: BackendServiceSpec[];
  dataCollections: DataCollectionSpec[];
  integrations: IntegrationSpec[];
  flows: EndToEndFlowSpec[];
  ownershipMatrix: OwnershipSpec[];
  risksAndGaps: RiskGapSpec[];
  glossary: GlossaryTerm[];
}
