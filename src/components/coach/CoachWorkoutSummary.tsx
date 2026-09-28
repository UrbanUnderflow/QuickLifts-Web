import React, { useEffect, useState } from 'react';
import { auth } from '../../api/firebase/config';

type Row = { startedAt: number; activity: string; durationMinutes: number | null; effortRating: number | null; fromDevice: boolean };
type Summary = {
  shared: boolean;
  workouts?: Row[];
  totals?: { workoutCount: number; minutes: number; workoutsWithMinutes: number; load: number; ratedWorkouts: number; unratedWorkouts: number };
};

/**
 * Workouts an athlete chose to share with their coach: sessions, minutes, and load where rated.
 * The API returns nothing unless the athlete turned sharing on, and never effort words, food, or journal writing.
 */
const CoachWorkoutSummary: React.FC<{ athleteId: string; firstName: string }> = ({ athleteId, firstName }) => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSummary(null); setError(null);
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('Sign in to see athlete summaries.');
        const to = Date.now();
        const from = to - 7 * 86_400_000;
        const response = await fetch(`/api/activity-records/coach-summary?athleteId=${encodeURIComponent(athleteId)}&from=${from}&to=${to}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'This summary is unavailable right now.');
        if (!cancelled) setSummary(payload);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'This summary is unavailable right now.');
      }
    })();
    return () => { cancelled = true; };
  }, [athleteId]);

  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Workouts · last 7 days</h3>
      {error ? (
        <p className="text-xs text-zinc-500">{error}</p>
      ) : !summary ? (
        <p className="text-xs text-zinc-500">Loading…</p>
      ) : !summary.shared ? (
        <p className="text-xs text-zinc-500">{firstName} hasn't chosen to share workouts with coaches.</p>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
          <p className="text-sm text-white">
            {summary.totals!.workoutCount === 0 ? 'No workouts logged' : `${summary.totals!.workoutCount} logged`}
            {summary.totals!.workoutsWithMinutes > 0 ? ` · ${summary.totals!.minutes} min across ${summary.totals!.workoutsWithMinutes}` : ''}
            {summary.totals!.ratedWorkouts > 0 ? ` · load ${summary.totals!.load} from ${summary.totals!.ratedWorkouts} rated` : ''}
          </p>
          {summary.totals!.unratedWorkouts > 0 && (
            <p className="text-[11px] text-zinc-500">{summary.totals!.unratedWorkouts} without an effort rating. Days with nothing logged are unknown, not rest days.</p>
          )}
          <ul className="space-y-1">
            {summary.workouts!.slice(0, 10).map((row, index) => (
              <li key={index} className="flex justify-between text-xs text-zinc-300">
                <span>{new Date(row.startedAt).toLocaleDateString(undefined, { weekday: 'short' })} · {row.activity}{row.fromDevice ? ' (device)' : ''}</span>
                <span className="text-zinc-500">
                  {[row.durationMinutes != null ? `${row.durationMinutes} min` : null, row.effortRating != null ? `effort ${row.effortRating}` : null].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CoachWorkoutSummary;
