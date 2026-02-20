import type { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../api/firebase/config';
import type { PartnerType, PartnerFirestoreData } from '../../../types/Partner';
import { PartnerModel } from '../../../types/Partner';

// Basic runtime validation helpers for this handler (step 2/3)
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

interface OnboardPartnerRequestBody {
  id?: string; // optional explicit ID override
  type: PartnerType;
  contactEmail: string;
  onboardingStage?: string;
  // When true, marks the moment the first Pulse round has been created for this partner
  firstRoundCreated?: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { id, type, contactEmail, onboardingStage, firstRoundCreated }: OnboardPartnerRequestBody = req.body || {};

    // Basic input validation
    if (!isValidPartnerType(type)) {
      return res.status(400).json({ error: 'Invalid partner type. Expected one of: brand, gym, runClub.' });
    }

    if (!isValidEmail(contactEmail)) {
      return res.status(400).json({ error: 'Invalid contactEmail. Must be a valid email address.' });
    }

    const normalizedEmail = contactEmail.trim().toLowerCase();

    // Determine document ID: prefer explicit id, fall back to normalized email
    const partnerId = (id && id.trim()) || normalizedEmail;

    const partnerRef = doc(db, 'partners', partnerId);
    const existingSnap = await getDoc(partnerRef);

    const updatePayload: Record<string, any> = {
      type,
      contactEmail: normalizedEmail,
      onboardingStage: onboardingStage || 'invited',
    };

    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as PartnerFirestoreData;

      // Preserve existing invitedAt; do not overwrite on updates
      updatePayload.onboardingStage = onboardingStage || existingData.onboardingStage || 'invited';

      // Only set firstRoundCreatedAt when flag is true AND it hasn't been set before
      if (firstRoundCreated && !existingData.firstRoundCreatedAt) {
        updatePayload.firstRoundCreatedAt = serverTimestamp();
      }
    } else {
      // New partner: set invitedAt using serverTimestamp so we can measure time-to-active accurately
      updatePayload.onboardingStage = onboardingStage || 'invited';
      updatePayload.invitedAt = serverTimestamp();

      // Optionally allow firstRoundCreatedAt on creation if firstRoundCreated is passed
      if (firstRoundCreated) {
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
