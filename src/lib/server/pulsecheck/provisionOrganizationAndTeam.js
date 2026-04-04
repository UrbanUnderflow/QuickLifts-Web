const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const ORGANIZATION_MEMBERSHIPS_COLLECTION = 'pulsecheck-organization-memberships';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function slugify(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((entry) => normalizeString(entry)).filter(Boolean)));
}

function normalizeRevenueRecipientRole(value) {
  const normalized = normalizeString(value);
  if (normalized === 'coach' || normalized === 'organization-owner') {
    return normalized;
  }
  return 'team-admin';
}

function normalizeReferralRevenueSharePct(value) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed * 100) / 100));
}

function normalizeTeamCommercialConfig(value) {
  const candidate = value && typeof value === 'object' ? value : {};
  const commercialModel = normalizeString(candidate.commercialModel);
  const teamPlanStatus = normalizeString(candidate.teamPlanStatus);

  return {
    commercialModel: commercialModel === 'team-plan' ? 'team-plan' : 'athlete-pay',
    teamPlanStatus: teamPlanStatus === 'active' ? 'active' : 'inactive',
    referralKickbackEnabled: Boolean(candidate.referralKickbackEnabled),
    referralRevenueSharePct: normalizeReferralRevenueSharePct(candidate.referralRevenueSharePct),
    revenueRecipientRole: normalizeRevenueRecipientRole(candidate.revenueRecipientRole),
    revenueRecipientUserId: normalizeString(candidate.revenueRecipientUserId),
    billingOwnerUserId: normalizeString(candidate.billingOwnerUserId),
    billingCustomerId: normalizeString(candidate.billingCustomerId),
    teamPlanActivatedAt: candidate.teamPlanActivatedAt || null,
    teamPlanExpiresAt: candidate.teamPlanExpiresAt || null,
  };
}

function normalizeOrganizationImplementationMetadata(value, actorLabel) {
  const candidate = value && typeof value === 'object' ? value : {};
  const provisioningPath = normalizeString(candidate.provisioningPath);
  const ownerContactStatus = normalizeString(candidate.ownerContactStatus);

  return {
    provisioningPath:
      provisioningPath === 'legacy-coach-roster'
        ? 'legacy-coach-roster'
        : provisioningPath === 'manual'
          ? 'manual'
          : 'pulsecheck-hierarchy',
    legacySignupPathUsed: Boolean(candidate.legacySignupPathUsed),
    canaryTarget: Boolean(candidate.canaryTarget),
    selectedTargetLeadId: normalizeString(candidate.selectedTargetLeadId),
    selectedTargetEvidenceIds: uniqueStrings(candidate.selectedTargetEvidenceIds),
    sourceBriefPath: normalizeString(candidate.sourceBriefPath),
    firstPlannedTeamName: normalizeString(candidate.firstPlannedTeamName),
    ownerContactStatus:
      ownerContactStatus === 'confirmed'
        ? 'confirmed'
        : ownerContactStatus === 'unverified'
          ? 'unverified'
          : 'pending-confirmation',
    provisionedBy: normalizeString(candidate.provisionedBy) || actorLabel,
    notes: normalizeString(candidate.notes),
  };
}

function normalizeTeamImplementationMetadata(value, actorLabel, fallbackInvitePosture) {
  const candidate = value && typeof value === 'object' ? value : {};
  const provisioningPath = normalizeString(candidate.provisioningPath);
  const routingDefaultsMode = normalizeString(candidate.routingDefaultsMode);
  const invitePosture = normalizeString(candidate.invitePosture) || fallbackInvitePosture;

  return {
    provisioningPath:
      provisioningPath === 'legacy-coach-roster'
        ? 'legacy-coach-roster'
        : provisioningPath === 'manual'
          ? 'manual'
          : 'pulsecheck-hierarchy',
    legacySignupPathUsed: Boolean(candidate.legacySignupPathUsed),
    canaryTarget: Boolean(candidate.canaryTarget),
    selectedTargetLeadId: normalizeString(candidate.selectedTargetLeadId),
    selectedTargetEvidenceIds: uniqueStrings(candidate.selectedTargetEvidenceIds),
    sourceBriefPath: normalizeString(candidate.sourceBriefPath),
    routingDefaultsMode:
      routingDefaultsMode === 'team-clinician-profile'
        ? 'team-clinician-profile'
        : routingDefaultsMode === 'organization-default-required'
          ? 'organization-default-required'
          : 'organization-default-optional',
    invitePosture:
      invitePosture === 'admin-only'
        ? 'admin-only'
        : invitePosture === 'admin-and-staff'
          ? 'admin-and-staff'
          : 'admin-staff-and-coaches',
    provisionedBy: normalizeString(candidate.provisionedBy) || actorLabel,
    notes: normalizeString(candidate.notes),
  };
}

function buildProvisioningPayload(input) {
  const actorLabel = normalizeString(input.actorLabel) || 'pulsecheck-hierarchy-provisioner';
  const organizationId = normalizeString(input.organization.id) || slugify(input.organization.displayName);
  const teamId = normalizeString(input.team.id) || `${organizationId}--${slugify(input.team.displayName)}`;

  if (!organizationId) throw new Error('organization.id or organization.displayName is required');
  if (!teamId) throw new Error('team.id or team.displayName is required');
  if (!normalizeString(input.organization.displayName)) throw new Error('organization.displayName is required');
  if (!normalizeString(input.team.displayName)) throw new Error('team.displayName is required');
  if (!normalizeString(input.team.teamType)) throw new Error('team.teamType is required');
  if (!normalizeString(input.team.sportOrProgram)) throw new Error('team.sportOrProgram is required');

  const orgImplementationMetadata = normalizeOrganizationImplementationMetadata(
    input.organization.implementationMetadata,
    actorLabel
  );
  const teamImplementationMetadata = normalizeTeamImplementationMetadata(
    input.team.implementationMetadata,
    actorLabel,
    normalizeString(input.team.defaultInvitePolicy) || 'admin-only'
  );

  const organizationPayload = {
    displayName: normalizeString(input.organization.displayName),
    legalName: normalizeString(input.organization.legalName) || normalizeString(input.organization.displayName),
    organizationType: normalizeString(input.organization.organizationType) || 'other',
    invitePreviewImageUrl: normalizeString(input.organization.invitePreviewImageUrl),
    status: normalizeString(input.organization.status) || 'provisioning',
    legacySource: input.organization.legacySource || null,
    legacyCoachId: normalizeString(input.organization.legacyCoachId),
    implementationOwnerUserId: normalizeString(input.organization.implementationOwnerUserId),
    implementationOwnerEmail: normalizeEmail(input.organization.implementationOwnerEmail),
    implementationMetadata: orgImplementationMetadata,
    primaryCustomerAdminName: normalizeString(input.organization.primaryCustomerAdminName),
    primaryCustomerAdminEmail: normalizeEmail(input.organization.primaryCustomerAdminEmail),
    additionalAdminContacts: Array.isArray(input.organization.additionalAdminContacts)
      ? input.organization.additionalAdminContacts
          .map((entry) => ({ name: normalizeString(entry?.name), email: normalizeEmail(entry?.email) }))
          .filter((entry) => entry.email)
      : [],
    defaultStudyPosture: normalizeString(input.organization.defaultStudyPosture) || 'operational',
    defaultClinicianBridgeMode: normalizeString(input.organization.defaultClinicianBridgeMode) || 'none',
    notes: normalizeString(input.organization.notes),
  };

  const teamPayload = {
    organizationId,
    displayName: normalizeString(input.team.displayName),
    teamType: normalizeString(input.team.teamType),
    sportOrProgram: normalizeString(input.team.sportOrProgram),
    invitePreviewImageUrl: normalizeString(input.team.invitePreviewImageUrl),
    legacySource: input.team.legacySource || null,
    legacyCoachId: normalizeString(input.team.legacyCoachId),
    siteLabel: normalizeString(input.team.siteLabel),
    defaultAdminName: normalizeString(input.team.defaultAdminName),
    defaultAdminEmail: normalizeEmail(input.team.defaultAdminEmail),
    status: normalizeString(input.team.status) || 'provisioning',
    defaultInvitePolicy:
      normalizeString(input.team.defaultInvitePolicy) === 'admin-only'
        ? 'admin-only'
        : normalizeString(input.team.defaultInvitePolicy) === 'admin-and-staff'
          ? 'admin-and-staff'
          : 'admin-staff-and-coaches',
    commercialConfig: normalizeTeamCommercialConfig(input.team.commercialConfig),
    defaultClinicianProfileId: normalizeString(input.team.defaultClinicianProfileId),
    defaultClinicianExternalProfileId: normalizeString(input.team.defaultClinicianExternalProfileId),
    defaultClinicianProfileName: normalizeString(input.team.defaultClinicianProfileName),
    defaultClinicianProfileType: normalizeString(input.team.defaultClinicianProfileType) || 'group',
    defaultClinicianProfileSource: normalizeString(input.team.defaultClinicianProfileSource) || 'pulsecheck-local',
    implementationMetadata: teamImplementationMetadata,
    notes: normalizeString(input.team.notes),
  };

  return { actorLabel, organizationId, teamId, organizationPayload, teamPayload };
}

function assertNoLegacyWrite(payload, scopeLabel) {
  if (payload.legacySource || normalizeString(payload.legacyCoachId)) {
    throw new Error(`${scopeLabel} payload must not use legacySource or legacyCoachId for non-legacy hierarchy provisioning.`);
  }
  if (payload.implementationMetadata?.legacySignupPathUsed) {
    throw new Error(`${scopeLabel} payload marks legacy signup as used; non-legacy provisioning must keep this false.`);
  }
  if (payload.implementationMetadata?.provisioningPath === 'legacy-coach-roster') {
    throw new Error(`${scopeLabel} payload points at legacy-coach-roster; use pulsecheck-hierarchy or manual.`);
  }
}

function assertExistingDocCompatible(existing, expected, scopeLabel) {
  if (!existing || typeof existing !== 'object') return;

  if (normalizeString(existing.legacySource) || normalizeString(existing.legacyCoachId)) {
    throw new Error(`${scopeLabel} already exists with legacy linkage and cannot be claimed by the non-legacy provisioner.`);
  }

  const existingPath = normalizeString(existing.implementationMetadata?.provisioningPath);
  if (existingPath === 'legacy-coach-roster') {
    throw new Error(`${scopeLabel} already exists with legacy-coach-roster provisioning metadata.`);
  }

  if (scopeLabel === 'team' && normalizeString(existing.organizationId) !== normalizeString(expected.organizationId)) {
    throw new Error('Existing team is linked to a different organizationId.');
  }
}

function buildCanaryProvisioningInput(params = {}) {
  const actorLabel = normalizeString(params.actorLabel) || 'pulsecheck-canary-provisioner';
  const organizationId = normalizeString(params.organizationId) || 'revival-strength-functional-bodybuilding';
  const teamId = normalizeString(params.teamId) || `${organizationId}--persist`;
  const ownerName = normalizeString(params.ownerName) || 'Marcus Filly';
  const ownerEmail = normalizeEmail(params.ownerEmail);

  return {
    actorLabel,
    organization: {
      id: organizationId,
      displayName: 'Revival Strength / Functional Bodybuilding',
      legalName: 'Revival Strength / Functional Bodybuilding',
      organizationType: 'brand',
      status: 'provisioning',
      primaryCustomerAdminName: ownerName,
      primaryCustomerAdminEmail: ownerEmail,
      defaultStudyPosture: 'operational',
      defaultClinicianBridgeMode: 'optional',
      notes:
        'Canary PulseCheck organization shell for the selected coach-led target. Owner email remains unverified and must be confirmed directly before admin activation is generated or redeemed. Provisioned through the organization-first PulseCheck hierarchy, not the retired legacy coach signup path.',
      implementationMetadata: {
        provisioningPath: 'pulsecheck-hierarchy',
        legacySignupPathUsed: false,
        canaryTarget: true,
        selectedTargetLeadId: 'LEAD-0007',
        selectedTargetEvidenceIds: ['EVID-0004', 'EVID-0005'],
        sourceBriefPath: 'docs/pulsecheck/canary-target-brief.md',
        firstPlannedTeamName: 'Persist',
        ownerContactStatus: ownerEmail ? 'confirmed' : 'pending-confirmation',
        provisionedBy: actorLabel,
        notes: 'Hierarchy-owned canary organization shell. Initial admin membership and activation handoff remain pending.',
      },
    },
    team: {
      id: teamId,
      displayName: 'Persist',
      teamType: 'brand-athlete-group',
      sportOrProgram: 'Coach-led training program',
      siteLabel: 'Functional Bodybuilding / Persist',
      defaultAdminName: ownerName,
      defaultAdminEmail: ownerEmail,
      status: 'provisioning',
      defaultInvitePolicy: 'admin-staff-and-coaches',
      commercialConfig: {
        commercialModel: 'athlete-pay',
        teamPlanStatus: 'inactive',
        referralKickbackEnabled: false,
        referralRevenueSharePct: 0,
        revenueRecipientRole: 'team-admin',
        revenueRecipientUserId: '',
        billingOwnerUserId: '',
        billingCustomerId: '',
        teamPlanActivatedAt: null,
        teamPlanExpiresAt: null,
      },
      defaultClinicianProfileId: '',
      defaultClinicianExternalProfileId: '',
      defaultClinicianProfileName: '',
      defaultClinicianProfileType: 'group',
      defaultClinicianProfileSource: 'pulsecheck-local',
      notes:
        'Canary PulseCheck team shell for the Persist program under Revival Strength / Functional Bodybuilding. Invite posture allows downstream staff and coach onboarding without PulseCheck repair once the first admin is activated. Clinician routing defaults intentionally inherit the organization optional-bridge posture until a concrete clinician profile is attached.',
      implementationMetadata: {
        provisioningPath: 'pulsecheck-hierarchy',
        legacySignupPathUsed: false,
        canaryTarget: true,
        selectedTargetLeadId: 'LEAD-0007',
        selectedTargetEvidenceIds: ['EVID-0004', 'EVID-0005'],
        sourceBriefPath: 'docs/pulsecheck/canary-target-brief.md',
        routingDefaultsMode: 'organization-default-optional',
        invitePosture: 'admin-staff-and-coaches',
        provisionedBy: actorLabel,
        notes: 'Hierarchy-owned initial canary team shell only. Team admin membership and activation handoff remain pending.',
      },
    },
  };
}

async function upsertPulseCheckOrganization({ adminApp, input }) {
  if (!adminApp) {
    throw new Error('adminApp is required');
  }

  const firestore = typeof adminApp.collection === 'function' ? adminApp : getFirestore(adminApp);
  const now = FieldValue.serverTimestamp();
  const actorLabel = normalizeString(input.actorLabel) || 'pulsecheck-organization-provisioner';
  const organizationId = normalizeString(input.organization.id) || slugify(input.organization.displayName);
  if (!organizationId) {
    throw new Error('organization.id or organization.displayName is required');
  }
  if (!normalizeString(input.organization.displayName)) {
    throw new Error('organization.displayName is required');
  }

  const organizationPayload = {
    displayName: normalizeString(input.organization.displayName),
    legalName: normalizeString(input.organization.legalName) || normalizeString(input.organization.displayName),
    organizationType: normalizeString(input.organization.organizationType) || 'other',
    invitePreviewImageUrl: normalizeString(input.organization.invitePreviewImageUrl),
    status: normalizeString(input.organization.status) || 'provisioning',
    legacySource: input.organization.legacySource || null,
    legacyCoachId: normalizeString(input.organization.legacyCoachId),
    implementationOwnerUserId: normalizeString(input.organization.implementationOwnerUserId),
    implementationOwnerEmail: normalizeEmail(input.organization.implementationOwnerEmail),
    implementationMetadata: normalizeOrganizationImplementationMetadata(input.organization.implementationMetadata, actorLabel),
    primaryCustomerAdminName: normalizeString(input.organization.primaryCustomerAdminName),
    primaryCustomerAdminEmail: normalizeEmail(input.organization.primaryCustomerAdminEmail),
    additionalAdminContacts: Array.isArray(input.organization.additionalAdminContacts)
      ? input.organization.additionalAdminContacts
          .map((entry) => ({ name: normalizeString(entry?.name), email: normalizeEmail(entry?.email) }))
          .filter((entry) => entry.email)
      : [],
    defaultStudyPosture: normalizeString(input.organization.defaultStudyPosture) || 'operational',
    defaultClinicianBridgeMode: normalizeString(input.organization.defaultClinicianBridgeMode) || 'none',
    notes: normalizeString(input.organization.notes),
  };

  assertNoLegacyWrite(organizationPayload, 'organization');

  const organizationRef = firestore.collection(ORGANIZATIONS_COLLECTION).doc(organizationId);
  return firestore.runTransaction(async (transaction) => {
    const organizationSnap = await transaction.get(organizationRef);
    const organizationExists = organizationSnap.exists;
    const organizationData = organizationSnap.data() || null;

    assertExistingDocCompatible(organizationData, organizationPayload, 'organization');

    const organizationWrite = {
      ...organizationPayload,
      implementationMetadata: {
        ...organizationPayload.implementationMetadata,
        provisionedAt: organizationData?.implementationMetadata?.provisionedAt || now,
        provisionedBy:
          normalizeString(organizationData?.implementationMetadata?.provisionedBy) ||
          organizationPayload.implementationMetadata.provisionedBy ||
          actorLabel,
      },
      createdAt: organizationData?.createdAt || now,
      updatedAt: now,
    };

    transaction.set(organizationRef, organizationWrite, { merge: true });

    return {
      organizationId,
      organizationCreated: !organizationExists,
      organizationStatus: organizationWrite.status,
      defaultClinicianBridgeMode: organizationWrite.defaultClinicianBridgeMode,
      implementationPath: organizationWrite.implementationMetadata.provisioningPath,
    };
  });
}

async function provisionPulseCheckCanaryOrganization({ adminApp, params = {} }) {
  const input = buildCanaryProvisioningInput(params);
  return upsertPulseCheckOrganization({ adminApp, input });
}

async function provisionPulseCheckOrganizationAndTeam({ adminApp, input }) {
  if (!adminApp) {
    throw new Error('adminApp is required');
  }

  const firestore = typeof adminApp.collection === 'function' ? adminApp : getFirestore(adminApp);
  const now = FieldValue.serverTimestamp();
  const { actorLabel, organizationId, teamId, organizationPayload, teamPayload } = buildProvisioningPayload(input);

  assertNoLegacyWrite(organizationPayload, 'organization');
  assertNoLegacyWrite(teamPayload, 'team');

  const organizationRef = firestore.collection(ORGANIZATIONS_COLLECTION).doc(organizationId);
  const teamRef = firestore.collection(TEAMS_COLLECTION).doc(teamId);

  const result = await firestore.runTransaction(async (transaction) => {
    const [organizationSnap, teamSnap] = await Promise.all([
      transaction.get(organizationRef),
      transaction.get(teamRef),
    ]);

    const organizationExists = organizationSnap.exists;
    const teamExists = teamSnap.exists;
    const organizationData = organizationSnap.data() || null;
    const teamData = teamSnap.data() || null;

    assertExistingDocCompatible(organizationData, organizationPayload, 'organization');
    assertExistingDocCompatible(teamData, teamPayload, 'team');

    const organizationWrite = {
      ...organizationPayload,
      implementationMetadata: {
        ...organizationPayload.implementationMetadata,
        provisionedAt: organizationData?.implementationMetadata?.provisionedAt || now,
        provisionedBy:
          normalizeString(organizationData?.implementationMetadata?.provisionedBy) ||
          organizationPayload.implementationMetadata.provisionedBy ||
          actorLabel,
      },
      createdAt: organizationData?.createdAt || now,
      updatedAt: now,
    };

    const teamWrite = {
      ...teamPayload,
      implementationMetadata: {
        ...teamPayload.implementationMetadata,
        provisionedAt: teamData?.implementationMetadata?.provisionedAt || now,
        provisionedBy:
          normalizeString(teamData?.implementationMetadata?.provisionedBy) ||
          teamPayload.implementationMetadata.provisionedBy ||
          actorLabel,
      },
      createdAt: teamData?.createdAt || now,
      updatedAt: now,
    };

    transaction.set(organizationRef, organizationWrite, { merge: true });
    transaction.set(teamRef, teamWrite, { merge: true });

    return {
      organizationId,
      teamId,
      organizationCreated: !organizationExists,
      teamCreated: !teamExists,
      organizationStatus: organizationWrite.status,
      teamStatus: teamWrite.status,
      teamInvitePolicy: teamWrite.defaultInvitePolicy,
      teamRoutingDefaultsMode: teamWrite.implementationMetadata.routingDefaultsMode,
    };
  });

  return result;
}

function buildReservedAdminPrincipal(input) {
  const ownerName = normalizeString(input.ownerName);
  const ownerEmail = normalizeEmail(input.ownerEmail);
  const handoffKey = normalizeString(input.handoffKey) || slugify(ownerName || ownerEmail || 'external-owner');
  const reservedUserId = `pending-admin:${handoffKey}`;

  return {
    handoffKey,
    reservedUserId,
    ownerName,
    ownerEmail,
  };
}

async function seedInitialPulseCheckAdminHandoff({ adminApp, input }) {
  if (!adminApp) {
    throw new Error('adminApp is required');
  }

  const firestore = typeof adminApp.collection === 'function' ? adminApp : getFirestore(adminApp);
  const now = FieldValue.serverTimestamp();
  const organizationId = normalizeString(input.organizationId);
  const teamId = normalizeString(input.teamId);
  if (!organizationId || !teamId) {
    throw new Error('organizationId and teamId are required');
  }

  const principal = buildReservedAdminPrincipal({
    handoffKey: input.handoffKey,
    ownerName: input.targetOwnerName,
    ownerEmail: input.targetOwnerEmail,
  });
  const actorLabel = normalizeString(input.actorLabel) || 'pulsecheck-admin-handoff-seeder';

  const organizationRef = firestore.collection(ORGANIZATIONS_COLLECTION).doc(organizationId);
  const teamRef = firestore.collection(TEAMS_COLLECTION).doc(teamId);
  const organizationMembershipRef = firestore
    .collection(ORGANIZATION_MEMBERSHIPS_COLLECTION)
    .doc(`${organizationId}_${principal.reservedUserId}`);
  const teamMembershipRef = firestore
    .collection(TEAM_MEMBERSHIPS_COLLECTION)
    .doc(`${teamId}_${principal.reservedUserId}`);

  return firestore.runTransaction(async (transaction) => {
    const [organizationSnap, teamSnap, organizationMembershipSnap, teamMembershipSnap] = await Promise.all([
      transaction.get(organizationRef),
      transaction.get(teamRef),
      transaction.get(organizationMembershipRef),
      transaction.get(teamMembershipRef),
    ]);

    if (!organizationSnap.exists) {
      throw new Error(`Organization not found: ${organizationId}`);
    }
    if (!teamSnap.exists) {
      throw new Error(`Team not found: ${teamId}`);
    }

    const teamData = teamSnap.data() || {};
    if (normalizeString(teamData.organizationId) !== organizationId) {
      throw new Error('Team is linked to a different organizationId.');
    }

    const handoffMetadata = {
      state: 'reserved-pending-activation',
      handoffKey: principal.handoffKey,
      targetOwnerName: principal.ownerName,
      targetOwnerEmail: principal.ownerEmail,
      sourceBriefPath: normalizeString(input.sourceBriefPath),
      selectedTargetLeadId: normalizeString(input.selectedTargetLeadId),
      selectedTargetEvidenceIds: uniqueStrings(input.selectedTargetEvidenceIds),
      reservedBy: actorLabel,
      reservedAt: now,
      notes: normalizeString(input.notes),
    };

    transaction.set(
      organizationMembershipRef,
      {
        organizationId,
        userId: principal.reservedUserId,
        email: principal.ownerEmail,
        role: 'org-admin',
        status: 'active',
        grantedAt: organizationMembershipSnap.exists ? organizationMembershipSnap.data()?.grantedAt || now : now,
        handoffMetadata,
        createdAt: organizationMembershipSnap.exists ? organizationMembershipSnap.data()?.createdAt || now : now,
        updatedAt: now,
      },
      { merge: true }
    );

    transaction.set(
      teamMembershipRef,
      {
        organizationId,
        teamId,
        userId: principal.reservedUserId,
        email: principal.ownerEmail,
        role: 'team-admin',
        title: 'Reserved External Admin',
        permissionSetId: 'pulsecheck-team-admin-v1',
        rosterVisibilityScope: 'team',
        allowedAthleteIds: [],
        onboardingStatus: 'pending-profile',
        grantedAt: teamMembershipSnap.exists ? teamMembershipSnap.data()?.grantedAt || now : now,
        handoffMetadata,
        createdAt: teamMembershipSnap.exists ? teamMembershipSnap.data()?.createdAt || now : now,
        updatedAt: now,
      },
      { merge: true }
    );

    return {
      organizationMembershipId: organizationMembershipRef.id,
      teamMembershipId: teamMembershipRef.id,
      reservedUserId: principal.reservedUserId,
      handoffKey: principal.handoffKey,
      targetOwnerName: principal.ownerName,
      targetOwnerEmail: principal.ownerEmail,
      organizationMembershipCreated: !organizationMembershipSnap.exists,
      teamMembershipCreated: !teamMembershipSnap.exists,
    };
  });
}

module.exports = {
  ORGANIZATIONS_COLLECTION,
  TEAMS_COLLECTION,
  ORGANIZATION_MEMBERSHIPS_COLLECTION,
  TEAM_MEMBERSHIPS_COLLECTION,
  buildCanaryProvisioningInput,
  buildProvisioningPayload,
  provisionPulseCheckCanaryOrganization,
  provisionPulseCheckOrganizationAndTeam,
  seedInitialPulseCheckAdminHandoff,
  slugify,
  upsertPulseCheckOrganization,
};
