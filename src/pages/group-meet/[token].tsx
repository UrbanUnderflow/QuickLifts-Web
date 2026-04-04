import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { format, parse } from 'date-fns';
import { Calendar, CheckCircle2, Loader2 } from 'lucide-react';
import GroupMeetAvailabilityPicker from '../../components/group-meet/GroupMeetAvailabilityPicker';
import {
  type GroupMeetAvailabilitySlot,
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

const GroupMeetInvitePage: React.FC = () => {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [invite, setInvite] = useState<InviteResponse['invite'] | null>(null);
  const [availabilityEntries, setAvailabilityEntries] = useState<GroupMeetAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
                peerAvailability={invite.peerAvailability}
                currentParticipant={{
                  token: invite.token,
                  name: invite.name,
                  imageUrl: invite.imageUrl || null,
                  participantType: invite.participantType,
                }}
                onChange={setAvailabilityEntries}
                disabled={invite.deadlinePassed}
                title="Calendar"
                subtitle="Tap the days that work, add your times, and hover the guest images to see who has already replied."
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
