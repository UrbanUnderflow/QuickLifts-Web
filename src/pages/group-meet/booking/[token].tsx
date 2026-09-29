import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

type Slot = { start: string; end: string };
type Details = { booking: Slot & { name: string; status: string; meetLink?: string; pendingAction?: { action: string; start?: string; end?: string } | null }; profile: { name: string; slug: string; durations: number[]; timezone: string } };
const field = 'w-full rounded-xl border border-white/20 bg-[#11151d] p-3 text-white focus:outline-none focus:ring-2 focus:ring-[#E0FE10]';

export default function ManageBookingPage() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [details, setDetails] = useState<Details | null>(null);
  const [zone, setZone] = useState('UTC');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'view' | 'reschedule' | 'cancel'>('view');
  const [duration, setDuration] = useState(30);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [start, setStart] = useState('');
  const [refresh, setRefresh] = useState(0);
  const busy = useRef(false);
  useEffect(() => setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'), []);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`/api/group-meet/booking/${encodeURIComponent(token)}`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load this meeting.');
      setDetails(data);
      const minutes = (Date.parse(data.booking.end) - Date.parse(data.booking.start)) / 60000;
      setDuration(data.profile.durations.includes(minutes) ? minutes : data.profile.durations[0]);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, refresh]);
  const slug = details?.profile.slug;
  useEffect(() => {
    if (mode !== 'reschedule' || !slug) return;
    const controller = new AbortController();
    setSlotsLoading(true); setSlots([]); setStart(''); setError('');
    fetch(`/api/group-meet/booking/${encodeURIComponent(token)}?duration=${duration}&slots=1`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load available times.');
      setSlots(data.slots || []);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setSlotsLoading(false); });
    return () => controller.abort();
  }, [mode, slug, duration, token]);
  const format = (value: string) => new Date(value).toLocaleString(undefined, { timeZone: zone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  async function update(action: 'cancel' | 'reschedule' | 'retry') {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/group-meet/booking/${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'reschedule' ? { action, start, duration } : { action }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update this meeting.');
      setMode('view'); setMessage(action === 'retry' ? 'Your meeting update has been confirmed.' : action === 'cancel' ? 'Your meeting has been cancelled.' : 'Your meeting has been rescheduled. Your calendar invitation will be updated.'); setRefresh(value => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to update this meeting.');
      // Re-read the persisted action so an uncertain update can be recovered after reload.
      try { const response = await fetch(`/api/group-meet/booking/${encodeURIComponent(token)}`); if (response.ok) setDetails(await response.json()); } catch { /* The current action remains available for retry. */ }
    }
    finally { busy.current = false; setSaving(false); }
  }
  const cancelled = details?.booking.status === 'cancelled' || details?.booking.status === 'canceled';
  const past = details ? Date.parse(details.booking.start) <= Date.now() : false;
  return <div className="min-h-screen bg-[#05070b] px-5 py-10 text-white">
    <Head><title>Manage your meeting | Group Meet</title><meta name="robots" content="noindex,nofollow" /><meta name="referrer" content="no-referrer" /></Head>
    <main className="mx-auto max-w-2xl rounded-[32px] border border-white/10 bg-white/[0.03] p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.2em] text-[#E0FE10]">Group Meet</p><h1 className="mt-4 text-3xl font-semibold">Manage your meeting</h1>
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">{error}</p>}
      {message && <p role="status" className="mt-6 rounded-xl border border-white/20 p-4 text-[#E0FE10]">{message}</p>}
      {loading ? <p role="status" className="py-10">Loading your meeting…</p> : details ? <>
        <section className="mt-7 space-y-3 border-b border-white/10 pb-7"><h2 className="text-xl font-semibold">Meeting with {details.profile.name}</h2><p>{format(details.booking.start)}</p><p className="text-sm text-zinc-400">{Math.round((Date.parse(details.booking.end) - Date.parse(details.booking.start)) / 60000)} minutes · {zone}</p><p className="text-zinc-300">Guest: {details.booking.name}</p>
          {cancelled ? <p className="font-semibold text-zinc-300">Cancelled</p> : details.booking.meetLink && <a href={details.booking.meetLink} target="_blank" rel="noreferrer" className="inline-block text-[#E0FE10] underline">Open Google Meet</a>}
        </section>
        {details.booking.pendingAction ? <section className="mt-7 space-y-4"><p className="text-zinc-300">Your meeting update is awaiting confirmation. Retry to complete the same update.</p><button disabled={saving} onClick={() => void update('retry')} className="rounded-xl bg-[#E0FE10] px-5 py-3 font-semibold text-black disabled:opacity-40">{saving ? 'Checking update…' : 'Retry meeting update'}</button></section> : cancelled ? <a className="mt-6 inline-block text-[#E0FE10] underline" href={`/group-meet/book/${encodeURIComponent(details.profile.slug)}`}>Book another meeting</a> : past ? <p className="mt-6 text-zinc-400">This meeting has started. Contact your host for changes.</p> : <>
          {mode === 'view' && <div className="mt-7 flex flex-wrap gap-3"><button onClick={() => { setMode('reschedule'); setMessage(''); }} className="rounded-xl bg-[#E0FE10] px-5 py-3 font-semibold text-black">Reschedule</button><button onClick={() => { setMode('cancel'); setMessage(''); }} className="rounded-xl border border-white/20 px-5 py-3">Cancel meeting</button></div>}
          {mode === 'cancel' && <section className="mt-7 space-y-4"><h2 className="text-xl font-semibold">Cancel this meeting?</h2><p className="text-zinc-300">Your calendar invitation will be cancelled.</p><div className="flex flex-wrap gap-3"><button disabled={saving} onClick={() => void update('cancel')} className="rounded-xl bg-red-700 px-5 py-3 font-semibold disabled:opacity-40">{saving ? 'Cancelling…' : 'Yes, cancel meeting'}</button><button disabled={saving} onClick={() => setMode('view')} className="rounded-xl border border-white/20 px-5 py-3">Keep meeting</button></div></section>}
          {mode === 'reschedule' && <form className="mt-7 space-y-5" onSubmit={event => { event.preventDefault(); void update('reschedule'); }}><h2 className="text-xl font-semibold">Choose a new time</h2><p className="text-sm text-zinc-400">Your current time stays booked until the new time is confirmed.</p>
            <div><label htmlFor="duration" className="mb-2 block text-sm">Meeting length</label><select id="duration" className={field} value={duration} disabled={saving} onChange={event => setDuration(Number(event.target.value))}>{details.profile.durations.map(value => <option value={value} key={value}>{value} minutes</option>)}</select></div>
            {slotsLoading ? <p role="status">Loading available times…</p> : slots.length ? <div><label htmlFor="start" className="mb-2 block text-sm">Available times in {zone}</label><select required id="start" className={field} value={start} disabled={saving} onChange={event => setStart(event.target.value)}><option value="">Choose a time</option>{slots.map(slot => <option key={slot.start} value={slot.start}>{format(slot.start)}</option>)}</select></div> : <p className="text-zinc-300">No available times for this meeting length.</p>}
            <div className="flex flex-wrap gap-3"><button disabled={saving || !start || slotsLoading} className="rounded-xl bg-[#E0FE10] px-5 py-3 font-semibold text-black disabled:opacity-40">{saving ? 'Rescheduling…' : 'Confirm new time'}</button><button type="button" disabled={saving} onClick={() => setMode('view')} className="rounded-xl border border-white/20 px-5 py-3">Keep current time</button></div>
          </form>}
        </>}
        <p className="mt-8 text-xs leading-5 text-zinc-400">Keep this link private. Anyone with it can manage this meeting.</p>
      </> : <button className="mt-6 underline" onClick={() => setRefresh(value => value + 1)}>Try again</button>}
    </main>
  </div>;
}
