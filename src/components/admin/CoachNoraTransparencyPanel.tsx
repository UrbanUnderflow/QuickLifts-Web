// =============================================================================
// CoachNoraTransparencyPanel — Phase F surface.
//
// Reusable panel for the Sports Intelligence Reports reviewer screen + team
// dashboards. Per athlete, shows:
//   - last 3 Nora messages + last 3 athlete replies
//   - currently-assigned protocols / sims (curriculum-engine output)
//   - the state-bucket reasoning for each (visible to coach, not athlete)
//
// Athletes never see this aggregated view — only their own current message
// thread on iOS.
//
// Drop-in: <CoachNoraTransparencyPanel athleteUserId="..." teamId="..." />
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { Loader2, MessageSquare, Sparkles, Target } from 'lucide-react';
import { db } from '../../api/firebase/config';
import type {
  ConversationTurn,
  NoraConversation,
} from '../../api/firebase/noraConversation/types';

interface Props {
  athleteUserId: string;
  teamId?: string;
  /** Whether to render the protocol-assignment panel. Default true. */
  showAssignments?: boolean;
}

interface AssignmentLite {
  id: string;
  sourceDate?: string;
  actionType?: string;
  protocolLabel?: string;
  rationale?: string;
  assignedBy?: string;
  status?: string;
}

const CoachNoraTransparencyPanel: React.FC<Props> = ({ athleteUserId, showAssignments = true }) => {
  const [conversations, setConversations] = useState<NoraConversation[]>([]);
  const [assignments, setAssignments] = useState<AssignmentLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [convoSnap, assnSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'pulsecheck-nora-conversations'),
              where('athleteUserId', '==', athleteUserId),
              orderBy('updatedAt', 'desc'),
              fsLimit(3),
            ),
          ).catch(() => null),
          showAssignments
            ? getDocs(
                query(
                  collection(db, 'pulsecheck-daily-assignments'),
                  where('athleteId', '==', athleteUserId),
                  orderBy('createdAt', 'desc'),
                  fsLimit(6),
                ),
              ).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setConversations(
          convoSnap?.docs.map((d) => ({ ...(d.data() as NoraConversation), id: d.id })) || [],
        );
        setAssignments(
          assnSnap?.docs.map((d) => ({ ...(d.data() as AssignmentLite), id: d.id })) || [],
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [athleteUserId, showAssignments]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Nora transparency…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-violet-300" />
          <h3 className="text-sm font-semibold">What Nora has said to this athlete</h3>
        </div>
        {conversations.length === 0 ? (
          <p className="text-xs text-zinc-500">No conversations yet.</p>
        ) : (
          <ul className="space-y-3">
            {conversations.map((c) => (
              <li key={c.id} className="rounded-xl border border-zinc-800 bg-black/25 p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-200">
                    {c.trigger}
                  </span>
                  <span className="text-[10px] text-zinc-500">{c.state}</span>
                  {c.actionState && (
                    <span className="rounded border border-emerald-700/30 bg-emerald-950/20 px-1.5 py-0.5 text-[9px] uppercase text-emerald-300">
                      classified: {c.actionState}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-zinc-500">{c.triggerEvidence?.summary}</p>
                <ul className="mt-2 space-y-1">
                  {(c.turns || []).slice(-3).map((t: ConversationTurn) => (
                    <li
                      key={t.turnId}
                      className={`rounded-lg px-2 py-1 text-xs ${
                        t.role === 'athlete-reply'
                          ? 'border border-emerald-700/30 bg-emerald-950/20 text-emerald-100'
                          : 'border border-zinc-800 bg-black/30 text-zinc-100'
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wide text-zinc-500">{t.role}</span>
                      <p className="mt-0.5">{t.text}</p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showAssignments && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-300" />
            <h3 className="text-sm font-semibold">Recent assigned protocols + simulations</h3>
          </div>
          {assignments.length === 0 ? (
            <p className="text-xs text-zinc-500">No assignments yet.</p>
          ) : (
            <ul className="space-y-2">
              {assignments.map((a) => (
                <li key={a.id} className="rounded-xl border border-zinc-800 bg-black/25 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[9px] uppercase text-violet-200">
                        {a.actionType}
                      </span>
                      <span className="ml-2 text-zinc-300">{a.protocolLabel || a.id}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">{a.sourceDate} · {a.status}</span>
                  </div>
                  {a.rationale && <p className="mt-1 text-[11px] text-zinc-400">{a.rationale}</p>}
                  <p className="mt-1 text-[10px] text-zinc-600">assigned by: {a.assignedBy}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default CoachNoraTransparencyPanel;
