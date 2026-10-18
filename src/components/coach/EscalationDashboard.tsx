import React, { useEffect, useState } from 'react';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';
import { fetchPublicProfile } from '../../api/firebase/user/publicProfile';

interface SupportRequest { id: string; athleteId: string; createdAt: number | null; displayName: string }
interface EscalationDashboardProps {
  teamId?: string;
  onMessageAthlete?: (athleteId: string) => void;
}
/** Displays athlete-selected staff requests; clinical status belongs in the responder queue. */
const EscalationDashboard: React.FC<EscalationDashboardProps> = ({ teamId, onMessageAthlete }) => {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setRequests([]);
    const load = async () => {
      if (!teamId || !auth.currentUser) { setLoading(false); return; }
      try {
        const response = await fetch(`/api/coach/support-requests?teamId=${encodeURIComponent(teamId)}`, {headers:{...getFirebaseModeRequestHeaders(),Authorization:`Bearer ${await auth.currentUser.getIdToken()}`}});
        if (!response.ok) throw new Error('Could not load support requests.');
        const payload = await response.json();
        const next = await Promise.all((payload.requests || []).map(async (request: Omit<SupportRequest,'displayName'>) => {
          const profile = await fetchPublicProfile(request.athleteId);
          return {...request,displayName:profile?.displayName || profile?.username || 'Athlete'};
        }));
        if (!cancelled) {setRequests(next);setError('');}
      } catch { if (!cancelled) {setRequests([]);setError('Could not load support requests.');} }
      finally {if (!cancelled) setLoading(false);}
    };
    void load();
    const timer = setInterval(load,30000);
    return () => {cancelled=true;clearInterval(timer);};
  },[teamId]);
  return <section className="bg-[#111417] rounded-2xl p-6 text-white">
    <h2 className="text-lg font-semibold">Athlete support requests</h2>
    <p className="text-sm text-zinc-400">Athletes who selected you for support.</p>
    {!teamId ? <p className="mt-4 text-zinc-400">Choose a team to view requests.</p> : loading ? <p className="mt-4">Loading requests…</p> : error ? <p role="alert" className="mt-4">{error}</p> : requests.length === 0 ? <p className="mt-4 text-zinc-400">No active support requests.</p> : <ul className="mt-4 space-y-3">{requests.map(request => <li key={request.id} className="flex items-center justify-between gap-4 rounded-xl bg-zinc-900 p-4"><span>{request.displayName}</span>{onMessageAthlete && <button onClick={() => onMessageAthlete(request.athleteId)} className="text-sm text-blue-300">Message athlete</button>}</li>)}</ul>}
  </section>;
};
export default EscalationDashboard;
