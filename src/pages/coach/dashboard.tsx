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
  Copy,
  BellRing,
  ArrowRight,
  FileText,
  ClipboardCheck
} from 'lucide-react';
import { db } from '../../api/firebase/config';
import { doc, getDoc, collection, getDocs, onSnapshot, query, where, updateDoc } from 'firebase/firestore';
import { EscalationRecordStatus } from '../../api/firebase/escalation/types';
import { escalationRecordsService } from '../../api/firebase/escalation/service';
import { EscalationTier } from '../../api/firebase/escalation/types';
import { convertFirestoreTimestamp } from '../../utils/formatDate';
import {
  getLatestSportsIntelligenceReportForCoach,
  type CoachReportListItem,
} from '../../api/firebase/pulsecheckCoachReportAccess';

type CoachNotificationDoc = {
  id: string;
  title?: string;
  message?: string;
  type: string;
  coachId: string;
  createdAt?: number;
  read?: boolean;
  archived?: boolean;
  actionRequired?: boolean;
  webUrl?: string;
};

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

const relativeTimestamp = (timestamp?: number) => {
  if (!timestamp) return 'Just now';

  const date = convertFirestoreTimestamp(timestamp);
  const deltaMs = Date.now() - date.getTime();
  const deltaMinutes = Math.floor(deltaMs / (1000 * 60));
  const deltaHours = Math.floor(deltaMinutes / 60);
  const deltaDays = Math.floor(deltaHours / 24);

  if (deltaMinutes < 1) return 'Just now';
  if (deltaMinutes < 60) return `${deltaMinutes} min ago`;
  if (deltaHours < 24) return `${deltaHours} hr${deltaHours === 1 ? '' : 's'} ago`;
  if (deltaDays < 7) return `${deltaDays} day${deltaDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const isSafetyNotification = (notification: CoachNotificationDoc) => {
  const type = notification.type?.toLowerCase() || '';
  return type.includes('escalation') || type.includes('safety') || type.includes('tier');
};

const getEscalationLaneLabel = (tier?: number) => {
  if (tier === EscalationTier.CriticalRisk) return 'Tier 3';
  if (tier === EscalationTier.ElevatedRisk) return 'Tier 2';
  if (tier === EscalationTier.MonitorOnly) return 'Tier 1';
  return 'Tier 0';
};

const getEscalationLaneCopy = (tier?: number) => {
  if (tier === EscalationTier.CriticalRisk) return 'Immediate privacy-safe safety visibility is active.';
  if (tier === EscalationTier.ElevatedRisk) return 'Clinical handoff visibility is active.';
  if (tier === EscalationTier.MonitorOnly) return 'Coach-aware monitor state is active.';
  return 'No safety visibility is active.';
};

const formatReportDate = (date?: Date) => {
  if (!date) return 'Date pending';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatAdherenceChip = (report?: CoachReportListItem | null) => {
  if (!report?.adherence?.categoriesTotal) return 'Coverage pending';
  return `Adherence: ${report.adherence.categoriesReady ?? 0} / ${report.adherence.categoriesTotal} categories`;
};

const CoachDashboard: React.FC = () => {
  const currentUser = useUser();
  const userLoading = useUserLoading();
  const router = useRouter();
  const [coachProfile, setCoachProfile] = useState<CoachModel | null>(null);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharedAthletes, setSharedAthletes] = useState<any[]>([]);
  const [_sharedByCoach, setSharedByCoach] = useState<Array<{coachId: string; coachName?: string; athletes: any[]}>>([]);
  const [pendingInvites, setPendingInvites] = useState<{ coachId: string; coachName?: string; permission: 'full'|'limited'; allowedAthletes?: string[] }[]>([]);
  const [coachNotifications, setCoachNotifications] = useState<CoachNotificationDoc[]>([]);
  const [latestSportsIntelligenceReport, setLatestSportsIntelligenceReport] = useState<CoachReportListItem | null>(null);
  const [sportsIntelligenceLoading, setSportsIntelligenceLoading] = useState(false);

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

  const scrollToAthletesSection = () => {
    if (typeof window === 'undefined') return;
    document.getElementById('coach-athletes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openCoachNotification = async (notification?: CoachNotificationDoc) => {
    if (!notification?.webUrl) {
      await router.push('/coach/notifications');
      return;
    }

    if (notification.webUrl.startsWith('http')) {
      const normalized = notification.webUrl.replace('https://fitwithpulse.ai', '');
      await router.push(normalized || '/coach/notifications');
      return;
    }

    await router.push(notification.webUrl);
  };

  useEffect(() => {
    if (!currentUser?.id) {
      setCoachNotifications([]);
      return;
    }

    const notificationsQuery = query(
      collection(db, 'coach-notifications'),
      where('coachId', '==', currentUser.id)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const docs = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as CoachNotificationDoc))
          .filter((notification) => notification.archived !== true)
          .sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));
        setCoachNotifications(docs);
      },
      (notificationError) => {
        console.error('Failed to load coach dashboard notifications:', notificationError);
        setCoachNotifications([]);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.id]);

  const unreadNotificationCount = coachNotifications.filter((notification) => !notification.read).length;
  const actionNotificationCount = coachNotifications.filter((notification) => notification.actionRequired && !notification.read).length;
  const recentCoachNotifications = coachNotifications.slice(0, 3);
  const reviewNotifications = coachNotifications.filter((notification) => notification.actionRequired && !isSafetyNotification(notification)).slice(0, 2);
  const awarenessNotifications = coachNotifications.filter((notification) => !notification.actionRequired && !isSafetyNotification(notification)).slice(0, 2);
  const safetyVisibleAthletes = [...athletes]
    .filter((athlete) => typeof athlete.activeEscalationTier === 'number' && athlete.activeEscalationTier >= EscalationTier.MonitorOnly)
    .sort((left, right) => (right.activeEscalationTier || 0) - (left.activeEscalationTier || 0))
    .slice(0, 3);

  useEffect(() => {
    if (!currentUser?.id) {
      setLatestSportsIntelligenceReport(null);
      setSportsIntelligenceLoading(false);
      return;
    }

    let cancelled = false;
    setSportsIntelligenceLoading(true);

    getLatestSportsIntelligenceReportForCoach(currentUser.id)
      .then((report) => {
        if (!cancelled) setLatestSportsIntelligenceReport(report);
      })
      .catch((reportError) => {
        console.error('Failed to load latest Sports Intelligence report:', reportError);
        if (!cancelled) setLatestSportsIntelligenceReport(null);
      })
      .finally(() => {
        if (!cancelled) setSportsIntelligenceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

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
        
        // Load active escalations for this coach and map to athletes
        console.log('🔍 [CoachDashboard] ========== ESCALATION LOADING START ==========');
        console.log('🔍 [CoachDashboard] Coach ID:', coachProfile.id);
        console.log('🔍 [CoachDashboard] Connected athletes count:', connectedAthletes.length);
        console.log('🔍 [CoachDashboard] Athlete IDs:', connectedAthletes.map(a => ({ id: a.id, name: a.displayName })));
        
        try {
          // Get escalations by coachId (if coach was notified)
          console.log('🔍 [CoachDashboard] Step 1: Querying escalations by coachId...');
          const escalationsByCoach = await escalationRecordsService.getActiveForCoach(coachProfile.id);
          console.log('✅ [CoachDashboard] Step 1 Result: Found', escalationsByCoach.length, 'escalations by coachId');
          escalationsByCoach.forEach((esc, idx) => {
            console.log(`   [${idx + 1}] Escalation: userId=${esc.userId}, tier=${esc.tier}, status=${esc.status}, coachId=${esc.coachId}`);
          });
          
          // Also get escalations by athlete userId (in case coachId not set yet)
          const athleteIds = connectedAthletes.map(a => a.id);
          const escalationMap = new Map<string, number>(); // athleteId -> tier
          
          console.log('🔍 [CoachDashboard] Step 2: Querying escalation-records collection by userId for each athlete...');
          console.log('🔍 [CoachDashboard] Collection: escalation-records');
          console.log('🔍 [CoachDashboard] Filter: status == "active"');
          
          // Query escalations for each athlete
          const escalationRef = collection(db, 'escalation-records');
          
          // Query ALL escalations first to see what exists
          console.log('🔍 [CoachDashboard] Step 2a: Querying ALL escalation-records (no filters) to see what exists...');
          try {
            const allEscalationsSnapshot = await getDocs(collection(db, 'escalation-records'));
            console.log('📊 [CoachDashboard] Total escalation-records in collection:', allEscalationsSnapshot.docs.length);
            allEscalationsSnapshot.docs.forEach((doc: any, idx: number) => {
              const data = doc.data();
              console.log(`   [${idx + 1}] Doc ID: ${doc.id}`, {
                userId: data.userId,
                tier: data.tier,
                status: data.status,
                coachId: data.coachId,
                coachNotified: data.coachNotified,
                createdAt: data.createdAt
              });
            });
          } catch (allQueryError) {
            console.error('❌ [CoachDashboard] Error querying all escalations:', allQueryError);
          }
          
          const escalationQueries = athleteIds.map(athleteId => {
            console.log(`🔍 [CoachDashboard] Creating query for athlete: ${athleteId}`);
            return query(
              escalationRef,
              where('userId', '==', athleteId),
              where('status', '==', EscalationRecordStatus.Active)
            );
          });
          
          console.log('🔍 [CoachDashboard] Step 2b: Executing', escalationQueries.length, 'queries...');
          const escalationSnapshots = await Promise.all(
            escalationQueries.map(async (q, index) => {
              try {
                const snapshot = await getDocs(q);
                console.log(`✅ [CoachDashboard] Query ${index + 1} (athlete: ${athleteIds[index]}): Found ${snapshot.docs.length} escalations`);
                snapshot.docs.forEach((doc, docIdx) => {
                  const data = doc.data();
                  console.log(`   [Doc ${docIdx + 1}] ID: ${doc.id}`, {
                    userId: data.userId,
                    tier: data.tier,
                    status: data.status,
                    category: data.category,
                    coachId: data.coachId
                  });
                });
                return snapshot;
              } catch (queryError) {
                console.error(`❌ [CoachDashboard] Query ${index + 1} failed for athlete ${athleteIds[index]}:`, queryError);
                return { docs: [] } as any;
              }
            })
          );
          
          // Process all escalations (from both coachId and userId queries)
          const allEscalations = [...escalationsByCoach];
          console.log('🔍 [CoachDashboard] Step 3: Processing escalations from userId queries...');
          escalationSnapshots.forEach((snapshot, index) => {
            const athleteId = athleteIds[index];
            console.log(`🔍 [CoachDashboard] Processing snapshot ${index + 1} for athlete ${athleteId}: ${snapshot.docs.length} docs`);
            snapshot.docs.forEach((doc: any, docIdx: number) => {
              const data = doc.data();
              const tier = data.tier;
              console.log(`   [Doc ${docIdx + 1}] Processing:`, {
                docId: doc.id,
                userId: data.userId,
                tier: tier,
                status: data.status,
                tierValid: tier && tier >= EscalationTier.MonitorOnly
              });
              
              if (tier && tier >= EscalationTier.MonitorOnly) {
                const escalationData = {
                  id: doc.id,
                  userId: athleteId,
                  tier: tier,
                  status: data.status,
                  conversationId: data.conversationId || '',
                  category: data.category || 'general',
                  triggerMessageId: data.triggerMessageId || '',
                  triggerContent: data.triggerContent || '',
                  classificationReason: data.classificationReason || '',
                  classificationConfidence: data.classificationConfidence || 0,
                  consentStatus: data.consentStatus || 'pending',
                  handoffStatus: data.handoffStatus || 'pending',
                  coachNotified: data.coachNotified || false,
                  createdAt: data.createdAt || Date.now() / 1000
                };
                allEscalations.push(escalationData as any);
                console.log(`   ✅ Added escalation to allEscalations:`, escalationData);
              } else {
                console.log(`   ⏭️ Skipped escalation (tier ${tier} < MonitorOnly)`);
              }
            });
          });
          
          console.log('📊 [CoachDashboard] Step 4: Total active escalations found:', allEscalations.length);
          allEscalations.forEach((esc, idx) => {
            console.log(`   [${idx + 1}] userId=${esc.userId}, tier=${esc.tier}, status=${esc.status}`);
          });
          
          // Map escalations to athletes (Tier 1+)
          console.log('🔍 [CoachDashboard] Step 5: Mapping escalations to athletes...');
          allEscalations.forEach((escalation, idx) => {
            console.log(`🔍 [CoachDashboard] Processing escalation ${idx + 1}:`, {
              userId: escalation.userId,
              tier: escalation.tier,
              status: escalation.status,
              tierValid: escalation.tier >= EscalationTier.MonitorOnly
            });
            
            // Show Tier 1+ on cards
            if (escalation.tier >= EscalationTier.MonitorOnly) {
              const existingTier = escalationMap.get(escalation.userId);
              console.log(`   Current tier in map for ${escalation.userId}:`, existingTier);
              // Keep highest tier if multiple escalations exist
              if (!existingTier || escalation.tier > existingTier) {
                escalationMap.set(escalation.userId, escalation.tier);
                console.log(`   ✅ Mapped escalation tier ${escalation.tier} to athlete ${escalation.userId}`);
              } else {
                console.log(`   ⏭️ Skipped (existing tier ${existingTier} >= new tier ${escalation.tier})`);
              }
            } else {
              console.log(`   ⏭️ Skipped (tier ${escalation.tier} < MonitorOnly)`);
            }
          });
          
          console.log('📊 [CoachDashboard] Step 6: Final escalation map:', Array.from(escalationMap.entries()));
          
          // Add escalation tier to athlete data
          console.log('🔍 [CoachDashboard] Step 7: Adding escalation tiers to athlete data...');
          const athletesWithEscalation = connectedAthletes.map(athlete => {
            const tier = escalationMap.get(athlete.id) || 0;
            console.log(`   Athlete: ${athlete.displayName} (${athlete.id}) → tier: ${tier}`);
            if (tier > 0) {
              console.log(`   ✅ ${athlete.displayName} HAS escalation tier ${tier}`);
            } else {
              console.log(`   ⚠️ ${athlete.displayName} has NO escalation`);
            }
            return {
              ...athlete,
              activeEscalationTier: tier
            };
          });
          
          console.log('✅ [CoachDashboard] ========== ESCALATION LOADING COMPLETE ==========');
          setAthletes(athletesWithEscalation);
        } catch (escalationError: any) {
          console.error('❌ [CoachDashboard] Failed to load escalations (non-blocking):', escalationError);
          console.error('❌ [CoachDashboard] Error details:', {
            message: escalationError?.message,
            stack: escalationError?.stack,
            name: escalationError?.name
          });
          setAthletes(connectedAthletes);
        }

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
          const invites: { coachId: string; coachName?: string; permission: 'full'|'limited'; allowedAthletes?: string[] }[] = [];
          const groupedShared: Array<{coachId: string; coachName?: string; athletes: any[]}> = [];
          for (const coachDoc of coachIdsSnap.docs) {
            const memberSnap = await getDoc(doc(db, 'coach-staff', coachDoc.id, 'members', (currentUser.email || '').toLowerCase()));
            if (memberSnap.exists()) {
              const data: any = memberSnap.data();
              if (data.status === 'invited') {
                invites.push({ coachId: coachDoc.id, coachName: undefined, permission: data.permission || 'limited', allowedAthletes: data.allowedAthletes || [] });
              } else if (data.permission === 'limited' && Array.isArray(data.allowedAthletes) && data.allowedAthletes.length) {
                continue;
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
        } catch (_subErr) {
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
              onClick={() => router.push('/PulseCheck/coach')}
                  className="w-full px-6 py-4 rounded-xl bg-[#E0FE10] text-black font-semibold shadow-lg shadow-[#E0FE10]/20 hover:shadow-[#E0FE10]/40 transition-shadow"
            >
              Open Coach-Led Org Setup
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

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mb-10"
        >
          <GlassCard
            accentColor="#10B981"
            hoverEffect={Boolean(latestSportsIntelligenceReport)}
            onClick={latestSportsIntelligenceReport ? () => router.push(latestSportsIntelligenceReport.href) : undefined}
          >
            <div className="p-6 lg:p-7">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#10B981]/40 bg-[#10B981]/15">
                    <FileText className="h-6 w-6 text-[#6EE7B7]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6EE7B7]">
                      Latest Sports Intelligence Report
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {sportsIntelligenceLoading
                        ? 'Checking for your latest reviewed read...'
                        : latestSportsIntelligenceReport?.title || 'No reviewed report has been sent yet.'}
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">
                      {latestSportsIntelligenceReport
                        ? `${latestSportsIntelligenceReport.weekLabel} · ${latestSportsIntelligenceReport.sportName} · ${latestSportsIntelligenceReport.teamName}`
                        : 'When the Pulse team publishes a weekly read, it will land here first with one click into the full coach report.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:items-center">
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-200">
                    <ClipboardCheck className="h-4 w-4 text-[#6EE7B7]" />
                    {sportsIntelligenceLoading ? 'Loading coverage' : formatAdherenceChip(latestSportsIntelligenceReport)}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-300">
                    {latestSportsIntelligenceReport
                      ? `Sent ${formatReportDate(latestSportsIntelligenceReport.sentAt || latestSportsIntelligenceReport.publishedAt || latestSportsIntelligenceReport.generatedAt)}`
                      : 'Archive opens once reports are available.'}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  disabled={!latestSportsIntelligenceReport}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (latestSportsIntelligenceReport) {
                      router.push(latestSportsIntelligenceReport.href);
                    }
                  }}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all ${
                    latestSportsIntelligenceReport
                      ? 'bg-[#E0FE10] text-black shadow-lg shadow-[#E0FE10]/15'
                      : 'cursor-not-allowed bg-white/5 text-zinc-500'
                  }`}
                >
                  Open Latest Report
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    router.push('/coach/sports-intelligence-reports');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
                >
                  View Report Archive
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-10"
        >
          <GlassCard accentColor={actionNotificationCount > 0 ? '#F59E0B' : '#3B82F6'} hoverEffect={false}>
            <div className="p-6 lg:p-7">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${actionNotificationCount > 0 ? 'border-[#F59E0B]/40 bg-[#F59E0B]/15' : 'border-[#3B82F6]/40 bg-[#3B82F6]/15'}`}>
                      <BellRing className={`h-5 w-5 ${actionNotificationCount > 0 ? 'text-[#F59E0B]' : 'text-[#3B82F6]'}`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Coach Follow-Up</p>
                      <h2 className="mt-1 text-2xl font-semibold text-white">
                        {actionNotificationCount > 0
                          ? `${actionNotificationCount} item${actionNotificationCount === 1 ? '' : 's'} may need your review right now.`
                          : unreadNotificationCount > 0
                            ? `${unreadNotificationCount} new update${unreadNotificationCount === 1 ? '' : 's'} are ready to review.`
                            : 'You are caught up on Nora and athlete follow-up.'}
                      </h2>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-300">
                    This is the first-read summary for what changed across Nora auto-assignments and athlete session updates, so you can decide quickly whether to step in or keep the day moving.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Needs Attention</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{actionNotificationCount}</p>
                    <p className="mt-2 text-xs text-zinc-400">Unread items where review or intervention may be helpful.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Unread Updates</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{unreadNotificationCount}</p>
                    <p className="mt-2 text-xs text-zinc-400">New follow-up items waiting in your coach queue.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Latest Rhythm</p>
                    <p className="mt-3 text-sm font-semibold text-white">
                      {recentCoachNotifications[0]?.title || 'No new follow-up yet'}
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">
                      {recentCoachNotifications[0]?.createdAt
                        ? relativeTimestamp(recentCoachNotifications[0].createdAt)
                        : 'New coach follow-up will appear here.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-[#F59E0B]/20 bg-[#F59E0B]/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F59E0B]">Review Suggested</p>
                      <p className="mt-2 text-sm text-zinc-300">Nora or the runtime thinks coach review may help.</p>
                    </div>
                    <span className="rounded-full bg-[#F59E0B]/15 px-3 py-1 text-sm font-semibold text-[#F59E0B]">
                      {actionNotificationCount}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {reviewNotifications.length > 0 ? reviewNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => openCoachNotification(notification)}
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-left transition-colors hover:bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          {!notification.read ? <span className="h-2 w-2 rounded-full bg-[#E0FE10]" /> : null}
                          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#F59E0B]">Coach Review</span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-white">{notification.title || 'Coach review item'}</p>
                        <p className="mt-1 text-sm leading-relaxed text-zinc-400">{notification.message || 'A review-worthy update is ready.'}</p>
                        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                          <span>{relativeTimestamp(notification.createdAt)}</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </button>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-4">
                        <p className="text-sm font-semibold text-white">Nothing needs review right now.</p>
                        <p className="mt-2 text-sm text-zinc-400">Coach-review prompts will appear here when Nora wants a human check.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#3B82F6]/20 bg-[#3B82F6]/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#93C5FD]">Awareness Only</p>
                      <p className="mt-2 text-sm text-zinc-300">Useful changes to know without implying intervention.</p>
                    </div>
                    <span className="rounded-full bg-[#3B82F6]/15 px-3 py-1 text-sm font-semibold text-[#93C5FD]">
                      {Math.max(unreadNotificationCount - actionNotificationCount, 0)}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {awarenessNotifications.length > 0 ? awarenessNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => openCoachNotification(notification)}
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-left transition-colors hover:bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          {!notification.read ? <span className="h-2 w-2 rounded-full bg-[#E0FE10]" /> : null}
                          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#93C5FD]">Awareness</span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-white">{notification.title || 'Coach update'}</p>
                        <p className="mt-1 text-sm leading-relaxed text-zinc-400">{notification.message || 'A new athlete or Nora update is ready.'}</p>
                        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                          <span>{relativeTimestamp(notification.createdAt)}</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </button>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-4">
                        <p className="text-sm font-semibold text-white">No awareness-only updates right now.</p>
                        <p className="mt-2 text-sm text-zinc-400">Routine athlete and Nora updates will collect here as the day unfolds.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#EF4444]/20 bg-[#EF4444]/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FCA5A5]">Safety Visibility</p>
                      <p className="mt-2 text-sm text-zinc-300">Privacy-safe awareness when the safety lane is active.</p>
                    </div>
                    <span className="rounded-full bg-[#EF4444]/15 px-3 py-1 text-sm font-semibold text-[#FCA5A5]">
                      {safetyVisibleAthletes.length}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {safetyVisibleAthletes.length > 0 ? safetyVisibleAthletes.map((athlete) => (
                      <button
                        key={athlete.id}
                        type="button"
                        onClick={scrollToAthletesSection}
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-left transition-colors hover:bg-white/5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{athlete.displayName || 'Athlete'}</p>
                          <span className="rounded-full bg-[#EF4444]/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#FCA5A5]">
                            {getEscalationLaneLabel(athlete.activeEscalationTier)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                          {getEscalationLaneCopy(athlete.activeEscalationTier)}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                          <span>Review roster safety context below</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </button>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-4">
                        <p className="text-sm font-semibold text-white">No privacy-safe safety visibility is active.</p>
                        <p className="mt-2 text-sm text-zinc-400">If Tier 1 to Tier 3 awareness becomes active, it will appear here without exposing sensitive detail.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-zinc-300">
                  {recentCoachNotifications[0]
                    ? `Latest rhythm: ${recentCoachNotifications[0].title || 'Coach update'} · ${relativeTimestamp(recentCoachNotifications[0].createdAt)}`
                    : 'Latest rhythm: New coach follow-up will appear here as athletes move through their daily loop.'}
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push('/coach/notifications')}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#E0FE10] px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-[#E0FE10]/15"
                  >
                    Open Notification Center
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                  {recentCoachNotifications[0]?.webUrl ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => openCoachNotification(recentCoachNotifications[0])}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
                    >
                      Open Latest Follow-Up
                      <ArrowRight className="h-4 w-4" />
                    </motion.button>
                  ) : null}
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

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
          id="coach-athletes-section"
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
                  Athlete access now comes from PulseCheck team invite links. Use your team workspace or provisioning flow to issue current invites instead of sharing legacy coach referral codes.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push('/coach/referrals')}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E0FE10] text-black font-semibold shadow-lg shadow-[#E0FE10]/20"
                  >
                    <Copy className="w-4 h-4" />
                    Open Invite Guidance
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
              {sharedAthletes.map((athlete, idx) => {
                // Load escalation for shared athletes too (if coach has access)
                return (
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
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </CoachLayout>
  );
};

export default CoachDashboard;
