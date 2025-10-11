import React, { useEffect, useState } from 'react';
import { useUser } from '../../hooks/useUser';
import { coachService } from '../../api/firebase/coach/service';
import { userService } from '../../api/firebase/user/service';

interface CoachBasic {
  id: string;
  data: any;
}

const ConnectedCoachesBadge: React.FC = () => {
  const currentUser = useUser();
  const [coaches, setCoaches] = useState<CoachBasic[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!currentUser?.id) return;
      try {
        console.log('[ConnectedCoachesBadge] fetching connected coaches for athlete:', currentUser.id);
        const list = await coachService.getConnectedCoaches(currentUser.id);
        console.log('[ConnectedCoachesBadge] raw connected coaches:', JSON.parse(JSON.stringify(list)));
        // Fallback join to users for username/displayName if coaches docs lack them
        const enriched: CoachBasic[] = [];
        for (const item of list) {
          const data = { ...(item.data || {}) } as any;
          if (!data.username || !data.displayName) {
            try {
              const u = await userService.getUserById(item.id);
              if (u) {
                data.username = data.username || u.username;
                data.displayName = data.displayName || u.displayName;
                data.profileImage = data.profileImage || u.profileImage;
              }
            } catch (_) { /* ignore */ }
          }
          enriched.push({ id: item.id, data });
        }
        console.log('[ConnectedCoachesBadge] enriched coaches:', JSON.parse(JSON.stringify(enriched)));
        setCoaches(enriched);
      } catch (e) {
        console.error('[ConnectedCoachesBadge] failed to fetch connected coaches', e);
        // non-blocking
      }
    };
    run();
  }, [currentUser?.id]);

  const count = coaches.length;
  if (!currentUser) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-sm px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-200 hover:border-zinc-500 transition-colors"
        title={count === 0 ? 'No connected coaches' : `${count} connected coach${count > 1 ? 'es' : ''}`}
      >
        Connected Coach{count !== 1 ? 'es' : ''}: <span className="text-white font-semibold">{count}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="px-3 py-2 text-xs text-zinc-400 border-b border-zinc-800">Connected Coach{count !== 1 ? 'es' : ''}</div>
          <div className="max-h-80 overflow-y-auto">
            {coaches.length === 0 && (
              <div className="p-4 text-sm text-zinc-400">No coaches connected yet.</div>
            )}
            {coaches.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 hover:bg-zinc-800/60">
                {c.data?.profileImage?.profileImageURL ? (
                  <img src={c.data.profileImage.profileImageURL} alt={c.data?.displayName || c.data?.username || 'Coach'} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-white text-xs font-semibold">
                    {(c.data?.displayName || c.data?.username || 'C')?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">@{c.data?.username || 'coach'}</div>
                  {c.data?.displayName && <div className="text-xs text-zinc-400 truncate">{c.data.displayName}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectedCoachesBadge;


