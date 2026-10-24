import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../api/firebase/config';
import { ATHLETE_MENTAL_PROGRESS_COLLECTION } from '../../../api/firebase/mentaltraining/collections';
import type { AthleteMentalProgress } from '../../../api/firebase/mentaltraining/types';
import { isActivePulseCheckTeamMembership, type PulseCheckTeamMembership } from '../../../api/firebase/pulsecheckProvisioning/types';
import type { PilotDashboardDetail } from '../../../api/firebase/pulsecheckPilotDashboard/types';
import { summarizeLiveOnboarding } from '../../../api/firebase/pulsecheckPilotDashboard/onboarding';

type ProgressState = { value: AthleteMentalProgress | null; loaded: boolean; error?: boolean };
export default function PilotLiveOnboarding({ detail, demo }: { detail: PilotDashboardDetail; demo: boolean }) {
  const [members, setMembers] = useState<PulseCheckTeamMembership[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressState>>({});
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(() => {
    setMembers([]); setProgress({}); setError(''); setConnected(false); setUpdatedAt(null);
    if (demo) return;
    const stops = new Map<string, () => void>();
    const stop = onSnapshot(query(collection(db, 'pulsecheck-team-memberships'), where('teamId', '==', detail.team.id)), { includeMetadataChanges: true }, snapshot => {
      const next = snapshot.docs.map(item => ({ ...item.data(), id: item.id } as PulseCheckTeamMembership))
        .filter(member => member.role === 'athlete' && isActivePulseCheckTeamMembership(member));
      setMembers(next); setConnected(!snapshot.metadata.fromCache); setUpdatedAt(new Date());
      const ids = new Set(next.map(member => member.userId).filter(Boolean));
      stops.forEach((unsubscribe, id) => { if (!ids.has(id)) { unsubscribe(); stops.delete(id); } });
      ids.forEach(id => {
        if (stops.has(id)) return;
        setProgress(previous => ({ ...previous, [id]: { value: null, loaded: false } }));
        stops.set(id, onSnapshot(doc(db, ATHLETE_MENTAL_PROGRESS_COLLECTION, id), { includeMetadataChanges: true }, state => {
          setProgress(previous => ({ ...previous, [id]: { value: state.exists() ? state.data() as AthleteMentalProgress : null, loaded: !state.metadata.fromCache } }));
          setUpdatedAt(new Date());
        }, () => setProgress(previous => ({ ...previous, [id]: { value: null, loaded: false, error: true } }))));
      });
    }, () => { setConnected(false); setError('Live onboarding could not connect. Check your access and refresh this page.'); });
    return () => { stop(); stops.forEach(unsubscribe => unsubscribe()); };
  }, [detail.team.id, demo]);
  const rows = members.map(member => {
    const saved = progress[member.userId];
    const athlete = detail.rosterAthletes.find(person => person.athleteId === member.userId);
    return { member, saved, name: athlete?.displayName || member.athleteOnboarding?.entryOnboardingName || member.invitedDisplayName || member.email || 'Athlete',
      state: summarizeLiveOnboarding(member, detail.team.id, detail.pilot.studyMode, saved?.value || null, Boolean(saved?.loaded)) };
  }).sort((a,b) => a.name.localeCompare(b.name));
  return <section className="pilot-detail-inset mt-6 rounded-[24px] border border-white/10 p-6">
    <h2 className="text-2xl font-semibold">Live onboarding</h2>
    <p className="mt-2 text-sm opacity-75">{detail.team.displayName}. Athletes appear after joining this team. Account setup and saved baseline update automatically. Answers and scores are not shown.</p>
    <p className="my-4 text-sm" role="status">{demo ? 'Live tracking is unavailable in demo mode.' : error || (connected ? `${rows.filter(row => row.state.complete).length} of ${rows.length} athletes complete. Connected.` : 'Connecting or offline. Completion is not confirmed.')} {updatedAt && `Last update ${updatedAt.toLocaleTimeString()}.`}</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Athlete', 'Team joined', 'Account linked', 'Setup', 'Baseline saved', 'Completion'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
      <tbody>{rows.map(({ member, name, saved, state }) => <tr key={member.id} className="border-t border-white/10">
        <td className="p-3">{name}</td><td className="p-3">{detail.team.displayName}</td><td className="p-3">{state.accountLinked ? 'Linked' : 'Pending'}</td>
        <td className="p-3">{state.setupComplete ? 'Complete' : 'In progress'}</td>
        <td className="p-3">{saved?.error ? 'Unable to verify' : !saved?.loaded ? 'Checking' : state.baselineSaved ? 'Saved' : 'Pending'}</td>
        <td className="p-3 font-semibold">{connected && state.complete ? 'Complete' : 'Waiting'}</td>
      </tr>)}</tbody></table></div>
    {!rows.length && connected && <p className="py-5">No athletes have joined this team yet.</p>}
    <p className="mt-4 text-xs opacity-70">Setup includes entry onboarding and required consent decisions. Optional research participation is separate. Completion does not depend on performance scores.</p>
  </section>;
}
