import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  Clipboard,
  ClipboardList,
  Download,
  ExternalLink,
  HeartPulse,
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
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { useUser } from '../../hooks/useUser';
import { storage } from '../../api/firebase/config';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import { fetchPulseCheckSportConfiguration, getDefaultPulseCheckSports } from '../../api/firebase/pulsecheckSportConfig';
import {
  derivePulseCheckTeamPlanBypass,
  getDefaultPulseCheckTeamCommercialConfig,
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
  PulseCheckInviteLink,
  PulseCheckInvitePolicy,
  PulseCheckOrganization,
  PulseCheckOrganizationStatus,
  PulseCheckPilot,
  PulseCheckPilotCohort,
  PulseCheckPilotCohortStatus,
  PulseCheckPilotStudyMode,
  PulseCheckRevenueRecipientRole,
  PulseCheckStudyPosture,
  PulseCheckTeam,
  PulseCheckTeamCommercialConfig,
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

const PulseCheckProvisioningPage: React.FC = () => {
  const currentUser = useUser();
  const [organizations, setOrganizations] = useState<PulseCheckOrganization[]>([]);
  const [teams, setTeams] = useState<PulseCheckTeam[]>([]);
  const [pilots, setPilots] = useState<PulseCheckPilot[]>([]);
  const [pilotCohorts, setPilotCohorts] = useState<PulseCheckPilotCohort[]>([]);
  const [clinicianProfiles, setClinicianProfiles] = useState<PulseCheckAuntEdnaClinicianProfile[]>([]);
  const [inviteLinks, setInviteLinks] = useState<PulseCheckInviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgForm, setOrgForm] = useState<CreatePulseCheckOrganizationInput>(defaultOrganizationForm);
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
  const [activationCreatingTeamId, setActivationCreatingTeamId] = useState<string | null>(null);
  const [clinicianLinkCreatingProfileId, setClinicianLinkCreatingProfileId] = useState<string | null>(null);
  const [adminLinkCreatingEmail, setAdminLinkCreatingEmail] = useState<string | null>(null);
  const [teamCommercialSavingId, setTeamCommercialSavingId] = useState<string | null>(null);
  const [onboardingModal, setOnboardingModal] = useState<OnboardingModalState | null>(null);
  const [additionalAdminForm, setAdditionalAdminForm] = useState({ name: '', email: '' });
  const [additionalAdminSubmitting, setAdditionalAdminSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [organizationImageUploadingId, setOrganizationImageUploadingId] = useState<string | null>(null);
  const [teamImageUploadingId, setTeamImageUploadingId] = useState<string | null>(null);
  const [sportOptions, setSportOptions] = useState(() => getDefaultPulseCheckSports());
  const [teamCommercialDrafts, setTeamCommercialDrafts] = useState<Record<string, PulseCheckTeamCommercialConfig>>({});
  const [isProvisioningModalOpen, setIsProvisioningModalOpen] = useState(false);
  const [activeWizardStep, setActiveWizardStep] = useState<ProvisioningWizardStep>('org');
  const [organizationSearch, setOrganizationSearch] = useState('');
  const [organizationStatusFilter, setOrganizationStatusFilter] = useState<DashboardStatusFilter>('all');
  const [expandedOrganizationIds, setExpandedOrganizationIds] = useState<string[]>([]);
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
  const athleteInviteLinksByCohortId = useMemo(() => {
    const nextMap = new Map<string, PulseCheckInviteLink[]>();
    inviteLinks.forEach((link) => {
      if (link.status !== 'active') return;
      if (link.inviteType !== 'team-access') return;
      if (link.teamMembershipRole !== 'athlete') return;
      if (!link.cohortId) return;

      const current = nextMap.get(link.cohortId) || [];
      current.push(link);
      nextMap.set(link.cohortId, current);
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
      setOrganizations(organizationResults);
      setTeams(teamResults);
      setTeamCommercialDrafts((current) => {
        const next = { ...current };
        teamResults.forEach((team) => {
          next[team.id] = current[team.id] || team.commercialConfig;
        });
        return next;
      });
      setPilots(pilotResults);
      setPilotCohorts(pilotCohortResults);
      setClinicianProfiles(clinicianProfileResults);
      setInviteLinks(inviteLinkResults);
      setSportOptions(sportConfigurationResults);
      setTeamForm((current) => ({
        ...current,
        organizationId: current.organizationId || organizationResults[0]?.id || '',
        defaultAdminName:
          current.defaultAdminName ||
          organizationResults.find((organization) => organization.id === (current.organizationId || organizationResults[0]?.id))
            ?.primaryCustomerAdminName ||
          '',
        defaultAdminEmail:
          current.defaultAdminEmail ||
          organizationResults.find((organization) => organization.id === (current.organizationId || organizationResults[0]?.id))
            ?.primaryCustomerAdminEmail ||
          '',
      }));
      setPilotForm((current) => ({
        ...current,
        organizationId: current.organizationId || teamResults[0]?.organizationId || '',
        teamId: current.teamId || teamResults[0]?.id || '',
        status: 'active',
      }));
      setCohortForm((current) => ({
        ...current,
        organizationId: current.organizationId || teamResults[0]?.organizationId || '',
        teamId: current.teamId || teamResults[0]?.id || '',
        pilotId: current.pilotId || pilotResults[0]?.id || '',
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

    try {
      const createdId = await pulseCheckProvisioningService.createOrganization({
        ...orgForm,
        implementationOwnerUserId: currentUser?.id || '',
        implementationOwnerEmail: currentUser?.email || '',
      });

      setOrgForm(defaultOrganizationForm);
      await loadData();
      setTeamForm((current) => ({
        ...current,
        organizationId: createdId,
        defaultAdminName: current.defaultAdminName || orgForm.primaryCustomerAdminName || '',
        defaultAdminEmail: current.defaultAdminEmail || orgForm.primaryCustomerAdminEmail || '',
      }));
      setExpandedOrganizationIds((current) => (current.includes(createdId) ? current : [...current, createdId]));
      setActiveWizardStep('team');
      setMessage({ type: 'success', text: 'Organization created. You can now create the first team under it.' });
      return true;
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create organization:', error);
      setMessage({ type: 'error', text: 'Failed to create organization.' });
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

  const handleCreateAdminActivationLink = async (team: PulseCheckTeam, targetEmail?: string) => {
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

  const handleCopyInviteLink = async (activationUrl: string, successText = 'Invite link copied to clipboard.') => {
    try {
      await navigator.clipboard.writeText(activationUrl);
      setMessage({ type: 'success', text: successText });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to copy invite link:', error);
      setMessage({ type: 'error', text: 'Failed to copy invite link.' });
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
        createdByUserId: currentUser?.id || '',
        createdByEmail: currentUser?.email || '',
      });

      const refreshedInviteLinks = await pulseCheckProvisioningService.listInviteLinks();
      setInviteLinks(refreshedInviteLinks);
      const createdInvite = refreshedInviteLinks.find((invite) => invite.id === inviteId);
      if (createdInvite?.activationUrl) {
        await navigator.clipboard.writeText(createdInvite.activationUrl);
      }

      setMessage({
        type: 'success',
        text: `Cohort athlete invite created for ${cohort.name} and copied to the clipboard.`,
      });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create cohort athlete invite:', error);
      setMessage({ type: 'error', text: 'Failed to create cohort athlete invite.' });
    } finally {
      setCohortInviteCreatingId(null);
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

  const toggleTeamRow = useCallback((teamId: string) => {
    toggleExpandedId(teamId, setExpandedTeamIds);
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
            href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap"
            rel="stylesheet"
          />
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
            --fd: 'Syne', sans-serif;
            --fm: 'DM Mono', monospace;
            --fb: 'DM Sans', sans-serif;
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
          .pcp-org-hd { display: flex; align-items: center; padding: 0 16px 0 0; cursor: pointer; user-select: none; background: var(--glass); min-height: 62px; transition: background 0.15s; }
          .pcp-org-hd:hover { background: var(--glassh); }
          .pcp-org-chev { width: 42px; height: 62px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .pcp-org-chev svg { width: 13px; height: 13px; color: var(--t3); transition: transform 0.2s; }
          .pcp-org-row.open .pcp-org-chev svg { transform: rotate(90deg); }
          .pcp-org-ico { width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, rgba(0, 212, 170, 0.14), rgba(0, 212, 170, 0.04)); border: 0.5px solid var(--teal-b); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px; color: var(--teal); }
          .pcp-org-info { flex: 1; min-width: 0; padding: 12px 0; }
          .pcp-org-name { font-size: 14px; font-weight: 600; letter-spacing: -0.2px; margin-bottom: 2px; }
          .pcp-org-meta { font-size: 11px; color: var(--t3); font-family: var(--fm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 520px; }
          .pcp-org-counts { display: flex; gap: 5px; margin-right: 12px; }
          .pcp-mc { font-size: 10px; font-weight: 500; padding: 3px 7px; border-radius: 9999px; background: rgba(255, 255, 255, 0.04); border: 0.5px solid rgba(255, 255, 255, 0.07); color: var(--t3); font-family: var(--fm); white-space: nowrap; }
          .pcp-org-actions { display: flex; align-items: center; gap: 6px; margin-left: 10px; }
          .pcp-status { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 3px 9px; border-radius: 9999px; white-space: nowrap; }
          .pcp-s-prov { background: var(--amber-d); border: 0.5px solid rgba(245, 166, 35, 0.22); color: var(--amber); }
          .pcp-s-ready { background: var(--blue-d); border: 0.5px solid rgba(96, 165, 250, 0.22); color: var(--blue); }
          .pcp-s-active { background: var(--green-d); border: 0.5px solid rgba(74, 222, 128, 0.22); color: var(--green); }
          .pcp-s-done { background: rgba(255, 255, 255, 0.05); border: 0.5px solid rgba(255, 255, 255, 0.08); color: var(--t3); }
          .pcp-ab { padding: 5px 10px; border-radius: 7px; font-size: 11px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: background 0.15s, color 0.15s; border: none; }
          .pcp-ab svg { width: 11px; height: 11px; }
          .pcp-ab-g { background: rgba(255, 255, 255, 0.05); color: var(--t2); border: 0.5px solid var(--mb); }
          .pcp-ab-g:hover { background: rgba(255, 255, 255, 0.09); color: var(--t1); }
          .pcp-ab-t { background: var(--teal-d); color: var(--teal); border: 0.5px solid var(--teal-b); }
          .pcp-ab-t:hover { background: rgba(0, 212, 170, 0.16); }
          .pcp-ab:disabled { opacity: 0.45; cursor: not-allowed; }
          .pcp-org-body { display: none; }
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
          .pcp-cohort-item,
          .pcp-ob-item { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; border-radius: 8px; margin-bottom: 4px; background: rgba(255, 255, 255, 0.025); border: 0.5px solid rgba(255, 255, 255, 0.06); gap: 10px; }
          .pcp-ci-name { font-size: 11px; font-weight: 500; }
          .pcp-ci-meta { font-size: 9px; color: var(--t3); font-family: var(--fm); margin-top: 1px; }
          .pcp-ob-type { font-size: 10px; font-weight: 600; color: var(--t2); }
          .pcp-ob-val { font-size: 10px; color: var(--teal); font-family: var(--fm); margin-top: 1px; line-height: 1.5; }
          .pcp-ob-empty { font-size: 10px; color: var(--t3); font-style: italic; margin-top: 1px; line-height: 1.5; }
          .pcp-c-empty { font-size: 11px; color: var(--t3); font-style: italic; padding: 4px 0; }
          .pcp-empty-panel { padding: 24px 18px; border-radius: 14px; border: 0.5px dashed rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.02); text-align: center; color: var(--t2); font-size: 12px; }
          .pcp-org-overview { padding: 16px 16px 0 54px; }
          .pcp-org-grid,
          .pcp-team-grid { display: grid; gap: 12px; }
          .pcp-org-grid { grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); }
          .pcp-team-shell { padding: 14px 16px 16px 80px; }
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
          .pcp-fld { display: flex; flex-direction: column; gap: 5px; }
          .pcp-fld.pcp-s2 { grid-column: 1 / -1; }
          .pcp-flbl { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--t3); }
          .pcp-finp { background: var(--glass); border: 0.5px solid var(--mb); border-radius: 9px; padding: 8px 12px; font-size: 13px; color: var(--t1); outline: none; transition: border-color 0.2s, background 0.2s; }
          .pcp-finp:focus { border-color: var(--teal-b); background: var(--teal-d); }
          .pcp-finp::placeholder { color: var(--t3); }
          .pcp-finp:disabled { opacity: 0.5; cursor: not-allowed; }
          .pcp-finp.pcp-select { cursor: pointer; }
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
            .pcp-commercial-grid { grid-template-columns: 1fr; }
            .pcp-org-overview { padding-left: 18px; }
            .pcp-team-shell { padding-left: 18px; }
            .pcp-pilot-panel.open { grid-template-columns: 1fr; padding-left: 80px; }
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
              <div className="pcp-page-head pcp-slide-up">
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

                <div className="pcp-head-right">
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

              <div className="pcp-toolbar pcp-slide-up" style={{ animationDelay: '0.1s' }}>
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

              <div className="pcp-org-list">
                {loading ? (
                  <div className="pcp-empty-panel">Loading organizations and provisioning hierarchy...</div>
                ) : filteredOrganizationBundles.length === 0 ? (
                  <div className="pcp-empty-panel">No organizations match the current filters.</div>
                ) : (
                  filteredOrganizationBundles.map(({ organization, teams: bundledTeams }, organizationIndex) => {
                    const orgStatus = getOrganizationStatusDisplay(organization.status);
                    const organizationExpanded = expandedOrganizationIds.includes(organization.id);
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
                        <div className="pcp-org-hd" onClick={() => toggleOrganizationRow(organization.id)}>
                          <div className="pcp-org-chev"><ChevronDown /></div>
                          <div className="pcp-org-ico"><Building2 /></div>
                          <div className="pcp-org-info">
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

                          <span className={`pcp-status ${getDashboardStatusClassName(orgStatus)}`}>{orgStatus.label}</span>

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

                        <div className="pcp-org-body">
                          <div className="pcp-org-overview">
                            <div className="pcp-org-grid">
                              <div className="pcp-card">
                                <div className="pcp-card-title">Organization Invite Artwork</div>
                                <div className="pcp-preview-shell">
                                  <img
                                    className="pcp-preview-image"
                                    src={organizationPreviewImage}
                                    alt={`${organization.displayName} invite artwork`}
                                  />
                                  <div className="pcp-preview-meta">
                                    <div className="pcp-preview-title">{organization.displayName}</div>
                                    <div className="pcp-preview-copy">
                                      This artwork becomes the default invite preview for every team that inherits organization branding.
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

                              <div className="pcp-card">
                                <div className="pcp-card-title">Organization Summary</div>
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
                              </div>
                            </div>
                          </div>

                          {bundledTeams.length === 0 ? (
                            <div className="pcp-team-body" style={{ display: 'block' }}>
                              <div style={{ padding: '12px 16px 12px 54px' }}>
                                <div className="pcp-c-empty">No teams attached yet.</div>
                              </div>
                            </div>
                          ) : (
                            bundledTeams.map(({ team, pilots: bundledPilots, clinicianProfile, adminActivationLinks, clinicianOnboardingLink }) => {
                              const teamExpanded = expandedTeamIds.includes(team.id);
                              const teamStatus = getTeamStatusDisplay(team.status);
                              const activeAdminLink = adminActivationLinks[0] || null;
                              const teamCommercialDraft = teamCommercialDrafts[team.id] || team.commercialConfig;
                              const teamPreviewImage = resolvePulseCheckInvitePreviewImage(
                                team.invitePreviewImageUrl,
                                organization.invitePreviewImageUrl
                              );
                              const teamPlanBypass = derivePulseCheckTeamPlanBypass(teamCommercialDraft);

                              return (
                                <div key={team.id} className={`pcp-team-row ${teamExpanded ? 'open' : ''}`}>
                                  <div className="pcp-team-hd" onClick={() => toggleTeamRow(team.id)}>
                                    <div className="pcp-t-indent" />
                                    <div className="pcp-t-chev"><ChevronDown /></div>
                                    <div className="pcp-t-vline" />
                                    <div className="pcp-t-av"><Users2 /></div>
                                    <div className="pcp-t-info">
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

                                  <div className="pcp-team-body">
                                    <div className="pcp-team-shell">
                                      <div className="pcp-team-grid">
                                        <div className="pcp-card">
                                          <div className="pcp-card-title">Pilot Invite Artwork</div>
                                          <div className="pcp-preview-shell">
                                            <img
                                              className="pcp-preview-image"
                                              src={teamPreviewImage}
                                              alt={`${team.displayName} invite artwork`}
                                            />
                                            <div className="pcp-preview-meta">
                                              <div className="pcp-preview-title">{team.displayName}</div>
                                              <div className="pcp-preview-copy">
                                                {team.invitePreviewImageUrl
                                                  ? 'This team has its own invite preview artwork.'
                                                  : 'This team is currently inheriting the organization invite artwork.'}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="pcp-preview-actions">
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
                                              {teamImageUploadingId === team.id ? 'Uploading...' : 'Upload Team Image'}
                                            </label>
                                          </div>
                                        </div>

                                        <div className="pcp-card">
                                          <div className="pcp-commercial-footer" style={{ alignItems: 'flex-start' }}>
                                            <div>
                                              <div className="pcp-card-title">Team Commercial Config</div>
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
                                                <span className="pcp-flbl">Revenue Recipient Role</span>
                                                <select
                                                  className="pcp-finp pcp-select"
                                                  value={teamCommercialDraft.revenueRecipientRole}
                                                  onChange={(event) =>
                                                    handleExistingTeamCommercialFieldChange(
                                                      team.id,
                                                      'revenueRecipientRole',
                                                      event.target.value as PulseCheckRevenueRecipientRole
                                                    )
                                                  }
                                                >
                                                  {TEAM_REVENUE_RECIPIENT_ROLE_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
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
                                        </div>

                                        <div className="pcp-card">
                                          <div className="pcp-card-title">Support Route + Activation</div>
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
                                                  PulseCheck admin onboarding
                                                </div>
                                                <div className="pcp-link-card-copy">
                                                  {activeAdminLink
                                                    ? `${activeAdminLink.targetEmail || team.defaultAdminEmail || 'No email set'} · ${adminActivationLinks.length} active link${adminActivationLinks.length === 1 ? '' : 's'}`
                                                    : 'No admin onboarding link has been issued yet.'}
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
                                                {activeAdminLink ? 'Resend' : 'Generate'}
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {bundledPilots.length === 0 ? (
                                      <div style={{ padding: '0 16px 10px 80px' }}>
                                        <div className="pcp-c-empty">No pilots created yet for this team.</div>
                                      </div>
                                    ) : (
                                      bundledPilots.map(({ pilot, cohorts }) => {
                                        const pilotExpanded = expandedPilotIds.includes(pilot.id);
                                        const pilotStatus = getDerivedPilotStatusDisplay(pilot);

                                        return (
                                          <React.Fragment key={pilot.id}>
                                            <div
                                              className={`pcp-pilot-row ${pilotExpanded ? 'open' : ''}`}
                                              onClick={() => togglePilotRow(pilot.id)}
                                            >
                                              <div className="pcp-p-indent" />
                                              <div className="pcp-p-dot" />
                                              <div className="pcp-p-info">
                                                <div className="pcp-p-name">{pilot.name}</div>
                                                <div className="pcp-p-meta">
                                                  {[
                                                    toDateValue(pilot.startAt)?.toLocaleDateString() || 'not scheduled',
                                                    toDateValue(pilot.endAt)?.toLocaleDateString() || 'open ended',
                                                    pilot.checkpointCadence || 'no cadence',
                                                    `${cohorts.length} cohort${cohorts.length === 1 ? '' : 's'}`,
                                                  ].join(' · ')}
                                                </div>
                                              </div>
                                              <div className="pcp-p-right">
                                                <span className={`pcp-status ${getDashboardStatusClassName(pilotStatus)}`}>{pilotStatus.label}</span>
                                                <div className="pcp-p-chev"><ChevronDown /></div>
                                              </div>
                                            </div>

                                            <div className={`pcp-pilot-panel ${pilotExpanded ? 'open' : ''}`}>
                                              <div>
                                                <div className="pcp-pp-lbl">Cohorts</div>
                                                {cohorts.length === 0 ? (
                                                  <div className="pcp-c-empty">No cohorts attached yet.</div>
                                                ) : (
                                                  cohorts.map((cohort) => {
                                                    const activeCohortInvite = (athleteInviteLinksByCohortId.get(cohort.id) || [])[0] || null;
                                                    const cohortStatus = getCohortStatusDisplay(cohort.status);

                                                    return (
                                                      <div key={cohort.id} className="pcp-cohort-item">
                                                        <div style={{ minWidth: 0, flex: 1 }}>
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
                                                            void (
                                                              activeCohortInvite
                                                                ? handleCopyInviteLink(
                                                                    activeCohortInvite.activationUrl,
                                                                    'Cohort athlete invite copied to clipboard.'
                                                                  )
                                                                : handleCreateCohortInviteLink(pilot, cohort)
                                                            );
                                                          }}
                                                          disabled={cohortInviteCreatingId === cohort.id}
                                                        >
                                                          {cohortInviteCreatingId === cohort.id ? <Loader2 /> : <Clipboard />}
                                                          {activeCohortInvite ? 'Copy Invite' : 'Create Invite'}
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

                                                <div className="pcp-ob-item">
                                                  <div>
                                                    <div className="pcp-ob-type">
                                                      PulseCheck Admin
                                                      {adminActivationLinks.length > 0 ? ` · ${adminActivationLinks.length} active` : ''}
                                                    </div>
                                                    {activeAdminLink ? (
                                                      <div className="pcp-ob-val">{activeAdminLink.targetEmail || team.defaultAdminEmail || 'No email set'}</div>
                                                    ) : (
                                                      <div className="pcp-ob-empty">No link issued yet</div>
                                                    )}
                                                  </div>
                                                  <button
                                                    type="button"
                                                    className={`pcp-ab ${activeAdminLink ? 'pcp-ab-t' : 'pcp-ab-t'}`}
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
                                                    {activeAdminLink ? 'Resend' : 'Generate'}
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          </React.Fragment>
                                        );
                                      })
                                    )}
                                  </div>
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
                    {teams.length === 0 ? (
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
                              {teams.map((team) => {
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
                          {teams.map((team) => {
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
                          {pilots.map((pilot) => {
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

                  <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Link Behavior</p>
                    <p className="mt-2 text-sm text-zinc-300">
                      {onboardingModal.channel === 'admin'
                        ? 'Generate a unique onboarding link per admin email. Regenerating for the same email revokes the old link and the old link stops working.'
                        : 'There is one active clinician onboarding link for this clinician profile. Regenerating it revokes the old link and the old link stops working.'}
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
                          const activeLink =
                            onboardingModalLinks.find((link) => (link.targetEmail || '').toLowerCase() === recipient.email.toLowerCase()) || null;
                          const isGenerating =
                            activationCreatingTeamId === onboardingModal.team.id &&
                            adminLinkCreatingEmail?.toLowerCase() === recipient.email.toLowerCase();

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
                                  <p className="mt-1 text-xs text-zinc-400">{recipient.email}</p>
                                  {activeLink ? (
                                    <>
                                      <div className="mt-3 rounded-xl border border-zinc-800 bg-black/30 px-3 py-3">
                                        <p className="break-all text-xs leading-6 text-white">{activeLink.activationUrl}</p>
                                      </div>
                                      <p className="mt-1 text-[11px] text-zinc-500">Created: {formatTimestamp(activeLink.createdAt)}</p>
                                    </>
                                  ) : (
                                    <p className="mt-3 text-xs text-zinc-500">No active onboarding link yet for this admin.</p>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 xl:max-w-[240px] xl:justify-end">
                                  <button
                                    type="button"
                                    onClick={() => void handleCreateAdminActivationLink(onboardingModal.team, recipient.email)}
                                    disabled={isGenerating}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                    {activeLink ? 'Regenerate Link' : 'Generate Link'}
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
                                        onClick={() => handleSendOnboardingEmail(activeLink)}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                                      >
                                        <MailPlus className="h-3.5 w-3.5" />
                                        Draft Email
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
      </div>
    </AdminRouteGuard>
  );
};

export default PulseCheckProvisioningPage;
