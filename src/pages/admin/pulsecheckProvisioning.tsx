import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { AlertTriangle, ArrowRight, Building2, Clipboard, ClipboardList, ExternalLink, Loader2, MailPlus, ShieldPlus, Sparkles, Stethoscope, Users2, X } from 'lucide-react';
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
  siteLabel: '',
  defaultAdminName: '',
  defaultAdminEmail: '',
  defaultInvitePolicy: 'admin-and-staff',
  commercialConfig: getDefaultPulseCheckTeamCommercialConfig(),
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
  status: 'draft',
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

const getOrganizationStatusDisplay = (status?: PulseCheckOrganizationStatus) => {
  switch (status) {
    case 'ready-for-activation':
      return { label: 'Ready for Activation', tone: 'border-amber-500/30 text-amber-200 bg-amber-500/10' };
    case 'active':
      return { label: 'Active', tone: 'border-green-500/30 text-green-200 bg-green-500/10' };
    case 'implementation-hold':
      return { label: 'Implementation Hold', tone: 'border-red-500/30 text-red-200 bg-red-500/10' };
    case 'archived':
      return { label: 'Archived', tone: 'border-zinc-700 text-zinc-300 bg-zinc-800/30' };
    case 'draft':
    case 'provisioning':
    default:
      return { label: 'Provisioning', tone: 'border-blue-500/30 text-blue-200 bg-blue-500/10' };
  }
};

const getTeamStatusDisplay = (status?: PulseCheckTeamStatus) => {
  switch (status) {
    case 'ready-for-activation':
      return { label: 'Ready for Activation', tone: 'border-amber-500/30 text-amber-200 bg-amber-500/10' };
    case 'active':
      return { label: 'Active', tone: 'border-green-500/30 text-green-200 bg-green-500/10' };
    case 'paused':
      return { label: 'Paused', tone: 'border-zinc-700 text-zinc-300 bg-zinc-800/30' };
    case 'archived':
      return { label: 'Archived', tone: 'border-zinc-700 text-zinc-300 bg-zinc-800/30' };
    case 'draft':
    case 'provisioning':
    default:
      return { label: 'Provisioning', tone: 'border-blue-500/30 text-blue-200 bg-blue-500/10' };
  }
};

const getPilotStatusDisplay = (status?: PulseCheckPilot['status']) => {
  switch (status) {
    case 'active':
      return { label: 'Active', tone: 'border-cyan-500/30 text-cyan-200 bg-cyan-500/10' };
    case 'paused':
      return { label: 'Paused', tone: 'border-zinc-700 text-zinc-300 bg-zinc-800/30' };
    case 'completed':
      return { label: 'Completed', tone: 'border-green-500/30 text-green-200 bg-green-500/10' };
    case 'archived':
      return { label: 'Archived', tone: 'border-zinc-700 text-zinc-300 bg-zinc-800/30' };
    case 'draft':
    default:
      return { label: 'Draft', tone: 'border-violet-500/30 text-violet-200 bg-violet-500/10' };
  }
};

const getDerivedPilotStatusDisplay = (pilot: PulseCheckPilot) => {
  const derivedStatus = getDerivedPilotStatusValue(pilot);
  return getPilotStatusDisplay(derivedStatus);
};

const getDerivedPilotStatusValue = (pilot: PulseCheckPilot): PulseCheckPilot['status'] => {
  const now = new Date();
  const startAt = toDateValue(pilot.startAt);
  const endAt = toDateValue(pilot.endAt);

  if (!startAt) return 'draft';
  if (endAt && endAt.getTime() < now.getTime()) return 'completed';
  if (startAt.getTime() <= now.getTime()) return 'active';
  return 'draft';
};

const getCohortStatusDisplay = (status?: PulseCheckPilotCohortStatus) => {
  switch (status) {
    case 'active':
      return { label: 'Active', tone: 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10' };
    case 'paused':
      return { label: 'Paused', tone: 'border-zinc-700 text-zinc-300 bg-zinc-800/30' };
    case 'archived':
      return { label: 'Archived', tone: 'border-zinc-700 text-zinc-300 bg-zinc-800/30' };
    case 'draft':
    default:
      return { label: 'Draft', tone: 'border-fuchsia-500/30 text-fuchsia-200 bg-fuchsia-500/10' };
  }
};

const getCohortTypeLabel = (value?: string) =>
  COHORT_TYPE_OPTIONS.find((option) => option.value === value)?.label || value || 'Not set';

const getCohortAssignmentRuleLabel = (value?: string) => {
  if (!value || value === 'manual-staff-assignment') return 'Manual assignment by staff';
  return value;
};

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
  const [pilotStartDate, setPilotStartDate] = useState('');
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
        status: 'draft',
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
    value: string | PulseCheckInvitePolicy
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
      return;
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
      setMessage({ type: 'success', text: 'Organization created. You can now create the first team under it.' });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create organization:', error);
      setMessage({ type: 'error', text: 'Failed to create organization.' });
    } finally {
      setOrgSubmitting(false);
    }
  };

  const handleCreateTeam = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teamForm.organizationId || !teamForm.displayName.trim() || !teamForm.sportOrProgram.trim()) {
      setMessage({ type: 'error', text: 'Organization, team name, and sport are required.' });
      return;
    }

    if (!teamForm.defaultClinicianProfileId || !teamForm.defaultClinicianProfileName) {
      setMessage({
        type: 'error',
        text: 'Select or create a clinician profile before creating the team.',
      });
      return;
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
        status: 'draft',
      });
      setPilotStartDate('');
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
      setMessage({
        type: 'success',
        text: 'Team created with its default clinician profile attached. You can now add pilots and cohorts before issuing onboarding links.',
      });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create team:', error);
      setMessage({ type: 'error', text: 'Failed to create team.' });
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
      return;
    }

    setPilotSubmitting(true);
    setMessage(null);

    try {
      const startAt = pilotStartDate ? new Date(`${pilotStartDate}T00:00:00`) : null;
      const durationDays =
        pilotDurationPreset === 'custom'
          ? Number.parseInt(pilotCustomDays, 10)
          : Number.parseInt(pilotDurationPreset, 10);

      if (pilotDurationPreset === 'custom' && (!Number.isFinite(durationDays) || durationDays <= 0)) {
        setMessage({ type: 'error', text: 'Enter a valid number of days for a custom pilot duration.' });
        setPilotSubmitting(false);
        return;
      }

      const endAt = startAt && Number.isFinite(durationDays) && durationDays > 0
        ? new Date(startAt.getTime() + (durationDays - 1) * 24 * 60 * 60 * 1000 + (23 * 60 * 60 + 59 * 60 + 59) * 1000)
        : null;

      const createdPilotId = await pulseCheckProvisioningService.createPilot({
        ...pilotForm,
        status: 'draft',
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
        status: 'draft',
      }));
      setPilotStartDate('');
      setPilotDurationPreset('14');
      setPilotCustomDays('');
      await loadData();
      setMessage({ type: 'success', text: 'Pilot created in draft. Display status now follows the pilot start date and duration window, and you can add cohorts under it.' });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create pilot:', error);
      setMessage({ type: 'error', text: 'Failed to create pilot.' });
    } finally {
      setPilotSubmitting(false);
    }
  };

  const handleCreateCohort = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cohortForm.organizationId || !cohortForm.teamId || !cohortForm.pilotId || !cohortForm.name.trim()) {
      setMessage({ type: 'error', text: 'Select a pilot and enter a cohort name before creating a cohort.' });
      return;
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
      setMessage({
        type: 'success',
        text: `Cohort created and linked to the selected pilot. It inherited a ${inheritedStatus} status from the pilot at creation time.`,
      });
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create cohort:', error);
      setMessage({ type: 'error', text: 'Failed to create cohort.' });
    } finally {
      setCohortSubmitting(false);
    }
  };

  const handleCreateAdminActivationLink = async (team: PulseCheckTeam, targetEmail?: string) => {
    if (!targetEmail?.trim()) {
      setMessage({ type: 'error', text: 'An admin email is required before generating an onboarding link.' });
      return;
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
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create admin activation link:', error);
      setMessage({ type: 'error', text: 'Failed to create admin activation link.' });
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
    } catch (error) {
      console.error('[PulseCheckProvisioning] Failed to create clinician onboarding link:', error);
      setMessage({ type: 'error', text: 'Failed to create clinician onboarding link.' });
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

  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-[#05070c] text-white">
        <Head>
          <title>PulseCheck Provisioning | Pulse Admin</title>
          <meta name="robots" content="noindex,nofollow" />
        </Head>

        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
          <header className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">PulseCheck Admin</p>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-white">PulseCheck Provisioning</h1>
                <p className="mt-2 max-w-4xl text-sm text-zinc-300">
                  First implementation slice for the provisioning model. This page lets Pulse Check admins create the
                  top-level organization, persistent team container, pilot structure, cohort structure, clinical route,
                  and onboarding links in one connected setup flow.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] px-4 py-3 text-sm text-zinc-300">
                Signed in as <span className="font-medium text-white">{currentUser?.email || 'unknown user'}</span>
              </div>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <article className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-blue-300" />
                <h2 className="text-sm font-semibold text-white">Step 1: Create Organization</h2>
              </div>
              <p className="mt-2 text-sm text-zinc-300">
                Create the top-level account and capture the first customer admin contact plus posture defaults.
              </p>
            </article>

            <article className="rounded-2xl border border-green-500/20 bg-green-500/[0.06] p-4">
              <div className="flex items-center gap-3">
                <Users2 className="h-5 w-5 text-green-300" />
                <h2 className="text-sm font-semibold text-white">Step 2: Create Team</h2>
              </div>
              <p className="mt-2 text-sm text-zinc-300">
                Create the persistent team container under that organization. Team is separate from pilot.
              </p>
            </article>

            <article className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4">
              <div className="flex items-center gap-3">
                <Stethoscope className="h-5 w-5 text-purple-300" />
                <h2 className="text-sm font-semibold text-white">Step 3: Connect Clinical Profile</h2>
              </div>
              <p className="mt-2 text-sm text-zinc-300">
                Attach the team to a clinician profile record now, then let athlete-level overrides fall back to this default later.
              </p>
            </article>

            <article className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
              <div className="flex items-center gap-3">
                <MailPlus className="h-5 w-5 text-amber-300" />
                <h2 className="text-sm font-semibold text-white">Step 4: Generate Admin Activation</h2>
              </div>
              <p className="mt-2 text-sm text-zinc-300">
                Once the shell is configured, generate the first customer admin activation link and hand off onboarding.
              </p>
            </article>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-cyan-300" />
                <h2 className="text-sm font-semibold text-white">Step 5: Create Pilot</h2>
              </div>
              <p className="mt-2 text-sm text-zinc-300">
                Add the time-bound pilot layer inside the team when the rollout needs checkpointing, study posture, or internal evaluation structure.
              </p>
            </article>

            <article className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-4">
              <div className="flex items-center gap-3">
                <Clipboard className="h-5 w-5 text-fuchsia-300" />
                <h2 className="text-sm font-semibold text-white">Step 6: Create Cohorts</h2>
              </div>
              <p className="mt-2 text-sm text-zinc-300">
                Add cohorts inside the pilot for intervention arms, reporting groups, position clusters, or other subgroup logic.
              </p>
            </article>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Lifecycle Model</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Provisioning Lifecycle</h2>
                <p className="mt-2 text-sm leading-7 text-zinc-300">
                  Organization and team records move through three operational states: provisioning while PulseCheck assembles the shell,
                  ready for activation once the onboarding link is issued, and active after the first customer admin completes handoff and
                  takes ownership of the container.
                </p>
              </div>

              <div className="grid w-full max-w-[520px] grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-4">
                  <p className="text-xs uppercase tracking-wide text-blue-200">Provisioning</p>
                  <p className="mt-2 text-sm text-zinc-300">Internal shell is being assembled.</p>
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                  <p className="text-xs uppercase tracking-wide text-amber-200">Ready for Activation</p>
                  <p className="mt-2 text-sm text-zinc-300">Activation link exists and handoff can start.</p>
                </div>
                <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.06] p-4">
                  <p className="text-xs uppercase tracking-wide text-green-200">Active</p>
                  <p className="mt-2 text-sm text-zinc-300">Customer admin redeemed the link and owns the container.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Modeling Rules</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Organization vs Team vs Pilot vs Cohort</h2>
                <p className="mt-2 max-w-4xl text-sm leading-7 text-zinc-300">
                  Start with the top-level organization, then define the persistent team container, then add the time-bound pilot layer, then any subgrouping inside it.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                <article className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-4">
                  <p className="text-sm font-semibold text-white">Organization</p>
                  <p className="mt-2 text-sm text-zinc-300">
                    The top-level customer container. Organizations hold the legal identity, primary admin handoff, and the set of teams that belong to the same partner.
                  </p>
                </article>

                <article className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-4">
                  <p className="text-sm font-semibold text-white">Team</p>
                  <p className="mt-2 text-sm text-zinc-300">
                    The long-lived container for a sport, program, or operational unit. Teams own the roster, invite policy, and default routing setup.
                  </p>
                </article>

                <article className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4">
                  <p className="text-sm font-semibold text-white">Pilot</p>
                  <p className="mt-2 text-sm text-zinc-300">
                    A time-bound initiative inside a team. Use a pilot for rollout structure, checkpoint cadence, or a defined study or evaluation window.
                  </p>
                </article>

                <article className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-4">
                  <p className="text-sm font-semibold text-white">Cohort</p>
                  <p className="mt-2 text-sm text-zinc-300">
                    A subgroup inside a pilot. Use cohorts for intervention groups, control groups, position clusters, rehab groups, or reporting splits.
                  </p>
                </article>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-300">
                  <p className="font-semibold text-white">Simple rule</p>
                  <p className="mt-2">
                    If something needs its own customer identity or legal/admin umbrella, it should probably be a separate organization. If it needs its own long-term roster, admins, or invite flow inside that customer, it should probably be a separate team. If it is just a subgroup inside a pilot, it should be a cohort.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-300">
                  <p className="font-semibold text-white">Hierarchy</p>
                  <p className="mt-2 font-medium text-white">Organization -&gt; Team -&gt; Pilot -&gt; Cohort</p>
                </div>
              </div>
            </div>
          </section>

          {message ? (
            <div
              className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${
                message.type === 'success'
                  ? 'border-green-500/20 bg-green-500/[0.06] text-green-200'
                  : 'border-red-500/20 bg-red-500/[0.06] text-red-200'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>{message.text}</span>
            </div>
          ) : null}

          <main className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="space-y-6">
              <section className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
                <div className="mb-5 flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-blue-300" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">Create Organization</h2>
                    <p className="text-sm text-zinc-400">Internal-only setup for the customer account shell.</p>
                  </div>
                </div>

                <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleCreateOrganization}>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Display Name</span>
                    <input
                      value={orgForm.displayName}
                      onChange={(event) => handleOrgFieldChange('displayName', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-400"
                      placeholder="Hampton Athletics"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Legal Name</span>
                    <input
                      value={orgForm.legalName}
                      onChange={(event) => handleOrgFieldChange('legalName', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-400"
                      placeholder="Hampton University Athletics Department"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Organization Type</span>
                    <select
                      value={orgForm.organizationType}
                      onChange={(event) => handleOrgFieldChange('organizationType', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-400"
                    >
                      {ORGANIZATION_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Default Study Posture</span>
                    <select
                      value={orgForm.defaultStudyPosture}
                      onChange={(event) => handleOrgFieldChange('defaultStudyPosture', event.target.value as PulseCheckStudyPosture)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-400"
                    >
                      <option value="operational">Operational</option>
                      <option value="pilot">Pilot</option>
                      <option value="research-eligible">Research Eligible</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Customer Admin Name</span>
                    <input
                      value={orgForm.primaryCustomerAdminName}
                      onChange={(event) => handleOrgFieldChange('primaryCustomerAdminName', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-400"
                      placeholder="Athletic Director"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Customer Admin Email</span>
                    <input
                      type="email"
                      value={orgForm.primaryCustomerAdminEmail}
                      onChange={(event) => handleOrgFieldChange('primaryCustomerAdminEmail', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-400"
                      placeholder="admin@school.edu"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Clinician Routing Requirement</span>
                    <select
                      value={orgForm.defaultClinicianBridgeMode}
                      onChange={(event) =>
                        handleOrgFieldChange('defaultClinicianBridgeMode', event.target.value as PulseCheckClinicianBridgeMode)
                      }
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-400"
                    >
                      <option value="none">None</option>
                      <option value="optional">Optional</option>
                      <option value="required">Required</option>
                    </select>
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Notes</span>
                    <textarea
                      value={orgForm.notes}
                      onChange={(event) => handleOrgFieldChange('notes', event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-400"
                      placeholder="Implementation notes, routing assumptions, or contract context."
                    />
                  </label>

                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={orgSubmitting}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {orgSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                      {orgSubmitting ? 'Creating Organization...' : 'Create Organization'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
                <div className="mb-5 flex items-center gap-3">
                  <Users2 className="h-5 w-5 text-green-300" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">Create Team</h2>
                    <p className="text-sm text-zinc-400">Persistent sport or unit container inside the selected organization.</p>
                  </div>
                </div>

                <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleCreateTeam}>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Organization</span>
                    <select
                      value={teamForm.organizationId}
                      onChange={(event) => handleTeamFieldChange('organizationId', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400"
                    >
                      <option value="">Select an organization</option>
                      {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.displayName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Team Name</span>
                    <input
                      value={teamForm.displayName}
                      onChange={(event) => handleTeamFieldChange('displayName', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400"
                      placeholder="Men's Basketball"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Team Type</span>
                    <select
                      value={teamForm.teamType}
                      onChange={(event) => handleTeamFieldChange('teamType', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400"
                    >
                      {TEAM_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Sport</span>
                    <select
                      value={teamForm.sportOrProgram}
                      onChange={(event) => handleTeamFieldChange('sportOrProgram', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400"
                    >
                      <option value="">Select a sport</option>
                      {teamSportOptions.map((sport) => (
                        <option key={sport.id} value={sport.name}>
                          {sport.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-zinc-500">Managed from PulseCheck Sport Configuration.</p>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Site / Campus Label (Optional)</span>
                    <input
                      value={teamForm.siteLabel}
                      onChange={(event) => handleTeamFieldChange('siteLabel', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400"
                      placeholder="Main Campus"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Organization-Linked Team Admin</span>
                    <select
                      value={teamForm.defaultAdminEmail}
                      onChange={(event) => handleTeamAdminSelection(event.target.value)}
                      disabled={!selectedOrganization || teamAdminOptions.length === 0}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        {!selectedOrganization
                          ? 'Select an organization first'
                          : teamAdminOptions.length === 0
                            ? 'No organization admin contact configured'
                            : 'Select organization admin'}
                      </option>
                      {teamAdminOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-zinc-500">
                      Team admins must come from the selected organization&apos;s admin contact data in this first slice.
                    </p>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Who Can Create Invite Links</span>
                    <select
                      value={teamForm.defaultInvitePolicy}
                      onChange={(event) => handleTeamFieldChange('defaultInvitePolicy', event.target.value as PulseCheckInvitePolicy)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400"
                    >
                      <option value="admin-only">Admin Only</option>
                      <option value="admin-and-staff">Admin and Staff</option>
                      <option value="admin-staff-and-coaches">Admin, Staff, and Coaches</option>
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Commercial Model</span>
                    <select
                      value={teamForm.commercialConfig.commercialModel}
                      onChange={(event) => handleTeamCommercialFieldChange('commercialModel', event.target.value as PulseCheckTeamCommercialModel)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400"
                    >
                      {TEAM_COMMERCIAL_MODEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Team Plan Status</span>
                    <select
                      value={teamForm.commercialConfig.teamPlanStatus}
                      onChange={(event) => handleTeamCommercialFieldChange('teamPlanStatus', event.target.value as PulseCheckTeamPlanStatus)}
                      disabled={teamForm.commercialConfig.commercialModel !== 'team-plan'}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {TEAM_PLAN_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Revenue Recipient Role</span>
                    <select
                      value={teamForm.commercialConfig.revenueRecipientRole}
                      onChange={(event) => handleTeamCommercialFieldChange('revenueRecipientRole', event.target.value as PulseCheckRevenueRecipientRole)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400"
                    >
                      {TEAM_REVENUE_RECIPIENT_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Referral Revenue Share %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      value={teamForm.commercialConfig.referralRevenueSharePct}
                      onChange={(event) => handleTeamCommercialFieldChange('referralRevenueSharePct', event.target.value)}
                      disabled={!teamForm.commercialConfig.referralKickbackEnabled}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Commercial Rules</span>
                    <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-4">
                      <label className="flex items-start gap-3 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={teamForm.commercialConfig.referralKickbackEnabled}
                          onChange={(event) => handleTeamCommercialFieldChange('referralKickbackEnabled', event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-zinc-700 bg-black/20 text-green-400"
                        />
                        <span>
                          Enable referral kickback for athlete-paid subscriptions tied to this team.
                        </span>
                      </label>
                      <div className="mt-3 rounded-xl border border-zinc-800 bg-[#0b1220] px-3 py-3 text-xs leading-6 text-zinc-400">
                        {derivePulseCheckTeamPlanBypass(teamForm.commercialConfig)
                          ? 'Active team plan: athletes invited through this team bypass the paywall and land with team-sponsored access.'
                          : 'Athlete-paid flow: invited athletes remain unsubscribed until they purchase, and any configured referral share stays attached to the team invite attribution.'}
                        {teamForm.commercialConfig.revenueRecipientRole === 'team-admin'
                          ? ' The first redeemed team admin becomes the default revenue recipient unless you set a recipient user explicitly later.'
                          : ''}
                      </div>
                    </div>
                  </label>

                  <div className="space-y-2 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Selected Team Clinical Profile</span>
                    <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3">
                      {selectedClinicianProfile ? (
                        <div className="space-y-1 text-sm text-zinc-300">
                          <p className="font-medium text-white">{selectedClinicianProfile.displayName}</p>
                          <p>
                            Local Profile ID: <span className="text-zinc-400">{selectedClinicianProfile.id}</span>
                          </p>
                          <p>
                            Type: <span className="text-zinc-400">{selectedClinicianProfile.profileType}</span>
                          </p>
                          <p>
                            Organization: <span className="text-zinc-400">{selectedClinicianProfile.organizationName || 'Not set'}</span>
                          </p>
                          <p>
                            Sync status: <span className="text-zinc-400">{selectedClinicianProfile.syncStatus}</span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">
                          No clinician profile connected yet. Use the clinical profile card below before creating the team.
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      Routing rule: athlete-specific provider override later, otherwise fall back to this team default.
                    </p>
                  </div>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Notes</span>
                    <textarea
                      value={teamForm.notes}
                      onChange={(event) => handleTeamFieldChange('notes', event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400"
                      placeholder="Roster scope, staffing notes, or activation assumptions."
                    />
                  </label>

                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={teamSubmitting || organizations.length === 0}
                      className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {teamSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users2 className="h-4 w-4" />}
                      {teamSubmitting ? 'Creating Team...' : 'Create Team'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
                <div className="mb-5 flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-cyan-300" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">Create Pilot</h2>
                    <p className="text-sm text-zinc-400">Internal-only pilot layer inside a team for study posture, checkpoints, and rollout structure.</p>
                  </div>
                </div>

                <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleCreatePilot}>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Team</span>
                    <select
                      value={pilotForm.teamId}
                      onChange={(event) => handlePilotFieldChange('teamId', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                    >
                      <option value="">Select a team</option>
                      {teams.map((team) => {
                        const organization = organizations.find((item) => item.id === team.organizationId);
                        return (
                          <option key={team.id} value={team.id}>
                            {organization ? `${organization.displayName} -> ${team.displayName}` : team.displayName}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Pilot Name</span>
                    <input
                      value={pilotForm.name}
                      onChange={(event) => handlePilotFieldChange('name', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                      placeholder="Spring Pilot 2026"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Study Mode</span>
                    <select
                      value={pilotForm.studyMode}
                      onChange={(event) => handlePilotFieldChange('studyMode', event.target.value as PulseCheckPilotStudyMode)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                    >
                      {PILOT_STUDY_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Checkpoint Cadence</span>
                    <select
                      value={pilotForm.checkpointCadence || 'weekly'}
                      onChange={(event) => handlePilotFieldChange('checkpointCadence', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                    >
                      {CHECKPOINT_CADENCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Start Date</span>
                    <input
                      type="date"
                      value={pilotStartDate}
                      onChange={(event) => setPilotStartDate(event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Pilot Length</span>
                    <select
                      value={pilotDurationPreset}
                      onChange={(event) => setPilotDurationPreset(event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                    >
                      {PILOT_DURATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {pilotDurationPreset === 'custom' ? (
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Custom Days</span>
                      <input
                        type="number"
                        min={1}
                        value={pilotCustomDays}
                        onChange={(event) => setPilotCustomDays(event.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                        placeholder="21"
                      />
                    </label>
                  ) : null}

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Objective</span>
                    <textarea
                      value={pilotForm.objective || ''}
                      onChange={(event) => handlePilotFieldChange('objective', event.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                      placeholder="Why this pilot exists, what it is measuring, and what the team should align around."
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Notes</span>
                    <textarea
                      value={pilotForm.notes || ''}
                      onChange={(event) => handlePilotFieldChange('notes', event.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400"
                      placeholder="Internal study setup notes, staffing assumptions, or rollout constraints."
                    />
                  </label>

                  <div className="md:col-span-2 rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                    {selectedPilotTeam
                      ? `This pilot will attach to ${selectedPilotTeam.displayName} and inherit that team's organization context.`
                      : 'Select a team first. Pilots are nested inside teams rather than replacing the team layer.'}
                  </div>

                  <div className="md:col-span-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] px-4 py-3 text-sm text-zinc-300">
                    New pilots are created in draft. The provisioning view now derives display status from the start date and pilot length:
                    no start date means draft, an active date window means active, and the pilot moves to completed once the derived duration window ends.
                    {pilotStartDate
                      ? ` With the current inputs, the projected end date is ${
                          (() => {
                            const durationDays =
                              pilotDurationPreset === 'custom'
                                ? Number.parseInt(pilotCustomDays, 10)
                                : Number.parseInt(pilotDurationPreset, 10);
                            if (!Number.isFinite(durationDays) || durationDays <= 0) return 'not available';
                            const startAt = new Date(`${pilotStartDate}T00:00:00`);
                            const projectedEnd = new Date(startAt.getTime() + (durationDays - 1) * 24 * 60 * 60 * 1000);
                            return projectedEnd.toLocaleDateString();
                          })()
                        }.`
                      : ''}
                  </div>

                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={pilotSubmitting || teams.length === 0}
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pilotSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                      {pilotSubmitting ? 'Creating Pilot...' : 'Create Pilot'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
                <div className="mb-5 flex items-center gap-3">
                  <Clipboard className="h-5 w-5 text-fuchsia-300" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">Create Cohort</h2>
                    <p className="text-sm text-zinc-400">Subgroup layer inside a pilot for reporting, experimentation, or differentiated programming.</p>
                  </div>
                </div>

                <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleCreateCohort}>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Pilot</span>
                    <select
                      value={cohortForm.pilotId}
                      onChange={(event) => handleCohortFieldChange('pilotId', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-fuchsia-400"
                    >
                      <option value="">Select a pilot</option>
                      {pilots.map((pilot) => {
                        const team = teams.find((item) => item.id === pilot.teamId);
                        return (
                          <option key={pilot.id} value={pilot.id}>
                            {team ? `${team.displayName} -> ${pilot.name}` : pilot.name}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Cohort Name</span>
                    <input
                      value={cohortForm.name}
                      onChange={(event) => handleCohortFieldChange('name', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-fuchsia-400"
                      placeholder="Intervention Group"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Cohort Type</span>
                    <select
                      value={cohortForm.cohortType || 'intervention-group'}
                      onChange={(event) => handleCohortFieldChange('cohortType', event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-fuchsia-400"
                    >
                      {COHORT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Reporting Tags</span>
                    <div className="rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 transition focus-within:border-fuchsia-400">
                      <div className="flex flex-wrap items-center gap-2">
                        {(cohortForm.reportingTags || []).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2.5 py-1 text-xs font-medium text-fuchsia-100"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeCohortTag(tag)}
                              className="text-fuchsia-200 transition hover:text-white"
                              aria-label={`Remove ${tag}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        <input
                          value={cohortTagsInput}
                          onChange={(event) => setCohortTagsInput(event.target.value)}
                          onBlur={commitCohortTagsInput}
                          onKeyDown={(event) => {
                            if (event.key === ',' || event.key === 'Enter') {
                              event.preventDefault();
                              commitCohortTagsInput();
                            }
                          }}
                          className="min-w-[180px] flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                          placeholder={(cohortForm.reportingTags || []).length > 0 ? 'Add another tag' : 'control, spring-2026, returners'}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500">Type a tag and press comma or enter to turn it into a chip for reporting, comparisons, or export filters.</p>
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Notes</span>
                    <textarea
                      value={cohortForm.notes || ''}
                      onChange={(event) => handleCohortFieldChange('notes', event.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-fuchsia-400"
                      placeholder="What distinguishes this subgroup and how it should be treated operationally."
                    />
                  </label>

                  <div className="md:col-span-2 rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                    {selectedCohortPilot
                      ? `This cohort will attach to ${selectedCohortPilot.name} inside its parent team. Use cohorts for subgroups inside a pilot, not as a substitute for teams. It will inherit the pilot's current ${getDerivedPilotStatusDisplay(selectedCohortPilot).label.toLowerCase()} state when it is created.`
                      : 'Select a pilot first. Cohorts only exist inside pilots.'}
                  </div>

                  <div className="md:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={cohortSubmitting || pilots.length === 0}
                      className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cohortSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clipboard className="h-4 w-4" />}
                      {cohortSubmitting ? 'Creating Cohort...' : 'Create Cohort'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
                <div className="mb-5 flex items-center gap-3">
                  <Stethoscope className="h-5 w-5 text-purple-300" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">Connect Clinical Profile</h2>
                    <p className="text-sm text-zinc-400">
                      For now, PulseCheck stores clinician profile records locally in Firestore and links the team to that record. These can sync to AuntEdna later once the APIs are available.
                    </p>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setClinicianLinkMode('existing')}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      clinicianLinkMode === 'existing'
                        ? 'border-purple-400 bg-purple-500/[0.12] text-white'
                        : 'border-zinc-800 bg-black/20 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <p className="text-sm font-semibold">Link Existing Profile</p>
                    <p className="mt-1 text-xs text-zinc-400">Search previously saved clinician profiles and attach one to this team.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClinicianLinkMode('create')}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      clinicianLinkMode === 'create'
                        ? 'border-purple-400 bg-purple-500/[0.12] text-white'
                        : 'border-zinc-800 bg-black/20 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <p className="text-sm font-semibold">Create New Profile</p>
                    <p className="mt-1 text-xs text-zinc-400">Create a local clinician profile record now and sync it to AuntEdna later.</p>
                  </button>
                </div>

                {clinicianLinkMode === 'existing' ? (
                  <div className="space-y-4">
                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Search Saved Profiles</span>
                      <input
                        value={clinicianSearchTerm}
                        onChange={(event) => setClinicianSearchTerm(event.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-purple-400"
                        placeholder="Hampton, Carter, provider network..."
                      />
                    </label>

                    <div className="space-y-3">
                      {filteredClinicianProfiles.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-zinc-700 bg-black/10 px-4 py-5 text-sm text-zinc-500">
                          No saved clinician profiles yet. Create one locally to keep moving on provisioning.
                        </div>
                      ) : (
                        filteredClinicianProfiles.map((profile) => {
                          const isSelected = profile.id === teamForm.defaultClinicianProfileId;
                          return (
                            <article
                              key={profile.id}
                              className={`rounded-2xl border p-4 transition ${
                                isSelected ? 'border-purple-400 bg-purple-500/[0.08]' : 'border-zinc-800 bg-black/20'
                              }`}
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-white">{profile.displayName}</p>
                                  <p className="text-xs text-zinc-400">Local profile ID: {profile.id}</p>
                                  <p className="text-xs text-zinc-400">Type: {profile.profileType}</p>
                                  <p className="text-xs text-zinc-400">Organization: {profile.organizationName || 'Not set'}</p>
                                  <p className="text-xs text-zinc-400">Email: {profile.email || 'Not set'}</p>
                                  <p className="text-xs text-zinc-400">Sync status: {profile.syncStatus}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSelectClinicianProfile(profile)}
                                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                                    isSelected
                                      ? 'bg-purple-400 text-black'
                                      : 'bg-zinc-800 text-white hover:bg-zinc-700'
                                  }`}
                                >
                                  {isSelected ? 'Connected' : 'Connect to Team'}
                                </button>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleCreateClinicianProfile}>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Profile Display Name</span>
                      <input
                        value={newClinicianProfileForm.displayName}
                        onChange={(event) =>
                          setNewClinicianProfileForm((current) => ({ ...current, displayName: event.target.value }))
                        }
                        className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-purple-400"
                        placeholder="Hampton Sports Medicine Main"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Profile Type</span>
                      <select
                        value={newClinicianProfileForm.profileType}
                        onChange={(event) =>
                          setNewClinicianProfileForm((current) => ({
                            ...current,
                            profileType: event.target.value as PulseCheckClinicianProfileType,
                          }))
                        }
                        className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-purple-400"
                      >
                        {CLINICIAN_PROFILE_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Organization / Provider</span>
                      <input
                        value={newClinicianProfileForm.organizationName}
                        onChange={(event) =>
                          setNewClinicianProfileForm((current) => ({ ...current, organizationName: event.target.value }))
                        }
                        className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-purple-400"
                        placeholder={selectedOrganization?.displayName || 'Clinical Partner'}
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Contact Email</span>
                      <input
                        type="email"
                        value={newClinicianProfileForm.email}
                        onChange={(event) =>
                          setNewClinicianProfileForm((current) => ({ ...current, email: event.target.value }))
                        }
                        className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-purple-400"
                        placeholder="sportsmed@hampton.edu"
                        required
                      />
                    </label>

                    <div className="md:col-span-2 rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                      Creating a profile here saves the initial bones of the clinician account handoff in PulseCheck, immediately selects it as the team default route, and gives us a record we can sync into AuntEdna later before completing clinician onboarding there through SSO.
                    </div>

                    <div className="md:col-span-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={clinicianSubmitting}
                        className="inline-flex items-center gap-2 rounded-xl bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {clinicianSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldPlus className="h-4 w-4" />}
                        {clinicianSubmitting ? 'Creating Profile...' : 'Create Local Profile and Connect'}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-3xl border border-zinc-800 bg-[#090f1c] p-5">
                <div className="mb-4 flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-purple-300" />
                  <div>
                    <h2 className="text-lg font-semibold text-white">Connected Provisioning Map</h2>
                    <p className="text-sm text-zinc-400">Live org, team, clinician, and activation state shown as one connected hierarchy.</p>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading provisioning graph...
                  </div>
                ) : (
                  <div className="space-y-6">
                    {organizationBundles.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-zinc-700 bg-black/10 px-4 py-5 text-sm text-zinc-500">
                        No organizations created yet.
                      </div>
                    ) : (
                      organizationBundles.map(({ organization, teams: bundledTeams }) => {
                        const orgStatus = getOrganizationStatusDisplay(organization.status);

                        return (
                          <article key={organization.id} className="rounded-[28px] border border-blue-500/15 bg-blue-500/[0.04] p-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.08] p-2.5">
                                    <Building2 className="h-5 w-5 text-blue-300" />
                                  </div>
                                  <div>
                                    <p className="text-lg font-semibold text-white">{organization.displayName}</p>
                                    <p className="text-xs text-zinc-400">{organization.legalName}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 gap-2 text-xs text-zinc-400 md:grid-cols-2">
                                  <p>Type: {organization.organizationType}</p>
                                  <p>Study posture: {organization.defaultStudyPosture}</p>
                                  <p>Clinician routing requirement: {organization.defaultClinicianBridgeMode}</p>
                                  <p>Customer admin: {organization.primaryCustomerAdminEmail || 'Not set'}</p>
                                </div>
                                <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/20 p-4">
                                  <p className="text-xs uppercase tracking-wide text-zinc-500">Organization Invite Artwork</p>
                                  <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                                    <img
                                      src={resolvePulseCheckInvitePreviewImage('', organization.invitePreviewImageUrl)}
                                      alt={`${organization.displayName} invite preview`}
                                      className="h-20 w-32 rounded-xl object-cover"
                                    />
                                    <div className="space-y-2">
                                      <p className="text-xs text-zinc-400">
                                        This image is used by default for invite previews when a team does not have its own image yet.
                                      </p>
                                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-400/30 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:border-blue-300 hover:text-white">
                                        {organizationImageUploadingId === organization.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5" />}
                                        {organizationImageUploadingId === organization.id ? 'Uploading...' : 'Upload Organization Image'}
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          disabled={organizationImageUploadingId === organization.id}
                                          onChange={(event) => {
                                            void handleOrganizationInviteImageUpload(organization.id, event.target.files?.[0] || null);
                                            event.currentTarget.value = '';
                                          }}
                                        />
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide ${orgStatus.tone}`}>
                                {orgStatus.label}
                              </span>
                            </div>

                            <div className="mt-5 space-y-4 border-l border-zinc-800/80 pl-4 md:pl-6">
                              {bundledTeams.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-zinc-700 bg-black/10 px-4 py-5 text-sm text-zinc-500">
                                  No teams attached yet.
                                </div>
                              ) : (
                                bundledTeams.map(({ team, pilots: bundledPilots, clinicianProfile, adminActivationLinks, clinicianOnboardingLink }) => {
                                  const teamStatus = getTeamStatusDisplay(team.status);
                                  const teamCommercialDraft = teamCommercialDrafts[team.id] || team.commercialConfig;
                                  const teamPlanBypassesPaywall = derivePulseCheckTeamPlanBypass(teamCommercialDraft);

                                  return (
                                    <div key={team.id} className="relative rounded-3xl border border-zinc-800 bg-black/20 p-4">
                                      <div className="absolute -left-[31px] top-8 hidden h-px w-5 bg-zinc-800 md:block" />
                                      <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                          <div>
                                            <div className="flex items-center gap-3">
                                              <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.08] p-2">
                                                <Users2 className="h-4 w-4 text-green-300" />
                                              </div>
                                              <div>
                                                <p className="text-base font-semibold text-white">{team.displayName}</p>
                                                <p className="text-xs text-zinc-400">
                                                  {team.teamType} · {team.sportOrProgram}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-400 md:grid-cols-2">
                                              <p>Invite policy: {team.defaultInvitePolicy}</p>
                                              <p>Default admin: {team.defaultAdminEmail || 'Not set'}</p>
                                              <p>Site / campus: {team.siteLabel || 'Not set'}</p>
                                              <p>Created: {formatTimestamp(team.createdAt)}</p>
                                            </div>
                                            <div className="mt-4 rounded-2xl border border-zinc-800 bg-[#0b1220] p-4">
                                              <p className="text-xs uppercase tracking-wide text-zinc-500">Pilot Invite Artwork</p>
                                              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                                                <img
                                                  src={resolvePulseCheckInvitePreviewImage(team.invitePreviewImageUrl, organization.invitePreviewImageUrl)}
                                                  alt={`${team.displayName} invite preview`}
                                                  className="h-20 w-32 rounded-xl object-cover"
                                                />
                                                <div className="space-y-2">
                                                  <p className="text-xs text-zinc-400">
                                                    {team.invitePreviewImageUrl
                                                      ? 'This team image will be used for pilot and athlete invite previews.'
                                                      : 'This team currently inherits the organization image for invite previews. Upload a team image to override it.'}
                                                  </p>
                                                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-green-400/30 px-3 py-2 text-xs font-semibold text-green-100 transition hover:border-green-300 hover:text-white">
                                                    {teamImageUploadingId === team.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users2 className="h-3.5 w-3.5" />}
                                                    {teamImageUploadingId === team.id ? 'Uploading...' : 'Upload Team Image'}
                                                    <input
                                                      type="file"
                                                      accept="image/*"
                                                      className="hidden"
                                                      disabled={teamImageUploadingId === team.id}
                                                      onChange={(event) => {
                                                        void handleTeamInviteImageUpload(team.id, event.target.files?.[0] || null);
                                                        event.currentTarget.value = '';
                                                      }}
                                                    />
                                                  </label>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="mt-4 rounded-2xl border border-green-500/20 bg-green-500/[0.05] p-4">
                                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                <div>
                                                  <p className="text-xs uppercase tracking-wide text-zinc-500">Team Commercial Config</p>
                                                  <p className="mt-2 text-sm text-zinc-300">
                                                    Control whether this team uses athlete-paid access or an active team plan, and where referral revenue should route.
                                                  </p>
                                                </div>
                                                <div className="rounded-full border border-zinc-700 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-wide text-zinc-400">
                                                  {teamPlanBypassesPaywall ? 'Team Plan Active' : 'Athlete-Paid Access'}
                                                </div>
                                              </div>

                                              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <label className="space-y-2">
                                                  <span className="text-[11px] uppercase tracking-wide text-zinc-500">Commercial Model</span>
                                                  <select
                                                    value={teamCommercialDraft.commercialModel}
                                                    onChange={(event) =>
                                                      handleExistingTeamCommercialFieldChange(
                                                        team.id,
                                                        'commercialModel',
                                                        event.target.value as PulseCheckTeamCommercialModel
                                                      )
                                                    }
                                                    className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400"
                                                  >
                                                    {TEAM_COMMERCIAL_MODEL_OPTIONS.map((option) => (
                                                      <option key={option.value} value={option.value}>
                                                        {option.label}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </label>

                                                <label className="space-y-2">
                                                  <span className="text-[11px] uppercase tracking-wide text-zinc-500">Team Plan Status</span>
                                                  <select
                                                    value={teamCommercialDraft.teamPlanStatus}
                                                    onChange={(event) =>
                                                      handleExistingTeamCommercialFieldChange(
                                                        team.id,
                                                        'teamPlanStatus',
                                                        event.target.value as PulseCheckTeamPlanStatus
                                                      )
                                                    }
                                                    disabled={teamCommercialDraft.commercialModel !== 'team-plan'}
                                                    className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400 disabled:cursor-not-allowed disabled:opacity-60"
                                                  >
                                                    {TEAM_PLAN_STATUS_OPTIONS.map((option) => (
                                                      <option key={option.value} value={option.value}>
                                                        {option.label}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </label>

                                                <label className="space-y-2">
                                                  <span className="text-[11px] uppercase tracking-wide text-zinc-500">Revenue Recipient Role</span>
                                                  <select
                                                    value={teamCommercialDraft.revenueRecipientRole}
                                                    onChange={(event) =>
                                                      handleExistingTeamCommercialFieldChange(
                                                        team.id,
                                                        'revenueRecipientRole',
                                                        event.target.value as PulseCheckRevenueRecipientRole
                                                      )
                                                    }
                                                    className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400"
                                                  >
                                                    {TEAM_REVENUE_RECIPIENT_ROLE_OPTIONS.map((option) => (
                                                      <option key={option.value} value={option.value}>
                                                        {option.label}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </label>

                                                <label className="space-y-2">
                                                  <span className="text-[11px] uppercase tracking-wide text-zinc-500">Referral Revenue Share %</span>
                                                  <input
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step="0.5"
                                                    value={teamCommercialDraft.referralRevenueSharePct}
                                                    onChange={(event) =>
                                                      handleExistingTeamCommercialFieldChange(
                                                        team.id,
                                                        'referralRevenueSharePct',
                                                        event.target.value
                                                      )
                                                    }
                                                    disabled={!teamCommercialDraft.referralKickbackEnabled}
                                                    className="w-full rounded-xl border border-zinc-700 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-green-400 disabled:cursor-not-allowed disabled:opacity-60"
                                                  />
                                                </label>
                                              </div>

                                              <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/20 px-4 py-4">
                                                <label className="flex items-start gap-3 text-sm text-zinc-300">
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
                                                    className="mt-1 h-4 w-4 rounded border-zinc-700 bg-black/20 text-green-400"
                                                  />
                                                  <span>
                                                    Enable referral kickback for athlete-paid subscriptions that originate from this team.
                                                  </span>
                                                </label>
                                                <p className="mt-3 text-xs leading-6 text-zinc-400">
                                                  {teamPlanBypassesPaywall
                                                    ? 'Active team plan: athletes invited through this team bypass checkout and land with team-sponsored access.'
                                                    : 'Athlete-paid flow: invited athletes keep team attribution when they purchase later, and the configured revenue share can route back to this team.'}
                                                  {teamCommercialDraft.revenueRecipientRole === 'team-admin'
                                                    ? ' The first redeemed team admin remains the default revenue recipient until you intentionally override it later.'
                                                    : ''}
                                                </p>
                                              </div>

                                              <div className="mt-4 flex justify-end">
                                                <button
                                                  type="button"
                                                  onClick={() => void handleSaveTeamCommercialConfig(team)}
                                                  disabled={teamCommercialSavingId === team.id}
                                                  className="inline-flex items-center gap-2 rounded-xl border border-green-400/30 px-4 py-2 text-sm font-semibold text-green-100 transition hover:border-green-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                  {teamCommercialSavingId === team.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                  ) : (
                                                    <Sparkles className="h-4 w-4" />
                                                  )}
                                                  {teamCommercialSavingId === team.id ? 'Saving...' : 'Save Commercial Config'}
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide ${teamStatus.tone}`}>
                                            {teamStatus.label}
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_auto_minmax(0,1.1fr)] xl:items-stretch">
                                          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4">
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="flex items-center gap-2">
                                                <Stethoscope className="h-4 w-4 text-purple-300" />
                                                <p className="text-sm font-semibold text-white">AuntEdna Clinician Onboarding</p>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  clinicianProfile
                                                    ? handleOpenOnboardingModal({
                                                        channel: 'clinician',
                                                        organization,
                                                        team,
                                                        clinicianProfile,
                                                      })
                                                    : undefined
                                                }
                                                disabled={!clinicianProfile}
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-purple-400/30 px-3 py-2 text-[11px] font-semibold text-purple-100 transition hover:border-purple-300 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
                                              >
                                                <MailPlus className="h-3.5 w-3.5" />
                                                Send Onboarding Link
                                              </button>
                                            </div>
                                            {clinicianProfile ? (
                                              <div className="mt-3 space-y-2 text-xs text-zinc-300">
                                                <p className="font-medium text-white">{clinicianProfile.displayName}</p>
                                                <p>{clinicianProfile.profileType} · {clinicianProfile.syncStatus}</p>
                                                <p>{clinicianProfile.email || 'No email set'}</p>
                                                <p>{clinicianProfile.organizationName || 'No organization label'}</p>
                                                {clinicianOnboardingLink ? (
                                                  <div className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-3">
                                                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Active clinician link</p>
                                                    <p className="mt-1 truncate text-xs text-white">{clinicianOnboardingLink.activationUrl}</p>
                                                  </div>
                                                ) : (
                                                  <p className="text-[11px] text-zinc-500">
                                                    No clinician onboarding link created yet.
                                                  </p>
                                                )}
                                              </div>
                                            ) : (
                                              <p className="mt-3 text-xs text-zinc-500">No clinician profile connected yet.</p>
                                            )}
                                          </div>

                                          <div className="hidden items-center justify-center xl:flex">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-black/30">
                                              <ArrowRight className="h-4 w-4 text-zinc-500" />
                                            </div>
                                          </div>

                                          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="flex items-center gap-2">
                                                <MailPlus className="h-4 w-4 text-amber-300" />
                                                <p className="text-sm font-semibold text-white">PulseCheck Admin Onboarding</p>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleOpenOnboardingModal({
                                                    channel: 'admin',
                                                    organization,
                                                    team,
                                                    clinicianProfile,
                                                  })
                                                }
                                                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 px-3 py-2 text-[11px] font-semibold text-amber-100 transition hover:border-amber-300 hover:text-white"
                                              >
                                                <MailPlus className="h-3.5 w-3.5" />
                                                Send Onboarding Link
                                              </button>
                                            </div>
                                            {adminActivationLinks.length > 0 ? (
                                              <div className="mt-3 space-y-3">
                                                <div className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-3">
                                                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Active admin links</p>
                                                  <p className="mt-1 text-sm font-medium text-white">{adminActivationLinks.length}</p>
                                                  <div className="mt-2 space-y-1">
                                                    {adminActivationLinks.slice(0, 3).map((link) => (
                                                      <p key={link.token} className="truncate text-[11px] text-zinc-400">
                                                        {link.targetEmail || 'No email set'}
                                                      </p>
                                                    ))}
                                                  </div>
                                                </div>
                                                <p className="text-[11px] text-zinc-500">
                                                  Once redeemed, this should make the first external user the org admin and initial team admin.
                                                </p>
                                                <p className="text-[11px] text-zinc-600">
                                                  Regenerating a link for the same admin email revokes the prior link for that recipient.
                                                </p>
                                              </div>
                                            ) : (
                                              <div className="mt-3 space-y-3">
                                                <p className="text-xs text-zinc-400">
                                                  No admin onboarding link has been issued yet. Open the onboarding modal to generate a unique handoff link, copy it, or draft the email.
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-4">
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                              <ClipboardList className="h-4 w-4 text-cyan-300" />
                                              <p className="text-sm font-semibold text-white">Pilot and Cohort Structure</p>
                                            </div>
                                            <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                                              {bundledPilots.length} pilot{bundledPilots.length === 1 ? '' : 's'}
                                            </span>
                                          </div>

                                          {bundledPilots.length === 0 ? (
                                            <p className="mt-3 text-xs text-zinc-500">No pilots created for this team yet.</p>
                                          ) : (
                                            <div className="mt-3 space-y-3">
                                              {bundledPilots.map(({ pilot, cohorts }) => {
                                                const pilotStatus = getDerivedPilotStatusDisplay(pilot);
                                                return (
                                                  <div key={pilot.id} className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                      <div>
                                                        <div className="flex items-center gap-2">
                                                          <p className="text-sm font-semibold text-white">{pilot.name}</p>
                                                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${pilotStatus.tone}`}>
                                                            {pilotStatus.label}
                                                          </span>
                                                        </div>
                                                        <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-zinc-400 md:grid-cols-2">
                                                          <p>Study mode: {pilot.studyMode}</p>
                                                          <p>Checkpoint cadence: {pilot.checkpointCadence || 'Not set'}</p>
                                                          <p>Starts: {toDateValue(pilot.startAt)?.toLocaleDateString() || 'Not set'}</p>
                                                          <p>Ends: {toDateValue(pilot.endAt)?.toLocaleDateString() || 'Not set'}</p>
                                                          <p>Owner: {pilot.ownerInternalEmail || 'Not set'}</p>
                                                          <p>Created: {formatTimestamp(pilot.createdAt)}</p>
                                                        </div>
                                                        {pilot.objective ? (
                                                          <p className="mt-3 text-xs leading-6 text-zinc-300">{pilot.objective}</p>
                                                        ) : null}
                                                      </div>
                                                      <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                                                        {cohorts.length} cohort{cohorts.length === 1 ? '' : 's'}
                                                      </span>
                                                    </div>

                                                    {cohorts.length === 0 ? (
                                                      <p className="mt-3 text-xs text-zinc-500">No cohorts attached yet.</p>
                                                    ) : (
                                                      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                                                        {cohorts.map((cohort) => {
                                                          const cohortStatus = getCohortStatusDisplay(cohort.status);
                                                          const cohortInviteLinks = athleteInviteLinksByCohortId.get(cohort.id) || [];
                                                          const activeCohortInvite = cohortInviteLinks[0] || null;
                                                          return (
                                                            <div key={cohort.id} className="rounded-2xl border border-fuchsia-500/15 bg-fuchsia-500/[0.05] p-3">
                                                              <div className="flex items-center justify-between gap-2">
                                                                <p className="text-sm font-medium text-white">{cohort.name}</p>
                                                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cohortStatus.tone}`}>
                                                                  {cohortStatus.label}
                                                                </span>
                                                              </div>
                                                              <div className="mt-2 space-y-1 text-xs text-zinc-400">
                                                                <p>Type: {getCohortTypeLabel(cohort.cohortType)}</p>
                                                                <p>Assignment: {getCohortAssignmentRuleLabel(cohort.assignmentRule)}</p>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                  {cohort.reportingTags && cohort.reportingTags.length > 0 ? (
                                                                    cohort.reportingTags.map((tag) => (
                                                                      <span
                                                                        key={tag}
                                                                        className="inline-flex rounded-full border border-fuchsia-400/20 bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-fuchsia-100"
                                                                      >
                                                                        {tag}
                                                                      </span>
                                                                    ))
                                                                  ) : (
                                                                    <span>Tags: None</span>
                                                                  )}
                                                                </div>
                                                              </div>
                                                              <div className="mt-3 rounded-xl border border-zinc-800 bg-black/20 p-3">
                                                                <div className="flex items-center justify-between gap-3">
                                                                  <div>
                                                                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">Cohort Athlete Invite</p>
                                                                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                                                                      Athletes using this link join the team and are automatically placed into this cohort. Team athlete links without cohort context only add them to the team.
                                                                    </p>
                                                                  </div>
                                                                  <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                      activeCohortInvite
                                                                        ? handleCopyInviteLink(activeCohortInvite.activationUrl, 'Cohort athlete invite copied to clipboard.')
                                                                        : handleCreateCohortInviteLink(pilot, cohort)
                                                                    }
                                                                    disabled={cohortInviteCreatingId === cohort.id}
                                                                    className="inline-flex items-center gap-1.5 rounded-xl border border-fuchsia-400/30 px-3 py-2 text-[11px] font-semibold text-fuchsia-100 transition hover:border-fuchsia-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                                                  >
                                                                    {cohortInviteCreatingId === cohort.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clipboard className="h-3.5 w-3.5" />}
                                                                    {cohortInviteCreatingId === cohort.id
                                                                      ? 'Creating...'
                                                                      : activeCohortInvite
                                                                        ? 'Copy Invite Link'
                                                                        : 'Create Invite Link'}
                                                                  </button>
                                                                </div>
                                                                {activeCohortInvite ? (
                                                                  <div className="mt-3 rounded-xl border border-zinc-800 bg-[#090f1c] px-3 py-3">
                                                                    <p className="truncate text-xs text-white">{activeCohortInvite.activationUrl}</p>
                                                                    <div className="mt-2 flex items-center gap-2">
                                                                      <button
                                                                        type="button"
                                                                        onClick={() => handleCopyInviteLink(activeCohortInvite.activationUrl, 'Cohort athlete invite copied to clipboard.')}
                                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:border-zinc-500"
                                                                      >
                                                                        <Clipboard className="h-3.5 w-3.5" />
                                                                        Copy
                                                                      </button>
                                                                      <a
                                                                        href={activeCohortInvite.activationUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:border-zinc-500"
                                                                      >
                                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                                        Open
                                                                      </a>
                                                                    </div>
                                                                  </div>
                                                                ) : (
                                                                  <p className="mt-3 text-xs text-zinc-500">No cohort-specific athlete invite has been created yet.</p>
                                                                )}
                                                              </div>
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                )}
              </section>
            </div>
          </main>

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
