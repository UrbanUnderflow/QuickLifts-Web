import type { NextApiRequest, NextApiResponse } from 'next';
import { getRecallAiApiKey, getRecallAiBaseUrl } from '../../../lib/noraNotetakerProviderSecrets';

type SyncBotRequest = {
  meetingId?: string;
  providerBotId?: string;
};

type VerifiedSimpBudgetUser = {
  uid: string;
  email: string;
};

const SIMPBUDGET_FIREBASE_API_KEY =
  process.env.SIMPBUDGET_FIREBASE_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SIMPBUDGET_FIREBASE_API_KEY?.trim() ||
  'AIzaSyCBoCQ4J9xoIhZuaUjFMPq_zltkXDQ_0e8';

const cleanText = (value: unknown, maxLength = 500) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const cleanEmail = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const verifySimpBudgetAuth = async (authHeader: string | undefined): Promise<VerifiedSimpBudgetUser | null> => {
  if (!authHeader?.startsWith('Bearer ') || !SIMPBUDGET_FIREBASE_API_KEY) return null;
  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken) return null;

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${SIMPBUDGET_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    const user = data?.users?.[0];
    const uid = typeof user?.localId === 'string' ? user.localId : '';
    const email = cleanEmail(user?.email);
    return uid && email ? { uid, email } : null;
  } catch (error) {
    console.error('[nora-notetaker-sync-bot] Auth verification error:', error);
    return null;
  }
};

const recallFetch = async (path: string, recallApiKey: string) => {
  const response = await fetch(`${getRecallAiBaseUrl()}${path}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: recallApiKey,
    },
  });
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  return { response, text, payload };
};

const flattenTranscriptText = (payload: unknown): string => {
  if (typeof payload === 'string') return payload.trim();
  if (!payload || typeof payload !== 'object') return '';

  const data = payload as Record<string, any>;
  const candidates = [
    data.transcript,
    data.text,
    data.words,
    data.segments,
    data.utterances,
    data.results,
    data.data,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (Array.isArray(candidate)) {
      const lines = candidate
        .map((item) => {
          if (typeof item === 'string') return item;
          if (!item || typeof item !== 'object') return '';
          const speaker =
            typeof item.speaker === 'string'
              ? item.speaker
              : typeof item.participant === 'string'
                ? item.participant
                : '';
          const text =
            typeof item.text === 'string'
              ? item.text
              : typeof item.transcript === 'string'
                ? item.transcript
                : typeof item.words === 'string'
                  ? item.words
                  : '';
          return speaker && text ? `${speaker}: ${text}` : text;
        })
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length) return lines.join('\n');
    }
  }

  return '';
};

const downloadTranscript = async (downloadUrl: string) => {
  const response = await fetch(downloadUrl, { method: 'GET' });
  if (!response.ok) return '';
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    return flattenTranscriptText(payload);
  }
  return (await response.text()).trim();
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const verifiedUser = await verifySimpBudgetAuth(req.headers.authorization);
  if (!verifiedUser) {
    return res.status(401).json({ success: false, error: 'Please sign in again.' });
  }

  const body = req.body as SyncBotRequest;
  const meetingId = cleanText(body.meetingId, 180).replace(/[^\w.-]/g, '');
  const providerBotId = cleanText(body.providerBotId, 180);

  if (!meetingId || !providerBotId) {
    return res.status(400).json({ success: false, error: 'A Nora meeting id and provider bot id are required.' });
  }

  try {
    const recallApiKey = await getRecallAiApiKey();
    const botResult = await recallFetch(`/api/v1/bot/${encodeURIComponent(providerBotId)}/`, recallApiKey);
    if (!botResult.response.ok) {
      console.error('[nora-notetaker-sync-bot] Recall bot retrieve failed:', {
        status: botResult.response.status,
        body: botResult.text.slice(0, 600),
      });
      return res.status(502).json({ success: false, error: 'Nora could not retrieve this meeting bot.' });
    }

    const metadata = botResult.payload?.metadata || {};
    if (metadata.ownerUid && metadata.ownerUid !== verifiedUser.uid) {
      return res.status(403).json({ success: false, error: 'This Nora bot belongs to a different account.' });
    }
    if (metadata.meetingId && metadata.meetingId !== meetingId) {
      return res.status(403).json({ success: false, error: 'This Nora bot belongs to a different meeting.' });
    }

    const recordings = Array.isArray(botResult.payload?.recordings) ? botResult.payload.recordings : [];
    const recording = recordings.find((candidate: any) => typeof candidate?.id === 'string') || null;
    const recordingId = typeof recording?.id === 'string' ? recording.id : '';
    const latestStatus = Array.isArray(botResult.payload?.status_changes)
      ? botResult.payload.status_changes[botResult.payload.status_changes.length - 1]
      : null;

    if (!recordingId) {
      return res.status(200).json({
        success: true,
        provider: 'recall.ai',
        providerBotId,
        providerStatus: latestStatus?.code || 'queued',
        transcriptStatus: 'not-ready',
        rawTranscript: '',
      });
    }

    const transcriptResult = await recallFetch(
      `/api/v1/transcript/?recording_id=${encodeURIComponent(recordingId)}&status_code=done`,
      recallApiKey,
    );
    if (!transcriptResult.response.ok) {
      return res.status(200).json({
        success: true,
        provider: 'recall.ai',
        providerBotId,
        providerRecordingId: recordingId,
        providerStatus: latestStatus?.code || 'recording',
        transcriptStatus: 'not-ready',
        rawTranscript: '',
      });
    }

    const transcript = Array.isArray(transcriptResult.payload?.results)
      ? transcriptResult.payload.results.find((candidate: any) => candidate?.data?.download_url)
      : null;
    const transcriptId = typeof transcript?.id === 'string' ? transcript.id : '';
    const downloadUrl = typeof transcript?.data?.download_url === 'string' ? transcript.data.download_url : '';
    const rawTranscript = downloadUrl ? await downloadTranscript(downloadUrl) : '';

    return res.status(200).json({
      success: true,
      provider: 'recall.ai',
      providerBotId,
      providerRecordingId: recordingId,
      providerTranscriptId: transcriptId,
      providerStatus: latestStatus?.code || 'done',
      transcriptStatus: rawTranscript ? 'done' : 'not-ready',
      rawTranscript,
    });
  } catch (error) {
    console.error('[nora-notetaker-sync-bot] Recall request failed:', error);
    const message = error instanceof Error ? error.message : '';
    const isSecretError = /secret manager|secret|credential|access token|permission/i.test(message);
    return res.status(isSecretError ? 501 : 502).json({
      success: false,
      error: isSecretError
        ? 'Nora meeting bot credentials are not available to this server yet.'
        : 'Nora could not sync this meeting bot.',
    });
  }
}
