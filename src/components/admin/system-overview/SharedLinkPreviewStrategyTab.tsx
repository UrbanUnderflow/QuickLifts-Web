import React from 'react';
import { Eye, Image as ImageIcon, Layers, Lock, ScanSearch, ShieldCheck, Workflow } from 'lucide-react';
import { BulletList, CardGrid, DataTable, DocHeader, InfoCard, RuntimeAlignmentPanel, SectionBlock, StepRail } from './PulseCheckRuntimeDocPrimitives';

const FALLBACK_ROWS = [
  ['1', 'Share-link override', 'Per-link preview config stored on the share document', 'Use only when a link truly needs custom positioning or campaign-specific artwork.'],
  ['2', 'Section-level config', 'Config keyed by `sectionId` in repo', 'This should be the normal path for system-overview artifacts.'],
  ['3', 'Default branded image', 'Static Pulse preview asset with black background and white logo', 'Prevents broken previews when no section-specific image exists.'],
  ['4', 'Dynamic title fallback', '`/og-image.png?title=<resolved title>`', 'Safe final fallback if the branded default asset is missing or temporarily unavailable.'],
];

const META_ROWS = [
  ['`og:title`', 'Resolved preview title', 'Never allow empty output. Use section label or a generic protected title.'],
  ['`og:description`', 'Resolved preview description', 'Use section description when safe; do not expose protected content.'],
  ['`og:image`', 'Absolute image URL', 'Must return `200` with an actual image content type.'],
  ['`og:url`', 'Canonical share URL', 'Always the final public share link.'],
  ['`twitter:card`', '`summary_large_image`', 'Keep consistent with Open Graph image behavior.'],
  ['`twitter:title` / `twitter:description` / `twitter:image`', 'Mirror the Open Graph values', 'Avoid divergent logic between platforms.'],
];

const DECISION_ROWS = [
  ['Protected shares', 'Do not leak `snapshotText` into metadata.', 'Use section-level safe copy or a generic protected-share description.'],
  ['Crawler rendering', 'Resolve metadata in `getServerSideProps`.', 'iMessage, Slack, and other crawlers inspect initial HTML, not client state.'],
  ['Image URL style', 'Use absolute URLs only.', 'Relative paths are a common source of silent preview failure.'],
  ['Cache posture', 'Expect preview caching by clients.', 'New share URLs usually invalidate cached bad previews faster than old links.'],
];

const CONTROL_PLANE_ROWS = [
  ['Metadata editor', 'Own explicit page-level overrides and preview images.', 'Reuse existing `manageMeta` surface, but make it read from a canonical page registry rather than a hardcoded list.'],
  ['OG preview tester', 'Show rendered crawler-facing output before and after save.', 'Fold the current tester into the metadata workflow so validation is part of editing instead of a separate step.'],
  ['Preview resolver', 'Apply fallback order and return final title, description, image, and URL.', 'One resolver should power page rendering, share links, admin previews, and validation checks.'],
  ['Page registry', 'List valid routes and templates available for metadata management.', 'This becomes the source of truth for the dropdown and removes manual page-name drift.'],
];

const REGISTRY_ROWS = [
  ['Static pages', '`/about`, `/rounds`, `/press`', 'Auto-discover from `src/pages` and expose them directly in the admin dropdown.'],
  ['Dynamic templates', '`/research/[slug]`, `/shared/system-overview/[token]`', 'Register them as template routes with sample params for testing, not as one-off hand-entered page IDs.'],
  ['Excluded routes', '`/api/*`, `_app`, `_document`, admin-only plumbing', 'Keep non-public or non-previewable routes out of the metadata editor.'],
  ['Generated output', '`pageId`, `route`, `kind`, `metaStrategy`', 'This registry should be importable by both `manageMeta` and preview-validation utilities.'],
];

const IMPLEMENTATION_FLOW = [
  {
    title: 'Resolve preview metadata on the server',
    body: 'Build one resolver that accepts token, section id, section label, description, and protection state, then returns title, description, image, and canonical URL before HTML is rendered.',
    owner: 'Next.js share route',
  },
  {
    title: 'Apply deterministic fallback order',
    body: 'Check share-level overrides first, then section-level configuration, then the branded default image, and finally the generic dynamic OG-image endpoint if the asset path is unavailable.',
    owner: 'Shared preview resolver',
  },
  {
    title: 'Render OG and Twitter tags in the initial HTML',
    body: 'The share page should emit `og:*` and `twitter:*` tags directly from server props so crawlers see complete metadata without waiting for hydration.',
    owner: 'SSR head output',
  },
  {
    title: 'Keep protected content private',
    body: 'If the share requires a passcode, metadata should remain high-level and never reveal body copy that is only meant for unlocked viewers.',
    owner: 'Resolver + share policy',
  },
];

const DEFAULT_IMAGE_OPTIONS = [
  'Create a dedicated static asset such as `https://fitwithpulse.ai/pulse-share-default.png` sized at 1200x630.',
  'Use a solid black background so previews stay high-contrast across Messages, Slack, and Twitter/X.',
  'Center the white Pulse logo with generous padding instead of adding small body text that will become illegible in compact previews.',
  'Optionally add a subtle green accent line or glow, but keep the composition logo-first so it still reads when cropped.',
];

const QA_CHECKLIST = [
  'Validate the final HTML with `curl` using a crawler user agent, not only in the browser inspector.',
  'Verify the image URL opens directly and is not blocked by auth, redirects, or incorrect content type.',
  'Test one configured section and one unconfigured section to prove the fallback path works.',
  'Test one passcode-protected link to ensure metadata stays generic and does not reveal protected body content.',
];

const VALIDATION_CHECKLIST = [
  'Run a rendered preview card inside the admin metadata flow using the same resolved values that production will serve.',
  'Re-fetch the saved page through a crawler-style fetch path and confirm the final HTML contains the expected `og:*` and `twitter:*` tags.',
  'Check that title, description, and image are all present, that the image URL is absolute, and that the image returns `200`.',
  'For protected and template-driven routes, verify the output is using safe fallback copy instead of leaking private or instance-specific body content.',
];

const SharedLinkPreviewStrategyTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Community"
        title="Shared Link Preview Strategy"
        version="Version 1.0 | March 11, 2026"
        summary="Architecture artifact for reliable social and messaging previews on shared Pulse pages. This document defines how preview metadata should be resolved, how fallback images and titles should work when a page has no custom configuration, and how protected shares should stay private without breaking previews."
        highlights={[
          {
            title: 'Server-side resolution only',
            body: 'Preview metadata must be resolved before HTML is sent so crawlers can read it without client-side execution.',
          },
          {
            title: 'Fallbacks are mandatory',
            body: 'If a share has no section-specific configuration, Pulse should still emit a valid title, description, and image instead of letting previews collapse.',
          },
          {
            title: 'Default image should be branded and minimal',
            body: 'The recommended default is a black 1200x630 asset with the white Pulse logo centered and enough margin to survive platform cropping.',
          },
          {
            title: 'Admin tooling should be one workflow',
            body: 'Metadata editing, preview testing, and page selection should operate from a shared control plane instead of separate disconnected tools.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Pulse Community artifact for share-link metadata reliability across iMessage, Slack, social previews, and other crawlers that inspect Open Graph and Twitter tags."
        sourceOfTruth="This page is authoritative for how shared links should resolve preview title, description, image, and privacy-safe fallback behavior when a section or page lacks custom preview configuration."
        masterReference="Use this artifact when implementing previews for `shared/system-overview`, future shared document routes, or any public Pulse URL where crawler-facing metadata must remain valid even without bespoke page-level config."
        relatedDocs={[
          'Product Handbooks',
          'Backend and Data',
          'Integrations',
          'End-to-End Flows',
        ]}
      />

      <SectionBlock icon={Workflow} title="Recommended Fallback Chain">
        <DataTable columns={['Priority', 'Source', 'Example', 'Use']} rows={FALLBACK_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ScanSearch} title="Required Metadata Contract">
        <DataTable columns={['Tag', 'Value', 'Rule']} rows={META_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Layers} title="Implementation Flow">
        <StepRail steps={IMPLEMENTATION_FLOW} />
      </SectionBlock>

      <SectionBlock icon={Layers} title="Admin Control Plane">
        <DataTable columns={['Layer', 'Responsibility', 'Plan']} rows={CONTROL_PLANE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ScanSearch} title="Page Registry and Dynamic Dropdown">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Why the current dropdown breaks"
            accent="red"
            body="A hardcoded page list will always drift. New routes get added in the codebase, but the metadata editor does not learn about them automatically, which creates blind spots and stale page IDs."
          />
          <InfoCard
            title="Recommended fix"
            accent="green"
            body="Generate a canonical page registry from `src/pages`, exclude non-public routes, and have `manageMeta` read directly from that registry so the dropdown updates automatically whenever a new page ships."
          />
        </CardGrid>
        <div className="mt-4">
          <DataTable columns={['Registry Group', 'Examples', 'Plan']} rows={REGISTRY_ROWS} />
        </div>
      </SectionBlock>

      <SectionBlock icon={Lock} title="Privacy and Reliability Guardrails">
        <DataTable columns={['Area', 'Decision', 'Reason']} rows={DECISION_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ImageIcon} title="Default Image Recommendation">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Recommended default"
            accent="green"
            body="Use a dedicated static preview image with a pure black background and the white Pulse logo centered. This is cleaner and more durable than trying to squeeze section text into the fallback asset."
          />
          <InfoCard
            title="Why static beats clever"
            accent="blue"
            body="A static branded fallback removes a whole class of failures. If a section forgets to define an image, the preview still works without depending on dynamic rendering or per-page art."
          />
        </CardGrid>
        <div className="mt-4">
          <BulletList items={DEFAULT_IMAGE_OPTIONS} />
        </div>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="QA Checklist">
        <BulletList items={QA_CHECKLIST} />
      </SectionBlock>

      <SectionBlock icon={Eye} title="Validation Workflow">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Fold OG preview into save flow"
            accent="blue"
            body="The existing OG preview tester should become part of the metadata editor so a user can select a page, edit metadata, see the resolved preview, save, and immediately verify the crawler-facing output in one place."
          />
          <InfoCard
            title="Test the final output, not just the form"
            accent="amber"
            body="The validation step should inspect the actual rendered HTML and the actual image response, because form values can look correct while the production tags are still wrong or incomplete."
          />
        </CardGrid>
        <div className="mt-4">
          <BulletList items={VALIDATION_CHECKLIST} />
        </div>
      </SectionBlock>

      <SectionBlock icon={Eye} title="Immediate Next Step">
        <InfoCard
          title="First route to fix"
          accent="amber"
          body="Start with the `shared/system-overview/[token]` route, then move directly into the admin control-plane refactor: replace the hardcoded page dropdown with a generated registry, fold the OG preview tester into `manageMeta`, and let the same resolver power editing, validation, and production rendering."
        />
      </SectionBlock>
    </div>
  );
};

export default SharedLinkPreviewStrategyTab;
