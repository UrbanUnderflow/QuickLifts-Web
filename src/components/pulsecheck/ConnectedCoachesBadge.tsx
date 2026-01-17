import React, { useEffect, useState } from 'react';
import { useUser } from '../../hooks/useUser';
import { coachService } from '../../api/firebase/coach/service';
import { userService } from '../../api/firebase/user/service';
import { motion, AnimatePresence } from 'framer-motion';
import { Users } from 'lucide-react';

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
      {/* Badge Button - Premium Glassmorphic Pill */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="relative group"
        title={count === 0 ? 'No connected coaches' : `${count} connected coach${count > 1 ? 'es' : ''}`}
      >
        {/* Glow effect on hover */}
        <div className="absolute -inset-1 rounded-full bg-[#3B82F6]/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Pill container */}
        <div className="relative flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-sm bg-white/5 border border-white/10 hover:border-[#3B82F6]/30 transition-all">
          {/* Icon with glow */}
          <div className="relative">
            <div className="absolute inset-0 bg-[#3B82F6]/40 rounded-full blur-sm" />
            <Users className="relative w-4 h-4 text-[#3B82F6]" />
          </div>
          
          <span className="text-sm text-zinc-300">
            Connected Coaches:
          </span>
          
          {/* Count badge */}
          <span className="relative">
            {count > 0 && (
              <span className="absolute -inset-1 bg-[#3B82F6]/20 rounded-full blur animate-pulse" />
            )}
            <span className={`relative text-sm font-bold ${count > 0 ? 'text-[#3B82F6]' : 'text-zinc-400'}`}>
              {count}
            </span>
          </span>
        </div>
      </motion.button>

      {/* Dropdown - Premium Glassmorphic Card */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            
            {/* Dropdown Card */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute right-0 mt-2 w-80 z-50"
            >
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-[#3B82F6]/10 rounded-2xl blur-xl" />
              
              {/* Glass card */}
              <div className="relative rounded-xl overflow-hidden backdrop-blur-xl bg-zinc-900/90 border border-white/10">
                {/* Chromatic top line */}
                <div 
                  className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.6), transparent)' }}
                />
                
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="absolute inset-0 bg-[#3B82F6]/40 rounded-full blur" />
                      <Users className="relative w-4 h-4 text-[#3B82F6]" />
                    </div>
                    <span className="text-sm font-medium text-white">
                      Connected Coach{count !== 1 ? 'es' : ''}
                    </span>
                    <span className="text-xs text-zinc-500">({count})</span>
                  </div>
                </div>
                
                {/* Coach List */}
                <div className="max-h-80 overflow-y-auto">
                  {coaches.length === 0 ? (
                    <div className="p-6 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-800/50 flex items-center justify-center">
                        <Users className="w-6 h-6 text-zinc-500" />
                      </div>
                      <p className="text-sm text-zinc-400 mb-1">No coaches connected yet</p>
                      <p className="text-xs text-zinc-500">Connect with a coach to get started</p>
                    </div>
                  ) : (
                    <div className="p-2">
                      {coaches.map((c, index) => (
                        <motion.div 
                          key={c.id} 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                        >
                          {/* Avatar with glow */}
                          <div className="relative flex-shrink-0">
                            {/* Glow on hover */}
                            <div className="absolute -inset-1 bg-[#3B82F6]/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
                            
                            {c.data?.profileImage?.profileImageURL ? (
                              <img 
                                src={c.data.profileImage.profileImageURL} 
                                alt={c.data?.displayName || c.data?.username || 'Coach'} 
                                className="relative w-10 h-10 rounded-full object-cover border border-white/10 group-hover:border-[#3B82F6]/30 transition-colors" 
                              />
                            ) : (
                              <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-[#3B82F6]/20 to-[#8B5CF6]/20 border border-white/10 group-hover:border-[#3B82F6]/30 flex items-center justify-center transition-colors">
                                <span className="text-white text-sm font-semibold">
                                  {(c.data?.displayName || c.data?.username || 'C')?.[0]?.toUpperCase()}
                                </span>
                              </div>
                            )}
                            
                            {/* Online indicator */}
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#22C55E] border-2 border-zinc-900" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">
                              @{c.data?.username || 'coach'}
                            </div>
                            {c.data?.displayName && (
                              <div className="text-xs text-zinc-400 truncate">{c.data.displayName}</div>
                            )}
                          </div>
                          
                          {/* View button */}
                          <motion.div 
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-[#3B82F6]/30 transition-all cursor-pointer">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </motion.div>
                        </motion.div>
                      ))}
                  </div>
                )}
                </div>
              </div>
            </motion.div>
          </>
      )}
      </AnimatePresence>
    </div>
  );
};

export default ConnectedCoachesBadge;
