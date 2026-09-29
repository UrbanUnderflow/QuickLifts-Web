import React, { useEffect, useRef, useState } from "react";
import type { GroupMeetCalendarSetup } from "../../lib/groupMeet";

import { validateBookingProfile, type BookingProfile } from "../../lib/groupMeetBooking";

type Props = { getAdminHeaders: () => Promise<Record<string, string>> };
const inputClass = "mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950";
const timeValue = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const timeMinutes = (value: string) => { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; };

export default function GroupMeetBookingSettings({ getAdminHeaders }: Props) {
  const headersRef = useRef(getAdminHeaders);
  headersRef.current = getAdminHeaders;
  const [profile, setProfile] = useState<BookingProfile | null>(null);
  const [savedSlug, setSavedSlug] = useState("");
  const [calendar, setCalendar] = useState<GroupMeetCalendarSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const response = await fetch("/api/admin/group-meet/booking", { headers: await headersRef.current() });
        const payload = await response.json();
        if (!response.ok || !payload.profile) throw new Error(payload.error || "Could not load booking settings.");
        if (active) { setProfile(payload.profile); setSavedSlug(payload.profile.slug); setCalendar(payload.calendarSetup); }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load booking settings.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [retry]);

  const update = <K extends keyof BookingProfile>(key: K, value: BookingProfile[K]) => {
    setProfile((current) => current ? { ...current, [key]: value } : current);
    setMessage("");
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setError(""); setMessage("");
    try { validateBookingProfile(profile); }
    catch (err) { setError(err instanceof Error ? err.message : "Check your booking settings."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/group-meet/booking", { method: "PUT", headers: await headersRef.current(), body: JSON.stringify(profile) });
      const payload = await response.json();
      if (!response.ok || !payload.profile) throw new Error(payload.error || "Could not save booking settings.");
      setProfile(payload.profile); setSavedSlug(payload.profile.slug); setCalendar(payload.calendarSetup);
      setMessage(payload.profile.enabled ? "Booking settings saved. Your booking page is enabled." : "Booking settings saved. Your booking page is paused.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save booking settings."); }
    finally { setSaving(false); }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/group-meet/book/${savedSlug}`); setMessage("Booking link copied."); }
    catch { setError("Could not copy the link. You can copy it from the link below."); }
  };

  if (loading) return <p className="text-sm text-stone-500" role="status">Loading booking settings…</p>;
  if (!profile) return <div><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 rounded-md border px-4 py-2 text-sm">Try again</button></div>;

  return <form onSubmit={save} className="max-w-3xl space-y-6">
    <div><h2 className="text-xl font-semibold text-stone-950">Individual bookings</h2><p className="mt-1 text-sm text-stone-500">Share one link so people can choose an available time and receive a calendar invitation with a Google Meet link.</p></div>
    <div className={`rounded-lg border p-4 text-sm ${calendar?.ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      <p className="font-semibold">{calendar?.ready ? "Calendar configured" : "Calendar setup needed"}</p>
      <p className="mt-1">{calendar?.message || "Connect the host Google Calendar before accepting bookings."}</p>
      {calendar?.ready && <p className="mt-1">Live availability is checked when a visitor opens your booking page.</p>}
    </div>
    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
      <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={profile.enabled} onChange={(event) => update("enabled", event.target.checked)} className="h-4 w-4 accent-stone-900" />Accept individual bookings</label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Your name<input className={inputClass} required maxLength={100} value={profile.name} onChange={(event) => update("name", event.target.value)} /></label>
        <label className="text-sm font-medium">Booking link name<input className={inputClass} required pattern="[a-z0-9][a-z0-9-]{2,49}" minLength={3} maxLength={50} value={profile.slug} onChange={(event) => update("slug", event.target.value.toLowerCase())} /><span className="mt-1 block text-xs font-normal text-stone-500">3–50 lowercase letters, numbers, and hyphens. Changing this changes your shared link.</span></label>
      </div>
      <label className="block text-sm font-medium">Welcome message<textarea className={inputClass} rows={3} maxLength={500} value={profile.description} onChange={(event) => update("description", event.target.value)} /></label>
      <label className="block text-sm font-medium">Your availability timezone<input className={inputClass} required value={profile.timezone} placeholder="America/New_York" onChange={(event) => update("timezone", event.target.value)} /><span className="mt-1 block text-xs font-normal text-stone-500">Visitors see times in their own timezone.</span></label>
      <fieldset><legend className="mb-2 text-sm font-medium">Meeting lengths</legend><div className="flex flex-wrap gap-4">{[15, 30, 60].map((duration) => <label key={duration} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-stone-900" checked={profile.durations.includes(duration)} onChange={(event) => update("durations", event.target.checked ? [...profile.durations, duration].sort((a, b) => a - b) : profile.durations.filter((value) => value !== duration))} />{duration} minutes</label>)}</div></fieldset>
      <fieldset><legend className="mb-2 text-sm font-medium">Available days</legend><div className="flex flex-wrap gap-4">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => <label key={day} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-stone-900" checked={profile.days.includes(index)} onChange={(event) => update("days", event.target.checked ? [...profile.days, index].sort() : profile.days.filter((value) => value !== index))} />{day}</label>)}</div></fieldset>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Start time<input type="time" required step={900} className={inputClass} value={timeValue(profile.startMinutes)} onChange={(event) => update("startMinutes", timeMinutes(event.target.value))} /></label><label className="text-sm font-medium">End time<input type="time" required step={900} className={inputClass} value={timeValue(profile.endMinutes)} onChange={(event) => update("endMinutes", timeMinutes(event.target.value))} /></label></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-medium">Buffer (minutes)<input type="number" required min={0} max={120} className={inputClass} value={profile.bufferMinutes} onChange={(event) => update("bufferMinutes", Number(event.target.value))} /></label>
        <label className="text-sm font-medium">Minimum notice (hours)<input type="number" required min={0} max={168} className={inputClass} value={profile.minNoticeHours} onChange={(event) => update("minNoticeHours", Number(event.target.value))} /></label>
        <label className="text-sm font-medium">Book ahead (days)<input type="number" required min={1} max={60} className={inputClass} value={profile.horizonDays} onChange={(event) => update("horizonDays", Number(event.target.value))} /></label>
      </div>
      <button type="submit" className="rounded-md bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save booking settings"}</button>
    </fieldset>
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-4"><p className="text-sm font-medium">Your saved booking link</p><div className="mt-2 flex flex-wrap items-center gap-3"><a href={`/group-meet/book/${savedSlug}`} target="_blank" rel="noreferrer" className="break-all text-sm text-stone-700 underline">/group-meet/book/{savedSlug}</a><button type="button" onClick={copyLink} className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">Copy link</button></div><p className="mt-2 text-xs text-stone-500">Save changes before sharing. Pausing bookings keeps existing meetings on your calendar.</p></div>
  </form>;
}
