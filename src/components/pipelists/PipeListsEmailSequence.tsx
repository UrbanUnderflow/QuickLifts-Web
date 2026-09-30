import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import PipeListsEmailTracking, { trackingStatusLabel } from './PipeListsEmailTracking';
import { ArrowLeft, Mail, Pause, Play, Save } from 'lucide-react';
import {
  createSequenceDraft, SEQUENCE_AUDIENCES, SEQUENCE_SENDERS, sequenceDay, unresolvedSequenceFields,
  type EmailSequence, type SequenceAudience, type SequenceDraft, type SequenceStep,
} from '../../utils/pipelistsEmailSequence';

type Props = {
  user: Pick<User, 'getIdToken'>;
  listId: string;
  item: { id: string; title: string; organization: string; contactEmails: string[]; lastEmailSentAt?: string };
  onClose: () => void;
};
const fieldClass = 'w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-stone-500 disabled:cursor-not-allowed disabled:opacity-60';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50';
const dateLabel = (value: string) => new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
}).format(new Date(value));
const draftFrom = (sequence: EmailSequence): SequenceDraft => ({
  audience: sequence.audience, fromEmail: sequence.fromEmail, toEmail: sequence.toEmail, steps: sequence.steps,
});

export default function PipeListsEmailSequence({ user, listId, item, onClose }: Props) {
  const [sequence, setSequence] = useState<EmailSequence | null>(null);
  const [draft, setDraft] = useState(() => createSequenceDraft('athletic-directors', item.organization || item.title, item.contactEmails[0] || ''));
  const [baseline, setBaseline] = useState('');
  const [selectedStep, setSelectedStep] = useState(0);
  const [customRecipient, setCustomRecipient] = useState(item.contactEmails.length === 0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshingTracking, setRefreshingTracking] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const dirty = baseline !== '' && JSON.stringify(draft) !== baseline;
  const dirtyRef = useRef(dirty);
  const busyRef = useRef(busy);
  dirtyRef.current = dirty;
  busyRef.current = busy;
  const hasStarted = Boolean(sequence?.steps.some(step => step.sentAt));
  const completed = sequence?.status === 'completed';
  const active = sequence?.status === 'active';
  const step = draft.steps[selectedStep];
  const missingFields = unresolvedSequenceFields(draft.steps);
  const canStart = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(draft.toEmail) && missingFields.length === 0 && draft.steps.every(row => row.subject.trim() && row.body.trim());

  const request = useCallback(async (body?: Record<string, unknown>) => {
    const token = await user.getIdToken();
    const response = await fetch(`/api/pipelists/email-sequence?${new URLSearchParams({ listId, itemId: item.id })}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify({ ...body, listId, itemId: item.id }) } : {}),
    });
    const result = await response.json();
    if (!response.ok || result.success === false) throw new Error(result.error || 'Unable to load the email sequence.');
    return result.sequence as EmailSequence | null;
  }, [user, listId, item.id]);

  const serverVersionRef = useRef(0);
  const accept = useCallback((next: EmailSequence | null, selectNext = false) => {
    if ((next?.version || 0) < serverVersionRef.current) return;
    serverVersionRef.current = next?.version || 0;
    const nextDraft = next ? draftFrom(next) : createSequenceDraft('athletic-directors', item.organization || item.title, item.contactEmails[0] || '');
    setSequence(next);
    setDraft(nextDraft);
    setBaseline(JSON.stringify(nextDraft));
    setCustomRecipient(!item.contactEmails.includes(nextDraft.toEmail));
    if (selectNext) setSelectedStep(Math.min(next?.nextStepIndex || 0, nextDraft.steps.length - 1));
  }, [item.organization, item.title, item.contactEmails]);
  const mergeTracking = useCallback((next: EmailSequence | null) => {
    if (!next) return;
    if (next.version !== serverVersionRef.current) {
      setMessage({ error: true, text: 'The sequence changed while you were editing. Reload its saved status before saving your changes.' });
      return;
    }
    setSequence(current => current ? {
      ...current,
      steps: current.steps.map(row => ({ ...row, tracking: next.steps.find(step => step.id === row.id)?.tracking })),
    } : current);
  }, []);
  const refreshTracking = async () => {
    if (busyRef.current || refreshingTracking) return;
    setRefreshingTracking(true);
    try {
      const next = await request({ action: 'refresh-tracking' });
      if (dirtyRef.current) mergeTracking(next);
      else accept(next);
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : 'Unable to refresh email tracking.' });
    } finally { setRefreshingTracking(false); }
  };
  const acceptRef = useRef(accept);
  acceptRef.current = accept;

  useEffect(() => {
    let cancelled = false;
    const refresh = async (initial: boolean) => {
      if (!initial && busyRef.current) return;
      try {
        const next = await request();
        if (!cancelled && !busyRef.current) {
          if (dirtyRef.current && !initial) mergeTracking(next);
          else acceptRef.current(next, initial);
          setLoadFailed(false);
          if (initial) setLoading(false);
          if (initial && next?.steps.some(row => row.messageId)) {
            try {
              const updated = await request({ action: 'refresh-tracking' });
              if (!cancelled && !busyRef.current) {
                if (dirtyRef.current) mergeTracking(updated);
                else acceptRef.current(updated);
              }
            } catch (error) {
              if (!cancelled) setMessage({ error: true, text: error instanceof Error ? error.message : 'Unable to refresh tracking. Showing saved activity.' });
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          if (initial) setLoadFailed(true);
          setMessage({ error: true, text: error instanceof Error ? error.message : 'Unable to load the email sequence.' });
        }
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    };
    void refresh(true);
    const timer = window.setInterval(() => void refresh(false), 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [request, mergeTracking]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);

  const updateStep = (patch: Partial<SequenceStep>) => setDraft(current => ({
    ...current, steps: current.steps.map((row, index) => index === selectedStep ? { ...row, ...patch } : row),
  }));
  const mutate = async (action: 'save' | 'send' | 'pause' | 'resume') => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const next = await request({ action, expectedVersion: sequence?.version || 0, ...(action === 'save' || action === 'send' ? { sequence: draft } : {}) });
      if (action === 'pause' && dirty && next) {
        serverVersionRef.current = next.version;
        setSequence(next);
        setBaseline(JSON.stringify(draftFrom(next)));
      } else {
        accept(next, action === 'send');
      }
      if (next?.status === 'error') {
        setMessage({ error: true, text: next.lastError || 'Sending stopped. Review the delivery status before continuing.' });
        return;
      }
      if (action === 'send' && !next?.steps[0].sentAt) {
        setMessage({ error: false, text: 'Sending is in progress. Refresh status shortly.' });
        return;
      }
      setMessage({ error: false, text: action === 'save' ? 'School sequence saved.' : action === 'pause' ? 'Automatic follow-ups paused.' : action === 'resume' ? 'Automatic follow-ups resumed.' : 'First email sent. Follow-ups are scheduled.' });
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : 'Unable to update the sequence.' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const close = () => {
    if (busy) return;
    if (dirty && !window.confirm('Discard unsaved changes to this school’s email sequence?')) return;
    onClose();
  };

  return <section className="space-y-5 px-5 py-5" aria-label="School email sequence">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h4 className="text-lg font-semibold text-stone-950">Send email</h4><p className="mt-1 text-sm text-stone-600">Customize the sequence for {item.organization || item.title}.</p></div>
      <button type="button" onClick={close} disabled={busy} className={buttonClass}><ArrowLeft size={16} />Back to details</button>
    </div>
    {message && <p role={message.error ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${message.error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-stone-200 bg-stone-50 text-stone-800'}`}>{message.text}</p>}
    {loading ? <p role="status" className="text-sm text-stone-600">Loading email sequence…</p> : loadFailed ? <button className={buttonClass} type="button" onClick={async () => {
      setLoading(true);
      try { accept(await request(), true); setLoadFailed(false); setMessage(null); }
      catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : 'Unable to load.' }); }
      finally { setLoading(false); }
    }}>Retry</button> : <>
      <div className="rounded-lg border border-stone-200 bg-[#FAFAF7] p-4 text-sm text-stone-700">
        <p className="font-semibold">{completed ? 'Sequence complete' : active ? 'Automatic follow-ups on' : sequence?.status === 'paused' ? 'Sequence paused' : sequence?.status === 'error' ? 'Sequence needs attention' : 'First email ready to customize'}</p>
        {sequence?.nextSendAt && <p className="mt-1">{active ? 'Next email' : 'Scheduled date'}: {dateLabel(sequence.nextSendAt)}. Scheduled sends are checked every 15 minutes.</p>}
        {sequence?.status === 'paused' && <p className="mt-1">Resuming waits the next email’s selected gap from the time you resume.</p>}
        {!hasStarted && <p className="mt-1">Send the first email now. The next two send automatically after the gaps below, and update this lead’s next date.</p>}
        <p className="mt-1">Replies go to your selected From address. Pause this sequence when someone replies.</p>
        {sequence?.lastError && <p role="alert" className="mt-2 text-rose-800">{sequence.lastError}</p>}
        {!sequence && item.lastEmailSentAt && <p className="mt-2">This lead has earlier email activity. This sequence has not started.</p>}
      </div>
      {sequence?.steps.some(row => row.messageId) && <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-stone-500">Each email keeps its own delivery and engagement history.</p>
        <button type="button" className={buttonClass} disabled={busy || refreshingTracking} onClick={() => void refreshTracking()}>{refreshingTracking ? 'Checking email activity…' : 'Refresh email tracking'}</button>
      </div>}
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-stone-700">From<select aria-label="From" className={`${fieldClass} mt-1.5`} disabled={completed} value={draft.fromEmail} onChange={event => setDraft(current => ({ ...current, fromEmail: event.target.value }))}>{SEQUENCE_SENDERS.map(email => <option key={email}>{email}</option>)}</select></label>
          <label className="block text-sm font-semibold text-stone-700">Recipient<select aria-label="Recipient" className={`${fieldClass} mt-1.5`} value={customRecipient ? '__custom__' : draft.toEmail} disabled={hasStarted} onChange={event => {
            const custom = event.target.value === '__custom__';
            setCustomRecipient(custom);
            setDraft(current => ({ ...current, toEmail: custom ? '' : event.target.value }));
          }}>{item.contactEmails.map(email => <option key={email} value={email}>{email}</option>)}<option value="__custom__">Custom item</option></select></label>
          {customRecipient && <label className="block text-sm font-semibold text-stone-700 sm:col-span-2">Custom email<input aria-label="Custom email" className={`${fieldClass} mt-1.5`} type="email" value={draft.toEmail} disabled={hasStarted} placeholder="name@university.edu" onChange={event => setDraft(current => ({ ...current, toEmail: event.target.value.trim().toLowerCase() }))} /></label>}
          <label className="block text-sm font-semibold text-stone-700 sm:col-span-2">Sequence for<select aria-label="Sequence for" className={`${fieldClass} mt-1.5`} disabled={hasStarted} value={draft.audience} onChange={event => {
            if (dirty && !window.confirm('Replace these email drafts with the selected audience’s sequence?')) return;
            const next = createSequenceDraft(event.target.value as SequenceAudience, item.organization || item.title, draft.toEmail);
            setDraft({ ...next, fromEmail: draft.fromEmail });
            setSelectedStep(0);
          }}>{Object.entries(SEQUENCE_AUDIENCES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        </div>
        <div>
          <div role="tablist" aria-label="Sequence emails" className="flex flex-wrap gap-2">
            {draft.steps.map((row, index) => <button type="button" role="tab" id={`sequence-tab-${index}`} aria-controls="sequence-email-panel" aria-selected={selectedStep === index} key={row.id} onClick={() => setSelectedStep(index)} className={`${buttonClass} ${selectedStep === index ? '!border-stone-900 !bg-stone-900 !text-white' : ''}`}>Day {sequenceDay(draft.steps, index)} · Email {index + 1}{row.sentAt ? ` · ${trackingStatusLabel(sequence?.steps[index]?.tracking?.status, row.sentAt)}` : ''}</button>)}
          </div>
          <div id="sequence-email-panel" role="tabpanel" aria-labelledby={`sequence-tab-${selectedStep}`} className="mt-4 space-y-4 rounded-lg border border-stone-200 p-4">
            {(step.sentAt || sequence?.steps[selectedStep]?.tracking) && <PipeListsEmailTracking
              title={`Email ${selectedStep + 1} activity`}
              tracking={{ ...sequence?.steps[selectedStep]?.tracking, sentAt: step.sentAt }}
            />}
            {step.sentAt ? <p className="text-sm text-stone-600">Sent {dateLabel(step.sentAt)}. Sent emails are kept unchanged.</p> : selectedStep > 0 ? <label className="block text-sm font-semibold text-stone-700">Days after the previous email<input aria-label="Days after the previous email" type="number" min={1} max={365} className={`${fieldClass} mt-1.5 max-w-32 block`} value={step.delayDays} onChange={event => updateStep({ delayDays: Number(event.target.value) })} /></label> : <p className="text-sm text-stone-600">Sent when you select “Send email & start sequence”.</p>}
            <label className="block text-sm font-semibold text-stone-700">Subject<input aria-label="Subject" className={`${fieldClass} mt-1.5`} maxLength={180} value={step.subject} disabled={Boolean(step.sentAt)} onChange={event => updateStep({ subject: event.target.value })} /></label>
            <label className="block text-sm font-semibold text-stone-700">Message<textarea aria-label="Message" className={`${fieldClass} mt-1.5 min-h-80 resize-y font-normal leading-6`} maxLength={12000} value={step.body} disabled={Boolean(step.sentAt)} onChange={event => updateStep({ body: event.target.value })} /></label>
            <p className="text-xs leading-5 text-stone-500">Your Tremaine Grant / Pulse Intelligence Labs signature is added automatically. Changes apply only to this school.</p>
          </div>
        </div>
      </fieldset>
      {!completed && <>
        <p className="text-sm leading-6 text-stone-600">Review names, university references, claims, and resource links in all three drafts before starting.</p>
        {missingFields.length > 0 && <p className="text-sm text-amber-900">Replace these placeholders before automatic sending: {missingFields.join(', ')}.</p>}
        <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-4">
          <button type="button" disabled={busy || (!dirty && Boolean(sequence))} onClick={() => void mutate('save')} className={buttonClass}><Save size={16} />{busy ? 'Working…' : 'Save school sequence'}</button>
          {!hasStarted && sequence?.status !== 'error' && <button type="button" disabled={busy || !canStart || active} onClick={() => void mutate('send')} className={`${buttonClass} !border-stone-900 !bg-stone-900 !text-white`}><Mail size={16} />Send email &amp; start sequence</button>}
          {active && <button type="button" disabled={busy} onClick={() => void mutate('pause')} className={buttonClass}><Pause size={16} />Pause sequence / reply received</button>}
          {sequence?.status === 'paused' && <button type="button" disabled={busy || dirty || !canStart} onClick={() => void mutate('resume')} className={buttonClass}><Play size={16} />Resume sequence</button>}
          {dirty && <button type="button" disabled={busy} onClick={() => { if (window.confirm('Discard unsaved changes?')) accept(sequence); }} className={buttonClass}>Discard changes</button>}
          {!loading && <button type="button" disabled={busy} onClick={async () => {
            if (dirty && !window.confirm('Reload the saved sequence and discard unsaved changes?')) return;
            try { accept(await request()); setMessage(null); }
            catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : 'Unable to refresh.' }); }
          }} className={buttonClass}>Refresh status</button>}
        </div>
      </>}
    </>}
  </section>;
}
