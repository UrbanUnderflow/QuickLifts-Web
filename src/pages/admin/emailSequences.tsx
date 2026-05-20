import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useDispatch } from 'react-redux';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Mail, Send, Loader2, CheckCircle, AlertCircle, X, Edit3, Eye, Copy, Clock } from 'lucide-react';
import { showToast } from '../../redux/toastSlice';

type SequenceRow = {
  id: string;
  name: string;
  trigger: string;
  defaultSubject: string;
  functionPath: string;
  templateDocId: string;
  scheduleConfigDocId?: string; // if present, allows admin to control scheduled automation config
  scheduleDescription?: string;
  supportsScheduleTime?: boolean;
  defaultScheduleEnabled?: boolean;
  deliveryRuntime?: 'netlify' | 'firebase';
  supportsTemplateEditing?: boolean;
  supportsTestSend?: boolean;
  supportsCampaignConfig?: boolean;
  openInAdminPath?: string;
  openInAdminLabel?: string;
};

type CampaignConfig = {
  delayHours: number;
  batchLimit: number;
  maxSendsPerRun: number;
  scanEveryHours: number;
  sendWindowStartLocal: string;
  sendWindowEndLocal: string;
  sendWindowTimezone: string;
};

const MACRA_WEB_OFFER_SEQUENCE_ID = 'macra-web-offer-24h-v1';
const CAMPAIGN_SEND_WINDOW_TIMEZONE = 'America/New_York';
const DEFAULT_CAMPAIGN_CONFIG: CampaignConfig = {
  delayHours: 24,
  batchLimit: 250,
  maxSendsPerRun: 80,
  scanEveryHours: 1,
  sendWindowStartLocal: '09:00',
  sendWindowEndLocal: '17:00',
  sendWindowTimezone: CAMPAIGN_SEND_WINDOW_TIMEZONE,
};

const normalizeLocalTime = (value: unknown, fallback: string) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{2}:\d{2}$/.test(raw)) return fallback;

  const [hourRaw, minuteRaw] = raw.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const normalizeCampaignConfig = (data: Record<string, any> = {}): CampaignConfig => ({
  delayHours: Math.max(1, Number(data.delayHours || DEFAULT_CAMPAIGN_CONFIG.delayHours) || DEFAULT_CAMPAIGN_CONFIG.delayHours),
  batchLimit: Math.max(25, Number(data.batchLimit || DEFAULT_CAMPAIGN_CONFIG.batchLimit) || DEFAULT_CAMPAIGN_CONFIG.batchLimit),
  maxSendsPerRun: Math.max(1, Number(data.maxSendsPerRun || DEFAULT_CAMPAIGN_CONFIG.maxSendsPerRun) || DEFAULT_CAMPAIGN_CONFIG.maxSendsPerRun),
  scanEveryHours: Math.max(1, Number(data.scanEveryHours || DEFAULT_CAMPAIGN_CONFIG.scanEveryHours) || DEFAULT_CAMPAIGN_CONFIG.scanEveryHours),
  sendWindowStartLocal: normalizeLocalTime(data.sendWindowStartLocal, DEFAULT_CAMPAIGN_CONFIG.sendWindowStartLocal),
  sendWindowEndLocal: normalizeLocalTime(data.sendWindowEndLocal, DEFAULT_CAMPAIGN_CONFIG.sendWindowEndLocal),
  sendWindowTimezone: typeof data.sendWindowTimezone === 'string' && data.sendWindowTimezone.trim()
    ? data.sendWindowTimezone.trim()
    : DEFAULT_CAMPAIGN_CONFIG.sendWindowTimezone,
});

const parseIntegerDraft = (value: string): number | null => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const hasCampaignControls = (seq: Pick<SequenceRow, 'id' | 'supportsCampaignConfig'> | null) =>
  Boolean(seq?.supportsCampaignConfig || seq?.id === MACRA_WEB_OFFER_SEQUENCE_ID);

const SEQUENCES: SequenceRow[] = [
  {
    id: 'welcome-v1',
    name: 'Welcome to Pulse',
    trigger: 'On registration (new user created)',
    defaultSubject: 'Welcome to Pulse — you’re in',
    functionPath: '/.netlify/functions/send-welcome-email',
    templateDocId: 'welcome-v1',
  },
  {
    id: 'username-reminder-v1',
    name: 'Forgot Username Reminder',
    trigger: 'User forgot to select username (registration incomplete after ~30 minutes)',
    defaultSubject: 'Finish setting up your Pulse account',
    functionPath: '/.netlify/functions/send-username-reminder-email',
    templateDocId: 'username-reminder-v1',
    scheduleConfigDocId: 'username-reminder-v1',
    scheduleDescription: 'Configurable daily UTC send window',
    defaultScheduleEnabled: true,
  },
  {
    id: 'new-follower-v1',
    name: 'New Follower Notification',
    trigger: 'When someone follows a user',
    defaultSubject: '{{followerName}} is now following you on Pulse',
    functionPath: '/.netlify/functions/send-new-follower-email',
    templateDocId: 'new-follower-v1',
  },
  {
    id: 'coach-connection-v1',
    name: 'Coach Connection Notification',
    trigger: 'When an athlete subscribes and connects with a coach',
    defaultSubject: '{{athleteName}} just connected with you on PulseCheck',
    functionPath: '/.netlify/functions/send-coach-connection-email',
    templateDocId: 'coach-connection-v1',
  },
  {
    id: 'pulsecheck-pilot-activation-v1',
    name: 'PulseCheck Pilot Activation',
    trigger: 'Manual from the PulseCheck pilot dashboard when an athlete is admitted and needs to reopen the app to finish consent',
    defaultSubject: '{{teamName}} access is ready in PulseCheck',
    functionPath: '/.netlify/functions/send-pulsecheck-pilot-activation-email',
    templateDocId: 'pulsecheck-pilot-activation-v1',
  },
  {
    id: 'winner-notification-v1',
    name: 'Winner Notification',
    trigger: 'When prize distribution is confirmed for challenge winners',
    defaultSubject: '🏆 You won ${{prizeAmount}} in {{challengeTitle}}!',
    functionPath: '/.netlify/functions/send-winner-notification-email',
    templateDocId: 'winner-notification-v1',
  },
  {
    id: 'approval-v1',
    name: 'Approval Notification',
    trigger: 'When a creator / coach application is approved',
    defaultSubject: "Congratulations, {{firstName}}! You're approved for Pulse Programming",
    functionPath: '/.netlify/functions/send-approval-email',
    templateDocId: 'approval-v1',
  },
  {
    id: 'joined-round-no-workout-v1',
    name: 'Joined Round, No First Workout',
    trigger: '24h after joining a Round with no completed workouts',
    defaultSubject: 'Your Round is waiting - start your first workout',
    functionPath: '/.netlify/functions/send-joined-round-no-workout-email',
    templateDocId: 'joined-round-no-workout-v1',
    scheduleConfigDocId: 'joined-round-no-workout-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends after the 24h no-workout delay',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'first-workout-celebration-v1',
    name: 'First Workout Completion Celebration',
    trigger: 'On first completed workout in a Round',
    defaultSubject: 'You completed your first workout - keep it rolling',
    functionPath: '/.netlify/functions/send-first-workout-celebration-email',
    templateDocId: 'first-workout-celebration-v1',
    scheduleConfigDocId: 'first-workout-celebration-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; detects recent first workout completions',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'streak-milestone-v1',
    name: 'Streak Milestones',
    trigger: 'When user reaches a 3, 7, 14, or 30-day streak',
    defaultSubject: '🔥 {{milestone}}-day streak - keep it alive',
    functionPath: '/.netlify/functions/send-streak-milestone-email',
    templateDocId: 'streak-milestone-v1',
    scheduleConfigDocId: 'streak-milestone-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends 3/7/14/30-day streak milestones',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'challenge-ending-soon-v1',
    name: 'Challenge Ending Soon',
    trigger: '72h and 24h before challenge end',
    defaultSubject: '{{hoursRemaining}}h left in {{challengeTitle}} - finish strong',
    functionPath: '/.netlify/functions/send-challenge-ending-soon-email',
    templateDocId: 'challenge-ending-soon-v1',
    scheduleConfigDocId: 'challenge-ending-soon-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends at roughly 72h and 24h remaining',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'irl-event-analytics-report-v1',
    name: 'IRL Event Analytics Report',
    trigger: '~1 hour after IRL event ends',
    defaultSubject: 'Your {{eventTitle}} analytics report',
    functionPath: '/.netlify/functions/send-irl-event-analytics-report-email',
    templateDocId: 'irl-event-analytics-report-v1',
    scheduleConfigDocId: 'irl-event-analytics-report-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends host report about 1 hour after an event ends',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'inactivity-winback-v1',
    name: 'Inactivity Winback',
    trigger: '3d, 7d, and 14d since last meaningful activity',
    defaultSubject: "Let's get you back in motion on Pulse",
    functionPath: '/.netlify/functions/send-inactivity-winback-email',
    templateDocId: 'inactivity-winback-v1',
    scheduleConfigDocId: 'inactivity-winback-v1',
    scheduleDescription: 'Netlify cron: every 30 minutes; sends at 3/7/14 days of inactivity',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'password-reset-v1',
    name: 'Password Reset',
    trigger: 'When user requests password reset',
    defaultSubject: 'Reset your Pulse password',
    functionPath: '/.netlify/functions/send-password-reset-email',
    templateDocId: 'password-reset-v1',
  },
  {
    id: 'error-alerts-v1',
    name: 'Error Alert Emails',
    trigger: 'On new Firestore error log creation (`errorLogs/{logId}`)',
    defaultSubject: '[Pulse Error Alert] {{source}} ({{username}})',
    functionPath: '',
    templateDocId: 'error-alerts-v1',
    deliveryRuntime: 'firebase',
    supportsTemplateEditing: false,
    supportsTestSend: false,
    openInAdminPath: '/admin/ErrorLogs',
    openInAdminLabel: 'Open error logs',
  },
  // ── Macra Nutrition ───────────────────────────────────
  {
    id: 'macra-welcome-v1',
    name: 'Macra Welcome',
    trigger: 'Fires once when a user finishes the Macra onboarding notification-preferences step (iOS) — plus an hourly server-side sweep that catches users whose client-side send never landed. Idempotent via users.macraWelcomeEmailSentAt.',
    defaultSubject: 'Welcome to Macra — your plan is ready',
    functionPath: '/.netlify/functions/send-macra-welcome-email',
    templateDocId: 'macra-welcome-v1',
    scheduleConfigDocId: 'macra-welcome-v1',
    scheduleDescription: 'Netlify cron: hourly safety-net sweep for missed client-side welcome sends',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'macra-tips-v1',
    name: 'Macra Tips Series',
    trigger: 'Scheduled function. Sends tip emails on day 2, day 4, and day 7 after Macra onboarding completion.',
    defaultSubject: 'Nora tip: {{tipTitle}}',
    functionPath: '/.netlify/functions/send-macra-tips-email',
    templateDocId: 'macra-tips-v1',
    scheduleConfigDocId: 'macra-tips-v1',
    scheduleDescription: 'Netlify cron: daily at 2:30 PM UTC',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: 'macra-inactivity-winback-v1',
    name: 'Macra Inactivity Winback',
    trigger: 'Scheduled function. Fires at 3, 7, and 14 days since last Macra food log.',
    defaultSubject: "You haven't logged in {{daysInactive}} days — Nora misses you",
    functionPath: '/.netlify/functions/send-macra-inactivity-email',
    templateDocId: 'macra-inactivity-winback-v1',
    scheduleConfigDocId: 'macra-inactivity-winback-v1',
    scheduleDescription: 'Netlify cron: daily at 3:00 PM UTC',
    supportsScheduleTime: false,
    defaultScheduleEnabled: true,
  },
  {
    id: MACRA_WEB_OFFER_SEQUENCE_ID,
    name: 'Macra Web Offer 24h',
    trigger: 'Scheduled function. Sends once 24h after Macra onboarding when no active trial/subscription exists. Excludes missing-age and under-18 profiles. Checkout uses Stripe web, not StoreKit.',
    defaultSubject: 'Your Macra plan is ready, plus a free month',
    functionPath: '/.netlify/functions/send-macra-web-offer-email',
    templateDocId: 'macra-web-offer-24h-v1',
    scheduleConfigDocId: 'macra-web-offer-24h-v1',
    scheduleDescription: 'Netlify cron: hourly; sends only eligible users after the 24h delay',
    supportsScheduleTime: false,
    defaultScheduleEnabled: false,
    supportsCampaignConfig: true,
  },
];

const EmailSequencesAdmin: React.FC = () => {
  const dispatch = useDispatch();
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [activeSequence, setActiveSequence] = useState<SequenceRow | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');
  const [testUserId, setTestUserId] = useState('');
  const [lastTestCheckoutUrl, setLastTestCheckoutUrl] = useState('');
  const [sending, setSending] = useState(false);

  // Template editing
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
  const [templateLoadedFromFirestore, setTemplateLoadedFromFirestore] = useState(false);

  // Schedule config (daily send time)
  const [scheduleTimeById, setScheduleTimeById] = useState<Record<string, string>>({});
  const [scheduleEnabledById, setScheduleEnabledById] = useState<Record<string, boolean>>({});
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleEditingSequence, setScheduleEditingSequence] = useState<SequenceRow | null>(null);
  const [scheduleTimeDraft, setScheduleTimeDraft] = useState('14:00');
  const [scheduleEnabledDraft, setScheduleEnabledDraft] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingScheduleId, setSavingScheduleId] = useState<string | null>(null);
  const [campaignConfigById, setCampaignConfigById] = useState<Record<string, CampaignConfig>>({});
  const [delayHoursDraft, setDelayHoursDraft] = useState(String(DEFAULT_CAMPAIGN_CONFIG.delayHours));
  const [batchLimitDraft, setBatchLimitDraft] = useState(String(DEFAULT_CAMPAIGN_CONFIG.batchLimit));
  const [maxSendsPerRunDraft, setMaxSendsPerRunDraft] = useState(String(DEFAULT_CAMPAIGN_CONFIG.maxSendsPerRun));
  const [scanEveryHoursDraft, setScanEveryHoursDraft] = useState(String(DEFAULT_CAMPAIGN_CONFIG.scanEveryHours));
  const [sendWindowStartDraft, setSendWindowStartDraft] = useState(DEFAULT_CAMPAIGN_CONFIG.sendWindowStartLocal);
  const [sendWindowEndDraft, setSendWindowEndDraft] = useState(DEFAULT_CAMPAIGN_CONFIG.sendWindowEndLocal);

  const scheduleOptions = useMemo(() => {
    const out: string[] = [];
    for (let h = 0; h < 24; h++) {
      out.push(`${String(h).padStart(2, '0')}:00`);
      out.push(`${String(h).padStart(2, '0')}:30`);
    }
    return out;
  }, []);

  useEffect(() => {
    // Load schedule times for sequences that support scheduling (UTC time)
    const load = async () => {
      try {
        const updates: Record<string, string> = {};
        const enabledUpdates: Record<string, boolean> = {};
        const campaignConfigUpdates: Record<string, CampaignConfig> = {};
        for (const seq of SEQUENCES) {
          if (!seq.scheduleConfigDocId) continue;
          const ref = doc(db, 'email-sequence-config', seq.scheduleConfigDocId);
          const snap = await getDoc(ref);
          const data = snap.exists() ? ((snap.data() || {}) as any) : {};
          const time = (data?.sendTimeUtc as string) || '';
          updates[seq.id] = (time || '14:00').trim();
          enabledUpdates[seq.id] = snap.exists()
            ? seq.defaultScheduleEnabled === false
              ? data?.enabled === true
              : data?.enabled !== false
            : seq.defaultScheduleEnabled === true;
          if (hasCampaignControls(seq)) {
            campaignConfigUpdates[seq.id] = normalizeCampaignConfig(data);
          }
        }
        setScheduleTimeById(updates);
        setScheduleEnabledById(enabledUpdates);
        setCampaignConfigById(campaignConfigUpdates);
      } catch (_) {
        // Non-blocking; default values will display
      }
    };
    load();
  }, []);

  const previewSrcDoc = useMemo(() => {
    if (!templateHtml.trim()) return '';
    return templateHtml;
  }, [templateHtml]);

  const openTestModal = (seq: SequenceRow) => {
    setActiveSequence(seq);
    setTestEmail('');
    setTestName('');
    setTestUserId('');
    setLastTestCheckoutUrl('');
    setIsTestModalOpen(true);
    setMessage(null);
  };

  const isScheduleEnabled = (seq: SequenceRow) =>
    scheduleEnabledById[seq.id] ?? (seq.defaultScheduleEnabled === true);

  const getCampaignConfig = (seq: SequenceRow): CampaignConfig =>
    campaignConfigById[seq.id] || DEFAULT_CAMPAIGN_CONFIG;

  const openScheduleModal = (seq: SequenceRow) => {
    setScheduleEditingSequence(seq);
    const existing = scheduleTimeById[seq.id] || '14:00';
    const campaignConfig = getCampaignConfig(seq);
    setScheduleTimeDraft(existing);
    setScheduleEnabledDraft(isScheduleEnabled(seq));
    setDelayHoursDraft(String(campaignConfig.delayHours));
    setBatchLimitDraft(String(campaignConfig.batchLimit));
    setMaxSendsPerRunDraft(String(campaignConfig.maxSendsPerRun));
    setScanEveryHoursDraft(String(campaignConfig.scanEveryHours));
    setSendWindowStartDraft(campaignConfig.sendWindowStartLocal);
    setSendWindowEndDraft(campaignConfig.sendWindowEndLocal);
    setIsScheduleModalOpen(true);
    setMessage(null);
  };

  const saveScheduleTime = async () => {
    if (!scheduleEditingSequence?.scheduleConfigDocId) return;
    const t = (scheduleTimeDraft || '').trim();
    if (scheduleEditingSequence.supportsScheduleTime !== false && !/^\d{2}:\d{2}$/.test(t)) {
      setMessage({ type: 'error', text: 'Invalid time format' });
      return;
    }

    let nextCampaignConfig: CampaignConfig | null = null;
    if (hasCampaignControls(scheduleEditingSequence)) {
      const delayHours = parseIntegerDraft(delayHoursDraft);
      const batchLimit = parseIntegerDraft(batchLimitDraft);
      const maxSendsPerRun = parseIntegerDraft(maxSendsPerRunDraft);
      const scanEveryHours = parseIntegerDraft(scanEveryHoursDraft);
      const sendWindowStartLocal = normalizeLocalTime(sendWindowStartDraft, '');
      const sendWindowEndLocal = normalizeLocalTime(sendWindowEndDraft, '');

      if (!delayHours || delayHours < 1 || delayHours > 168) {
        setMessage({ type: 'error', text: 'Delay must be between 1 and 168 hours.' });
        return;
      }
      if (!batchLimit || batchLimit < 25 || batchLimit > 1000) {
        setMessage({ type: 'error', text: 'Batch limit must be between 25 and 1000 users.' });
        return;
      }
      if (!maxSendsPerRun || maxSendsPerRun < 1 || maxSendsPerRun > 500) {
        setMessage({ type: 'error', text: 'Max sends per run must be between 1 and 500.' });
        return;
      }
      if (maxSendsPerRun > batchLimit) {
        setMessage({ type: 'error', text: 'Max sends per run cannot be higher than the batch limit.' });
        return;
      }
      if (!scanEveryHours || scanEveryHours < 1 || scanEveryHours > 24) {
        setMessage({ type: 'error', text: 'Scan frequency must be between 1 and 24 hours.' });
        return;
      }
      if (!sendWindowStartLocal || !sendWindowEndLocal) {
        setMessage({ type: 'error', text: 'Send window times must use HH:MM format.' });
        return;
      }

      nextCampaignConfig = {
        delayHours,
        batchLimit,
        maxSendsPerRun,
        scanEveryHours,
        sendWindowStartLocal,
        sendWindowEndLocal,
        sendWindowTimezone: CAMPAIGN_SEND_WINDOW_TIMEZONE,
      };
    }

    setSavingSchedule(true);
    try {
      const ref = doc(db, 'email-sequence-config', scheduleEditingSequence.scheduleConfigDocId);
      await setDoc(
        ref,
        {
          id: scheduleEditingSequence.scheduleConfigDocId,
          ...(scheduleEditingSequence.supportsScheduleTime === false ? {} : { sendTimeUtc: t }),
          ...(nextCampaignConfig || {}),
          enabled: scheduleEnabledDraft,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setScheduleTimeById((prev) => ({ ...prev, [scheduleEditingSequence.id]: t || prev[scheduleEditingSequence.id] || '14:00' }));
      setScheduleEnabledById((prev) => ({ ...prev, [scheduleEditingSequence.id]: scheduleEnabledDraft }));
      if (nextCampaignConfig) {
        setCampaignConfigById((prev) => ({ ...prev, [scheduleEditingSequence.id]: nextCampaignConfig }));
      }
      setMessage({
        type: 'success',
        text: nextCampaignConfig
          ? `${scheduleEditingSequence.name} ${scheduleEnabledDraft ? 'enabled' : 'paused'} with ${nextCampaignConfig.maxSendsPerRun} max sends per run every ${nextCampaignConfig.scanEveryHours}h.`
          : `${scheduleEditingSequence.name} ${scheduleEnabledDraft ? 'enabled' : 'paused'}${scheduleEditingSequence.supportsScheduleTime === false ? '' : ` at ${t} UTC`}.`,
      });
      setIsScheduleModalOpen(false);
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to save scheduled time' });
    } finally {
      setSavingSchedule(false);
    }
  };

  const toggleScheduleEnabled = async (seq: SequenceRow) => {
    if (!seq.scheduleConfigDocId) return;
    const nextEnabled = !isScheduleEnabled(seq);
    setSavingScheduleId(seq.id);
    setMessage(null);
    try {
      const ref = doc(db, 'email-sequence-config', seq.scheduleConfigDocId);
      await setDoc(
        ref,
        {
          id: seq.scheduleConfigDocId,
          enabled: nextEnabled,
          ...(seq.supportsScheduleTime === false ? {} : { sendTimeUtc: scheduleTimeById[seq.id] || '14:00' }),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setScheduleEnabledById((prev) => ({ ...prev, [seq.id]: nextEnabled }));
      setMessage({ type: 'success', text: `${seq.name} ${nextEnabled ? 'enabled' : 'paused'}.` });
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to update automation status' });
    } finally {
      setSavingScheduleId(null);
    }
  };

  const loadTemplate = async (seq: SequenceRow) => {
    setLoadingTemplate(true);
    setTemplateLoadedFromFirestore(false);
    try {
      const ref = doc(db, 'email-templates', seq.templateDocId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        setTemplateSubject((data?.subject as string) || seq.defaultSubject);
        setTemplateHtml((data?.html as string) || '');
        setTemplateLoadedFromFirestore(true);
      } else {
        // If not saved yet, start with defaults and let the function fallback render on send
        setTemplateSubject(seq.defaultSubject);
        setTemplateHtml('');
      }
    } catch (_e) {
      setTemplateSubject(seq.defaultSubject);
      setTemplateHtml('');
      setMessage({ type: 'error', text: 'Failed to load email template' });
    } finally {
      setLoadingTemplate(false);
    }
  };

  const openEditModal = async (seq: SequenceRow) => {
    setActiveSequence(seq);
    setIsEditModalOpen(true);
    setMessage(null);
    await loadTemplate(seq);
  };

  const saveTemplate = async () => {
    if (!activeSequence) return;
    if (!templateSubject.trim()) {
      setMessage({ type: 'error', text: 'Subject is required' });
      return;
    }
    if (!templateHtml.trim()) {
      setMessage({ type: 'error', text: 'HTML is required (paste your full HTML email)' });
      return;
    }

    setSavingTemplate(true);
    try {
      const ref = doc(db, 'email-templates', activeSequence.templateDocId);
      await setDoc(
        ref,
        {
          id: activeSequence.templateDocId,
          subject: templateSubject.trim(),
          html: templateHtml,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setTemplateLoadedFromFirestore(true);
      setMessage({ type: 'success', text: 'Template saved.' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to save template' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const copyHtmlToClipboard = async () => {
    try {
      const text = templateHtml || '';
      if (!text.trim()) {
        setMessage({ type: 'error', text: 'No HTML to copy' });
        return;
      }
      await navigator.clipboard.writeText(text);
      setMessage({ type: 'success', text: 'HTML copied to clipboard.' });
    } catch (_e) {
      // Fallback for older browsers / denied permissions
      try {
        const el = document.createElement('textarea');
        el.value = templateHtml || '';
        el.setAttribute('readonly', 'true');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setMessage({ type: 'success', text: 'HTML copied to clipboard.' });
      } catch {
        setMessage({ type: 'error', text: 'Failed to copy HTML to clipboard' });
      }
    }
  };

  const sendTest = async () => {
    if (!activeSequence) return;
    if (!testEmail.trim()) {
      setMessage({ type: 'error', text: 'Please enter a test email address' });
      return;
    }
    if (activeSequence.id === 'macra-web-offer-24h-v1' && !testUserId.trim()) {
      setMessage({ type: 'error', text: 'Macra web offer tests need a real user ID so the CTA can apply checkout to the correct account.' });
      return;
    }

    setSending(true);
    setMessage(null);
    setLastTestCheckoutUrl('');
    try {
      const resp = await fetch(activeSequence.functionPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: testEmail.trim(),
          firstName: testName.trim() || undefined,
          userId: testUserId.trim() || undefined,
          subjectOverride: templateSubject.trim() || undefined,
          htmlOverride: templateHtml.trim() || undefined,
          isTest: true,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.error || `Failed to send test email (HTTP ${resp.status})`);
      }
      const successMessage = 'Test email sent successfully.';
      setLastTestCheckoutUrl(typeof json?.checkoutUrl === 'string' ? json.checkoutUrl : '');
      setMessage({ type: 'success', text: successMessage });
      dispatch(showToast({ message: successMessage, type: 'success' }));
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to send test email';
      setMessage({ type: 'error', text: errorMessage });
      dispatch(showToast({ message: errorMessage, type: 'error', duration: 5000 }));
    } finally {
      setSending(false);
    }
  };

  const copyLastTestCheckoutUrl = async () => {
    if (!lastTestCheckoutUrl) return;
    await navigator.clipboard.writeText(lastTestCheckoutUrl);
    setMessage({ type: 'success', text: 'Generated offer link copied to clipboard.' });
  };

  const activeTestRequiresUserId = activeSequence?.id === 'macra-web-offer-24h-v1';

  return (
    <AdminRouteGuard>
      <Head>
        <title>Email Sequences | Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Mail className="w-7 h-7 text-[#d7ff00]" />
                Email Sequences
              </h1>
              <p className="text-zinc-400 mt-1">See what emails get sent when, and send test emails.</p>
            </div>
          </div>

          {message && (
            <div
              className={`mb-6 p-4 rounded-xl border ${message.type === 'success'
                ? 'bg-green-900/20 border-green-800 text-green-400'
                : message.type === 'error'
                  ? 'bg-red-900/20 border-red-800 text-red-400'
                  : 'bg-blue-900/20 border-blue-800 text-blue-400'
                }`}
            >
              <div className="flex items-center gap-2">
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                {message.text}
              </div>
            </div>
          )}

          <div className="bg-[#1a1e24] rounded-xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold">Sequence List</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/70">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Trigger</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Subject</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {SEQUENCES.map((seq) => {
                    const scheduleEnabled = isScheduleEnabled(seq);
                    const campaignConfig = getCampaignConfig(seq);
                    const showCampaignControls = hasCampaignControls(seq);
                    return (
                    <tr key={seq.id} className="hover:bg-zinc-900/30">
                      <td className="px-4 py-3 text-zinc-200 font-medium">{seq.name}</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {seq.trigger}
                        <div className="text-xs text-zinc-500 mt-1">
                          Runtime: {seq.deliveryRuntime === 'firebase' ? 'Firebase Functions' : 'Netlify Functions'}
                        </div>
                        {seq.scheduleConfigDocId ? (
                          <div className="mt-2 space-y-1">
                            <div
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${scheduleEnabled
                                ? 'bg-green-900/20 border-green-700/70 text-green-300'
                                : 'bg-amber-900/20 border-amber-700/70 text-amber-300'
                                }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${scheduleEnabled ? 'bg-green-300' : 'bg-amber-300'}`} />
                              {scheduleEnabled ? 'Enabled' : 'Paused'}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {seq.scheduleDescription || 'Scheduled automation'}
                            </div>
                            {showCampaignControls ? (
                              <>
                                <div className="text-xs text-zinc-500">
                                  Delay: {campaignConfig.delayHours}h · Batch: {campaignConfig.batchLimit} · Max sends/run: {campaignConfig.maxSendsPerRun}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  Scan every {campaignConfig.scanEveryHours}h · Window: {campaignConfig.sendWindowStartLocal}-{campaignConfig.sendWindowEndLocal} Eastern
                                </div>
                              </>
                            ) : null}
                            {seq.supportsScheduleTime !== false ? (
                              <div className="text-xs text-zinc-500">
                                Send time: {(scheduleTimeById[seq.id] || '14:00').trim()} UTC
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{seq.defaultSubject}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {seq.openInAdminPath ? (
                            <a
                              href={seq.openInAdminPath}
                              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                              title={seq.openInAdminLabel || 'Open in admin'}
                            >
                              <Eye className="w-4 h-4" />
                              {seq.openInAdminLabel || 'Open'}
                            </a>
                          ) : null}
                          {seq.scheduleConfigDocId ? (
                            <>
                              <button
                                onClick={() => toggleScheduleEnabled(seq)}
                                disabled={savingScheduleId === seq.id}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${scheduleEnabled
                                  ? 'bg-amber-900/30 hover:bg-amber-900/50 text-amber-200 border border-amber-800/60'
                                  : 'bg-green-900/30 hover:bg-green-900/50 text-green-200 border border-green-800/60'
                                  }`}
                                title={scheduleEnabled ? 'Pause this automation' : 'Enable this automation'}
                              >
                                {savingScheduleId === seq.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {scheduleEnabled ? 'Pause' : 'Enable'}
                              </button>
                              <button
                                onClick={() => openScheduleModal(seq)}
                                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                                title="Edit automation settings"
                              >
                                <Clock className="w-4 h-4" />
                                {showCampaignControls ? 'Configure' : 'Settings'}
                              </button>
                            </>
                          ) : null}
                          {seq.supportsTemplateEditing !== false ? (
                            <button
                              onClick={() => openEditModal(seq)}
                              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                              View / edit
                            </button>
                          ) : null}
                          {seq.supportsTestSend !== false ? (
                            <button
                              onClick={() => openTestModal(seq)}
                              className="flex items-center gap-2 px-3 py-2 bg-[#d7ff00] text-black hover:bg-[#c5eb00] rounded-lg text-sm font-medium transition-colors"
                            >
                              <Send className="w-4 h-4" />
                              Send test
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isTestModalOpen && activeSequence && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white">Send test email</h2>
                <p className="text-sm text-zinc-400 mt-1">{activeSequence.name}</p>
              </div>
              <button
                onClick={() => setIsTestModalOpen(false)}
                disabled={sending}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Test email address</label>
                <input
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors"
                  disabled={sending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Name (optional)</label>
                <input
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="Tremaine"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors"
                  disabled={sending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  User ID {activeTestRequiresUserId ? '(required for this sequence)' : '(optional)'}
                </label>
                <input
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  placeholder="Paste a real user ID for signed offer links"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors"
                  disabled={sending}
                />
                <p className="text-xs text-zinc-500 mt-2">
                  Macra offer CTAs need this so the signed checkout bridge can apply the offer to the correct account.
                </p>
                {lastTestCheckoutUrl ? (
                  <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-900/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-zinc-400 truncate">{lastTestCheckoutUrl}</p>
                      <button
                        type="button"
                        onClick={copyLastTestCheckoutUrl}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => setIsTestModalOpen(false)}
                disabled={sending}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendTest}
                disabled={sending || !testEmail.trim() || (activeTestRequiresUserId && !testUserId.trim())}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${sending || !testEmail.trim() || (activeTestRequiresUserId && !testUserId.trim())
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-[#d7ff00] text-black hover:bg-[#c5eb00]'
                  }`}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send test
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isScheduleModalOpen && scheduleEditingSequence && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-zinc-300" />
                  {hasCampaignControls(scheduleEditingSequence) ? 'Configure campaign' : 'Automation settings'}
                </h2>
                <p className="text-sm text-zinc-400 mt-1">{scheduleEditingSequence.name}</p>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                disabled={savingSchedule}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(90vh-180px)] overflow-y-auto">
              <label className="flex items-center justify-between gap-4 rounded-xl border border-zinc-700 bg-zinc-900/70 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-white">Automation enabled</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Disabled automations exit before scanning users or sending email.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={scheduleEnabledDraft}
                  onChange={(e) => setScheduleEnabledDraft(e.target.checked)}
                  disabled={savingSchedule}
                  className="h-5 w-5 accent-[#d7ff00]"
                />
              </label>

              {scheduleEditingSequence.scheduleDescription ? (
                <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Schedule</div>
                  <div className="text-sm text-zinc-300">{scheduleEditingSequence.scheduleDescription}</div>
                </div>
              ) : null}

              {hasCampaignControls(scheduleEditingSequence) ? (
                <div className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-4">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="text-sm font-semibold text-white">Campaign launch controls</div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Use a small max-send cap for canaries, then increase it after the first run looks clean.
                      </div>
                    </div>
                    <span className="rounded-full border border-[#d7ff00]/30 bg-[#d7ff00]/10 px-2.5 py-1 text-[11px] font-bold text-[#d7ff00]">
                      Canary-safe
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Delay after onboarding</label>
                      <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 focus-within:border-[#d7ff00]">
                        <input
                          type="number"
                          min={1}
                          max={168}
                          step={1}
                          value={delayHoursDraft}
                          onChange={(e) => setDelayHoursDraft(e.target.value)}
                          disabled={savingSchedule}
                          className="w-full bg-transparent px-3 py-3 text-white outline-none"
                        />
                        <span className="pr-3 text-xs text-zinc-500">hours</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Users scanned/run</label>
                      <input
                        type="number"
                        min={25}
                        max={1000}
                        step={1}
                        value={batchLimitDraft}
                        onChange={(e) => setBatchLimitDraft(e.target.value)}
                        disabled={savingSchedule}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-[#d7ff00]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Max sends/run</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        step={1}
                        value={maxSendsPerRunDraft}
                        onChange={(e) => setMaxSendsPerRunDraft(e.target.value)}
                        disabled={savingSchedule}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-[#d7ff00]"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Scan frequency</label>
                      <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950 focus-within:border-[#d7ff00]">
                        <input
                          type="number"
                          min={1}
                          max={24}
                          step={1}
                          value={scanEveryHoursDraft}
                          onChange={(e) => setScanEveryHoursDraft(e.target.value)}
                          disabled={savingSchedule}
                          className="w-full bg-transparent px-3 py-3 text-white outline-none"
                        />
                        <span className="pr-3 text-xs text-zinc-500">hours</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Window starts</label>
                      <select
                        value={sendWindowStartDraft}
                        onChange={(e) => setSendWindowStartDraft(e.target.value)}
                        disabled={savingSchedule}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-[#d7ff00]"
                      >
                        {scheduleOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Window ends</label>
                      <select
                        value={sendWindowEndDraft}
                        onChange={(e) => setSendWindowEndDraft(e.target.value)}
                        disabled={savingSchedule}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-[#d7ff00]"
                      >
                        {scheduleOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                    Send windows use Eastern time. If the start time is later than the end time, the window wraps overnight.
                  </p>

                  <div className="mt-3 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
                    Recommended first launch: delay 24h, scan 50 users, max 5 sends per run, scan every 3h during your preferred Eastern-time window.
                  </div>
                </div>
              ) : null}

              {scheduleEditingSequence.supportsScheduleTime !== false ? (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Daily send time (UTC)</label>
                  <select
                    value={scheduleTimeDraft}
                    onChange={(e) => setScheduleTimeDraft(e.target.value)}
                    disabled={savingSchedule}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-[#d7ff00] transition-colors"
                  >
                    {scheduleOptions.map((t) => (
                      <option key={t} value={t}>
                        {t} UTC
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-zinc-500 mt-2">
                    Note: times are in 30-minute increments.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  This automation runs on the Netlify cron schedule shown above; this admin switch controls whether it is allowed to send.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                disabled={savingSchedule}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveScheduleTime}
                disabled={savingSchedule}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${savingSchedule ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' : 'bg-[#d7ff00] text-black hover:bg-[#c5eb00]'
                  }`}
              >
                {savingSchedule ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save automation'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && activeSequence && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-zinc-300" />
                  Edit email template
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  {activeSequence.name}
                  {templateLoadedFromFirestore ? ' • Saved template' : ' • Not saved yet (using default on send)'}
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                disabled={savingTemplate || loadingTemplate}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Modal message banner (so Save feedback is visible even with the overlay) */}
            {message && (
              <div className="px-6 pt-6">
                <div
                  className={`p-4 rounded-xl border ${message.type === 'success'
                    ? 'bg-green-900/20 border-green-800 text-green-400'
                    : message.type === 'error'
                      ? 'bg-red-900/20 border-red-800 text-red-400'
                      : 'bg-blue-900/20 border-blue-800 text-blue-400'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    {message.type === 'success' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                    {message.text}
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {loadingTemplate ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-10 h-10 animate-spin text-[#d7ff00]" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">Subject</label>
                      <input
                        value={templateSubject}
                        onChange={(e) => setTemplateSubject(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-zinc-400">HTML</label>
                        <button
                          type="button"
                          onClick={copyHtmlToClipboard}
                          disabled={!templateHtml.trim()}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200"
                          title="Copy HTML to clipboard"
                        >
                          <Copy className="w-4 h-4" />
                          Copy HTML
                        </button>
                      </div>
                      <textarea
                        value={templateHtml}
                        onChange={(e) => setTemplateHtml(e.target.value)}
                        placeholder="Paste the full HTML email here (<!doctype html> ...)"
                        className="w-full h-[520px] px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors resize-none font-mono text-xs"
                      />
                      <p className="text-xs text-zinc-500 mt-2">
                        This HTML is what gets sent to users. Save to apply across real sends.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Preview
                      </h3>
                      <a
                        className="text-xs text-zinc-400 underline"
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          const w = window.open('', '_blank');
                          if (w) {
                            w.document.open();
                            w.document.write(previewSrcDoc || '<p>No HTML</p>');
                            w.document.close();
                          }
                        }}
                      >
                        Open in new tab
                      </a>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
                      <iframe
                        title="Email preview"
                        srcDoc={previewSrcDoc || '<p style=\"color:#999;font-family:Arial\">No HTML to preview</p>'}
                        style={{ width: '100%', height: 640, border: 'none', background: '#0a0a0b' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => setIsEditModalOpen(false)}
                disabled={savingTemplate || loadingTemplate}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Close
              </button>
              <button
                onClick={saveTemplate}
                disabled={savingTemplate || loadingTemplate || !templateSubject.trim() || !templateHtml.trim()}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${savingTemplate || loadingTemplate || !templateSubject.trim() || !templateHtml.trim()
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-[#d7ff00] text-black hover:bg-[#c5eb00]'
                  }`}
              >
                {savingTemplate ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save template'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default EmailSequencesAdmin;
