import type { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../api/firebase/config';
import type { Partner, PartnerType, PartnerFirestoreData } from '../../../../server/models/partners';
import { PartnerModel } from '../../../../server/models/partners';
import { getPlaybookForType } from '../../../../server/partners/playbookConfig';

// Basic runtime validation helpers for this handler (steps 2–4)
const ALLOWED_TYPES: PartnerType[] = ['brand', 'gym', 'runClub'];

function isValidPartnerType(value: any): value is PartnerType {
  return typeof value === 'string' && ALLOWED_TYPES.includes(value as PartnerType);
}

function isValidEmail(email: any): email is string {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (!trimmed) return false;
  // Simple but robust-enough email validation for API input
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

function stageReachedFirstRoundMilestone(stage: string): boolean {
  const normalized = stage.trim().toLowerCase();
  return [
    'first-round-created',
    'first_round_created',
    'first round created',
    'round-created',
    'round_created',
    'round created',
    'active',
    'live',
  ].includes(normalized);
}

interface OnboardPartnerRequestBody {
  id?: string; // optional explicit ID override
  type: PartnerType;
  name: string;
  contactEmail: string;
  onboardingStage: string;
  // When true, marks the moment the first Pulse round has been created for this partner
  firstRoundCreated?: boolean;
}

interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  errors?: { field: string; message: string }[];
}

interface OnboardPartnerResponseBody {
  success: true;
  partnerId: string;
  partner: Partner;
}

function validateOnboardBody(body: any): ValidationResult<OnboardPartnerRequestBody> {
  const errors: { field: string; message: string }[] = [];

  const type = body?.type;
  const name = body?.name;
  const contactEmail = body?.contactEmail;
  const onboardingStage = body?.onboardingStage;
  const id = body?.id;
  const firstRoundCreated = body?.firstRoundCreated;

  if (!isValidPartnerType(type)) {
    errors.push({
      field: 'type',
      message: `Invalid partner type. Expected one of: ${ALLOWED_TYPES.join(', ')}.`,
    });
  }

  if (typeof name !== 'string' || !name.trim()) {
    errors.push({
      field: 'name',
      message: 'name is required and must be a non-empty string.',
    });
  }

  if (!isValidEmail(contactEmail)) {
    errors.push({
      field: 'contactEmail',
      message: 'Invalid contactEmail. Must be a valid email address.',
    });
  }

  if (typeof onboardingStage !== 'string' || !onboardingStage.trim()) {
    errors.push({
      field: 'onboardingStage',
      message: 'onboardingStage is required and must be a non-empty string.',
    });
  }

  if (id != null && typeof id !== 'string') {
    errors.push({
      field: 'id',
      message: 'id, if provided, must be a string.',
    });
  }

  if (firstRoundCreated != null && typeof firstRoundCreated !== 'boolean') {
    errors.push({
      field: 'firstRoundCreated',
      message: 'firstRoundCreated, if provided, must be a boolean.',
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      id,
      type,
      name: name.trim(),
      contactEmail,
      onboardingStage: onboardingStage.trim(),
      firstRoundCreated,
    },
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OnboardPartnerResponseBody | { success: false; error: string; details?: { field: string; message: string }[] }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const validation = validateOnboardBody(req.body);

    if (!validation.valid || !validation.value) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors,
      });
    }

    const { id, type, name, contactEmail, onboardingStage, firstRoundCreated } =
      validation.value;

    const normalizedEmail = contactEmail.trim().toLowerCase();
    const normalizedName = name.trim();

    const normalizedPartner: Pick<Partner, 'id' | 'type' | 'name' | 'contactEmail' | 'onboardingStage'> = {
      id: (id && id.trim()) || normalizedEmail,
      type,
      name: normalizedName,
      contactEmail: normalizedEmail,
      onboardingStage,
    };

    // Determine document ID: prefer explicit id, fall back to normalized email
    const partnerId = normalizedPartner.id;

    const partnerRef = doc(db, 'partners', partnerId);
    const existingSnap = await getDoc(partnerRef);
    const shouldSetFirstRoundCreatedAt =
      Boolean(firstRoundCreated) || stageReachedFirstRoundMilestone(normalizedPartner.onboardingStage);

    const updatePayload: Record<string, any> = {
      type: normalizedPartner.type,
      name: normalizedPartner.name,
      contactEmail: normalizedPartner.contactEmail,
      onboardingStage: normalizedPartner.onboardingStage,
    };

    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as PartnerFirestoreData;

      // Preserve existing invitedAt; do not overwrite on updates
      updatePayload.onboardingStage =
        normalizedPartner.onboardingStage || existingData.onboardingStage || 'invited';

      // Preserve existing playbook if present; do not overwrite on updates
      if (existingData && (existingData as any).playbook) {
        updatePayload.playbook = (existingData as any).playbook;
      }

      // Only set firstRoundCreatedAt once, either from the explicit flag or when the stage reaches the first-round milestone
      if (shouldSetFirstRoundCreatedAt && !existingData.firstRoundCreatedAt) {
        updatePayload.firstRoundCreatedAt = serverTimestamp();
      }
    } else {
      // New partner: attach playbook template based on type
      const playbook = getPlaybookForType(type);
      updatePayload.playbook = {
        type: playbook.type,
        label: playbook.label,
        steps: playbook.steps,
      };

      // New partner: set invitedAt using serverTimestamp so we can measure time-to-active accurately
      updatePayload.onboardingStage = normalizedPartner.onboardingStage;
      updatePayload.invitedAt = serverTimestamp();

      // Optionally set firstRoundCreatedAt on creation from the explicit flag or when the stage already represents first-round completion
      if (shouldSetFirstRoundCreatedAt) {
        updatePayload.firstRoundCreatedAt = serverTimestamp();
      }
    }

    await setDoc(partnerRef, updatePayload, { merge: true });

    // Re-read the document so timestamps come back as Firestore Timestamp objects
    const finalSnap = await getDoc(partnerRef);
    const finalData = finalSnap.data() as PartnerFirestoreData;
    const model = new PartnerModel(partnerId, finalData);

    return res.status(200).json({
      success: true,
      partnerId,
      partner: {
        id: model.id,
        type: model.type,
        contactEmail: model.contactEmail,
        onboardingStage: model.onboardingStage,
        invitedAt: model.invitedAt,
        firstRoundCreatedAt: model.firstRoundCreatedAt ?? null,
        // Expose playbook snapshot as part of the response when present
        playbook: (finalData as any).playbook ?? null,
      },
    });
  } catch (error) {
    console.error('Error in /api/partners/onboard:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal Server Error',
      success: false,
    });
  }
}
