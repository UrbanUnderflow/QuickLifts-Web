import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useUser } from '../../hooks/useUser';
import { coachService } from '../../api/firebase/coach';
import { formatDate } from '../../utils/formatDate';

const ManageCoachesPage: React.FC = () => {
  const currentUser = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coaches, setCoaches] = useState<Array<{ id: string; name: string; referralCode?: string }>>([]);

  useEffect(() => {
    const load = async () => {
      try {
        if (!currentUser?.id) return;
        const results = await coachService.getConnectedCoaches(currentUser.id);
        setCoaches(results.map(r => ({ id: r.id, name: r.data?.referralCode || r.id, referralCode: (r.data as any)?.referralCode })));
      } catch (e: any) {
        setError(e?.message || 'Failed to load coaches');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser?.id]);

  const disconnect = async (coachId: string) => {
    if (!currentUser?.id) return;
    await coachService.disconnectAthleteFromCoach(coachId, currentUser.id);
    setCoaches(prev => prev.filter(c => c.id !== coachId));
  };

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Head><title>Manage Coaches | Pulse</title></Head>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-6">Your Coaches</h1>
        {error && <div className="mb-4 text-red-400 text-sm">{error}</div>}
        {coaches.length === 0 ? (
          <div className="text-zinc-400">No connected coaches yet.</div>
        ) : (
          <div className="space-y-4">
            {coaches.map(c => (
              <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold">Coach {c.name}</div>
                  <div className="text-xs text-zinc-500">ID: {c.id}</div>
                </div>
                <div className="space-x-2">
                  <button onClick={() => disconnect(c.id)} className="bg-zinc-800 border border-zinc-700 px-3 py-2 rounded-lg hover:bg-zinc-700">Disconnect</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageCoachesPage;


