import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  AlertOctagon,
  Eye,
  Shield,
  User,
  Clock,
  MessageCircle,
  ChevronRight,
  RefreshCw,
  Bell,
  Check,
  X as CloseIcon
} from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import {
  EscalationTier,
  EscalationCategory,
  EscalationRecord,
  EscalationRecordStatus,
  HandoffStatus,
  getTierLabel,
  getTierColor,
  getCategoryLabel,
  getCoachStatusLabel
} from '../../api/firebase/escalation/types';
import { escalationRecordsService } from '../../api/firebase/escalation/service';
import { db } from '../../api/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

// ============================================================================
// Types
// ============================================================================

interface AthleteInfo {
  id: string;
  displayName: string;
  username?: string;
  profileImage?: string;
}

interface EscalationWithAthlete extends EscalationRecord {
  athlete?: AthleteInfo;
}

// ============================================================================
// Escalation Card Component
// ============================================================================

interface EscalationCardProps {
  escalation: EscalationWithAthlete;
  onMessageAthlete?: (athleteId: string) => void;
}

const EscalationCard: React.FC<EscalationCardProps> = ({ escalation, onMessageAthlete }) => {
  const tierColor = getTierColor(escalation.tier);
  const statusLabel = getCoachStatusLabel(escalation.tier, escalation.handoffStatus);
  
  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000) - timestamp;
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getTierIcon = () => {
    switch (escalation.tier) {
      case EscalationTier.MonitorOnly:
        return <Eye className="w-4 h-4" />;
      case EscalationTier.ElevatedRisk:
        return <AlertTriangle className="w-4 h-4" />;
      case EscalationTier.CriticalRisk:
        return <AlertOctagon className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-800/50 rounded-xl overflow-hidden border border-zinc-700/50 hover:border-zinc-600/50 transition-all"
    >
      {/* Tier indicator line */}
      <div
        className="h-1"
        style={{ backgroundColor: tierColor.text }}
      />
      
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative">
              {escalation.athlete?.profileImage ? (
                <img
                  src={escalation.athlete.profileImage}
                  alt={escalation.athlete.displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                  <User className="w-5 h-5 text-zinc-400" />
                </div>
              )}
              {/* Status indicator */}
              <div
                className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-zinc-800"
                style={{ backgroundColor: tierColor.bg }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: tierColor.text }}
                />
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-white">
                {escalation.athlete?.displayName || 'Athlete'}
              </h4>
              <p className="text-xs text-zinc-500">
                @{escalation.athlete?.username || 'unknown'}
              </p>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Clock className="w-3 h-3" />
            {getTimeAgo(escalation.createdAt)}
          </div>
        </div>

        {/* Status Badge - Coach-safe messaging */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-3"
          style={{ backgroundColor: tierColor.bg }}
        >
          <span style={{ color: tierColor.text }}>{getTierIcon()}</span>
          <span className="text-sm font-medium" style={{ color: tierColor.text }}>
            {statusLabel}
          </span>
        </div>

        {/* Category - only general info, no clinical details */}
        <p className="text-sm text-zinc-400 mb-4">
          Category: {getCategoryLabel(escalation.category)}
        </p>

        {/* Handoff Status - for visibility only */}
        {escalation.tier >= EscalationTier.ElevatedRisk && (
          <div className="flex items-center gap-2 mb-4 text-xs text-zinc-500">
            <Shield className="w-3 h-3" />
            {escalation.handoffStatus === HandoffStatus.Completed ? (
              <span className="text-green-400">Support team engaged</span>
            ) : escalation.handoffStatus === HandoffStatus.Initiated ? (
              <span className="text-amber-400">Connecting with support...</span>
            ) : (
              <span>Awaiting athlete consent</span>
            )}
          </div>
        )}

        {/* Action - Message athlete */}
        <button
          onClick={() => onMessageAthlete?.(escalation.userId)}
          className="w-full py-2 px-4 rounded-lg bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          Send Supportive Message
        </button>

        {/* Coach Note - what they CAN'T see */}
        <p className="text-[11px] text-zinc-600 mt-3 text-center">
          Clinical details are confidential and only visible to support staff.
        </p>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Main Dashboard Component
// ============================================================================

interface EscalationDashboardProps {
  onMessageAthlete?: (athleteId: string) => void;
}

const EscalationDashboard: React.FC<EscalationDashboardProps> = ({ onMessageAthlete }) => {
  const currentUser = useUser();
  const [escalations, setEscalations] = useState<EscalationWithAthlete[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'tier1' | 'tier2' | 'tier3'>('all');

  // Load escalations for coach
  useEffect(() => {
    if (!currentUser?.id) return;

    const loadEscalations = async () => {
      setIsLoading(true);
      try {
        const records = await escalationRecordsService.getActiveForCoach(currentUser.id);
        
        // Fetch athlete info for each escalation
        const escalationsWithAthletes = await Promise.all(
          records.map(async (record) => {
            try {
              const userDoc = await getDoc(doc(db, 'users', record.userId));
              const userData = userDoc.exists() ? userDoc.data() : null;
              return {
                ...record,
                athlete: userData ? {
                  id: record.userId,
                  displayName: userData.displayName || userData.username || 'Athlete',
                  username: userData.username,
                  profileImage: userData.profilePicture || userData.profileImage
                } : undefined
              };
            } catch {
              return { ...record };
            }
          })
        );

        setEscalations(escalationsWithAthletes);
      } catch (error) {
        console.error('[EscalationDashboard] Failed to load escalations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial load
    loadEscalations();

    // Set up real-time listener
    const unsubscribe = escalationRecordsService.listenForCoach(currentUser.id, async (records) => {
      const escalationsWithAthletes = await Promise.all(
        records.map(async (record) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', record.userId));
            const userData = userDoc.exists() ? userDoc.data() : null;
            return {
              ...record,
              athlete: userData ? {
                id: record.userId,
                displayName: userData.displayName || userData.username || 'Athlete',
                username: userData.username,
                profileImage: userData.profilePicture || userData.profileImage
              } : undefined
            };
          } catch {
            return { ...record };
          }
        })
      );
      setEscalations(escalationsWithAthletes);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  // Filter escalations
  const filteredEscalations = escalations.filter((e) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'tier1') return e.tier === EscalationTier.MonitorOnly;
    if (activeFilter === 'tier2') return e.tier === EscalationTier.ElevatedRisk;
    if (activeFilter === 'tier3') return e.tier === EscalationTier.CriticalRisk;
    return true;
  });

  // Count by tier
  const tier1Count = escalations.filter(e => e.tier === EscalationTier.MonitorOnly).length;
  const tier2Count = escalations.filter(e => e.tier === EscalationTier.ElevatedRisk).length;
  const tier3Count = escalations.filter(e => e.tier === EscalationTier.CriticalRisk).length;

  return (
    <div className="bg-[#111417] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-red-500/20 flex items-center justify-center border border-amber-500/30">
              <Bell className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Athlete Alerts</h2>
              <p className="text-sm text-zinc-500">Athletes who may need support</p>
            </div>
          </div>
          
          {/* Refresh button */}
          <button
            onClick={() => setIsLoading(true)}
            className="p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          <FilterTab
            label="All"
            count={escalations.length}
            isActive={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <FilterTab
            label="Monitor"
            count={tier1Count}
            isActive={activeFilter === 'tier1'}
            onClick={() => setActiveFilter('tier1')}
            color={getTierColor(EscalationTier.MonitorOnly)}
          />
          <FilterTab
            label="Elevated"
            count={tier2Count}
            isActive={activeFilter === 'tier2'}
            onClick={() => setActiveFilter('tier2')}
            color={getTierColor(EscalationTier.ElevatedRisk)}
          />
          <FilterTab
            label="Critical"
            count={tier3Count}
            isActive={activeFilter === 'tier3'}
            onClick={() => setActiveFilter('tier3')}
            color={getTierColor(EscalationTier.CriticalRisk)}
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
        ) : filteredEscalations.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 font-medium">No active alerts</p>
            <p className="text-sm text-zinc-500 mt-1">
              Your athletes are doing well. Keep up the great coaching!
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {filteredEscalations.map((escalation) => (
                <EscalationCard
                  key={escalation.id}
                  escalation={escalation}
                  onMessageAthlete={onMessageAthlete}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Coach Privacy Notice */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-zinc-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-400">Privacy Note:</span> You can see that an athlete may need support, 
              but clinical details are only visible to licensed mental health professionals. 
              Your role is to provide coaching support and encouragement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Filter Tab Component
// ============================================================================

interface FilterTabProps {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  color?: { bg: string; text: string; border: string };
}

const FilterTab: React.FC<FilterTabProps> = ({ label, count, isActive, onClick, color }) => {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
        isActive
          ? 'bg-zinc-800 text-white'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
      }`}
    >
      {label}
      <span
        className="px-1.5 py-0.5 rounded text-xs"
        style={
          color && count > 0
            ? { backgroundColor: color.bg, color: color.text }
            : { backgroundColor: 'rgba(113, 113, 122, 0.2)', color: '#71717A' }
        }
      >
        {count}
      </span>
    </button>
  );
};

export default EscalationDashboard;
