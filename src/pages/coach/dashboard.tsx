import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signOut } from 'firebase/auth';
import { auth } from '../../api/firebase/config';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { coachService } from '../../api/firebase/coach';
import { CoachModel } from '../../types/Coach';
import AthleteCard from '../../components/AthleteCard';
import CoachLayout from '../../components/CoachLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  MessageCircle,
  Calendar,
  Zap,
  TrendingUp,
  RefreshCw,
  UserPlus,
  Copy
} from 'lucide-react';
import { db } from '../../api/firebase/config';
import { doc, getDoc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';

// Floating Orb Component for loading/error states
const FloatingOrb: React.FC<{
  color: string;
  size: string;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  delay?: number;
}> = ({ color, size, position, delay = 0 }) => (
  <motion.div
    className={`absolute ${size} rounded-full blur-3xl pointer-events-none`}
    style={{ backgroundColor: color, ...position }}
    animate={{
      scale: [1, 1.2, 1],
      opacity: [0.2, 0.35, 0.2],
    }}
    transition={{
      duration: 8,
      repeat: Infinity,
      delay,
      ease: "easeInOut"
    }}
  />
);

// Glass Card Component
const GlassCard: React.FC<{
  children: React.ReactNode;
  accentColor?: string;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
}> = ({ children, accentColor = '#E0FE10', className = '', onClick, hoverEffect = true }) => (
  <motion.div
    onClick={onClick}
    whileHover={hoverEffect ? { scale: 1.02, y: -4 } : undefined}
    className={`relative group ${onClick ? 'cursor-pointer' : ''} ${className}`}
  >
    {/* Chromatic glow background */}
    <div 
      className="absolute -inset-1 rounded-2xl blur-xl opacity-0 group-hover:opacity-40 transition-all duration-700"
      style={{ background: `linear-gradient(135deg, ${accentColor}40, transparent 60%)` }}
    />
    
    {/* Glass surface */}
    <div className="relative rounded-2xl overflow-hidden backdrop-blur-xl bg-zinc-900/60 border border-white/10">
      {/* Chromatic reflection line */}
      <div 
        className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}80, transparent)` }}
      />
      
      {/* Inner highlight */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
      
      {children}
    </div>
  </motion.div>
);

// Stat Card Component
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accentColor: string;
  subtext?: string;
  delay?: number;
}> = ({ icon, label, value, accentColor, subtext, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
  >
    <GlassCard accentColor={accentColor}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}20`, border: `1px solid ${accentColor}40` }}
          >
            <div style={{ color: accentColor }}>{icon}</div>
          </div>
          <span className="text-sm text-zinc-400">{label}</span>
        </div>
        <div className="text-3xl font-bold text-white" style={{ textShadow: `0 0 30px ${accentColor}40` }}>
          {value}
        </div>
        {subtext && <p className="text-zinc-500 text-sm mt-1">{subtext}</p>}
      </div>
    </GlassCard>
  </motion.div>
);

const CoachDashboard: React.FC = () => {
  const currentUser = useUser();
  const userLoading = useUserLoading();
  const router = useRouter();
  const [coachProfile, setCoachProfile] = useState<CoachModel | null>(null);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharedAthletes, setSharedAthletes] = useState<any[]>([]);
  const [sharedByCoach, setSharedByCoach] = useState<Array<{coachId: string; coachName?: string; athletes: any[]}>>([]);
  const [pendingInvites, setPendingInvites] = useState<{ coachId: string; coachName?: string; permission: 'full'|'limited'; allowedAthletes?: string[] }[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const canSeeEarnings = !!(coachProfile?.earningsAccess === true || coachProfile?.userType === 'partner');
  
  const navItems = [
    { href: '/coach/dashboard', label: 'Dashboard' },
    { href: '/coach/referrals', label: 'Referrals' },
    ...(canSeeEarnings ? [{ href: '/coach/revenue', label: 'Earnings' }] : []),
    { href: '/coach/staff', label: 'Staff' },
    { href: '/coach/inbox', label: 'Inbox' },
    { href: '/coach/profile', label: 'Profile' }
  ];

  const handleCopyCode = async () => {
    if (coachProfile?.referralCode) {
      await navigator.clipboard.writeText(coachProfile.referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };
  
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      try {
        localStorage.removeItem('pulse_has_seen_marketing');
      } catch (_) {}
      router.replace('/');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  useEffect(() => {
    const fetchCoachProfile = async () => {
      if (userLoading) return;
      
      if (!currentUser) {
        setError('Please sign in to access the coach dashboard.');
        setLoading(false);
        return;
      }

      try {
        const coachProfile = await coachService.getCoachProfile(currentUser.id);
        
        if (!coachProfile) {
          setError('Access denied. Coach account required.');
          setLoading(false);
          return;
        }

        setCoachProfile(coachProfile);
        const connectedAthletes = await coachService.getConnectedAthletes(coachProfile.id);
        setAthletes(connectedAthletes);

        // Fetch shared athletes
        try {
          if (currentUser?.email) {
            const invitesRef = collection(db, 'staff-invites');
            const qInv = query(invitesRef, where('memberEmail', '==', currentUser.email.toLowerCase()), where('status', '==', 'accepted'));
            const snap = await getDocs(qInv);
            const allShared: any[] = [];
            const grouped: Array<{coachId: string; coachName?: string; athletes: any[]}> = [];
            for (const d of snap.docs) {
              const data: any = d.data();
              const allow: string[] = Array.isArray(data.allowedAthletes) ? data.allowedAthletes : [];
              if (data.permission === 'full') {
                const connected = await coachService.getConnectedAthletes(data.coachId);
                grouped.push({ coachId: data.coachId, coachName: data.coachUsername, athletes: connected });
                allShared.push(...connected);
              } else if (allow.length) {
                const perCoach: any[] = [];
                await Promise.all(allow.map(async (aid: string) => {
                  try {
                    const uref = doc(db, 'users', aid);
                    const usnap = await getDoc(uref);
                    if (usnap.exists()) {
                      const u = usnap.data();
                      const athlete = { id: aid, ...u };
                      perCoach.push(athlete);
                      allShared.push(athlete);
                    }
                  } catch (_) {}
                }));
                grouped.push({ coachId: data.coachId, coachName: data.coachUsername, athletes: perCoach });
              }
            }
            if (grouped.length) setSharedByCoach(grouped);
            setSharedAthletes(allShared);
          }
        } catch (_) {
          setSharedAthletes([]);
        }

        setLoading(false);
      } catch (err) {
        try {
          if (!currentUser) throw err;
          const coachStaffRoot = collection(db, 'coach-staff');
          const coachIdsSnap = await getDocs(coachStaffRoot);
          let found: { coachId: string; allowed: string[] } | null = null;
          const invites: { coachId: string; coachName?: string; permission: 'full'|'limited'; allowedAthletes?: string[] }[] = [];
          const groupedShared: Array<{coachId: string; coachName?: string; athletes: any[]}> = [];
          for (const coachDoc of coachIdsSnap.docs) {
            const memberSnap = await getDoc(doc(db, 'coach-staff', coachDoc.id, 'members', (currentUser.email || '').toLowerCase()));
            if (memberSnap.exists()) {
              const data: any = memberSnap.data();
              if (data.status === 'invited') {
                invites.push({ coachId: coachDoc.id, coachName: undefined, permission: data.permission || 'limited', allowedAthletes: data.allowedAthletes || [] });
              } else if (data.permission === 'limited' && Array.isArray(data.allowedAthletes) && data.allowedAthletes.length) {
                found = { coachId: coachDoc.id, allowed: data.allowedAthletes };
              } else if (data.permission === 'full') {
                const connected = await coachService.getConnectedAthletes(coachDoc.id);
                groupedShared.push({ coachId: coachDoc.id, coachName: undefined, athletes: connected });
              }
            }
          }
          if (groupedShared.length) setSharedByCoach(groupedShared);
          if (invites.length) {
            setPendingInvites(invites);
          }
          try {
            const invitesRef = collection(db, 'staff-invites');
            const qInv = query(invitesRef, where('memberEmail', '==', (currentUser.email||'').toLowerCase()), where('status', '==', 'accepted'));
            const snap = await getDocs(qInv);
            const allShared: any[] = [];
            const grouped: Array<{coachId: string; coachName?: string; athletes: any[]}> = [];
            for (const d of snap.docs) {
              const data: any = d.data();
              const allow: string[] = Array.isArray(data.allowedAthletes) ? data.allowedAthletes : [];
              if (data.permission === 'full') {
                const connected = await coachService.getConnectedAthletes(data.coachId);
                grouped.push({ coachId: data.coachId, coachName: data.coachUsername, athletes: connected });
              } else if (allow.length) {
                const perCoach: any[] = [];
                await Promise.all(allow.map(async (aid: string) => {
                  try {
                    const uref = doc(db, 'users', aid);
                    const usnap = await getDoc(uref);
                    if (usnap.exists()) {
                      const u = usnap.data();
                      perCoach.push({ id: aid, ...u });
                      allShared.push({ id: aid, ...u });
                    }
                  } catch (_) {}
                }));
                grouped.push({ coachId: data.coachId, coachName: data.coachUsername, athletes: perCoach });
              }
            }
            if (grouped.length) setSharedByCoach(grouped);
            if (allShared.length) setSharedAthletes(allShared);
          } catch (_) {}
          setError('Access denied. Coach account required.');
          setLoading(false);
        } catch (subErr) {
          console.error('Error fetching coach profile:', err);
          setError('Failed to load coach profile. Please try again.');
          setLoading(false);
        }
      }
    };

    fetchCoachProfile();
  }, [currentUser?.id, userLoading]);

  // Loading State with Chromatic Glass
  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center overflow-hidden">
        {/* Background orbs */}
        <div className="fixed inset-0 pointer-events-none">
          <FloatingOrb color="#E0FE10" size="w-[500px] h-[500px]" position={{ top: '-15%', left: '-10%' }} />
          <FloatingOrb color="#3B82F6" size="w-[400px] h-[400px]" position={{ bottom: '10%', right: '-5%' }} delay={2} />
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10"
        >
          <GlassCard accentColor="#E0FE10" hoverEffect={false}>
            <div className="p-12 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 mx-auto mb-6 rounded-full border-2 border-[#E0FE10] border-t-transparent"
              />
              <div className="text-xl font-semibold text-white mb-2">Loading Dashboard</div>
              <div className="text-zinc-500 text-sm">Preparing your coaching experience...</div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  // Error State with Chromatic Glass
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center overflow-hidden px-4">
        {/* Background orbs */}
        <div className="fixed inset-0 pointer-events-none">
          <FloatingOrb color="#EF4444" size="w-[400px] h-[400px]" position={{ top: '10%', left: '10%' }} />
          <FloatingOrb color="#E0FE10" size="w-[300px] h-[300px]" position={{ bottom: '20%', right: '10%' }} delay={2} />
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-lg"
        >
          <GlassCard accentColor="#E0FE10" hoverEffect={false}>
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#E0FE10]/10 border border-[#E0FE10]/20 flex items-center justify-center">
                <Zap className="w-8 h-8 text-[#E0FE10]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">No Coach Account</h2>
              <p className="text-zinc-400 mb-8">
                You're signed in but don't have a coach profile yet. Create one to access the dashboard.
              </p>
              
              <div className="space-y-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/coach/sign-up')}
                  className="w-full px-6 py-4 rounded-xl bg-[#E0FE10] text-black font-semibold shadow-lg shadow-[#E0FE10]/20 hover:shadow-[#E0FE10]/40 transition-shadow"
            >
              Create Coach Account
                </motion.button>
                
                <div className="text-sm text-zinc-500 pt-2">
              Signed in as <span className="text-zinc-300">{currentUser?.email || currentUser?.username || 'unknown'}</span>
            </div>
                
                <div className="flex items-center justify-center gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                onClick={handleSignOut}
                    className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-all"
              >
                Sign out
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                onClick={() => router.push('/')}
                    className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-all"
              >
                Go Home
                  </motion.button>
            </div>
          </div>
        </div>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  return (
    <CoachLayout title="Coach Dashboard" requiresActiveSubscription={false}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="Total Athletes"
            value={athletes.length}
            accentColor="#E0FE10"
            subtext="Connected athletes"
            delay={0.1}
          />
          <StatCard
            icon={<MessageCircle className="w-5 h-5" />}
            label="Conversations"
            value={athletes.reduce((acc, a) => acc + (a.conversationCount || 0), 0)}
            accentColor="#3B82F6"
            subtext="All-time messages"
            delay={0.2}
          />
          <StatCard
            icon={<Calendar className="w-5 h-5" />}
            label="Sessions"
            value={athletes.reduce((acc, a) => acc + (a.totalSessions || 0), 0)}
            accentColor="#8B5CF6"
            subtext="Completed workouts"
            delay={0.3}
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Active Today"
            value={athletes.filter(a => {
              if (!a.lastActiveDate) return false;
              const now = new Date();
              const last = new Date(a.lastActiveDate);
              return (now.getTime() - last.getTime()) < 86400000;
            }).length}
            accentColor="#10B981"
            subtext="Training today"
            delay={0.4}
          />
          </div>

        {/* Pending Invites */}
        <AnimatePresence>
          {pendingInvites.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <GlassCard accentColor="#F59E0B" hoverEffect={false}>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/20 border border-[#F59E0B]/40 flex items-center justify-center">
                      <UserPlus className="w-5 h-5 text-[#F59E0B]" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Pending Invites</h3>
                  </div>
                  <div className="space-y-3">
                    {pendingInvites.map((inv) => (
                      <div 
                        key={inv.coachId} 
                        className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
                      >
                        <span className="text-zinc-300">You've been invited to join a coach's staff.</span>
                        <div className="flex items-center gap-2">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={async () => {
                              if (!currentUser?.email) return;
                              const memberRef = doc(db, 'coach-staff', inv.coachId, 'members', currentUser.email.toLowerCase());
                              await updateDoc(memberRef, { status: 'accepted' });
                              setPendingInvites(prev => prev.filter(p => p.coachId !== inv.coachId));
                              if (inv.permission === 'full') {
                                const connected = await coachService.getConnectedAthletes(inv.coachId);
                                setSharedAthletes(connected);
                              } else if (inv.allowedAthletes && inv.allowedAthletes.length) {
                                const results: any[] = [];
                                await Promise.all(inv.allowedAthletes.map(async (aid: string) => {
                                  const uref = doc(db, 'users', aid);
                                  const usnap = await getDoc(uref);
                                  if (usnap.exists()) results.push({ id: aid, ...usnap.data() });
                                }));
                                setSharedAthletes(results);
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-[#E0FE10] text-black font-medium text-sm"
                          >
                            Accept
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={async () => {
                              if (!currentUser?.email) return;
                              const memberRef = doc(db, 'coach-staff', inv.coachId, 'members', currentUser.email.toLowerCase());
                              await updateDoc(memberRef, { status: 'declined' });
                              setPendingInvites(prev => prev.filter(p => p.coachId !== inv.coachId));
                            }}
                            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 text-sm"
                          >
                            Decline
                          </motion.button>
                        </div>
            </div>
                    ))}
          </div>
        </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Athletes Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">Your Athletes</h2>
              {athletes.length > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#E0FE10]/10 text-[#E0FE10] border border-[#E0FE10]/20">
                  {athletes.length} connected
                </span>
              )}
            </div>
            {athletes.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={async () => {
                  if (coachProfile) {
                    const connectedAthletes = await coachService.getConnectedAthletes(coachProfile.id);
                    setAthletes(connectedAthletes);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white text-sm transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </motion.button>
            )}
          </div>
          
          {athletes.length === 0 ? (
            <GlassCard accentColor="#E0FE10" hoverEffect={false}>
              <div className="p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#E0FE10]/10 border border-[#E0FE10]/20 flex items-center justify-center">
                  <Users className="w-10 h-10 text-[#E0FE10]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No athletes connected yet</h3>
                <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                  Share your referral code <span className="text-[#E0FE10] font-semibold">{coachProfile?.referralCode}</span> with athletes to get started.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCopyCode}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E0FE10] text-black font-semibold shadow-lg shadow-[#E0FE10]/20"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Referral Code
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    if (coachProfile) {
                        const connectedAthletes = await coachService.getConnectedAthletes(coachProfile.id);
                        setAthletes(connectedAthletes);
                    }
                  }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:text-white"
                >
                    <RefreshCw className="w-4 h-4" />
                  Refresh Athletes
                  </motion.button>
                </div>
              </div>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {athletes.map((athlete, idx) => (
                <motion.div
                  key={athlete.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * idx }}
                >
                  <AthleteCard
                  athlete={athlete}
                  onViewDetails={(athleteId) => {
                    console.log('View details for athlete:', athleteId);
                  }}
                  onMessageAthlete={(athleteId) => {
                    console.log('Message athlete:', athleteId);
                  }}
                />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Shared Athletes Section */}
        {sharedAthletes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-12"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white">Shared Athletes</h2>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20">
                  {sharedAthletes.length} assigned
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sharedAthletes.map((athlete, idx) => (
                <motion.div
                  key={athlete.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * idx }}
                >
                  <AthleteCard
                  athlete={athlete}
                    onViewDetails={() => {}}
                    onMessageAthlete={() => {}}
                />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </CoachLayout>
  );
};

export default CoachDashboard;
