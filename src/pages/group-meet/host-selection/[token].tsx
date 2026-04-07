import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck2, CheckCircle2, Loader2 } from 'lucide-react';
import { formatMinutesAsTime, type GroupMeetCalendarInvite, type GroupMeetFinalSelection } from '../../../lib/groupMeet';

type HostSelectionResponse = {
  requestTitle: string;
  timezone: string;
  finalSelection: GroupMeetFinalSelection;
  calendarInvite: GroupMeetCalendarInvite | null;
};

function formatSelectionDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0)));
}

const GroupMeetHostSelectionPage: React.FC = () => {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<HostSelectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || !token || firedRef.current) {
      return;
    }

    firedRef.current = true;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/group-meet/host-selection/${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const payload = (await response.json().catch(() => ({}))) as Partial<HostSelectionResponse> & {
          error?: string;
        };

        if (!response.ok || !payload.finalSelection) {
          throw new Error(payload.error || 'Failed to finalize the selected meeting time.');
        }

        setResult(payload as HostSelectionResponse);
      } catch (caughtError: any) {
        setError(caughtError?.message || 'Failed to finalize the selected meeting time.');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [router.isReady, token]);

  const confirmationLabel = useMemo(() => {
    if (!result?.finalSelection) return '';
    return `${formatSelectionDate(result.finalSelection.date)} • ${formatMinutesAsTime(result.finalSelection.startMinutes)} - ${formatMinutesAsTime(result.finalSelection.endMinutes)} (${result.timezone})`;
  }, [result]);

  return (
    <div className="min-h-screen bg-[#05070b] px-5 py-8 text-white sm:px-8 sm:py-12">
      <Head>
        <title>Group Meet confirmation | Pulse</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="mx-auto flex min-h-[80vh] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:p-8">
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="rounded-full border border-white/10 bg-white/5 p-4">
                <Loader2 className="h-7 w-7 animate-spin text-[#E0FE10]" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold">Finalizing your selected Group Meet time</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-400 sm:text-base">
                  Group Meet is saving the selected slot, creating the calendar invite, and sending it out now.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="py-8">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
              <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-6 text-sm leading-7 text-zinc-300">
                The recommendation link may have expired or the invite could not be created from this browser session.
                You can return to Group Meet and choose a slot again from the latest host email.
              </div>
            </div>
          ) : result ? (
            <div className="py-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#E0FE10]">
                Group Meet confirmed
              </div>
              <div className="mt-5 flex items-start gap-4">
                <div className="rounded-full border border-white/10 bg-white/5 p-3">
                  <CheckCircle2 className="h-7 w-7 text-[#E0FE10]" />
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    Time selected and calendar invite created.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
                    Group Meet saved the selected meeting window for <strong>{result.requestTitle}</strong> and sent the
                    calendar invite out to the attendees.
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-[1.4fr_0.6fr]">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    <CalendarCheck2 className="h-4 w-4 text-[#E0FE10]" />
                    Selected time
                  </div>
                  <div className="mt-4 text-xl font-semibold">{confirmationLabel}</div>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    Everyone on the invite will receive the calendar event update. If you need to choose a different
                    slot later, open a more recent host recommendation email and pick a new option.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">Links</div>
                  <div className="mt-4 flex flex-col gap-3">
                    {result.calendarInvite?.htmlLink ? (
                      <a
                        href={result.calendarInvite.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-full bg-[#E0FE10] px-4 py-3 text-sm font-semibold text-black transition hover:bg-lime-300"
                      >
                        Open calendar event
                      </a>
                    ) : null}
                    {result.calendarInvite?.meetLink ? (
                      <a
                        href={result.calendarInvite.meetLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
                      >
                        Open meeting link
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default GroupMeetHostSelectionPage;
