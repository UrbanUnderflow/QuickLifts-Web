import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Plus, RefreshCw, Search, X } from 'lucide-react';
import { channelLabel, type InboxMessage, type MessagesInboxData, type MessageChannel } from '../../lib/coach-communications/timeline';
import s from './CoachMessagesInbox.module.css';

type Props = { teamId?: string; coachId?: string; isDemo?: boolean; preview?: boolean; athletes?: { id: string; displayName: string }[] };
const empty: MessagesInboxData = { recipients: [], messages: [], hasOlder: false };
type InboxData = MessagesInboxData & { smsNextCursor?: string | null };
type Pending = { requestId: string; athleteIds: string[]; text: string; channels: MessageChannel[] };
export default function CoachMessagesInbox({ teamId, coachId, isDemo = false, preview = false, athletes = [] }: Props) {
  const [data, setData] = useState<InboxData>(empty), [selected, setSelected] = useState('');
  const [search, setSearch] = useState(''), [unreadOnly, setUnreadOnly] = useState(false);
  const [newMessage, setNewMessage] = useState(false), [recipientSearch, setRecipientSearch] = useState(''), [recipients, setRecipients] = useState<string[]>([]);
  const [text, setText] = useState(''), [app, setApp] = useState(true), [sms, setSms] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingKey = `pulse-coach-message:${coachId || ''}:${teamId || ''}`;
  const clearPending = () => { setPending(null); if (!preview && !isDemo) { try { sessionStorage.removeItem(pendingKey); } catch {} } };
  const previewHistory = useRef(new Map<string, InboxMessage[]>()), previewRequests = useRef(new Set<string>());
  const generation = useRef(0), currentSelection = useRef(selected), readKey = useRef('');
  const history = useRef(new Map<string, InboxMessage>()), bottom = useRef<HTMLDivElement>(null);
  currentSelection.current = selected;
  const targetIds = newMessage ? recipients : selected ? [selected] : [];
  const targets = data.recipients.filter(person => targetIds.includes(person.id));
  const textReason = targets.find(person => !person.textAvailable)?.textReason || null;
  const textAvailable = targets.length > 0 && !textReason && targets.every(person => person.textAvailable);
  const selectedPerson = data.recipients.find(person => person.id === selected);
  const request = useCallback(async (body?: Record<string, unknown>, athleteId = '', cursor?: string) => {
    if (preview) {
      if (body?.action === 'send') {
        const attempt = body as unknown as Pending;
        const duplicate = previewRequests.current.has(attempt.requestId);
        if (!duplicate) {
          previewRequests.current.add(attempt.requestId);
          for (const id of attempt.athleteIds) {
            const message: InboxMessage = { id: `${attempt.requestId}-${id}`, athleteId: id, text: attempt.text, direction: 'outgoing', atMs: Date.now(), channels: { ...(attempt.channels.includes('app') ? { app: { status: 'saved' } } : {}), ...(attempt.channels.includes('sms') ? { sms: { status: 'queued' } } : {}) } };
            previewHistory.current.set(id, [...(previewHistory.current.get(id) || []), message]);
          }
          setData(previous => ({ ...previous, messages: previewHistory.current.get(currentSelection.current) || [], recipients: previous.recipients.map(person => attempt.athleteIds.includes(person.id) ? { ...person, lastMessage: attempt.text, lastAtMs: Date.now() } : person) }));
        }
        return { duplicate };
      }
      if (body?.action === 'retry') {
        const id = String(body.athleteId), messages = (previewHistory.current.get(id) || []).map(message => message.id === body.messageId ? { ...message, channels: { ...message.channels, sms: { status: 'queued' } } } : message);
        previewHistory.current.set(id, messages); setData(previous => ({ ...previous, messages }));
      }
      return {};
    }
    const { auth, getFirebaseModeRequestHeaders } = await import('../../api/firebase/config');
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Sign in to open Messages.');
    const response = await fetch(`/api/coach/communications/inbox${body ? '' : `?teamId=${encodeURIComponent(teamId || '')}${athleteId ? `&athleteId=${encodeURIComponent(athleteId)}` : ''}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`}`, {
      method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...getFirebaseModeRequestHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify({ ...body, teamId }) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || 'Messages are unavailable.'), { notSaved: result.notSaved === true });
    return result;
  }, [teamId, preview]);
  const refresh = useCallback(async (cursor?: string) => {
    if (isDemo || preview || !teamId || !coachId) return;
    const stamp = generation.current, athleteId = currentSelection.current;
    try {
      const next = await request(undefined, athleteId, cursor) as InboxData;
      if (stamp !== generation.current || athleteId !== currentSelection.current) return;
      if (cursor) next.messages.forEach(message => history.current.set(message.id, message));
      else {
        // Keep loaded older history while refreshing the latest delivery evidence.
        next.messages.forEach(message => history.current.set(message.id, message));
      }
      next.messages = [...history.current.values()].sort((a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id));
      setData(next); setError('');
    } catch (failure) { if (stamp === generation.current) setError((failure as Error).message); }
    finally { if (stamp === generation.current) setLoading(false); }
  }, [coachId, isDemo, preview, request, teamId]);
  useEffect(() => {
    generation.current++; history.current.clear(); readKey.current = '';
    setData(empty); setSelected(''); setPending(null); setText(''); setNewMessage(false); setRecipients([]); setError(''); setNotice('');
    if (preview) {
      const people = [{ id: 'jordan', name: 'Jordan Lee', textAvailable: true, textReason: null }, { id: 'avery', name: 'Avery Cole', textAvailable: true, textReason: null }, { id: 'sam', name: 'Sam Rivera', textAvailable: false, textReason: 'This athlete has opted out of texts. App messages are available.' }, { id: 'taylor', name: 'Taylor Brooks', textAvailable: false, textReason: 'Texting setup is pending. App messages are available.' }].map((person, index) => ({ ...person, unread: index === 1, lastMessage: index === 0 ? 'Thanks, coach. See you there.' : index === 1 ? 'Can we talk before practice?' : 'Looking forward to this week.', lastAtMs: Date.now() - index * 3600000 }));
      for (const person of people) previewHistory.current.set(person.id, [{ id: `${person.id}-1`, athleteId: person.id, text: 'Can we talk before practice tomorrow?', direction: 'incoming', atMs: Date.now() - 7200000, channels: { app: { status: 'received' } } }, { id: `${person.id}-2`, athleteId: person.id, text: 'Of course. Let’s meet at 3:30 by the team room. Bring any questions you want to talk through.', direction: 'outgoing', atMs: Date.now() - 6600000, channels: { app: { status: 'read' }, ...(person.textAvailable ? { sms: { status: 'delivered' } } : {}) } }, { id: `${person.id}-3`, athleteId: person.id, text: 'Thanks, coach. See you there.', direction: 'incoming', atMs: Date.now() - 6000000, channels: { sms: { status: 'received' } } }, { id: `${person.id}-4`, athleteId: person.id, text: 'A quick reminder: our team meeting starts at 4 tomorrow.', direction: 'outgoing', atMs: Date.now() - 1800000, channels: { app: { status: 'saved' }, ...(person.textAvailable ? { sms: { status: 'failed', retryable: true } } : {}) } }]);
      setData({ recipients: people, messages: previewHistory.current.get('jordan') || [], hasOlder: false }); setSelected('jordan');
    } else if (isDemo) {
      const people = athletes.slice(0, 8).map((person, index) => ({ id: person.id, name: person.displayName, unread: index === 0, lastMessage: index === 0 ? 'Can we talk before practice?' : '', lastAtMs: index === 0 ? Date.now() : 0, textAvailable: false, textReason: 'Texting is unavailable in this demo.' }));
      setData({ recipients: people, messages: [], hasOlder: false });
    } else {
      try { const saved = JSON.parse(sessionStorage.getItem(pendingKey) || 'null'); if (saved && typeof saved.requestId === 'string' && typeof saved.text === 'string' && saved.text.length <= 1200 && Array.isArray(saved.athleteIds) && saved.athleteIds.length <= 25 && Array.isArray(saved.channels)) { setPending(saved); setText(saved.text); setSelected(saved.athleteIds[0] || ''); setNotice('A previous request still needs confirmation. Retry the same request to check its existing delivery.'); } } catch {}
    }
  }, [teamId, coachId, isDemo, preview]);
  useEffect(() => {
    generation.current++; history.current.clear(); readKey.current = ''; setData(previous => ({ ...previous, messages: [] }));
    if (preview) { setData(previous => ({ ...previous, messages: previewHistory.current.get(selected) || [], recipients: previous.recipients.map(person => person.id === selected ? { ...person, unread: false } : person) })); return; }
    if (isDemo) {
      if (selected) setData(previous => ({ ...previous, messages: [{ id: 'sample', athleteId: selected, direction: 'incoming', text: 'Can we talk before practice?', atMs: Date.now(), channels: { app: { status: 'received' } } }] }));
      return;
    }
    setLoading(true); void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 10000);
    return () => window.clearInterval(timer);
  }, [selected, refresh, isDemo, preview]);
  const targetKey = targetIds.join('|');
  useEffect(() => { setApp(true); setSms(textAvailable); }, [targetKey]);
  useEffect(() => { if (!textAvailable) setSms(false); }, [textAvailable]);
  useEffect(() => {
    const last = data.messages.at(-1);
    if (!selected || isDemo || preview || loading) return;
    const key = `${selected}:${last?.id || ''}:${last?.atMs || 0}`;
    if (readKey.current === key) return;
    readKey.current = key;
    void request({ action: 'read', athleteId: selected }).then(() => setData(previous => ({ ...previous, recipients: previous.recipients.map(person => person.id === selected ? { ...person, unread: false } : person) }))).catch(() => { readKey.current = ''; });
  }, [data.messages, isDemo, preview, loading, request, selected]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }); }, [selected, data.messages.length]);
  useEffect(() => {
    if (!newMessage) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy && !pending) { setNewMessage(false); setRecipients([]); } };
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
  }, [busy, newMessage, pending]);
  async function send() {
    if (busy || isDemo) return;
    const wasAlreadyPending = !!pending;
    const attempt = pending || { requestId: crypto.randomUUID(), athleteIds: targetIds, text: text.trim(), channels: [app ? 'app' : null, sms && textAvailable ? 'sms' : null].filter(Boolean) as MessageChannel[] };
    if (!attempt.text || !attempt.athleteIds.length || !attempt.channels.length) return;
    setBusy(true); setError(''); setPending(attempt);
    if (!preview && !isDemo) { try { sessionStorage.setItem(pendingKey, JSON.stringify(attempt)); } catch {} }
    try {
      const result = await request({ action: 'send', ...attempt });
      clearPending(); setText(''); setNewMessage(false); setRecipients([]);
      setNotice(result.duplicate ? 'This message was already saved. Its delivery status appears in the conversation.' : attempt.athleteIds.length > 1 ? `Saved privately for ${attempt.athleteIds.length} athletes. Open each conversation to check delivery.` : 'Message saved. Delivery status appears below.');
      if (selected !== attempt.athleteIds[0]) setSelected(attempt.athleteIds[0]); else await refresh();
    } catch (failure) { const editable = (failure as Error & { notSaved?: boolean }).notSaved && !wasAlreadyPending; if (editable) clearPending(); setError(`${(failure as Error).message}${editable ? '' : ' Retry this request to check the same message.'}`); }
    finally { setBusy(false); }
  }
  async function retry(messageId: string) {
    setBusy(true); setError('');
    try { await request({ action: 'retry', channel: 'sms', athleteId: selected, messageId }); await refresh(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  function choose(id: string) {
    if (pending) return;
    setSelected(id); setNewMessage(false); setRecipients([]); setNotice(''); setText('');
  }
  const filtered = data.recipients.filter(person => (!unreadOnly || person.unread) && `${person.name} ${person.lastMessage}`.toLowerCase().includes(search.toLowerCase()));
  return <section className={s.root} aria-label="Messages">
    <header className={s.heading}><div><h1>Messages</h1><p>One conversation with each athlete. Choose how your reply reaches them.</p></div><button type="button" onClick={() => void refresh()} disabled={busy || isDemo || loading} aria-label="Refresh messages"><RefreshCw size={17} /> Refresh</button></header>
    {error && <p role="alert" className={s.error}>{error}</p>}{notice && <p role="status" className={s.notice}>{notice}</p>}
    {preview && <p className={s.notice}>Local preview with fictional athletes. Messages and retries stay on this page.</p>}{isDemo && <p className={s.notice}>Sample conversations. Sending is disabled.</p>}
    <div className={s.inbox}>
      <aside className={s.sidebar} aria-label="Athlete conversations">
        <button type="button" className={s.newButton} disabled={busy || !!pending || !data.recipients.length} onClick={() => { setNewMessage(true); setRecipients([]); setText(''); setRecipientSearch(''); }}><Plus size={17} /> New message</button>
        <label className={s.search}><Search size={17} /><input aria-label="Search messages" placeholder="Search athletes or messages" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label className={s.unread}><input type="checkbox" checked={unreadOnly} onChange={event => setUnreadOnly(event.target.checked)} /> Unread only</label>
        <div className={s.threadList}>{filtered.map(person => <button type="button" key={person.id} className={person.id === selected && !newMessage ? s.selectedThread : s.thread} aria-current={person.id === selected && !newMessage ? 'true' : undefined} disabled={!!pending} onClick={() => choose(person.id)}><span className={s.avatar}>{person.name.split(' ').map(word => word[0]).slice(0, 2).join('')}</span><span className={s.threadCopy}><strong>{person.name}{person.unread && <span className={s.unreadDot} aria-label="Unread" />}</strong><small>{person.lastMessage || 'Start a conversation'}</small></span></button>)}</div>
        {!filtered.length && <p className={s.emptyList}>{loading ? 'Loading conversations…' : search || unreadOnly ? 'No matching conversations.' : 'Your active athletes appear here.'}</p>}
      </aside>
      <div className={s.conversation}>
        {(selectedPerson || newMessage) ? <>
          <header className={s.threadHeader}><div><h2>{newMessage ? 'New message' : selectedPerson?.name}</h2><p>{newMessage ? 'Each athlete receives a separate private message.' : 'App and Text replies stay together here.'}</p></div></header>
          {newMessage && <div className={s.recipientPicker}><label className={s.search}><Search size={17} /><input aria-label="Find recipients" placeholder="Find an athlete" value={recipientSearch} onChange={event => setRecipientSearch(event.target.value)} /></label><p>{recipients.length}/25 selected</p><div>{data.recipients.filter(person => person.name.toLowerCase().includes(recipientSearch.toLowerCase())).map(person => <label key={person.id}><input type="checkbox" checked={recipients.includes(person.id)} disabled={!!pending || busy || recipients.length >= 25 && !recipients.includes(person.id)} onChange={event => setRecipients(previous => event.target.checked ? [...previous, person.id] : previous.filter(id => id !== person.id))} />{person.name}</label>)}</div><button type="button" disabled={busy || !!pending} onClick={() => { setNewMessage(false); setRecipients([]); }}><X size={15} /> Cancel new message</button></div>}
          {!newMessage && <div className={s.timeline} aria-live="polite" aria-label={`Conversation with ${selectedPerson?.name}`}>
            {loading && !data.messages.length ? <p className={s.emptyConversation}>Loading messages…</p> : !data.messages.length ? <p className={s.emptyConversation}>Start a conversation with {selectedPerson?.name}.</p> : data.messages.map(message => <article key={message.id} className={message.direction === 'outgoing' ? s.outgoing : s.incoming}>
              <p>{message.text}</p><div className={s.statuses}>{(['app', 'sms'] as MessageChannel[]).filter(channel => message.channels[channel]).map(channel => <span key={channel}>{channelLabel(channel, message.channels[channel]!)}{message.channels[channel]?.reason && <span> · {message.channels[channel]!.reason}</span>}</span>)}</div>
              <time dateTime={new Date(message.atMs).toISOString()}>{new Date(message.atMs).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
              {message.direction === 'outgoing' && message.channels.sms?.retryable && <button type="button" disabled={busy || !selectedPerson?.textAvailable || !!pending || isDemo} onClick={() => void retry(message.id)}>Retry Text only</button>}
            </article>)}
            {data.smsNextCursor && <button type="button" className={s.older} disabled={busy || loading || isDemo} onClick={() => void refresh(data.smsNextCursor!)}>Load older texts</button>}
            {data.hasOlder && <p className={s.historyNote}>Showing the latest 200 App messages per conversation.</p>}<div ref={bottom} />
          </div>}
          <form className={s.composer} onSubmit={event => { event.preventDefault(); void send(); }}>
            <label className={s.composeLabel}>Message<textarea aria-label="Message" maxLength={1200} placeholder={targets.length > 1 ? 'Write a private message for each selected athlete' : 'Write your message'} value={text} onChange={event => setText(event.target.value)} disabled={busy || !!pending} /></label>
            <div className={s.composeFooter}><div className={s.channels}><label><input type="checkbox" checked={app} disabled={busy || !!pending} onChange={event => setApp(event.target.checked)} /> App</label><label title={textReason || undefined}><input type="checkbox" checked={sms} disabled={!textAvailable || busy || !!pending} onChange={event => setSms(event.target.checked)} /> Text</label></div><small>{text.length}/1,200</small><button type="submit" className={s.sendButton} disabled={busy || isDemo || !pending && (!text.trim() || !targets.length || !app && !sms)}>{busy ? 'Saving…' : pending ? 'Retry same request' : targets.length > 1 ? `Send privately to ${targets.length}` : 'Send'}</button></div>
            {textReason && <p className={s.channelReason}>{textReason}</p>}{sms && <p className={s.channelReason}>Texts include “Reply STOP to opt out.” Longer texts may use multiple segments.</p>}
          </form>
        </> : <div className={s.blank}><MessageSquare size={32} /><h2>Keep the conversation together</h2><p>Choose an athlete or start a new message.</p></div>}
      </div>
    </div>
  </section>;
}
