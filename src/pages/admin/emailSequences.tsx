import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Mail, Send, Loader2, CheckCircle, AlertCircle, X, Edit3, Eye, Copy, Clock } from 'lucide-react';

type SequenceRow = {
  id: string;
  name: string;
  trigger: string;
  defaultSubject: string;
  functionPath: string;
  templateDocId: string;
  scheduleConfigDocId?: string; // if present, allows admin to set daily send time
};

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
  },
  {
    id: 'first-workout-celebration-v1',
    name: 'First Workout Completion Celebration',
    trigger: 'On first completed workout in a Round',
    defaultSubject: 'You completed your first workout - keep it rolling',
    functionPath: '/.netlify/functions/send-first-workout-celebration-email',
    templateDocId: 'first-workout-celebration-v1',
  },
  {
    id: 'streak-milestone-v1',
    name: 'Streak Milestones',
    trigger: 'When user reaches a 3, 7, 14, or 30-day streak',
    defaultSubject: '🔥 {{milestone}}-day streak - keep it alive',
    functionPath: '/.netlify/functions/send-streak-milestone-email',
    templateDocId: 'streak-milestone-v1',
  },
  {
    id: 'challenge-ending-soon-v1',
    name: 'Challenge Ending Soon',
    trigger: '72h and 24h before challenge end',
    defaultSubject: '{{hoursRemaining}}h left in {{challengeTitle}} - finish strong',
    functionPath: '/.netlify/functions/send-challenge-ending-soon-email',
    templateDocId: 'challenge-ending-soon-v1',
  },
  {
    id: 'inactivity-winback-v1',
    name: 'Inactivity Winback',
    trigger: '3d, 7d, and 14d since last meaningful activity',
    defaultSubject: "Let's get you back in motion on Pulse",
    functionPath: '/.netlify/functions/send-inactivity-winback-email',
    templateDocId: 'inactivity-winback-v1',
  },
  {
    id: 'password-reset-v1',
    name: 'Password Reset',
    trigger: 'When user requests password reset',
    defaultSubject: 'Reset your Pulse password',
    functionPath: '/.netlify/functions/send-password-reset-email',
    templateDocId: 'password-reset-v1',
  },
];

const EmailSequencesAdmin: React.FC = () => {
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [activeSequence, setActiveSequence] = useState<SequenceRow | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');
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
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleEditingSequence, setScheduleEditingSequence] = useState<SequenceRow | null>(null);
  const [scheduleTimeDraft, setScheduleTimeDraft] = useState('14:00');
  const [savingSchedule, setSavingSchedule] = useState(false);

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
        for (const seq of SEQUENCES) {
          if (!seq.scheduleConfigDocId) continue;
          const ref = doc(db, 'email-sequence-config', seq.scheduleConfigDocId);
          const snap = await getDoc(ref);
          const time = (snap.exists() ? ((snap.data() as any)?.sendTimeUtc as string) : '') || '';
          updates[seq.id] = (time || '14:00').trim();
        }
        setScheduleTimeById(updates);
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
    setIsTestModalOpen(true);
    setMessage(null);
  };

  const openScheduleModal = (seq: SequenceRow) => {
    setScheduleEditingSequence(seq);
    const existing = scheduleTimeById[seq.id] || '14:00';
    setScheduleTimeDraft(existing);
    setIsScheduleModalOpen(true);
    setMessage(null);
  };

  const saveScheduleTime = async () => {
    if (!scheduleEditingSequence?.scheduleConfigDocId) return;
    const t = (scheduleTimeDraft || '').trim();
    if (!/^\d{2}:\d{2}$/.test(t)) {
      setMessage({ type: 'error', text: 'Invalid time format' });
      return;
    }
    setSavingSchedule(true);
    try {
      const ref = doc(db, 'email-sequence-config', scheduleEditingSequence.scheduleConfigDocId);
      await setDoc(
        ref,
        {
          id: scheduleEditingSequence.scheduleConfigDocId,
          sendTimeUtc: t,
          enabled: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setScheduleTimeById((prev) => ({ ...prev, [scheduleEditingSequence.id]: t }));
      setMessage({ type: 'success', text: `Scheduled time saved: ${t} UTC` });
      setIsScheduleModalOpen(false);
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to save scheduled time' });
    } finally {
      setSavingSchedule(false);
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

    setSending(true);
    setMessage(null);
    try {
      const resp = await fetch(activeSequence.functionPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: testEmail.trim(),
          firstName: testName.trim() || undefined,
          subjectOverride: templateSubject.trim() || undefined,
          htmlOverride: templateHtml.trim() || undefined,
          isTest: true,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(json?.error || `Failed to send test email (HTTP ${resp.status})`);
      }
      setMessage({ type: 'success', text: 'Test email sent successfully.' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to send test email' });
    } finally {
      setSending(false);
    }
  };

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
                  {SEQUENCES.map((seq) => (
                    <tr key={seq.id} className="hover:bg-zinc-900/30">
                      <td className="px-4 py-3 text-zinc-200 font-medium">{seq.name}</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {seq.trigger}
                        {seq.scheduleConfigDocId ? (
                          <div className="text-xs text-zinc-500 mt-1">
                            Scheduled: {(scheduleTimeById[seq.id] || '14:00').trim()} UTC
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{seq.defaultSubject}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {seq.scheduleConfigDocId ? (
                            <button
                              onClick={() => openScheduleModal(seq)}
                              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                              title="Change scheduled time"
                            >
                              <Clock className="w-4 h-4" />
                              Schedule
                            </button>
                          ) : null}
                          <button
                            onClick={() => openEditModal(seq)}
                            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                            View / edit
                          </button>
                          <button
                            onClick={() => openTestModal(seq)}
                            className="flex items-center gap-2 px-3 py-2 bg-[#d7ff00] text-black hover:bg-[#c5eb00] rounded-lg text-sm font-medium transition-colors"
                          >
                            <Send className="w-4 h-4" />
                            Send test
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
                disabled={sending || !testEmail.trim()}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${sending || !testEmail.trim()
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
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-zinc-300" />
                  Schedule email
                </h2>
                <p className="text-sm text-zinc-400 mt-1">{scheduleEditingSequence.name} • UTC time</p>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                disabled={savingSchedule}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
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
                  'Save time'
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
