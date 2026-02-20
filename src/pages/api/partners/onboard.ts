import type { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../api/firebase/config';
import type { PartnerType, PartnerFirestoreData } from '../../../types/Partner';
import { PartnerModel } from '../../../types/Partner';

// Basic runtime validation helpers for this handler (step 2)
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
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { id, type, contactEmail, onboardingStage }: OnboardPartnerRequestBody = req.body || {};

    // Basic input validation for this step
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

    let firestoreData: PartnerFirestoreData;

    if (existingSnap.exists()) {
      // Update existing partner; preserve invitedAt/firstRoundCreatedAt for now
      const existingData = existingSnap.data() as PartnerFirestoreData;

      firestoreData = {
        ...existingData,
        type,
        contactEmail: normalizedEmail,
        onboardingStage: onboardingStage || existingData.onboardingStage || 'invited',
      };
    } else {
      // Create new partner document; invitedAt will be refined in step 3
      const now = new Date();
      firestoreData = {
        type,
        contactEmail: normalizedEmail,
        onboardingStage: onboardingStage || 'invited',
        invitedAt: now,
        firstRoundCreatedAt: null,
      };
    }

    // Use model to normalize timestamps for storage consistency
    const model = new PartnerModel(partnerId, firestoreData);
    const toSave = model.toDictionary();

    await setDoc(partnerRef, toSave, { merge: true });

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
