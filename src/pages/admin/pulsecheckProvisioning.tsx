import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Head from 'next/head';
import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  Clipboard,
  ClipboardList,
  Download,
  ExternalLink,
  HeartPulse,
  Image as ImageIcon,
  Loader2,
  MailPlus,
  MoreHorizontal,
  Plus,
  Search,
  ShieldPlus,
  Sparkles,
  Users2,
  X,
} from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useDispatch } from 'react-redux';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { useUser } from '../../hooks/useUser';
import { showToast } from '../../redux/toastSlice';
import GuidedTour, { type GuidedTourStep } from '../../components/onboarding/GuidedTour';
import { storage } from '../../api/firebase/config';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import { normalizeStaffCapabilities } from '../../api/firebase/pulsecheckProvisioning/staffCapabilities';
import { STAFF_PERMISSIONS as ADMIN_PERMISSIONS } from '../../lib/staffPermissions';
import {
  fetchPulseCheckSportConfiguration,
  getDefaultPulseCheckSports,
  type PulseCheckSportConfigurationEntry,
} from '../../api/firebase/pulsecheckSportConfig';
import {
  derivePulseCheckTeamPlanBypass,
  getDefaultPulseCheckIntakeForm,
  getDefaultPulseCheckRequiredConsents,
  getDefaultPulseCheckTeamCommercialConfig,
  PULSECHECK_INTAKE_FORM_VERSION,
} from '../../api/firebase/pulsecheckProvisioning/types';
import type {
  PulseCheckAdminContact,
  CreatePulseCheckPilotCohortInput,
  CreatePulseCheckPilotInput,
  CreatePulseCheckOrganizationInput,
  CreatePulseCheckTeamInput,
  PulseCheckAuntEdnaClinicianProfile,
  PulseCheckClinicianBridgeMode,
  PulseCheckClinicianProfileType,
  PulseCheckInviteActivity,
  PulseCheckInviteLink,
  PulseCheckInvitePolicy,
  PulseCheckOrganization,
  PulseCheckOrganizationStatus,
  PulseCheckPilot,
  PulseCheckPilotCohort,
  PulseCheckPilotCohortStatus,
  PulseCheckIntakeForm,
  PulseCheckIntakeKind,
  PulseCheckPilotStudyMode,
  PulseCheckRequiredConsentDocument,
  PulseCheckRevenueRecipientRole,
  StaffPermission,
  SurveyQuestion,
  PulseCheckStudyPosture,
  PulseCheckTeam,
  PulseCheckTeamCommercialConfig,
  PulseCheckTeamMembershipRole,
  PulseCheckTeamCommercialModel,
  PulseCheckTeamEscalationRoute,
  PulseCheckTeamPlanStatus,
  PulseCheckTeamStatus,
} from '../../api/firebase/pulsecheckProvisioning/types';
import { resolvePulseCheckInvitePreviewImage } from '../../utils/pulsecheckInviteLinks';

const defaultOrganizationForm: CreatePulseCheckOrganizationInput = {
  displayName: '',
  legalName: '',
  organizationType: 'athletic-department',
  primaryCustomerAdminName: '',
  primaryCustomerAdminEmail: '',
  defaultStudyPosture: 'operational',
  defaultClinicianBridgeMode: 'optional',
  notes: '',
};

const ORGANIZATION_TYPE_OPTIONS = [
  { value: 'athletic-department', label: 'Athletic Department' },
  { value: 'professional-sports-team', label: 'Professional Sports Team' },
  { value: 'athletic-team', label: 'Athletic Team' },
  { value: 'athletic-club', label: 'Athletic Club' },
  { value: 'sports-academy', label: 'Sports Academy' },
  { value: 'school-program', label: 'School Program' },
  { value: 'brand', label: 'Brand' },
  { value: 'clinic-partner', label: 'Clinic Partner' },
  { value: 'research-partner', label: 'Research Partner' },
  { value: 'other', label: 'Other' },
];

const defaultTeamForm: CreatePulseCheckTeamInput = {
  organizationId: '',
  displayName: '',
  teamType: 'sport-team',
  sportOrProgram: '',
  sportId: '',
  defaultAdminName: '',
  defaultAdminEmail: '',
  defaultInvitePolicy: 'admin-and-staff',
  commercialConfig: getDefaultPulseCheckTeamCommercialConfig(),
  defaultEscalationRoute: 'hotline',
  defaultClinicianProfileId: '',
  defaultClinicianProfileName: '',
  defaultClinicianProfileType: 'group',
  defaultClinicianProfileSource: 'pulsecheck-local',
  notes: '',
};

const defaultPilotForm: CreatePulseCheckPilotInput = {
  organizationId: '',
  teamId: '',
  name: '',
  objective: '',
  studyMode: 'operational',
  checkpointCadence: 'weekly',
  status: 'active',
  startAt: null,
  endAt: null,
  notes: '',
};

const defaultCohortForm: CreatePulseCheckPilotCohortInput = {
  organizationId: '',
  teamId: '',
  pilotId: '',
  name: '',
  cohortType: 'intervention-group',
  assignmentRule: 'manual-staff-assignment',
  reportingTags: [],
  status: 'draft',
  notes: '',
};

const TEAM_TYPE_OPTIONS = [
  { value: 'sport-team', label: 'Sport Team' },
  { value: 'performance-staff-unit', label: 'Performance Staff Unit' },
  { value: 'sports-medicine-unit', label: 'Sports Medicine Unit' },
  { value: 'rehab-group', label: 'Rehab Group' },
  { value: 'academy-squad', label: 'Academy Squad' },
  { value: 'club-team', label: 'Club Team' },
  { value: 'brand-athlete-group', label: 'Brand Athlete Group' },
  { value: 'research-group', label: 'Research Group' },
  { value: 'other', label: 'Other' },
];

const TEAM_ESCALATION_ROUTE_OPTIONS: Array<{
  value: PulseCheckTeamEscalationRoute;
  label: string;
  description: string;
}> = [
  {
    value: 'hotline',
    label: 'Hotline',
    description: 'Athletes are directed to 988 during escalation and stay on the watch list until an admin clears them.',
  },
  {
    value: 'clinician',
    label: 'Clinician',
    description: 'Athletes follow the clinician escalation lane and the team must have a clinician profile attached.',
  },
];

const HOTLINE_RESOURCE = {
  name: '988 Suicide & Crisis Lifeline',
  phone: '988',
  url: 'https://988lifeline.org',
};

const TEAM_COMMERCIAL_MODEL_OPTIONS: Array<{ value: PulseCheckTeamCommercialModel; label: string }> = [
  { value: 'athlete-pay', label: 'Athlete Pay' },
  { value: 'team-plan', label: 'Team Plan' },
];

const TEAM_PLAN_STATUS_OPTIONS: Array<{ value: PulseCheckTeamPlanStatus; label: string }> = [
  { value: 'inactive', label: 'Inactive' },
  { value: 'active', label: 'Active' },
];

const TEAM_REVENUE_RECIPIENT_ROLE_OPTIONS: Array<{ value: PulseCheckRevenueRecipientRole; label: string }> = [
  { value: 'team-admin', label: 'Team Admin' },
  { value: 'coach', label: 'Coach' },
  { value: 'organization-owner', label: 'Organization Owner' },
];

// The revenue recipient is now a specific person; keep the legacy role field in
// sync (best-effort) from the picked staff member's team role.
const mapMembershipRoleToRecipientRole = (
  role?: PulseCheckTeamMembershipRole
): PulseCheckRevenueRecipientRole => (role === 'coach' ? 'coach' : 'team-admin');

const PILOT_STUDY_MODE_OPTIONS: Array<{ value: PulseCheckPilotStudyMode; label: string }> = [
  { value: 'operational', label: 'Operational' },
  { value: 'pilot', label: 'Pilot' },
  { value: 'research', label: 'Research' },
];

const CHECKPOINT_CADENCE_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom / Manual' },
];

const PILOT_DURATION_OPTIONS = [
  { value: '7', label: '1 Week' },
  { value: '14', label: '2 Weeks' },
  { value: '28', label: '4 Weeks' },
  { value: 'custom', label: 'Custom' },
];

const COHORT_TYPE_OPTIONS = [
  { value: 'intervention-group', label: 'Intervention Group' },
  { value: 'control-group', label: 'Control Group' },
  { value: 'position-group', label: 'Position Group' },
  { value: 'rehab-group', label: 'Rehab Group' },
  { value: 'return-to-play-group', label: 'Return to Play Group' },
  { value: 'development-group', label: 'Development Group' },
  { value: 'leadership-group', label: 'Leadership Group' },
  { value: 'other', label: 'Other' },
];

const CLINICIAN_PROFILE_TYPE_OPTIONS: Array<{ value: PulseCheckClinicianProfileType; label: string }> = [
  { value: 'group', label: 'Clinical Group' },
  { value: 'individual', label: 'Individual Clinician' },
  { value: 'provider', label: 'Provider Network' },
];

type StatusDisplay = {
  label: string;
  tone: string;
  dotTone: string;
};

const formatEnumLabel = (value?: string | null) => {
  if (!value) return 'Not set';
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatTimestamp = (value?: Timestamp | null) => {
  if (!value || typeof value.toDate !== 'function') return 'Pending write';
  return value.toDate().toLocaleString();
};

const toDateValue = (value?: Timestamp | Date | null) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  return null;
};

// Derives the activation funnel status for an admin-activation link: whether the
// activation email was sent, whether the recipient opened the link, and whether they
// have onboarded (redeemed). "Onboarded" comes from the link's redeemed state; "opened"
// from recorded page-view/authenticated-view activity.
const summarizeAdminActivation = (
  link: PulseCheckInviteLink | null | undefined,
  activity: PulseCheckInviteActivity[] | undefined
) => {
  const events = activity || [];
  const openEvent = events.find(
    (event) => event.eventType === 'page-view' || event.eventType === 'authenticated-view'
  );
  const redeemEvent = events.find((event) => event.eventType === 'redeem-succeeded');
  const onboarded = link?.status === 'redeemed' || Boolean(redeemEvent);
  return {
    sent: link?.lastEmailStatus === 'sent' || (link?.emailSendCount || 0) > 0,
    sendFailed: link?.lastEmailStatus === 'failed',
    sentAt: link?.lastEmailSentAt || null,
    sendCount: link?.emailSendCount || 0,
    opened: Boolean(openEvent) || onboarded,
    openedAt: openEvent?.createdAt || null,
    onboarded,
    onboardedAt: link?.redeemedAt || redeemEvent?.createdAt || null,
    onboardedBy: link?.redeemedByEmail || '',
  };
};

const getOrganizationStatusDisplay = (status?: PulseCheckOrganizationStatus): StatusDisplay => {
  switch (status) {
    case 'ready-for-activation':
      return {
        label: 'Ready for Activation',
        tone: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-50',
        dotTone: 'bg-cyan-300',
      };
    case 'active':
      return {
        label: 'Active',
        tone: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-50',
        dotTone: 'bg-emerald-300',
      };
    case 'implementation-hold':
      return {
        label: 'Implementation Hold',
        tone: 'border-rose-400/40 bg-rose-500/15 text-rose-50',
        dotTone: 'bg-rose-300',
      };
    case 'archived':
      return {
        label: 'Archived',
        tone: 'border-zinc-600/60 bg-zinc-500/10 text-zinc-200',
        dotTone: 'bg-zinc-400',
      };
    case 'draft':
    case 'provisioning':
    default:
      return {
        label: 'Provisioning',
        tone: 'border-amber-400/40 bg-amber-500/15 text-amber-50',
        dotTone: 'bg-amber-300',
      };
  }
};

const getTeamStatusDisplay = (status?: PulseCheckTeamStatus): StatusDisplay => {
  switch (status) {
    case 'ready-for-activation':
      return {
        label: 'Ready for Activation',
        tone: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-50',
        dotTone: 'bg-cyan-300',
      };
    case 'active':
      return {
        label: 'Active',
        tone: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-50',
        dotTone: 'bg-emerald-300',
      };
    case 'paused':
      return {
        label: 'Paused',
        tone: 'border-zinc-600/60 bg-zinc-500/10 text-zinc-200',
        dotTone: 'bg-zinc-400',
      };
    case 'archived':
      return {
        label: 'Archived',
        tone: 'border-zinc-600/60 bg-zinc-500/10 text-zinc-200',
        dotTone: 'bg-zinc-400',
      };
    case 'draft':
    case 'provisioning':
    default:
      return {
        label: 'Provisioning',
        tone: 'border-amber-400/40 bg-amber-500/15 text-amber-50',
        dotTone: 'bg-amber-300',
      };
  }
};

const getPilotStatusDisplay = (status?: PulseCheckPilot['status']): StatusDisplay => {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        tone: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-50',
        dotTone: 'bg-emerald-300',
      };
    case 'paused':
      return {
        label: 'Paused',
        tone: 'border-zinc-600/60 bg-zinc-500/10 text-zinc-200',
        dotTone: 'bg-zinc-400',
      };
    case 'completed':
      return {
        label: 'Completed',
        tone: 'border-zinc-600/60 bg-zinc-500/10 text-zinc-200',
        dotTone: 'bg-zinc-400',
      };
    case 'archived':
      return {
        label: 'Archived',
        tone: 'border-zinc-600/60 bg-zinc-500/10 text-zinc-200',
        dotTone: 'bg-zinc-400',
      };
    case 'draft':
    default:
      return {
        label: 'Draft',
        tone: 'border-violet-400/40 bg-violet-500/15 text-violet-50',
        dotTone: 'bg-violet-300',
      };
  }
};

const getDerivedPilotStatusDisplay = (pilot: PulseCheckPilot) => {
  const derivedStatus = getDerivedPilotStatusValue(pilot);
  return getPilotStatusDisplay(derivedStatus);
};

const getDerivedPilotStatusValue = (pilot: PulseCheckPilot): PulseCheckPilot['status'] => {
  if (pilot.status === 'archived' || pilot.status === 'completed' || pilot.status === 'paused') {
    return pilot.status;
  }

  const now = new Date();
  const endAt = toDateValue(pilot.endAt);

  if (endAt && endAt.getTime() < now.getTime()) return 'completed';
  return 'active';
};

const getCohortStatusDisplay = (status?: PulseCheckPilotCohortStatus): StatusDisplay => {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        tone: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-50',
        dotTone: 'bg-emerald-300',
      };
    case 'paused':
      return {
        label: 'Paused',
        tone: 'border-zinc-600/60 bg-zinc-500/10 text-zinc-200',
        dotTone: 'bg-zinc-400',
      };
    case 'archived':
      return {
        label: 'Archived',
        tone: 'border-zinc-600/60 bg-zinc-500/10 text-zinc-200',
        dotTone: 'bg-zinc-400',
      };
    case 'draft':
    default:
      return {
        label: 'Draft',
        tone: 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-50',
        dotTone: 'bg-fuchsia-300',
      };
  }
};

const getCohortTypeLabel = (value?: string) =>
  COHORT_TYPE_OPTIONS.find((option) => option.value === value)?.label || value || 'Not set';

const getCohortAssignmentRuleLabel = (value?: string) => {
  if (!value || value === 'manual-staff-assignment') return 'Manual assignment by staff';
  return value;
};
const getTeamEscalationRouteLabel = (value?: PulseCheckTeamEscalationRoute) =>
  TEAM_ESCALATION_ROUTE_OPTIONS.find((option) => option.value === value)?.label || 'Clinician';

const normalizeCohortTag = (value: string) => value.trim().replace(/\s+/g, '-').toLowerCase();
const sanitizeStorageSegment = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, '-');

type OnboardingModalState =
  | {
      channel: 'admin';
      organization: PulseCheckOrganization;
      team: PulseCheckTeam;
      clinicianProfile?: PulseCheckAuntEdnaClinicianProfile | null;
    }
  | {
      channel: 'clinician';
      organization: PulseCheckOrganization;
      team: PulseCheckTeam;
      clinicianProfile: PulseCheckAuntEdnaClinicianProfile;
    };

type ProvisioningWizardStep = 'org' | 'team' | 'route' | 'activation' | 'pilot' | 'cohort';
type DashboardStatusFilter = 'all' | 'prov' | 'ready' | 'active';

const PROVISIONING_WIZARD_STEPS: Array<{ key: ProvisioningWizardStep; label: string }> = [
  { key: 'org', label: 'Organization' },
  { key: 'team', label: 'Team' },
  { key: 'route', label: 'Support Route' },
  { key: 'activation', label: 'Admin Activation' },
  { key: 'pilot', label: 'Pilot' },
  { key: 'cohort', label: 'Cohort' },
];

const PULSECHECK_ADMIN_TOUR_STEPS: GuidedTourStep[] = [
  {
    selector: '[data-tour="admin-provisioning-header"]',
    title: 'Start from the provisioning header',
    body: 'This is the school launch control room. Use the top actions to open the playbook, export data, or create a new organization.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="admin-provisioning-actions"]',
    title: 'Create or review launch records',
    body: 'New Organization starts the provisioning flow. The Playbook stays close by when you need the onboarding sequence or call templates.',
    placement: 'left',
  },
  {
    selector: '[data-tour="admin-provisioning-filters"]',
    title: 'Find the school quickly',
    body: 'Use search and status filters to find the school, then expand the organization to review teams, links, support routing, and tracker status.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="admin-organization-list"]',
    title: 'Open the organization and team',
    body: 'The organization row holds team records, admin onboarding links, invite artwork, commercial settings, and launch readiness.',
    placement: 'top',
  },
  {
    selector: '[data-tour="admin-team-tracker"]',
    title: 'Monitor launch readiness visually',
    body: 'The tracker is intentionally simple: one progress bar, four status labels, and one dropdown per launch step.',
    placement: 'top',
  },
  {
    selector: '[data-tour="admin-launch-day-link"]',
    title: 'Use Launch-Day Mode in the room',
    body: 'Open this during Meeting 3 to track athlete invites, setup, device status, and next action while the team is present.',
    placement: 'left',
  },
];

const isPulseCheckTestHarnessText = (value?: string | null) => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized.startsWith('e2e ') ||
    normalized.startsWith('e2e-') ||
    normalized.startsWith('e2e_') ||
    normalized.includes(' e2e ') ||
    normalized.includes(' e2e-') ||
    normalized.includes('e2e-pulsecheck') ||
    normalized.endsWith('@pulse.test') ||
    normalized.endsWith('@pulsecheck.test') ||
    normalized.includes('playwright')
  );
};

const isPulseCheckTestHarnessOrganization = (organization: PulseCheckOrganization) =>
  [
    organization.id,
    organization.displayName,
    organization.legalName,
    organization.primaryCustomerAdminEmail,
    organization.implementationOwnerEmail,
    organization.notes,
  ].some(isPulseCheckTestHarnessText);

const isPulseCheckTestHarnessTeam = (team: PulseCheckTeam) =>
  [
    team.id,
    team.organizationId,
    team.displayName,
    team.siteLabel,
    team.defaultAdminEmail,
    team.notes,
  ].some(isPulseCheckTestHarnessText);

const isPulseCheckTestHarnessPilot = (pilot: PulseCheckPilot) =>
  [
    pilot.id,
    pilot.organizationId,
    pilot.teamId,
    pilot.name,
    pilot.ownerInternalEmail,
    pilot.notes,
  ].some(isPulseCheckTestHarnessText);

const isPulseCheckTestHarnessCohort = (cohort: PulseCheckPilotCohort) =>
  [
    cohort.id,
    cohort.organizationId,
    cohort.teamId,
    cohort.pilotId,
    cohort.name,
    cohort.notes,
  ].some(isPulseCheckTestHarnessText);

const isPulseCheckTestHarnessInviteLink = (link: PulseCheckInviteLink) =>
  [
    link.id,
    link.organizationId,
    link.teamId,
    link.pilotId,
    link.cohortId,
    link.recipientName,
    link.targetEmail,
    link.createdByEmail,
    link.redeemedByEmail,
  ].some(isPulseCheckTestHarnessText);

const shouldShowPulseCheckTestHarnessData = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get('showTestData');

  if (queryValue === '1' || queryValue === 'true') return true;
  if (queryValue === '0' || queryValue === 'false') return false;

  // When deep-linked to a specific team (e.g. from the dashboard "Set up"
  // intake action), always reveal it so the target resolves regardless of the
  // test-harness filter.
  if (params.get('focusTeam')) return true;

  return window.localStorage.getItem('pulsecheck_show_test_harness_data') === 'true';
};

const getOrganizationFilterStatus = (status?: PulseCheckOrganizationStatus): DashboardStatusFilter => {
  if (status === 'ready-for-activation') return 'ready';
  if (status === 'active') return 'active';
  return 'prov';
};

const getDashboardStatusClassName = (display: StatusDisplay) => {
  switch (display.label) {
    case 'Ready for Activation':
      return 'pcp-s-ready';
    case 'Active':
      return 'pcp-s-active';
    case 'Completed':
    case 'Archived':
    case 'Paused':
      return 'pcp-s-done';
    case 'Implementation Hold':
      return 'pcp-s-done';
    case 'Draft':
      return 'pcp-s-ready';
    case 'Provisioning':
    default:
      return 'pcp-s-prov';
  }
};

// Reusable collapsible card. Header is always visible (title + optional actions
// + chevron); the body shows only when open. Used for org and team section
// cards so the console stays scannable.
const CollapsibleCard: React.FC<{
  title: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  preview?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  id?: string;
  children: React.ReactNode;
}> = ({ title, open, onToggle, preview, actions, className, id, children }) => (
  <div id={id} className={className || 'pcp-card'} style={{ scrollMarginTop: 16 }}>
    {/* Whole header row toggles (not just the title). `actions` stops propagation
        so its own buttons still work without collapsing the card. */}
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <ChevronDown
          style={{ width: 16, height: 16, flexShrink: 0, color: 'rgba(255,255,255,0.5)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
        <span className="pcp-card-title" style={{ marginBottom: 0 }}>{title}</span>
      </div>
      {actions ? <div onClick={(e) => e.stopPropagation()}>{actions}</div> : null}
    </div>
    {open ? (
      <div style={{ marginTop: 12 }}>{children}</div>
    ) : preview ? (
      <div onClick={onToggle} style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>{preview}</div>
    ) : null}
  </div>
);

const PulseCheckProvisioningPage: React.FC = () => {
  const currentUser = useUser();
  const dispatch = useDispatch();
  const [organizations, setOrganizations] = useState<PulseCheckOrganization[]>([]);
  const [teams, setTeams] = useState<PulseCheckTeam[]>([]);
  const [pilots, setPilots] = useState<PulseCheckPilot[]>([]);
  const [pilotCohorts, setPilotCohorts] = useState<PulseCheckPilotCohort[]>([]);
  const [clinicianProfiles, setClinicianProfiles] = useState<PulseCheckAuntEdnaClinicianProfile[]>([]);
  const [inviteLinks, setInviteLinks] = useState<PulseCheckInviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgForm, setOrgForm] = useState<CreatePulseCheckOrganizationInput>(defaultOrganizationForm);
  // The org created during the current wizard run. When set, re-saving the org
  // step updates it instead of creating a duplicate (so Back → edit works).
  const [wizardOrganizationId, setWizardOrganizationId] = useState<string | null>(null);
  const [teamForm, setTeamForm] = useState<CreatePulseCheckTeamInput>(defaultTeamForm);
  const [pilotForm, setPilotForm] = useState<CreatePulseCheckPilotInput>(defaultPilotForm);
  const [cohortForm, setCohortForm] = useState<CreatePulseCheckPilotCohortInput>(defaultCohortForm);
  const [cohortTagsInput, setCohortTagsInput] = useState('');
  const [skipCohortForNow, setSkipCohortForNow] = useState(false);
  const [pilotStartDate, setPilotStartDate] = useState('');
  const [pilotIsIndefinite, setPilotIsIndefinite] = useState(false);
  const [pilotDurationPreset, setPilotDurationPreset] = useState('14');
  const [pilotCustomDays, setPilotCustomDays] = useState('');
  const [clinicianSearchTerm, setClinicianSearchTerm] = useState('');
  const [clinicianLinkMode, setClinicianLinkMode] = useState<'existing' | 'create'>('existing');
  const [clinicianSubmitting, setClinicianSubmitting] = useState(false);
  const [newClinicianProfileForm, setNewClinicianProfileForm] = useState({
    displayName: '',
    organizationName: '',
    email: '',
    profileType: 'group' as PulseCheckClinicianProfileType,
  });
  const [orgSubmitting, setOrgSubmitting] = useState(false);
  const [teamSubmitting, setTeamSubmitting] = useState(false);
  const [pilotSubmitting, setPilotSubmitting] = useState(false);
  const [cohortSubmitting, setCohortSubmitting] = useState(false);
  const [cohortInviteCreatingId, setCohortInviteCreatingId] = useState<string | null>(null);
  const [pilotInviteCreatingId, setPilotInviteCreatingId] = useState<string | null>(null);
  const [activationCreatingTeamId, setActivationCreatingTeamId] = useState<string | null>(null);
  const [clinicianLinkCreatingProfileId, setClinicianLinkCreatingProfileId] = useState<string | null>(null);
  const [adminLinkCreatingEmail, setAdminLinkCreatingEmail] = useState<string | null>(null);
  const [teamCommercialSavingId, setTeamCommercialSavingId] = useState<string | null>(null);
  const [teamConsentDrafts, setTeamConsentDrafts] = useState<Record<string, PulseCheckRequiredConsentDocument[]>>({});
  const [teamConsentSavingId, setTeamConsentSavingId] = useState<string | null>(null);
  const [teamIntakeDrafts, setTeamIntakeDrafts] = useState<Record<string, SurveyQuestion[]>>({});
  const [teamIntakeSavingKey, setTeamIntakeSavingKey] = useState<string | null>(null);
  const [adminTourOpen, setAdminTourOpen] = useState(false);
  const [pilotStudyModeDrafts, setPilotStudyModeDrafts] = useState<Record<string, PulseCheckPilotStudyMode>>({});
  const [pilotStudyModeSavingId, setPilotStudyModeSavingId] = useState<string | null>(null);
  const [onboardingModal, setOnboardingModal] = useState<OnboardingModalState | null>(null);
  const [additionalAdminForm, setAdditionalAdminForm] = useState({ name: '', email: '' });
  // Capabilities chosen per admin recipient (keyed by email). Defaults to
  // administrative; stamped on the activation link when it's created/regenerated.
  const [adminCapabilitiesByEmail, setAdminCapabilitiesByEmail] = useState<Record<string, StaffPermission[]>>({});
  const [additionalAdminSubmitting, setAdditionalAdminSubmitting] = useState(false);
  // Email-of-recipient currently being sent/resent an activation email (admin channel).
  const [activationEmailSendingEmail, setActivationEmailSendingEmail] = useState<string | null>(null);
  // Per-token invite activity loaded for the open onboarding modal (opened / onboarded status).
  const [modalActivityByToken, setModalActivityByToken] = useState<Record<string, PulseCheckInviteActivity[]>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [organizationImageUploadingId, setOrganizationImageUploadingId] = useState<string | null>(null);
  const [teamImageUploadingId, setTeamImageUploadingId] = useState<string | null>(null);
  const [coachPhotoUploadingToken, setCoachPhotoUploadingToken] = useState<string | null>(null);
  const [sportOptions, setSportOptions] = useState<PulseCheckSportConfigurationEntry[]>(() => getDefaultPulseCheckSports());
  const [teamCommercialDrafts, setTeamCommercialDrafts] = useState<Record<string, PulseCheckTeamCommercialConfig>>({});
  type OrgStaffOption = { userId: string; name: string; email?: string; role: PulseCheckTeamMembershipRole; title?: string };
  const [orgStaffById, setOrgStaffById] = useState<Record<string, OrgStaffOption[]>>({});
  const [isProvisioningModalOpen, setIsProvisioningModalOpen] = useState(false);
  const [activeWizardStep, setActiveWizardStep] = useState<ProvisioningWizardStep>('org');
  const [organizationSearch, setOrganizationSearch] = useState('');
  const [organizationStatusFilter, setOrganizationStatusFilter] = useState<DashboardStatusFilter>('all');
  const [expandedOrganizationIds, setExpandedOrganizationIds] = useState<string[]>([]);
  const [collapsedTeamIds, setCollapsedTeamIds] = useState<Set<string>>(() => new Set());
  const toggleTeamCollapsed = (teamId: string) => {
    setCollapsedTeamIds((current) => {
      const next = new Set(current);
      if (next.has(teamId)) next.delete(teamId); else next.add(teamId);
      return next;
    });
  };
  const [expandedOrgCardKeys, setExpandedOrgCardKeys] = useState<Set<string>>(() => new Set());
  const toggleOrgCard = (key: string) => {
    setExpandedOrgCardKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const [expandedTeamIds, setExpandedTeamIds] = useState<string[]>([]);
  const [expandedPilotIds, setExpandedPilotIds] = useState<string[]>([]);
  const [hasInitializedExpansionState, setHasInitializedExpansionState] = useState(false);
  const [activationDraft, setActivationDraft] = useState<{
    teamId: string;
    channel: 'admin' | 'clinician';
    targetEmail: string;
  }>({
    teamId: '',
    channel: 'admin',
    targetEmail: '',
  });
  const organizationFormRef = useRef<HTMLFormElement | null>(null);
  const teamRouteFormRef = useRef<HTMLFormElement | null>(null);
  const activationFormRef = useRef<HTMLFormElement | null>(null);
  const pilotFormRef = useRef<HTMLFormElement | null>(null);
  const cohortFormRef = useRef<HTMLFormElement | null>(null);

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === teamForm.organizationId) || null,
    [organizations, teamForm.organizationId]
  );
  const selectedPilotTeam = useMemo(
    () => teams.find((team) => team.id === pilotForm.teamId) || null,
    [teams, pilotForm.teamId]
  );
  const selectedCohortPilot = useMemo(
    () => pilots.find((pilot) => pilot.id === cohortForm.pilotId) || null,
    [pilots, cohortForm.pilotId]
  );
  const teamAdminOptions = useMemo(() => {
    if (!selectedOrganization) return [];

    const contacts: Array<{ value: string; label: string; name: string; email: string }> = [];
    const seenEmails = new Set<string>();
    const pushContact = (name?: string, email?: string) => {
      if (!email) return;
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || seenEmails.has(normalizedEmail)) return;
      seenEmails.add(normalizedEmail);
      contacts.push({
        value: email,
        label: name ? `${name} (${email})` : email,
        name: name || '',
        email,
      });
    };

    pushContact(selectedOrganization.primaryCustomerAdminName, selectedOrganization.primaryCustomerAdminEmail);
    (selectedOrganization.additionalAdminContacts || []).forEach((contact) => pushContact(contact.name, contact.email));

    return contacts;
  }, [selectedOrganization]);
  const onboardingAdminRecipients = useMemo(() => {
    if (!onboardingModal || onboardingModal.channel !== 'admin') return [];

    const recipients: Array<PulseCheckAdminContact & { kind: 'primary' | 'additional' | 'team-default' }> = [];
    const seenEmails = new Set<string>();
    const pushRecipient = (kind: 'primary' | 'additional' | 'team-default', name?: string, email?: string) => {
      if (!email) return;
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || seenEmails.has(normalizedEmail)) return;
      seenEmails.add(normalizedEmail);
      recipients.push({ kind, name: name || '', email });
    };

    pushRecipient('primary', onboardingModal.organization.primaryCustomerAdminName, onboardingModal.organization.primaryCustomerAdminEmail);
    (onboardingModal.organization.additionalAdminContacts || []).forEach((contact) =>
      pushRecipient('additional', contact.name, contact.email)
    );
    pushRecipient('team-default', onboardingModal.team.defaultAdminName, onboardingModal.team.defaultAdminEmail);

    return recipients;
  }, [onboardingModal]);
  const filteredClinicianProfiles = useMemo(() => {
    const normalizedTerm = clinicianSearchTerm.trim().toLowerCase();
    if (!normalizedTerm) return clinicianProfiles;

    return clinicianProfiles.filter((profile) =>
      [profile.displayName, profile.organizationName, profile.email, profile.profileType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedTerm))
    );
  }, [clinicianProfiles, clinicianSearchTerm]);
  const selectedClinicianProfile = useMemo(
    () => clinicianProfiles.find((profile) => profile.id === teamForm.defaultClinicianProfileId) || null,
    [clinicianProfiles, teamForm.defaultClinicianProfileId]
  );
  const draftTeamUsesClinicianRoute = teamForm.defaultEscalationRoute === 'clinician';
  const teamSportOptions = useMemo(() => {
    if (!teamForm.sportOrProgram.trim()) return sportOptions;
    if (sportOptions.some((sport) => sport.name.toLowerCase() === teamForm.sportOrProgram.trim().toLowerCase())) {
      return sportOptions;
    }

    return [
      ...sportOptions,
      {
        id: `legacy-${teamForm.sportOrProgram.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: teamForm.sportOrProgram.trim(),
        emoji: '🏅',
        positions: ['Individual'],
        sortOrder: sportOptions.length,
      },
    ];
  }, [sportOptions, teamForm.sportOrProgram]);
  const clinicianProfileById = useMemo(
    () => new Map(clinicianProfiles.map((profile) => [profile.id, profile])),
    [clinicianProfiles]
  );
  const inviteLinksByTeamId = useMemo(() => {
    const nextMap = new Map<string, PulseCheckInviteLink[]>();
    inviteLinks.forEach((link) => {
      const current = nextMap.get(link.teamId) || [];
      current.push(link);
      nextMap.set(link.teamId, current);
    });
    return nextMap;
  }, [inviteLinks]);
  const reusableCohortInviteByCohortId = useMemo(() => {
    const nextMap = new Map<string, PulseCheckInviteLink>();
    inviteLinks.forEach((link) => {
      if (link.status !== 'active') return;
      if (link.redemptionMode !== 'general') return;
      if (link.inviteType !== 'team-access') return;
      if (link.teamMembershipRole !== 'athlete') return;
      if (!link.cohortId) return;
      // Keep the most recent reusable link per cohort.
      if (!nextMap.has(link.cohortId)) nextMap.set(link.cohortId, link);
    });
    return nextMap;
  }, [inviteLinks]);
  // Reusable athlete invites that enroll straight into a pilot with NO cohort.
  const reusablePilotInviteByPilotId = useMemo(() => {
    const nextMap = new Map<string, PulseCheckInviteLink>();
    inviteLinks.forEach((link) => {
      if (link.status !== 'active') return;
      if (link.redemptionMode !== 'general') return;
      if (link.inviteType !== 'team-access') return;
      if (link.teamMembershipRole !== 'athlete') return;
      if (!link.pilotId) return;
      if (link.cohortId) return;
      if (!nextMap.has(link.pilotId)) nextMap.set(link.pilotId, link);
    });
    return nextMap;
  }, [inviteLinks]);
  const inviteLinksByClinicianProfileId = useMemo(() => {
    const nextMap = new Map<string, PulseCheckInviteLink[]>();
    inviteLinks.forEach((link) => {
      if (!link.clinicianProfileId) return;
      const current = nextMap.get(link.clinicianProfileId) || [];
      current.push(link);
      nextMap.set(link.clinicianProfileId, current);
    });
    return nextMap;
  }, [inviteLinks]);
  const pilotCohortsByPilotId = useMemo(() => {
    const nextMap = new Map<string, PulseCheckPilotCohort[]>();
    pilotCohorts.forEach((cohort) => {
      const current = nextMap.get(cohort.pilotId) || [];
      current.push(cohort);
      nextMap.set(cohort.pilotId, current);
    });
    return nextMap;
  }, [pilotCohorts]);
  const organizationBundles = useMemo(
    () =>
      organizations.map((organization) => {
        const teamsForOrganization = teams
          .filter((team) => team.organizationId === organization.id)
          .map((team) => ({
            team,
            pilots: pilots
              .filter((pilot) => pilot.teamId === team.id)
              .map((pilot) => ({
                pilot,
                cohorts: pilotCohortsByPilotId.get(pilot.id) || [],
              })),
            clinicianProfile: team.defaultClinicianProfileId
              ? clinicianProfileById.get(team.defaultClinicianProfileId) || null
              : null,
            adminActivationLinks:
              (inviteLinksByTeamId.get(team.id) || []).filter((link) => link.inviteType === 'admin-activation' && link.status === 'active'),
            // All admin-activation links for this team regardless of status (active +
            // redeemed + revoked) — lets the card/modal reflect sent and onboarded state.
            adminActivationLinksAll:
              (inviteLinksByTeamId.get(team.id) || []).filter((link) => link.inviteType === 'admin-activation'),
            clinicianOnboardingLink:
              team.defaultClinicianProfileId
                ? (inviteLinksByClinicianProfileId.get(team.defaultClinicianProfileId) || []).find(
                    (link) => link.inviteType === 'clinician-onboarding' && link.status === 'active' && link.teamId === team.id
                  ) || null
                : null,
          }));

        return {
          organization,
          teams: teamsForOrganization,
        };
      }),
    [organizations, teams, pilots, clinicianProfileById, inviteLinksByTeamId, inviteLinksByClinicianProfileId, pilotCohortsByPilotId]
  );
  const mapSummary = useMemo(
    () => ({
      organizationCount: organizations.length,
      teamCount: teams.length,
      pilotCount: pilots.length,
      cohortCount: pilotCohorts.length,
      readyCount:
        organizations.filter((organization) => organization.status === 'ready-for-activation').length +
        teams.filter((team) => team.status === 'ready-for-activation').length,
      activeCount:
        organizations.filter((organization) => organization.status === 'active').length +
        teams.filter((team) => team.status === 'active').length,
      provisioningCount: organizations.filter((organization) => getOrganizationFilterStatus(organization.status) === 'prov').length,
      organizationReadyCount: organizations.filter((organization) => getOrganizationFilterStatus(organization.status) === 'ready').length,
      organizationActiveCount: organizations.filter((organization) => getOrganizationFilterStatus(organization.status) === 'active').length,
    }),
    [organizations, teams, pilots, pilotCohorts]
  );
  // The wizard always operates on a single organization. For a brand-new org
  // that's wizardOrganizationId; when the wizard is opened against an existing
  // org (e.g. add team / jump to a later step) it's carried on teamForm. Scope
  // every in-wizard team picker to this org so we never surface other orgs' teams.
  const wizardOrganizationContextId = wizardOrganizationId || teamForm.organizationId || '';
  const wizardTeams = useMemo(
    () =>
      wizardOrganizationContextId
        ? teams.filter((team) => team.organizationId === wizardOrganizationContextId)
        : teams,
    [teams, wizardOrganizationContextId]
  );
  const wizardPilots = useMemo(
    () =>
      wizardOrganizationContextId
        ? pilots.filter((pilot) => pilot.organizationId === wizardOrganizationContextId)
        : pilots,
    [pilots, wizardOrganizationContextId]
  );
  const selectedActivationTeam = useMemo(
    () => teams.find((team) => team.id === activationDraft.teamId) || null,
    [teams, activationDraft.teamId]
  );
  const selectedActivationClinicianProfile = useMemo(
    () =>
      selectedActivationTeam?.defaultClinicianProfileId
        ? clinicianProfileById.get(selectedActivationTeam.defaultClinicianProfileId) || null
        : null,
    [selectedActivationTeam, clinicianProfileById]
  );
  const filteredOrganizationBundles = useMemo(() => {
    const normalizedSearch = organizationSearch.trim().toLowerCase();

    return organizationBundles.filter(({ organization, teams: bundledTeams }) => {
      if (
        organizationStatusFilter !== 'all' &&
        getOrganizationFilterStatus(organization.status) !== organizationStatusFilter
      ) {
        return false;
      }

      if (!normalizedSearch) return true;

      const searchDocument = [
        organization.displayName,
        organization.legalName,
        organization.organizationType,
        organization.primaryCustomerAdminEmail,
        ...bundledTeams.flatMap(({ team, pilots: bundledPilots, clinicianProfile }) => [
          team.displayName,
          team.sportOrProgram,
          team.defaultAdminEmail,
          team.defaultInvitePolicy,
          clinicianProfile?.displayName || '',
          ...bundledPilots.flatMap(({ pilot, cohorts }) => [
            pilot.name,
            pilot.objective || '',
            ...cohorts.flatMap((cohort) => [cohort.name, ...(cohort.reportingTags || [])]),
          ]),
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchDocument.includes(normalizedSearch);
    });
  }, [organizationBundles, organizationSearch, organizationStatusFilter]);
  const onboardingModalLinks = useMemo(() => {
    if (!onboardingModal) return [];

    return inviteLinks.filter((link) => {
      if (link.status !== 'active') return false;
      if (link.organizationId !== onboardingModal.organization.id) return false;
      if (link.teamId !== onboardingModal.team.id) return false;

      if (onboardingModal.channel === 'admin') {
        return link.inviteType === 'admin-activation';
      }

      return link.inviteType === 'clinician-onboarding' && link.clinicianProfileId === onboardingModal.clinicianProfile.id;
    });
  }, [inviteLinks, onboardingModal]);

  // Admin-activation links for the open modal's team, including redeemed/revoked, so
  // the status panel can reflect a recipient who has already onboarded.
  const onboardingModalAdminLinks = useMemo(() => {
    if (!onboardingModal || onboardingModal.channel !== 'admin') return [];
    return inviteLinks.filter(
      (link) =>
        link.inviteType === 'admin-activation' &&
        link.organizationId === onboardingModal.organization.id &&
        link.teamId === onboardingModal.team.id
    );
  }, [inviteLinks, onboardingModal]);

  // Load per-link activity (opened / redeem events) for the admin links shown in the
  // open onboarding modal so we can surface whether the recipient has viewed it.
  useEffect(() => {
    if (!onboardingModal || onboardingModal.channel !== 'admin') return;
    const tokens = onboardingModalAdminLinks.map((link) => link.token).filter(Boolean);
    if (tokens.length === 0) return;
    let cancelled = false;
    void Promise.all(
      tokens.map(async (token) => {
        try {
          const activity = await pulseCheckProvisioningService.listInviteActivityByToken(token);
          return [token, activity] as const;
        } catch (error) {
          console.error('[PulseCheckProvisioning] Failed to load invite activity:', error);
          return [token, [] as PulseCheckInviteActivity[]] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setModalActivityByToken((current) => {
        const next = { ...current };
        entries.forEach(([token, activity]) => {
          next[token] = activity;
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [onboardingModal, onboardingModalAdminLinks]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [
        organizationResults,
        teamResults,
        pilotResults,
        pilotCohortResults,
        clinicianProfileResults,
        inviteLinkResults,
        sportConfigurationResults,
      ] = await Promise.all([
        pulseCheckProvisioningService.listOrganizations(),
        pulseCheckProvisioningService.listTeams(),
        pulseCheckProvisioningService.listPilots(),
        pulseCheckProvisioningService.listPilotCohorts(),
        pulseCheckProvisioningService.listClinicianProfiles(),
          pulseCheckProvisioningService.listInviteLinks(),
          fetchPulseCheckSportConfiguration(),
        ]);
      const showTestHarnessData = shouldShowPulseCheckTestHarnessData();
      const visibleOrganizationResults = showTestHarnessData
        ? organizationResults
        : organizationResults.filter((organization) => !isPulseCheckTestHarnessOrganization(organization));
      const visibleOrganizationIds = new Set(visibleOrganizationResults.map((organization) => organization.id));
      const visibleTeamResults = showTestHarnessData
        ? teamResults
        : teamResults.filter(
            (team) => visibleOrganizationIds.has(team.organizationId) && !isPulseCheckTestHarnessTeam(team)
          );
      const visibleTeamIds = new Set(visibleTeamResults.map((team) => team.id));
      const visiblePilotResults = showTestHarnessData
        ? pilotResults
        : pilotResults.filter(
            (pilot) =>
              visibleOrganizationIds.has(pilot.organizationId) &&
              visibleTeamIds.has(pilot.teamId) &&
              !isPulseCheckTestHarnessPilot(pilot)
          );
      const visiblePilotIds = new Set(visiblePilotResults.map((pilot) => pilot.id));
      const visiblePilotCohortResults = showTestHarnessData
        ? pilotCohortResults
        : pilotCohortResults.filter(
            (cohort) =>
              visibleOrganizationIds.has(cohort.organizationId) &&
              visibleTeamIds.has(cohort.teamId) &&
              visiblePilotIds.has(cohort.pilotId) &&
              !isPulseCheckTestHarnessCohort(cohort)
          );
      const visiblePilotCohortIds = new Set(visiblePilotCohortResults.map((cohort) => cohort.id));
      const visibleInviteLinkResults = showTestHarnessData
        ? inviteLinkResults
        : inviteLinkResults.filter(
            (link) =>
              visibleOrganizationIds.has(link.organizationId) &&
              visibleTeamIds.has(link.teamId) &&
              (!link.pilotId || visiblePilotIds.has(link.pilotId)) &&
              (!link.cohortId || visiblePilotCohortIds.has(link.cohortId)) &&
              !isPulseCheckTestHarnessInviteLink(link)
          );

      setOrganizations(visibleOrganizationResults);
      setTeams(visibleTeamResults);
      setTeamCommercialDrafts((current) => {
        const next = { ...current };
        visibleTeamResults.forEach((team) => {
          next[team.id] = current[team.id] || team.commercialConfig;
        });
        return next;
      });
      setPilots(visiblePilotResults);
      setPilotStudyModeDrafts(
        visiblePilotResults.reduce<Record<string, PulseCheckPilotStudyMode>>((next, pilot) => {
          next[pilot.id] = pilot.studyMode;
          return next;
        }, {})
      );
      setPilotCohorts(visiblePilotCohortResults);
      setClinicianProfiles(clinicianProfileResults);
      setInviteLinks(visibleInviteLinkResults);
      setSportOptions(sportConfigurationResults);
      setTeamForm((current) => ({
        ...current,
        organizationId: current.organizationId || visibleOrganizationResults[0]?.id || '',
        defaultAdminName:
          current.defaultAdminName ||
          visibleOrganizationResults.find((organization) => organization.id === (current.organizationId || visibleOrganizationResults[0]?.id))
            ?.primaryCustomerAdminName ||
          '',
        defaultAdminEmail:
          current.defaultAdminEmail ||
          visibleOrganizationResults.find((organization) => organization.id === (current.organizationId || visibleOrganizationResults[0]?.id))
            ?.primaryCustomerAdminEmail ||
          '',
      }));
      setPilotForm((current) => ({
        ...current,
        organizationId: current.organizationId || visibleTeamResults[0]?.organizationId || '',
        teamId: current.teamId || visibleTeamResults[0]?.id || '',
        status: 'active',
      }));
      setCohortForm((current) => ({
        ...current,
        organizationId: current.organizationId || visibleTeamResults[0]?.organizationId || '',
        teamId: current.teamId || visibleTeamResults[0]?.id || '',
        pilotId: current.pilotId || visiblePilotResults[0]?.id || '',
      }));
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to load provisioning data:', error);
      setMessage({ type: 'error', text: 'Failed to load PulseCheck provisioning data.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Load onboarded staff per org (for the revenue-recipient picker), once each.
  useEffect(() => {
    const orgIds = Array.from(new Set(teams.map((team) => team.organizationId).filter(Boolean)));
    orgIds.forEach((orgId) => {
      if (orgStaffById[orgId]) return;
      void pulseCheckProvisioningService
        .listOrganizationStaffMembers(orgId)
        .then((staff) => setOrgStaffById((current) => ({ ...current, [orgId]: staff })))
        .catch((error) => {
          console.error('[PulseCheckProvisioning] Failed to load org staff:', error);
          setOrgStaffById((current) => ({ ...current, [orgId]: [] }));
        });
    });
  }, [teams, orgStaffById]);

  useEffect(() => {
    if (loading || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('tour') === '1') {
      setAdminTourOpen(true);
    }
  }, [loading]);

  // Deep-link focus: when arriving from the dashboard "Set up" intake action,
  // pre-load default questions if none exist yet and scroll to that team's
  // intake editor.
  const [intakeFocusHandled, setIntakeFocusHandled] = useState(false);
  // Team whose intake editor is open in the "Manage intake" modal (keeps the
  // bulky question editor out of the inline dashboard).
  const [intakeModalTeamId, setIntakeModalTeamId] = useState<string | null>(null);
  // Which intake tab (athlete / coach) the modal is showing.
  const [intakeModalKind, setIntakeModalKind] = useState<PulseCheckIntakeKind>('athlete');
  // Team whose consent editor is open in the "Manage consents" modal (keeps the
  // bulky consent editor out of the inline dashboard, mirroring intake).
  const [consentModalTeamId, setConsentModalTeamId] = useState<string | null>(null);
  // Active consent tab within the "Manage consents" modal (one tab per consent form).
  const [consentModalIndex, setConsentModalIndex] = useState(0);
  useEffect(() => {
    if (loading || intakeFocusHandled || typeof window === 'undefined' || teams.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const focusTeam = params.get('focusTeam');
    if (!focusTeam) return;
    setIntakeFocusHandled(true);

    // Make sure the team card is expanded so the deep-link lands on its content.
    setCollapsedTeamIds((prev) => {
      if (!prev.has(focusTeam)) return prev;
      const next = new Set(prev);
      next.delete(focusTeam);
      return next;
    });
    const focusIntake = params.get('focusIntake');
    const isIntakeFocus = focusIntake === 'athlete' || focusIntake === 'coach';
    if (isIntakeFocus) {
      // Open the (collapsed-by-default) intake editor card so the deep-link lands on it.
      setExpandedOrgCardKeys((prev) => {
        if (prev.has(`${focusTeam}:intakecard`)) return prev;
        const next = new Set(prev);
        next.add(`${focusTeam}:intakecard`);
        return next;
      });
      const targetTeam = teams.find((team) => team.id === focusTeam);
      if (targetTeam) {
        const kind = focusIntake as PulseCheckIntakeKind;
        const existing = targetTeam.intake?.[kind]?.questions || [];
        if (existing.length === 0) {
          const key = `${focusTeam}:${kind}`;
          setTeamIntakeDrafts((prev) => (prev[key] ? prev : { ...prev, [key]: getDefaultPulseCheckIntakeForm(kind).questions }));
        }
      }
    }

    window.setTimeout(() => {
      const el =
        document.getElementById(isIntakeFocus ? `pcp-intake-${focusTeam}` : `pcp-team-${focusTeam}`) ||
        document.getElementById(`pcp-team-${focusTeam}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  }, [loading, intakeFocusHandled, teams]);

  useEffect(() => {
    if (hasInitializedExpansionState || loading) return;

    setExpandedOrganizationIds(organizations.map((organization) => organization.id));
    setExpandedTeamIds(teams.map((team) => team.id));
    setExpandedPilotIds(
      pilots
        .filter((pilot) => (pilotCohortsByPilotId.get(pilot.id) || []).length > 0)
        .map((pilot) => pilot.id)
    );
    setHasInitializedExpansionState(true);
  }, [hasInitializedExpansionState, loading, organizations, teams, pilots, pilotCohortsByPilotId]);

  useEffect(() => {
    if (!teams.length) return;
    if (activationDraft.teamId) return;

    const firstTeam = teams[0];
    setActivationDraft({
      teamId: firstTeam.id,
      channel: firstTeam.defaultEscalationRoute === 'clinician' ? 'clinician' : 'admin',
      targetEmail: firstTeam.defaultAdminEmail || '',
    });
  }, [teams, activationDraft.teamId]);

  // While the wizard is open against a specific org, never let the team/pilot
  // pickers hold a selection from a different org — coerce them back to a team
  // that belongs to the current organization so we can't generate links or
  // pilots for the wrong org even if a stale selection was carried in.
  useEffect(() => {
    if (!isProvisioningModalOpen || !wizardOrganizationContextId) return;

    setActivationDraft((current) => {
      if (wizardTeams.some((team) => team.id === current.teamId)) return current;
      const fallback = wizardTeams[0];
      if (!fallback) return current;
      return {
        teamId: fallback.id,
        channel: fallback.defaultEscalationRoute === 'clinician' ? 'clinician' : 'admin',
        targetEmail: fallback.defaultAdminEmail || '',
      };
    });

    setPilotForm((current) => {
      if (!current.teamId || wizardTeams.some((team) => team.id === current.teamId)) return current;
      const fallback = wizardTeams[0];
      return fallback ? { ...current, teamId: fallback.id, organizationId: fallback.organizationId } : current;
    });

    setCohortForm((current) => {
      if (!current.pilotId || wizardPilots.some((pilot) => pilot.id === current.pilotId)) return current;
      return { ...current, pilotId: '' };
    });
  }, [isProvisioningModalOpen, wizardOrganizationContextId, wizardTeams, wizardPilots]);

  useEffect(() => {
    if (!selectedActivationTeam) return;

    setActivationDraft((current) => {
      const nextChannel = current.channel === 'clinician' && selectedActivationTeam.defaultEscalationRoute !== 'clinician'
        ? 'admin'
        : current.channel;
      const nextEmail =
        nextChannel === 'clinician'
          ? selectedActivationClinicianProfile?.email || current.targetEmail
          : current.targetEmail || selectedActivationTeam.defaultAdminEmail || '';

      if (current.channel === nextChannel && current.targetEmail === nextEmail) {
        return current;
      }

      return {
        ...current,
        channel: nextChannel,
        targetEmail: nextEmail,
      };
    });
  }, [selectedActivationTeam, selectedActivationClinicianProfile]);

  const uploadInvitePreviewImage = useCallback(
    async (scope: 'organization' | 'team', entityId: string, file: File) => {
      const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
      const fileName = `${Date.now()}-${sanitizeStorageSegment(file.name.replace(/\.[^.]+$/, ''))}.${sanitizeStorageSegment(extension || 'jpg')}`;
      const path = `pulsecheck/provisioning/${scope}s/${entityId}/invite-preview/${fileName}`;
      const fileRef = storageRef(storage, path);

      await uploadBytes(fileRef, file, {
        contentType: file.type || 'image/jpeg',
      });

      return getDownloadURL(fileRef);
    },
    []
  );

  const handleOrganizationInviteImageUpload = useCallback(
    async (organizationId: string, file?: File | null) => {
      if (!file) return;

      setOrganizationImageUploadingId(organizationId);
      setMessage(null);

      try {
        const downloadUrl = await uploadInvitePreviewImage('organization', organizationId, file);
        await pulseCheckProvisioningService.updateOrganizationInvitePreviewImage(organizationId, downloadUrl);
        await loadData();
        setMessage({ type: 'success', text: 'Organization invite preview image updated.' });
      } catch (error) {
        console.error('[PulseCheckProvisioning] Failed to upload organization invite preview image:', error);
        setMessage({ type: 'error', text: 'Failed to upload organization image.' });
      } finally {
        setOrganizationImageUploadingId((current) => (current === organizationId ? null : current));
      }
    },
    [loadData, uploadInvitePreviewImage]
  );

  const handleTeamInviteImageUpload = useCallback(
    async (teamId: string, file?: File | null) => {
      if (!file) return;

      setTeamImageUploadingId(teamId);
      setMessage(null);

      try {
        const downloadUrl = await uploadInvitePreviewImage('team', teamId, file);
        await pulseCheckProvisioningService.updateTeamInvitePreviewImage(teamId, downloadUrl);
        await loadData();
        setMessage({ type: 'success', text: 'Team invite preview image updated.' });
      } catch (error) {
        console.error('[PulseCheckProvisioning] Failed to upload team invite preview image:', error);
        setMessage({ type: 'error', text: 'Failed to upload team image.' });
      } finally {
        setTeamImageUploadingId((current) => (current === teamId ? null : current));
      }
    },
    [loadData, uploadInvitePreviewImage]
  );

  // Front-load a profile photo onto an admin-activation invite, so the coach's
  // onboarding opens with their photo already set (and changeable from there).
  const handleCoachProfilePrefillUpload = useCallback(
    async (token: string, file?: File | null) => {
      if (!file || !token) return;

      setCoachPhotoUploadingToken(token);
      setMessage(null);

      try {
        const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
        const fileName = `${Date.now()}-${sanitizeStorageSegment(file.name.replace(/\.[^.]+$/, ''))}.${sanitizeStorageSegment(extension || 'jpg')}`;
        const path = `pulsecheck/provisioning/admin-activation/${sanitizeStorageSegment(token)}/profile/${fileName}`;
        const fileRef = storageRef(storage, path);
        await uploadBytes(fileRef, file, { contentType: file.type || 'image/jpeg' });
        const downloadUrl = await getDownloadURL(fileRef);

        await pulseCheckProvisioningService.setAdminActivationInvitePrefill(token, { profileImageUrl: downloadUrl });
        await loadData();
        setMessage({ type: 'success', text: 'Coach profile photo pre-loaded. It will be set when they activate.' });
      } catch (error) {
        console.error('[PulseCheckProvisioning] Failed to pre-load coach profile photo:', error);
        setMessage({ type: 'error', text: 'Failed to upload the coach profile photo.' });
      } finally {
        setCoachPhotoUploadingToken((current) => (current === token ? null : current));
      }
    },
    [loadData]
  );

  const handleRevertTeamInviteImage = useCallback(
    async (teamId: string) => {
      setTeamImageUploadingId(teamId);
      setMessage(null);
      try {
        await pulseCheckProvisioningService.updateTeamInvitePreviewImage(teamId, '');
        await loadData();
        setMessage({ type: 'success', text: 'Team is now using the organization artwork.' });
      } catch (error) {
        console.error('[PulseCheckProvisioning] Failed to revert team invite preview image:', error);
        setMessage({ type: 'error', text: 'Failed to update team image.' });
      } finally {
        setTeamImageUploadingId((current) => (current === teamId ? null : current));
      }
    },
    [loadData]
  );

  useEffect(() => {
    if (!selectedOrganization?.displayName) return;

    setNewClinicianProfileForm((current) => (
      current.organizationName
        ? current
        : {
            ...current,
            organizationName: selectedOrganization.displayName,
          }
    ));
  }, [selectedOrganization]);

  useEffect(() => {
    if (!onboardingModal) return;

    const refreshedOrganization = organizations.find((organization) => organization.id === onboardingModal.organization.id);
    const refreshedTeam = teams.find((team) => team.id === onboardingModal.team.id);
    const refreshedClinicianProfile =
      onboardingModal.channel === 'clinician'
        ? clinicianProfiles.find((profile) => profile.id === onboardingModal.clinicianProfile.id)
        : onboardingModal.clinicianProfile
          ? clinicianProfiles.find((profile) => profile.id === onboardingModal.clinicianProfile?.id) || onboardingModal.clinicianProfile
          : null;

    if (!refreshedOrganization || !refreshedTeam) return;

    setOnboardingModal((current) => {
      if (!current || current.organization.id !== refreshedOrganization.id || current.team.id !== refreshedTeam.id) return current;

      if (current.channel === 'clinician') {
        if (!refreshedClinicianProfile) return current;
        if (
          current.organization === refreshedOrganization &&
          current.team === refreshedTeam &&
          current.clinicianProfile === refreshedClinicianProfile
        ) {
          return current;
        }
        return {
          ...current,
          organization: refreshedOrganization,
          team: refreshedTeam,
          clinicianProfile: refreshedClinicianProfile,
        };
      }

      if (
        current.organization === refreshedOrganization &&
        current.team === refreshedTeam &&
        (current.clinicianProfile || null) === (refreshedClinicianProfile || current.clinicianProfile || null)
      ) {
        return current;
      }

      return {
        ...current,
        organization: refreshedOrganization,
        team: refreshedTeam,
        clinicianProfile: refreshedClinicianProfile || current.clinicianProfile || null,
      };
    });
  }, [organizations, teams, clinicianProfiles, onboardingModal]);

  const handleOrgFieldChange = (
    field: keyof CreatePulseCheckOrganizationInput,
    value: string | PulseCheckStudyPosture | PulseCheckClinicianBridgeMode
  ) => {
    setOrgForm((current) => ({ ...current, [field]: value }));
    setMessage(null);
  };

  const handleTeamFieldChange = (
    field: keyof CreatePulseCheckTeamInput,
    value: string | PulseCheckInvitePolicy | PulseCheckTeamEscalationRoute
  ) => {
    setTeamForm((current) => {
      if (field === 'organizationId') {
        const nextOrganization = organizations.find((organization) => organization.id === value) || null;
        setNewClinicianProfileForm((currentProfile) => ({
          ...currentProfile,
          organizationName: currentProfile.organizationName || nextOrganization?.displayName || '',
        }));
        return {
          ...current,
          organizationId: String(value),
          defaultAdminName: nextOrganization?.primaryCustomerAdminName || '',
          defaultAdminEmail: nextOrganization?.primaryCustomerAdminEmail || '',
        };
      }

      if (field === 'sportOrProgram') {
        // Capture both the display name and the stable SportConfiguration id so the
        // sport stays resolvable (icon/config) even if its label is later renamed.
        const name = String(value);
        const matched = teamSportOptions.find((sport) => sport.name === name);
        return {
          ...current,
          sportOrProgram: name,
          sportId: matched && !matched.id.startsWith('legacy-') ? matched.id : '',
        };
      }

      return { ...current, [field]: value };
    });
    setMessage(null);
  };

  const handleTeamCommercialFieldChange = (
    field: keyof PulseCheckTeamCommercialConfig,
    value: string | boolean
  ) => {
    setTeamForm((current) => ({
      ...current,
      commercialConfig: {
        ...current.commercialConfig,
        [field]:
          field === 'referralRevenueSharePct'
            ? Math.max(0, Math.min(100, Number(value) || 0))
            : value,
      },
    }));
    setMessage(null);
  };

  const handleExistingTeamCommercialFieldChange = (
    teamId: string,
    field: keyof PulseCheckTeamCommercialConfig,
    value: string | boolean
  ) => {
    setTeamCommercialDrafts((current) => ({
      ...current,
      [teamId]: {
        ...(current[teamId] || getDefaultPulseCheckTeamCommercialConfig()),
        [field]:
          field === 'referralRevenueSharePct'
            ? Math.max(0, Math.min(100, Number(value) || 0))
            : value,
      },
    }));
    setMessage(null);
  };

  const handlePilotFieldChange = (
    field: keyof CreatePulseCheckPilotInput,
    value: string | PulseCheckPilotStudyMode | PulseCheckPilot['status']
  ) => {
    setPilotForm((current) => {
      if (field === 'teamId') {
        const nextTeam = teams.find((team) => team.id === value) || null;
        return {
          ...current,
          teamId: String(value),
          organizationId: nextTeam?.organizationId || current.organizationId,
        };
      }

      return { ...current, [field]: value };
    });
    setMessage(null);
  };

  const handleCohortFieldChange = (
    field: keyof CreatePulseCheckPilotCohortInput,
    value: string | PulseCheckPilotCohortStatus
  ) => {
    setCohortForm((current) => {
      if (field === 'pilotId') {
        const nextPilot = pilots.find((pilot) => pilot.id === value) || null;
        return {
          ...current,
          pilotId: String(value),
          teamId: nextPilot?.teamId || current.teamId,
          organizationId: nextPilot?.organizationId || current.organizationId,
        };
      }

      return { ...current, [field]: value };
    });
    setMessage(null);
  };

  const addCohortTag = useCallback((rawValue: string) => {
    const normalizedTag = normalizeCohortTag(rawValue);
    if (!normalizedTag) return false;

    let added = false;
    setCohortForm((current) => {
      if ((current.reportingTags || []).some((tag) => tag.toLowerCase() === normalizedTag)) {
        return current;
      }

      added = true;
      return {
        ...current,
        reportingTags: [...(current.reportingTags || []), normalizedTag],
      };
    });

    if (added) {
      setMessage(null);
    }

    return added;
  }, []);

  const removeCohortTag = useCallback((tagToRemove: string) => {
    setCohortForm((current) => ({
      ...current,
      reportingTags: (current.reportingTags || []).filter((tag) => tag !== tagToRemove),
    }));
    setMessage(null);
  }, []);

  const commitCohortTagsInput = useCallback(() => {
    if (!cohortTagsInput.trim()) return;

    const segments = cohortTagsInput.split(',');
    let addedAny = false;
    segments.forEach((segment) => {
      addedAny = addCohortTag(segment) || addedAny;
    });

    if (addedAny || segments.some((segment) => segment.trim())) {
      setCohortTagsInput('');
    }
  }, [addCohortTag, cohortTagsInput]);

  const handleTeamAdminSelection = (email: string) => {
    const selectedAdmin = teamAdminOptions.find((option) => option.value === email);
    setTeamForm((current) => ({
      ...current,
      defaultAdminName: selectedAdmin?.name || '',
      defaultAdminEmail: selectedAdmin?.email || '',
    }));
    setMessage(null);
  };

  const handleSelectClinicianProfile = (profile: PulseCheckAuntEdnaClinicianProfile) => {
    setTeamForm((current) => ({
      ...current,
      defaultClinicianProfileId: profile.id,
      defaultClinicianExternalProfileId: profile.auntEdnaProfileId || profile.externalProfileId || '',
      defaultClinicianProfileName: profile.displayName,
      defaultClinicianProfileType: profile.profileType,
      defaultClinicianProfileSource: profile.source,
    }));
    setMessage(null);
  };

  const handleCreateClinicianProfile = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!newClinicianProfileForm.displayName.trim()) {
      setMessage({ type: 'error', text: 'Clinician profile display name is required.' });
      return;
    }

    if (!newClinicianProfileForm.email.trim()) {
      setMessage({ type: 'error', text: 'Contact email is required for clinician profile creation.' });
      return;
    }

    setClinicianSubmitting(true);
    setMessage(null);

    try {
      const createdProfile = await pulseCheckProvisioningService.createClinicianProfile({
        displayName: newClinicianProfileForm.displayName.trim(),
        organizationName: newClinicianProfileForm.organizationName.trim(),
        email: newClinicianProfileForm.email.trim(),
        profileType: newClinicianProfileForm.profileType,
        source: 'pulsecheck-local',
        syncStatus: 'pending-sync',
      });

      setClinicianProfiles((current) =>
        [createdProfile, ...current.filter((profile) => profile.id !== createdProfile.id)].sort(
          (left, right) => left.displayName.localeCompare(right.displayName)
        )
      );
      handleSelectClinicianProfile(createdProfile);
      setClinicianLinkMode('existing');
      setClinicianSearchTerm(createdProfile.displayName);
      setNewClinicianProfileForm({
        displayName: '',
        organizationName: selectedOrganization?.displayName || '',
        email: '',
        profileType: 'group',
      });
      setMessage({ type: 'success', text: 'Clinician profile saved locally and attached to the team draft. It can sync to AuntEdna later once APIs are live.' });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create local clinician profile:', error);
      setMessage({ type: 'error', text: 'Failed to create clinician profile.' });
    } finally {
      setClinicianSubmitting(false);
    }
  };

  const handleCreateOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orgForm.displayName.trim() || !orgForm.legalName.trim() || !orgForm.primaryCustomerAdminEmail?.trim()) {
      setMessage({ type: 'error', text: 'Display name, legal name, and customer admin email are required.' });
      return false;
    }

    setOrgSubmitting(true);
    setMessage(null);
    const isExistingOrg = Boolean(wizardOrganizationId);

    try {
      let organizationId = wizardOrganizationId || '';
      if (isExistingOrg) {
        // Already created this org earlier in the wizard — update it so going
        // Back to edit doesn't create a duplicate.
        await pulseCheckProvisioningService.updateOrganization(organizationId, {
          ...orgForm,
          implementationOwnerUserId: currentUser?.id || '',
          implementationOwnerEmail: currentUser?.email || '',
        });
      } else {
        organizationId = await pulseCheckProvisioningService.createOrganization({
          ...orgForm,
          implementationOwnerUserId: currentUser?.id || '',
          implementationOwnerEmail: currentUser?.email || '',
        });
        setWizardOrganizationId(organizationId);
      }

      // Keep orgForm populated so Back → edit shows the entered values.
      await loadData();
      setTeamForm((current) => ({
        ...current,
        organizationId,
        defaultAdminName: current.defaultAdminName || orgForm.primaryCustomerAdminName || '',
        defaultAdminEmail: current.defaultAdminEmail || orgForm.primaryCustomerAdminEmail || '',
      }));
      setExpandedOrganizationIds((current) => (current.includes(organizationId) ? current : [...current, organizationId]));
      setActiveWizardStep('team');
      setMessage({
        type: 'success',
        text: isExistingOrg
          ? 'Organization updated.'
          : 'Organization created. You can now create the first team under it.',
      });
      return true;
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to save organization:', error);
      setMessage({ type: 'error', text: `Failed to ${isExistingOrg ? 'update' : 'create'} organization.` });
      return false;
    } finally {
      setOrgSubmitting(false);
    }
  };

  const handleCreateTeam = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teamForm.organizationId || !teamForm.displayName.trim() || !teamForm.sportOrProgram.trim()) {
      setMessage({ type: 'error', text: 'Organization, team name, and sport are required.' });
      return false;
    }

    if (
      teamForm.defaultEscalationRoute === 'clinician' &&
      (!teamForm.defaultClinicianProfileId || !teamForm.defaultClinicianProfileName)
    ) {
      setMessage({
        type: 'error',
        text: 'Select or create a clinician profile before creating a clinician-routed team.',
      });
      return false;
    }

    setTeamSubmitting(true);
    setMessage(null);

    try {
      const createdTeamId = await pulseCheckProvisioningService.createTeam(teamForm);
      const selectedOrganizationId = teamForm.organizationId;
      const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationId);
      setTeamForm({
        ...defaultTeamForm,
        organizationId: selectedOrganizationId,
        defaultAdminName: selectedOrganization?.primaryCustomerAdminName || '',
        defaultAdminEmail: selectedOrganization?.primaryCustomerAdminEmail || '',
      });
      setClinicianSearchTerm('');
      setNewClinicianProfileForm((current) => ({
        ...current,
        displayName: '',
        email: '',
        organizationName: selectedOrganization?.displayName || '',
        profileType: 'group',
      }));
      setPilotForm({
        ...defaultPilotForm,
        organizationId: selectedOrganizationId,
        teamId: createdTeamId,
        checkpointCadence: 'weekly',
        status: 'active',
      });
      setPilotStartDate('');
      setPilotIsIndefinite(false);
      setPilotDurationPreset('14');
      setPilotCustomDays('');
      setCohortForm({
        ...defaultCohortForm,
        organizationId: selectedOrganizationId,
        teamId: createdTeamId,
        pilotId: '',
        cohortType: 'intervention-group',
      });
      setCohortTagsInput('');
      await loadData();
      setExpandedOrganizationIds((current) =>
        current.includes(selectedOrganizationId) ? current : [...current, selectedOrganizationId]
      );
      setExpandedTeamIds((current) => (current.includes(createdTeamId) ? current : [...current, createdTeamId]));
      setActivationDraft({
        teamId: createdTeamId,
        channel: teamForm.defaultEscalationRoute === 'clinician' ? 'clinician' : 'admin',
        targetEmail:
          teamForm.defaultEscalationRoute === 'clinician'
            ? selectedClinicianProfile?.email || teamForm.defaultAdminEmail || ''
            : teamForm.defaultAdminEmail || '',
      });
      setActiveWizardStep('activation');
      setMessage({
        type: 'success',
        text:
          teamForm.defaultEscalationRoute === 'hotline'
            ? 'Team created with 988 hotline escalation routing and automatic watch-list hold behavior. You can now add pilots and cohorts before issuing onboarding links.'
            : 'Team created with its default clinician profile attached. You can now add pilots and cohorts before issuing onboarding links.',
      });
      return true;
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create team:', error);
      setMessage({ type: 'error', text: 'Failed to create team.' });
      return false;
    } finally {
      setTeamSubmitting(false);
    }
  };

  const handleSaveTeamCommercialConfig = async (team: PulseCheckTeam) => {
    const draft = teamCommercialDrafts[team.id] || team.commercialConfig;
    setTeamCommercialSavingId(team.id);
    setMessage(null);

    try {
      await pulseCheckProvisioningService.updateTeamCommercialConfig(team.id, draft);
      await loadData();
      setMessage({
        type: 'success',
        text: `${team.displayName} commercial config updated.`,
      });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to update team commercial config:', error);
      setMessage({ type: 'error', text: 'Failed to update team commercial config.' });
    } finally {
      setTeamCommercialSavingId((current) => (current === team.id ? null : current));
    }
  };

  const getTeamConsentDraft = (team: PulseCheckTeam): PulseCheckRequiredConsentDocument[] =>
    teamConsentDrafts[team.id] ?? (team.requiredConsents || []);

  const isTeamConsentDirty = (team: PulseCheckTeam): boolean => {
    const draft = teamConsentDrafts[team.id];
    if (!draft) return false;
    return JSON.stringify(draft) !== JSON.stringify(team.requiredConsents || []);
  };

  const setTeamConsentDraft = (teamId: string, next: PulseCheckRequiredConsentDocument[]) => {
    setTeamConsentDrafts((prev) => ({ ...prev, [teamId]: next }));
  };

  const handleAddTeamConsent = (team: PulseCheckTeam) => {
    const newConsent: PulseCheckRequiredConsentDocument = {
      id: `custom-${Math.random().toString(36).slice(2, 10)}`,
      title: '',
      body: '',
      version: 'v1',
    };
    setTeamConsentDraft(team.id, [...getTeamConsentDraft(team), newConsent]);
  };

  const handleTeamConsentFieldChange = (
    team: PulseCheckTeam,
    index: number,
    field: 'title' | 'body' | 'version',
    value: string
  ) => {
    setTeamConsentDraft(
      team.id,
      getTeamConsentDraft(team).map((consent, i) => (i === index ? { ...consent, [field]: value } : consent))
    );
  };

  const handleBumpTeamConsentVersion = (team: PulseCheckTeam, index: number) => {
    setTeamConsentDraft(
      team.id,
      getTeamConsentDraft(team).map((consent, i) => {
        if (i !== index) return consent;
        const current = parseInt((consent.version.match(/\d+/) || ['0'])[0], 10) || 0;
        return { ...consent, version: `v${current + 1}` };
      })
    );
  };

  const handleRemoveTeamConsent = (team: PulseCheckTeam, index: number) => {
    setTeamConsentDraft(team.id, getTeamConsentDraft(team).filter((_, i) => i !== index));
  };

  const handleSeedTeamConsents = (team: PulseCheckTeam, studyMode: PulseCheckPilotStudyMode) => {
    setTeamConsentDraft(team.id, getDefaultPulseCheckRequiredConsents(studyMode).map((consent) => ({ ...consent })));
  };

  const handleResetTeamConsentDraft = (teamId: string) => {
    setTeamConsentDrafts((prev) => {
      const next = { ...prev };
      delete next[teamId];
      return next;
    });
  };

  const handleSaveTeamConsents = async (team: PulseCheckTeam) => {
    const draft = getTeamConsentDraft(team);
    if (draft.some((consent) => !consent.title.trim() || !consent.body.trim())) {
      setMessage({ type: 'error', text: 'Each consent needs a title and body before saving.' });
      return;
    }
    setTeamConsentSavingId(team.id);
    setMessage(null);
    try {
      await pulseCheckProvisioningService.updateTeamRequiredConsents(team.id, draft);
      await loadData();
      handleResetTeamConsentDraft(team.id);
      setMessage({ type: 'success', text: `${team.displayName} consent forms updated.` });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to update team consents:', error);
      setMessage({ type: 'error', text: 'Failed to update consent forms.' });
    } finally {
      setTeamConsentSavingId((current) => (current === team.id ? null : current));
    }
  };

  const intakeDraftKey = (teamId: string, kind: PulseCheckIntakeKind) => `${teamId}:${kind}`;

  const getIntakeDraft = (team: PulseCheckTeam, kind: PulseCheckIntakeKind): SurveyQuestion[] =>
    teamIntakeDrafts[intakeDraftKey(team.id, kind)] ?? (team.intake?.[kind]?.questions || []);

  const isIntakeDirty = (team: PulseCheckTeam, kind: PulseCheckIntakeKind): boolean => {
    const draft = teamIntakeDrafts[intakeDraftKey(team.id, kind)];
    if (!draft) return false;
    return JSON.stringify(draft) !== JSON.stringify(team.intake?.[kind]?.questions || []);
  };

  const setIntakeDraft = (teamId: string, kind: PulseCheckIntakeKind, next: SurveyQuestion[]) => {
    setTeamIntakeDrafts((prev) => ({ ...prev, [intakeDraftKey(teamId, kind)]: next }));
  };

  const updateIntakeQuestion = (
    team: PulseCheckTeam,
    kind: PulseCheckIntakeKind,
    index: number,
    updater: (question: SurveyQuestion) => SurveyQuestion
  ) => {
    setIntakeDraft(team.id, kind, getIntakeDraft(team, kind).map((question, i) => (i === index ? updater(question) : question)));
  };

  const handleAddIntakeQuestion = (team: PulseCheckTeam, kind: PulseCheckIntakeKind) => {
    const question: SurveyQuestion = { id: `q-${Math.random().toString(36).slice(2, 10)}`, type: 'text', question: '' };
    setIntakeDraft(team.id, kind, [...getIntakeDraft(team, kind), question]);
  };

  const handleRemoveIntakeQuestion = (team: PulseCheckTeam, kind: PulseCheckIntakeKind, index: number) => {
    setIntakeDraft(team.id, kind, getIntakeDraft(team, kind).filter((_, i) => i !== index));
  };

  const handleIntakeQuestionTypeChange = (
    team: PulseCheckTeam,
    kind: PulseCheckIntakeKind,
    index: number,
    type: SurveyQuestion['type']
  ) => {
    updateIntakeQuestion(team, kind, index, (question) => {
      const next: SurveyQuestion = { id: question.id, type, question: question.question };
      if (question.required) next.required = true;
      if (type === 'multiple_choice') {
        next.options = question.options && question.options.length > 0
          ? question.options
          : [{ id: `opt-${Math.random().toString(36).slice(2, 8)}`, text: '' }];
      }
      if (type === 'number') {
        next.minValue = question.minValue;
        next.maxValue = question.maxValue;
      }
      return next;
    });
  };

  const handleAddIntakeOption = (team: PulseCheckTeam, kind: PulseCheckIntakeKind, index: number) => {
    updateIntakeQuestion(team, kind, index, (question) => ({
      ...question,
      options: [...(question.options || []), { id: `opt-${Math.random().toString(36).slice(2, 8)}`, text: '' }],
    }));
  };

  const handleIntakeOptionChange = (
    team: PulseCheckTeam,
    kind: PulseCheckIntakeKind,
    index: number,
    optionIndex: number,
    text: string
  ) => {
    updateIntakeQuestion(team, kind, index, (question) => ({
      ...question,
      options: (question.options || []).map((option, i) => (i === optionIndex ? { ...option, text } : option)),
    }));
  };

  const handleRemoveIntakeOption = (
    team: PulseCheckTeam,
    kind: PulseCheckIntakeKind,
    index: number,
    optionIndex: number
  ) => {
    updateIntakeQuestion(team, kind, index, (question) => ({
      ...question,
      options: (question.options || []).filter((_, i) => i !== optionIndex),
    }));
  };

  const handleLoadStarterIntake = (team: PulseCheckTeam, kind: PulseCheckIntakeKind) => {
    setIntakeDraft(team.id, kind, getDefaultPulseCheckIntakeForm(kind).questions);
  };

  const handleDiscardIntakeDraft = (team: PulseCheckTeam, kind: PulseCheckIntakeKind) => {
    setTeamIntakeDrafts((prev) => {
      const next = { ...prev };
      delete next[intakeDraftKey(team.id, kind)];
      return next;
    });
  };

  const handleSaveIntake = async (team: PulseCheckTeam, kind: PulseCheckIntakeKind) => {
    const draft = getIntakeDraft(team, kind);
    if (draft.some((question) => !question.question.trim())) {
      setMessage({ type: 'error', text: 'Every question needs text before saving.' });
      return;
    }
    const savingKey = intakeDraftKey(team.id, kind);
    setTeamIntakeSavingKey(savingKey);
    setMessage(null);
    try {
      const form: PulseCheckIntakeForm = { questions: draft, version: PULSECHECK_INTAKE_FORM_VERSION };
      await pulseCheckProvisioningService.updateTeamIntakeForm(team.id, kind, form);
      await loadData();
      handleDiscardIntakeDraft(team, kind);
      setMessage({ type: 'success', text: `${team.displayName} ${kind} intake updated.` });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to update intake form:', error);
      setMessage({ type: 'error', text: 'Failed to update intake form.' });
    } finally {
      setTeamIntakeSavingKey((current) => (current === savingKey ? null : current));
    }
  };

  const handlePilotStudyModeDraftChange = (pilotId: string, studyMode: PulseCheckPilotStudyMode) => {
    setPilotStudyModeDrafts((current) => ({
      ...current,
      [pilotId]: studyMode,
    }));
  };

  const handleSavePilotStudyMode = async (pilot: PulseCheckPilot) => {
    const nextStudyMode = pilotStudyModeDrafts[pilot.id] || pilot.studyMode;
    if (nextStudyMode === pilot.studyMode) return;

    setPilotStudyModeSavingId(pilot.id);
    setMessage(null);

    try {
      await pulseCheckProvisioningService.updatePilotStudyMode(pilot.id, nextStudyMode);
      await loadData();
      setMessage({
        type: 'success',
        text: `${pilot.name} is now in ${formatEnumLabel(nextStudyMode).toLowerCase()} mode. The matching disclosure package was applied.`,
      });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to update pilot study mode:', error);
      setPilotStudyModeDrafts((current) => ({
        ...current,
        [pilot.id]: pilot.studyMode,
      }));
      setMessage({ type: 'error', text: 'Failed to update pilot study mode.' });
    } finally {
      setPilotStudyModeSavingId((current) => (current === pilot.id ? null : current));
    }
  };

  const handleCreatePilot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pilotForm.organizationId || !pilotForm.teamId || !pilotForm.name.trim()) {
      setMessage({ type: 'error', text: 'Select a team and enter a pilot name before creating a pilot.' });
      return false;
    }

    setPilotSubmitting(true);
    setMessage(null);

    try {
      const startAt = pilotStartDate ? new Date(`${pilotStartDate}T00:00:00`) : null;
      const durationDays = pilotIsIndefinite
        ? null
        : pilotDurationPreset === 'custom'
          ? Number.parseInt(pilotCustomDays, 10)
          : Number.parseInt(pilotDurationPreset, 10);
      const finiteDurationDays = typeof durationDays === 'number' && Number.isFinite(durationDays) ? durationDays : null;

      if (!pilotIsIndefinite && pilotDurationPreset === 'custom' && (!finiteDurationDays || finiteDurationDays <= 0)) {
        setMessage({ type: 'error', text: 'Enter a valid number of days for a custom pilot duration.' });
        setPilotSubmitting(false);
        return false;
      }

      const endAt = !pilotIsIndefinite && startAt && finiteDurationDays && finiteDurationDays > 0
        ? new Date(startAt.getTime() + (finiteDurationDays - 1) * 24 * 60 * 60 * 1000 + (23 * 60 * 60 + 59 * 60 + 59) * 1000)
        : null;

      const createdPilotId = await pulseCheckProvisioningService.createPilot({
        ...pilotForm,
        status: 'active',
        startAt,
        endAt,
        ownerInternalUserId: currentUser?.id || '',
        ownerInternalEmail: currentUser?.email || '',
      });
      setCohortForm((current) => ({
        ...current,
        organizationId: pilotForm.organizationId,
        teamId: pilotForm.teamId,
        pilotId: createdPilotId,
      }));
      setPilotForm((current) => ({
        ...defaultPilotForm,
        organizationId: current.organizationId,
        teamId: current.teamId,
        studyMode: current.studyMode,
        checkpointCadence: current.checkpointCadence || 'weekly',
        status: 'active',
      }));
      setPilotStartDate('');
      setPilotIsIndefinite(false);
      setPilotDurationPreset('14');
      setPilotCustomDays('');
      setSkipCohortForNow(false);
      await loadData();
      setExpandedTeamIds((current) => (current.includes(pilotForm.teamId) ? current : [...current, pilotForm.teamId]));
      setExpandedPilotIds((current) => (current.includes(createdPilotId) ? current : [...current, createdPilotId]));
      setActiveWizardStep('cohort');
      setMessage({
        type: 'success',
        text: pilotIsIndefinite
          ? 'Pilot created and activated with no end date. It will stay open until you complete or pause it manually.'
          : 'Pilot created and activated. It will show up in the dashboard immediately, while start and end dates still scope the reporting window.',
      });
      return true;
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create pilot:', error);
      setMessage({ type: 'error', text: 'Failed to create pilot.' });
      return false;
    } finally {
      setPilotSubmitting(false);
    }
  };

  const handleCreateCohort = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cohortForm.organizationId || !cohortForm.teamId || !cohortForm.pilotId || !cohortForm.name.trim()) {
      setMessage({ type: 'error', text: 'Select a pilot and enter a cohort name before creating a cohort.' });
      return false;
    }

    const pendingTags = cohortTagsInput
      .split(',')
      .map((tag) => normalizeCohortTag(tag))
      .filter(Boolean);
    const reportingTags = Array.from(new Set([...(cohortForm.reportingTags || []), ...pendingTags]));
    const selectedPilotStatus = selectedCohortPilot ? getDerivedPilotStatusValue(selectedCohortPilot) : null;
    const inheritedStatus: PulseCheckPilotCohortStatus = selectedPilotStatus === 'active' ? 'active' : 'draft';

    setCohortSubmitting(true);
    setMessage(null);

    try {
      await pulseCheckProvisioningService.createPilotCohort({
        ...cohortForm,
        reportingTags,
        status: inheritedStatus,
      });
      setCohortForm((current) => ({
        ...defaultCohortForm,
        organizationId: current.organizationId,
        teamId: current.teamId,
        pilotId: current.pilotId,
        cohortType: current.cohortType || 'intervention-group',
        assignmentRule: current.assignmentRule || 'manual-staff-assignment',
      }));
      setCohortTagsInput('');
      await loadData();
      setExpandedPilotIds((current) => (current.includes(cohortForm.pilotId) ? current : [...current, cohortForm.pilotId]));
      setIsProvisioningModalOpen(false);
      setActiveWizardStep('org');
      setSkipCohortForNow(false);
      setMessage({
        type: 'success',
        text: `Cohort created and linked to the selected pilot. It inherited a ${inheritedStatus} status from the pilot at creation time.`,
      });
      return true;
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create cohort:', error);
      setMessage({ type: 'error', text: 'Failed to create cohort.' });
      return false;
    } finally {
      setCohortSubmitting(false);
    }
  };

  const handleCreateAdminActivationLink = async (
    team: PulseCheckTeam,
    targetEmail?: string,
    staffCapabilities?: StaffPermission[],
  ) => {
    if (!targetEmail?.trim()) {
      setMessage({ type: 'error', text: 'An admin email is required before generating an onboarding link.' });
      return false;
    }

    setActivationCreatingTeamId(team.id);
    setAdminLinkCreatingEmail(targetEmail);
    setMessage(null);

    try {
      await pulseCheckProvisioningService.createAdminActivationLink({
        organizationId: team.organizationId,
        teamId: team.id,
        targetEmail,
        staffCapabilities,
        createdByUserId: currentUser?.id || '',
        createdByEmail: currentUser?.email || '',
      });

      await loadData();
      setMessage({
        type: 'success',
        text: `Admin activation link created for ${targetEmail}. ${team.displayName} is ready for activation.`,
      });
      return true;
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create admin activation link:', error);
      setMessage({ type: 'error', text: 'Failed to create admin activation link.' });
      return false;
    } finally {
      setActivationCreatingTeamId(null);
      setAdminLinkCreatingEmail(null);
    }
  };

  const handleCopyActivationLink = async (activationUrl: string) => {
    try {
      await navigator.clipboard.writeText(activationUrl);
      setMessage({ type: 'success', text: 'Admin activation link copied to clipboard.' });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to copy admin activation link:', error);
      setMessage({ type: 'error', text: 'Failed to copy admin activation link.' });
    }
  };

  // Copy must run synchronously inside the click gesture — calling
  // navigator.clipboard.writeText after an await loses user activation and the
  // browser denies it. Falls back to execCommand, then to showing the link.
  const copyInviteToClipboard = (text: string, successText: string) => {
    const onDone = () => dispatch(showToast({ message: successText, type: 'success', duration: 2500 }));
    const fallback = () => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (ok) { onDone(); return; }
      } catch (error) {
        console.warn('[PulseCheckProvisioning] execCommand copy fallback failed:', error);
      }
      setMessage({ type: 'error', text: `Copy this invite link manually: ${text}` });
    };
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(onDone).catch(fallback);
      } else {
        fallback();
      }
    } catch (error) {
      console.warn('[PulseCheckProvisioning] clipboard.writeText threw:', error);
      fallback();
    }
  };

  const handleCreateCohortInviteLink = async (pilot: PulseCheckPilot, cohort: PulseCheckPilotCohort) => {
    setCohortInviteCreatingId(cohort.id);
    setMessage(null);

    try {
      const inviteId = await pulseCheckProvisioningService.createTeamAccessInviteLink({
        organizationId: cohort.organizationId,
        teamId: cohort.teamId,
        teamMembershipRole: 'athlete',
        pilotId: pilot.id,
        pilotName: pilot.name,
        cohortId: cohort.id,
        cohortName: cohort.name,
        redemptionMode: 'general',
        createdByUserId: currentUser?.id || '',
        createdByEmail: currentUser?.email || '',
      });

      const refreshedInviteLinks = await pulseCheckProvisioningService.listInviteLinks();
      setInviteLinks(refreshedInviteLinks);
      const createdInvite = refreshedInviteLinks.find((invite) => invite.id === inviteId);
      // Do NOT copy here: we're past the click gesture (clipboard would be
      // denied). The button now shows "Copy Invite" and copies synchronously.
      setMessage({
        type: 'success',
        text: createdInvite?.activationUrl
          ? `Reusable invite ready for ${cohort.name} — tap Copy Invite to copy it.`
          : `Reusable invite created for ${cohort.name}.`,
      });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create cohort athlete invite:', error);
      setMessage({ type: 'error', text: 'Failed to create cohort athlete invite.' });
    } finally {
      setCohortInviteCreatingId(null);
    }
  };

  // Create a reusable athlete invite that drops the redeemer directly into the
  // pilot with no cohort — for pilots that aren't using cohorts.
  const handleCreatePilotInviteLink = async (pilot: PulseCheckPilot) => {
    setPilotInviteCreatingId(pilot.id);
    setMessage(null);

    try {
      const inviteId = await pulseCheckProvisioningService.createTeamAccessInviteLink({
        organizationId: pilot.organizationId,
        teamId: pilot.teamId,
        teamMembershipRole: 'athlete',
        pilotId: pilot.id,
        pilotName: pilot.name,
        // No cohortId/cohortName: enrolls straight into the pilot.
        redemptionMode: 'general',
        createdByUserId: currentUser?.id || '',
        createdByEmail: currentUser?.email || '',
      });

      const refreshedInviteLinks = await pulseCheckProvisioningService.listInviteLinks();
      setInviteLinks(refreshedInviteLinks);
      const createdInvite = refreshedInviteLinks.find((invite) => invite.id === inviteId);
      // Past the click gesture here, so we can't copy. The button flips to
      // "Copy Invite" and copies synchronously on the next tap.
      setMessage({
        type: 'success',
        text: createdInvite?.activationUrl
          ? `Reusable athlete invite ready for ${pilot.name} — tap Copy Invite to copy it.`
          : `Reusable athlete invite created for ${pilot.name}.`,
      });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create pilot athlete invite:', error);
      setMessage({ type: 'error', text: 'Failed to create pilot athlete invite.' });
    } finally {
      setPilotInviteCreatingId(null);
    }
  };

  const handleOpenOnboardingModal = (input: OnboardingModalState) => {
    setOnboardingModal(input);
    setAdditionalAdminForm({ name: '', email: '' });
    setMessage(null);
  };

  const handleCloseOnboardingModal = () => {
    setOnboardingModal(null);
  };

  const handleCreateClinicianOnboardingLink = async (
    organization: PulseCheckOrganization,
    team: PulseCheckTeam,
    clinicianProfile: PulseCheckAuntEdnaClinicianProfile
  ) => {
    setClinicianLinkCreatingProfileId(clinicianProfile.id);
    setMessage(null);

    try {
      await pulseCheckProvisioningService.createClinicianOnboardingLink({
        organizationId: organization.id,
        teamId: team.id,
        clinicianProfileId: clinicianProfile.id,
        targetEmail: clinicianProfile.email,
        createdByUserId: currentUser?.id || '',
        createdByEmail: currentUser?.email || '',
      });

      await loadData();
      setMessage({
        type: 'success',
        text: `Clinician onboarding link created for ${clinicianProfile.displayName}.`,
      });
      return true;
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create clinician onboarding link:', error);
      setMessage({ type: 'error', text: 'Failed to create clinician onboarding link.' });
      return false;
    } finally {
      setClinicianLinkCreatingProfileId(null);
    }
  };

  const handleSendOnboardingEmail = (link: PulseCheckInviteLink) => {
    const recipient =
      onboardingModal?.channel === 'clinician'
        ? onboardingModal.clinicianProfile.email || link.targetEmail || ''
        : onboardingModal?.team.defaultAdminEmail || link.targetEmail || '';

    const subject =
      onboardingModal?.channel === 'clinician'
        ? `AuntEdna onboarding for ${onboardingModal.team.displayName}`
        : `PulseCheck admin onboarding for ${onboardingModal?.organization.displayName || 'your organization'}`;

    const body =
      onboardingModal?.channel === 'clinician'
        ? `Your clinician handoff record is ready for ${onboardingModal.organization.displayName} / ${onboardingModal.team.displayName}.\n\nUse this onboarding link:\n${link.activationUrl}\n\nFor now this lands on the PulseCheck handoff page until AuntEdna's onboarding API is live.`
        : `Your PulseCheck organization shell is ready.\n\nOrganization: ${onboardingModal?.organization.displayName}\nTeam: ${onboardingModal?.team.displayName}\n\nUse this onboarding link:\n${link.activationUrl}`;

    if (typeof window === 'undefined') return;

    window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Deliberately sends (or resends) the PulseCheck admin-activation email to one
  // recipient via the shared Brevo transactional sender. Generates an activation
  // link first if none exists yet, so an admin only enters the system when we
  // choose to send — no auto-send anywhere.
  const handleSendActivationEmailNow = async (input: {
    organization: PulseCheckOrganization;
    team: PulseCheckTeam;
    recipientName?: string;
    recipientEmail: string;
    existingLink?: PulseCheckInviteLink | null;
    staffCapabilities?: StaffPermission[];
  }) => {
    const { organization, team, recipientName, recipientEmail } = input;
    const normalizedEmail = recipientEmail.trim();
    if (!normalizedEmail) {
      setMessage({ type: 'error', text: 'A recipient email is required before sending.' });
      return;
    }

    setActivationEmailSendingEmail(normalizedEmail);
    setMessage(null);

    try {
      // Resolve an active activation link for this recipient, creating one if needed.
      let link =
        input.existingLink && input.existingLink.status === 'active' ? input.existingLink : null;
      if (!link) {
        const created = await handleCreateAdminActivationLink(team, normalizedEmail, input.staffCapabilities);
        if (!created) {
          return;
        }
        const refreshedLinks = await pulseCheckProvisioningService.listTeamInviteLinks(team.id);
        link =
          refreshedLinks.find(
            (candidate) =>
              candidate.inviteType === 'admin-activation' &&
              candidate.status === 'active' &&
              (candidate.targetEmail || '').toLowerCase() === normalizedEmail.toLowerCase()
          ) || null;
      }

      if (!link) {
        setMessage({ type: 'error', text: 'Could not resolve an activation link to send.' });
        return;
      }

      const response = await fetch('/.netlify/functions/send-pulsecheck-admin-activation-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: normalizedEmail,
          activationUrl: link.activationUrl,
          recipientName: recipientName || '',
          organizationName: organization.displayName,
          teamName: team.displayName,
          senderName: currentUser?.displayName || currentUser?.email || 'the PulseCheck team',
        }),
      });

      const result = await response.json().catch(() => ({ success: false, error: 'Bad response' }));
      const success = response.ok && result?.success === true;

      await pulseCheckProvisioningService.recordAdminActivationEmailResult({
        token: link.token,
        success,
        messageId: result?.messageId,
        sentByUserId: currentUser?.id || '',
        sentByEmail: currentUser?.email || '',
        targetEmail: normalizedEmail,
        organizationId: organization.id,
        teamId: team.id,
        errorMessage: success ? '' : String(result?.error || 'Send failed'),
      });

      await loadData();

      if (success) {
        // Toast (z-[101]) so it's visible above the onboarding modal — the
        // header banner (setMessage) sits behind the modal and goes unseen.
        const sentText = `Activation email sent to ${normalizedEmail}.`;
        dispatch(showToast({ message: sentText, type: 'success', duration: 3000 }));
        setMessage({ type: 'success', text: sentText });
      } else {
        const failText = `Failed to send activation email to ${normalizedEmail}: ${result?.error || 'unknown error'}`;
        dispatch(showToast({ message: failText, type: 'error', duration: 4000 }));
        setMessage({ type: 'error', text: failText });
      }
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to send activation email:', error);
      dispatch(showToast({ message: 'Failed to send activation email.', type: 'error', duration: 4000 }));
      setMessage({ type: 'error', text: 'Failed to send activation email.' });
    } finally {
      setActivationEmailSendingEmail(null);
    }
  };

  const handleAddAdditionalAdmin = async () => {
    if (!onboardingModal || onboardingModal.channel !== 'admin') return;
    if (!additionalAdminForm.email.trim()) {
      setMessage({ type: 'error', text: 'Admin email is required.' });
      return;
    }

    setAdditionalAdminSubmitting(true);
    setMessage(null);

    try {
      await pulseCheckProvisioningService.addOrganizationAdminContact({
        organizationId: onboardingModal.organization.id,
        name: additionalAdminForm.name,
        email: additionalAdminForm.email,
      });
      const addedEmail = additionalAdminForm.email;
      setAdditionalAdminForm({ name: '', email: '' });
      await loadData();
      setMessage({ type: 'success', text: `Added ${addedEmail} as an additional organization admin contact.` });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to add organization admin contact:', error);
      setMessage({ type: 'error', text: 'Failed to add additional admin contact.' });
    } finally {
      setAdditionalAdminSubmitting(false);
    }
  };

  const toggleExpandedId = useCallback((id: string, setExpanded: React.Dispatch<React.SetStateAction<string[]>>) => {
    setExpanded((current) => (current.includes(id) ? current.filter((currentId) => currentId !== id) : [...current, id]));
  }, []);

  const toggleOrganizationRow = useCallback((organizationId: string) => {
    toggleExpandedId(organizationId, setExpandedOrganizationIds);
  }, [toggleExpandedId]);

  const togglePilotRow = useCallback((pilotId: string) => {
    toggleExpandedId(pilotId, setExpandedPilotIds);
  }, [toggleExpandedId]);

  const handleToggleAllRows = useCallback(() => {
    const shouldCollapseAll = expandedOrganizationIds.length === organizations.length && expandedTeamIds.length === teams.length;

    if (shouldCollapseAll) {
      setExpandedOrganizationIds([]);
      setExpandedTeamIds([]);
      setExpandedPilotIds([]);
      return;
    }

    setExpandedOrganizationIds(organizations.map((organization) => organization.id));
    setExpandedTeamIds(teams.map((team) => team.id));
    setExpandedPilotIds(pilots.map((pilot) => pilot.id));
  }, [expandedOrganizationIds.length, expandedTeamIds.length, organizations, pilots, teams]);

  const handleOpenProvisioningModal = useCallback(
    (
      step: ProvisioningWizardStep = 'org',
      options?: {
        organizationId?: string;
        teamId?: string;
        pilotId?: string;
        channel?: 'admin' | 'clinician';
      }
    ) => {
      setIsProvisioningModalOpen(true);
      setActiveWizardStep(step);
      setSkipCohortForNow(false);

      // Starting a brand-new organization wizard: reset the org form + tracked
      // id so it opens blank and the first save creates (not updates).
      if (step === 'org') {
        setOrgForm(defaultOrganizationForm);
        setWizardOrganizationId(null);
      }

      const nextOrganizationId = options?.organizationId;
      if (nextOrganizationId) {
        const nextOrganization = organizations.find((organization) => organization.id === nextOrganizationId) || null;
        setTeamForm((current) => ({
          ...current,
          organizationId: String(nextOrganizationId),
          defaultAdminName: nextOrganization?.primaryCustomerAdminName || current.defaultAdminName || '',
          defaultAdminEmail: nextOrganization?.primaryCustomerAdminEmail || current.defaultAdminEmail || '',
        }));
      }

      if (options?.teamId) {
        const nextTeam = teams.find((team) => team.id === options.teamId) || null;
        if (nextTeam) {
          setPilotForm((current) => ({
            ...current,
            organizationId: nextTeam.organizationId,
            teamId: nextTeam.id,
          }));
          setActivationDraft({
            teamId: nextTeam.id,
            channel: options?.channel || (nextTeam.defaultEscalationRoute === 'clinician' ? 'clinician' : 'admin'),
            targetEmail:
              options?.channel === 'clinician'
                ? clinicianProfileById.get(nextTeam.defaultClinicianProfileId || '')?.email || ''
                : nextTeam.defaultAdminEmail || '',
          });
          setCohortForm((current) => ({
            ...current,
            organizationId: nextTeam.organizationId,
            teamId: nextTeam.id,
          }));
        }
      }

      if (options?.pilotId) {
        const nextPilot = pilots.find((pilot) => pilot.id === options.pilotId) || null;
        if (nextPilot) {
          setCohortForm((current) => ({
            ...current,
            organizationId: nextPilot.organizationId,
            teamId: nextPilot.teamId,
            pilotId: nextPilot.id,
          }));
        }
      }
    },
    [clinicianProfileById, organizations, pilots, teams]
  );

  const handleCloseProvisioningModal = useCallback(() => {
    setIsProvisioningModalOpen(false);
    setSkipCohortForNow(false);
  }, []);

  const handleWizardBack = useCallback(() => {
    const currentIndex = PROVISIONING_WIZARD_STEPS.findIndex((step) => step.key === activeWizardStep);
    if (currentIndex <= 0) return;
    setActiveWizardStep(PROVISIONING_WIZARD_STEPS[currentIndex - 1].key);
  }, [activeWizardStep]);

  const handleWizardNext = useCallback(() => {
    if (activeWizardStep === 'team') {
      setActiveWizardStep('route');
      return;
    }

    if (activeWizardStep === 'org') {
      organizationFormRef.current?.requestSubmit();
      return;
    }

    if (activeWizardStep === 'route') {
      teamRouteFormRef.current?.requestSubmit();
      return;
    }

    if (activeWizardStep === 'activation') {
      activationFormRef.current?.requestSubmit();
      return;
    }

    if (activeWizardStep === 'pilot') {
      pilotFormRef.current?.requestSubmit();
      return;
    }

    if (skipCohortForNow) {
      setCohortForm(defaultCohortForm);
      setCohortTagsInput('');
      setIsProvisioningModalOpen(false);
      setActiveWizardStep('org');
      setSkipCohortForNow(false);
      setMessage({
        type: 'success',
        text: 'Provisioning finished without creating a cohort. You can always add one later from the pilot hierarchy.',
      });
      return;
    }

    cohortFormRef.current?.requestSubmit();
  }, [activeWizardStep, skipCohortForNow]);

  const handleWizardActivationSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      if (!selectedActivationTeam) {
        setMessage({ type: 'error', text: 'Select a team before generating an activation link.' });
        return false;
      }

      if (activationDraft.channel === 'clinician') {
        if (!selectedActivationClinicianProfile) {
          setMessage({ type: 'error', text: 'This team does not have a clinician profile attached yet.' });
          return false;
        }

        const organization = organizations.find((organization) => organization.id === selectedActivationTeam.organizationId);
        if (!organization) {
          setMessage({ type: 'error', text: 'The selected team is missing its parent organization.' });
          return false;
        }

        const success = await handleCreateClinicianOnboardingLink(
          organization,
          selectedActivationTeam,
          selectedActivationClinicianProfile
        );

        if (success) {
          setActiveWizardStep('pilot');
        }

        return success;
      }

      const success = await handleCreateAdminActivationLink(selectedActivationTeam, activationDraft.targetEmail);
      if (success) {
        setActiveWizardStep('pilot');
      }
      return success;
    },
    [
      activationDraft.channel,
      activationDraft.targetEmail,
      handleCreateAdminActivationLink,
      handleCreateClinicianOnboardingLink,
      organizations,
      selectedActivationClinicianProfile,
      selectedActivationTeam,
    ]
  );

  const handleExportOrganizations = useCallback(() => {
    if (typeof window === 'undefined') return;

    const exportPayload = organizationBundles.map(({ organization, teams: bundledTeams }) => ({
      organization,
      teams: bundledTeams.map(({ team, pilots: bundledPilots, clinicianProfile, adminActivationLinks, clinicianOnboardingLink }) => ({
        team,
        clinicianProfile,
        adminActivationLinks,
        clinicianOnboardingLink,
        pilots: bundledPilots,
      })),
    }));

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `pulsecheck-organizations-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }, [organizationBundles]);

  const currentWizardStepIndex = PROVISIONING_WIZARD_STEPS.findIndex((step) => step.key === activeWizardStep);
  const currentWizardStepLabel = PROVISIONING_WIZARD_STEPS[currentWizardStepIndex]?.label || 'Organization';
  const activeWizardSubmitting =
    activeWizardStep === 'org'
      ? orgSubmitting
      : activeWizardStep === 'route'
        ? teamSubmitting
        : activeWizardStep === 'activation'
          ? activationCreatingTeamId === activationDraft.teamId ||
            (activationDraft.channel === 'clinician' && clinicianLinkCreatingProfileId === selectedActivationClinicianProfile?.id)
          : activeWizardStep === 'pilot'
            ? pilotSubmitting
            : activeWizardStep === 'cohort'
              ? cohortSubmitting
              : false;
  const wizardPrimaryLabel =
    activeWizardStep === 'team'
      ? 'Continue to Support Route'
      : activeWizardStep === 'cohort'
        ? skipCohortForNow
          ? 'Finish Without Cohort'
          : cohortSubmitting
          ? 'Creating Cohort...'
          : 'Finish Provisioning'
        : activeWizardStep === 'org'
          ? orgSubmitting
            ? 'Creating Organization...'
            : 'Save & Continue'
          : activeWizardStep === 'route'
            ? teamSubmitting
              ? 'Creating Team...'
              : 'Save & Continue'
            : activeWizardStep === 'activation'
              ? activeWizardSubmitting
                ? 'Generating Link...'
                : 'Save & Continue'
              : activeWizardStep === 'pilot'
                ? pilotSubmitting
                  ? 'Creating Pilot...'
                  : 'Save & Continue'
                : 'Save & Continue';
  const adminInitials = (currentUser?.displayName || currentUser?.email || 'Pulse Admin')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join('');

  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-[#05070c] text-white">
        <Head>
          <title>PulseCheck Provisioning | Pulse Admin</title>
          <meta name="robots" content="noindex,nofollow" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Fraunces:opsz,wght@9..144,300..700&display=swap"
            rel="stylesheet"
          />
          <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800,900&display=swap" />
        </Head>
        <style jsx global>{`
          .pcp-org-dashboard,
          .pcp-org-dashboard * ,
          .pcp-org-dashboard *::before,
          .pcp-org-dashboard *::after { box-sizing: border-box; }
          .pcp-org-dashboard {
            --bg: #07090f;
            --teal: #00d4aa;
            --teal-d: rgba(0, 212, 170, 0.1);
            --teal-b: rgba(0, 212, 170, 0.22);
            --amber: #f5a623;
            --amber-d: rgba(245, 166, 35, 0.1);
            --green: #4ade80;
            --green-d: rgba(74, 222, 128, 0.08);
            --blue: #60a5fa;
            --blue-d: rgba(96, 165, 250, 0.08);
            --purple: #a78bfa;
            --purple-d: rgba(167, 139, 250, 0.08);
            --mb: rgba(255, 255, 255, 0.07);
            --glass: rgba(255, 255, 255, 0.028);
            --glass2: rgba(255, 255, 255, 0.045);
            --glassh: rgba(255, 255, 255, 0.055);
            --t1: rgba(255, 255, 255, 0.95);
            --t2: rgba(255, 255, 255, 0.52);
            --t3: rgba(255, 255, 255, 0.28);
            --fd: 'Switzer', sans-serif;
            --fm: 'DM Mono', monospace;
            --fb: 'Switzer', sans-serif;
            min-height: 100vh;
            background: var(--bg);
            color: var(--t1);
            font-family: var(--fb);
            overflow-x: hidden;
          }
          .pcp-org-dashboard button,
          .pcp-org-dashboard input,
          .pcp-org-dashboard select,
          .pcp-org-dashboard textarea { font: inherit; }
          .pcp-org-dashboard a { color: inherit; text-decoration: none; }
          .pcp-shell { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr; grid-template-rows: 56px 1fr; min-height: 100vh; }
          .pcp-amb-layer { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
          .pcp-amb { position: absolute; border-radius: 9999px; filter: blur(110px); opacity: 0; animation: pcpAmbIn 2.5s ease forwards; }
          .pcp-a1 { width: 700px; height: 700px; background: radial-gradient(circle, rgba(0, 212, 170, 0.055) 0%, transparent 70%); top: -200px; right: -150px; animation-delay: 0.2s; }
          .pcp-a2 { width: 500px; height: 500px; background: radial-gradient(circle, rgba(96, 165, 250, 0.04) 0%, transparent 70%); bottom: -100px; left: -100px; animation-delay: 0.5s; }
          .pcp-a3 { width: 350px; height: 350px; background: radial-gradient(circle, rgba(245, 166, 35, 0.03) 0%, transparent 70%); top: 50%; left: 35%; animation-delay: 0.9s; }
          @keyframes pcpAmbIn { to { opacity: 1; } }
          .pcp-topbar { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; height: 56px; border-bottom: 0.5px solid var(--mb); background: rgba(7, 9, 15, 0.75); backdrop-filter: blur(24px); position: sticky; top: 0; z-index: 200; }
          .pcp-topbar-left { display: flex; align-items: center; gap: 14px; }
          .pcp-logo { display: flex; align-items: center; gap: 8px; font-family: var(--fd); font-size: 15px; font-weight: 700; letter-spacing: -0.3px; }
          .pcp-logo-dot { width: 8px; height: 8px; border-radius: 9999px; background: var(--teal); box-shadow: 0 0 12px rgba(0, 212, 170, 0.55); animation: pcpPulse 2.5s ease-in-out infinite; }
          @keyframes pcpPulse { 0%, 100% { box-shadow: 0 0 10px rgba(0, 212, 170, 0.5); } 50% { box-shadow: 0 0 22px rgba(0, 212, 170, 0.85); } }
          .pcp-divider { width: 0.5px; height: 20px; background: var(--mb); }
          .pcp-crumb { font-family: var(--fd); font-size: 12px; font-weight: 600; color: var(--t3); letter-spacing: 0.1em; text-transform: uppercase; }
          .pcp-admin-chip { display: flex; align-items: center; gap: 7px; padding: 4px 12px 4px 6px; border-radius: 9999px; background: var(--glass); border: 0.5px solid var(--mb); font-size: 12px; color: var(--t2); }
          .pcp-av { width: 22px; height: 22px; border-radius: 9999px; background: linear-gradient(135deg, var(--teal), #0891b2); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #fff; text-transform: uppercase; }
          .pcp-sidebar { border-right: 0.5px solid var(--mb); padding: 24px 0; position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto; display: flex; flex-direction: column; }
          .pcp-sidebar::-webkit-scrollbar { display: none; }
          .pcp-nav-sec { margin-bottom: 22px; }
          .pcp-nav-lbl { font-size: 9px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--t3); padding: 0 18px; margin-bottom: 4px; }
          .pcp-nav-item { display: flex; align-items: center; gap: 8px; padding: 8px 18px; font-size: 13px; color: var(--t2); position: relative; }
          .pcp-nav-item.active { color: var(--t1); }
          .pcp-nav-item.active::before { content: ''; position: absolute; left: 0; top: 6px; bottom: 6px; width: 2px; border-radius: 0 2px 2px 0; background: var(--teal); }
          .pcp-nav-item svg { width: 14px; height: 14px; flex-shrink: 0; opacity: 0.55; }
          .pcp-nav-item.active svg { opacity: 1; color: var(--teal); }
          .pcp-nav-badge { margin-left: auto; font-size: 10px; font-weight: 500; padding: 2px 6px; border-radius: 9999px; background: var(--teal-d); color: var(--teal); font-family: var(--fm); }
          .pcp-lifecycle { padding: 12px 18px; margin-top: auto; border-top: 0.5px solid var(--mb); }
          .pcp-lifecycle-lbl { font-size: 9px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--t3); margin-bottom: 8px; }
          .pcp-lifecycle-row { display: flex; align-items: center; gap: 7px; padding: 4px 0; }
          .pcp-lifecycle-dot { width: 6px; height: 6px; border-radius: 9999px; flex-shrink: 0; }
          .pcp-lifecycle-name { font-size: 11px; color: var(--t3); }
          .pcp-lifecycle-count { margin-left: auto; font-size: 10px; font-family: var(--fm); }
          .pcp-main { overflow-y: auto; display: flex; flex-direction: column; }
          .pcp-main::-webkit-scrollbar { width: 3px; }
          .pcp-main::-webkit-scrollbar-thumb { background: var(--mb); border-radius: 2px; }
          .pcp-page-head { padding: 28px 36px 22px; border-bottom: 0.5px solid var(--mb); display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
          .pcp-page-head-left { flex: 1; min-width: 0; }
          .pcp-eyebrow { font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--teal); margin-bottom: 4px; }
          .pcp-heading { font-family: var(--fd); font-size: 26px; font-weight: 700; letter-spacing: -0.4px; margin-bottom: 4px; }
          .pcp-desc { font-size: 13px; color: var(--t2); line-height: 1.55; max-width: 760px; }
          .pcp-page-context { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
          .pcp-context-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 9999px; background: rgba(255, 255, 255, 0.03); border: 0.5px solid rgba(255, 255, 255, 0.08); font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--t2); }
          .pcp-context-pill strong { font-family: var(--fm); font-size: 11px; color: var(--t1); letter-spacing: normal; text-transform: none; }
          .pcp-context-dot { width: 6px; height: 6px; border-radius: 9999px; flex-shrink: 0; }
          .pcp-head-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; padding-top: 4px; }
          .pcp-btn { display: inline-flex; align-items: center; gap: 7px; padding: 8px 16px; border-radius: 9px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: transform 0.12s, filter 0.12s, background 0.15s; letter-spacing: -0.1px; }
          .pcp-btn:active { transform: scale(0.97); }
          .pcp-btn svg { width: 13px; height: 13px; flex-shrink: 0; }
          .pcp-btn-teal { background: var(--teal); color: #07090f; }
          .pcp-btn-teal:hover { filter: brightness(1.08); }
          .pcp-btn-ghost { background: var(--glass); border: 0.5px solid var(--mb); color: var(--t2); }
          .pcp-btn-ghost:hover { background: var(--glassh); color: var(--t1); }
          .pcp-btn:disabled { cursor: not-allowed; opacity: 0.5; }
          .pcp-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 0.5px solid var(--mb); }
          .pcp-stat-cell { padding: 16px 24px; border-right: 0.5px solid var(--mb); display: flex; align-items: center; gap: 12px; }
          .pcp-stat-cell:last-child { border-right: none; }
          .pcp-stat-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .pcp-stat-icon svg { width: 15px; height: 15px; }
          .pcp-si-t { background: var(--teal-d); border: 0.5px solid var(--teal-b); color: var(--teal); }
          .pcp-si-b { background: var(--blue-d); border: 0.5px solid rgba(96, 165, 250, 0.2); color: var(--blue); }
          .pcp-si-a { background: var(--amber-d); border: 0.5px solid rgba(245, 166, 35, 0.2); color: var(--amber); }
          .pcp-si-p { background: var(--purple-d); border: 0.5px solid rgba(167, 139, 250, 0.2); color: var(--purple); }
          .pcp-stat-n { font-family: var(--fm); font-size: 20px; line-height: 1; }
          .pcp-stat-l { font-size: 11px; color: var(--t3); margin-top: 2px; }
          .pcp-toolbar { padding: 12px 36px; display: flex; align-items: center; gap: 10px; border-bottom: 0.5px solid var(--mb); position: sticky; top: 56px; z-index: 50; background: rgba(7, 9, 15, 0.85); backdrop-filter: blur(20px); }
          .pcp-search-wrap { position: relative; flex: 1; max-width: 360px; }
          .pcp-search-input { width: 100%; padding: 8px 12px 8px 32px; background: var(--glass); border: 0.5px solid var(--mb); border-radius: 9px; font-size: 13px; color: var(--t1); outline: none; transition: border-color 0.2s; }
          .pcp-search-input:focus { border-color: var(--teal-b); }
          .pcp-search-input::placeholder { color: var(--t3); }
          .pcp-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--t3); }
          .pcp-search-icon svg { width: 13px; height: 13px; }
          .pcp-filter-pills { display: flex; gap: 5px; }
          .pcp-pill { padding: 5px 12px; border-radius: 9999px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: 0.5px solid transparent; color: var(--t3); background: transparent; }
          .pcp-pill:hover { color: var(--t2); background: var(--glass); }
          .pcp-pill.on { color: var(--t1); background: var(--glass2); border-color: var(--mb); }
          .pcp-pill-prov.on { color: var(--amber); background: var(--amber-d); border-color: rgba(245, 166, 35, 0.2); }
          .pcp-pill-ready.on { color: var(--blue); background: var(--blue-d); border-color: rgba(96, 165, 250, 0.2); }
          .pcp-pill-active.on { color: var(--green); background: var(--green-d); border-color: rgba(74, 222, 128, 0.2); }
          .pcp-toolbar-right { display: flex; gap: 8px; margin-left: auto; }
          .pcp-message { margin: 14px 36px 0; padding: 12px 14px; border-radius: 10px; border: 0.5px solid var(--mb); display: flex; align-items: center; gap: 10px; font-size: 12px; line-height: 1.5; }
          .pcp-message svg { width: 14px; height: 14px; flex-shrink: 0; }
          .pcp-message-success { background: rgba(74, 222, 128, 0.08); border-color: rgba(74, 222, 128, 0.2); color: rgba(74, 222, 128, 0.9); }
          .pcp-message-error { background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); color: rgba(248, 113, 113, 0.95); }
          .pcp-org-list { padding: 12px 36px 40px; }
          .pcp-org-row { border: 0.5px solid var(--mb); border-radius: 14px; margin-bottom: 8px; overflow: hidden; transition: border-color 0.2s; }
          .pcp-org-row:hover, .pcp-org-row.open { border-color: rgba(255, 255, 255, 0.1); }
          .pcp-org-title { background: var(--glass); position: relative; }
          .pcp-org-status-tr { position: absolute; top: 12px; right: 12px; z-index: 2; }
          .pcp-org-hd { display: flex; align-items: center; padding: 0 16px 0 0; cursor: pointer; user-select: none; min-height: 62px; transition: background 0.15s; }
          .pcp-org-hd:hover { background: var(--glassh); }
          .pcp-org-chev { width: 42px; height: 62px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .pcp-org-chev svg { width: 13px; height: 13px; color: var(--t3); transition: transform 0.2s; }
          .pcp-org-row.open .pcp-org-chev svg { transform: rotate(90deg); }
          .pcp-org-ico { width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, rgba(0, 212, 170, 0.14), rgba(0, 212, 170, 0.04)); border: 0.5px solid var(--teal-b); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px; color: var(--teal); }
          .pcp-org-info { flex: 1; min-width: 0; padding: 12px 0; }
          .pcp-level-eyebrow { font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--teal); opacity: 0.7; margin-bottom: 3px; }
          .pcp-org-name { font-size: 14px; font-weight: 600; letter-spacing: -0.2px; margin-bottom: 2px; }
          .pcp-org-meta { font-size: 11px; color: var(--t3); font-family: var(--fm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 520px; }
          .pcp-org-counts { display: flex; gap: 5px; margin-right: 12px; }
          .pcp-mc { display: inline-flex; align-items: center; line-height: 1; font-size: 10px; font-weight: 500; padding: 4px 7px; border-radius: 9999px; background: rgba(255, 255, 255, 0.04); border: 0.5px solid rgba(255, 255, 255, 0.07); color: var(--t3); font-family: var(--fm); white-space: nowrap; }
          .pcp-org-actions { display: flex; align-items: center; gap: 6px; margin-left: 10px; }
          .pcp-status { display: inline-flex; align-items: center; line-height: 1; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 9px; border-radius: 9999px; white-space: nowrap; }
          .pcp-s-prov { background: var(--amber-d); border: 0.5px solid rgba(245, 166, 35, 0.22); color: var(--amber); }
          .pcp-s-ready { background: var(--blue-d); border: 0.5px solid rgba(96, 165, 250, 0.22); color: var(--blue); }
          .pcp-s-active { background: var(--green-d); border: 0.5px solid rgba(74, 222, 128, 0.22); color: var(--green); }
          .pcp-s-done { background: rgba(255, 255, 255, 0.05); border: 0.5px solid rgba(255, 255, 255, 0.08); color: var(--t3); }
          .pcp-ab { padding: 5px 10px; border-radius: 7px; font-size: 11px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: background 0.15s, color 0.15s; border: none; }
          .pcp-ab svg { width: 11px; height: 11px; }
          .pcp-ab-g { background: rgba(255, 255, 255, 0.14); color: #fff; border: 0.5px solid rgba(255, 255, 255, 0.22); }
          .pcp-ab-g:hover { background: rgba(255, 255, 255, 0.22); color: #fff; }
          .pcp-ab-t { background: var(--teal-d); color: var(--teal); border: 0.5px solid var(--teal-b); }
          .pcp-ab-t:hover { background: rgba(0, 212, 170, 0.16); }
          .pcp-ab:disabled { opacity: 0.45; cursor: not-allowed; }
          .pcp-org-body { display: none; padding-bottom: 16px; }
          .pcp-org-row.open .pcp-org-body { display: block; }
          .pcp-team-row { border-top: 0.5px solid var(--mb); }
          .pcp-team-hd { display: flex; align-items: center; padding: 0 16px 0 0; cursor: pointer; user-select: none; min-height: 46px; transition: background 0.15s; }
          .pcp-team-hd:hover { background: rgba(255, 255, 255, 0.018); }
          .pcp-t-indent { width: 42px; flex-shrink: 0; }
          .pcp-t-chev { width: 26px; height: 46px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .pcp-t-chev svg { width: 11px; height: 11px; color: var(--t3); transition: transform 0.2s; }
          .pcp-team-row.open .pcp-t-chev svg { transform: rotate(90deg); }
          .pcp-t-vline { width: 1px; height: 28px; background: rgba(255, 255, 255, 0.07); margin-right: 10px; flex-shrink: 0; }
          .pcp-t-av { width: 26px; height: 26px; border-radius: 7px; background: rgba(255, 255, 255, 0.04); border: 0.5px solid rgba(255, 255, 255, 0.07); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 9px; color: var(--t3); }
          .pcp-t-av svg { width: 12px; height: 12px; }
          .pcp-t-info { flex: 1; min-width: 0; }
          .pcp-t-name { font-size: 13px; font-weight: 600; }
          .pcp-t-meta { font-size: 10px; color: var(--t3); font-family: var(--fm); }
          .pcp-t-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
          .pcp-team-body { display: none; }
          .pcp-team-row.open .pcp-team-body { display: block; }
          .pcp-pilot-row { display: flex; align-items: center; padding: 0 16px 0 0; border-top: 0.5px solid rgba(255, 255, 255, 0.04); cursor: pointer; min-height: 38px; transition: background 0.15s; }
          .pcp-pilot-row:hover { background: rgba(255, 255, 255, 0.015); }
          .pcp-pilot-row.open { background: rgba(0, 212, 170, 0.018); }
          .pcp-p-indent { width: 80px; flex-shrink: 0; }
          .pcp-p-dot { width: 5px; height: 5px; border-radius: 9999px; background: rgba(255, 255, 255, 0.14); flex-shrink: 0; margin-right: 9px; }
          .pcp-p-info { flex: 1; min-width: 0; padding: 7px 0; }
          .pcp-p-name { font-size: 12px; font-weight: 600; }
          .pcp-p-meta { font-size: 10px; color: var(--t3); font-family: var(--fm); margin-top: 1px; }
          .pcp-p-right { display: flex; align-items: center; gap: 7px; flex-shrink: 0; }
          .pcp-p-chev svg { width: 10px; height: 10px; color: var(--t3); transition: transform 0.2s; }
          .pcp-pilot-row.open .pcp-p-chev svg { transform: rotate(90deg); }
          .pcp-pilot-panel { display: none; padding: 10px 16px 12px 100px; border-top: 0.5px solid rgba(255, 255, 255, 0.04); background: rgba(0, 212, 170, 0.012); }
          .pcp-pilot-panel.open { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .pcp-pp-lbl { font-size: 9px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--t3); margin-bottom: 6px; }
          .pcp-pilot-settings { grid-column: 1 / -1; padding: 11px 12px 12px; border-radius: 10px; border: 0.5px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.025); }
          .pcp-pilot-settings-copy { font-size: 11px; color: var(--t2); line-height: 1.55; margin-bottom: 10px; max-width: 720px; }
          .pcp-pilot-settings-grid { display: grid; grid-template-columns: minmax(200px, 240px) minmax(0, 1fr); gap: 12px; align-items: end; }
          .pcp-pilot-settings-actions { display: flex; align-items: end; justify-content: space-between; gap: 12px; }
          .pcp-pilot-settings-note { font-size: 11px; color: var(--t3); line-height: 1.5; }
          .pcp-cohort-item,
          .pcp-ob-item { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; border-radius: 8px; margin-bottom: 4px; background: rgba(255, 255, 255, 0.025); border: 0.5px solid rgba(255, 255, 255, 0.06); gap: 10px; }
          .pcp-ci-name { font-size: 11px; font-weight: 500; }
          .pcp-ci-meta { font-size: 9px; color: var(--t3); font-family: var(--fm); margin-top: 1px; }
          .pcp-ob-type { font-size: 10px; font-weight: 600; color: var(--t2); }
          .pcp-ob-val { font-size: 10px; color: var(--teal); font-family: var(--fm); margin-top: 1px; line-height: 1.5; }
          .pcp-ob-empty { font-size: 10px; color: var(--t3); font-style: italic; margin-top: 1px; line-height: 1.5; }
          .pcp-c-empty { font-size: 11px; color: var(--t3); font-style: italic; padding: 4px 0; }
          .pcp-empty-panel { padding: 24px 18px; border-radius: 14px; border: 0.5px dashed rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.02); text-align: center; color: var(--t2); font-size: 12px; }
          .pcp-org-overview { padding: 16px 16px 16px 54px; }
          .pcp-org-grid,
          .pcp-team-grid { display: grid; gap: 12px; }
          .pcp-org-grid { grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); }
          .pcp-team-card { margin: 12px 16px 0 54px; }
          .pcp-pilot-card { margin: 10px 16px 0 80px; }
          .pcp-pilot-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
          .pcp-team-shell { padding: 12px 0 4px 0; }
          .pcp-team-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr) minmax(0, 0.9fr); margin-bottom: 12px; }
          .pcp-card { border-radius: 14px; border: 0.5px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.02); padding: 14px; }
          .pcp-card-title { font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--t3); margin-bottom: 10px; }
          .pcp-card-copy { font-size: 12px; color: var(--t2); line-height: 1.55; }
          .pcp-summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .pcp-summary-item { padding: 11px 12px; border-radius: 10px; border: 0.5px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.02); }
          .pcp-summary-kicker { font-size: 9px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--t3); margin-bottom: 4px; }
          .pcp-summary-value { font-size: 12px; font-weight: 600; line-height: 1.45; }
          .pcp-summary-subcopy { margin-top: 4px; font-size: 11px; color: var(--t2); line-height: 1.5; }
          .pcp-preview-shell { display: flex; gap: 12px; align-items: center; }
          .pcp-preview-image { width: 72px; height: 72px; border-radius: 16px; object-fit: cover; border: 0.5px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.04); flex-shrink: 0; }
          .pcp-preview-meta { min-width: 0; }
          .pcp-preview-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
          .pcp-preview-copy { font-size: 11px; color: var(--t2); line-height: 1.55; }
          .pcp-preview-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
          .pcp-file-trigger input { display: none; }
          .pcp-card-stack { display: grid; gap: 10px; }
          .pcp-tracker-card { margin-top: 12px; }
          .pcp-tracker-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 14px; }
          .pcp-tracker-title-row { display: flex; align-items: center; gap: 10px; }
          .pcp-tracker-icon { width: 30px; height: 30px; border-radius: 9px; background: var(--teal-d); border: 0.5px solid var(--teal-b); color: var(--teal); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .pcp-tracker-icon svg { width: 14px; height: 14px; }
          .pcp-tracker-title { font-size: 13px; font-weight: 700; letter-spacing: -0.1px; }
          .pcp-tracker-copy { margin-top: 3px; max-width: 760px; font-size: 11px; color: var(--t2); line-height: 1.55; }
          .pcp-tracker-actions { display: flex; gap: 8px; flex-wrap: wrap; }
          .pcp-tracker-progress-shell { display: grid; gap: 8px; margin-bottom: 14px; }
          .pcp-tracker-progress-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 11px; color: var(--t2); }
          .pcp-tracker-progress-track { height: 6px; overflow: hidden; border-radius: 9999px; background: rgba(255, 255, 255, 0.07); }
          .pcp-tracker-progress-bar { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--teal), #60a5fa); transition: width 0.2s ease; }
          .pcp-tracker-legend { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
          .pcp-tracker-legend-item { border: 0.5px solid rgba(255, 255, 255, 0.08); border-radius: 10px; background: rgba(255, 255, 255, 0.02); padding: 8px 9px; min-width: 0; }
          .pcp-tracker-legend-desc { margin-top: 5px; font-size: 10px; line-height: 1.35; color: var(--t3); }
          .pcp-tracker-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .pcp-tracker-step { border: 0.5px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 10px; background: rgba(255, 255, 255, 0.022); display: grid; gap: 8px; }
          .pcp-tracker-step-main { display: flex; gap: 9px; align-items: flex-start; min-width: 0; }
          .pcp-tracker-step-dot { width: 18px; height: 18px; border-radius: 9999px; border: 0.5px solid rgba(255, 255, 255, 0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; color: var(--t3); }
          .pcp-tracker-step-dot svg { width: 10px; height: 10px; }
          .pcp-tracker-step-title { font-size: 12px; font-weight: 600; color: var(--t1); line-height: 1.35; }
          .pcp-tracker-step-meta { margin-top: 3px; font-size: 10px; color: var(--t3); line-height: 1.4; }
          .pcp-tracker-step-copy { font-size: 11px; color: var(--t2); line-height: 1.5; }
          .pcp-tracker-step-footer { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
          .pcp-tracker-select { min-width: 132px; padding: 6px 9px; border-radius: 8px; border: 0.5px solid var(--mb); background: rgba(0, 0, 0, 0.22); color: var(--t1); font-size: 11px; outline: none; }
          .pcp-tracker-saving { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; color: var(--teal); }
          .pcp-tracker-saving svg { width: 11px; height: 11px; }
          .pcp-tracker-status { border-radius: 9999px; padding: 3px 7px; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; }
          .pcp-tracker-status-complete { background: var(--green-d); border: 0.5px solid rgba(74, 222, 128, 0.22); color: var(--green); }
          .pcp-tracker-status-progress { background: var(--blue-d); border: 0.5px solid rgba(96, 165, 250, 0.2); color: var(--blue); }
          .pcp-tracker-status-blocked { background: rgba(239, 68, 68, 0.09); border: 0.5px solid rgba(239, 68, 68, 0.22); color: rgba(248, 113, 113, 0.95); }
          .pcp-tracker-status-pending { background: rgba(255, 255, 255, 0.045); border: 0.5px solid rgba(255, 255, 255, 0.08); color: var(--t3); }
          @media (max-width: 980px) {
            .pcp-tracker-legend { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }
          .pcp-link-card { padding: 11px 12px; border-radius: 10px; border: 0.5px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.02); display: flex; justify-content: space-between; gap: 12px; }
          .pcp-link-card-main { min-width: 0; }
          .pcp-link-card-copy { font-size: 11px; color: var(--t2); line-height: 1.55; margin-top: 4px; }
          .pcp-commercial-shell { display: grid; gap: 10px; }
          .pcp-commercial-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .pcp-checkbox-row { display: flex; gap: 10px; padding: 11px 12px; border-radius: 10px; border: 0.5px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.02); }
          .pcp-checkbox-row input { margin-top: 3px; accent-color: #00d4aa; }
          .pcp-checkbox-copy { font-size: 11px; color: var(--t2); line-height: 1.55; }
          .pcp-commercial-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
          .pcp-commercial-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 76px; min-height: 76px; padding: 12px; border-radius: 9999px; border: 0.5px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.02); font-size: 10px; line-height: 1.35; text-transform: uppercase; letter-spacing: 0.12em; color: var(--t2); text-align: center; }
          .pcp-modal-bg { position: fixed; inset: 0; z-index: 500; background: rgba(7, 9, 15, 0.7); backdrop-filter: blur(8px); display: flex; align-items: flex-start; justify-content: flex-end; opacity: 0; pointer-events: none; transition: opacity 0.25s ease; }
          .pcp-modal-bg.open { opacity: 1; pointer-events: all; }
          .pcp-modal { width: 560px; height: 100vh; overflow-y: auto; background: rgba(10, 13, 22, 0.97); border-left: 0.5px solid var(--mb); display: flex; flex-direction: column; transform: translateX(40px); transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1); }
          .pcp-modal-bg.open .pcp-modal { transform: translateX(0); }
          .pcp-modal::-webkit-scrollbar { width: 3px; }
          .pcp-modal::-webkit-scrollbar-thumb { background: var(--mb); border-radius: 2px; }
          .pcp-modal-tb { display: flex; align-items: center; justify-content: space-between; padding: 0 24px; min-height: 56px; border-bottom: 0.5px solid var(--mb); position: sticky; top: 0; background: rgba(10, 13, 22, 0.97); z-index: 10; }
          .pcp-modal-title { font-family: var(--fd); font-size: 14px; font-weight: 700; }
          .pcp-modal-x { width: 28px; height: 28px; border-radius: 7px; background: var(--glass); border: 0.5px solid var(--mb); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s; color: var(--t2); }
          .pcp-modal-x:hover { background: var(--glassh); color: var(--t1); }
          .pcp-modal-x svg { width: 13px; height: 13px; }
          .pcp-modal-steps { display: flex; gap: 0; padding: 0 24px; border-bottom: 0.5px solid var(--mb); overflow-x: auto; flex-shrink: 0; }
          .pcp-modal-steps::-webkit-scrollbar { display: none; }
          .pcp-ms { display: flex; align-items: center; gap: 6px; padding: 11px 14px; font-size: 12px; font-weight: 500; color: var(--t3); cursor: pointer; border-bottom: 1.5px solid transparent; white-space: nowrap; transition: color 0.15s, border-color 0.15s; flex-shrink: 0; background: transparent; border-left: none; border-right: none; border-top: none; }
          .pcp-ms.active { color: var(--t1); border-bottom-color: var(--teal); }
          .pcp-ms.done { color: var(--teal); }
          .pcp-ms-num { width: 18px; height: 18px; border-radius: 9999px; font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(255, 255, 255, 0.07); color: var(--t3); }
          .pcp-ms.active .pcp-ms-num { background: var(--teal); color: #07090f; }
          .pcp-ms.done .pcp-ms-num { background: rgba(0, 212, 170, 0.15); color: var(--teal); }
          .pcp-modal-body { padding: 26px 24px; flex: 1; }
          .pcp-m-tab { display: none; }
          .pcp-m-tab.active { display: block; }
          .pcp-sec-hd { display: flex; align-items: center; gap: 9px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 0.5px solid var(--mb); }
          .pcp-sec-ic { width: 26px; height: 26px; border-radius: 7px; background: var(--glass); border: 0.5px solid var(--mb); display: flex; align-items: center; justify-content: center; color: var(--teal); }
          .pcp-sec-ic svg { width: 12px; height: 12px; }
          .pcp-sec-tl { font-family: var(--fd); font-size: 13px; font-weight: 600; }
          .pcp-info-box,
          .pcp-warn-box { padding: 11px 13px; border-radius: 9px; font-size: 12px; line-height: 1.55; margin-bottom: 12px; }
          .pcp-info-box { background: var(--teal-d); border: 0.5px solid var(--teal-b); color: rgba(0, 212, 170, 0.85); }
          .pcp-warn-box { background: var(--amber-d); border: 0.5px solid rgba(245, 166, 35, 0.22); color: var(--amber); }
          .pcp-fg { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
          .pcp-fg.pcp-c1 { grid-template-columns: 1fr; }
          .pcp-fld { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
          .pcp-fld.pcp-s2 { grid-column: 1 / -1; }
          .pcp-flbl { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--t3); }
          .pcp-finp { width: 100%; max-width: 100%; box-sizing: border-box; background: var(--glass); border: 0.5px solid var(--mb); border-radius: 9px; padding: 8px 12px; font-size: 13px; color: var(--t1); outline: none; transition: border-color 0.2s, background 0.2s; }
          .pcp-finp:focus { border-color: var(--teal-b); background: var(--teal-d); }
          .pcp-finp::placeholder { color: var(--t3); }
          .pcp-finp:disabled { opacity: 0.5; cursor: not-allowed; }
          .pcp-finp.pcp-select { cursor: pointer; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
          .pcp-finp.pcp-textarea { resize: vertical; min-height: 76px; line-height: 1.55; }
          .pcp-fhint { font-size: 11px; color: var(--t3); line-height: 1.45; }
          .pcp-toggle-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 13px; border-radius: 10px; background: var(--glass); border: 0.5px solid var(--mb); margin-bottom: 12px; }
          .pcp-tt { width: 34px; height: 19px; border-radius: 9999px; background: rgba(255, 255, 255, 0.1); border: 0.5px solid var(--mb); position: relative; cursor: pointer; transition: background 0.2s; flex-shrink: 0; margin-top: 1px; }
          .pcp-tt.on { background: var(--teal); }
          .pcp-tk { position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 9999px; background: #fff; transition: transform 0.2s; }
          .pcp-tt.on .pcp-tk { transform: translateX(15px); }
          .pcp-t-lbl { font-size: 13px; font-weight: 500; margin-bottom: 2px; }
          .pcp-t-desc { font-size: 11px; color: var(--t2); line-height: 1.5; }
          .pcp-route-mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
          .pcp-route-mode { border-radius: 10px; border: 0.5px solid var(--mb); background: var(--glass); color: var(--t2); padding: 12px 13px; text-align: left; cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s; }
          .pcp-route-mode.active { border-color: rgba(167, 139, 250, 0.35); background: rgba(167, 139, 250, 0.12); color: var(--t1); }
          .pcp-route-mode-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
          .pcp-route-mode-copy { font-size: 11px; color: var(--t2); line-height: 1.5; }
          .pcp-clinician-card { border-radius: 10px; border: 0.5px solid var(--mb); background: rgba(255, 255, 255, 0.02); padding: 12px 13px; margin-bottom: 8px; display: flex; justify-content: space-between; gap: 12px; }
          .pcp-chip-row { display: flex; flex-wrap: wrap; gap: 6px; min-height: 18px; }
          .pcp-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 9999px; background: rgba(167, 139, 250, 0.12); border: 0.5px solid rgba(167, 139, 250, 0.22); color: #efe7ff; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
          .pcp-chip button { background: transparent; border: none; color: inherit; cursor: pointer; display: inline-flex; align-items: center; }
          .pcp-chip-input { min-width: 180px; flex: 1; background: transparent; border: none; outline: none; color: var(--t1); font-size: 13px; }
          .pcp-modal-ft { padding: 14px 24px; border-top: 0.5px solid var(--mb); display: flex; align-items: center; justify-content: space-between; position: sticky; bottom: 0; background: rgba(10, 13, 22, 0.97); z-index: 10; }
          .pcp-modal-ft-l { font-size: 12px; color: var(--t3); }
          .pcp-modal-ft-r { display: flex; gap: 8px; }
          .pcp-slide-up { opacity: 0; animation: pcpSlideUp 0.4s ease forwards; }
          .pcp-fade-in { opacity: 0; animation: pcpFadeIn 0.35s ease forwards; }
          @keyframes pcpFadeIn { to { opacity: 1; } }
          @keyframes pcpSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
          @media (max-width: 900px) {
            .pcp-page-head,
            .pcp-toolbar,
            .pcp-org-list { padding-left: 18px; padding-right: 18px; }
            .pcp-message { margin-left: 18px; margin-right: 18px; }
            .pcp-page-head { flex-direction: column; }
            .pcp-page-context { margin-top: 12px; }
            .pcp-stats-row { grid-template-columns: repeat(2, 1fr); }
            .pcp-stat-cell:nth-child(2) { border-right: none; }
            .pcp-toolbar { flex-wrap: wrap; }
            .pcp-filter-pills { flex-wrap: wrap; }
            .pcp-org-grid,
            .pcp-team-grid,
            .pcp-summary-grid,
            .pcp-commercial-grid,
            .pcp-tracker-grid { grid-template-columns: 1fr; }
            .pcp-org-overview { padding-left: 18px; }
            .pcp-team-card { margin-left: 18px; margin-right: 16px; }
            .pcp-pilot-card { margin-left: 28px; margin-right: 16px; }
            .pcp-pilot-grid { grid-template-columns: 1fr; }
            .pcp-team-shell { padding-left: 0; }
            .pcp-pilot-panel.open { grid-template-columns: 1fr; padding-left: 80px; }
            .pcp-pilot-settings-grid { grid-template-columns: 1fr; }
            .pcp-pilot-settings-actions { flex-direction: column; align-items: flex-start; }
            .pcp-fg { grid-template-columns: 1fr; }
            .pcp-route-mode-grid { grid-template-columns: 1fr; }
            .pcp-modal { width: min(100vw, 560px); }
          }
          @media (max-width: 640px) {
            .pcp-topbar { padding: 0 16px; }
            .pcp-stats-row { grid-template-columns: 1fr; }
            .pcp-stat-cell { border-right: none; border-bottom: 0.5px solid var(--mb); }
            .pcp-stat-cell:last-child { border-bottom: none; }
            .pcp-org-hd, .pcp-team-hd { flex-wrap: wrap; padding-right: 12px; }
            .pcp-org-counts, .pcp-org-actions, .pcp-t-right { width: 100%; margin: 0 0 12px 54px; flex-wrap: wrap; }
            .pcp-org-meta { white-space: normal; }
            .pcp-pilot-card { margin-left: 14px; }
            .pcp-pilot-panel.open { padding-left: 18px; }
            .pcp-modal-ft { flex-direction: column; align-items: stretch; gap: 10px; }
            .pcp-modal-ft-r { justify-content: space-between; }
          }
        `}</style>

        <div className="pcp-org-dashboard">
          <div className="pcp-amb-layer">
            <div className="pcp-amb pcp-a1" />
            <div className="pcp-amb pcp-a2" />
            <div className="pcp-amb pcp-a3" />
          </div>

          <div className="pcp-shell">
            <header className="pcp-topbar">
              <div className="pcp-topbar-left">
                <div className="pcp-logo">
                  <div className="pcp-logo-dot" />
                  PulseCheck
                </div>
                <div className="pcp-divider" />
                <span className="pcp-crumb">Admin</span>
              </div>

              <div className="pcp-admin-chip">
                <div className="pcp-av">{adminInitials || 'PA'}</div>
                <span>{currentUser?.email || 'unknown user'}</span>
              </div>
            </header>

            <main className="pcp-main">
              <div
                id="organizations-directory"
                className="pcp-page-head pcp-slide-up scroll-mt-24"
                data-tour="admin-provisioning-header"
              >
                <div className="pcp-page-head-left">
                  <div className="pcp-eyebrow">PulseCheck Admin</div>
                  <div className="pcp-heading">Organizations</div>
                  <div className="pcp-desc">
                    All partner organizations provisioned in PulseCheck. Each org holds teams, pilots, cohorts, support routes,
                    and onboarding links inside one connected hierarchy.
                  </div>
                  <div className="pcp-page-context">
                    <div className="pcp-context-pill">
                      <Building2 />
                      Organizations
                      <strong>{mapSummary.organizationCount}</strong>
                    </div>
                    <div className="pcp-context-pill">
                      <span className="pcp-context-dot" style={{ background: 'var(--amber)' }} />
                      Provisioning
                      <strong>{mapSummary.provisioningCount}</strong>
                    </div>
                    <div className="pcp-context-pill">
                      <span className="pcp-context-dot" style={{ background: 'var(--blue)' }} />
                      Ready
                      <strong>{mapSummary.organizationReadyCount}</strong>
                    </div>
                    <div className="pcp-context-pill">
                      <span className="pcp-context-dot" style={{ background: 'var(--green)' }} />
                      Active
                      <strong>{mapSummary.organizationActiveCount}</strong>
                    </div>
                  </div>
                </div>

                <div className="pcp-head-right" data-tour="admin-provisioning-actions">
                  <button type="button" className="pcp-btn pcp-btn-ghost" onClick={() => setAdminTourOpen(true)}>
                    <Sparkles />
                    Walkthrough
                  </button>
                  <Link href="/admin/pulsecheckOnboardingOverview" className="pcp-btn pcp-btn-ghost">
                    <ClipboardList />
                    Playbook
                  </Link>
                  <button type="button" className="pcp-btn pcp-btn-ghost" onClick={handleExportOrganizations}>
                    <Download />
                    Export
                  </button>
                  <button type="button" className="pcp-btn pcp-btn-teal" onClick={() => handleOpenProvisioningModal('org')}>
                    <Plus />
                    New Organization
                  </button>
                </div>
              </div>

              <div className="pcp-stats-row pcp-slide-up" style={{ animationDelay: '0.06s' }}>
                <div className="pcp-stat-cell">
                  <div className="pcp-stat-icon pcp-si-t"><Building2 /></div>
                  <div>
                    <div className="pcp-stat-n">{mapSummary.organizationCount}</div>
                    <div className="pcp-stat-l">Organizations</div>
                  </div>
                </div>
                <div className="pcp-stat-cell">
                  <div className="pcp-stat-icon pcp-si-b"><Users2 /></div>
                  <div>
                    <div className="pcp-stat-n">{mapSummary.teamCount}</div>
                    <div className="pcp-stat-l">Teams</div>
                  </div>
                </div>
                <div className="pcp-stat-cell">
                  <div className="pcp-stat-icon pcp-si-a"><ClipboardList /></div>
                  <div>
                    <div className="pcp-stat-n">{mapSummary.pilotCount}</div>
                    <div className="pcp-stat-l">Pilots</div>
                  </div>
                </div>
                <div className="pcp-stat-cell">
                  <div className="pcp-stat-icon pcp-si-p"><Clipboard /></div>
                  <div>
                    <div className="pcp-stat-n">{mapSummary.cohortCount}</div>
                    <div className="pcp-stat-l">Cohorts</div>
                  </div>
                </div>
              </div>

              <div className="pcp-toolbar pcp-slide-up" style={{ animationDelay: '0.1s' }} data-tour="admin-provisioning-filters">
                <div className="pcp-search-wrap">
                  <div className="pcp-search-icon"><Search /></div>
                  <input
                    className="pcp-search-input"
                    type="text"
                    value={organizationSearch}
                    onChange={(event) => setOrganizationSearch(event.target.value)}
                    placeholder="Search organizations, teams, pilots..."
                  />
                </div>

                <div className="pcp-filter-pills">
                  <button
                    type="button"
                    className={`pcp-pill ${organizationStatusFilter === 'all' ? 'on' : ''}`}
                    onClick={() => setOrganizationStatusFilter('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`pcp-pill pcp-pill-prov ${organizationStatusFilter === 'prov' ? 'on' : ''}`}
                    onClick={() => setOrganizationStatusFilter('prov')}
                  >
                    Provisioning
                  </button>
                  <button
                    type="button"
                    className={`pcp-pill pcp-pill-ready ${organizationStatusFilter === 'ready' ? 'on' : ''}`}
                    onClick={() => setOrganizationStatusFilter('ready')}
                  >
                    Ready
                  </button>
                  <button
                    type="button"
                    className={`pcp-pill pcp-pill-active ${organizationStatusFilter === 'active' ? 'on' : ''}`}
                    onClick={() => setOrganizationStatusFilter('active')}
                  >
                    Active
                  </button>
                </div>

                <div className="pcp-toolbar-right">
                  <button type="button" className="pcp-btn pcp-btn-ghost" onClick={handleToggleAllRows}>
                    <ChevronDown />
                    Toggle all
                  </button>
                </div>
              </div>

              {message ? (
                <div className={`pcp-message ${message.type === 'success' ? 'pcp-message-success' : 'pcp-message-error'}`}>
                  <AlertTriangle />
                  <span>{message.text}</span>
                </div>
              ) : null}

              <div id="organization-hierarchy" className="pcp-org-list scroll-mt-24" data-tour="admin-organization-list">
                {loading ? (
                  <div className="pcp-empty-panel">Loading organizations and provisioning hierarchy...</div>
                ) : filteredOrganizationBundles.length === 0 ? (
                  <div className="pcp-empty-panel">No organizations match the current filters.</div>
                ) : (
                  filteredOrganizationBundles.map(({ organization, teams: bundledTeams }, organizationIndex) => {
                    const orgStatus = getOrganizationStatusDisplay(organization.status);
                    const organizationExpanded = expandedOrganizationIds.includes(organization.id);
                    const orgArtworkOpen = expandedOrgCardKeys.has(`${organization.id}:artwork`);
                    const orgSummaryOpen = expandedOrgCardKeys.has(`${organization.id}:summary`);
                    const organizationPreviewImage = resolvePulseCheckInvitePreviewImage(undefined, organization.invitePreviewImageUrl);
                    const organizationAdminCount =
                      (organization.primaryCustomerAdminEmail ? 1 : 0) + (organization.additionalAdminContacts?.length || 0);
                    const totalPilotCount = bundledTeams.reduce((count, bundle) => count + bundle.pilots.length, 0);
                    const totalCohortCount = bundledTeams.reduce(
                      (count, bundle) => count + bundle.pilots.reduce((pilotCount, pilotBundle) => pilotCount + pilotBundle.cohorts.length, 0),
                      0
                    );
                    const firstBundle = bundledTeams[0] || null;

                    return (
                      <div
                        key={organization.id}
                        className={`pcp-org-row ${organizationExpanded ? 'open' : ''} pcp-fade-in`}
                        style={{ animationDelay: `${0.14 + organizationIndex * 0.05}s` }}
                      >
                        <div className="pcp-org-title">
                        <span className={`pcp-status pcp-org-status-tr ${getDashboardStatusClassName(orgStatus)}`}>{orgStatus.label}</span>
                        <div className="pcp-org-hd" onClick={() => toggleOrganizationRow(organization.id)}>
                          <div className="pcp-org-chev"><ChevronDown /></div>
                          <div className="pcp-org-ico"><Building2 /></div>
                          <div className="pcp-org-info">
                            <div className="pcp-level-eyebrow">Organization</div>
                            <div className="pcp-org-name">{organization.displayName}</div>
                            <div className="pcp-org-meta">
                              {[
                                formatEnumLabel(organization.organizationType),
                                `${formatEnumLabel(organization.defaultStudyPosture).toLowerCase()} posture`,
                                `clinician: ${formatEnumLabel(organization.defaultClinicianBridgeMode).toLowerCase()}`,
                                organization.primaryCustomerAdminEmail || 'no admin email',
                              ].join(' · ')}
                            </div>
                          </div>

                          <div className="pcp-org-counts">
                            <span className="pcp-mc">{bundledTeams.length} team{bundledTeams.length === 1 ? '' : 's'}</span>
                            <span className="pcp-mc">{totalPilotCount} pilot{totalPilotCount === 1 ? '' : 's'}</span>
                            <span className="pcp-mc">{totalCohortCount} cohort{totalCohortCount === 1 ? '' : 's'}</span>
                          </div>

                          <div className="pcp-org-actions">
                            <button
                              type="button"
                              className="pcp-ab pcp-ab-g"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenProvisioningModal('team', { organizationId: organization.id });
                              }}
                            >
                              <Plus />
                              Add Team
                            </button>
                            {firstBundle ? (
                              <button
                                type="button"
                                className="pcp-ab pcp-ab-g"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenOnboardingModal({
                                    channel: 'admin',
                                    organization,
                                    team: firstBundle.team,
                                    clinicianProfile: firstBundle.clinicianProfile,
                                  });
                                }}
                              >
                                <MoreHorizontal />
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {organizationExpanded ? (
                          <div className="pcp-org-overview">
                            <div className="pcp-org-grid">
                              <div className="pcp-card">
                                <button
                                  type="button"
                                  onClick={() => toggleOrgCard(`${organization.id}:artwork`)}
                                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', background: 'transparent', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}
                                >
                                  <span className="pcp-card-title" style={{ marginBottom: 0 }}>Invite Artwork · Organization default</span>
                                  <ChevronDown style={{ width: 16, height: 16, flexShrink: 0, color: 'rgba(255,255,255,0.5)', transform: orgArtworkOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                </button>
                                {orgArtworkOpen ? (
                                <div style={{ marginTop: 12 }}>
                                <div className="pcp-preview-shell">
                                  <img
                                    className="pcp-preview-image"
                                    src={organizationPreviewImage}
                                    alt={`${organization.displayName} invite artwork`}
                                  />
                                  <div className="pcp-preview-meta">
                                    <div className="pcp-preview-title">{organization.displayName}</div>
                                    <div className="pcp-preview-copy">
                                      The image athletes see on invites. Every team uses this by default — a team can override it with its own below.
                                    </div>
                                  </div>
                                </div>
                                <div className="pcp-preview-actions">
                                  <label className="pcp-ab pcp-ab-g pcp-file-trigger">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(event) => {
                                        void handleOrganizationInviteImageUpload(organization.id, event.target.files?.[0] || null);
                                        event.currentTarget.value = '';
                                      }}
                                    />
                                    {organizationImageUploadingId === organization.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Sparkles className="h-3.5 w-3.5" />
                                    )}
                                    {organizationImageUploadingId === organization.id ? 'Uploading...' : 'Upload Organization Image'}
                                  </label>
                                </div>
                                </div>
                                ) : (
                                  <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                                    Default invite image every team uses. Open to view or change.
                                  </div>
                                )}
                              </div>

                              <div className="pcp-card">
                                <button
                                  type="button"
                                  onClick={() => toggleOrgCard(`${organization.id}:summary`)}
                                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', background: 'transparent', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}
                                >
                                  <span className="pcp-card-title" style={{ marginBottom: 0 }}>Organization Summary</span>
                                  <ChevronDown style={{ width: 16, height: 16, flexShrink: 0, color: 'rgba(255,255,255,0.5)', transform: orgSummaryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                </button>
                                {orgSummaryOpen ? (
                                <div className="pcp-summary-grid">
                                  <div className="pcp-summary-item">
                                    <div className="pcp-summary-kicker">Customer Admin</div>
                                    <div className="pcp-summary-value">
                                      {organization.primaryCustomerAdminName || organization.primaryCustomerAdminEmail || 'Not set'}
                                    </div>
                                    <div className="pcp-summary-subcopy">
                                      {organization.primaryCustomerAdminEmail || 'No handoff email configured yet'}
                                    </div>
                                  </div>
                                  <div className="pcp-summary-item">
                                    <div className="pcp-summary-kicker">Study Posture</div>
                                    <div className="pcp-summary-value">{formatEnumLabel(organization.defaultStudyPosture)}</div>
                                    <div className="pcp-summary-subcopy">
                                      Clinician routing {formatEnumLabel(organization.defaultClinicianBridgeMode).toLowerCase()}
                                    </div>
                                  </div>
                                  <div className="pcp-summary-item">
                                    <div className="pcp-summary-kicker">Activation State</div>
                                    <div className="pcp-summary-value">{orgStatus.label}</div>
                                    <div className="pcp-summary-subcopy">
                                      {totalPilotCount} pilot{totalPilotCount === 1 ? '' : 's'} and {totalCohortCount} cohort
                                      {totalCohortCount === 1 ? '' : 's'} inside this org.
                                    </div>
                                  </div>
                                  <div className="pcp-summary-item">
                                    <div className="pcp-summary-kicker">Admin Contacts</div>
                                    <div className="pcp-summary-value">
                                      {organizationAdminCount} admin{organizationAdminCount === 1 ? '' : 's'}
                                    </div>
                                    <div className="pcp-summary-subcopy">
                                      {bundledTeams.length} connected team{bundledTeams.length === 1 ? '' : 's'} inheriting this shell.
                                    </div>
                                  </div>
                                </div>
                                ) : (
                                  <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                                    {organization.primaryCustomerAdminName || organization.primaryCustomerAdminEmail || 'No admin'} · {formatEnumLabel(organization.defaultStudyPosture)} · {orgStatus.label} · {bundledTeams.length} team{bundledTeams.length === 1 ? '' : 's'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          ) : null}
                          </div>

                        <div className="pcp-org-body">
                          {bundledTeams.length === 0 ? (
                            <div className="pcp-team-body" style={{ display: 'block' }}>
                              <div style={{ padding: '12px 16px 12px 54px' }}>
                                <div className="pcp-c-empty">No teams attached yet.</div>
                              </div>
                            </div>
                          ) : (
                            bundledTeams.map(({ team, pilots: bundledPilots, clinicianProfile, adminActivationLinks, adminActivationLinksAll, clinicianOnboardingLink }) => {
                              const teamCollapsed = collapsedTeamIds.has(team.id);
                              const teamArtworkOpen = expandedOrgCardKeys.has(`${team.id}:artwork`);
                              const teamCommercialOpen = expandedOrgCardKeys.has(`${team.id}:commercial`);
                              const teamSupportOpen = expandedOrgCardKeys.has(`${team.id}:support`);
                              const teamConsentCardOpen = expandedOrgCardKeys.has(`${team.id}:consent`);
                              const teamIntakeCardOpen = expandedOrgCardKeys.has(`${team.id}:intakecard`);
                              const teamStatus = getTeamStatusDisplay(team.status);
                              const activeAdminLink = adminActivationLinks[0] || null;
                              // Once any activation email is sent, the card flips from
                              // "Send Activation Email" to "Manage Activations".
                              const allAdminLinks = adminActivationLinksAll || [];
                              const activationEmailSent = allAdminLinks.some(
                                (link) => (link.emailSendCount || 0) > 0 || link.lastEmailStatus === 'sent'
                              );
                              const teamCommercialDraft = teamCommercialDrafts[team.id] || team.commercialConfig;
                              const teamPreviewImage = resolvePulseCheckInvitePreviewImage(
                                team.invitePreviewImageUrl,
                                organization.invitePreviewImageUrl
                              );
                              const teamPlanBypass = derivePulseCheckTeamPlanBypass(teamCommercialDraft);

                              return (
                                <div key={team.id} id={`pcp-team-${team.id}`} className="pcp-card pcp-team-card" style={{ paddingBottom: 20, scrollMarginTop: 16 }}>
                                  <div
                                    className="pcp-team-hd"
                                    style={{ cursor: 'pointer', padding: 0, minHeight: 0 }}
                                    onClick={() => toggleTeamCollapsed(team.id)}
                                  >
                                    <ChevronDown
                                      style={{ width: 16, height: 16, flexShrink: 0, marginRight: 10, color: 'rgba(255,255,255,0.5)', transform: teamCollapsed ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }}
                                    />
                                    <div className="pcp-t-av"><Users2 /></div>
                                    <div className="pcp-t-info">
                                      <div className="pcp-level-eyebrow">Team</div>
                                      <div className="pcp-t-name">{team.displayName}</div>
                                      <div className="pcp-t-meta">
                                        {[
                                          formatEnumLabel(team.teamType),
                                          team.sportOrProgram || 'no sport set',
                                          `${team.defaultEscalationRoute === 'clinician' ? 'clinician' : 'hotline'} escalation`,
                                          team.defaultAdminEmail || 'no default admin',
                                        ].join(' · ')}
                                      </div>
                                    </div>
                                    <div className="pcp-t-right">
                                      <span className="pcp-mc">{bundledPilots.length} pilot{bundledPilots.length === 1 ? '' : 's'}</span>
                                      <span className={`pcp-status ${getDashboardStatusClassName(teamStatus)}`}>{teamStatus.label}</span>
                                      <button
                                        type="button"
                                        className="pcp-ab pcp-ab-g"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleOpenProvisioningModal('pilot', { teamId: team.id });
                                        }}
                                      >
                                        <Plus />
                                        Add Pilot
                                      </button>
                                    </div>
                                  </div>

                                  {!teamCollapsed ? (
                                  <div className="pcp-team-body" style={{ display: 'block', marginTop: 12 }}>
                                    <div className="pcp-team-shell">
                                      <div className="pcp-team-grid">
                                        <CollapsibleCard
                                          title="Invite Artwork · This team"
                                          open={teamArtworkOpen}
                                          onToggle={() => toggleOrgCard(`${team.id}:artwork`)}
                                          preview={team.invitePreviewImageUrl ? 'Custom team image set. Open to change.' : 'Inheriting org default. Open to override for this team.'}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <img
                                              src={teamPreviewImage}
                                              alt={`${team.displayName} invite artwork`}
                                              style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}
                                            />
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                              <span
                                                style={{
                                                  display: 'inline-block',
                                                  fontSize: 10,
                                                  fontWeight: 700,
                                                  letterSpacing: '0.08em',
                                                  textTransform: 'uppercase',
                                                  padding: '3px 8px',
                                                  borderRadius: 999,
                                                  border: team.invitePreviewImageUrl ? '1px solid rgba(0,212,170,0.35)' : '1px solid rgba(255,255,255,0.15)',
                                                  background: team.invitePreviewImageUrl ? 'rgba(0,212,170,0.12)' : 'rgba(255,255,255,0.04)',
                                                  color: team.invitePreviewImageUrl ? '#00d4aa' : 'rgba(255,255,255,0.55)',
                                                }}
                                              >
                                                {team.invitePreviewImageUrl ? 'Custom team image' : 'Inheriting org default'}
                                              </span>
                                              <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.5)' }}>
                                                {team.invitePreviewImageUrl
                                                  ? 'Athletes on this team see this image instead of the organization default.'
                                                  : 'Athletes see the organization artwork above. Upload one to override it just for this team.'}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="pcp-preview-actions" style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <label className="pcp-ab pcp-ab-g pcp-file-trigger">
                                              <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(event) => {
                                                  void handleTeamInviteImageUpload(team.id, event.target.files?.[0] || null);
                                                  event.currentTarget.value = '';
                                                }}
                                              />
                                              {teamImageUploadingId === team.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                              ) : (
                                                <Sparkles className="h-3.5 w-3.5" />
                                              )}
                                              {teamImageUploadingId === team.id ? 'Uploading...' : team.invitePreviewImageUrl ? 'Replace team image' : 'Upload team image'}
                                            </label>
                                            {team.invitePreviewImageUrl ? (
                                              <button
                                                type="button"
                                                className="pcp-ab pcp-ab-t"
                                                disabled={teamImageUploadingId === team.id}
                                                onClick={() => void handleRevertTeamInviteImage(team.id)}
                                              >
                                                Use org default
                                              </button>
                                            ) : null}
                                          </div>
                                        </CollapsibleCard>

                                        <CollapsibleCard
                                          title="Team Commercial Config"
                                          open={teamCommercialOpen}
                                          onToggle={() => toggleOrgCard(`${team.id}:commercial`)}
                                          preview={`${teamPlanBypass ? 'Team plan (paywall bypassed)' : 'Athlete-paid access'} — open to configure.`}
                                        >
                                          <div className="pcp-commercial-footer" style={{ alignItems: 'flex-start' }}>
                                            <div>
                                              <div className="pcp-card-copy">
                                                Control whether this team uses athlete-paid access or a bypassed team plan, and where referral revenue routes.
                                              </div>
                                            </div>
                                            <div className="pcp-commercial-badge">
                                              {teamPlanBypass
                                                ? 'Team Plan Active'
                                                : teamCommercialDraft.commercialModel === 'athlete-pay'
                                                  ? 'Athlete Paid Access'
                                                  : 'Team Plan Inactive'}
                                            </div>
                                          </div>
                                          <div className="pcp-commercial-shell">
                                            <div className="pcp-commercial-grid">
                                              <label className="pcp-fld">
                                                <span className="pcp-flbl">Commercial Model</span>
                                                <select
                                                  className="pcp-finp pcp-select"
                                                  value={teamCommercialDraft.commercialModel}
                                                  onChange={(event) =>
                                                    handleExistingTeamCommercialFieldChange(
                                                      team.id,
                                                      'commercialModel',
                                                      event.target.value as PulseCheckTeamCommercialModel
                                                    )
                                                  }
                                                >
                                                  {TEAM_COMMERCIAL_MODEL_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                  ))}
                                                </select>
                                              </label>
                                              <label className="pcp-fld">
                                                <span className="pcp-flbl">Team Plan Status</span>
                                                <select
                                                  className="pcp-finp pcp-select"
                                                  value={teamCommercialDraft.teamPlanStatus}
                                                  onChange={(event) =>
                                                    handleExistingTeamCommercialFieldChange(
                                                      team.id,
                                                      'teamPlanStatus',
                                                      event.target.value as PulseCheckTeamPlanStatus
                                                    )
                                                  }
                                                >
                                                  {TEAM_PLAN_STATUS_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                  ))}
                                                </select>
                                              </label>
                                              <label className="pcp-fld">
                                                <span className="pcp-flbl">Revenue Recipient</span>
                                                <select
                                                  className="pcp-finp pcp-select"
                                                  value={teamCommercialDraft.revenueRecipientUserId || ''}
                                                  onChange={(event) => {
                                                    const userId = event.target.value;
                                                    handleExistingTeamCommercialFieldChange(
                                                      team.id,
                                                      'revenueRecipientUserId',
                                                      userId
                                                    );
                                                    const picked = (orgStaffById[team.organizationId] || []).find(
                                                      (staff) => staff.userId === userId
                                                    );
                                                    handleExistingTeamCommercialFieldChange(
                                                      team.id,
                                                      'revenueRecipientRole',
                                                      mapMembershipRoleToRecipientRole(picked?.role)
                                                    );
                                                  }}
                                                >
                                                  <option value="">
                                                    {orgStaffById[team.organizationId]
                                                      ? orgStaffById[team.organizationId].length
                                                        ? 'Select a staff member…'
                                                        : 'No staff onboarded yet'
                                                      : 'Loading staff…'}
                                                  </option>
                                                  {(orgStaffById[team.organizationId] || []).map((staff) => (
                                                    <option key={staff.userId} value={staff.userId}>
                                                      {staff.name}
                                                      {staff.title ? ` · ${staff.title}` : ''}
                                                    </option>
                                                  ))}
                                                </select>
                                              </label>
                                              <label className="pcp-fld">
                                                <span className="pcp-flbl">Referral Revenue Share %</span>
                                                <input
                                                  className="pcp-finp"
                                                  type="number"
                                                  min={0}
                                                  max={100}
                                                  value={teamCommercialDraft.referralRevenueSharePct}
                                                  onChange={(event) =>
                                                    handleExistingTeamCommercialFieldChange(
                                                      team.id,
                                                      'referralRevenueSharePct',
                                                      event.target.value
                                                    )
                                                  }
                                                />
                                              </label>
                                            </div>

                                            <label className="pcp-checkbox-row">
                                              <input
                                                type="checkbox"
                                                checked={teamCommercialDraft.referralKickbackEnabled}
                                                onChange={(event) =>
                                                  handleExistingTeamCommercialFieldChange(
                                                    team.id,
                                                    'referralKickbackEnabled',
                                                    event.target.checked
                                                  )
                                                }
                                              />
                                              <div>
                                                <div className="pcp-preview-title" style={{ fontSize: '12px', marginBottom: 4 }}>
                                                  Enable referral kickback for athlete-paid conversions
                                                </div>
                                                <div className="pcp-checkbox-copy">
                                                  Invited athletes keep team attribution when they subscribe later, and the configured revenue share can route back to this team.
                                                </div>
                                              </div>
                                            </label>

                                            <div className="pcp-commercial-footer">
                                              <div className="pcp-card-copy">
                                                {teamPlanBypass
                                                  ? 'This team currently bypasses checkout for invited athletes.'
                                                  : `Escalation route: ${getTeamEscalationRouteLabel(team.defaultEscalationRoute)}.`}
                                              </div>
                                              <button
                                                type="button"
                                                className="pcp-btn pcp-btn-teal"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  void handleSaveTeamCommercialConfig(team);
                                                }}
                                                disabled={teamCommercialSavingId === team.id}
                                              >
                                                {teamCommercialSavingId === team.id ? (
                                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                  <Sparkles className="h-3.5 w-3.5" />
                                                )}
                                                Save Commercial Config
                                              </button>
                                            </div>
                                          </div>
                                        </CollapsibleCard>

                                        <CollapsibleCard
                                          title="Support Route + Activation"
                                          open={teamSupportOpen}
                                          onToggle={() => toggleOrgCard(`${team.id}:support`)}
                                          preview="Escalation routing + admin / clinician activation links. Open to manage."
                                        >
                                          <div className="pcp-card-stack">
                                            {team.defaultEscalationRoute === 'clinician' ? (
                                              <div className="pcp-link-card">
                                                <div className="pcp-link-card-main">
                                                  <div className="pcp-preview-title" style={{ fontSize: '12px', marginBottom: 0 }}>
                                                    Clinician escalation
                                                  </div>
                                                  <div className="pcp-link-card-copy">
                                                    {clinicianProfile
                                                      ? `${clinicianProfile.displayName} · ${clinicianProfile.email || 'No email set'}`
                                                      : 'No clinician profile attached yet.'}
                                                  </div>
                                                </div>
                                                <button
                                                  type="button"
                                                  className="pcp-ab pcp-ab-g"
                                                  disabled={!clinicianProfile}
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    if (!clinicianProfile) return;
                                                    handleOpenOnboardingModal({
                                                      channel: 'clinician',
                                                      organization,
                                                      team,
                                                      clinicianProfile,
                                                    });
                                                  }}
                                                >
                                                  <MailPlus />
                                                  {clinicianOnboardingLink ? 'Send Link' : 'Create Link'}
                                                </button>
                                              </div>
                                            ) : (
                                              <div className="pcp-link-card">
                                                <div className="pcp-link-card-main">
                                                  <div className="pcp-preview-title" style={{ fontSize: '12px', marginBottom: 0 }}>
                                                    Hotline escalation
                                                  </div>
                                                  <div className="pcp-link-card-copy">
                                                    {HOTLINE_RESOURCE.name}. Escalated athletes are held on the watch list until an admin clears them.
                                                  </div>
                                                </div>
                                                <a
                                                  href={HOTLINE_RESOURCE.url}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="pcp-ab pcp-ab-g"
                                                  onClick={(event) => event.stopPropagation()}
                                                >
                                                  <ExternalLink />
                                                  Open 988
                                                </a>
                                              </div>
                                            )}

                                            <div className="pcp-link-card">
                                              <div className="pcp-link-card-main">
                                                <div className="pcp-preview-title" style={{ fontSize: '12px', marginBottom: 0 }}>
                                                  PulseCheck admin activation
                                                </div>
                                                <div className="pcp-link-card-copy">
                                                  {activationEmailSent
                                                    ? `${activeAdminLink?.targetEmail || team.defaultAdminEmail || 'No email set'} · activation email sent — manage status below.`
                                                    : 'No activation email sent yet. You choose when the admin is invited in.'}
                                                </div>
                                              </div>
                                              <button
                                                type="button"
                                                className="pcp-ab pcp-ab-t"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleOpenOnboardingModal({
                                                    channel: 'admin',
                                                    organization,
                                                    team,
                                                    clinicianProfile,
                                                  });
                                                }}
                                              >
                                                <MailPlus />
                                                {activationEmailSent ? 'Manage Activations' : 'Send Activation Email'}
                                              </button>
                                            </div>
                                          </div>
                                        </CollapsibleCard>
                                      </div>
                                      {(() => {
                                        const consentDraft = getTeamConsentDraft(team);
                                        const consentDirty = isTeamConsentDirty(team);
                                        const consentSaving = teamConsentSavingId === team.id;
                                        const consentInputStyle: React.CSSProperties = {
                                          background: 'rgba(0,0,0,0.35)',
                                          border: '1px solid rgba(255,255,255,0.12)',
                                          borderRadius: 8,
                                          color: '#fff',
                                          padding: '8px 10px',
                                          fontSize: 13,
                                        };
                                        const consentModalOpen = consentModalTeamId === team.id;
                                        return (
                                          <>
                                          <CollapsibleCard
                                            title="Consent Forms"
                                            open={teamConsentCardOpen}
                                            onToggle={() => toggleOrgCard(`${team.id}:consent`)}
                                            preview={`${consentDraft.length} consent${consentDraft.length === 1 ? '' : 's'} athletes accept at intake. Open to edit.`}
                                            className="pcp-card pcp-tracker-card"
                                          >
                                            <div className="pcp-tracker-copy" style={{ marginTop: 0 }}>
                                              Every athlete on this team accepts these during intake. Signing here means the app will not ask again. Bumping a version re-prompts anyone who signed the older one. Research-study consents are added automatically when a pilot runs in research mode.
                                            </div>
                                            <div style={{ marginTop: 12, fontSize: 13, color: '#fff' }}>
                                              {consentDraft.length} consent{consentDraft.length === 1 ? '' : 's'}
                                              {consentDirty ? <span style={{ color: 'rgba(255,255,255,0.55)' }}> · unsaved changes</span> : null}
                                            </div>
                                            <div style={{ marginTop: 12 }}>
                                              <button type="button" className="pcp-ab pcp-ab-g" onClick={() => { setConsentModalIndex(0); setConsentModalTeamId(team.id); }}>Manage consents</button>
                                            </div>
                                          </CollapsibleCard>

                                          {consentModalOpen && typeof document !== 'undefined' ? (() => {
                                            const draft = getTeamConsentDraft(team);
                                            const activeIndex = draft.length > 0 ? Math.min(Math.max(consentModalIndex, 0), draft.length - 1) : 0;
                                            const activeConsent = draft[activeIndex];
                                            return createPortal(
                                            <div
                                              style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
                                              onClick={() => setConsentModalTeamId(null)}
                                            >
                                              <div
                                                onClick={(event) => event.stopPropagation()}
                                                style={{ maxWidth: 1080, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#0d0d12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden' }}
                                              >
                                                {/* HEADER */}
                                                <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                                                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>Manage consents — {team.displayName ?? team.id}</div>
                                                    <button type="button" className="pcp-ab pcp-ab-t" aria-label="Close" onClick={() => setConsentModalTeamId(null)}><X /></button>
                                                  </div>
                                                  <div style={{ marginTop: 6, fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                                                    Athletes accept these at intake; bumping a version re-prompts anyone who signed the old one.
                                                  </div>
                                                </div>

                                                {/* TABS — one per consent form */}
                                                {draft.length > 0 ? (
                                                  <div style={{ display: 'flex', overflowX: 'auto', whiteSpace: 'nowrap', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                    {draft.map((consent, i) => {
                                                      const active = i === activeIndex;
                                                      const tabLabel = consent.title?.trim() ? consent.title : `Consent ${i + 1}`;
                                                      return (
                                                        <button
                                                          key={consent.id}
                                                          type="button"
                                                          onClick={() => setConsentModalIndex(i)}
                                                          style={{
                                                            flexShrink: 0,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: 8,
                                                            padding: '13px 14px',
                                                            background: active ? 'rgba(167,139,250,0.14)' : 'transparent',
                                                            border: 'none',
                                                            borderBottom: active ? '2px solid #A78BFA' : '2px solid transparent',
                                                            color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                                                            fontSize: 13,
                                                            fontWeight: active ? 700 : 500,
                                                            cursor: 'pointer',
                                                            transition: 'background 0.15s, color 0.15s',
                                                          }}
                                                        >
                                                          <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tabLabel}</span>
                                                        </button>
                                                      );
                                                    })}
                                                  </div>
                                                ) : null}

                                                {/* BODY (scrolling) — only the active consent's editor */}
                                                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                                                  {draft.length === 0 || !activeConsent ? (
                                                    <div className="pcp-c-empty">No consents yet — add one or seed a preset.</div>
                                                  ) : (
                                                    <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,0.02)' }}>
                                                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                                        <input
                                                          value={activeConsent.title}
                                                          placeholder="Consent title"
                                                          onChange={(event) => handleTeamConsentFieldChange(team, activeIndex, 'title', event.target.value)}
                                                          style={{ flex: 1, ...consentInputStyle }}
                                                        />
                                                        <input
                                                          value={activeConsent.version}
                                                          placeholder="v1"
                                                          onChange={(event) => handleTeamConsentFieldChange(team, activeIndex, 'version', event.target.value)}
                                                          style={{ width: 56, textAlign: 'center', ...consentInputStyle }}
                                                        />
                                                        <button type="button" className="pcp-ab pcp-ab-t" onClick={() => handleBumpTeamConsentVersion(team, activeIndex)}>Bump</button>
                                                        <button type="button" className="pcp-ab pcp-ab-t" aria-label="Remove consent" onClick={() => handleRemoveTeamConsent(team, activeIndex)}><X /></button>
                                                      </div>
                                                      <textarea
                                                        value={activeConsent.body}
                                                        placeholder="Full consent text shown to the athlete…"
                                                        rows={8}
                                                        onChange={(event) => handleTeamConsentFieldChange(team, activeIndex, 'body', event.target.value)}
                                                        style={{ width: '100%', resize: 'vertical', ...consentInputStyle }}
                                                      />
                                                      <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>id: {activeConsent.id}</div>
                                                    </div>
                                                  )}

                                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 12 }}>
                                                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Seed preset:</span>
                                                    {(['operational', 'pilot', 'research'] as PulseCheckPilotStudyMode[]).map((mode) => (
                                                      <button key={mode} type="button" className="pcp-ab pcp-ab-t" onClick={() => handleSeedTeamConsents(team, mode)}>{mode}</button>
                                                    ))}
                                                  </div>
                                                </div>

                                                {/* FOOTER */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 18, borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                                                  <button type="button" className="pcp-ab pcp-ab-g" onClick={() => { const next = draft.length; handleAddTeamConsent(team); setConsentModalIndex(next); }}><Plus /> Add consent</button>
                                                  <div style={{ flex: 1 }} />
                                                  {consentDirty ? (
                                                    <button type="button" className="pcp-ab pcp-ab-t" disabled={consentSaving} onClick={() => handleResetTeamConsentDraft(team.id)}>Discard</button>
                                                  ) : null}
                                                  <button type="button" className="pcp-ab pcp-ab-g" disabled={!consentDirty || consentSaving} onClick={() => void handleSaveTeamConsents(team)}>
                                                    {consentSaving ? 'Saving…' : 'Save consents'}
                                                  </button>
                                                </div>
                                              </div>
                                            </div>,
                                            document.body,
                                            );
                                          })() : null}
                                          </>
                                        );
                                      })()}

                                      {(() => {
                                        const intakeKinds: Array<{ kind: PulseCheckIntakeKind; label: string }> = [
                                          { kind: 'athlete', label: 'Athlete intake' },
                                          { kind: 'coach', label: 'Coach intake' },
                                        ];
                                        const fieldStyle: React.CSSProperties = {
                                          background: 'rgba(0,0,0,0.35)',
                                          border: '1px solid rgba(255,255,255,0.12)',
                                          borderRadius: 8,
                                          color: '#fff',
                                          padding: '8px 10px',
                                          fontSize: 13,
                                        };
                                        const intakeModalOpen = intakeModalTeamId === team.id;
                                        return (
                                          <>
                                          <CollapsibleCard
                                            id={`pcp-intake-${team.id}`}
                                            title="Intake Surveys"
                                            open={teamIntakeCardOpen}
                                            onToggle={() => toggleOrgCard(`${team.id}:intakecard`)}
                                            preview="Athlete & coach intake questions. Open to manage."
                                            className="pcp-card pcp-tracker-card"
                                          >
                                            <div className="pcp-tracker-copy" style={{ marginTop: 0 }}>
                                              Questions each athlete and coach answers during onboarding. Athletes answer theirs alongside the consent block, so they sign once and the app will not ask again.
                                            </div>
                                            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                              {intakeKinds.map(({ kind, label }) => {
                                                const draft = getIntakeDraft(team, kind);
                                                const dirty = isIntakeDirty(team, kind);
                                                return (
                                                  <div key={kind} style={{ fontSize: 13, color: '#fff' }}>
                                                    {label}
                                                    <span style={{ color: 'rgba(255,255,255,0.4)' }}> · {draft.length} question{draft.length === 1 ? '' : 's'}</span>
                                                    {dirty ? <span style={{ color: 'rgba(255,255,255,0.55)' }}> · unsaved changes</span> : null}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                            <div style={{ marginTop: 12 }}>
                                              <button type="button" className="pcp-ab pcp-ab-g" onClick={() => { setIntakeModalKind('athlete'); setIntakeModalTeamId(team.id); }}>Manage intake</button>
                                            </div>
                                          </CollapsibleCard>

                                          {intakeModalOpen && typeof document !== 'undefined' ? (() => {
                                            const kind = intakeModalKind;
                                            const draft = getIntakeDraft(team, kind);
                                            const dirty = isIntakeDirty(team, kind);
                                            const saving = teamIntakeSavingKey === `${team.id}:${kind}`;
                                            return createPortal(
                                            <div
                                              style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
                                              onClick={() => setIntakeModalTeamId(null)}
                                            >
                                              <div
                                                onClick={(event) => event.stopPropagation()}
                                                style={{ maxWidth: 1080, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#0d0d12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden' }}
                                              >
                                                {/* HEADER */}
                                                <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                                                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>Manage intake — {team.displayName ?? team.id}</div>
                                                    <button type="button" className="pcp-ab pcp-ab-t" aria-label="Close" onClick={() => setIntakeModalTeamId(null)}><X /></button>
                                                  </div>
                                                  <div style={{ marginTop: 6, fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                                                    Athletes answer during onboarding, alongside consent — asked once.
                                                  </div>
                                                </div>

                                                {/* TABS */}
                                                <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                                  {intakeKinds.map(({ kind: tabKind, label }) => {
                                                    const active = intakeModalKind === tabKind;
                                                    const tabCount = getIntakeDraft(team, tabKind).length;
                                                    const tabDirty = isIntakeDirty(team, tabKind);
                                                    return (
                                                      <button
                                                        key={tabKind}
                                                        type="button"
                                                        onClick={() => setIntakeModalKind(tabKind)}
                                                        style={{
                                                          flex: 1,
                                                          display: 'flex',
                                                          alignItems: 'center',
                                                          justifyContent: 'center',
                                                          gap: 8,
                                                          padding: '13px 12px',
                                                          background: active ? 'rgba(167,139,250,0.14)' : 'transparent',
                                                          border: 'none',
                                                          borderBottom: active ? '2px solid #A78BFA' : '2px solid transparent',
                                                          color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                                                          fontSize: 13,
                                                          fontWeight: active ? 700 : 500,
                                                          cursor: 'pointer',
                                                          transition: 'background 0.15s, color 0.15s',
                                                        }}
                                                      >
                                                        <span>{label}</span>
                                                        <span style={{
                                                          fontSize: 11,
                                                          fontWeight: 600,
                                                          padding: '1px 7px',
                                                          borderRadius: 999,
                                                          background: active ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)',
                                                          color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                                                        }}>{tabCount}</span>
                                                        {tabDirty ? (
                                                          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#A78BFA', display: 'inline-block' }} />
                                                        ) : null}
                                                      </button>
                                                    );
                                                  })}
                                                </div>

                                                {/* BODY (scrolling) */}
                                                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                                                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)' }}>{draft.length} question{draft.length === 1 ? '' : 's'}</div>
                                                    <button type="button" className="pcp-ab pcp-ab-t" onClick={() => handleLoadStarterIntake(team, kind)}>Load starter</button>
                                                  </div>

                                                  {draft.length === 0 ? (
                                                    <div className="pcp-c-empty">No questions yet — add one or load the starter set.</div>
                                                  ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                      {draft.map((question, index) => (
                                                        <div key={question.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14 }}>
                                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}>Q{index + 1}</span>
                                                            <button type="button" className="pcp-ab pcp-ab-t" aria-label="Remove question" onClick={() => handleRemoveIntakeQuestion(team, kind, index)}><X /></button>
                                                          </div>
                                                          <textarea
                                                            value={question.question}
                                                            placeholder="Question text"
                                                            rows={2}
                                                            onChange={(event) => updateIntakeQuestion(team, kind, index, (current) => ({ ...current, question: event.target.value }))}
                                                            style={{ width: '100%', resize: 'vertical', ...fieldStyle }}
                                                          />
                                                          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                                                              <span>Type</span>
                                                              <select
                                                                value={question.type}
                                                                onChange={(event) => handleIntakeQuestionTypeChange(team, kind, index, event.target.value as SurveyQuestion['type'])}
                                                                style={{ ...fieldStyle, padding: '6px 8px' }}
                                                              >
                                                                <option value="text">Text</option>
                                                                <option value="multiple_choice">Multiple choice</option>
                                                                <option value="number">Number</option>
                                                                <option value="yes_no">Yes / No</option>
                                                              </select>
                                                            </label>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                                                              <input type="checkbox" checked={!!question.required} onChange={(event) => updateIntakeQuestion(team, kind, index, (current) => ({ ...current, required: event.target.checked }))} />
                                                              Required
                                                            </label>
                                                            {question.type === 'number' ? (
                                                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                                <input type="number" value={question.minValue ?? ''} placeholder="min" onChange={(event) => updateIntakeQuestion(team, kind, index, (current) => ({ ...current, minValue: event.target.value === '' ? undefined : Number(event.target.value) }))} style={{ width: 72, ...fieldStyle, padding: '6px 8px' }} />
                                                                <input type="number" value={question.maxValue ?? ''} placeholder="max" onChange={(event) => updateIntakeQuestion(team, kind, index, (current) => ({ ...current, maxValue: event.target.value === '' ? undefined : Number(event.target.value) }))} style={{ width: 72, ...fieldStyle, padding: '6px 8px' }} />
                                                              </div>
                                                            ) : null}
                                                          </div>
                                                          {question.type === 'multiple_choice' ? (
                                                            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                              {(question.options || []).map((option, optionIndex) => (
                                                                <div key={option.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                                  <input value={option.text} placeholder={`Option ${optionIndex + 1}`} onChange={(event) => handleIntakeOptionChange(team, kind, index, optionIndex, event.target.value)} style={{ flex: 1, ...fieldStyle, padding: '6px 8px' }} />
                                                                  <button type="button" className="pcp-ab pcp-ab-t" aria-label="Remove option" onClick={() => handleRemoveIntakeOption(team, kind, index, optionIndex)}><X /></button>
                                                                </div>
                                                              ))}
                                                              <button type="button" className="pcp-ab pcp-ab-t" style={{ alignSelf: 'flex-start' }} onClick={() => handleAddIntakeOption(team, kind, index)}><Plus /> Add option</button>
                                                            </div>
                                                          ) : null}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>

                                                {/* FOOTER */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 18, borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                                                  <button type="button" className="pcp-ab pcp-ab-g" onClick={() => handleAddIntakeQuestion(team, kind)}><Plus /> Add question</button>
                                                  <div style={{ flex: 1 }} />
                                                  {dirty ? (
                                                    <button type="button" className="pcp-ab pcp-ab-t" disabled={saving} onClick={() => handleDiscardIntakeDraft(team, kind)}>Discard</button>
                                                  ) : null}
                                                  <button type="button" className="pcp-ab pcp-ab-g" disabled={!dirty || saving} onClick={() => void handleSaveIntake(team, kind)}>
                                                    {saving ? 'Saving…' : 'Save'}
                                                  </button>
                                                </div>
                                              </div>
                                            </div>,
                                            document.body,
                                            );
                                          })() : null}
                                          </>
                                        );
                                      })()}
                                    </div>

                                    {bundledPilots.length === 0 ? (
                                      <div style={{ padding: '0 16px 10px 80px' }}>
                                        <div className="pcp-c-empty">No pilots created yet for this team.</div>
                                      </div>
                                    ) : (
                                      bundledPilots.map(({ pilot, cohorts }) => {
                                        const pilotExpanded = expandedPilotIds.includes(pilot.id);
                                        const pilotStatus = getDerivedPilotStatusDisplay(pilot);
                                        const pilotStudyModeDraft = pilotStudyModeDrafts[pilot.id] || pilot.studyMode;
                                        const pilotStudyModeDirty = pilotStudyModeDraft !== pilot.studyMode;
                                        const pilotStudyModeSaving = pilotStudyModeSavingId === pilot.id;

                                        return (
                                          <div key={pilot.id} className="pcp-card pcp-pilot-card" style={{ paddingBottom: pilotExpanded ? 18 : 14, scrollMarginTop: 16 }}>
                                            <div
                                              className="pcp-team-hd"
                                              style={{ cursor: 'pointer', padding: 0, minHeight: 0 }}
                                              onClick={() => togglePilotRow(pilot.id)}
                                            >
                                              <ChevronDown
                                                style={{ width: 16, height: 16, flexShrink: 0, marginRight: 10, color: 'rgba(255,255,255,0.5)', transform: pilotExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                                              />
                                              <div className="pcp-t-av"><ClipboardList /></div>
                                              <div className="pcp-t-info">
                                                <div className="pcp-level-eyebrow">Pilot</div>
                                                <div className="pcp-t-name">{pilot.name}</div>
                                                <div className="pcp-t-meta">
                                                  {[
                                                    toDateValue(pilot.startAt)?.toLocaleDateString() || 'not scheduled',
                                                    toDateValue(pilot.endAt)?.toLocaleDateString() || 'open ended',
                                                    `${formatEnumLabel(pilot.studyMode).toLowerCase()} mode`,
                                                    pilot.checkpointCadence || 'no cadence',
                                                  ].join(' · ')}
                                                </div>
                                              </div>
                                              <div className="pcp-t-right">
                                                <span className="pcp-mc">{cohorts.length} cohort{cohorts.length === 1 ? '' : 's'}</span>
                                                <span className={`pcp-status ${getDashboardStatusClassName(pilotStatus)}`}>{pilotStatus.label}</span>
                                                <button
                                                  type="button"
                                                  className="pcp-ab pcp-ab-g"
                                                  onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleOpenProvisioningModal('cohort', { pilotId: pilot.id });
                                                  }}
                                                >
                                                  <Plus />
                                                  Add Cohort
                                                </button>
                                              </div>
                                            </div>

                                            {pilotExpanded ? (
                                            <div className="pcp-team-body" style={{ display: 'block', marginTop: 12 }}>
                                              <div className="pcp-pilot-grid">
                                              <div className="pcp-pilot-settings">
                                                <div className="pcp-pp-lbl">Pilot Settings</div>
                                                <div className="pcp-pilot-settings-copy">
                                                  Switch the pilot between operational, pilot, and research mode here. Changing the mode also refreshes the disclosure package used for this pilot.
                                                </div>
                                                <div className="pcp-pilot-settings-grid">
                                                  <div className="pcp-fld" style={{ marginBottom: 0 }}>
                                                    <label className="pcp-flbl" htmlFor={`pilot-study-mode-${pilot.id}`}>
                                                      Study Mode
                                                    </label>
                                                    <select
                                                      id={`pilot-study-mode-${pilot.id}`}
                                                      className="pcp-finp pcp-select"
                                                      value={pilotStudyModeDraft}
                                                      disabled={pilotStudyModeSaving}
                                                      onChange={(event) =>
                                                        handlePilotStudyModeDraftChange(
                                                          pilot.id,
                                                          event.target.value as PulseCheckPilotStudyMode
                                                        )
                                                      }
                                                    >
                                                      {PILOT_STUDY_MODE_OPTIONS.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                          {option.label}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  </div>
                                                  <div className="pcp-pilot-settings-actions">
                                                    <div className="pcp-pilot-settings-note">
                                                      {pilotStudyModeSaving
                                                        ? 'Saving study mode and syncing the matching disclosure package...'
                                                        : pilotStudyModeDirty
                                                          ? `Current mode: ${formatEnumLabel(pilot.studyMode)}. Save to apply the new disclosure package.`
                                                          : 'Study mode controls the disclosure package and how this pilot is framed across onboarding and reporting.'}
                                                    </div>
                                                    <button
                                                      type="button"
                                                      className="pcp-ab pcp-ab-t"
                                                      disabled={!pilotStudyModeDirty || pilotStudyModeSaving}
                                                      onClick={(event) => {
                                                        event.stopPropagation();
                                                        void handleSavePilotStudyMode(pilot);
                                                      }}
                                                    >
                                                      {pilotStudyModeSaving ? <Loader2 /> : <Sparkles />}
                                                      {pilotStudyModeSaving ? 'Saving' : 'Update Mode'}
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                              <div>
                                                <div className="pcp-pp-lbl">Cohorts</div>
                                                {(() => {
                                                  const reusablePilotInvite = reusablePilotInviteByPilotId.get(pilot.id) || null;
                                                  const creatingPilotInvite = pilotInviteCreatingId === pilot.id;
                                                  return (
                                                    <div className="pcp-cohort-item">
                                                      <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div className="pcp-level-eyebrow">Athlete · direct to pilot</div>
                                                        <div className="pcp-ci-name">No cohort needed</div>
                                                        <div className="pcp-ci-meta">
                                                          {reusablePilotInvite
                                                            ? 'Reusable link · enrolls athletes straight into the pilot'
                                                            : 'Create a reusable link that adds athletes to the pilot without a cohort'}
                                                        </div>
                                                      </div>
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                        <button
                                                          type="button"
                                                          className="pcp-ab pcp-ab-g"
                                                          onClick={(event) => {
                                                            event.stopPropagation();
                                                            if (reusablePilotInvite?.activationUrl) {
                                                              copyInviteToClipboard(
                                                                reusablePilotInvite.activationUrl,
                                                                `Reusable invite for ${pilot.name} copied to clipboard.`
                                                              );
                                                            } else {
                                                              void handleCreatePilotInviteLink(pilot);
                                                            }
                                                          }}
                                                          disabled={creatingPilotInvite}
                                                        >
                                                          {creatingPilotInvite ? <Loader2 /> : <Clipboard />}
                                                          {reusablePilotInvite ? 'Copy Invite' : 'Create Invite'}
                                                        </button>
                                                      </div>
                                                    </div>
                                                  );
                                                })()}
                                                {cohorts.length === 0 ? (
                                                  <div className="pcp-c-empty">No cohorts attached yet.</div>
                                                ) : (
                                                  cohorts.map((cohort) => {
                                                    const reusableCohortInvite = reusableCohortInviteByCohortId.get(cohort.id) || null;
                                                    const cohortStatus = getCohortStatusDisplay(cohort.status);

                                                    return (
                                                      <div key={cohort.id} className="pcp-cohort-item">
                                                        <div style={{ minWidth: 0, flex: 1 }}>
                                                          <div className="pcp-level-eyebrow">Cohort</div>
                                                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                                                            <div className="pcp-ci-name">{cohort.name}</div>
                                                            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${cohortStatus.tone}`}>
                                                              {cohortStatus.label}
                                                            </span>
                                                          </div>
                                                          <div className="pcp-ci-meta">
                                                            {[
                                                              getCohortTypeLabel(cohort.cohortType),
                                                              getCohortAssignmentRuleLabel(cohort.assignmentRule),
                                                              cohort.reportingTags?.length ? cohort.reportingTags.join(', ') : 'no tags',
                                                            ].join(' · ')}
                                                          </div>
                                                        </div>
                                                        <button
                                                          type="button"
                                                          className="pcp-ab pcp-ab-g"
                                                          onClick={(event) => {
                                                            event.stopPropagation();
                                                            if (reusableCohortInvite?.activationUrl) {
                                                              copyInviteToClipboard(
                                                                reusableCohortInvite.activationUrl,
                                                                `Reusable invite for ${cohort.name} copied to clipboard.`
                                                              );
                                                            } else {
                                                              void handleCreateCohortInviteLink(pilot, cohort);
                                                            }
                                                          }}
                                                          disabled={cohortInviteCreatingId === cohort.id}
                                                        >
                                                          {cohortInviteCreatingId === cohort.id ? <Loader2 /> : <Clipboard />}
                                                          {reusableCohortInvite ? 'Copy Invite' : 'Create Invite'}
                                                        </button>
                                                      </div>
                                                    );
                                                  })
                                                )}
                                              </div>

                                              <div>
                                                <div className="pcp-pp-lbl">Onboarding Links</div>
                                                {team.defaultEscalationRoute === 'clinician' ? (
                                                  <div className="pcp-ob-item">
                                                    <div>
                                                      <div className="pcp-ob-type">AuntEdna Clinician</div>
                                                      {clinicianProfile ? (
                                                        <div className="pcp-ob-val">
                                                          {clinicianOnboardingLink
                                                            ? clinicianProfile.email || clinicianProfile.displayName
                                                            : `${clinicianProfile.displayName} · ${formatEnumLabel(clinicianProfile.syncStatus).toLowerCase()}`}
                                                        </div>
                                                      ) : (
                                                        <div className="pcp-ob-empty">No clinician profile attached yet</div>
                                                      )}
                                                    </div>
                                                    <button
                                                      type="button"
                                                      className={`pcp-ab ${clinicianProfile ? 'pcp-ab-g' : 'pcp-ab-g'}`}
                                                      disabled={!clinicianProfile}
                                                      onClick={(event) => {
                                                        event.stopPropagation();
                                                        if (!clinicianProfile) return;
                                                        handleOpenOnboardingModal({
                                                          channel: 'clinician',
                                                          organization,
                                                          team,
                                                          clinicianProfile,
                                                        });
                                                      }}
                                                    >
                                                      <MailPlus />
                                                      {clinicianOnboardingLink ? 'Send Link' : 'Create Link'}
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <div className="pcp-ob-item">
                                                    <div>
                                                      <div className="pcp-ob-type">988 Hotline</div>
                                                      <div className="pcp-ob-val">{HOTLINE_RESOURCE.name}</div>
                                                    </div>
                                                    <a
                                                      href={HOTLINE_RESOURCE.url}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="pcp-ab pcp-ab-g"
                                                      onClick={(event) => event.stopPropagation()}
                                                    >
                                                      <ExternalLink />
                                                      Open 988
                                                    </a>
                                                  </div>
                                                )}

                                                {/* The admin activation card lives at the team level (Support
                                                    Route + Activation) — the admin is the team's admin, not the
                                                    pilot's — so it's intentionally not rendered inside the pilot. */}
                                              </div>
                                              </div>
                                            </div>
                                            ) : null}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </main>
          </div>

          <div className={`pcp-modal-bg ${isProvisioningModalOpen ? 'open' : ''}`} onClick={handleCloseProvisioningModal}>
            <div className="pcp-modal" onClick={(event) => event.stopPropagation()}>
              <div className="pcp-modal-tb">
                <div className="pcp-modal-title">Provision New Organization</div>
                <button type="button" className="pcp-modal-x" onClick={handleCloseProvisioningModal}>
                  <X />
                </button>
              </div>

              <div className="pcp-modal-steps">
                {PROVISIONING_WIZARD_STEPS.map((step, stepIndex) => {
                  const isDone = stepIndex < currentWizardStepIndex;
                  const isActive = step.key === activeWizardStep;

                  return (
                    <button
                      key={step.key}
                      type="button"
                      className={`pcp-ms ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveWizardStep(step.key)}
                    >
                      <div className="pcp-ms-num">{isDone ? '✓' : stepIndex + 1}</div>
                      {step.label}
                    </button>
                  );
                })}
              </div>

              <div className="pcp-modal-body">
                <form ref={organizationFormRef} onSubmit={handleCreateOrganization}>
                  <div className={`pcp-m-tab ${activeWizardStep === 'org' ? 'active' : ''}`}>
                    <div className="pcp-sec-hd">
                      <div className="pcp-sec-ic"><Building2 /></div>
                      <span className="pcp-sec-tl">Create Organization</span>
                    </div>
                    <div className="pcp-info-box">
                      Top-level customer container. Organizations hold legal identity, primary admin handoff, and every team connected to that partner.
                    </div>
                    <div className="pcp-fg">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Display Name</span>
                        <input
                          className="pcp-finp"
                          value={orgForm.displayName}
                          onChange={(event) => handleOrgFieldChange('displayName', event.target.value)}
                          placeholder="Hampton Athletics"
                        />
                      </label>
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Legal Name</span>
                        <input
                          className="pcp-finp"
                          value={orgForm.legalName}
                          onChange={(event) => handleOrgFieldChange('legalName', event.target.value)}
                          placeholder="Hampton University Athletics Department"
                        />
                      </label>
                    </div>
                    <div className="pcp-fg">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Organization Type</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={orgForm.organizationType}
                          onChange={(event) => handleOrgFieldChange('organizationType', event.target.value)}
                        >
                          {ORGANIZATION_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Default Study Posture</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={orgForm.defaultStudyPosture}
                          onChange={(event) => handleOrgFieldChange('defaultStudyPosture', event.target.value as PulseCheckStudyPosture)}
                        >
                          <option value="operational">Operational</option>
                          <option value="pilot">Pilot</option>
                          <option value="research-eligible">Research Eligible</option>
                        </select>
                      </label>
                    </div>
                    <div className="pcp-fg">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Customer Admin Name</span>
                        <input
                          className="pcp-finp"
                          value={orgForm.primaryCustomerAdminName}
                          onChange={(event) => handleOrgFieldChange('primaryCustomerAdminName', event.target.value)}
                          placeholder="Athletic Director"
                        />
                      </label>
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Customer Admin Email</span>
                        <input
                          className="pcp-finp"
                          type="email"
                          value={orgForm.primaryCustomerAdminEmail}
                          onChange={(event) => handleOrgFieldChange('primaryCustomerAdminEmail', event.target.value)}
                          placeholder="admin@school.edu"
                        />
                      </label>
                    </div>
                    <div className="pcp-fg pcp-c1">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Clinician Routing Requirement</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={orgForm.defaultClinicianBridgeMode}
                          onChange={(event) => handleOrgFieldChange('defaultClinicianBridgeMode', event.target.value as PulseCheckClinicianBridgeMode)}
                        >
                          <option value="optional">Optional</option>
                          <option value="required">Required</option>
                          <option value="none">None</option>
                        </select>
                      </label>
                    </div>
                    <div className="pcp-fg pcp-c1">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Notes</span>
                        <textarea
                          className="pcp-finp pcp-textarea"
                          value={orgForm.notes}
                          onChange={(event) => handleOrgFieldChange('notes', event.target.value)}
                          placeholder="Implementation notes, routing assumptions, or contract context."
                        />
                      </label>
                    </div>
                  </div>
                </form>

                <form ref={teamRouteFormRef} onSubmit={handleCreateTeam}>
                  <div className={`pcp-m-tab ${activeWizardStep === 'team' ? 'active' : ''}`}>
                    <div className="pcp-sec-hd">
                      <div className="pcp-sec-ic"><Users2 /></div>
                      <span className="pcp-sec-tl">Create Team</span>
                    </div>
                    <div className="pcp-fg pcp-c1">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Organization</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={teamForm.organizationId}
                          onChange={(event) => handleTeamFieldChange('organizationId', event.target.value)}
                        >
                          <option value="">Select an organization</option>
                          {organizations.map((organization) => (
                            <option key={organization.id} value={organization.id}>{organization.displayName}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="pcp-fg">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Team Name</span>
                        <input
                          className="pcp-finp"
                          value={teamForm.displayName}
                          onChange={(event) => handleTeamFieldChange('displayName', event.target.value)}
                          placeholder="Men's Basketball"
                        />
                      </label>
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Team Type</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={teamForm.teamType}
                          onChange={(event) => handleTeamFieldChange('teamType', event.target.value)}
                        >
                          {TEAM_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="pcp-fg pcp-c1">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Sport</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={teamForm.sportOrProgram}
                          onChange={(event) => handleTeamFieldChange('sportOrProgram', event.target.value)}
                        >
                          <option value="">Select a sport</option>
                          {teamSportOptions.map((sport) => (
                            <option key={sport.id} value={sport.name}>{sport.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="pcp-fg pcp-c1">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Org-Linked Admin</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={teamForm.defaultAdminEmail}
                          onChange={(event) => handleTeamAdminSelection(event.target.value)}
                          disabled={!selectedOrganization || teamAdminOptions.length === 0}
                        >
                          <option value="">
                            {!selectedOrganization
                              ? 'Select an organization first'
                              : teamAdminOptions.length === 0
                                ? 'No organization admin contact configured'
                                : 'Select organization admin'}
                          </option>
                          {teamAdminOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <span className="pcp-fhint">Team admins must come from the selected organization&apos;s admin contact data.</span>
                      </label>
                    </div>
                    <div className="pcp-fg">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Invite Policy</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={teamForm.defaultInvitePolicy}
                          onChange={(event) => handleTeamFieldChange('defaultInvitePolicy', event.target.value as PulseCheckInvitePolicy)}
                        >
                          <option value="admin-and-staff">Admin and Staff</option>
                          <option value="admin-only">Admin Only</option>
                          <option value="admin-staff-and-coaches">Admin, Staff, and Coaches</option>
                        </select>
                      </label>
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Commercial Model</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={teamForm.commercialConfig.commercialModel}
                          onChange={(event) => handleTeamCommercialFieldChange('commercialModel', event.target.value as PulseCheckTeamCommercialModel)}
                        >
                          {TEAM_COMMERCIAL_MODEL_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className={`pcp-m-tab ${activeWizardStep === 'route' ? 'active' : ''}`}>
                    <div className="pcp-sec-hd">
                      <div className="pcp-sec-ic"><HeartPulse /></div>
                      <span className="pcp-sec-tl">Configure Support Route</span>
                    </div>
                    <div className="pcp-warn-box">
                      Choose whether escalations route to the 988 hotline or to a clinician profile. This determines what athletes see when Nora triggers an escalation.
                    </div>

                    <div className="pcp-fg pcp-c1">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Escalation Route</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={teamForm.defaultEscalationRoute}
                          onChange={(event) => handleTeamFieldChange('defaultEscalationRoute', event.target.value as PulseCheckTeamEscalationRoute)}
                        >
                          {TEAM_ESCALATION_ROUTE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label} — {option.description}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {draftTeamUsesClinicianRoute ? (
                      <>
                        <div className="pcp-route-mode-grid">
                          <button
                            type="button"
                            className={`pcp-route-mode ${clinicianLinkMode === 'existing' ? 'active' : ''}`}
                            onClick={() => setClinicianLinkMode('existing')}
                          >
                            <div className="pcp-route-mode-title">Link Existing Profile</div>
                            <div className="pcp-route-mode-copy">Search saved clinician profiles and attach one to this team.</div>
                          </button>
                          <button
                            type="button"
                            className={`pcp-route-mode ${clinicianLinkMode === 'create' ? 'active' : ''}`}
                            onClick={() => setClinicianLinkMode('create')}
                          >
                            <div className="pcp-route-mode-title">Create New Profile</div>
                            <div className="pcp-route-mode-copy">Create a local clinician profile record now and sync it later.</div>
                          </button>
                        </div>

                        {clinicianLinkMode === 'existing' ? (
                          <>
                            <div className="pcp-fg pcp-c1">
                              <label className="pcp-fld">
                                <span className="pcp-flbl">Search Saved Profiles</span>
                                <input
                                  className="pcp-finp"
                                  value={clinicianSearchTerm}
                                  onChange={(event) => setClinicianSearchTerm(event.target.value)}
                                  placeholder="Hampton, Carter, provider network..."
                                />
                              </label>
                            </div>

                            {filteredClinicianProfiles.length === 0 ? (
                              <div className="pcp-empty-panel">No saved clinician profiles yet. Create one locally to keep moving.</div>
                            ) : (
                              filteredClinicianProfiles.map((profile) => {
                                const isSelected = profile.id === teamForm.defaultClinicianProfileId;

                                return (
                                  <div key={profile.id} className="pcp-clinician-card">
                                    <div>
                                      <div className="pcp-ci-name">{profile.displayName}</div>
                                      <div className="pcp-ci-meta">
                                        {[
                                          `Type: ${formatEnumLabel(profile.profileType)}`,
                                          `Org: ${profile.organizationName || 'Not set'}`,
                                          `Email: ${profile.email || 'Not set'}`,
                                          `Sync: ${formatEnumLabel(profile.syncStatus)}`,
                                        ].join(' · ')}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      className={`pcp-ab ${isSelected ? 'pcp-ab-t' : 'pcp-ab-g'}`}
                                      onClick={() => handleSelectClinicianProfile(profile)}
                                    >
                                      {isSelected ? 'Connected' : 'Connect'}
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </>
                        ) : (
                          <div className="pcp-fg">
                            <label className="pcp-fld">
                              <span className="pcp-flbl">Profile Display Name</span>
                              <input
                                className="pcp-finp"
                                value={newClinicianProfileForm.displayName}
                                onChange={(event) =>
                                  setNewClinicianProfileForm((current) => ({ ...current, displayName: event.target.value }))
                                }
                                placeholder="Hampton Sports Medicine Main"
                              />
                            </label>
                            <label className="pcp-fld">
                              <span className="pcp-flbl">Profile Type</span>
                              <select
                                className="pcp-finp pcp-select"
                                value={newClinicianProfileForm.profileType}
                                onChange={(event) =>
                                  setNewClinicianProfileForm((current) => ({
                                    ...current,
                                    profileType: event.target.value as PulseCheckClinicianProfileType,
                                  }))
                                }
                              >
                                {CLINICIAN_PROFILE_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                            <label className="pcp-fld">
                              <span className="pcp-flbl">Organization / Provider</span>
                              <input
                                className="pcp-finp"
                                value={newClinicianProfileForm.organizationName}
                                onChange={(event) =>
                                  setNewClinicianProfileForm((current) => ({ ...current, organizationName: event.target.value }))
                                }
                                placeholder={selectedOrganization?.displayName || 'Clinical Partner'}
                              />
                            </label>
                            <label className="pcp-fld">
                              <span className="pcp-flbl">Contact Email</span>
                              <input
                                className="pcp-finp"
                                type="email"
                                value={newClinicianProfileForm.email}
                                onChange={(event) =>
                                  setNewClinicianProfileForm((current) => ({ ...current, email: event.target.value }))
                                }
                                placeholder="sportsmed@hampton.edu"
                              />
                            </label>
                            <div className="pcp-fld pcp-s2">
                              <button
                                type="button"
                                className="pcp-btn pcp-btn-teal"
                                onClick={(event) => {
                                  event.preventDefault();
                                  void handleCreateClinicianProfile(event as unknown as React.FormEvent);
                                }}
                                disabled={clinicianSubmitting}
                              >
                                {clinicianSubmitting ? <Loader2 /> : <ShieldPlus />}
                                {clinicianSubmitting ? 'Creating Profile...' : 'Create Local Profile'}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="pcp-info-box">
                          {HOTLINE_RESOURCE.name}. Athletes are directed to {HOTLINE_RESOURCE.phone} or {HOTLINE_RESOURCE.url} during escalations.
                        </div>
                        <div className="pcp-toggle-row">
                          <div className="pcp-tt on">
                            <div className="pcp-tk" />
                          </div>
                          <div>
                            <div className="pcp-t-lbl">Automatic watch-list hold</div>
                            <div className="pcp-t-desc">
                              Hotline-routed escalations place the athlete on the watch list until an admin clears them manually.
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="pcp-fg pcp-c1">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Notes</span>
                        <textarea
                          className="pcp-finp pcp-textarea"
                          value={teamForm.notes}
                          onChange={(event) => handleTeamFieldChange('notes', event.target.value)}
                          placeholder="Roster scope, staffing notes, or activation assumptions."
                        />
                      </label>
                    </div>
                  </div>
                </form>

                <form ref={activationFormRef} onSubmit={handleWizardActivationSubmit}>
                  <div className={`pcp-m-tab ${activeWizardStep === 'activation' ? 'active' : ''}`}>
                    <div className="pcp-sec-hd">
                      <div className="pcp-sec-ic"><MailPlus /></div>
                      <span className="pcp-sec-tl">Generate Admin Activation</span>
                    </div>
                    <div className="pcp-info-box">
                      Generate a unique onboarding link. Regenerating a link revokes the prior active link for the same recipient.
                    </div>
                    {wizardTeams.length === 0 ? (
                      <div className="pcp-empty-panel">Create at least one team before generating onboarding links.</div>
                    ) : (
                      <>
                        <div className="pcp-fg">
                          <label className="pcp-fld">
                            <span className="pcp-flbl">Team</span>
                            <select
                              className="pcp-finp pcp-select"
                              value={activationDraft.teamId}
                              onChange={(event) => setActivationDraft((current) => ({ ...current, teamId: event.target.value }))}
                            >
                              {wizardTeams.map((team) => {
                                const organization = organizations.find((organization) => organization.id === team.organizationId);
                                return (
                                  <option key={team.id} value={team.id}>
                                    {organization ? `${organization.displayName} → ${team.displayName}` : team.displayName}
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                          <label className="pcp-fld">
                            <span className="pcp-flbl">Onboarding Type</span>
                            <select
                              className="pcp-finp pcp-select"
                              value={activationDraft.channel}
                              onChange={(event) =>
                                setActivationDraft((current) => ({
                                  ...current,
                                  channel: event.target.value as 'admin' | 'clinician',
                                }))
                              }
                            >
                              <option value="admin">PulseCheck Admin Onboarding</option>
                              <option value="clinician" disabled={selectedActivationTeam?.defaultEscalationRoute !== 'clinician'}>
                                AuntEdna Clinician Onboarding
                              </option>
                            </select>
                          </label>
                        </div>

                        <div className="pcp-fg pcp-c1">
                          <label className="pcp-fld">
                            <span className="pcp-flbl">Recipient Email</span>
                            <input
                              className="pcp-finp"
                              type="email"
                              value={activationDraft.targetEmail}
                              onChange={(event) => setActivationDraft((current) => ({ ...current, targetEmail: event.target.value }))}
                              placeholder="admin@school.edu"
                              disabled={activationDraft.channel === 'clinician'}
                            />
                            {activationDraft.channel === 'clinician' ? (
                              <span className="pcp-fhint">
                                Clinician links use the attached clinician profile email: {selectedActivationClinicianProfile?.email || 'not set'}.
                              </span>
                            ) : null}
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </form>

                <form ref={pilotFormRef} onSubmit={handleCreatePilot}>
                  <div className={`pcp-m-tab ${activeWizardStep === 'pilot' ? 'active' : ''}`}>
                    <div className="pcp-sec-hd">
                      <div className="pcp-sec-ic"><ClipboardList /></div>
                      <span className="pcp-sec-tl">Create Pilot</span>
                    </div>
                    <div className="pcp-fg pcp-c1">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Team</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={pilotForm.teamId}
                          onChange={(event) => handlePilotFieldChange('teamId', event.target.value)}
                        >
                          <option value="">Select a team</option>
                          {wizardTeams.map((team) => {
                            const organization = organizations.find((item) => item.id === team.organizationId);
                            return (
                              <option key={team.id} value={team.id}>
                                {organization ? `${organization.displayName} → ${team.displayName}` : team.displayName}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    </div>
                    {selectedPilotTeam ? (
                      <div className="pcp-info-box">
                        This pilot will attach to {selectedPilotTeam.displayName} and inherit that team&apos;s organization context and routing defaults.
                      </div>
                    ) : null}
                    <div className="pcp-fg">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Pilot Name</span>
                        <input
                          className="pcp-finp"
                          value={pilotForm.name}
                          onChange={(event) => handlePilotFieldChange('name', event.target.value)}
                          placeholder="Spring 2026 Pilot"
                        />
                      </label>
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Study Mode</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={pilotForm.studyMode}
                          onChange={(event) => handlePilotFieldChange('studyMode', event.target.value as PulseCheckPilotStudyMode)}
                        >
                          {PILOT_STUDY_MODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="pcp-fg">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Checkpoint Cadence</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={pilotForm.checkpointCadence || 'weekly'}
                          onChange={(event) => handlePilotFieldChange('checkpointCadence', event.target.value)}
                        >
                          {CHECKPOINT_CADENCE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Start Date</span>
                        <input
                          className="pcp-finp"
                          type="date"
                          value={pilotStartDate}
                          onChange={(event) => setPilotStartDate(event.target.value)}
                        />
                      </label>
                    </div>
                    <label className="pcp-checkbox-row">
                      <input
                        type="checkbox"
                        checked={pilotIsIndefinite}
                        onChange={(event) => setPilotIsIndefinite(event.target.checked)}
                      />
                      <div>
                        <div className="pcp-preview-title" style={{ fontSize: '12px', marginBottom: 4 }}>
                          Run this pilot indefinitely
                        </div>
                        <div className="pcp-checkbox-copy">
                          Leave the pilot without an end date. It will remain active until someone pauses or completes it manually.
                        </div>
                      </div>
                    </label>
                    <div className="pcp-fg">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Pilot Length</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={pilotDurationPreset}
                          onChange={(event) => setPilotDurationPreset(event.target.value)}
                          disabled={pilotIsIndefinite}
                        >
                          {PILOT_DURATION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      {pilotIsIndefinite ? (
                        <label className="pcp-fld">
                          <span className="pcp-flbl">Pilot Window</span>
                          <input
                            className="pcp-finp"
                            value="Runs indefinitely"
                            readOnly
                          />
                        </label>
                      ) : pilotDurationPreset === 'custom' ? (
                        <label className="pcp-fld">
                          <span className="pcp-flbl">Custom Days</span>
                          <input
                            className="pcp-finp"
                            type="number"
                            min={1}
                            value={pilotCustomDays}
                            onChange={(event) => setPilotCustomDays(event.target.value)}
                            placeholder="21"
                          />
                        </label>
                      ) : (
                        <label className="pcp-fld">
                          <span className="pcp-flbl">Projected End</span>
                          <input
                            className="pcp-finp"
                            value={
                              pilotStartDate
                                ? (() => {
                                    const durationDays = pilotDurationPreset === 'custom'
                                      ? Number.parseInt(pilotCustomDays, 10)
                                      : Number.parseInt(pilotDurationPreset, 10);
                                    if (!Number.isFinite(durationDays) || durationDays <= 0) return 'Not available';
                                    const startAt = new Date(`${pilotStartDate}T00:00:00`);
                                    const projectedEnd = new Date(startAt.getTime() + (durationDays - 1) * 24 * 60 * 60 * 1000);
                                    return projectedEnd.toLocaleDateString();
                                  })()
                                : ''
                            }
                            readOnly
                            placeholder="Projected automatically"
                          />
                        </label>
                      )}
                    </div>
                    <div className="pcp-fg pcp-c1">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Objective</span>
                        <textarea
                          className="pcp-finp pcp-textarea"
                          value={pilotForm.objective || ''}
                          onChange={(event) => handlePilotFieldChange('objective', event.target.value)}
                          placeholder="Why this pilot exists and what it is measuring."
                        />
                      </label>
                    </div>
                    <div className="pcp-fg pcp-c1">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Notes</span>
                        <textarea
                          className="pcp-finp pcp-textarea"
                          value={pilotForm.notes || ''}
                          onChange={(event) => handlePilotFieldChange('notes', event.target.value)}
                          placeholder="Internal setup notes, staffing assumptions, or rollout constraints."
                        />
                      </label>
                    </div>
                  </div>
                </form>

                <form ref={cohortFormRef} onSubmit={handleCreateCohort}>
                  <div className={`pcp-m-tab ${activeWizardStep === 'cohort' ? 'active' : ''}`}>
                    <div className="pcp-sec-hd">
                      <div className="pcp-sec-ic"><Clipboard /></div>
                      <span className="pcp-sec-tl">Create Cohort</span>
                    </div>
                    <div className="pcp-fg pcp-c1">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Pilot</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={cohortForm.pilotId}
                          onChange={(event) => handleCohortFieldChange('pilotId', event.target.value)}
                          disabled={skipCohortForNow}
                        >
                          <option value="">Select a pilot</option>
                          {wizardPilots.map((pilot) => {
                            const team = teams.find((item) => item.id === pilot.teamId);
                            return (
                              <option key={pilot.id} value={pilot.id}>
                                {team ? `${team.displayName} → ${pilot.name}` : pilot.name}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    </div>
                    <label className="pcp-checkbox-row">
                      <input
                        type="checkbox"
                        checked={skipCohortForNow}
                        onChange={(event) => setSkipCohortForNow(event.target.checked)}
                      />
                      <div>
                        <div className="pcp-preview-title" style={{ fontSize: '12px', marginBottom: 4 }}>
                          Skip cohort for now
                        </div>
                        <div className="pcp-checkbox-copy">
                          Cohorts are optional. Finish provisioning without creating one, and add a subgroup later only if the pilot needs split reporting or intervention arms.
                        </div>
                      </div>
                    </label>
                    {skipCohortForNow ? (
                      <div className="pcp-info-box">
                        This pilot will stay cohort-free for now. You can create cohorts later from the provisioning hierarchy once the rollout needs subgrouping.
                      </div>
                    ) : null}
                    <div className="pcp-fg">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Cohort Name</span>
                        <input
                          className="pcp-finp"
                          value={cohortForm.name}
                          onChange={(event) => handleCohortFieldChange('name', event.target.value)}
                          placeholder="Intervention Group"
                          disabled={skipCohortForNow}
                        />
                      </label>
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Cohort Type</span>
                        <select
                          className="pcp-finp pcp-select"
                          value={cohortForm.cohortType || 'intervention-group'}
                          onChange={(event) => handleCohortFieldChange('cohortType', event.target.value)}
                          disabled={skipCohortForNow}
                        >
                          {COHORT_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="pcp-fg pcp-c1">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Reporting Tags</span>
                        <div className="pcp-finp">
                          <div className="pcp-chip-row">
                            {(cohortForm.reportingTags || []).map((tag) => (
                              <span key={tag} className="pcp-chip">
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => removeCohortTag(tag)}
                                  aria-label={`Remove ${tag}`}
                                  disabled={skipCohortForNow}
                                >
                                  <X style={{ width: 10, height: 10 }} />
                                </button>
                              </span>
                            ))}
                            <input
                              className="pcp-chip-input"
                              value={cohortTagsInput}
                              onChange={(event) => setCohortTagsInput(event.target.value)}
                              onBlur={commitCohortTagsInput}
                              disabled={skipCohortForNow}
                              onKeyDown={(event) => {
                                if (event.key === ',' || event.key === 'Enter') {
                                  event.preventDefault();
                                  commitCohortTagsInput();
                                }
                              }}
                              placeholder={(cohortForm.reportingTags || []).length > 0 ? 'Add another tag' : 'control, spring-2026, returners'}
                            />
                          </div>
                        </div>
                        <span className="pcp-fhint">Type a tag and press comma or enter to create a chip.</span>
                      </label>
                    </div>
                    <div className="pcp-fg pcp-c1">
                      <label className="pcp-fld">
                        <span className="pcp-flbl">Notes</span>
                        <textarea
                          className="pcp-finp pcp-textarea"
                          value={cohortForm.notes || ''}
                          onChange={(event) => handleCohortFieldChange('notes', event.target.value)}
                          placeholder="What distinguishes this subgroup operationally."
                          disabled={skipCohortForNow}
                        />
                      </label>
                    </div>
                  </div>
                </form>
              </div>

              <div className="pcp-modal-ft">
                <div className="pcp-modal-ft-l">
                  Step {currentWizardStepIndex + 1} of {PROVISIONING_WIZARD_STEPS.length} — {currentWizardStepLabel}
                </div>
                <div className="pcp-modal-ft-r">
                  <button
                    type="button"
                    className="pcp-btn pcp-btn-ghost"
                    onClick={handleWizardBack}
                    disabled={currentWizardStepIndex === 0 || activeWizardSubmitting}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    className="pcp-btn pcp-btn-teal"
                    onClick={handleWizardNext}
                    disabled={activeWizardSubmitting || (activeWizardStep === 'activation' && !teams.length)}
                  >
                    {wizardPrimaryLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {onboardingModal ? (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-4 sm:px-6 sm:py-6">
              <div className="flex min-h-full items-start justify-center">
                <div className="my-auto flex w-full max-w-4xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[28px] border border-zinc-800 bg-[#090f1c] p-5 shadow-2xl sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Onboarding Link</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {onboardingModal.channel === 'admin' ? 'PulseCheck Admin Onboarding' : 'AuntEdna Clinician Onboarding'}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-zinc-300">
                      {onboardingModal.channel === 'admin'
                        ? `Manage PulseCheck onboarding links for the admin recipients tied to ${onboardingModal.organization.displayName}.`
                        : `Send the clinician onboarding handoff to ${onboardingModal.clinicianProfile.email || 'the clinician'} for ${onboardingModal.team.displayName}.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseOnboardingModal}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-black/20 text-zinc-400 transition hover:border-zinc-700 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Container</p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {`${onboardingModal.organization.displayName} -> ${onboardingModal.team.displayName}`}
                    </p>
                    <p className="mt-3 text-xs text-zinc-500">
                      {onboardingModal.channel === 'admin'
                        ? 'Each admin recipient can have one active onboarding link at a time.'
                        : `${onboardingModal.clinicianProfile.displayName} is the current clinician routing target for this team.`}
                    </p>
                  </div>
                </div>

                {onboardingModal.channel === 'admin' ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-zinc-500">Add Additional Admin</p>
                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_auto]">
                        <input
                          value={additionalAdminForm.name}
                          onChange={(event) => setAdditionalAdminForm((current) => ({ ...current, name: event.target.value }))}
                          className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-400"
                          placeholder="Additional admin name"
                        />
                        <input
                          type="email"
                          value={additionalAdminForm.email}
                          onChange={(event) => setAdditionalAdminForm((current) => ({ ...current, email: event.target.value }))}
                          className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-400"
                          placeholder="admin2@school.edu"
                        />
                        <button
                          type="button"
                          onClick={() => void handleAddAdditionalAdmin()}
                          disabled={additionalAdminSubmitting}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/30 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {additionalAdminSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users2 className="h-4 w-4" />}
                          Add Admin
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {onboardingAdminRecipients.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-zinc-700 bg-black/10 px-4 py-5 text-sm text-zinc-500">
                          No admin recipients configured yet.
                        </div>
                      ) : (
                        onboardingAdminRecipients.map((recipient) => {
                          const recipientLinks = onboardingModalAdminLinks.filter(
                            (link) => (link.targetEmail || '').toLowerCase() === recipient.email.toLowerCase()
                          );
                          const activeLink = recipientLinks.find((link) => link.status === 'active') || null;
                          // Prefer the active link for status; otherwise fall back to a redeemed
                          // link so an already-onboarded admin still shows their funnel state.
                          const statusLink =
                            activeLink || recipientLinks.find((link) => link.status === 'redeemed') || recipientLinks[0] || null;
                          const activity = statusLink ? modalActivityByToken[statusLink.token] : undefined;
                          const status = summarizeAdminActivation(statusLink, activity);
                          const isGenerating =
                            activationCreatingTeamId === onboardingModal.team.id &&
                            adminLinkCreatingEmail?.toLowerCase() === recipient.email.toLowerCase();
                          const isSending = activationEmailSendingEmail?.toLowerCase() === recipient.email.toLowerCase();

                          // Permissions this admin will carry. Administrative is always on;
                          // defaults to the active link's stored capabilities, then to admin-only.
                          const linkDefaultCaps = Array.from(
                            new Set<StaffPermission>(['administrative', ...normalizeStaffCapabilities(activeLink?.staffCapabilities)])
                          );
                          const recipientCaps: StaffPermission[] = adminCapabilitiesByEmail[recipient.email] ?? linkDefaultCaps;
                          const toggleAdminCap = (key: StaffPermission) => {
                            if (key === 'administrative') return; // the admin always keeps admin
                            setAdminCapabilitiesByEmail((prev) => {
                              const base = prev[recipient.email] ?? linkDefaultCaps;
                              const next = base.includes(key) ? base.filter((cap) => cap !== key) : [...base, key];
                              return {
                                ...prev,
                                [recipient.email]: Array.from(new Set<StaffPermission>(['administrative', ...next])),
                              };
                            });
                          };

                          const StatusRow = ({ done, doneLabel, pendingLabel }: { done: boolean; doneLabel: string; pendingLabel: string }) => (
                            <div className="flex items-center gap-2 text-xs">
                              <span
                                className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                                  done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-700/50 text-zinc-500'
                                }`}
                              >
                                {done ? '✓' : '○'}
                              </span>
                              <span className={done ? 'text-zinc-200' : 'text-zinc-500'}>{done ? doneLabel : pendingLabel}</span>
                            </div>
                          );

                          return (
                            <div key={recipient.email} className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-white">{recipient.name || recipient.email}</p>
                                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                                      {recipient.kind === 'primary'
                                        ? 'Primary'
                                        : recipient.kind === 'team-default'
                                          ? 'Team Default'
                                          : 'Additional'}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-zinc-400">
                                    Sending to: <span className="text-zinc-200">{recipient.email}</span>
                                  </p>

                                  {/* Activation funnel: sent → opened → onboarded */}
                                  <div className="mt-3 space-y-1.5 rounded-xl border border-zinc-800 bg-black/30 px-3 py-3">
                                    <StatusRow
                                      done={status.sent}
                                      doneLabel={`Email sent${status.sentAt ? ` · ${formatTimestamp(status.sentAt)}` : ''}${
                                        status.sendCount > 1 ? ` · ${status.sendCount} sends` : ''
                                      }`}
                                      pendingLabel={status.sendFailed ? 'Last send failed — try again' : 'Not sent yet'}
                                    />
                                    <StatusRow
                                      done={status.opened}
                                      doneLabel={`Opened the activation link${status.openedAt ? ` · ${formatTimestamp(status.openedAt)}` : ''}`}
                                      pendingLabel="Not opened yet"
                                    />
                                    <StatusRow
                                      done={status.onboarded}
                                      doneLabel={`Onboarded${status.onboardedAt ? ` · ${formatTimestamp(status.onboardedAt)}` : ''}${
                                        status.onboardedBy ? ` · ${status.onboardedBy}` : ''
                                      }`}
                                      pendingLabel="Not onboarded yet"
                                    />
                                  </div>

                                  {/* Permissions assigned to this admin (mirrors the dashboard staff model). */}
                                  <div className="mt-3 space-y-1.5">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                      Permissions
                                    </div>
                                    {ADMIN_PERMISSIONS.map((permission) => {
                                      const on = recipientCaps.includes(permission.key);
                                      const Icon = permission.icon;
                                      const locked = permission.key === 'administrative';
                                      return (
                                        <button
                                          key={permission.key}
                                          type="button"
                                          disabled={locked}
                                          onClick={() => toggleAdminCap(permission.key)}
                                          className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                                            on
                                              ? 'border-emerald-400/40 bg-emerald-400/[0.06]'
                                              : 'border-zinc-800 bg-black/30 hover:border-zinc-700'
                                          } ${locked ? 'cursor-default opacity-90' : ''}`}
                                        >
                                          <span
                                            className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                                              on ? 'border-emerald-400 bg-emerald-400 text-black' : 'border-zinc-600'
                                            }`}
                                          >
                                            {on && <Check className="h-3 w-3" />}
                                          </span>
                                          <span className="min-w-0">
                                            <span className="flex items-center gap-1.5 text-xs font-medium text-white">
                                              <Icon className="h-3 w-3 text-emerald-300/80" />
                                              {permission.label}
                                              {locked ? <span className="text-[9px] uppercase tracking-wide text-zinc-500">· always</span> : null}
                                            </span>
                                            <span className="mt-0.5 block text-[11px] text-zinc-500">{permission.blurb}</span>
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {activeLink ? (
                                    <>
                                      <div className="mt-3 rounded-xl border border-zinc-800 bg-black/30 px-3 py-3">
                                        <p className="break-all text-xs leading-6 text-white">{activeLink.activationUrl}</p>
                                      </div>
                                      <p className="mt-1 text-[11px] text-zinc-500">Link created: {formatTimestamp(activeLink.createdAt)}</p>

                                      {/* Front-load onboarding: pre-set the coach's profile photo */}
                                      <div className="mt-3 flex items-center gap-3 rounded-xl border border-zinc-800 bg-black/30 px-3 py-3">
                                        <div className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
                                          {activeLink.prefilledProfileImageUrl ? (
                                            <img src={activeLink.prefilledProfileImageUrl} alt="Pre-loaded coach photo" className="h-full w-full object-cover" />
                                          ) : (
                                            <ImageIcon className="h-4 w-4 text-zinc-600" />
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Pre-load profile photo</p>
                                          <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">
                                            {activeLink.prefilledProfileImageUrl
                                              ? 'Set — the coach starts onboarding with this photo and can change it.'
                                              : 'Optional. Appears already filled in when the coach onboards.'}
                                          </p>
                                          <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white">
                                            {coachPhotoUploadingToken === activeLink.token ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                            {coachPhotoUploadingToken === activeLink.token
                                              ? 'Uploading…'
                                              : activeLink.prefilledProfileImageUrl
                                                ? 'Change photo'
                                                : 'Upload photo'}
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              disabled={coachPhotoUploadingToken === activeLink.token}
                                              onChange={(event) => {
                                                void handleCoachProfilePrefillUpload(activeLink.token, event.target.files?.[0] || null);
                                                event.currentTarget.value = '';
                                              }}
                                            />
                                          </label>
                                        </div>
                                      </div>
                                    </>
                                  ) : null}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 xl:max-w-[240px] xl:justify-end">
                                  {/* Primary, deliberate action: actually send/resend the activation email. */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleSendActivationEmailNow({
                                        organization: onboardingModal.organization,
                                        team: onboardingModal.team,
                                        recipientName: recipient.name,
                                        recipientEmail: recipient.email,
                                        existingLink: activeLink,
                                        staffCapabilities: recipientCaps,
                                      })
                                    }
                                    disabled={isSending || isGenerating}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MailPlus className="h-3.5 w-3.5" />}
                                    {status.sent ? 'Resend Email' : 'Send Now'}
                                  </button>
                                  {activeLink ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => void handleCopyActivationLink(activeLink.activationUrl)}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                                      >
                                        <Clipboard className="h-3.5 w-3.5" />
                                        Copy
                                      </button>
                                      <a
                                        href={activeLink.activationUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        Open
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => void handleCreateAdminActivationLink(onboardingModal.team, recipient.email, recipientCaps)}
                                        disabled={isGenerating}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                        Regenerate
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          void handleCreateClinicianOnboardingLink(
                            onboardingModal.organization,
                            onboardingModal.team,
                            onboardingModal.clinicianProfile
                          )
                        }
                        disabled={clinicianLinkCreatingProfileId === onboardingModal.clinicianProfile.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {clinicianLinkCreatingProfileId === onboardingModal.clinicianProfile.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Generate New Link
                      </button>

                      <p className="text-xs text-zinc-500">
                        Creating a new link revokes the prior active link for this clinician onboarding lane.
                      </p>
                    </div>

                    {onboardingModalLinks.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-zinc-700 bg-black/10 px-4 py-5 text-sm text-zinc-500">
                        No active onboarding link yet for this lane.
                      </div>
                    ) : (
                      onboardingModalLinks.map((link) => (
                        <div key={link.token} className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                          <div className="rounded-xl border border-zinc-800 bg-black/30 px-3 py-3">
                            <p className="break-all text-sm font-medium leading-6 text-white">{link.activationUrl}</p>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">Target: {link.targetEmail || 'No email set'}</p>
                          <p className="mt-1 text-xs text-zinc-500">Created: {formatTimestamp(link.createdAt)}</p>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleCopyActivationLink(link.activationUrl)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                            >
                              <Clipboard className="h-3.5 w-3.5" />
                              Copy Link
                            </button>
                            <a
                              href={link.activationUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open Link
                            </a>
                            <button
                              type="button"
                              onClick={() => handleSendOnboardingEmail(link)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                            >
                              <MailPlus className="h-3.5 w-3.5" />
                              Draft Email
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
                </div>
              </div>
              </div>
            </div>
          ) : null}
        </div>
        <GuidedTour
          open={adminTourOpen}
          steps={PULSECHECK_ADMIN_TOUR_STEPS}
          accentColor="#00d4aa"
          storageKey="pulsecheck_admin_provisioning_tour_status"
          onClose={() => setAdminTourOpen(false)}
        />
      </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckProvisioningPage;
