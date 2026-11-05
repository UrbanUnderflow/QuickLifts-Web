import React, { useEffect, useRef, useState } from 'react';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';
import clay from './ClayDashboard.module.css';
type Recipient = { id: string; name: string; eligible: boolean };
type Message = { id: string; athleteId: string; text: string; direction: string; status: string; atMs: number };
type Batch = { id: string; atMs: number; recipientCount: number; counts: Record<string, number> };
type Inbox = { batches?: Batch[]; recipients: Recipient[]; messages: Message[]; ready: boolean; historyLimit: number; nextCursor?: string | null };
type Draft = { requestId: string; athleteIds: string[]; text: string };
export default function CoachSmsInbox({ teamId, isDemo }: { teamId?: string; isDemo?: boolean }) {
  const [data, setData] = useState<Inbox>({ recipients: [], messages: [], ready: false, historyLimit: 200 });
  const [selected, setSelected] = useState<string[]>([]), [conversation, setConversation] = useState('');
  const [text, setText] = useState(''), [search, setSearch] = useState(''), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [notice, setNotice] = useState('');
  const [review, setReview] = useState(false), [pending, setPending] = useState<Draft | null>(null);
  const mounted = useRef(true), sending = useRef(false);
  async function request(body?: Draft, cursor?: string) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Sign in to view team texts.');
    const response = await fetch(`/api/coach/communications?teamId=${encodeURIComponent(teamId || '')}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, {
      method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...getFirebaseModeRequestHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error || 'Text messages are unavailable.'), { notQueued: result.notQueued === true });
    return result;
  }
  async function refresh() {
    if (isDemo || !teamId) { setLoading(false); return; }
    try { const next = await request(); if (mounted.current) { setData(next); setError(''); } }
    catch (e) { if (mounted.current) setError((e as Error).message); }
    finally { if (mounted.current) setLoading(false); }
  }
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; }; }, [teamId, isDemo]); // Parent keys this view by team.
  async function loadOlder() {
    if (!data.nextCursor || busy) return;
    setBusy(true);
    try {
      const older = await request(undefined, data.nextCursor);
      if (mounted.current) setData(current => ({ ...older, messages: [...older.messages, ...current.messages].filter((m, i, all) => all.findIndex(x => x.id === m.id) === i) }));
    } catch (e) { if (mounted.current) setError((e as Error).message); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function send() {
    if (sending.current) return;
    const draft = pending || { requestId: crypto.randomUUID(), athleteIds: selected, text };
    sending.current = true; setBusy(true); setPending(draft); setError('');
    try {
      const result = await request(draft);
      if (!mounted.current) return;
      setNotice(result.duplicate ? 'This group was already saved. Check its progress below; no duplicate group was created.' : 'Your group is saved. Texts are processed in small groups. Refresh to check progress.');
      setPending(null); setReview(false); setText(''); await refresh();
    } catch (e) { if (mounted.current) { if ((e as Error & {notQueued?: boolean}).notQueued) { setPending(null); setReview(false); setError((e as Error).message); } else setError(`${(e as Error).message} Check recent groups or retry this request. Saved groups continue processing even if you leave this page.`); } }
    finally { sending.current = false; if (mounted.current) setBusy(false); }
  }
  async function cancel(batchId: string) {
    setBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/coach/communications/cancel', { method: 'POST', headers: { Authorization: `Bearer ${token}`, ...getFirebaseModeRequestHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, batchId }) });
      if (!response.ok) throw new Error('Could not cancel queued texts. Refresh to check status.');
      const result = await response.json(); setNotice(`${result.canceled} queued texts canceled. Already processing messages cannot be recalled.`); await refresh();
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function pause() {
    if (!conversation || busy) return;
    setBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/coach/communications/pause', { method: 'POST', headers: { Authorization: `Bearer ${token}`, ...getFirebaseModeRequestHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, athleteId: conversation }) });
      if (!response.ok) throw new Error('Could not pause texts.');
      setNotice('Texts paused for this athlete. They can manage their own texting choice.'); await refresh();
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const recipients = data.recipients.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  const thread = data.messages.filter(m => m.athleteId === conversation);
  const eligibleSelection = selected.length > 0 && selected.every(id => data.recipients.some(r => r.id === id && r.eligible));
  return <section aria-label="Team text messages" className={`${clay.smsSurface} space-y-4`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Text messages</h2><p>Group sends reach each athlete separately. Replies appear in their own conversation.</p></div><button type="button" className={clay.outlineButton} onClick={() => void refresh()} disabled={busy || isDemo}>Refresh inbox</button></div>
    {isDemo ? <p className={clay.notice}>Texting is unavailable in this demo. No messages are sent.</p> : !data.ready && <p className={clay.notice}>Texting setup is pending. Your administrator needs to connect the sending number and incoming replies.</p>}
    {error && <p role="alert" className="text-red-800">{error}</p>}{notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Loading text messages…</p> : <>
    {!!data.batches?.length && <div className={`${clay.smsCard} rounded-2xl border p-4 space-y-2`}><h3 className="font-semibold">Recent groups</h3><p>Saved groups continue processing after you leave. Refresh to check progress. Unknown or stalled sends need support review; do not create another group to retry them.</p>{data.batches.map(batch => <article key={batch.id} className="border-t py-2"><strong>{batch.recipientCount} recipients</strong> · {new Date(batch.atMs).toLocaleString()}<p>{Object.entries(batch.counts).map(([status, count]) => `${count} ${status}`).join(', ')}</p>{batch.counts.queued > 0 && <button type="button" className={clay.outlineButton} disabled={busy} onClick={() => void cancel(batch.id)}>Cancel queued texts</button>}</article>)}</div>}
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={`${clay.smsCard} rounded-2xl border border-stone-300 bg-white p-4 space-y-3`}><h3 className="font-semibold">Recipients</h3>
        <label className="block">Find an athlete<input className="block w-full rounded border p-2" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <p className="text-sm">Choose up to 25 athletes. {selected.length} selected.</p>
        <button type="button" className={clay.outlineButton} disabled={busy || !!pending || review} onClick={() => setSelected(recipients.filter(r => r.eligible).slice(0,25).map(r => r.id))}>Select eligible athletes shown</button>
        <div className="max-h-64 overflow-y-auto">{recipients.map(r => <div key={r.id} className="flex items-center gap-3 border-b py-3"><input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.includes(r.id)} disabled={!r.eligible || busy || !!pending || review || (selected.length >= 25 && !selected.includes(r.id))} onChange={e => setSelected(ids => e.target.checked ? [...ids,r.id] : ids.filter(id => id !== r.id))} /><button type="button" className="text-left underline" onClick={() => setConversation(r.id)}>{r.name}</button>{!r.eligible && <small>Texting unavailable</small>}</div>)}</div>
        {!recipients.length && <p>No recipients available. Verified texting contacts must be linked to this team.</p>}
      </div>
      <div className={`${clay.smsCard} rounded-2xl border border-stone-300 bg-white p-4 space-y-3`}><h3 className="font-semibold">{conversation ? data.recipients.find(r => r.id === conversation)?.name : 'Conversation'}</h3>
        <div className="max-h-80 overflow-y-auto space-y-3" aria-label="Conversation messages">{thread.map(m => <article key={m.id} className={`rounded-xl p-3 ${m.direction === 'outgoing' ? 'bg-stone-100' : 'border border-stone-300'}`}><p className="whitespace-pre-wrap break-words">{m.text}</p><small>{m.direction === 'outgoing' ? 'Sent by team' : 'Athlete'} · {new Date(m.atMs).toLocaleString()} · {m.status}</small></article>)}{!thread.length && <p>{conversation ? 'No texts in the recent history.' : 'Choose an athlete to read their texts.'}</p>}</div>
        <button type="button" className={clay.outlineButton} disabled={!data.recipients.some(r => r.id === conversation && r.eligible) || busy || !!pending || review} onClick={() => setSelected([conversation])}>Reply to this athlete</button>
        <button type="button" className={clay.outlineButton} disabled={!conversation || busy || !!pending || isDemo} onClick={() => void pause()}>Pause texts for this athlete</button>
        <p className="text-sm">Refresh to check for replies. Older messages load {data.historyLimit} team texts at a time.</p>
        {data.nextCursor && <button type="button" className={clay.outlineButton} disabled={busy} onClick={() => void loadOlder()}>Load older messages</button>}
      </div>
    </div>
    <div className={`${clay.smsCard} rounded-2xl border border-stone-300 bg-white p-4 space-y-3`}><h3 className="font-semibold">Compose text</h3><label className="block">Message<textarea className="block min-h-32 w-full rounded border p-3" value={text} maxLength={1200} disabled={busy || !!pending || review} onChange={e => setText(e.target.value)} placeholder="Add your message and the approved PulseCheck app link." /></label>
      <p className="text-sm">{text.length}/1,200 characters. “Reply STOP to opt out.” is added automatically. Longer texts may use multiple billable segments.</p>
      {review && <div className="rounded border p-3"><h4 className="font-semibold">Review text to {selected.length} athletes</h4><p>{data.recipients.filter(r => selected.includes(r.id)).map(r => r.name).join(', ')}</p><p className="whitespace-pre-wrap py-2">{text.trim()}{'\nReply STOP to opt out.'}</p><p>Each athlete receives a separate text from the team number.</p></div>}
      {review ? <div className="flex gap-3"><button type="button" className={clay.outlineButton} disabled={busy || !!pending} onClick={() => setReview(false)}>Edit</button><button type="button" className={clay.outlineButton} disabled={busy || !data.ready} onClick={() => void send()}>{busy ? 'Sending…' : pending ? 'Retry same request' : `Queue ${selected.length} texts`}</button></div> : <button type="button" className={clay.outlineButton} disabled={!data.ready || !eligibleSelection || !text.trim() || busy || !!pending} onClick={() => setReview(true)}>Review text</button>}
    </div></>}
  </section>;
}
