// FWP Workout Generation — kickoff
// ----------------------------------------------------------------------------
// Replaces the old hardcoded sets/reps template. The FWP client sends the
// athlete's request + the equipment-filtered candidate catalog; this function
// aggregates EVERYTHING the Pulse ecosystem knows about the athlete (sport,
// competition timing, coach guidance, load tolerance, recent recovery) and hands
// it to a coach-persona model that OWNS the program decision — exercise
// selection AND per-move sets/reps/tempo, periodized to context. There is no
// fixed scheme; a compound near a competition peaks, it doesn't auto-5×8.
//
// Mirrors the proven nora-routine-generation trio (kickoff → background →
// status): rich-context generation runs past the ~10s sync limit, so we queue a
// job and the iOS client polls -status. The background worker forwards the
// request we build here straight to OpenAI.
// ----------------------------------------------------------------------------

import { Handler } from '@netlify/functions';
import { admin, db, headers as corsHeaders } from './config/firebase';
import { makeIncidentId, safeErrorBody, safeErrorResponse } from './utils/safeErrorResponse';
import { buildFwpAthleteContext, renderAthleteContextForPrompt, FwpAthleteContext } from './utils/fwpAthleteContext';

const JOB_COLLECTION = 'fwpWorkoutGenerationJobs';
const GEN_MODEL = 'gpt-5-mini';
const GEN_MAX_COMPLETION_TOKENS = 6000;
const MAX_CANDIDATE_MOVES = 160;

const getHeader = (headers: Record<string, string | undefined> | undefined, headerName: string): string | undefined => {
  if (!headers) return undefined;
  const directMatch = headers[headerName];
  if (directMatch) return directMatch;
  const normalized = headerName.toLowerCase();
  const matchedKey = Object.keys(headers).find((key) => key.toLowerCase() === normalized);
  return matchedKey ? headers[matchedKey] : undefined;
};

const verifyAuth = async (authHeader: string | undefined): Promise<string | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    console.error('[fwp-workout-generation] Auth verification failed:', error);
    return null;
  }
};

const resolveOpenAIApiKey = (): string | null => {
  const configuredKey = process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_AI_SECRET_KEY?.trim();
  return configuredKey || null;
};

const previewText = (value: string, limit = 1200): string =>
  value.length <= limit ? value : `${value.slice(0, limit)}...`;

const normalizeChatResultForSwift = (result: any): any => {
  if (!result || typeof result !== 'object') return result;
  return { ...result, system_fingerprint: result.system_fingerprint ?? '' };
};

const resolveFunctionOrigins = (event: Parameters<Handler>[0]): string[] => {
  const host = getHeader(event.headers, 'host') || 'fitwithpulse.ai';
  const protocol = getHeader(event.headers, 'x-forwarded-proto') || 'https';
  const requestOrigin = `${protocol}://${host}`.replace(/\/+$/, '');
  const configuredOrigins = [process.env.URL, process.env.DEPLOY_PRIME_URL]
    .map((origin) => origin?.trim().replace(/\/+$/, ''))
    .filter((origin): origin is string => Boolean(origin));
  return Array.from(new Set([requestOrigin, ...configuredOrigins]));
};

// ---------------------------------------------------------------------------
// Prompt assembly — the actual fix lives here.
// ---------------------------------------------------------------------------

interface GenRequestInput {
  focus?: string;
  customParts?: string[];     // hand-picked muscle labels, optional
  goal?: string;              // buildMuscle | loseFat | trainSport | feelBetter | stayConsistent
  experience?: string;
  level?: string;
  readiness?: string;
  recentlyTrained?: string[];
  equipment?: string;
  sport?: string;             // sport the client already knows (shared User doc)
  candidateMoves?: Array<{ id: string; name: string; region?: string; kind?: string; timed?: boolean }>;
  minutesTarget?: number;
}

const buildSystemPrompt = (ctx: FwpAthleteContext, input: GenRequestInput): string => {
  const sportLabel = ctx.sport || 'general physique / strength';
  return [
    `You are an elite, certified strength & conditioning coach and personal trainer for ${sportLabel}. ` +
      `You think like a true expert in exercise physiology, kinesiology, sports nutrition, and sport psychology, and you program for THIS specific athlete on THIS specific day — never from a template.`,

    `YOUR JOB: design one session. You decide the exercises, the order, and the per-exercise sets, reps, and tempo — all from the context below. ` +
      `There is NO fixed scheme. Sets and reps must vary across the session and reflect the real situation: a compound is not always low-rep/high-set; rep ranges, set counts, and intensity follow the athlete's goal, training age, recovery, the sport's demands, and — critically — where they are in their season.`,

    `ATHLETE CONTEXT:\n${renderAthleteContextForPrompt(ctx)}`,

    `PROGRAMMING PRINCIPLES:\n` +
      `- Periodize to competition timing: far out = accumulate/build; close = peak/taper (less volume, higher quality, less novelty and soreness). A peak/taper week is NOT 5×8 hypertrophy.\n` +
      `- Match volume to the sport's load tolerance and the athlete's recent load/recovery: a high-load-tolerant sport (e.g. track, court sports) absorbs more hard volume than a low-load sport (e.g. golf); poor recovery means pull volume back.\n` +
      `- Vary the prescription per movement and intent: primary movers earn more sets and (often) lower reps; accessories run higher reps; rep RANGES (e.g. "6-8 reps", "10-12 reps") are expected, not a single frozen number.\n` +
      `- Honor the sport's muscle priorities and preferred patterns, and any coach guidance.\n` +
      `- Sound structure: a brief warm-up if a mobility/prep move is available, compound/primary work before isolation, an optional finisher. Timed moves get seconds, not reps.`,

    `HARD CONSTRAINTS:\n` +
      `- Select ONLY from the provided CANDIDATE MOVES, referencing each by its exact moveId. Never invent a move or use an id not in the list.\n` +
      `- Every chosen move must serve the requested focus / picked muscles.\n` +
      `- "detail" is reps for rep-based moves ("8 reps" or a range "6-8 reps") and seconds for timed moves ("40 sec").\n` +
      `- The builtForYouChecks are a UI audit of YOUR chosen session. Keep each detail concrete, short, and specific to the final move list, recovery signal, prescription, volume, structure, and Movers.`,

    `OUTPUT — respond with ONLY this JSON object, no prose:\n` +
      `{\n` +
      `  "tagline": "<short personalized headline, <= 60 chars${ctx.nuanceDefaulted ? '; NEVER name a sport, division, or competition' : ''}>",\n` +
      `  "how": "<ONE concrete coach-voice sentence naming the actual programming decision and why (e.g. peaking, accumulation, recovery-led)>",\n` +
      `  "rationale": "<2-3 sentences of deeper reasoning the athlete can expand to read>",\n` +
      `  "builtForYouChecks": [\n` +
      `    { "id": "focus_accuracy", "title": "Focus accuracy", "detail": "<audit how the selected moves match the requested focus or picked muscles>", "isSatisfied": true },\n` +
      `    { "id": "recovery_fit", "title": "Recovery fit", "detail": "<audit how recent fatigue/readiness changed the selection and order>", "isSatisfied": true },\n` +
      `    { "id": "goal_prescription", "title": "Goal prescription", "detail": "<audit how sets/reps/seconds match the athlete goal, level, and timing>", "isSatisfied": true },\n` +
      `    { "id": "movement_quality", "title": "Movement quality", "detail": "<audit that the lifting slots use real, useful movement patterns>", "isSatisfied": true },\n` +
      `    { "id": "volume", "title": "Volume", "detail": "<audit move count and workload against readiness and sport load tolerance>", "isSatisfied": true },\n` +
      `    { "id": "structure", "title": "Structure", "detail": "<audit warm-up/primary/accessory/finisher order and repeat avoidance>", "isSatisfied": true },\n` +
      `    { "id": "mover_variety", "title": "Mover variety", "detail": "<audit the mix of selected Movers/coaches>", "isSatisfied": true }\n` +
      `  ],\n` +
      `  "builtForYouFooter": "<short result summary, e.g. Matched your profile on the first build>",\n` +
      `  "exercises": [ { "moveId": "<id from CANDIDATE MOVES>", "sets": <int>, "detail": "<reps or seconds>", "note": "<optional short cue or empty string>" } ]\n` +
      `}`,
  ].join('\n\n');
};

const buildUserPrompt = (ctx: FwpAthleteContext, input: GenRequestInput): string => {
  const lines: string[] = [];
  const reqBits: string[] = [];
  if (input.focus) reqBits.push(`focus: ${input.focus}`);
  if (input.customParts?.length) reqBits.push(`hand-picked muscles: ${input.customParts.join(', ')} (target ONLY these)`);
  if (input.goal) reqBits.push(`goal: ${input.goal}`);
  if (input.level) reqBits.push(`training level: ${input.level}`);
  if (input.experience) reqBits.push(`experience: ${input.experience}`);
  if (input.readiness) reqBits.push(`recovery readiness today: ${input.readiness}`);
  if (input.recentlyTrained?.length) reqBits.push(`trained in last few days (avoid re-hammering): ${input.recentlyTrained.join(', ')}`);
  if (input.equipment) reqBits.push(`equipment access: ${input.equipment}`);
  if (input.minutesTarget) reqBits.push(`rough time budget: ~${input.minutesTarget} min`);
  lines.push(`TODAY'S REQUEST — ${reqBits.join(' · ')}`);

  const moves = (input.candidateMoves || []).slice(0, MAX_CANDIDATE_MOVES);
  if (moves.length === (input.candidateMoves?.length || 0)) {
    lines.push(`CANDIDATE MOVES (${moves.length}) — choose ONLY from these moveIds:`);
  } else {
    lines.push(`CANDIDATE MOVES (showing ${moves.length} of ${input.candidateMoves?.length}) — choose ONLY from these moveIds:`);
  }
  lines.push(
    moves
      .map((m) => `- moveId=${m.id} · ${m.name} · region=${m.region ?? '?'} · kind=${m.kind ?? '?'}${m.timed ? ' · TIMED' : ''}`)
      .join('\n')
  );
  return lines.join('\n\n');
};

const buildGenerationRequest = (ctx: FwpAthleteContext, input: GenRequestInput): Record<string, unknown> => ({
  model: GEN_MODEL,
  messages: [
    { role: 'system', content: buildSystemPrompt(ctx, input) },
    { role: 'user', content: buildUserPrompt(ctx, input) },
  ],
  response_format: { type: 'json_object' },
  max_completion_tokens: GEN_MAX_COMPLETION_TOKENS,
  // gpt-5 family: temperature must stay at the default (1) — do not send a custom value.
});

// ---------------------------------------------------------------------------
// Inline fallback (mirrors nora-routine-generation): if no background worker
// origin accepts the job, run it inline so the client still gets a result.
// ---------------------------------------------------------------------------

const runGenerationJobInline = async (jobId: string, workerToken: string): Promise<void> => {
  const providerApiKey = resolveOpenAIApiKey();
  const jobRef = admin.firestore().collection(JOB_COLLECTION).doc(jobId);
  try {
    if (!providerApiKey) throw new Error('Missing OpenAI provider key');
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) throw new Error('Job not found');
    const job = jobDoc.data() || {};
    if (job.workerToken !== workerToken) throw new Error('Forbidden worker token');
    if (job.status === 'succeeded') return;

    await jobRef.update({
      status: 'running',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerApiKey}` },
      body: JSON.stringify(job.request),
    });
    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) throw new Error(`OpenAI upstream ${response.status}: ${previewText(responseText)}`);
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error(`OpenAI upstream returned non-JSON (${contentType}): ${previewText(responseText)}`);
    }
    const result = normalizeChatResultForSwift(JSON.parse(responseText));
    await jobRef.update({
      status: 'succeeded',
      result,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    const incidentId = makeIncidentId('FWP');
    await jobRef
      .update({
        status: 'failed',
        errorMessage: "We couldn't build that workout right now. Try again in a moment.",
        errorCode: 'FWP_WORKOUT_GENERATION_FAILED',
        incidentId,
        errorDetails: previewText(error?.message || 'Workout generation failed.'),
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      .catch(() => {});
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify(safeErrorBody('METHOD_NOT_ALLOWED', 'That request is not supported.')),
    };
  }

  const uid = await verifyAuth(getHeader(event.headers, 'authorization'));
  if (!uid) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify(safeErrorBody('AUTH_REQUIRED', 'Please sign in again.')),
    };
  }

  if (!resolveOpenAIApiKey()) {
    return safeErrorResponse({
      statusCode: 500,
      headers: corsHeaders,
      code: 'FWP_WORKOUT_GENERATION_FAILED',
      message: "We couldn't build that workout right now. Try again in a moment.",
      source: 'fwp-workout-generation.missing-provider-key',
      error: new Error('Missing OpenAI provider key'),
      db,
      context: { uid },
    });
  }

  let input: GenRequestInput;
  try {
    input = JSON.parse(event.body || '{}');
  } catch (_error) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify(safeErrorBody('BAD_REQUEST', 'That request could not be read.')),
    };
  }

  if (!Array.isArray(input.candidateMoves) || input.candidateMoves.length === 0) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify(safeErrorBody('BAD_REQUEST', 'No candidate moves were provided.')),
    };
  }

  // Aggregate the full ecosystem context (best-effort) and build the request.
  let openAiRequest: Record<string, unknown>;
  try {
    const ctx = await buildFwpAthleteContext(uid, input.sport);
    openAiRequest = buildGenerationRequest(ctx, input);
  } catch (error: any) {
    return safeErrorResponse({
      statusCode: 500,
      headers: corsHeaders,
      code: 'FWP_WORKOUT_GENERATION_FAILED',
      message: "We couldn't build that workout right now. Try again in a moment.",
      source: 'fwp-workout-generation.context-build',
      error: error instanceof Error ? error : new Error(String(error)),
      db,
      context: { uid },
    });
  }

  const jobId = crypto.randomUUID();
  const workerToken = crypto.randomUUID();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const jobRef = admin.firestore().collection(JOB_COLLECTION).doc(jobId);

  await jobRef.set({
    ownerId: uid,
    status: 'queued',
    request: openAiRequest,
    workerToken,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    model: GEN_MODEL,
  });

  const workerHeaders = {
    'Content-Type': 'application/json',
    'x-pulsecheck-internal-worker': workerToken,
    ...(getHeader(event.headers, 'x-pulsecheck-firebase-mode')
      ? { 'x-pulsecheck-firebase-mode': getHeader(event.headers, 'x-pulsecheck-firebase-mode')! }
      : {}),
  };
  const workerBody = JSON.stringify({ jobId });
  let workerStarted = false;
  let lastWorkerError: Error | null = null;

  for (const origin of resolveFunctionOrigins(event)) {
    const workerUrl = `${origin}/.netlify/functions/fwp-workout-generation-background`;
    try {
      const workerResponse = await fetch(workerUrl, { method: 'POST', headers: workerHeaders, body: workerBody });
      if (workerResponse.ok || workerResponse.status === 202) {
        workerStarted = true;
        break;
      }
      const responseText = await workerResponse.text().catch(() => '');
      lastWorkerError = new Error(`HTTP ${workerResponse.status} from ${workerUrl}: ${previewText(responseText)}`);
      console.error('[fwp-workout-generation] Background worker start returned an error:', { jobId, workerUrl, message: lastWorkerError.message });
    } catch (error: any) {
      lastWorkerError = error instanceof Error ? error : new Error(String(error));
      console.error('[fwp-workout-generation] Background worker start threw:', { jobId, workerUrl, message: lastWorkerError.message });
    }
  }

  if (!workerStarted) {
    console.error('[fwp-workout-generation] Falling back to inline generation:', { jobId, message: lastWorkerError?.message || 'No worker start attempts succeeded.' });
    try {
      await runGenerationJobInline(jobId, workerToken);
    } catch (error: any) {
      console.error('[fwp-workout-generation] Inline generation failed:', { jobId, message: error?.message });
    }
  }

  return {
    statusCode: 202,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, status: workerStarted ? 'queued' : 'running' }),
  };
};
