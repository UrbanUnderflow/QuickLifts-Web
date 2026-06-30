import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../../lib/firebase-admin';
import {
  getDefaultPulseCheckIntakeForm,
  PULSECHECK_INTAKE_FORM_VERSION,
  type PulseCheckIntakeResponses,
  type SurveyQuestion,
} from '../../../../api/firebase/pulsecheckProvisioning/types';

const COACH_INTAKE_DRAFTS_COLLECTION = 'pulsecheck-coach-intake-drafts';
const TEAMS_COLLECTION = 'pulsecheck-teams';

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const normalizeResponseValue = (value: unknown): string | number | string[] | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(value)) {
    const values = value.map((entry) => normalizeString(entry)).filter(Boolean);
    return values.length > 0 ? values : undefined;
  }
  return undefined;
};
const normalizeIntakeResponses = (value: unknown): PulseCheckIntakeResponses => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<PulseCheckIntakeResponses>((acc, [rawId, rawValue]) => {
    const id = normalizeString(rawId);
    const normalizedValue = normalizeResponseValue(rawValue);
    if (id && normalizedValue !== undefined) {
      acc[id] = normalizedValue;
    }
    return acc;
  }, {});
};
const normalizeQuestionType = (value: unknown): SurveyQuestion['type'] => {
  const normalized = normalizeString(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'multiple_choice' || normalized === 'multiplechoice' || normalized === 'choice' || normalized === 'select') {
    return 'multiple_choice';
  }
  if (normalized === 'number' || normalized === 'numeric') return 'number';
  if (normalized === 'yes_no' || normalized === 'yesno' || normalized === 'boolean') return 'yes_no';
  return 'text';
};
const normalizeSurveyOptions = (value: unknown, questionIndex: number): NonNullable<SurveyQuestion['options']> => {
  if (!Array.isArray(value)) return [];
  return value.reduce<NonNullable<SurveyQuestion['options']>>((options, option, optionIndex) => {
    const candidate = option && typeof option === 'object' ? (option as Record<string, unknown>) : {};
    const optionText =
      typeof option === 'string'
        ? normalizeString(option)
        : normalizeString(candidate.text ?? candidate.label ?? candidate.value ?? candidate.name);
    if (!optionText) return options;
    options.push({
      id: normalizeString(candidate.id) || `option-${questionIndex + 1}-${optionIndex + 1}`,
      text: optionText,
    });
    return options;
  }, []);
};
const normalizeSurveyQuestions = (value: unknown): SurveyQuestion[] => {
  if (!Array.isArray(value)) return [];
  return value.reduce<SurveyQuestion[]>((questions, entry, index) => {
    const question = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const text = normalizeString(question.question);
    if (!text) return questions;
    const rawOptions =
      question.options ??
      question.choices ??
      question.answerOptions ??
      question.optionLabels ??
      question.values ??
      question.answers;
    const options = normalizeSurveyOptions(rawOptions, index);
    const type = options.length > 0 ? 'multiple_choice' : normalizeQuestionType(question.type);

    questions.push({
      id: normalizeString(question.id) || `question-${index + 1}`,
      question: text,
      type,
      required: Boolean(question.required),
      options: options.length > 0 ? options : undefined,
      minValue: typeof question.minValue === 'number' ? question.minValue : undefined,
      maxValue: typeof question.maxValue === 'number' ? question.maxValue : undefined,
    });
    return questions;
  }, []);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = normalizeString(req.query.token);
  if (!token) {
    return res.status(400).json({ error: 'Intake link token is required.' });
  }

  const firestore = admin.firestore();
  const draftRef = firestore.collection(COACH_INTAKE_DRAFTS_COLLECTION).doc(token);

  try {
    if (req.method === 'GET') {
      const draftSnap = await draftRef.get();
      if (!draftSnap.exists) {
        return res.status(404).json({ error: 'Intake link not found.' });
      }

      const draft = draftSnap.data() || {};
      const status = normalizeString(draft.status) || 'active';
      if (status !== 'active' && status !== 'attached') {
        return res.status(409).json({ error: 'This intake link is no longer active.' });
      }

      const teamId = normalizeString(draft.teamId);
      const teamSnap = teamId ? await firestore.collection(TEAMS_COLLECTION).doc(teamId).get() : null;
      const team = teamSnap?.exists ? teamSnap.data() || {} : {};
      const coachIntake = team.intake && typeof team.intake === 'object' ? (team.intake as Record<string, any>).coach : null;
      const savedQuestions = normalizeSurveyQuestions(coachIntake && typeof coachIntake === 'object' ? coachIntake.questions : null);
      const questions = savedQuestions.length > 0 ? savedQuestions : getDefaultPulseCheckIntakeForm('coach').questions;

      return res.status(200).json({
        token,
        status,
        organizationId: normalizeString(draft.organizationId),
        teamId,
        teamName: normalizeString(team.displayName) || 'PulseCheck team',
        targetEmail: normalizeString(draft.targetEmail),
        intakeFormVersion:
          normalizeString(coachIntake && typeof coachIntake === 'object' ? coachIntake.version : '') ||
          normalizeString(draft.intakeFormVersion) ||
          PULSECHECK_INTAKE_FORM_VERSION,
        questions,
        responses: normalizeIntakeResponses(draft.intakeResponses),
      });
    }

    if (req.method === 'PATCH') {
      const draftSnap = await draftRef.get();
      if (!draftSnap.exists) {
        return res.status(404).json({ error: 'Intake link not found.' });
      }

      const draft = draftSnap.data() || {};
      const status = normalizeString(draft.status) || 'active';
      if (status !== 'active' && status !== 'attached') {
        return res.status(409).json({ error: 'This intake link is no longer active.' });
      }

      const nextResponses = normalizeIntakeResponses(req.body?.responses);
      await draftRef.set(
        {
          intakeResponses: nextResponses,
          intakeFormVersion: normalizeString(req.body?.intakeFormVersion) || normalizeString(draft.intakeFormVersion) || PULSECHECK_INTAKE_FORM_VERSION,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return res.status(200).json({ ok: true, responses: nextResponses });
    }

    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('[pulsecheck/intake] Failed to handle intake link:', error);
    return res.status(500).json({ error: 'Failed to load intake link.' });
  }
}
