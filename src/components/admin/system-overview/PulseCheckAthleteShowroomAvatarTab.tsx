import React from 'react';
import { Box, Camera, Database, Eye, Lock, ServerCog, Shield, Sparkles, Trash2, Workflow } from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  RuntimeAlignmentPanel,
  SectionBlock,
  StepRail,
} from './PulseCheckRuntimeDocPrimitives';

const CAPTURE_ROWS = [
  ['Front', 'Face the camera. Keep head and feet inside the outline.', 'Full-body guide, head/foot zones, center line, move back/closer prompts.'],
  ['Left side', 'Turn to your left side. Keep arms relaxed and slightly away from body.', 'Side-body guide, feet alignment, match previous distance prompt.'],
  ['Back', 'Turn around with your back to the camera. Keep full body in frame.', 'Back-facing guide, head/foot zones, center line, contrast check.'],
  ['Right side', 'Turn to your right side. Keep the same stance and distance.', 'Side-body guide, stance consistency prompt, final quality check.'],
];

const STATUS_ROWS = [
  ['not_started', 'No avatar exists; Profile can show optional CTA.'],
  ['capture_in_progress', 'Local guided capture is active or resumable.'],
  ['validating / validation_failed', 'Client or backend validation is checking captures; failed angles can be retaken.'],
  ['queued / processing', 'Backend job is preparing, segmenting, fitting, texturing, cleaning, exporting, or rendering preview.'],
  ['ready', 'Profile can render the generated avatar model with thumbnail fallback.'],
  ['failed', 'Profile remains usable; user can retry or retake captures.'],
  ['disabled / deleted', 'Disabled hides the avatar while preserving available assets; deleted removes assets according to policy.'],
];

const STORAGE_ROWS = [
  ['Firestore', 'users/{uid}.avatarShowroom', 'Avatar status, sessionId, captures, modelURL, thumbnailURL, manifestURL, generatorVersion, timestamps, and failureReason.'],
  ['Capture storage', 'profile-avatars/{userId}/sessions/{sessionId}/captures/{angle}.jpg', 'Normalized full-body front, left_side, back, and right_side captures.'],
  ['Mask storage', 'profile-avatars/{userId}/sessions/{sessionId}/masks/{angle}.png', 'Generated person masks and silhouette working outputs.'],
  ['Generated assets', 'profile-avatars/{userId}/sessions/{sessionId}/generated/avatar.usdz', 'RealityKit-ready model plus optional GLB, thumbnail, preview, manifest, and quality report.'],
];

const API_ROWS = [
  ['POST /avatar-sessions', 'Create authenticated avatar capture session and required angle list.'],
  ['POST /avatar-sessions/{sessionId}/captures/{angle}', 'Upload one capture angle and return accepted or needs_retake.'],
  ['POST /avatar-sessions/{sessionId}/validate', 'Validate the full four-angle set before generation.'],
  ['POST /avatar-sessions/{sessionId}/generate', 'Queue backend generation job.'],
  ['GET /avatar-sessions/{sessionId}/status', 'Return processing stage, progress, ready model URLs, or failure reason.'],
  ['DELETE /avatar-sessions/{sessionId}', 'Delete generated assets and retained captures according to policy.'],
];

const IMPLEMENTATION_STEPS = [
  {
    title: '1. Data Model And Profile Entry',
    owner: 'PulseCheck iOS',
    body: 'Add avatar status/capture/manifest models, optional Profile-only CTA beside or under the profile image, feature flag, and empty/loading/processing/ready/failed states without touching onboarding.',
  },
  {
    title: '2. Guided Capture Shell',
    owner: 'PulseCheck iOS',
    body: 'Build intro, four-angle capture, ghost guides, angle-specific instructions, review screen, and retake-per-angle behavior before upload exists.',
  },
  {
    title: '3. Local Validation',
    owner: 'PulseCheck iOS',
    body: 'Add Vision-backed person detection, segmentation, body-pose checks, resolution, blur, exposure, one-person, full-body framing, duplicate, and scale-consistency validation.',
  },
  {
    title: '4. Upload And Session Backend',
    owner: 'Platform',
    body: 'Create authenticated session endpoints, Firebase Storage paths, Firestore status updates, backend validation responses, and per-angle retake handling.',
  },
  {
    title: '5. Mock Generation Job',
    owner: 'Platform + PulseCheck iOS',
    body: 'Use staged mock processing and a known sample USDZ to unblock the complete app journey before the real generator is ready.',
  },
  {
    title: '6. Avatar Generation Alpha',
    owner: '3D Generation',
    body: 'Implement multi-view ingest, segmentation, body fitting, clothing silhouette adaptation, texture projection, mesh cleanup, preview render, manifest, and USDZ export.',
  },
  {
    title: '7. RealityKit Showroom',
    owner: 'PulseCheck iOS',
    body: 'Build ProfileAvatarShowroomView with thumbnail-first loading, cached USDZ loading, dark showroom environment, pedestal, lighting, slow idle rotation, and Reduce Motion support.',
  },
  {
    title: '8. Lifecycle, Privacy, QA, And Rollout',
    owner: 'PulseCheck + Platform + Legal/Ops',
    body: 'Add regenerate, retake, disable, delete, retention jobs, analytics redaction, UI/backend/generation tests, internal QA, launch readiness, and production feature-flag controls.',
  },
];

const NON_GOALS = [
  'No onboarding, account setup, profile-completion, auth, or team-onboarding entry point.',
  'No body measurement, health inference, identity verification, demographic inference, recruiting score, or performance prediction.',
  'No coach, team, recruiting, share-card, or Vision Pro surface at launch.',
  'No training use of avatar photos without a future explicit opt-in.',
  'No dependency on avatar success for Profile, Today, Nora, training, or access.',
];

const TEST_AREAS = [
  'Profile CTA appears only when enabled and only on Profile.',
  'Onboarding and profile-completion paths never reference avatar creation.',
  'Four-angle capture advances, resumes, reviews, and retakes individual failed angles.',
  'Local validation blocks obvious bad captures before upload.',
  'Backend ownership checks prevent reading, writing, polling, or deleting another user session.',
  'Mock and real generation statuses render correctly in Profile.',
  'RealityKit showroom loads model, falls back to thumbnail, pauses offscreen, and respects Reduce Motion.',
  'Disable and delete differ correctly; delete removes assets and retained captures.',
  'Analytics and logs omit raw URLs, face details, body measurements, demographics, and health/performance interpretations.',
];

const PulseCheckAthleteShowroomAvatarTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Pulse Check Profile System"
        title="Optional Multi-View 3D Athlete Avatar"
        version="Avatar Spec v1.0 | April 2026"
        summary="Canonical System Overview artifact for the optional Profile-only 3D athlete avatar flow: four-angle guided capture, local validation, backend generation, USDZ output, RealityKit showroom rendering, and lifecycle controls."
        highlights={[
          {
            title: 'Profile-Only Entry',
            body: 'Avatar creation starts only beside or under the existing Profile image. It is never onboarding, account setup, profile completion, or required access.',
          },
          {
            title: 'Multi-View First',
            body: 'The MVP is front, left-side, back, and right-side guided capture feeding backend generation, not a single-photo cutout prototype.',
          },
          {
            title: 'Privacy Guardrails',
            body: 'The feature creates a visual profile avatar only. It must not infer or display health, body composition, demographics, identity confidence, or performance ability.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        sectionLabel="Source Of Truth"
        role="Locks the PulseCheck avatar product and architecture contract into the System Overview Profile System."
        sourceOfTruth="This artifact is authoritative that the avatar is optional, Profile-only, four-angle capture based, backend-generated, and rendered natively with RealityKit."
        masterReference="Detailed source files live in the PulseCheck repo at docs/specs/athlete-showroom-avatar.md and docs/specs/athlete-showroom-avatar-implementation-plan.md."
        relatedDocs={[
          'Profile Architecture',
          'Profile Snapshot & Export Spec',
          'Permissions & Visibility',
          'XCUITest Strategy',
          'Firebase Storage',
          'RealityKit',
        ]}
      />

      <SectionBlock icon={Lock} title="Product Contract">
        <CardGrid columns="xl:grid-cols-3">
          <InfoCard
            title="Entry Point"
            accent="green"
            body="The only launch point is the PulseCheck Profile surface next to or under the profile image, with copy such as Create avatar or Create your 3D avatar."
          />
          <InfoCard
            title="Primary Flow"
            accent="purple"
            body="Profile CTA -> capture intro -> front/left/back/right guided capture -> review -> upload -> generation -> RealityKit showroom."
          />
          <InfoCard
            title="Fallback Rule"
            accent="amber"
            body="The existing profile photo remains the fallback for absent, processing, failed, disabled, deleted, or model-load-failed avatar states."
          />
        </CardGrid>
        <InfoCard title="Non-Goals" accent="red" body={<BulletList items={NON_GOALS} />} />
      </SectionBlock>

      <SectionBlock icon={Camera} title="Guided Capture Contract">
        <DataTable columns={['Angle', 'Instruction', 'Live Guidance']} rows={CAPTURE_ROWS} />
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="Ghost Guides"
            accent="blue"
            body="After the front photo, the app should use a faint ghost framing guide so side and back captures match the front view scale and center."
          />
          <InfoCard
            title="Retake Behavior"
            accent="green"
            body="A failed angle never restarts the whole flow. The user can retake only the failed front, left-side, back, or right-side photo."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Eye} title="Validation And Generation">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="On-Device Validation"
            accent="blue"
            body="Vision person detection, segmentation, body-pose checks, resolution, blur, exposure, one-person detection, full-body visibility, head/feet visibility, duplicate detection, and cross-view scale checks block obvious failures before upload."
          />
          <InfoCard
            title="Backend Validation"
            accent="purple"
            body="The server validates all angles together, including angle confidence, outfit consistency, mask quality, pose consistency, occlusion risk, texture usability, face policy, and generation readiness."
          />
        </CardGrid>
        <InfoCard
          title="Generation Target"
          accent="green"
          body="Backend generation should produce a RealityKit-ready USDZ avatar, optional internal GLB/GLTF, thumbnail, preview render, manifest, quality report, generation version, and mobile-sized textures."
        />
      </SectionBlock>

      <SectionBlock icon={Database} title="Data And Storage Contract">
        <DataTable columns={['Layer', 'Path', 'Purpose']} rows={STORAGE_ROWS} />
        <DataTable columns={['Status', 'Meaning']} rows={STATUS_ROWS} />
      </SectionBlock>

      <SectionBlock icon={ServerCog} title="Backend API Contract">
        <DataTable columns={['Endpoint', 'Purpose']} rows={API_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Box} title="RealityKit Showroom Contract">
        <CardGrid columns="xl:grid-cols-4">
          <InfoCard title="Load Path" accent="blue" body="Show thumbnail first, download/cache the USDZ, then fade into the RealityKit viewer." />
          <InfoCard title="Visual Direction" accent="purple" body="Dark glass chamber, subtle pedestal, teal/lime rim glow, soft fill, contact shadow, and athletic scouting-combine tone." />
          <InfoCard title="Motion" accent="green" body="Slow idle rotation by default; pause offscreen/backgrounded; disable or minimize for Reduce Motion." />
          <InfoCard title="Failure" accent="amber" body="If model loading fails, keep thumbnail visible with retry affordance and keep Profile usable." />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Workflow} title="End-To-End Implementation Plan">
        <StepRail steps={IMPLEMENTATION_STEPS} />
      </SectionBlock>

      <SectionBlock icon={Trash2} title="Lifecycle And Retention">
        <CardGrid columns="md:grid-cols-3">
          <InfoCard
            title="Regenerate / Retake"
            accent="blue"
            body="Athletes can regenerate from existing captures when available, retake one angle, or retake all angles."
          />
          <InfoCard
            title="Disable"
            accent="amber"
            body="Disable hides the avatar from Profile but keeps generated assets while retention policy allows."
          />
          <InfoCard
            title="Delete"
            accent="red"
            body="Delete removes generated assets and retained source captures according to policy, then marks avatar state deleted."
          />
        </CardGrid>
        <InfoCard
          title="Default Retention Recommendation"
          accent="purple"
          body="Delete source captures 30 days after successful generation, delete failed sessions after 7 days, and keep generated model/thumbnail until the athlete deletes the avatar."
        />
      </SectionBlock>

      <SectionBlock icon={Shield} title="QA And Release Gates">
        <InfoCard title="Required Test Areas" accent="green" body={<BulletList items={TEST_AREAS} />} />
      </SectionBlock>

      <SectionBlock icon={Sparkles} title="Launch Scope">
        <CardGrid columns="md:grid-cols-2">
          <InfoCard
            title="First Public Version Includes"
            accent="green"
            body="Profile-only CTA, four-photo guided capture, local validation, backend generation, USDZ avatar output, RealityKit profile showroom, regenerate, retake angle, disable, delete, retention policy, and analytics redaction."
          />
          <InfoCard
            title="Deferred"
            accent="amber"
            body="Coach-facing avatar controls, team dashboards, Vision Pro mode, public sharing cards, recruiting comparisons, outfit swapping, and poseable avatar animations."
          />
        </CardGrid>
      </SectionBlock>
    </div>
  );
};

export default PulseCheckAthleteShowroomAvatarTab;
