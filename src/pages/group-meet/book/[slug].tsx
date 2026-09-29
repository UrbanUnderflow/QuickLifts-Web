import Head from 'next/head';
import { downloadCalendarCopy, googleCalendarCopyUrl } from '../../../lib/groupMeetCalendarExport';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useRef, useState } from 'react';

type Slot = { start: string; end: string };
type Profile = { name: string; description?: string; durations: number[]; timezone: string };
type Attempt = { key: string; id: string; payload: { name: string; email: string; start: string; duration: number } };
type Booking = Slot & { name: string; email: string; meetLink?: string; managementToken: string };
const field = 'w-full rounded-xl border border-white/20 bg-[#11151d] p-3 text-white focus:outline-none focus:ring-2 focus:ring-[#E0FE10]';

export default function BookMeetingPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === 'string' ? router.query.slug : '';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [duration, setDuration] = useState(30);
  const [zone, setZone] = useState('UTC');
  const [day, setDay] = useState('');
  const [start, setStart] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [refresh, setRefresh] = useState(0);
  const attempt = useRef<Attempt | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState<Attempt | null>(null);
  useEffect(() => {
    if (!slug) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(`group-meet-booking:${slug}`) || 'null') as Attempt | null;
      if (saved?.id && saved.payload?.start && saved.payload?.email) { attempt.current = saved; setPending(saved); setName(saved.payload.name); setEmail(saved.payload.email); setDuration(saved.payload.duration); }
    } catch { /* Storage may be unavailable. In-memory retries still retain their ID. */ }
  }, [slug]);
  useEffect(() => setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'), []);
  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setStart(''); setDay('');
    fetch(`/api/group-meet/book/${encodeURIComponent(slug)}?duration=${duration}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load availability.');
        setProfile(data.profile);
        if (!data.profile.durations.includes(duration)) setDuration(data.profile.durations[0]);
        setSlots(data.slots || []);
      }).catch(error => { if (!controller.signal.aborted) { setSlots([]); setError(error.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, duration, refresh]);
  const dayLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { timeZone: zone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const timeLabel = (value: string) => new Date(value).toLocaleTimeString(undefined, { timeZone: zone, hour: 'numeric', minute: '2-digit' });
  const days = Array.from(new Set(slots.map(slot => dayLabel(slot.start))));
  const activeDay = day || days[0] || '';
  async function submit(event?: FormEvent, retry?: Attempt) {
    event?.preventDefault();
    if (busy.current || (!retry && !start)) return;
    busy.current = true; setSaving(true); setError('');
    const payload = retry?.payload || { start, duration, name: name.trim(), email: email.trim() };
    const key = JSON.stringify(payload);
    if (retry) attempt.current = retry;
    else if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID(), payload };
    const current = attempt.current!;
    setPending(current);
    try { sessionStorage.setItem(`group-meet-booking:${slug}`, JSON.stringify(current)); } catch { /* Retain in memory. */ }
    try {
      const response = await fetch(`/api/group-meet/book/${encodeURIComponent(slug)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...current.payload, requestId: current.id }) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status < 500 && !/still being confirmed/i.test(data.error || '')) {
          attempt.current = null; setPending(null);
          try { sessionStorage.removeItem(`group-meet-booking:${slug}`); } catch { /* Storage unavailable. */ }
        }
        throw new Error(data.error || 'Unable to book this time. Please try again.');
      }
      setBooking(data.booking); setPending(null); attempt.current = null;
      try { sessionStorage.removeItem(`group-meet-booking:${slug}`); } catch { /* Storage unavailable. */ }
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to book this time.'); }
    finally { busy.current = false; setSaving(false); }
  }
  const calendarCopy = booking && profile ? { ...booking, host: profile.name } : null;
  return <div className="min-h-screen bg-[#05070b] px-5 py-10 text-white">
    <Head><title>{`${profile ? `Book time with ${profile.name}` : 'Book a meeting'} | Group Meet`}</title><meta name="robots" content="noindex,nofollow" /><meta name="referrer" content="no-referrer" /></Head>
    <main className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-white/[0.03] p-6 sm:p-10">
      <p className="text-xs uppercase tracking-[0.2em] text-[#E0FE10]">Group Meet · Individual meetings</p>
      <h1 className="mt-4 text-3xl font-semibold">{booking ? 'Your meeting is booked' : profile ? `Book time with ${profile.name}` : 'Book a meeting'}</h1>
      {profile?.description && !booking && <p className="mt-3 whitespace-pre-line text-zinc-300">{profile.description}</p>}
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">{error}</div>}
      {pending && !booking && <div className="mt-6 rounded-xl border border-white/20 p-4"><p className="text-sm text-zinc-300">A booking for {dayLabel(pending.payload.start)} at {timeLabel(pending.payload.start)} is awaiting confirmation. Retry the same request to check its result.</p><button type="button" disabled={saving} onClick={() => void submit(undefined, pending)} className="mt-3 rounded-xl bg-[#E0FE10] px-4 py-2 font-semibold text-black disabled:opacity-40">{saving ? 'Checking booking…' : 'Retry booking confirmation'}</button></div>}
      {booking ? <section className="mt-8 space-y-5">
        <h2 className="text-xl font-semibold">Confirmed on {profile?.name}’s calendar.</h2>
        <div className="space-y-1 text-zinc-300"><p>Guest: {booking.name}</p><p className="break-words">Invitation email: {booking.email}</p></div>
        <p className="text-xl">{dayLabel(booking.start)} · {timeLabel(booking.start)}–{timeLabel(booking.end)}</p><p className="text-sm text-zinc-400">Times shown in {zone}. Check your inbox or spam folder for your invitation. Accept it to keep your calendar up to date.</p>
        {booking.meetLink && <a className="block text-[#E0FE10] underline" href={booking.meetLink} target="_blank" rel="noreferrer">Open Google Meet</a>}
        {calendarCopy && <div className="space-y-3 rounded-xl border border-white/15 p-4"><p className="text-sm text-zinc-300">You can also save a personal calendar copy. Skip this if you already accepted the invitation. Personal copies need to be updated manually if the meeting changes.</p><div className="flex flex-wrap gap-4"><a className="text-[#E0FE10] underline" href={googleCalendarCopyUrl(calendarCopy)} target="_blank" rel="noreferrer">Add to Google Calendar</a><button type="button" className="text-[#E0FE10] underline" onClick={() => downloadCalendarCopy(calendarCopy)}>Download calendar file (.ics)</button></div></div>}
        <a className="inline-block rounded-xl bg-[#E0FE10] px-5 py-3 font-semibold text-black" href={`/group-meet/booking/${encodeURIComponent(booking.managementToken)}`}>Manage this meeting</a><p className="text-sm text-zinc-400">Keep your management link private. Use it to reschedule or cancel.</p>
      </section> : <>
        {profile && <div className="mt-7"><label className="mb-2 block text-sm" htmlFor="duration">Meeting length</label><select id="duration" className={field} value={duration} disabled={saving || !!pending} onChange={event => setDuration(Number(event.target.value))}>{profile.durations.map(value => <option key={value} value={value}>{value} minutes</option>)}</select></div>}
        <p className="mt-4 text-sm text-zinc-400">Times shown in {zone}{profile && ` · Host timezone: ${profile.timezone}`}</p>
        {loading ? <p role="status" className="py-10">Loading available times…</p> : <>
          {slots.length ? <form onSubmit={submit} className="mt-6 space-y-6">
            <div><label htmlFor="day" className="mb-2 block text-sm">Choose a day</label><select id="day" className={field} disabled={saving || !!pending} value={activeDay} onChange={event => { setDay(event.target.value); setStart(''); }}>{days.map(value => <option key={value}>{value}</option>)}</select></div>
            <fieldset disabled={saving || !!pending}><legend className="mb-3 text-sm">Choose a time</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{slots.filter(slot => dayLabel(slot.start) === activeDay).map(slot => <button type="button" key={slot.start} aria-pressed={start === slot.start} onClick={() => setStart(slot.start)} className={`rounded-xl border p-3 text-sm focus-visible:ring-2 focus-visible:ring-[#E0FE10] ${start === slot.start ? 'border-[#E0FE10] bg-[#E0FE10] font-semibold text-black' : 'border-white/20 hover:border-white/60'}`}>{timeLabel(slot.start)}</button>)}</div></fieldset>
            {start && <p className="text-sm text-zinc-300">Selected: {dayLabel(start)} at {timeLabel(start)} · {duration} minutes</p>}
            <div><label htmlFor="name" className="mb-2 block text-sm">Your name</label><input className={field} id="name" required maxLength={100} autoComplete="name" value={name} disabled={saving || !!pending} onChange={event => setName(event.target.value)} /></div>
            <div><label htmlFor="email" className="mb-2 block text-sm">Email for your invitation</label><input className={field} id="email" type="email" required maxLength={254} autoComplete="email" value={email} disabled={saving || !!pending} onChange={event => setEmail(event.target.value)} /></div>
            <button disabled={!start || saving || !!pending} className="w-full rounded-xl bg-[#E0FE10] px-5 py-3 font-semibold text-black disabled:opacity-40">{saving ? 'Booking your meeting…' : 'Confirm meeting'}</button>
          </form> : !error && <p className="py-8 text-zinc-300">There are no available times for this meeting length. Try another length or check back later.</p>}
          <button type="button" disabled={saving || !!pending} className="mt-5 text-sm text-zinc-300 underline" onClick={() => setRefresh(value => value + 1)}>Refresh availability</button>
        </>}
      </>}
    </main>
  </div>;
}
