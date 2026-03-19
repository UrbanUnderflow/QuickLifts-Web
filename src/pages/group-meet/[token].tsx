import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { Calendar, CheckCircle2, Clock, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  formatMinutesAsTime,
  minutesToTimeInputValue,
  timeInputValueToMinutes,
  type GroupMeetAvailabilitySlot,
} from '../../lib/groupMeet';

type InviteResponse = {
  invite: {
    token: string;
    name: string;
    email: string | null;
    shareUrl: string;
    responseSubmittedAt: string | null;
    availabilityEntries: GroupMeetAvailabilitySlot[];
    deadlinePassed: boolean;
    request: {
      id: string;
      title: string;
      targetMonth: string;
      deadlineAt: string | null;
      timezone: string;
      meetingDurationMinutes: number;
      status: 'collecting' | 'closed';
    };
  };
};

type DayRangeDraft = {
  start: string;
  end: string;
};

const buildCalendarDays = (targetMonth: string) => {
  const firstDay = startOfMonth(parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date()));
  const lastDay = endOfMonth(firstDay);
  const calendarStart = startOfWeek(firstDay, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(lastDay, { weekStartsOn: 0 });
  const days: Date[] = [];

  for (let current = calendarStart; current <= calendarEnd; current = addDays(current, 1)) {
    days.push(current);
  }

  return days;
};

const GroupMeetInvitePage: React.FC = () => {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [invite, setInvite] = useState<InviteResponse['invite'] | null>(null);
  const [availabilityEntries, setAvailabilityEntries] = useState<GroupMeetAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [draftRanges, setDraftRanges] = useState<DayRangeDraft[]>([]);

  const calendarDays = useMemo(
    () => (invite ? buildCalendarDays(invite.request.targetMonth) : []),
    [invite]
  );

  const slotsByDate = useMemo(() => {
    const next = new Map<string, GroupMeetAvailabilitySlot[]>();
    for (const slot of availabilityEntries) {
      const current = next.get(slot.date) || [];
      current.push(slot);
      next.set(slot.date, current);
    }
    return next;
  }, [availabilityEntries]);

  const loadInvite = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/group-meet/${encodeURIComponent(token)}`);
      const payload = (await response.json().catch(() => ({}))) as Partial<InviteResponse> & { error?: string };
      if (!response.ok || !payload.invite) {
        throw new Error(payload.error || 'Invite not found.');
      }
      setInvite(payload.invite);
      setAvailabilityEntries(Array.isArray(payload.invite.availabilityEntries) ? payload.invite.availabilityEntries : []);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to load invite.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvite();
  }, [token]);

  const openDayEditor = (date: string) => {
    const slots = slotsByDate.get(date) || [];
    setActiveDate(date);
    setDraftRanges(
      slots.length
        ? slots.map((slot) => ({
            start: minutesToTimeInputValue(slot.startMinutes),
            end: minutesToTimeInputValue(slot.endMinutes),
          }))
        : [{ start: '09:00', end: '10:00' }]
    );
  };

  const closeEditor = () => {
    setActiveDate(null);
    setDraftRanges([]);
  };

  const updateDraftRange = (index: number, field: keyof DayRangeDraft, value: string) => {
    setDraftRanges((current) =>
      current.map((range, rangeIndex) => (rangeIndex === index ? { ...range, [field]: value } : range))
    );
  };

  const addDraftRange = () => {
    setDraftRanges((current) => [...current, { start: '13:00', end: '14:00' }]);
  };

  const removeDraftRange = (index: number) => {
    setDraftRanges((current) => (current.length === 1 ? [] : current.filter((_, rangeIndex) => rangeIndex !== index)));
  };

  const saveDayRanges = () => {
    if (!activeDate) return;

    const nextSlots: GroupMeetAvailabilitySlot[] = [];
    for (const range of draftRanges) {
      const startMinutes = timeInputValueToMinutes(range.start);
      const endMinutes = timeInputValueToMinutes(range.end);
      if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) continue;
      if (startMinutes >= endMinutes) continue;
      nextSlots.push({ date: activeDate, startMinutes, endMinutes });
    }

    setAvailabilityEntries((current) => [
      ...current.filter((slot) => slot.date !== activeDate),
      ...nextSlots,
    ]);
    closeEditor();
  };

  const submitAvailability = async () => {
    if (!invite) return;
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/group-meet/${encodeURIComponent(invite.token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availabilityEntries }),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<InviteResponse> & { error?: string };
      if (!response.ok || !payload.invite) {
        throw new Error(payload.error || 'Failed to save availability.');
      }

      setInvite(payload.invite);
      setAvailabilityEntries(Array.isArray(payload.invite.availabilityEntries) ? payload.invite.availabilityEntries : []);
      setMessage({ type: 'success', text: 'Availability saved.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to save availability.' });
    } finally {
      setSaving(false);
    }
  };

  const selectedDateCount = slotsByDate.size;

  return (
    <div className="min-h-screen bg-[#05070b] text-white">
      <Head>
        <title>{invite ? `${invite.request.title} | Group Meet` : 'Group Meet'}</title>
      </Head>

      <div className="max-w-5xl mx-auto px-5 py-8 sm:px-8 sm:py-12">
        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#E0FE10]" />
            <div className="text-zinc-300">Loading your Group Meet invite…</div>
          </div>
        ) : !invite ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-6 py-16 text-center">
            <div className="text-xl font-semibold mb-2">Invite unavailable</div>
            <div className="text-zinc-300">This link may be invalid or expired.</div>
          </div>
        ) : (
          <>
            <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(224,254,16,0.12),_transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300">
                    <Calendar className="w-3.5 h-3.5" />
                    Group Meet
                  </div>
                  <h1 className="mt-4 text-3xl sm:text-4xl font-semibold">{invite.request.title}</h1>
                  <p className="mt-3 max-w-2xl text-zinc-300">
                    Hi {invite.name}. Tap any day that works for you, add one or more time windows, and save before the deadline.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                    <div className="text-zinc-400">Target month</div>
                    <div className="mt-1 font-medium">{format(parse(`${invite.request.targetMonth}-01`, 'yyyy-MM-dd', new Date()), 'MMMM yyyy')}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                    <div className="text-zinc-400">Meeting length</div>
                    <div className="mt-1 font-medium">{invite.request.meetingDurationMinutes} minutes</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                    <div className="text-zinc-400">Deadline</div>
                    <div className="mt-1 font-medium">
                      {invite.request.deadlineAt
                        ? new Date(invite.request.deadlineAt).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: invite.request.timezone,
                          })
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {message && (
              <div
                className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
                  message.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                    : 'border-red-500/30 bg-red-500/10 text-red-100'
                }`}
              >
                {message.text}
              </div>
            )}

            <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
                <div>
                  <h2 className="text-xl font-semibold">Pick your availability</h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    {selectedDateCount} day{selectedDateCount === 1 ? '' : 's'} selected
                    {invite.responseSubmittedAt ? ` • last saved ${new Date(invite.responseSubmittedAt).toLocaleString()}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={submitAvailability}
                  disabled={saving || invite.deadlinePassed}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E0FE10] px-5 py-3 font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {invite.deadlinePassed ? 'Deadline passed' : 'Save availability'}
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.18em] text-zinc-500 mb-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const inTargetMonth = isSameMonth(
                    day,
                    parse(`${invite.request.targetMonth}-01`, 'yyyy-MM-dd', new Date())
                  );
                  const slots = slotsByDate.get(dateKey) || [];
                  const disabled = !inTargetMonth || invite.deadlinePassed;

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => inTargetMonth && openDayEditor(dateKey)}
                      disabled={disabled}
                      className={`min-h-[92px] rounded-2xl border p-2 text-left transition-colors ${
                        inTargetMonth
                          ? slots.length
                            ? 'border-[#E0FE10]/50 bg-[#E0FE10]/10 hover:bg-[#E0FE10]/15'
                            : 'border-white/10 bg-black/30 hover:bg-white/[0.06]'
                          : 'border-white/5 bg-white/[0.02] text-zinc-700'
                      } ${disabled && invite.deadlinePassed ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <div className="text-sm font-medium">{format(day, 'd')}</div>
                      <div className="mt-2 space-y-1">
                        {slots.slice(0, 2).map((slot) => (
                          <div key={`${slot.date}-${slot.startMinutes}-${slot.endMinutes}`} className="rounded-lg bg-black/35 px-2 py-1 text-[11px] text-zinc-200">
                            {formatMinutesAsTime(slot.startMinutes)} - {formatMinutesAsTime(slot.endMinutes)}
                          </div>
                        ))}
                        {slots.length > 2 && (
                          <div className="text-[11px] text-zinc-300">+{slots.length - 2} more</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
              <div className="text-sm text-zinc-400">
                Tip: if a day works, tap it and add as many windows as you want. Keep it lightweight. We just need the ranges that are actually good for you.
              </div>
            </section>
          </>
        )}
      </div>

      {invite && activeDate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0b1016] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold">{format(parse(activeDate, 'yyyy-MM-dd', new Date()), 'EEEE, MMMM d')}</h3>
                <p className="text-sm text-zinc-400 mt-1">Add one or more time ranges for this day.</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {draftRanges.map((range, index) => (
                <div key={`range-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                  <label className="block">
                    <span className="block text-xs uppercase tracking-[0.18em] text-zinc-500 mb-2">Start</span>
                    <input
                      type="time"
                      value={range.start}
                      onChange={(event) => updateDraftRange(index, 'start', event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#05070b] px-3 py-3 text-white"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs uppercase tracking-[0.18em] text-zinc-500 mb-2">End</span>
                    <input
                      type="time"
                      value={range.end}
                      onChange={(event) => updateDraftRange(index, 'end', event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#05070b] px-3 py-3 text-white"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => removeDraftRange(index)}
                    className="mt-7 rounded-xl border border-white/10 px-3 py-3 text-zinc-300 hover:bg-white/5"
                    aria-label={`Remove time range ${index + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {!draftRanges.length && (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
                  No time ranges for this day yet.
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={addDraftRange}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm hover:bg-white/[0.08]"
              >
                <Plus className="w-4 h-4" />
                Add time range
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAvailabilityEntries((current) => current.filter((slot) => slot.date !== activeDate));
                    closeEditor();
                  }}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-300 hover:bg-white/5"
                >
                  Clear day
                </button>
                <button
                  type="button"
                  onClick={saveDayRanges}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-3 text-sm font-semibold text-black hover:bg-lime-300"
                >
                  <Clock className="w-4 h-4" />
                  Save day
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupMeetInvitePage;

