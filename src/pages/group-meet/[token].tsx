import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { format, parse } from 'date-fns';
import { Calendar, CheckCircle2, Loader2 } from 'lucide-react';
import GroupMeetAvailabilityPicker from '../../components/group-meet/GroupMeetAvailabilityPicker';
import {
  type GroupMeetAvailabilitySlot,
  type GroupMeetImportedAvailabilitySuggestion,
  type GroupMeetSharedAvailabilityParticipant,
} from '../../lib/groupMeet';

type InviteResponse = {
  invite: {
    token: string;
    name: string;
    email: string | null;
    imageUrl?: string | null;
    participantType: 'host' | 'participant';
    shareUrl: string;
    responseSubmittedAt: string | null;
    availabilityEntries: GroupMeetAvailabilitySlot[];
    peerAvailability: GroupMeetSharedAvailabilityParticipant[];
    calendarImport?: {
      provider?: 'google' | string;
      connected?: boolean;
      connectedEmail?: string | null;
      status?: string | null;
      lastConnectedAt?: string | null;
      lastImportedAt?: string | null;
      error?: string | null;
    } | null;
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

type CalendarAction = 'connect' | 'import' | 'disconnect' | null;

function sortAvailabilitySlots(slots: GroupMeetAvailabilitySlot[]) {
  return [...slots].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    if (left.startMinutes !== right.startMinutes) {
      return left.startMinutes - right.startMinutes;
    }

    return left.endMinutes - right.endMinutes;
  });
}

function mergeAvailabilitySlots(
  currentSlots: GroupMeetAvailabilitySlot[],
  nextSlots: GroupMeetAvailabilitySlot[]
) {
  const seen = new Set<string>();
  const merged: GroupMeetAvailabilitySlot[] = [];

  for (const slot of [...currentSlots, ...nextSlots]) {
    const key = `${slot.date}:${slot.startMinutes}:${slot.endMinutes}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(slot);
  }

  return sortAvailabilitySlots(merged);
}

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildCalendarCallbackMessage(query: Record<string, string | string[] | undefined>) {
  const candidates = Object.entries(query).filter(([key]) =>
    /calendar|google/i.test(key)
  );

  for (const [key, value] of candidates) {
    const raw = queryValue(value);
    if (!raw) continue;

    const normalized = `${key}:${raw}`.toLowerCase();

    if (normalized.includes('error') || normalized.includes('failed') || normalized.includes('denied')) {
      return {
        type: 'error' as const,
        text: raw === '1' || raw.toLowerCase() === 'error'
          ? 'Google Calendar import was not completed.'
          : raw,
      };
    }

    if (
      normalized.includes('connected') ||
      normalized.includes('imported') ||
      normalized.includes('success') ||
      normalized.includes('complete') ||
      normalized.includes('ok')
    ) {
      let text = raw;
      if (normalized.includes('connected')) {
        text = 'Google Calendar connected. You can import availability now.';
      } else if (normalized.includes('imported')) {
        text = 'Google Calendar availability imported.';
      } else if (raw === '1' || raw.toLowerCase() === 'success') {
        text = 'Google Calendar connected.';
      } else if (/^(ok|done|completed)$/i.test(raw)) {
        text = 'Google Calendar action completed.';
      }

      return {
        type: 'success' as const,
        text,
      };
    }
  }

  return null;
}

function stripCalendarQueryParams(query: Record<string, string | string[] | undefined>) {
  const nextQuery: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(query)) {
    if (/calendar|google/i.test(key)) continue;
    if (value === undefined) continue;
    nextQuery[key] = value;
  }

  return nextQuery;
}

const GroupMeetInvitePage: React.FC = () => {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [invite, setInvite] = useState<InviteResponse['invite'] | null>(null);
  const [availabilityEntries, setAvailabilityEntries] = useState<GroupMeetAvailabilitySlot[]>([]);
  const [importedSuggestions, setImportedSuggestions] = useState<GroupMeetImportedAvailabilitySuggestion[]>([]);
  const [calendarImport, setCalendarImport] = useState<InviteResponse['invite']['calendarImport'] | null>(null);
  const [calendarAction, setCalendarAction] = useState<CalendarAction>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const handledCallbackRef = useRef<string | null>(null);

  const loadInvite = async (options?: { silent?: boolean }) => {
    if (!token) return;

    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const response = await fetch(`/api/group-meet/${encodeURIComponent(token)}`);
      const payload = (await response.json().catch(() => ({}))) as Partial<InviteResponse> & { error?: string };
      if (!response.ok || !payload.invite) {
        throw new Error(payload.error || 'Invite not found.');
      }
      setInvite(payload.invite);
      setAvailabilityEntries(Array.isArray(payload.invite.availabilityEntries) ? payload.invite.availabilityEntries : []);
      setImportedSuggestions([]);
      setCalendarImport(payload.invite.calendarImport || null);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to load invite.' });
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadInvite();
  }, [token]);

  useEffect(() => {
    if (!router.isReady) return;

    const callbackMessage = buildCalendarCallbackMessage(router.query as Record<string, string | string[] | undefined>);
    if (!callbackMessage) return;

    const signature = `${callbackMessage.type}:${callbackMessage.text}`;
    if (handledCallbackRef.current === signature) return;
    handledCallbackRef.current = signature;

    setMessage(callbackMessage);

    if (callbackMessage.type === 'success') {
      void loadInvite({ silent: true });
    }

    void router.replace(
      {
        pathname: router.pathname,
        query: stripCalendarQueryParams(router.query as Record<string, string | string[] | undefined>),
      },
      undefined,
      { shallow: true }
    );
  }, [router.isReady, router.pathname, router.query]);

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
      setImportedSuggestions([]);
      setCalendarImport(payload.invite.calendarImport || null);
      setMessage({ type: 'success', text: 'Availability saved.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to save availability.' });
    } finally {
      setSaving(false);
    }
  };

  const startGoogleCalendarConnect = async () => {
    if (!invite) return;

    setCalendarAction('connect');
    setMessage(null);

    try {
      const response = await fetch(
        `/api/group-meet/${encodeURIComponent(invite.token)}/calendar/google/connect/start`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || 'Unable to start Google Calendar connection.');
      }

      window.location.assign(payload.url);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Unable to start Google Calendar connection.' });
      setCalendarAction(null);
    }
  };

  const importGoogleCalendarAvailability = async () => {
    if (!invite) return;

    setCalendarAction('import');
    setMessage(null);

    try {
      const response = await fetch(
        `/api/group-meet/${encodeURIComponent(invite.token)}/calendar/google/import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        suggestions?: GroupMeetImportedAvailabilitySuggestion[];
        calendarImport?: InviteResponse['invite']['calendarImport'];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to import Google Calendar availability.');
      }

      const nextSuggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
      setImportedSuggestions(nextSuggestions);

      if (payload.calendarImport !== undefined) {
        setCalendarImport(payload.calendarImport || null);
      }

      setMessage({
        type: 'success',
        text: nextSuggestions.length
          ? `Imported ${nextSuggestions.length} Google Calendar ${nextSuggestions.length === 1 ? 'suggestion' : 'suggestions'}. Add the ones you want, edit them if needed, and then press Save availability.`
          : 'Google Calendar is connected. No importable availability windows were found for this month.',
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to import Google Calendar availability.' });
    } finally {
      setCalendarAction(null);
    }
  };

  const disconnectGoogleCalendar = async () => {
    if (!invite) return;

    setCalendarAction('disconnect');
    setMessage(null);

    try {
      const response = await fetch(
        `/api/group-meet/${encodeURIComponent(invite.token)}/calendar/google/disconnect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        calendarImport?: InviteResponse['invite']['calendarImport'];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to disconnect Google Calendar.');
      }

      setCalendarImport(payload.calendarImport || null);
      setImportedSuggestions([]);
      setMessage({
        type: 'success',
        text: 'Google Calendar disconnected. Your drafted availability stays in place.',
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to disconnect Google Calendar.' });
    } finally {
      setCalendarAction(null);
    }
  };

  const googleCalendarConnected = Boolean(
    calendarImport &&
      (calendarImport.connected ||
        calendarImport.status === 'connected' ||
        calendarImport.status === 'imported' ||
        calendarImport.connectedEmail)
  );
  const googleCalendarStatusLabel = googleCalendarConnected
    ? calendarImport?.status === 'imported'
      ? 'Connected and imported'
      : 'Connected'
    : 'Not connected';
  const googleCalendarHint = googleCalendarConnected
    ? 'Import busy blocks from Google Calendar to prefill editable suggestions. Nothing is saved until you press Save availability.'
    : 'Optionally connect Google Calendar to import busy blocks as editable suggestions. We never submit anything automatically.';
  const pickerSubtitle = googleCalendarConnected
    ? 'Tap the days that work, add your times, or import Google Calendar to prefill suggestions. Hover the guest images to see who has already replied.'
    : 'Tap the days that work, add one or more time windows, and save before the deadline.';

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
                  {invite.imageUrl && (
                    <img
                      src={invite.imageUrl}
                      alt={invite.name}
                      className="mt-4 h-14 w-14 rounded-2xl object-cover border border-white/10"
                    />
                  )}
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

            <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300">
                    <Calendar className="w-3.5 h-3.5" />
                    Google Calendar
                  </div>
                  <h2 className="mt-3 text-xl font-semibold text-white">Optional calendar import</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{googleCalendarHint}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                      {googleCalendarStatusLabel}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                      Manual save stays in control
                    </span>
                    {calendarImport?.connectedEmail && (
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                        {calendarImport.connectedEmail}
                      </span>
                    )}
                    {calendarImport?.lastImportedAt && (
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                        Last imported {new Date(calendarImport.lastImportedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:flex-col">
                  {!googleCalendarConnected ? (
                    <button
                      type="button"
                      onClick={startGoogleCalendarConnect}
                      disabled={calendarAction === 'connect' || invite.deadlinePassed}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E0FE10] px-5 py-3 font-semibold text-black hover:bg-lime-300 disabled:opacity-60 sm:w-auto"
                    >
                      {calendarAction === 'connect' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                      Connect Google Calendar
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={importGoogleCalendarAvailability}
                        disabled={calendarAction === 'import' || invite.deadlinePassed}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E0FE10] px-5 py-3 font-semibold text-black hover:bg-lime-300 disabled:opacity-60 sm:w-auto"
                      >
                        {calendarAction === 'import' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Import availability
                      </button>
                      <button
                        type="button"
                        onClick={disconnectGoogleCalendar}
                        disabled={calendarAction === 'disconnect'}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 font-medium text-zinc-200 hover:bg-white/[0.06] disabled:opacity-60 sm:w-auto"
                      >
                        {calendarAction === 'disconnect' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                        Disconnect
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>

            <div className="mt-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
                <div>
                  <h2 className="text-xl font-semibold">Pick your availability</h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    {invite.responseSubmittedAt ? `Last saved ${new Date(invite.responseSubmittedAt).toLocaleString()}` : 'Nothing saved yet'}
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

                <GroupMeetAvailabilityPicker
                  targetMonth={invite.request.targetMonth}
                  availabilityEntries={availabilityEntries}
                  importedSuggestions={importedSuggestions}
                  peerAvailability={invite.peerAvailability}
                  meetingDurationMinutes={invite.request.meetingDurationMinutes}
                currentParticipant={{
                  token: invite.token,
                  name: invite.name,
                  imageUrl: invite.imageUrl || null,
                  participantType: invite.participantType,
                  }}
                  onChange={setAvailabilityEntries}
                  disabled={invite.deadlinePassed}
                  title="Calendar"
                  subtitle={pickerSubtitle}
                />
              </div>

            <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
              <div className="text-sm text-zinc-400">
                Tip: if a day works, tap it and add as many windows as you want. Keep it lightweight. We just need the ranges that are actually good for you.
              </div>
            </section>
          </>
        )}
      </div>

    </div>
  );
};

export default GroupMeetInvitePage;
