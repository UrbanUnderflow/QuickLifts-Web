import React from 'react';
import { AlertTriangle, Database, ListChecks, ShieldCheck, Workflow } from 'lucide-react';
import firestoreIndexes from '../../../../firestore.indexes.json';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock } from './PulseCheckRuntimeDocPrimitives';

type CompositeIndexField = {
  fieldPath: string;
  order?: string;
  arrayConfig?: string;
};

type CompositeIndex = {
  collectionGroup: string;
  queryScope: string;
  fields: CompositeIndexField[];
};

type FieldOverrideIndex = {
  queryScope: string;
  order?: string;
  arrayConfig?: string;
};

type FieldOverride = {
  collectionGroup: string;
  fieldPath: string;
  ttl?: boolean;
  indexes: FieldOverrideIndex[];
};

const compositeIndexes = firestoreIndexes.indexes as CompositeIndex[];
const fieldOverrides = firestoreIndexes.fieldOverrides as FieldOverride[];

function formatIndexFields(fields: CompositeIndexField[]): string {
  return fields
    .map((field) =>
      field.order
        ? `${field.fieldPath} ${field.order}`
        : `${field.fieldPath} ARRAY ${field.arrayConfig}`
    )
    .join(' | ');
}

function formatFieldOverrideIndexes(indexes: FieldOverrideIndex[]): string {
  return indexes
    .map((index) =>
      index.order
        ? `${index.queryScope}: ${index.order}`
        : `${index.queryScope}: ARRAY ${index.arrayConfig}`
    )
    .join(' | ');
}

const collectionGroups = Array.from(
  new Set([
    ...compositeIndexes.map((index) => index.collectionGroup),
    ...fieldOverrides.map((override) => override.collectionGroup),
  ])
).sort();

const REGISTRY_ROWS = collectionGroups.map((collectionGroup) => {
  const matchingIndexes = compositeIndexes.filter((index) => index.collectionGroup === collectionGroup);
  const matchingOverrides = fieldOverrides.filter((override) => override.collectionGroup === collectionGroup);
  const primaryQueryShape = matchingIndexes[0] ? formatIndexFields(matchingIndexes[0].fields) : 'Field override only';

  return [
    `\`${collectionGroup}\``,
    String(matchingIndexes.length),
    String(matchingOverrides.length),
    primaryQueryShape,
  ];
});

const HEALTH_CONTEXT_ROWS = compositeIndexes
  .filter((index) => index.collectionGroup.startsWith('health-context-'))
  .map((index) => [
    `\`${index.collectionGroup}\``,
    index.queryScope,
    formatIndexFields(index.fields),
    index.collectionGroup === 'health-context-snapshots'
      ? 'Canonical athlete snapshot runtime read path.'
      : 'Reserved for future canonical health-context scale-out.',
  ]);

const OVERRIDE_ROWS = fieldOverrides.map((override) => [
  `\`${override.collectionGroup}\``,
  `\`${override.fieldPath}\``,
  override.ttl ? 'TTL enabled' : 'TTL disabled',
  formatFieldOverrideIndexes(override.indexes),
]);

const OPERATING_RULE_ROWS = [
  ['Add or change an indexed query', 'Update the shared `firestore.indexes.json` registry in the same change.', 'Prevents silent query drift.'],
  ['Create an index manually in Firebase console', 'Reconcile that change back into the registry file immediately.', 'No console-only indexes allowed to linger.'],
  ['Index needed for a feature or migration', 'Deploy the registry update to both `quicklifts-dev-01` and `quicklifts-dd3f1`.', 'Keeps environments in parity.'],
  ['Open a PR with index-affecting code', 'Reference the registry change in the same PR and handbook review.', 'Makes index work visible during review.'],
  ['Temporary environment drift is unavoidable', 'Document the exception, owner, target date, and cleanup plan inside the handbook / rollout notes.', 'Avoids invisible operational debt.'],
];

const CHANGE_CHECKLIST = [
  'Confirm the query shape and whether a new composite or field override is actually required.',
  'Update `QuickLifts-Web/firestore.indexes.json` before the implementation ships.',
  'Verify the registry artifact still reflects the intended collection and query path.',
  'Deploy the updated index set to both `quicklifts-dev-01` and `quicklifts-dd3f1`.',
  'Do not consider the task done until both environments have the index or an explicit temporary exception is documented.',
];

const RETIREMENT_CHECKLIST = [
  'Identify the exact query or runtime path the index currently supports and link the owning file or service.',
  'Verify the dependent query has been deleted, rewritten, or no longer requires that index shape.',
  'Search the codebase for the collection group and relevant query fields to confirm no remaining callers exist.',
  'Confirm the index is not still required by admin tooling, migrations, scheduled jobs, Cloud Functions, or back-office workflows.',
  'Remove the index from `QuickLifts-Web/firestore.indexes.json` in the same change that removes the dependency.',
  'Deploy the removal to both `quicklifts-dev-01` and `quicklifts-dd3f1` and document the retirement in the handbook or rollout notes.',
];

const ENVIRONMENT_ROWS = [
  ['Shared registry file', '`QuickLifts-Web/firestore.indexes.json`', 'Current source-of-truth file that should cover both environments.'],
  ['Development project', '`quicklifts-dev-01`', 'Must stay in sync with the shared registry so feature work can validate against the real contract.'],
  ['Production project', '`quicklifts-dd3f1`', 'Must stay in sync with the shared registry so prod never accumulates undocumented index debt.'],
  ['Health-context addition', '`health-context-snapshots` athlete/date query', 'Current new index added for the canonical snapshot read path.'],
  ['Macra Nora chat', '`noraChat` day/timestamp query', 'Current new index added for Macra Ask Nora daily chat loading.'],
  ['Macra Nora addition', '`noraChireaeRequests` user/date query', 'Current new index added for Ask Nora request thread loading.'],
];

const LEGACY_NORMALIZATION_ROWS = [
  [
    '`daily-reflections`',
    '`__name__ DESCENDING`',
    'Active',
    'Backs the admin daily-prompt listing in `src/api/firebase/admin/methods.ts` via `orderBy(\'__name__\', \'desc\')`.',
  ],
  [
    'Legacy file shape',
    '`fields: []`',
    'Retired',
    'That older registry representation was misleading and could not be recreated through the current Firestore Admin API.',
  ],
];

const FirestoreIndexRegistryTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Platform Data Operations"
        title="Firestore Index Registry"
        version="Version 0.1 | March 17, 2026"
        summary="Internal registry and operating policy for Cloud Firestore indexes across Fit With Pulse, Pulse Check, Macra, and shared platform surfaces. This artifact makes the shared `firestore.indexes.json` file the visible source of truth, tracks current registry coverage, and defines the discipline required to keep development and production index posture in sync."
        highlights={[
          {
            title: 'Registry Tied To Real File',
            body: 'The handbook reflects the same `firestore.indexes.json` file that engineering should deploy, reducing documentation drift.',
          },
          {
            title: 'Parity Is A Rule',
            body: 'A new index is not complete when it exists in one environment. The target posture is dev and prod parity from one shared registry.',
          },
          {
            title: 'No Console-Only Drift',
            body: 'Emergency or manual Firebase console changes must be reconciled back into the registry file immediately.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Operational registry artifact for Firestore composite indexes and field overrides across the shared Pulse database. It establishes the deployable source of truth, exposes the current inventory shape, and defines the process discipline for future index changes."
        sourceOfTruth="This page is subordinate to but powered by `QuickLifts-Web/firestore.indexes.json`. The registry file is the deployable contract; this artifact makes it visible and operationally explicit."
        masterReference="Use this page whenever a query change, migration, new feature, or operational job introduces a new Firestore index requirement. Index work is not done until the registry file and both environments are aligned."
        relatedDocs={[
          'Health Context Firestore Schema & Index Spec',
          'Health Context Engineering Task Breakdown',
          'Health Context Implementation Rollout Plan',
        ]}
      />

      <SectionBlock icon={Database} title="Registry Posture">
        <CardGrid columns="md:grid-cols-4">
          <InfoCard
            title="Composite Indexes"
            accent="blue"
            body={`${compositeIndexes.length} total composite indexes are currently tracked in the shared registry file.`}
          />
          <InfoCard
            title="Field Overrides"
            accent="green"
            body={`${fieldOverrides.length} field overrides are currently tracked in the shared registry file.`}
          />
          <InfoCard
            title="Collection Groups"
            accent="amber"
            body={`${collectionGroups.length} collection groups currently have explicit index or field-override coverage in the registry.`}
          />
          <InfoCard
            title="Parity Target"
            accent="red"
            body="The registry should be the superset contract for both development and production, not a best-effort local snapshot."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ListChecks} title="Environment Coverage">
        <DataTable columns={['Scope', 'Value', 'Role']} rows={ENVIRONMENT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Legacy Normalization Notes">
        <DataTable columns={['Collection', 'Canonical Shape', 'Status', 'Operational Note']} rows={LEGACY_NORMALIZATION_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Current Decision"
            accent="green"
            body="Keep the `daily-reflections` index. It is still in active use by the admin daily-prompt tooling and should not be treated as stale platform debt."
          />
          <InfoCard
            title="Removal Rule"
            accent="amber"
            body="Only remove this index after the admin daily-prompt flow no longer queries `daily-reflections` by document id ordering and the dependent code path is deleted or rewritten."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Database} title="Collection Registry Summary">
        <DataTable columns={['Collection Group', 'Composite Indexes', 'Field Overrides', 'Primary Query Shape']} rows={REGISTRY_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Health Context Index Registry">
        <DataTable columns={['Collection Group', 'Query Scope', 'Index Shape', 'Role']} rows={HEALTH_CONTEXT_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Field Override Registry">
        <DataTable columns={['Collection Group', 'Field Path', 'TTL', 'Registered Modes']} rows={OVERRIDE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Index Operating Rules">
        <DataTable columns={['When', 'Required Action', 'Why']} rows={OPERATING_RULE_ROWS} />
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Registry Rule"
            accent="blue"
            body={<BulletList items={['Every index-affecting change updates the shared registry file.', 'The handbook registry is expected to reflect that file.', 'No private side lists or console-only memory systems.']} />}
          />
          <InfoCard
            title="Parity Rule"
            accent="green"
            body={<BulletList items={['Deploy the same registry contract to dev and prod.', 'Do not let one environment silently drift ahead.', 'If an exception exists, document it with owner and cleanup date.']} />}
          />
          <InfoCard
            title="Review Rule"
            accent="amber"
            body={<BulletList items={['Index changes should be visible in the same PR as the query change.', 'Reviewers should treat missing registry updates as incomplete work.', 'Migration and ops changes must follow the same rule as product features.']} />}
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Workflow} title="Definition Of Done For Index Changes">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Required Checklist"
            accent="purple"
            body={<BulletList items={CHANGE_CHECKLIST} />}
          />
          <InfoCard
            title="Current Discipline"
            accent="red"
            body="Because Fit With Pulse, Pulse Check, and Macra share platform data contracts, index drift becomes system drift. Treat index maintenance as platform configuration work, not optional cleanup."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={AlertTriangle} title="Index Retirement Checklist">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Removal Gate"
            accent="amber"
            body={<BulletList items={RETIREMENT_CHECKLIST} />}
          />
          <InfoCard
            title="Retirement Rule"
            accent="blue"
            body="An index is only removable when its dependent query path is truly gone across product code, admin surfaces, jobs, and operational tooling. Registry cleanup should happen in the same change as the dependency removal, not later."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default FirestoreIndexRegistryTab;
