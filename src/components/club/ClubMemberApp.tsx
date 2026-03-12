import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiActivity,
  FiArrowUpRight,
  FiBarChart2,
  FiCalendar,
  FiCheck,
  FiImage,
  FiMapPin,
  FiMessageCircle,
  FiPlus,
  FiSend,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { FaApple, FaGooglePlay } from 'react-icons/fa';
import PageHead from '../PageHead';
import {
  ClubActivationConfig,
  ClubActivationQuestionDefinition,
  ClubActivationResponse,
  ClubEvent,
  ClubFeatures,
  ClubMember,
  ClubMemberProfile,
  ClubPairing,
  ClubSafetyReportCategory,
} from '../../api/firebase/club/types';
import { clubService } from '../../api/firebase/club/service';
import { clubChatService } from '../../api/firebase/club/chat';
import { ClubLandingPageProps, RoundPreview } from '../../api/firebase/club/landingPage';
import { getClubMemberOriginDisplayLabel, parseClubMemberOrigin } from '../../api/firebase/club/origin';
import {
  getClubActivationQuestionsByIds,
  isClubActivationResponseComplete,
} from '../../api/firebase/club/activation';
import { ChatService } from '../../api/firebase/chat/service';
import { GroupMessage, MessageMediaType } from '../../api/firebase/chat/types';
import { creatorPagesService, Survey, SurveyResponse, CLIENT_QUESTIONNAIRES_PAGE_SLUG } from '../../api/firebase/creatorPages/service';
import SurveyTakingModal from '../Surveys/SurveyTakingModal';
import SurveyResponsesModal from '../Surveys/SurveyResponsesModal';
import { User, userService } from '../../api/firebase/user';
import {
  CLUB_TYPE_LABELS,
  deriveDarkBackground,
  ensureHexColor,
  formatCompactNumber,
  getAccentTextColor,
} from './theme';
import { platformDetection, appLinks } from '../../utils/platformDetection';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

type ClubData = NonNullable<ClubLandingPageProps['clubData']>;
type ClubTab = 'pulse' | 'members' | 'programs' | 'analytics';

interface ClubMemberAppProps {
  clubData: ClubData;
  creatorData?: ClubLandingPageProps['creatorData'];
  currentUser: User;
  totalWorkoutsCompleted?: number;
  allRounds?: RoundPreview[];
  isCreator?: boolean;
  onLeave?: () => Promise<void> | void;
  isLeaving?: boolean;
}

interface ConsolidatedClubMessage extends GroupMessage {
  source: 'club' | 'round';
  sourceRoundName?: string;
}

interface LeaderboardEntry {
  member: ClubMember;
  workoutCount: number;
}

const buildDefaultIntroTemplate = (clubName: string): string =>
  `Hey everyone! I'm [your name]. Excited to join ${clubName} and train with you all. Right now I'm focused on [your goal].`;

const CLUB_CONDUCT_GUIDELINES = [
  'Respect personal boundaries, identities, and training preferences.',
  'No harassment, discrimination, threats, or unwanted contact.',
  'If a pairing or interaction feels wrong, opt out or request a rematch immediately.',
  'Hosts may remove members or end participation for unsafe behavior at any time.',
];

const ActivationQuestionField: React.FC<{
  accent: string;
  question: ClubActivationQuestionDefinition;
  response?: ClubActivationResponse;
  onChange: (nextResponse: ClubActivationResponse) => void;
}> = ({ accent, question, response, onChange }) => {
  if (question.type === 'short_text') {
    return (
      <textarea
        value={response?.textValue || ''}
        onChange={(event) =>
          onChange(
            new ClubActivationResponse({
              questionId: question.id,
              type: question.type,
              selectedOptionIds: [],
              textValue: event.target.value,
            })
          )
        }
        placeholder={question.placeholder || 'Type your answer'}
        rows={3}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30 focus:bg-black/40"
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {question.options.map((option) => {
        const isSelected = response?.selectedOptionIds.includes(option.id) ?? false;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              const nextSelectedOptionIds =
                question.type === 'multi_select'
                  ? isSelected
                    ? (response?.selectedOptionIds || []).filter((optionId) => optionId !== option.id)
                    : [...(response?.selectedOptionIds || []), option.id]
                  : [option.id];

              onChange(
                new ClubActivationResponse({
                  questionId: question.id,
                  type: question.type,
                  selectedOptionIds: nextSelectedOptionIds,
                  textValue: '',
                })
              );
            }}
            className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
              isSelected
                ? 'text-black shadow-[0_20px_50px_rgba(0,0,0,0.3)]'
                : 'border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25 hover:bg-white/[0.06]'
            }`}
            style={isSelected ? { backgroundColor: accent, borderColor: accent } : undefined}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

const isMessageVisibleToUser = (message: GroupMessage, userId: string): boolean => {
  if (!message.visibility || message.visibility === 'public') {
    return true;
  }

  return message.visibleToUserId === userId;
};

const formatTime = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const formatEventWindow = (startDate: Date, endDate: Date): string => {
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${dateFormatter.format(startDate)} • ${timeFormatter.format(startDate)} - ${timeFormatter.format(endDate)}`;
};

const avatarForMember = (member: ClubMember): string => {
  return (
    member.userInfo?.profileImage?.profileImageURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(member.userInfo?.displayName || member.userInfo?.username || 'Pulse')}&background=111827&color=ffffff`
  );
};

const MessageBubble: React.FC<{
  accent: string;
  currentUserId: string;
  message: ConsolidatedClubMessage;
  onOpenQuestionnaire?: (surveyId: string, ownerId: string, messageId: string) => void;
  onOpenResponses?: (surveyId: string, ownerId: string, instanceId?: string) => void;
}> = ({ accent, currentUserId, message, onOpenQuestionnaire, onOpenResponses }) => {
  const isCurrentUser = message.sender.id === currentUserId;

  const bubbleClasses = isCurrentUser
    ? 'text-black'
    : 'bg-white/5 text-white border border-white/6';

  return (
    <div className={`flex items-end gap-3 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
      {!isCurrentUser ? (
        <img
          src={
            message.sender.profileImage?.profileImageURL ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(message.sender.displayName || message.sender.username || 'Pulse')}`
          }
          alt={message.sender.username}
          className="h-9 w-9 rounded-full object-cover"
        />
      ) : null}

      <div className={`max-w-[min(36rem,85vw)] ${isCurrentUser ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
        {message.source === 'round' && message.sourceRoundName ? (
          <div className="pl-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: `${accent}b8` }}>
            {message.sourceRoundName}
          </div>
        ) : null}

        {!isCurrentUser ? (
          <div className="pl-1 text-xs font-semibold" style={{ color: accent }}>
            @{message.sender.username || message.sender.displayName}
          </div>
        ) : null}

        <div
          className={`overflow-hidden rounded-[1.25rem] px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.22)] ${bubbleClasses}`}
          style={isCurrentUser ? { backgroundColor: accent } : undefined}
        >
          {message.mediaType === MessageMediaType.Image && message.mediaURL ? (
            <div className="space-y-3">
              <img src={message.mediaURL} alt="Club upload" className="max-h-80 w-full rounded-2xl object-cover" />
              {message.content ? <p className="text-sm leading-6">{message.content}</p> : null}
            </div>
          ) : null}

          {message.mediaType === MessageMediaType.Video && message.mediaURL ? (
            <div className="space-y-3">
              <video src={message.mediaURL} controls className="max-h-80 w-full rounded-2xl bg-black/40" />
              {message.content ? <p className="text-sm leading-6">{message.content}</p> : null}
            </div>
          ) : null}

          {message.mediaType === MessageMediaType.Audio && message.mediaURL ? (
            <div className="space-y-3">
              <audio controls src={message.mediaURL} className="w-full min-w-[16rem]" />
              {message.content ? <p className="text-sm leading-6">{message.content}</p> : null}
            </div>
          ) : null}

          {(message.mediaType === MessageMediaType.None || !message.mediaURL) && message.content && !message.questionnaireData ? (
            <p className="text-sm leading-6">{message.content}</p>
          ) : null}

          {message.questionnaireData && (
            <div className={`space-y-3 p-1`}>
              <div className="flex items-center gap-2 mb-2">
                <svg className={`w-5 h-5 ${isCurrentUser ? 'text-black/70' : 'text-[#E0FE10]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                <span className="font-bold text-xs tracking-wider uppercase opacity-80">Questionnaire</span>
              </div>
              <h4 className="text-base font-bold leading-tight">{message.questionnaireData.surveyTitle}</h4>
              {message.questionnaireData.surveyDescription ? (
                <p className={`text-sm ${isCurrentUser ? 'text-black/80' : 'text-white/80'}`}>{message.questionnaireData.surveyDescription}</p>
              ) : null}
              {message.questionnaireData.completedBy && message.questionnaireData.completedBy[currentUserId] ? (
                <button
                  onClick={() => onOpenResponses?.(message.questionnaireData!.surveyId, message.questionnaireData!.ownerUserId, message.questionnaireData!.instanceId)}
                  className={`mt-3 w-full rounded-xl py-2.5 text-sm font-bold shadow-md transition-transform hover:scale-[1.02] flex items-center justify-center gap-2 ${isCurrentUser ? 'bg-black text-[#E0FE10]' : 'bg-[#E0FE10] text-black'}`}
                >
                  <FiCheck className="text-lg" /> Completed - View Answers
                </button>
              ) : (
                <button
                  onClick={() => onOpenQuestionnaire?.(message.questionnaireData!.surveyId, message.questionnaireData!.ownerUserId, message.id)}
                  className={`mt-3 w-full rounded-xl py-2.5 text-sm font-bold shadow-md transition-transform hover:scale-[1.02] ${isCurrentUser ? 'bg-black text-white' : 'bg-white text-black'}`}
                  style={isCurrentUser ? undefined : { backgroundColor: accent, color: '#000' }}
                >
                  Complete Questionnaire
                </button>
              )}
            </div>
          )}
        </div>

        <div className="pl-1 text-[11px] uppercase tracking-[0.18em] text-white/30">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  );
};

/* ─── Member Origin Analytics Section ─────────────────────────────── */

interface MemberOriginSectionProps {
  members: ClubMember[];
  clubData: ClubData;
  accent: string;
  roundNameCache: Record<string, string>;
  setRoundNameCache: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const MemberOriginSection: React.FC<MemberOriginSectionProps> = ({
  members,
  clubData,
  accent,
  roundNameCache,
  setRoundNameCache,
}) => {
  // Exclude the creator from analytics
  const filteredMembers = useMemo(
    () => members.filter((m) => m.userId !== clubData.creatorId),
    [members, clubData.creatorId]
  );

  // Resolve all unique round IDs to names
  useEffect(() => {
    const roundIds = new Set<string>();

    for (const member of filteredMembers) {
      const { roundId } = parseClubMemberOrigin(member.joinedVia);
      if (roundId && !roundNameCache[roundId]) {
        roundIds.add(roundId);
      }
    }

    if (roundIds.size === 0) return;

    let cancelled = false;

    const fetchRoundNames = async () => {
      const updates: Record<string, string> = {};

      await Promise.all(
        [...roundIds].map(async (id) => {
          try {
            const snap = await getDoc(doc(db, 'rounds', id));
            if (snap.exists()) {
              const data = snap.data();
              updates[id] = data.name || data.title || id;
            } else {
              updates[id] = id; // fallback to ID
            }
          } catch {
            updates[id] = id;
          }
        })
      );

      if (!cancelled) {
        setRoundNameCache((prev) => ({ ...prev, ...updates }));
      }
    };

    void fetchRoundNames();
    return () => { cancelled = true; };
  }, [filteredMembers, roundNameCache, setRoundNameCache]);

  // Build analytics data
  const originData = useMemo(() => {
    const groups: Record<string, { label: string; members: ClubMember[] }> = {};

    for (const member of filteredMembers) {
      const parsed = parseClubMemberOrigin(member.joinedVia);
      const displayLabel = getClubMemberOriginDisplayLabel(parsed, roundNameCache);
      const key = parsed.key;

      if (!groups[key]) {
        groups[key] = { label: displayLabel, members: [] };
      }

      groups[key].members.push(member);
    }

    return Object.entries(groups)
      .map(([key, value]) => ({
        key,
        label: value.label,
        count: value.members.length,
        members: value.members,
        percentage: filteredMembers.length > 0 ? Math.round((value.members.length / filteredMembers.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredMembers, roundNameCache]);

  const categoryColors: Record<string, string> = {
    'event-checkin': '#22d3ee',     // cyan
    round: '#a78bfa',          // purple
    manual: '#f59e0b',         // amber
    backfill: '#6b7280',       // gray
    unknown: '#6b7280',
    creator: accent,
  };

  const getColor = (key: string) => {
    if (key.startsWith('round:')) return categoryColors.round;
    return categoryColors[key] || accent;
  };

  return (
    <section className="pb-10 pt-6">
      <div className="mb-5 flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${accent}16`, color: accent }}
        >
          <FiBarChart2 />
        </div>
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">Insights</div>
          <div className="text-lg font-black tracking-[-0.03em] text-white">Member Origin</div>
        </div>
      </div>

      {filteredMembers.length === 0 ? (
        <div className="flex min-h-[12rem] flex-col items-center justify-center gap-4 rounded-[1.6rem] border border-white/8 bg-black/18 p-6 text-center backdrop-blur-xl">
          <FiUsers className="text-3xl text-white/20" />
          <p className="text-sm text-white/45">No member data to analyze yet.</p>
        </div>
      ) : (
        <>
          {/* Summary breakdown */}
          <div className="mb-5 space-y-3 rounded-[1.6rem] border border-white/8 bg-black/18 p-5 backdrop-blur-xl">
            <div className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-white/40">
              Acquisition Breakdown
            </div>

            {/* Horizontal bar chart */}
            <div className="flex h-4 w-full overflow-hidden rounded-full">
              {originData.map((entry) => (
                <div
                  key={entry.key}
                  className="h-full transition-all"
                  style={{
                    width: `${entry.percentage}%`,
                    backgroundColor: getColor(entry.key),
                    minWidth: entry.percentage > 0 ? '4px' : '0',
                  }}
                  title={`${entry.label}: ${entry.count} (${entry.percentage}%)`}
                />
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {originData.map((entry) => (
                <div key={entry.key} className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5">
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: getColor(entry.key) }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-white/70">{entry.label}</span>
                  <span className="shrink-0 text-sm font-bold" style={{ color: getColor(entry.key) }}>
                    {entry.count}
                  </span>
                  <span className="shrink-0 text-xs text-white/35">{entry.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed member table */}
          <div className="rounded-[1.6rem] border border-white/8 bg-black/18 p-5 backdrop-blur-xl">
            <div className="mb-4 text-[11px] font-black uppercase tracking-[0.22em] text-white/40">
              Member Details ({filteredMembers.length})
            </div>

            <div className="space-y-2">
              {filteredMembers
                .sort((a, b) => (b.joinedAt?.getTime?.() || 0) - (a.joinedAt?.getTime?.() || 0))
                .map((member) => {
                  const parsed = parseClubMemberOrigin(member.joinedVia);
                  const displayLabel = getClubMemberOriginDisplayLabel(parsed, roundNameCache, {
                    includeRoundPrefix: false,
                  });

                  const color = parsed.category === 'round' ? categoryColors.round : (categoryColors[parsed.category] || accent);

                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
                    >
                      <img
                        src={
                          member.userInfo.profileImage?.profileImageURL ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(member.userInfo.username || 'M')}&background=222&color=fff&size=40`
                        }
                        alt={member.userInfo.username}
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">@{member.userInfo.username || 'unknown'}</div>
                        <div className="text-[11px] text-white/35">
                          {member.joinedAt ? member.joinedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </div>
                      </div>
                      <div
                        className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                        style={{ borderColor: `${color}40`, color, backgroundColor: `${color}12` }}
                      >
                        {displayLabel}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export const ClubMemberApp: React.FC<ClubMemberAppProps> = ({
  clubData,
  creatorData,
  currentUser,
  totalWorkoutsCompleted = 0,
  allRounds = [],
  isCreator = false,
  onLeave,
  isLeaving = false,
}) => {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<ClubTab>('pulse');
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [memberWorkoutCounts, setMemberWorkoutCounts] = useState<Record<string, number>>({});
  const [clubMessages, setClubMessages] = useState<GroupMessage[]>([]);
  const [roundMessages, setRoundMessages] = useState<Record<string, GroupMessage[]>>({});
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showAppBanner, setShowAppBanner] = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [roundNameCache, setRoundNameCache] = useState<Record<string, string>>({});
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const accent = ensureHexColor(clubData.accentColor);
  const accentHex = accent.replace('#', '');
  const darkBg = useMemo(() => deriveDarkBackground(accentHex), [accentHex]);
  const accentTextColor = useMemo(() => getAccentTextColor(accentHex), [accentHex]);
  const heroImage =
    clubData.coverImageURL ||
    creatorData?.profileImage?.profileImageURL ||
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop';
  const clubTypeLabel = clubData.clubType ? CLUB_TYPE_LABELS[clubData.clubType] || null : null;
  const shareUrl = `https://fitwithpulse.ai/club/${clubData.id}`;
  const features = new ClubFeatures(clubData.features || {});
  const activationConfig = useMemo(
    () => new ClubActivationConfig(clubData.activation?.toDictionary?.() ?? clubData.activation ?? {}),
    [clubData.activation]
  );
  const requiredActivationQuestions = useMemo(
    () => getClubActivationQuestionsByIds(activationConfig.requiredQuestionIds),
    [activationConfig.requiredQuestionIds]
  );

  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false);
  const [clubQuestionnaires, setClubQuestionnaires] = useState<Survey[]>([]);
  const [isLoadingQuestionnaires, setIsLoadingQuestionnaires] = useState(false);

  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [activeSurveyInstanceId, setActiveSurveyInstanceId] = useState<string | undefined>(undefined);
  const [activeMessage, setActiveMessage] = useState<ConsolidatedClubMessage | null>(null);

  const [activeSurveyForAnswers, setActiveSurveyForAnswers] = useState<Survey | null>(null);
  const [activeSurveyResponses, setActiveSurveyResponses] = useState<SurveyResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  const [selectedSurveyForSending, setSelectedSurveyForSending] = useState<Survey | null>(null);
  const [surveyIdentifier, setSurveyIdentifier] = useState('');

  const [surveysCache, setSurveysCache] = useState<Record<string, Survey>>({});
  const [currentMember, setCurrentMember] = useState<ClubMember | null>(null);
  const [currentMemberProfile, setCurrentMemberProfile] = useState<ClubMemberProfile | null>(null);
  const [currentPairing, setCurrentPairing] = useState<ClubPairing | null>(null);
  const [activationResponses, setActivationResponses] = useState<Record<string, ClubActivationResponse>>({});
  const [isLoadingActivation, setIsLoadingActivation] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showIntroPrompt, setShowIntroPrompt] = useState(false);
  const [pendingIntroCompletion, setPendingIntroCompletion] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [isSubmittingActivation, setIsSubmittingActivation] = useState(false);
  const [showPairingSafetyModal, setShowPairingSafetyModal] = useState(false);
  const [pairingOptInDraft, setPairingOptInDraft] = useState(true);
  const [doNotPairUserIdsDraft, setDoNotPairUserIdsDraft] = useState<string[]>([]);
  const [rematchReasonDraft, setRematchReasonDraft] = useState('');
  const [pairingSafetyFeedback, setPairingSafetyFeedback] = useState<string | null>(null);
  const [isSavingPairingSafety, setIsSavingPairingSafety] = useState(false);
  const [showConductModal, setShowConductModal] = useState(false);
  const [showSafetyReportModal, setShowSafetyReportModal] = useState(false);
  const [safetyReportCategory, setSafetyReportCategory] = useState<ClubSafetyReportCategory>('unsafe_behavior');
  const [safetyReportDetails, setSafetyReportDetails] = useState('');
  const [safetyReportReportedUserId, setSafetyReportReportedUserId] = useState('');
  const [isSubmittingSafetyReport, setIsSubmittingSafetyReport] = useState(false);

  const consolidatedMessages = useMemo<ConsolidatedClubMessage[]>(() => {
    const roundNameById = allRounds.reduce<Record<string, string>>((accumulator, round) => {
      accumulator[round.id] = round.title;
      return accumulator;
    }, {});

    const mergedMessages: ConsolidatedClubMessage[] = [
      ...clubMessages.map((message) => ({
        ...message,
        source: 'club' as const,
      })),
      ...Object.entries(roundMessages).flatMap(([roundId, messages]) =>
        messages.map((message) => ({
          ...message,
          source: 'round' as const,
          sourceRoundName: roundNameById[roundId] || 'Program',
        }))
      ),
    ];

    // Merge logic:
    // If a message has duplicate ID, we usually keep the club message.
    const dedup = mergedMessages.reduce((acc, msg) => {
      if (!acc[msg.id]) {
        acc[msg.id] = msg;
      }
      return acc;
    }, {} as Record<string, ConsolidatedClubMessage>);

    const finalMerged = Object.values(dedup);

    return finalMerged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()); // Oldest first for chat flow
  }, [clubMessages, roundMessages, allRounds]);

  // Effect to update activeMessage if the underlying message changes
  useEffect(() => {
    if (!activeMessage) return;
    const message = consolidatedMessages.find(m => m.id === activeMessage.id);
    if (activeMessage && message && message.id === activeMessage.id) {
      setActiveMessage(message);
    }
  }, [activeMessage, consolidatedMessages]);

  const handleOpenSurvey = async (ownerId: string, surveyId: string, pageSlug?: string, instanceId?: string, messageId?: string) => {
    try {
      const actualSlug = pageSlug || CLIENT_QUESTIONNAIRES_PAGE_SLUG;
      const fetched = await creatorPagesService.getSurveyById(ownerId, actualSlug, surveyId);
      if (fetched) {
        setActiveSurvey(fetched);
        if (instanceId) {
          setActiveSurveyInstanceId(instanceId);
        }
        if (messageId) {
          const msgToUpdate = consolidatedMessages.find(m => m.id === messageId);
          setActiveMessage(msgToUpdate || null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleViewAnswers = async (ownerId: string, surveyId: string, pageSlug?: string, instanceId?: string) => {
    setLoadingResponses(true);
    try {
      const actualSlug = pageSlug || CLIENT_QUESTIONNAIRES_PAGE_SLUG;
      const fetched = await creatorPagesService.getSurveyById(ownerId, actualSlug, surveyId);
      if (fetched) {
        setActiveSurveyForAnswers(fetched);

        // Fetch responses filtering by instanceId if provided
        const resps = await creatorPagesService.getSurveyResponses(ownerId, actualSlug, surveyId, instanceId);
        setActiveSurveyResponses(resps);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingResponses(false);
    }
  };

  // Detect checkedIn query param and show welcome modal
  useEffect(() => {
    if (router.query.checkedIn === 'true') {
      setShowCheckinModal(true);
      // Remove the query param from the URL without a re-render
      const { checkedIn, ...rest } = router.query;
      void router.replace(
        { pathname: router.pathname, query: rest },
        undefined,
        { shallow: true }
      );
    }
  }, [router]);

  // Detect platform on mount for app download banner
  useEffect(() => {
    const platform = platformDetection.getPlatform();
    if (platform !== 'desktop') {
      setDetectedPlatform(platform);
      try {
        const dismissed = sessionStorage.getItem(`pulse_app_banner_${clubData.id}`);
        if (!dismissed) {
          setShowAppBanner(true);
        }
      } catch { /* SSR / privacy mode */ }
    }
  }, [clubData.id]);

  const handleIntroduceSelf = useCallback(() => {
    const introTemplate = activationConfig.introTemplate || buildDefaultIntroTemplate(clubData.name);
    setNewMessage(introTemplate);
    setShowCheckinModal(false);
    setShowIntroPrompt(false);
    setPendingIntroCompletion(true);
    setSelectedTab('pulse');
    // Focus the chat input after a brief delay so the tab switch renders
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 150);
  }, [activationConfig.introTemplate, clubData.name]);

  useEffect(() => {
    let cancelled = false;

    if (isCreator || !activationConfig.enabled) {
      setShowActivationModal(false);
      setShowIntroPrompt(false);
      setCurrentMember(null);
      setCurrentMemberProfile(null);
      setActivationResponses({});
      return;
    }

    const loadActivationState = async () => {
      setIsLoadingActivation(true);

      try {
        const [member, profile] = await Promise.all([
          clubService.getClubMember(clubData.id, currentUser.id),
          clubService.getClubMemberProfile(clubData.id, currentUser.id),
        ]);

        if (cancelled) {
          return;
        }

        setCurrentMember(member);
        setCurrentMemberProfile(profile);
        setActivationResponses(profile?.responses || {});

        const needsOnboarding =
          Boolean(member) &&
          activationConfig.enabled &&
          requiredActivationQuestions.length > 0 &&
          !member?.onboardedAt;

        const needsIntro =
          Boolean(member) &&
          activationConfig.enabled &&
          activationConfig.introRequired &&
          !member?.introducedAt &&
          !needsOnboarding;

        setShowActivationModal(needsOnboarding);
        setShowIntroPrompt(needsIntro);
      } catch (error) {
        console.error('[ClubMemberApp] Failed to load activation state:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingActivation(false);
        }
      }
    };

    void loadActivationState();

    return () => {
      cancelled = true;
    };
  }, [
    activationConfig.enabled,
    activationConfig.introRequired,
    clubData.id,
    currentUser.id,
    isCreator,
    requiredActivationQuestions.length,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!activationConfig.matchingEnabled || isCreator) {
      setCurrentPairing(null);
      return;
    }

    const loadPairing = async () => {
      try {
        const pairings = await clubService.getClubPairings(clubData.id);
        if (!cancelled) {
          setCurrentPairing(
            pairings.find((pairing) => pairing.memberUserIds.includes(currentUser.id)) || null
          );
        }
      } catch (error) {
        console.error('[ClubMemberApp] Failed to load pairing state:', error);
      }
    };

    void loadPairing();

    return () => {
      cancelled = true;
    };
  }, [activationConfig.matchingEnabled, clubData.id, currentUser.id, isCreator]);

  useEffect(() => {
    setPairingOptInDraft(currentMemberProfile?.pairingOptIn ?? true);
    setDoNotPairUserIdsDraft(currentMemberProfile?.doNotPairUserIds || []);
    setRematchReasonDraft(currentMemberProfile?.rematchReason || '');
  }, [currentMemberProfile]);

  useEffect(() => {
    let cancelled = false;

    const loadMembers = async () => {
      setIsLoadingMembers(true);
      try {
        const fetchedMembers = await clubService.getClubMembers(clubData.id);
        if (!cancelled) {
          setMembers(fetchedMembers.sort((left, right) => left.joinedAt.getTime() - right.joinedAt.getTime()));
        }
      } catch (error) {
        console.error('[ClubMemberApp] Failed to load members:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingMembers(false);
        }
      }
    };

    const loadEvents = async () => {
      setIsLoadingEvents(true);
      try {
        const fetchedEvents = await clubService.getClubEvents(clubData.id);
        if (!cancelled) {
          setEvents(fetchedEvents);
        }
      } catch (error) {
        console.error('[ClubMemberApp] Failed to load club events:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingEvents(false);
        }
      }
    };

    loadMembers();
    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [clubData.id]);

  useEffect(() => {
    let cancelled = false;

    if (!members.length) {
      setMemberWorkoutCounts({});
      return;
    }

    const loadWorkoutCounts = async () => {
      try {
        const counts = await userService.getWorkoutCounts(members.map((member) => member.userId));
        if (!cancelled) {
          setMemberWorkoutCounts(counts);
        }
      } catch {
      }
    };

    loadWorkoutCounts();

    return () => {
      cancelled = true;
    };
  }, [members]);

  useEffect(() => {
    return clubChatService.subscribeToMessages(clubData.id, (messages) => {
      setClubMessages(messages.filter((message) => isMessageVisibleToUser(message, currentUser.id)));
    });
  }, [clubData.id, currentUser.id]);

  useEffect(() => {
    if (!allRounds.length) {
      setRoundMessages({});
      return;
    }

    const unsubscribeByRound = allRounds.map((round) =>
      ChatService.getInstance().subscribeToMessages(round.id, (messages) => {
        setRoundMessages((previous) => ({
          ...previous,
          [round.id]: messages.filter((message) => isMessageVisibleToUser(message, currentUser.id)),
        }));
      })
    );

    return () => {
      unsubscribeByRound.forEach((unsubscribe) => unsubscribe());
    };
  }, [allRounds, currentUser.id]);

  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    return members
      .filter((member) => member.userId !== clubData.creatorId)
      .map((member) => ({
        member,
        workoutCount: memberWorkoutCounts[member.userId] || 0,
      }))
      .filter((entry) => entry.workoutCount > 0)
      .sort((left, right) => right.workoutCount - left.workoutCount);
  }, [clubData.creatorId, memberWorkoutCounts, members]);

  const isActivationComplete = useMemo(() => {
    if (!requiredActivationQuestions.length) {
      return true;
    }

    return requiredActivationQuestions.every((question) =>
      isClubActivationResponseComplete(question, activationResponses[question.id])
    );
  }, [activationResponses, requiredActivationQuestions]);
  const hasSavedActivationResponses = Boolean(currentMemberProfile?.completedQuestionIds.length);
  const hasPendingRequiredIntro = Boolean(
    !isCreator &&
    activationConfig.enabled &&
    activationConfig.introRequired &&
    currentMember &&
    !currentMember.introducedAt
  );

  const updateMemberLocally = useCallback((updater: (member: ClubMember) => ClubMember) => {
    setCurrentMember((previous) => {
      if (!previous) {
        return previous;
      }

      const nextMember = updater(previous);
      setMembers((existingMembers) =>
        existingMembers.map((member) => (member.id === nextMember.id ? nextMember : member))
      );
      return nextMember;
    });
  }, []);

  const handleSubmitActivation = useCallback(async () => {
    if (!currentMember || !isActivationComplete) {
      setActivationError('Please complete every required question.');
      return;
    }

    setIsSubmittingActivation(true);
    setActivationError(null);

    try {
      const profile = await clubService.completeClubMemberOnboarding(
        clubData.id,
        currentUser.id,
        activationResponses
      );

      setCurrentMemberProfile(profile);
      updateMemberLocally((member) => {
        const nextMember = new ClubMember(member.toDictionary());
        nextMember.onboardedAt = profile.completedAt || new Date();
        return nextMember;
      });
      setShowActivationModal(false);

      if (activationConfig.introRequired) {
        setShowIntroPrompt(true);
      }
    } catch (error) {
      console.error('[ClubMemberApp] Failed to submit onboarding:', error);
      setActivationError('Could not save your onboarding answers. Please try again.');
    } finally {
      setIsSubmittingActivation(false);
    }
  }, [
    activationConfig.introRequired,
    activationResponses,
    clubData.id,
    currentMember,
    currentUser.id,
    isActivationComplete,
    updateMemberLocally,
  ]);

  const handleSavePairingSafety = useCallback(async () => {
    setIsSavingPairingSafety(true);
    setPairingSafetyFeedback(null);

    try {
      const normalizedDoNotPairUserIds = [...new Set(doNotPairUserIdsDraft)].filter(
        (userId) => userId !== currentUser.id
      );

      await clubService.updateClubMemberPairingPreferences({
        clubId: clubData.id,
        userId: currentUser.id,
        pairingOptIn: pairingOptInDraft,
        doNotPairUserIds: normalizedDoNotPairUserIds,
      });

      if (!pairingOptInDraft && currentPairing) {
        await clubService.removeClubPairing(clubData.id, currentPairing.id);
        setCurrentPairing(null);
        updateMemberLocally((member) => {
          const nextMember = new ClubMember(member.toDictionary());
          nextMember.pairedAt = undefined;
          return nextMember;
        });
      }

      setCurrentMemberProfile((previous) => {
        const baseProfile = previous
          ? previous.toDictionary()
          : {
              clubId: clubData.id,
              userId: currentUser.id,
              responses: activationResponses,
              completedQuestionIds: Object.keys(activationResponses),
              completedAt: currentMember?.onboardedAt,
            };

        return new ClubMemberProfile({
          ...baseProfile,
          pairingOptIn: pairingOptInDraft,
          doNotPairUserIds: normalizedDoNotPairUserIds,
          updatedAt: new Date(),
        });
      });

      setPairingSafetyFeedback('Safety preferences updated.');
      setShowPairingSafetyModal(false);
    } catch (error) {
      console.error('[ClubMemberApp] Failed to save pairing safety:', error);
      setPairingSafetyFeedback('Could not save pairing safety preferences.');
    } finally {
      setIsSavingPairingSafety(false);
    }
  }, [
    activationResponses,
    clubData.id,
    currentMember?.onboardedAt,
    currentPairing,
    currentUser.id,
    doNotPairUserIdsDraft,
    pairingOptInDraft,
    updateMemberLocally,
  ]);

  const handleRequestRematch = useCallback(async () => {
    if (!currentPairing) {
      return;
    }

    if (!rematchReasonDraft.trim()) {
      setPairingSafetyFeedback('Add a short reason so the host knows what to fix.');
      return;
    }

    setIsSavingPairingSafety(true);
    setPairingSafetyFeedback(null);

    try {
      await Promise.all([
        clubService.requestClubMemberRematch(clubData.id, currentUser.id, rematchReasonDraft),
        clubService.removeClubPairing(clubData.id, currentPairing.id),
      ]);

      setCurrentPairing(null);
      setCurrentMemberProfile((previous) => {
        const baseProfile = previous
          ? previous.toDictionary()
          : {
              clubId: clubData.id,
              userId: currentUser.id,
              responses: activationResponses,
              completedQuestionIds: Object.keys(activationResponses),
              completedAt: currentMember?.onboardedAt,
            };

        return new ClubMemberProfile({
          ...baseProfile,
          rematchRequestedAt: new Date(),
          rematchReason: rematchReasonDraft.trim(),
          updatedAt: new Date(),
        });
      });
      updateMemberLocally((member) => {
        const nextMember = new ClubMember(member.toDictionary());
        nextMember.pairedAt = undefined;
        return nextMember;
      });
      setPairingSafetyFeedback('Rematch requested. Your current pairing has been cleared.');
      setShowPairingSafetyModal(false);
    } catch (error) {
      console.error('[ClubMemberApp] Failed to request rematch:', error);
      setPairingSafetyFeedback('Could not submit your rematch request.');
    } finally {
      setIsSavingPairingSafety(false);
    }
  }, [
    activationResponses,
    clubData.id,
    currentMember?.onboardedAt,
    currentPairing,
    currentUser.id,
    rematchReasonDraft,
    updateMemberLocally,
  ]);

  const handleOpenSafetyReport = useCallback(() => {
    const pairedUserId = currentPairing?.memberUserIds.find((memberUserId) => memberUserId !== currentUser.id) || '';
    setSafetyReportCategory('unsafe_behavior');
    setSafetyReportDetails('');
    setSafetyReportReportedUserId(pairedUserId);
    setShowSafetyReportModal(true);
  }, [currentPairing?.memberUserIds, currentUser.id]);

  const handleSubmitSafetyReport = useCallback(async () => {
    if (!safetyReportDetails.trim()) {
      setPairingSafetyFeedback('Add a short description so the host can review the issue.');
      return;
    }

    setIsSubmittingSafetyReport(true);
    setPairingSafetyFeedback(null);

    try {
      await clubService.submitClubSafetyReport({
        clubId: clubData.id,
        reporterUserId: currentUser.id,
        reportedUserId: safetyReportReportedUserId || undefined,
        pairingId: currentPairing?.id,
        category: safetyReportCategory,
        details: safetyReportDetails,
      });
      setShowSafetyReportModal(false);
      setPairingSafetyFeedback('Safety report submitted. The host can now review it.');
      setSafetyReportDetails('');
    } catch (error) {
      console.error('[ClubMemberApp] Failed to submit safety report:', error);
      setPairingSafetyFeedback('Could not submit your safety report.');
    } finally {
      setIsSubmittingSafetyReport(false);
    }
  }, [
    clubData.id,
    currentPairing?.id,
    currentUser.id,
    safetyReportCategory,
    safetyReportDetails,
    safetyReportReportedUserId,
  ]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[ClubMemberApp] Failed to copy share link:', error);
    }
  };

  const sendMessage = async (media?: { mediaType: MessageMediaType; mediaURL: string | null }) => {
    const trimmedMessage = newMessage.trim();

    if (!trimmedMessage && !media?.mediaURL) {
      return;
    }

    setIsSendingMessage(true);
    setSendError(null);

    try {
      const recipientTokens = members
        .filter((member) => member.userId !== currentUser.id)
        .map((member) => member.userInfo?.fcmToken)
        .filter((token): token is string => Boolean(token));

      const result = await clubChatService.sendMessage(clubData.id, {
        sender: currentUser.toShortUser(),
        content: trimmedMessage,
        checkinId: null,
        timestamp: new Date(),
        readBy: { [currentUser.id]: new Date() },
        mediaURL: media?.mediaURL || null,
        mediaType: media?.mediaType || MessageMediaType.None,
        gymName: null,
        recipientFcmTokens: recipientTokens,
        visibility: 'public',
        visibleToUserId: null,
      });

      if (!result) {
        throw new Error('Could not send message.');
      }

      if (pendingIntroCompletion && currentMember && !currentMember.introducedAt) {
        await clubService.markClubMemberIntroduced(clubData.id, currentUser.id);
        updateMemberLocally((member) => {
          const nextMember = new ClubMember(member.toDictionary());
          nextMember.introducedAt = new Date();
          return nextMember;
        });
        setPendingIntroCompletion(false);
      }

      setNewMessage('');
    } catch (error) {
      console.error('[ClubMemberApp] Failed to send message:', error);
      setSendError(error instanceof Error ? error.message : 'Could not send message.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const mediaType = file.type.startsWith('image/')
      ? MessageMediaType.Image
      : file.type.startsWith('video/')
        ? MessageMediaType.Video
        : file.type.startsWith('audio/')
          ? MessageMediaType.Audio
          : null;

    if (!mediaType) {
      setSendError('Only image, video, or audio files are supported.');
      event.target.value = '';
      return;
    }

    setIsUploadingMedia(true);
    setSendError(null);

    try {
      const mediaURL = await clubChatService.uploadMedia(clubData.id, file, mediaType);
      if (!mediaURL) {
        throw new Error('Could not upload media.');
      }

      await sendMessage({ mediaType, mediaURL });
    } catch (error) {
      console.error('[ClubMemberApp] Failed to upload media:', error);
      setSendError(error instanceof Error ? error.message : 'Could not upload media.');
    } finally {
      setIsUploadingMedia(false);
      event.target.value = '';
    }
  };

  const activeMemberCount = members.filter((member) => member.isActive).length || clubData.memberCount || 0;
  const totalProgramCount = allRounds.length + events.length;
  const pairedMember = currentPairing
    ? members.find((member) => currentPairing.memberUserIds.includes(member.userId) && member.userId !== currentUser.id) || null
    : null;
  const doNotPairCandidates = members.filter(
    (member) => member.userId !== currentUser.id && member.userId !== clubData.creatorId
  );
  const creatorAvatar =
    creatorData?.profileImage?.profileImageURL ||
    clubData.logoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorData?.displayName || creatorData?.username || clubData.name)}`;

  return (
    <div className="min-h-screen overflow-y-auto font-sans text-white" style={{ backgroundColor: darkBg }}>
      <PageHead
        pageOgUrl={shareUrl}
        metaData={{
          pageId: clubData.id,
          pageTitle: `${clubData.name} | Pulse Club`,
          metaDescription: clubData.description || `Member view for ${clubData.name}.`,
          ogTitle: `${clubData.name} | Pulse Club`,
          ogDescription: clubData.description || `Member view for ${clubData.name}.`,
          ogImage: heroImage,
          ogUrl: shareUrl,
          twitterTitle: `${clubData.name} | Pulse Club`,
          twitterDescription: clubData.description || `Member view for ${clubData.name}.`,
          twitterImage: heroImage,
          lastUpdated: new Date().toISOString(),
        }}
        pageOgImage={heroImage}
      />

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-[-8%] top-[-12%] h-[32rem] w-[32rem] rounded-full opacity-[0.11] blur-[120px]"
          style={{ backgroundColor: accent }}
        />
        <div
          className="absolute bottom-[-8%] right-[-10%] h-[28rem] w-[28rem] rounded-full opacity-[0.09] blur-[120px]"
          style={{ backgroundColor: accent }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)',
            backgroundSize: '18px 18px',
          }}
        />
      </div>

      {/* Detect platform on mount for app download banner */}
      {/* (handled by useEffect below) */}

      <AnimatePresence>
        {showAppBanner && detectedPlatform !== 'desktop' ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative z-20 overflow-hidden"
          >
            <div
              className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6"
              style={{ backgroundColor: `${accent}18`, borderBottom: `1px solid ${accent}30` }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${accent}25` }}
                >
                  {detectedPlatform === 'ios' ? (
                    <FaApple className="text-lg" style={{ color: accent }} />
                  ) : (
                    <FaGooglePlay className="text-sm" style={{ color: accent }} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    Get the Pulse App
                  </p>
                  <p className="text-xs text-white/50 truncate">
                    Download for the best experience
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={detectedPlatform === 'ios' ? appLinks.appStoreUrl : appLinks.playStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition hover:scale-[1.02]"
                  style={{ backgroundColor: accent, color: accentTextColor }}
                >
                  Download
                </a>
                <button
                  onClick={() => {
                    setShowAppBanner(false);
                    try {
                      sessionStorage.setItem(`pulse_app_banner_${clubData.id}`, 'dismissed');
                    } catch { /* ignore */ }
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/70"
                  aria-label="Dismiss"
                >
                  <FiX className="text-sm" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/15 shadow-[0_24px_120px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="relative min-h-[31rem] overflow-hidden">
            <div className="absolute inset-0">
              <img src={heroImage} alt={clubData.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{ backgroundColor: accent }} />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to bottom, rgba(0,0,0,0.52), transparent 24%, rgba(0,0,0,0.12) 40%, ${darkBg} 92%)`,
                }}
              />
              <div
                className="absolute bottom-[-8rem] left-1/2 h-[20rem] w-[42rem] -translate-x-1/2 rounded-full opacity-[0.18] blur-[120px]"
                style={{ backgroundColor: accent }}
              />
            </div>

            <div className="relative flex min-h-[31rem] flex-col justify-between p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <button
                  onClick={() => router.back()}
                  className="rounded-full border border-white/15 bg-black/35 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-black/55 hover:text-white"
                >
                  Back
                </button>
                <div className="flex items-center gap-3">
                  {clubTypeLabel ? (
                    <div
                      className="rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.22em] backdrop-blur-md"
                      style={{ borderColor: `${accent}4f`, color: accent, backgroundColor: `${accent}18` }}
                    >
                      {clubTypeLabel}
                    </div>
                  ) : null}
                  <div className="hidden rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/70 sm:block">
                    Member View
                  </div>
                </div>
              </div>

              <div className="max-w-4xl">
                <div className="mb-4 flex items-center gap-3 text-sm text-white/70">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 backdrop-blur-md">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ backgroundColor: accent }} />
                    Live now
                  </span>
                  <span>@{clubData.creatorInfo?.username || creatorData?.username}</span>
                  <span className="text-white/25">•</span>
                  <span>{formatCompactNumber(clubData.memberCount || activeMemberCount)} members</span>
                </div>

                <h1 className="text-4xl font-black uppercase tracking-[-0.04em] text-white drop-shadow-2xl sm:text-6xl">
                  {clubData.name}
                </h1>

                {clubData.tagline ? (
                  <p className="mt-3 text-base font-medium italic text-white/72 sm:text-lg">{clubData.tagline}</p>
                ) : null}
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.8fr_1fr]">
                <div className="rounded-[1.35rem] border border-white/10 bg-black/30 p-4 backdrop-blur-md sm:p-5">
                  <div className="flex items-start gap-4">
                    <img src={creatorAvatar} alt={clubData.name} className="h-12 w-12 rounded-2xl object-cover shadow-lg" />
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: `${accent}cc` }}>
                        About The Club
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72 sm:text-[15px]">
                        {clubData.description || 'A persistent Pulse crew built around programs, accountability, and chat.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  {isCreator ? (
                    <>
                      <button
                        onClick={() => router.push(`/club-studio?clubId=${clubData.id}`)}
                        className="rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.18em] shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition hover:scale-[1.01]"
                        style={{ backgroundColor: accent, color: accentTextColor }}
                      >
                        Manage Club
                      </button>
                      <button
                        onClick={() => router.push('/create-round')}
                        className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white/85 transition hover:bg-white/10"
                      >
                        Create Program
                      </button>
                    </>
                  ) : null}

                  <button
                    onClick={handleShare}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white/85 transition hover:bg-white/10"
                  >
                    {copied ? 'Copied' : 'Share'}
                  </button>

                  {!isCreator && onLeave ? (
                    <button
                      onClick={() => onLeave()}
                      disabled={isLeaving}
                      className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white/85 transition hover:bg-white/10 disabled:opacity-60"
                    >
                      {isLeaving ? 'Leaving...' : 'Leave Club'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/8 px-4 py-4 sm:grid-cols-3 sm:px-6">
            {[
              { label: 'Members', value: activeMemberCount },
              { label: 'Workouts', value: totalWorkoutsCompleted },
              { label: 'Programs', value: totalProgramCount },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <div className="text-2xl font-black" style={{ color: accent }}>
                  {stat.value}
                </div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="sticky top-0 z-30 mt-5 border-b border-white/8 bg-[rgba(10,12,10,0.82)] backdrop-blur-xl">
          <div className={`grid gap-0 px-1 ${isCreator ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {([
              { id: 'pulse', label: 'Pulse' },
              { id: 'members', label: 'Members' },
              { id: 'programs', label: 'Programs' },
              ...(isCreator ? [{ id: 'analytics' as const, label: 'Insights' }] : []),
            ] as const).map((tab) => {
              const isActive = selectedTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className="relative px-4 py-4 text-center text-[11px] font-black uppercase tracking-[0.24em] transition"
                  style={{ color: isActive ? accent : 'rgba(255,255,255,0.38)' }}
                >
                  {tab.label}
                  <span
                    className="absolute inset-x-4 bottom-0 h-0.5 rounded-full transition"
                    style={{
                      backgroundColor: isActive ? accent : 'transparent',
                      boxShadow: isActive ? `0 0 18px ${accent}` : 'none',
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {selectedTab === 'pulse' ? (
          <section className="pb-8 pt-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: `${accent}c5` }}>
                  Recent Pulse
                </div>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-white">Club Chat + Program Feed</h2>
              </div>
              <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45 sm:block">
                {consolidatedMessages.length} messages
              </div>
            </div>

            {activationConfig.matchingEnabled ? (
              <div className="mb-5 rounded-[1.6rem] border border-white/8 bg-black/18 p-5 backdrop-blur-xl">
                {pairingSafetyFeedback ? (
                  <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
                    pairingSafetyFeedback.includes('Could not') || pairingSafetyFeedback.includes('Add a short reason')
                      ? 'border-red-500/20 bg-red-500/10 text-red-100'
                      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                  }`}>
                    {pairingSafetyFeedback}
                  </div>
                ) : null}
                {pairedMember ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <img
                        src={avatarForMember(pairedMember)}
                        alt={pairedMember.userInfo.username}
                        className="h-14 w-14 rounded-2xl object-cover"
                      />
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: `${accent}c5` }}>
                          Accountability Partner
                        </div>
                        <div className="mt-1 text-xl font-black tracking-[-0.03em] text-white">
                          {pairedMember.userInfo.displayName || pairedMember.userInfo.username}
                        </div>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">
                          @{pairedMember.userInfo.username || 'member'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowPairingSafetyModal(true)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white/80 transition hover:bg-white/10"
                    >
                      Safety options
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: `${accent}c5` }}>
                        Pairing Status
                      </div>
                      <div className="mt-2 text-lg font-black tracking-[-0.03em] text-white">
                        {hasPendingRequiredIntro
                          ? 'Post your intro to become pairing-ready'
                          : currentMemberProfile?.rematchRequestedAt
                            ? 'Rematch request submitted'
                            : currentMemberProfile?.pairingOptIn === false
                              ? 'You are opted out of pairing'
                              : currentMember?.onboardedAt
                                ? 'The host is reviewing pairings'
                                : 'Complete onboarding to unlock pairing'}
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                        Pairing is club-specific and host-managed. Once your match is confirmed, it will show up here.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPairingSafetyModal(true)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white/80 transition hover:bg-white/10"
                    >
                      Safety options
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            <div className="rounded-[1.6rem] border border-white/8 bg-black/18 shadow-[0_24px_90px_rgba(0,0,0,0.18)] backdrop-blur-xl">
              <div className="border-b border-white/8 bg-black/20 p-4">
                {sendError ? (
                  <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-100">
                    {sendError}
                  </div>
                ) : null}

                {hasPendingRequiredIntro ? (
                  <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: `${accent}c5` }}>
                          Intro Required
                        </div>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">
                          Introduce yourself in chat to unlock normal club posting. This keeps the club feeling intentional instead of anonymous.
                        </p>
                      </div>
                      <button
                        onClick={handleIntroduceSelf}
                        className="shrink-0 rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.18em] shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition hover:scale-[1.01]"
                        style={{ backgroundColor: accent, color: accentTextColor }}
                      >
                        Post intro
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <button
                        onClick={() => {
                          if (isCreator) {
                            setShowPlusMenu(!showPlusMenu);
                          } else {
                            uploadInputRef.current?.click();
                          }
                        }}
                        disabled={isSendingMessage || isUploadingMedia}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-[0_12px_30px_rgba(0,0,0,0.26)] transition disabled:opacity-60"
                        style={{ backgroundColor: accent, color: accentTextColor }}
                        aria-label="Upload media"
                      >
                        {isUploadingMedia ? <FiImage className="animate-pulse" /> : <FiPlus />}
                      </button>
                      {showPlusMenu && isCreator && (
                        <div className="absolute bottom-14 left-0 z-50 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl">
                          <button
                            onClick={() => {
                              setShowPlusMenu(false);
                              uploadInputRef.current?.click();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors"
                          >
                            <FiImage className="text-lg opacity-80" /> Send Media
                          </button>
                          <button
                            onClick={async () => {
                              setShowPlusMenu(false);
                              setShowQuestionnaireModal(true);
                              setIsLoadingQuestionnaires(true);
                              try {
                                const surveys = await creatorPagesService.getAllSurveys(currentUser.id);
                                setClubQuestionnaires(surveys);
                                const cache = { ...surveysCache };
                                surveys.forEach(s => cache[s.id] = s);
                                setSurveysCache(cache);
                              } catch (e) {
                                console.error(e);
                              } finally {
                                setIsLoadingQuestionnaires(false);
                              }
                            }}
                            className="w-full flex items-center gap-3 border-t border-white/5 px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors"
                          >
                            <svg className="w-[18px] h-[18px] opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> Send Questionnaire
                          </button>
                        </div>
                      )}
                    </div>

                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="image/*,video/*,audio/*"
                      className="hidden"
                      onChange={handleUploadChange}
                    />

                    <input
                      ref={chatInputRef}
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      placeholder="Message the club..."
                      className="h-12 flex-1 rounded-full border border-white/8 bg-white/5 px-5 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/18"
                    />

                    <button
                      onClick={() => void sendMessage()}
                      disabled={isSendingMessage || isUploadingMedia || (!newMessage.trim() && !uploadInputRef.current?.files?.length)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-50"
                      aria-label="Send message"
                    >
                      {isSendingMessage ? <FiActivity className="animate-spin" /> : <FiSend />}
                    </button>
                  </div>
                )}
              </div>

              <div className="max-h-[34rem] space-y-5 overflow-y-auto px-4 py-5 sm:px-5">
                {consolidatedMessages.length === 0 ? (
                  <div className="flex min-h-[20rem] flex-col items-center justify-center gap-4 text-center">
                    <div
                      className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 text-4xl"
                      style={{ backgroundColor: `${accent}12`, color: accent }}
                    >
                      <FiMessageCircle />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-[-0.03em] text-white">No pulse yet</h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-white/45">
                        Start the conversation. Club messages and linked round chat roll into the same feed here.
                      </p>
                    </div>
                  </div>
                ) : (
                  consolidatedMessages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      currentUserId={currentUser.id}
                      accent={accent}
                      onOpenQuestionnaire={handleOpenSurvey}
                      onOpenResponses={handleViewAnswers}
                    />
                  ))
                )}
              </div>
            </div>
          </section>
        ) : null}

        {selectedTab === 'members' ? (
          <section className="pb-10 pt-6">
            <div className="mb-4">
              <div className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: `${accent}c5` }}>
                Members
              </div>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-white">Crew Roster</h2>
            </div>

            {features.workoutLeaderboardEnabled && leaderboard.length > 0 ? (
              <div className="mb-6 rounded-[1.6rem] border border-white/8 bg-black/18 p-5 backdrop-blur-xl">
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${accent}16`, color: accent }}
                  >
                    <FiActivity />
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">Leaderboard</div>
                    <div className="text-lg font-black tracking-[-0.03em] text-white">Most workouts completed</div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {leaderboard.slice(0, 3).map((entry, index) => (
                    <div key={entry.member.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-center">
                      <div className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: accent }}>
                        #{index + 1}
                      </div>
                      <img src={avatarForMember(entry.member)} alt={entry.member.userInfo.username} className="mx-auto mt-3 h-14 w-14 rounded-full object-cover" />
                      <div className="mt-3 text-sm font-bold text-white">{entry.member.userInfo.displayName || entry.member.userInfo.username}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/35">@{entry.member.userInfo.username}</div>
                      <div className="mt-4 text-2xl font-black" style={{ color: accent }}>
                        {entry.workoutCount}
                      </div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">Workouts</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-[1.6rem] border border-white/8 bg-black/18 p-4 backdrop-blur-xl sm:p-5">
              {isLoadingMembers ? (
                <div className="flex min-h-[18rem] items-center justify-center">
                  <div
                    className="h-12 w-12 animate-spin rounded-full border-2 border-transparent"
                    style={{ borderTopColor: accent, borderRightColor: accent }}
                  />
                </div>
              ) : members.length === 0 ? (
                <div className="flex min-h-[18rem] flex-col items-center justify-center gap-4 text-center">
                  <div
                    className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 text-4xl"
                    style={{ backgroundColor: `${accent}12`, color: accent }}
                  >
                    <FiUsers />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-[-0.03em] text-white">No members yet</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-white/45">
                      New members will appear here as soon as they join the club.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {members.filter((member) => member.userId !== clubData.creatorId).map((member) => (
                    <button
                      key={member.id}
                      onClick={() => {
                        if (member.userInfo.username) {
                          router.push(`/profile/${member.userInfo.username}`);
                        }
                      }}
                      className="flex w-full items-center gap-4 rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-4 text-left transition hover:border-white/12 hover:bg-white/[0.05]"
                    >
                      <img src={avatarForMember(member)} alt={member.userInfo.username} className="h-12 w-12 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-white">
                          {member.userInfo.displayName || member.userInfo.username}
                        </div>
                        <div className="truncate text-xs uppercase tracking-[0.18em] text-white/35">@{member.userInfo.username || 'member'}</div>
                      </div>
                      <div className="hidden text-right sm:block">
                        <div className="text-lg font-black" style={{ color: accent }}>
                          {memberWorkoutCounts[member.userId] || 0}
                        </div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">Workouts</div>
                      </div>
                      <div
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em]"
                        style={{ color: member.joinedVia === 'creator' ? accent : 'rgba(255,255,255,0.58)' }}
                      >
                        {member.joinedVia === 'creator' ? 'Host' : 'Member'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {selectedTab === 'programs' ? (
          <section className="pb-10 pt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: `${accent}c5` }}>
                  Programs
                </div>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-white">Challenges and IRL Events</h2>
              </div>

              {isCreator ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => router.push('/create-round')}
                    className="rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.18em] shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition"
                    style={{ backgroundColor: accent, color: accentTextColor }}
                  >
                    Create Program
                  </button>
                  <button
                    onClick={() => router.push(`/club-studio?clubId=${clubData.id}`)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white/85 transition hover:bg-white/10"
                  >
                    Manage Club
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mb-5 rounded-[1.6rem] border border-white/8 bg-black/18 p-5 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${accent}14`, color: accent }}
                >
                  <FiActivity />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/35">Programs</div>
                  <div className="text-lg font-black tracking-[-0.03em] text-white">
                    {totalProgramCount} live assets across challenges and events
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-[1.6rem] border border-white/8 bg-black/18 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl"
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em]"
                          style={{ backgroundColor: `${accent}14`, color: accent }}
                        >
                          Event
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/55">
                          {event.isUpcoming ? 'Upcoming' : 'Completed'}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black tracking-[-0.03em] text-white">{event.title || 'Club Event'}</h3>
                      {event.description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">{event.description}</p> : null}

                      <div className="mt-4 flex flex-col gap-2 text-sm text-white/55">
                        <div className="flex items-center gap-2">
                          <FiCalendar style={{ color: accent }} />
                          <span>{formatEventWindow(event.startDate, event.endDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FiMapPin style={{ color: accent }} />
                          <span>{event.displayLocation}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => router.push(`/club/${clubData.id}/check-in?eventId=${event.id}`)}
                      className="flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.18em] shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition"
                      style={{ backgroundColor: accent, color: accentTextColor }}
                    >
                      {event.isUpcoming ? 'Check In' : 'View Event'}
                      <FiArrowUpRight />
                    </button>
                  </div>
                </div>
              ))}

              {allRounds.map((round) => (
                <button
                  key={round.id}
                  onClick={() => router.push(`/round/${round.id}`)}
                  className="w-full rounded-[1.6rem] border border-white/8 bg-black/18 p-5 text-left shadow-[0_18px_60px_rgba(0,0,0,0.16)] transition hover:border-white/12 hover:bg-black/24"
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em]"
                          style={{ backgroundColor: `${accent}14`, color: accent }}
                        >
                          Program
                        </span>
                        {clubData.pinnedRoundIds?.includes(round.id) ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/60">
                            Pinned
                          </span>
                        ) : null}
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white/55">
                          {round.isActive ? 'Active' : 'Completed'}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black tracking-[-0.03em] text-white">{round.title}</h3>
                      {round.subtitle ? <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">{round.subtitle}</p> : null}
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/60">
                          {round.workoutCount} workout{round.workoutCount !== 1 ? 's' : ''}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white/60">
                          {round.participantCount} participant{round.participantCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em]" style={{ color: accent }}>
                      Open
                      <FiArrowUpRight />
                    </div>
                  </div>
                </button>
              ))}

              {!isLoadingEvents && !events.length && !allRounds.length ? (
                <div className="rounded-[1.6rem] border border-white/8 bg-black/18 p-10 text-center backdrop-blur-xl">
                  <div
                    className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-white/10 text-4xl"
                    style={{ backgroundColor: `${accent}12`, color: accent }}
                  >
                    <FiCalendar />
                  </div>
                  <h3 className="mt-5 text-xl font-black tracking-[-0.03em] text-white">No programs yet</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">
                    {isCreator
                      ? 'Create a program or link an existing round to start filling out the club.'
                      : 'The host has not linked any programs yet.'}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Analytics / Member Origin (creator only) */}
        {selectedTab === 'analytics' && isCreator ? (
          <MemberOriginSection
            members={members}
            clubData={clubData}
            accent={accent}
            roundNameCache={roundNameCache}
            setRoundNameCache={setRoundNameCache}
          />
        ) : null}
      </div>

      <AnimatePresence>
        {showActivationModal ? (
          <motion.div
            key="activation-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[65] flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-md"
          >
            <motion.div
              key="activation-modal-content"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#101012] shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
            >
              <div
                className="absolute -top-24 left-1/2 h-[18rem] w-[24rem] -translate-x-1/2 rounded-full opacity-20 blur-[120px]"
                style={{ backgroundColor: accent }}
              />

              <div className="relative max-h-[85vh] overflow-y-auto px-6 pb-6 pt-8 sm:px-8 sm:pb-8">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: `${accent}c5` }}>
                      Club Onboarding
                    </div>
                    <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">
                      Finish joining {clubData.name}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
                      Answer the club setup questions so Pulse can personalize your experience and help the host make better matches.
                    </p>
                  </div>
                  {hasSavedActivationResponses ? (
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">
                      Resume
                    </div>
                  ) : null}
                </div>

                {isLoadingActivation ? (
                  <div className="flex min-h-[18rem] items-center justify-center">
                    <div
                      className="h-12 w-12 animate-spin rounded-full border-2 border-transparent"
                      style={{ borderTopColor: accent, borderRightColor: accent }}
                    />
                  </div>
                ) : (
                  <div className="space-y-5">
                    {requiredActivationQuestions.map((question) => (
                      <div
                        key={question.id}
                        className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-5"
                      >
                        <div className="mb-3">
                          <div className="text-base font-bold text-white">{question.title}</div>
                          {question.description ? (
                            <p className="mt-1 text-sm leading-6 text-white/45">{question.description}</p>
                          ) : null}
                        </div>

                        <ActivationQuestionField
                          accent={accent}
                          question={question}
                          response={activationResponses[question.id]}
                          onChange={(nextResponse) => {
                            setActivationResponses((previous) => ({
                              ...previous,
                              [question.id]: nextResponse,
                            }));
                            setActivationError(null);
                          }}
                        />
                      </div>
                    ))}

                    {activationError ? (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                        {activationError}
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-3 border-t border-white/8 pt-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/35">
                        {requiredActivationQuestions.length} required question{requiredActivationQuestions.length === 1 ? '' : 's'}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleSubmitActivation()}
                        disabled={!isActivationComplete || isSubmittingActivation}
                        className="rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.18em] shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ backgroundColor: accent, color: accentTextColor }}
                      >
                        {isSubmittingActivation ? 'Saving...' : 'Complete onboarding'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showIntroPrompt ? (
          <motion.div
            key="intro-prompt-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[64] flex items-center justify-center bg-black/65 px-4 backdrop-blur-md"
            onClick={() => setShowIntroPrompt(false)}
          >
            <motion.div
              key="intro-prompt-content"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/12 bg-[#101012] shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
            >
              <div
                className="absolute -top-16 left-1/2 h-[14rem] w-[18rem] -translate-x-1/2 rounded-full opacity-20 blur-[100px]"
                style={{ backgroundColor: accent }}
              />

              <div className="relative px-6 pb-7 pt-8 text-center">
                <div
                  className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${accent}18`, boxShadow: `0 0 48px ${accent}24` }}
                >
                  <FiCheck className="text-3xl" style={{ color: accent }} />
                </div>

                <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] text-white">
                  You’re in
                </h2>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/55">
                  Your onboarding is complete. Next step: introduce yourself in the club chat so the rest of the crew knows who just joined.
                </p>

                <div className="mt-6 rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4 text-left text-sm leading-6 text-white/60">
                  {activationConfig.introTemplate || buildDefaultIntroTemplate(clubData.name)}
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    onClick={handleIntroduceSelf}
                    className="w-full rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-[0.14em] shadow-[0_18px_50px_rgba(0,0,0,0.25)] transition hover:scale-[1.01] active:scale-[0.99]"
                    style={{ backgroundColor: accent, color: accentTextColor }}
                  >
                    Introduce yourself
                  </button>
                  <button
                    onClick={() => setShowIntroPrompt(false)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-white/60 transition hover:bg-white/10 hover:text-white/80"
                  >
                    Maybe later
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showPairingSafetyModal ? (
          <motion.div
            key="pairing-safety-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[64] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
            onClick={() => setShowPairingSafetyModal(false)}
          >
            <motion.div
              key="pairing-safety-content"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#101012] shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
            >
              <div
                className="absolute -top-20 left-1/2 h-[16rem] w-[22rem] -translate-x-1/2 rounded-full opacity-20 blur-[110px]"
                style={{ backgroundColor: accent }}
              />

              <div className="relative max-h-[85vh] overflow-y-auto px-6 pb-7 pt-8 sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: `${accent}c5` }}>
                      Pairing Safety
                    </div>
                    <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">
                      Control your pairing experience
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
                      Opt out, request a rematch, or flag people you do not want to be paired with in this club.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPairingSafetyModal(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
                  >
                    <FiX />
                  </button>
                </div>

                <div className="mt-6 space-y-5">
                  <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-base font-bold text-white">Opt into pairing</div>
                        <p className="mt-1 text-sm leading-6 text-white/45">
                          Turn this off if you do not want Pulse to match you with a partner right now.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPairingOptInDraft((previous) => !previous)}
                        className={`relative h-7 w-14 rounded-full transition ${pairingOptInDraft ? 'bg-[#E0FE10]' : 'bg-gray-700'}`}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-black transition ${pairingOptInDraft ? 'left-8' : 'left-1'}`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-5">
                    <div className="text-base font-bold text-white">Do not pair me with</div>
                    <p className="mt-1 text-sm leading-6 text-white/45">
                      These members will be excluded from assisted suggestions and manual pair confirmation.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {doNotPairCandidates.map((member) => {
                        const isSelected = doNotPairUserIdsDraft.includes(member.userId);
                        return (
                          <button
                            key={member.userId}
                            type="button"
                            onClick={() => {
                              setDoNotPairUserIdsDraft((previous) =>
                                isSelected
                                  ? previous.filter((userId) => userId !== member.userId)
                                  : [...previous, member.userId]
                              );
                            }}
                            className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                              isSelected
                                ? 'border-red-500/30 bg-red-500/10 text-red-100'
                                : 'border-white/10 bg-black/25 text-white/75 hover:border-white/25 hover:bg-black/35'
                            }`}
                          >
                            <div className="font-semibold">{member.userInfo.displayName || member.userInfo.username}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.16em] opacity-60">@{member.userInfo.username || 'member'}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {pairedMember ? (
                    <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-5">
                      <div className="text-base font-bold text-white">Request a rematch</div>
                      <p className="mt-1 text-sm leading-6 text-white/45">
                        If this pairing is not a fit, request a rematch. Your current pairing will be removed immediately.
                      </p>
                      <textarea
                        value={rematchReasonDraft}
                        onChange={(event) => setRematchReasonDraft(event.target.value)}
                        placeholder="Ex. Scheduling conflict, not a fit, uncomfortable pairing"
                        rows={3}
                        className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30 focus:bg-black/40"
                      />
                      <button
                        type="button"
                        onClick={() => void handleRequestRematch()}
                        disabled={isSavingPairingSafety || !rematchReasonDraft.trim()}
                        className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Request rematch
                      </button>
                    </div>
                  ) : null}

                  <div className="flex justify-end gap-3">
                    <div className="mr-auto max-w-sm self-center text-xs leading-5 text-white/40">
                      Pairing is host-managed. If something feels off, opt out or request a rematch and the host will review it.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPairingSafetyModal(false);
                        setShowConductModal(true);
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10"
                    >
                      Community guidelines
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPairingSafetyModal(false);
                        handleOpenSafetyReport();
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10"
                    >
                      Report an issue
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPairingSafetyModal(false)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSavePairingSafety()}
                      disabled={isSavingPairingSafety}
                      className="rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.18em] transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: accent, color: accentTextColor }}
                    >
                      {isSavingPairingSafety ? 'Saving...' : 'Save safety preferences'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showConductModal ? (
          <motion.div
            key="conduct-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[64] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
            onClick={() => setShowConductModal(false)}
          >
            <motion.div
              key="conduct-content"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#101012] shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
            >
              <div
                className="absolute -top-20 left-1/2 h-[16rem] w-[22rem] -translate-x-1/2 rounded-full opacity-20 blur-[110px]"
                style={{ backgroundColor: accent }}
              />

              <div className="relative px-6 pb-7 pt-8 sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: `${accent}c5` }}>
                      Community Guidelines
                    </div>
                    <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">
                      How this club stays safe
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowConductModal(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
                  >
                    <FiX />
                  </button>
                </div>

                <div className="mt-6 space-y-3">
                  {CLUB_CONDUCT_GUIDELINES.map((guideline) => (
                    <div key={guideline} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-white/75">
                      {guideline}
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-white/60">
                  If you need help, use the safety tools to opt out, request a rematch, or report an issue for host review.
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowConductModal(false)}
                    className="rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.18em] transition"
                    style={{ backgroundColor: accent, color: accentTextColor }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showSafetyReportModal ? (
          <motion.div
            key="safety-report-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[64] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
            onClick={() => setShowSafetyReportModal(false)}
          >
            <motion.div
              key="safety-report-content"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/12 bg-[#101012] shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
            >
              <div
                className="absolute -top-20 left-1/2 h-[16rem] w-[22rem] -translate-x-1/2 rounded-full opacity-20 blur-[110px]"
                style={{ backgroundColor: accent }}
              />

              <div className="relative px-6 pb-7 pt-8 sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: `${accent}c5` }}>
                      Safety Report
                    </div>
                    <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">
                      Tell the host what happened
                    </h2>
                    <p className="mt-3 max-w-lg text-sm leading-6 text-white/55">
                      Use this for unsafe behavior, harassment, or any club interaction that needs review.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSafetyReportModal(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
                  >
                    <FiX />
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Issue type</label>
                    <select
                      value={safetyReportCategory}
                      onChange={(event) => setSafetyReportCategory(event.target.value as ClubSafetyReportCategory)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30"
                    >
                      <option value="unsafe_behavior">Unsafe behavior</option>
                      <option value="harassment_or_discrimination">Harassment or discrimination</option>
                      <option value="pairing_mismatch">Pairing mismatch</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Related member</label>
                    <select
                      value={safetyReportReportedUserId}
                      onChange={(event) => setSafetyReportReportedUserId(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30"
                    >
                      <option value="">No specific member</option>
                      {doNotPairCandidates.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.userInfo.displayName || member.userInfo.username}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Details</label>
                    <textarea
                      value={safetyReportDetails}
                      onChange={(event) => setSafetyReportDetails(event.target.value)}
                      placeholder="Describe what happened and what you need from the host."
                      rows={4}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30 focus:bg-black/40"
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowSafetyReportModal(false)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleSubmitSafetyReport()}
                    disabled={isSubmittingSafetyReport || !safetyReportDetails.trim()}
                    className="rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.18em] transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: accent, color: accentTextColor }}
                  >
                    {isSubmittingSafetyReport ? 'Submitting...' : 'Submit report'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Check-in welcome modal */}
      <AnimatePresence>
        {showCheckinModal ? (
          <motion.div
            key="checkin-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md px-4"
            onClick={() => setShowCheckinModal(false)}
          >
            <motion.div
              key="checkin-modal-content"
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-[2rem] border border-white/12 bg-[#111113] shadow-[0_40px_120px_rgba(0,0,0,0.6)] overflow-hidden"
            >
              {/* Accent glow */}
              <div
                className="absolute -top-16 left-1/2 -translate-x-1/2 w-[22rem] h-[14rem] rounded-full blur-[100px] opacity-20"
                style={{ backgroundColor: accent }}
              />

              {/* Close button */}
              <button
                onClick={() => setShowCheckinModal(false)}
                className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <FiX className="text-lg" />
              </button>

              <div className="relative px-6 pt-10 pb-7 text-center">
                {/* Success icon */}
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.1 }}
                  className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${accent}1a`, boxShadow: `0 0 50px ${accent}30` }}
                >
                  <FiCheck className="text-3xl" style={{ color: accent }} />
                </motion.div>

                <h2 className="text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl">
                  You've checked in!
                </h2>
                <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-white/55">
                  Welcome to <span className="font-semibold text-white/80">{clubData.name}</span>.
                  Join the chat and introduce yourself to the club!
                </p>

                {/* Intro prompt card */}
                <div
                  className="mx-auto mt-6 max-w-sm rounded-2xl border border-white/8 p-5 text-left"
                  style={{ backgroundColor: `${accent}08` }}
                >
                  <div
                    className="mb-3 text-[11px] font-black uppercase tracking-[0.22em]"
                    style={{ color: `${accent}cc` }}
                  >
                    Introduce Yourself
                  </div>
                  <ul className="space-y-2.5 text-sm leading-relaxed text-white/65">
                    <li className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-base" style={{ color: accent }}>•</span>
                      Say your <span className="font-semibold text-white/85">name</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-base" style={{ color: accent }}>•</span>
                      Where you're <span className="font-semibold text-white/85">originally from</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-base" style={{ color: accent }}>•</span>
                      What you're <span className="font-semibold text-white/85">passionate about</span>
                    </li>
                  </ul>
                </div>

                {/* CTA buttons */}
                <div className="mt-6 space-y-3">
                  <button
                    onClick={handleIntroduceSelf}
                    className="w-full rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-[0.14em] shadow-[0_18px_50px_rgba(0,0,0,0.25)] transition hover:scale-[1.01] active:scale-[0.99]"
                    style={{ backgroundColor: accent, color: accentTextColor }}
                  >
                    Introduce Yourself in Chat
                  </button>

                  <button
                    onClick={() => setShowCheckinModal(false)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-semibold text-white/60 transition hover:bg-white/10 hover:text-white/80"
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Questionnaires modal */}
      <AnimatePresence>
        {showQuestionnaireModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#121212] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Send Questionnaire</h3>
                <button onClick={() => setShowQuestionnaireModal(false)} className="p-2 -mr-2 text-white/50 hover:text-white transition-colors">
                  <FiX />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                {isLoadingQuestionnaires ? (
                  <div className="py-8 text-center text-white/50 animate-pulse">Loading questionnaires...</div>
                ) : clubQuestionnaires.length === 0 ? (
                  <div className="py-8 text-center text-white/50">
                    <div className="text-4xl mb-3 opacity-30">📋</div>
                    No questionnaires found. Create one in your dashboard first.
                  </div>
                ) : selectedSurveyForSending ? (
                  <div className="space-y-4 animate-fadeIn">
                    <button onClick={() => setSelectedSurveyForSending(null)} className="text-white/50 text-sm flex items-center gap-1 hover:text-white transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> Back to list
                    </button>
                    <div>
                      <div className="font-bold text-white mb-2">{selectedSurveyForSending.title}</div>
                      <label className="block text-sm text-white/70 mb-2">Identifier (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Event Name, Date, etc."
                        value={surveyIdentifier}
                        onChange={e => setSurveyIdentifier(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-[#E0FE10] focus:outline-none transition-colors"
                      />
                      <p className="text-xs text-white/40 mt-2">Adding an identifier helps you separate responses from different events or dates. Each time a unique identifier is used, it tracks completions uniquely.</p>
                    </div>
                    <button
                      disabled={isSendingMessage}
                      onClick={async () => {
                        setShowQuestionnaireModal(false);
                        setIsSendingMessage(true);
                        setSendError(null);
                        try {
                          const recipientTokens = members
                            .filter((member) => member.userId !== currentUser.id)
                            .map((member) => member.userInfo?.fcmToken)
                            .filter((token): token is string => Boolean(token));

                          await clubChatService.sendMessage(clubData.id, {
                            sender: currentUser.toShortUser(),
                            content: `Please complete this questionnaire: ${selectedSurveyForSending.title}`,
                            checkinId: null,
                            timestamp: new Date(),
                            readBy: { [currentUser.id]: new Date() },
                            mediaURL: null,
                            mediaType: MessageMediaType.None,
                            gymName: null,
                            recipientFcmTokens: recipientTokens,
                            visibility: 'public',
                            visibleToUserId: null,
                            questionnaireData: {
                              surveyId: selectedSurveyForSending.id,
                              surveyTitle: selectedSurveyForSending.title,
                              surveyDescription: selectedSurveyForSending.description,
                              ownerUserId: currentUser.id,
                              pageSlug: selectedSurveyForSending.pageSlug,
                              instanceId: surveyIdentifier.trim() || undefined,
                            }
                          });
                        } catch (e: any) {
                          console.error(e);
                          setSendError(e.message || 'Failed to send questionnaire');
                        } finally {
                          setIsSendingMessage(false);
                          setSelectedSurveyForSending(null);
                          setSurveyIdentifier('');
                        }
                      }}
                      className="w-full rounded-xl py-3 font-bold bg-[#E0FE10] text-black hover:bg-[#d0ee00] transition-colors disabled:opacity-50"
                    >
                      {isSendingMessage ? 'Sending...' : 'Send to Club'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clubQuestionnaires.map(survey => (
                      <button
                        key={survey.id}
                        onClick={() => {
                          setSelectedSurveyForSending(survey);
                          setSurveyIdentifier('');
                        }}
                        className="w-full text-left p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors group"
                      >
                        <div className="font-bold text-white mb-1">{survey.title}</div>
                        <div className="text-sm text-white/50 line-clamp-2">{survey.description || 'No description'}</div>
                        <div className="mt-3 text-xs font-bold uppercase tracking-wider text-[#E0FE10] opacity-0 group-hover:opacity-100 transition-opacity">
                          Select →
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Complete Questionnaire Modal */}
      {activeSurvey && (
        <SurveyTakingModal
          isOpen={!!activeSurvey}
          onClose={() => {
            setActiveSurvey(null);
            setActiveSurveyInstanceId(undefined);
            setActiveMessage(null);
          }}
          survey={activeSurvey}
          onSubmit={async (answers, respondentName, respondentEmail) => {
            if (!activeSurvey || !activeMessage) return;
            const ownerId = activeMessage.questionnaireData?.ownerUserId || clubData.creatorId;
            const pageSlug = activeSurvey.pageSlug || CLIENT_QUESTIONNAIRES_PAGE_SLUG;

            await creatorPagesService.submitSurveyResponse(
              ownerId,
              pageSlug,
              activeSurvey.id,
              {
                respondentName: respondentName || currentUser.displayName || currentUser.username,
                respondentEmail: respondentEmail || currentUser.email,
                instanceId: activeSurveyInstanceId,
                answers,
              }
            );

            // Update the message in the chat to reflect this completion!
            try {
              if (activeMessage && currentUser) {
                // If it successfully completes, update message in firestore
                const updatedCompletedBy = { ...(activeMessage.questionnaireData?.completedBy || {}) };
                updatedCompletedBy[currentUser.id] = true;

                // Then fetch the message ref
                const { doc, updateDoc } = await import('firebase/firestore');
                const { db } = await import('../../api/firebase/config');
                const msgRef = doc(db, 'clubs', clubData.id, 'messages', activeMessage.id);
                await updateDoc(msgRef, {
                  'questionnaireData.completedBy': updatedCompletedBy
                });
                console.log('Message completedBy updated in firestore!');
              }
            } catch (e) {
              console.error('Failed to update message completedBy flag', e);
            }

            setActiveSurvey(null);
            setActiveSurveyInstanceId(undefined);
            setActiveMessage(null);
          }}
        />
      )}

      {/* View Questionnaire Responses Modal */}
      {activeSurveyForAnswers && (
        <SurveyResponsesModal
          isOpen={!!activeSurveyForAnswers}
          onClose={() => setActiveSurveyForAnswers(null)}
          survey={activeSurveyForAnswers}
          responses={activeSurveyResponses}
          loading={loadingResponses}
        />
      )}
    </div>
  );
};
