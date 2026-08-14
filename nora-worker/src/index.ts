import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { chromium, type BrowserContext, type Page } from 'playwright';

type MeetingPlatform = 'zoom' | 'google-meet' | 'teams' | 'other';
type WorkerStatus =
  | 'queued'
  | 'running'
  | 'waiting-for-start'
  | 'unsupported-platform'
  | 'needs-login'
  | 'transcript-ready'
  | 'retryable-error'
  | 'failed';

type QueuedMeeting = {
  id: string;
  path: string;
  ownerUid: string;
  title: string;
  meetingUrl: string;
  platform: MeetingPlatform;
  startsAt: string;
};

const USERS_COLLECTION = 'simpbudget-users';
const MEETINGS_SUBCOLLECTION = 'noraNotetakerMeetings';
const BOT_NAME = 'Nora';
const WORKER_MODE = 'caption-browser';
const PROJECT_ID = process.env.SIMPBUDGET_FIREBASE_PROJECT_ID || 'simpbudget-e213e';
const POLL_MS = Number(process.env.NORA_WORKER_POLL_MS || 15000);
const BATCH_SIZE = Math.max(1, Number(process.env.NORA_WORKER_BATCH_SIZE || 1));
const MAX_MEETING_MS = Math.max(60_000, Number(process.env.NORA_MAX_MEETING_MS || 90 * 60 * 1000));
const JOIN_EARLY_MS = Math.max(0, Number(process.env.NORA_MEET_JOIN_EARLY_MS || 2 * 60 * 1000));
const USER_DATA_DIR = process.env.NORA_BROWSER_USER_DATA_DIR || '/tmp/nora-chrome-profile';
const HEADLESS = process.env.NORA_BROWSER_HEADLESS !== 'false';

function parseJsonCredential(raw?: string) {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function initializeFirebase() {
  if (getApps().length) return getApps()[0];

  const serviceAccount =
    parseJsonCredential(process.env.SIMPBUDGET_SERVICE_ACCOUNT_JSON) ||
    parseJsonCredential(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON);

  return initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const app = initializeFirebase();
const db = getFirestore(app);

function parseOwnerUid(path: string) {
  const parts = path.split('/');
  const index = parts.indexOf(USERS_COLLECTION);
  return index >= 0 ? parts[index + 1] || '' : '';
}

function normalizePlatform(value: unknown, meetingUrl: string): MeetingPlatform {
  if (value === 'zoom' || value === 'google-meet' || value === 'teams' || value === 'other') {
    return value;
  }
  if (/meet\.google\.com/i.test(meetingUrl)) return 'google-meet';
  if (/zoom\.us/i.test(meetingUrl)) return 'zoom';
  if (/teams\.microsoft\.com/i.test(meetingUrl)) return 'teams';
  return 'other';
}

async function findQueuedMeetings(): Promise<QueuedMeeting[]> {
  const snapshot = await db
    .collectionGroup(MEETINGS_SUBCOLLECTION)
    .where('status', '==', 'queued')
    .where('workerStatus', 'in', ['queued', 'retryable-error'])
    .limit(BATCH_SIZE)
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const meetingUrl = typeof data.meetingUrl === 'string' ? data.meetingUrl : '';
      return {
        id: doc.id,
        path: doc.ref.path,
        ownerUid: parseOwnerUid(doc.ref.path),
        title: typeof data.title === 'string' ? data.title : 'NoraNotetaker meeting',
        meetingUrl,
        platform: normalizePlatform(data.platform, meetingUrl),
        startsAt: typeof data.startsAt === 'string' ? data.startsAt : '',
      };
    })
    .filter((meeting) => meeting.ownerUid && meeting.meetingUrl);
}

async function claimMeeting(meeting: QueuedMeeting, runId: string) {
  const ref = db.doc(meeting.path);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return false;

    const data = snapshot.data() || {};
    const status = typeof data.status === 'string' ? data.status : '';
    const workerStatus = typeof data.workerStatus === 'string' ? data.workerStatus : '';
    if (status !== 'queued' || ['running', 'transcript-ready'].includes(workerStatus)) return false;

    transaction.set(
      ref,
      {
        botName: BOT_NAME,
        workerJobId: meeting.id,
        workerMode: WORKER_MODE,
        workerRunId: runId,
        workerStatus: 'running' satisfies WorkerStatus,
        workerClaimedAt: FieldValue.serverTimestamp(),
        workerHeartbeatAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  });
}

async function writeMeetingStatus(path: string, status: WorkerStatus, extra: Record<string, unknown> = {}) {
  await db.doc(path).set(
    {
      ...extra,
      workerStatus: status,
      workerHeartbeatAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

function shouldWaitForStart(startsAt: string) {
  const parsed = startsAt ? new Date(startsAt) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 0;
  return parsed.getTime() - Date.now() - JOIN_EARLY_MS;
}

async function collectGoogleMeetCaptions(meeting: QueuedMeeting) {
  const waitMs = shouldWaitForStart(meeting.startsAt);
  if (waitMs > 0) {
    await writeMeetingStatus(meeting.path, 'waiting-for-start', {
      workerWakeAt: Timestamp.fromMillis(Date.now() + waitMs),
    });
    await delay(Math.min(waitMs, 30 * 60 * 1000));
  }

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: HEADLESS,
    args: ['--use-fake-ui-for-media-stream', '--no-sandbox'],
  });

  try {
    const page = await context.newPage();
    await page.goto(meeting.meetingUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(3000);

    if (/accounts\.google\.com/i.test(page.url())) {
      await writeMeetingStatus(meeting.path, 'needs-login', {
        workerError: 'Nora Google account must be signed into the worker browser profile.',
      });
      return;
    }

    await prepareGoogleMeetJoin(page);
    await enableGoogleMeetCaptions(page);
    const rawTranscript = await captureCaptionText(page, MAX_MEETING_MS);

    await db.doc(meeting.path).set(
      {
        rawTranscript,
        status: rawTranscript ? 'needs-review' : 'queued',
        workerStatus: rawTranscript ? 'transcript-ready' : 'retryable-error',
        workerError: rawTranscript ? '' : 'No captions were captured before the worker stopped.',
        workerCompletedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } finally {
    await context.close();
  }
}

async function prepareGoogleMeetJoin(page: Page) {
  await clickByText(page, ['Got it', 'Continue without microphone and camera', 'Dismiss']);
  await clickByLabel(page, ['Turn off microphone', 'Microphone']);
  await clickByLabel(page, ['Turn off camera', 'Camera']);
  await clickByText(page, ['Ask to join', 'Join now']);
}

async function enableGoogleMeetCaptions(page: Page) {
  await clickByText(page, ['Turn on captions', 'Captions']);
  await page.keyboard.press('c').catch(() => undefined);
}

async function clickByText(page: Page, labels: string[]) {
  for (const label of labels) {
    const locator = page.getByText(label, { exact: true });
    if ((await locator.count().catch(() => 0)) === 1) {
      await locator.click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(800);
    }
  }
}

async function clickByLabel(page: Page, labels: string[]) {
  for (const label of labels) {
    const locator = page.getByLabel(label, { exact: false });
    if ((await locator.count().catch(() => 0)) === 1) {
      await locator.click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(800);
    }
  }
}

async function captureCaptionText(page: Page, durationMs: number) {
  const startedAt = Date.now();
  const seen = new Set<string>();
  const lines: string[] = [];

  while (Date.now() - startedAt < durationMs) {
    const captionLines = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('[aria-live], [role="log"], [jsname]'));
      return candidates
        .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((text) => text.length > 2 && text.length < 500);
    });

    for (const line of captionLines) {
      if (!seen.has(line)) {
        seen.add(line);
        lines.push(line);
      }
    }

    await delay(1500);
  }

  return lines.join('\n').trim();
}

async function processMeeting(meeting: QueuedMeeting) {
  if (meeting.platform !== 'google-meet') {
    await writeMeetingStatus(meeting.path, 'unsupported-platform', {
      workerError: 'Nora owned worker MVP currently supports Google Meet first.',
    });
    return;
  }

  await collectGoogleMeetCaptions(meeting);
}

async function runOnce() {
  const runId = randomUUID();
  const queuedMeetings = await findQueuedMeetings();
  for (const meeting of queuedMeetings) {
    const claimed = await claimMeeting(meeting, runId);
    if (!claimed) continue;
    try {
      await processMeeting(meeting);
    } catch (error) {
      await writeMeetingStatus(meeting.path, 'retryable-error', {
        workerError: error instanceof Error ? error.message : 'Unknown Nora worker error.',
      });
    }
  }
  return queuedMeetings.length;
}

async function main() {
  const mode = process.env.NORA_WORKER_MODE || 'poll';
  if (mode === 'once') {
    await runOnce();
    return;
  }

  while (true) {
    await runOnce();
    await delay(POLL_MS);
  }
}

main().catch((error) => {
  console.error('[nora-worker] Fatal worker error:', error);
  process.exitCode = 1;
});
