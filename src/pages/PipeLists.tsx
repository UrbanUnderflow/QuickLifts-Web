import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import {
  GoogleAuthProvider,
  User,
  getRedirectResult,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, onSnapshot, query as firestoreQuery, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  DollarSign,
  Download,
  Edit,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  Link2,
  ListPlus,
  LogOut,
  Mail,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Share2,
  Target,
  Trash2,
  TrendingUp,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import PageHead from '../components/PageHead';
import { auth as quickLiftsAuth, db as quickLiftsDb } from '../api/firebase/config';
import { simpBudgetAuth, simpBudgetDb, simpBudgetStorage } from '../api/firebase/simpBudgetConfig';
import {
  buildSyncedEmailEventLog,
  emailStatusRank,
  type SyncedEmailEventSummary,
} from '../utils/pipelistsEmailEventSync';

type PipelinePriority = 'high' | 'medium' | 'low';
type ViewMode = 'pipeline' | 'metrics' | 'logs';
type DetailModalMode = 'details' | 'logs' | 'email' | 'research';
type MessageTone = 'success' | 'error' | 'info';
type ShareAccess = 'read' | 'edit';
type InviteStatus = {
  email: string;
  access: ShareAccess;
  status: 'sent' | 'accepted';
  inviteId?: string;
  sentAt?: unknown;
  acceptedAt?: unknown;
};
type InviteHistoryEntry = {
  email: string;
  access: ShareAccess;
  status: 'sent' | 'accepted';
  sentAt?: unknown;
  acceptedAt?: unknown;
  listNames: string[];
  shareIds: string[];
  inviteUrl: string;
};
type ActivityLogType = 'update' | 'application' | 'meeting' | 'follow-up' | 'decision' | 'risk' | 'document' | 'metrics';
type ContactEmailType = 'metrics-update' | 'general-update';
type LogEmailFilter = 'all' | 'investor-update' | 'general-update';
type ContactEmailAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
};
type NextStepTooltip = {
  text: string;
  left: number;
  top: number;
  width: number;
  placement: 'above' | 'below';
};
type TemplateKey =
  | 'vc'
  | 'grant'
  | 'pitch'
  | 'university-pilot'
  | 'contract'
  | 'partner'
  | 'investor-metrics'
  | 'contacts';

type StageTrack = 'build' | 'run' | 'capital' | 'general';
type StageOutcome = 'open' | 'won' | 'lost';

type StageConfig = {
  id: string;
  label: string;
  probability: number;
  track: StageTrack;
  tone: string;
  outcome?: StageOutcome;
};

type ActivityLog = {
  id: string;
  type: ActivityLogType;
  weekOf: string;
  summary: string;
  nextStep: string;
  followUpDate: string;
  rosteredAthletes: string;
  completedCheckIns: string;
  checkInRate: string;
  biometricSyncRate: string;
  signalEvents: string;
  noraEngagementRate: string;
  noraSessions: string;
  escalations: string;
  staffFeedbackScore: string;
  notes: string;
  createdAt: string;
  systemAction?: 'item-created' | 'item-deleted' | 'item-restored' | 'item-moved' | 'email-sent';
  relatedItemId?: string;
  restorableUntil?: string;
};

type LeadAttachment = {
  id: string;
  type: 'file' | 'link';
  name: string;
  url: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  createdBy: string;
};

type LeadSearchBrief = {
  productName: string;
  productContext: string;
  searchFocus: string;
  targetAudience: string;
  opportunityTypes: string;
  preferredSources: string;
  mustInclude: string;
  mustExclude: string;
  positioning: string;
  requireFutureDeadline: boolean;
  officialSourcesOnly: boolean;
  includeAdjacentFit: boolean;
  leadCount: number;
};

type PipelineItem = {
  id: string;
  title: string;
  organization: string;
  owner: string;
  contactEmails: string[];
  contactPhone: string;
  linkedinUrl: string;
  emailStatus: string;
  lastEmailType: string;
  lastEmailEvent: string;
  lastEmailMessageId: string;
  lastEmailSentAt: string;
  lastEmailDeliveredAt: string;
  lastEmailOpenedAt: string;
  lastEmailClickedAt: string;
  emailOpenCount: number;
  emailClickCount: number;
  lastEmailClickedLink: string;
  stage: string;
  priority: PipelinePriority;
  amount: string;
  dueDate: string;
  nextStep: string;
  notes: string;
  sourceUrl: string;
  segment: string;
  decisionMaker: string;
  acv: string;
  expectedCloseDate: string;
  contractTerm: string;
  pilotScope: string;
  athleteCount: string;
  pilotStart: string;
  pilotEnd: string;
  conversionLikelihood: string;
  grossMargin: string;
  partnerCost: string;
  hardwareCost: string;
  lossReason: string;
  expansionPath: string;
  attachments: LeadAttachment[];
  weeklyLogs: ActivityLog[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedByLogId?: string;
  restorableUntil?: string;
};

type PipeList = {
  id: string;
  name: string;
  description: string;
  accent: string;
  templateKey: TemplateKey;
  stages: StageConfig[];
  items: PipelineItem[];
  searchBrief?: LeadSearchBrief;
  createdAt: string;
};

type PipeListShare = {
  id: string;
  ownerUid: string;
  ownerEmail: string;
  list: PipeList;
  access: ShareAccess;
  publicRead: boolean;
  viewerEmails: string[];
  editorEmails: string[];
  inviteStatuses: Record<string, InviteStatus>;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type PipeLeadShare = {
  id: string;
  ownerUid: string;
  ownerEmail: string;
  listId: string;
  itemId: string;
  list: PipeList;
  publicRead: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type PipeListProfile = {
  displayName: string;
  photoURL: string;
  email: string;
  updatedAt?: unknown;
};

type SearchablePipeListProfile = PipeListProfile & {
  uid: string;
};

type FriendOfBusinessContact = {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  titleOrCompany?: string;
  notes?: string;
  emailStatus?: string;
  lastEmailEvent?: string;
  emailOpenCount?: number;
  emailClickCount?: number;
  lastEmailClickedLink?: string;
};

type ItemDraft = Omit<PipelineItem, 'id' | 'createdAt' | 'updatedAt' | 'weeklyLogs' | 'deletedAt' | 'deletedByLogId' | 'restorableUntil'>;
type ActivityLogDraft = Omit<ActivityLog, 'id' | 'createdAt' | 'systemAction' | 'relatedItemId' | 'restorableUntil'>;
type GeneratedLead = ItemDraft & {
  rationale: string;
  sourceEvidence: string;
  deadlineStatus: string;
};

const STORAGE_KEY = 'pulse-pipe-lists-v2';
const PITCH_COMPETITIONS_LIST_ID = 'pitch-competitions';
const SIMPBUDGET_USERS_COLLECTION = 'simpbudget-users';
const PIPELISTS_SUBCOLLECTION = 'pipeLists';
const PIPELISTS_STATE_DOCUMENT_ID = 'state';
const PIPELIST_SHARES_COLLECTION = 'pipeListShares';
const PIPELEAD_SHARES_COLLECTION = 'pipeLeadShares';
const PIPELIST_PROFILES_COLLECTION = 'pipeListProfiles';
const PIPELISTS_LEAD_SEARCH_FEATURE_ID = 'pipeListsLeadGeneration';
const FRIENDS_OF_BUSINESS_COLLECTION = 'friends-of-business';
const PIPELISTS_LEAD_SEARCH_MODEL = 'gpt-4o-mini';
const PIPELISTS_REMOTE_BRIDGE_ORIGIN = 'https://fitwithpulse.ai';
const TREMAINE_OWNER_EMAIL = 'tremaine.grant@gmail.com';
const MAGIC_LINK_EMAIL_STORAGE_KEY = 'pipelists.web.pendingMagicEmail';
const SOFT_DELETE_RESTORE_DAYS = 30;

const accentClasses = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-indigo-500',
  'bg-rose-500',
  'bg-teal-500',
];

const priorityStyles: Record<PipelinePriority, string> = {
  high: 'bg-rose-50 text-rose-700 border-rose-100',
  medium: 'bg-amber-50 text-amber-700 border-amber-100',
  low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const importanceLabel = (priority: PipelinePriority) =>
  `Importance: ${priority.charAt(0).toUpperCase()}${priority.slice(1)}`;

const logTypeLabels: Record<ActivityLogType, string> = {
  update: 'General Update',
  application: 'Application',
  meeting: 'Meeting',
  'follow-up': 'Follow-Up',
  decision: 'Decision',
  risk: 'Risk',
  document: 'Document Sent',
  metrics: 'Metrics Update',
};

const contactEmailTypeLabels: Record<ContactEmailType, string> = {
  'metrics-update': 'Investor Update',
  'general-update': 'General Update',
};

const logEmailFilterLabels: Record<LogEmailFilter, string> = {
  all: 'All email activity',
  'investor-update': 'Investor Update emails',
  'general-update': 'General Update emails',
};

const contactEmailTypeLogType: Record<ContactEmailType, ActivityLogType> = {
  'metrics-update': 'metrics',
  'general-update': 'update',
};

const contactEmailStatusOptions = [
  { value: 'not_sent', label: 'Not sent' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'opened', label: 'Opened' },
  { value: 'clicked', label: 'Clicked' },
  { value: 'soft_bounce', label: 'Soft bounce' },
  { value: 'hard_bounce', label: 'Hard bounce' },
  { value: 'invalid_email', label: 'Invalid email' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
] as const;

const logNextStepOptions: Record<ActivityLogType, string[]> = {
  update: ['Review status', 'Send update', 'Follow up', 'Wait for response'],
  application: ['Prepare application', 'Submit application', 'Send supporting materials', 'Wait for results', 'Follow up'],
  meeting: ['Schedule meeting', 'Send recap', 'Send materials', 'Follow up', 'Wait for response'],
  'follow-up': ['Follow up', 'Send reminder', 'Send requested info', 'Schedule meeting', 'Wait for response'],
  decision: ['Review decision', 'Notify team', 'Send acceptance', 'Plan next action'],
  risk: ['Escalate risk', 'Assign owner', 'Monitor risk', 'Follow up'],
  document: ['Send document', 'Send updated document', 'Wait for response', 'Follow up'],
  metrics: ['Review metrics', 'Send report', 'Follow up', 'Wait for response'],
};

const updateLogDraftType = (current: ActivityLogDraft, type: ActivityLogType): ActivityLogDraft => {
  const nextOptions = logNextStepOptions[type];

  return {
    ...current,
    type,
    nextStep: current.nextStep && nextOptions.includes(current.nextStep) ? current.nextStep : '',
  };
};

const followUpDateLabel = (nextStep: string) => {
  const normalizedStep = nextStep.toLowerCase();

  if (normalizedStep.includes('wait for response') || normalizedStep.includes('wait for results')) return 'Results posted';
  if (normalizedStep.includes('submit application') || normalizedStep.includes('prepare application')) return 'Application due';
  if (normalizedStep.includes('schedule meeting')) return 'Meeting date';

  return 'Follow-Up';
};

const logDisplayLabel = (log: ActivityLog) => {
  if (log.systemAction === 'item-created') return 'Item Added';
  if (log.systemAction === 'item-deleted') return 'Item Deleted';
  if (log.systemAction === 'item-restored') return 'Item Restored';
  if (log.systemAction === 'item-moved') return 'Item Moved';
  if (log.systemAction === 'email-sent') return emailLogDisplayLabel(log);
  return logTypeLabels[log.type];
};

const displayLogSummary = (log: ActivityLog) => {
  const summary = log.summary || log.notes || 'Untitled log';
  if (log.systemAction !== 'email-sent') return summary;
  return summary.replace(/^Metrics Update sent/i, 'Investor Update sent');
};

const pipeTimestampToDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object') {
    const timestampLike = value as {
      seconds?: unknown;
      nanoseconds?: unknown;
      _seconds?: unknown;
      _nanoseconds?: unknown;
      toDate?: unknown;
    };
    if (typeof timestampLike.toDate === 'function') {
      const parsed = timestampLike.toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
    const seconds = typeof timestampLike.seconds === 'number' ? timestampLike.seconds : timestampLike._seconds;
    const nanoseconds = typeof timestampLike.nanoseconds === 'number' ? timestampLike.nanoseconds : timestampLike._nanoseconds;
    if (typeof seconds === 'number') {
      const parsed = new Date(seconds * 1000 + (typeof nanoseconds === 'number' ? Math.floor(nanoseconds / 1_000_000) : 0));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  return null;
};

const logTimestampDate = (log: ActivityLog) =>
  pipeTimestampToDate(log.createdAt) || pipeTimestampToDate(log.weekOf) || (log.weekOf ? pipeTimestampToDate(`${log.weekOf}T00:00:00`) : null);

const logTimestampMs = (log: ActivityLog) => logTimestampDate(log)?.getTime() || 0;

const formatLogTimestamp = (log: ActivityLog) => {
  const createdAt = logTimestampDate(log);
  const dateLabel = log.weekOf || (createdAt ? createdAt.toISOString().slice(0, 10) : '');
  if (!createdAt) return dateLabel;

  const timeLabel = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(createdAt);

  return `${dateLabel} · ${timeLabel}`;
};

const parseEmailLogNotes = (notes: string) => {
  const lines = notes.replace(/\r\n/g, '\n').split('\n');
  const messageIndex = lines.findIndex((line) => line.trim().toLowerCase() === 'message:');
  const metaLines = messageIndex >= 0 ? lines.slice(0, messageIndex) : lines;
  const message = messageIndex >= 0 ? lines.slice(messageIndex + 1).join('\n').trim() : '';
  const readMeta = (label: string) => {
    const prefix = `${label}:`;
    const row = metaLines.find((line) => line.trim().toLowerCase().startsWith(prefix.toLowerCase()));
    return row ? row.trim().slice(prefix.length).trim() : '';
  };

  return {
    to: readMeta('To'),
    subject: readMeta('Subject'),
    status: readMeta('Status'),
    attachments: readMeta('Attachments'),
    link: readMeta('Link'),
    messageId: readMeta('Message ID'),
    message,
  };
};

const writeTextToClipboard = async (text: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is not available in this browser.');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const didCopy = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!didCopy) {
    throw new Error('Clipboard is not available in this browser.');
  }
};

const emailLogDisplayLabel = (log: ActivityLog) => {
  const details = parseEmailLogNotes(log.notes || '');
  const status = normalizeContactEmailStatusInput(details.status);

  if (status === 'opened') return 'Email Opened';
  if (status === 'click' || status === 'clicked') return 'Email Clicked';
  if (status === 'delivered') return 'Email Delivered';
  if (status === 'sent' || status === 'request') return 'Email Sent';
  if (status === 'unsubscribed' || status === 'unsubscribe') return 'Email Unsubscribed';
  if (['soft_bounce', 'hard_bounce', 'blocked', 'deferred', 'spam', 'invalid_email', 'error'].includes(status)) {
    return 'Email Issue';
  }

  return 'Email Sent';
};

const emailFilterForLog = (log: ActivityLog): LogEmailFilter | null => {
  if (log.systemAction !== 'email-sent') return null;
  return log.type === 'update' ? 'general-update' : 'investor-update';
};

const emailStatusHasActivity = (item: Pick<PipelineItem, 'emailStatus' | 'lastEmailEvent' | 'weeklyLogs'>) => {
  const status = normalizeContactEmailStatusInput(item.emailStatus || item.lastEmailEvent);
  return status !== 'not_sent' || item.weeklyLogs.some((log) => log.systemAction === 'email-sent');
};

const EmailLogDetails: React.FC<{ log: ActivityLog }> = ({ log }) => {
  const [messageCopyState, setMessageCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const messageCopyResetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (messageCopyResetRef.current !== null) {
        window.clearTimeout(messageCopyResetRef.current);
      }
    };
  }, []);

  if (log.systemAction !== 'email-sent' || !log.notes || log.notes === log.summary) return null;
  const details = parseEmailLogNotes(log.notes);

  if (!details.to && !details.subject && !details.status && !details.link && !details.message) {
    return <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-500">{log.notes}</p>;
  }

  const handleCopyMessage = async () => {
    if (!details.message) return;

    try {
      await writeTextToClipboard(details.message);
      setMessageCopyState('copied');
    } catch (error) {
      console.error('[PipeLists] Copy email log message failed:', error);
      setMessageCopyState('error');
    }

    if (messageCopyResetRef.current !== null) {
      window.clearTimeout(messageCopyResetRef.current);
    }
    messageCopyResetRef.current = window.setTimeout(() => setMessageCopyState('idle'), 1800);
  };

  return (
    <div className="mt-3 rounded-lg border border-stone-200 bg-[#FAFAF7] p-3 text-sm text-stone-600">
      <div className="grid gap-2 sm:grid-cols-2">
        {details.to && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">To</div>
            <div className="mt-0.5 break-words font-medium text-stone-700">{details.to}</div>
          </div>
        )}
        {details.subject && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Subject</div>
            <div className="mt-0.5 break-words font-medium text-stone-700">{details.subject}</div>
          </div>
        )}
        {details.status && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Status</div>
            <div className="mt-0.5 break-words font-medium text-stone-700">{details.status}</div>
          </div>
        )}
      </div>
      {details.attachments && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Attachments</div>
          <div className="mt-0.5 break-words font-medium text-stone-700">{details.attachments}</div>
        </div>
      )}
      {details.link && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Clicked Link</div>
          <div className="mt-0.5 break-words font-medium text-stone-700">{details.link}</div>
        </div>
      )}
      {details.messageId && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Message ID</div>
          <div className="mt-0.5 break-words font-medium text-stone-700">{details.messageId}</div>
        </div>
      )}
      {details.message && (
        <div className="mt-3 border-t border-stone-200 pt-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Message</div>
            <button
              type="button"
              onClick={handleCopyMessage}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-950"
              title="Copy email message"
              aria-label="Copy email message"
            >
              <Copy className="h-3.5 w-3.5" />
              {messageCopyState === 'copied' ? 'Copied' : messageCopyState === 'error' ? 'Try again' : 'Copy'}
            </button>
          </div>
          <div className="whitespace-pre-wrap break-words rounded-md bg-white px-3 py-3 leading-6 text-stone-700">
            {details.message}
          </div>
        </div>
      )}
    </div>
  );
};

const generalStages: StageConfig[] = [
  { id: 'sourced', label: 'Sourced', probability: 10, track: 'general', tone: 'bg-stone-100 text-stone-700 border-stone-200' },
  { id: 'contacted', label: 'Contacted', probability: 20, track: 'general', tone: 'bg-sky-50 text-sky-700 border-sky-100' },
  { id: 'in-review', label: 'In Review', probability: 45, track: 'general', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { id: 'negotiating', label: 'Negotiating', probability: 75, track: 'run', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: 'won', label: 'Won', probability: 100, track: 'run', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', outcome: 'won' },
  { id: 'parked', label: 'Parked', probability: 0, track: 'general', tone: 'bg-zinc-50 text-zinc-500 border-zinc-200', outcome: 'lost' },
];

const investorContactStages: StageConfig[] = [
  { id: 'sourced', label: 'Sourced', probability: 10, track: 'general', tone: 'bg-stone-100 text-stone-700 border-stone-200' },
  { id: 'cold-contact', label: 'Cold Contact', probability: 15, track: 'general', tone: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
  { id: 'contacted', label: 'Contacted', probability: 25, track: 'general', tone: 'bg-sky-50 text-sky-700 border-sky-100' },
  { id: 'engaged', label: 'Engaged', probability: 45, track: 'general', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { id: 'update-ready', label: 'Update Ready', probability: 65, track: 'general', tone: 'bg-teal-50 text-teal-700 border-teal-100' },
  { id: 'sent-update', label: 'Sent Update', probability: 80, track: 'general', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { id: 'paused', label: 'Paused', probability: 0, track: 'general', tone: 'bg-zinc-50 text-zinc-500 border-zinc-200', outcome: 'lost' },
];

const contactStages: StageConfig[] = [
  { id: 'sourced', label: 'Sourced', probability: 10, track: 'general', tone: 'bg-stone-100 text-stone-700 border-stone-200' },
  { id: 'cold-contact', label: 'Cold Contact', probability: 15, track: 'general', tone: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
  { id: 'contacted', label: 'Contacted', probability: 25, track: 'general', tone: 'bg-sky-50 text-sky-700 border-sky-100' },
  { id: 'engaged', label: 'Engaged', probability: 45, track: 'general', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { id: 'follow-up-needed', label: 'Follow-Up Needed', probability: 60, track: 'general', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: 'active-relationship', label: 'Active Relationship', probability: 80, track: 'general', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { id: 'paused', label: 'Paused', probability: 0, track: 'general', tone: 'bg-zinc-50 text-zinc-500 border-zinc-200', outcome: 'lost' },
];

const pilotContractStages: StageConfig[] = [
  { id: 'identified', label: 'Identified', probability: 10, track: 'build', tone: 'bg-stone-100 text-stone-700 border-stone-200' },
  { id: 'engaged', label: 'Engaged', probability: 25, track: 'build', tone: 'bg-sky-50 text-sky-700 border-sky-100' },
  { id: 'pilot-agreed', label: 'Pilot Agreed', probability: 40, track: 'build', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { id: 'pilot-active', label: 'Pilot Active', probability: 55, track: 'build', tone: 'bg-violet-50 text-violet-700 border-violet-100' },
  { id: 'pilot-complete', label: 'Pilot Complete', probability: 70, track: 'build', tone: 'bg-teal-50 text-teal-700 border-teal-100' },
  { id: 'proposal-sent', label: 'Proposal Sent', probability: 75, track: 'run', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: 'negotiating', label: 'Negotiating', probability: 85, track: 'run', tone: 'bg-orange-50 text-orange-700 border-orange-100' },
  { id: 'closed-won', label: 'Closed Won', probability: 100, track: 'run', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', outcome: 'won' },
  { id: 'closed-lost-paused', label: 'Closed Lost / Paused', probability: 0, track: 'run', tone: 'bg-zinc-50 text-zinc-500 border-zinc-200', outcome: 'lost' },
];

const contractStages: StageConfig[] = pilotContractStages.slice(5);

const vcStages: StageConfig[] = [
  { id: 'targeted', label: 'Targeted', probability: 5, track: 'capital', tone: 'bg-stone-100 text-stone-700 border-stone-200' },
  { id: 'cold-contact', label: 'Cold Contact', probability: 8, track: 'capital', tone: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
  { id: 'intro-requested', label: 'Intro Requested', probability: 10, track: 'capital', tone: 'bg-sky-50 text-sky-700 border-sky-100' },
  { id: 'partner-meeting', label: 'Partner Meeting', probability: 25, track: 'capital', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { id: 'diligence', label: 'Diligence', probability: 45, track: 'capital', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: 'committed', label: 'Committed', probability: 100, track: 'capital', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', outcome: 'won' },
  { id: 'passed', label: 'Passed', probability: 0, track: 'capital', tone: 'bg-zinc-50 text-zinc-500 border-zinc-200', outcome: 'lost' },
];

const grantStages: StageConfig[] = [
  { id: 'sourced', label: 'Sourced', probability: 10, track: 'general', tone: 'bg-stone-100 text-stone-700 border-stone-200' },
  { id: 'eligible', label: 'Eligible', probability: 25, track: 'general', tone: 'bg-sky-50 text-sky-700 border-sky-100' },
  { id: 'drafting', label: 'Drafting', probability: 40, track: 'general', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { id: 'submitted', label: 'Submitted', probability: 55, track: 'general', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: 'finalist', label: 'Finalist', probability: 75, track: 'general', tone: 'bg-orange-50 text-orange-700 border-orange-100' },
  { id: 'awarded', label: 'Awarded', probability: 100, track: 'general', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', outcome: 'won' },
  { id: 'declined', label: 'Declined', probability: 0, track: 'general', tone: 'bg-zinc-50 text-zinc-500 border-zinc-200', outcome: 'lost' },
];

const pitchStages: StageConfig[] = [
  { id: 'identified', label: 'Identified', probability: 10, track: 'general', tone: 'bg-stone-100 text-stone-700 border-stone-200' },
  { id: 'application-in-progress', label: 'Application In Progress', probability: 18, track: 'general', tone: 'bg-teal-50 text-teal-700 border-teal-100' },
  { id: 'applied', label: 'Applied', probability: 25, track: 'general', tone: 'bg-sky-50 text-sky-700 border-sky-100' },
  { id: 'selected', label: 'Selected', probability: 55, track: 'general', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { id: 'prepping', label: 'Prepping', probability: 70, track: 'general', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: 'pitched', label: 'Pitched', probability: 80, track: 'general', tone: 'bg-orange-50 text-orange-700 border-orange-100' },
  { id: 'won', label: 'Won', probability: 100, track: 'general', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', outcome: 'won' },
  { id: 'not-selected', label: 'Not Selected', probability: 0, track: 'general', tone: 'bg-zinc-50 text-zinc-500 border-zinc-200', outcome: 'lost' },
];

const templateCatalog: Record<
  TemplateKey,
  {
    label: string;
    description: string;
    accent: string;
    stages: StageConfig[];
    defaultName: string;
  }
> = {
  vc: {
    label: 'VC Pipeline',
    defaultName: 'VCs',
    description: 'Investors, angels, family offices, and fund intros.',
    accent: 'bg-emerald-500',
    stages: vcStages,
  },
  grant: {
    label: 'Grant Pipeline',
    defaultName: 'Grants',
    description: 'Non-dilutive funding, health innovation, and research awards.',
    accent: 'bg-sky-500',
    stages: grantStages,
  },
  pitch: {
    label: 'Pitch Competitions',
    defaultName: 'Pitch Competitions',
    description: 'Demo days, accelerators, university showcases, and prizes.',
    accent: 'bg-amber-500',
    stages: pitchStages,
  },
  'university-pilot': {
    label: 'University Pilot Pipeline',
    defaultName: 'University Pilots',
    description: 'Pilot agreements, athlete engagement proof, and conversion to paid contracts.',
    accent: 'bg-indigo-500',
    stages: pilotContractStages,
  },
  contract: {
    label: 'Contract Negotiations',
    defaultName: 'Contract Negotiations',
    description: 'Formal proposals, term negotiation, margin context, and close dates.',
    accent: 'bg-rose-500',
    stages: contractStages,
  },
  partner: {
    label: 'Partner / Vendor Pipeline',
    defaultName: 'Strategic Partners',
    description: 'Partner talks, integrations, revenue share, and operational dependencies.',
    accent: 'bg-teal-500',
    stages: generalStages,
  },
  'investor-metrics': {
    label: 'Investor Update Contacts',
    defaultName: 'Investor Update Contacts',
    description: 'People to include in investor updates, with relationship status, notes, and follow-up tracking.',
    accent: 'bg-stone-700',
    stages: investorContactStages,
  },
  contacts: {
    label: 'Contacts',
    defaultName: 'Contacts',
    description: 'A simple relationship list with contact details, follow-ups, notes, and email tracking.',
    accent: 'bg-neutral-500',
    stages: contactStages,
  },
};

const isFundSizeList = (list: Pick<PipeList, 'templateKey'>) => list.templateKey === 'vc';
const amountFieldLabelForList = (list: Pick<PipeList, 'templateKey'>) =>
  isFundSizeList(list) ? 'Fund Size' : 'Amount / Prize';
const isInvestorUpdateContactList = (list: Pick<PipeList, 'templateKey' | 'name'>) =>
  list.templateKey === 'investor-metrics' || list.name.trim().toLowerCase() === 'investor update contacts';
const isContactList = (list: Pick<PipeList, 'templateKey' | 'name'>) =>
  list.templateKey === 'contacts' || isInvestorUpdateContactList(list);
const listItemNoun = (list: Pick<PipeList, 'templateKey' | 'name'>) => (isContactList(list) ? 'contact' : 'opportunity');

const contactEmailPattern = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const isValidContactEmail = (value: string) => contactEmailPattern.test(value.trim().toLowerCase());
const normalizeContactEmails = (value: unknown): string[] => {
  const rawEmails = Array.isArray(value)
    ? value.flatMap((entry) => (typeof entry === 'string' ? entry.split(/[\s,;]+/) : []))
    : typeof value === 'string'
      ? value.split(/[\s,;]+/)
      : [];

  return Array.from(
    new Set(
      rawEmails
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email && isValidContactEmail(email)),
    ),
  );
};

const contactNameFromEmail = (value: string) => {
  const email = normalizeContactEmails(value)[0];
  if (!email) return '';

  const localPart = email.split('@')[0]?.split('+')[0] || '';
  const parts = localPart
    .split(/[._-]+/)
    .map((part) => part.replace(/[^a-zA-Z']/g, '').trim())
    .filter((part) => part.length > 1);

  if (parts.length < 2) return '';

  const genericParts = new Set(['admin', 'billing', 'contact', 'hello', 'info', 'mail', 'support', 'team']);
  if (parts.some((part) => genericParts.has(part.toLowerCase()))) return '';

  return parts
    .slice(0, 3)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const normalizeBasicText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeResearchText = (value: unknown) => {
  const text = normalizeBasicText(value);
  return /^(?:n\/?a|not available|not found|unknown|none|null|undefined)$/i.test(text) ? '' : text;
};

const fullFriendName = (friend: FriendOfBusinessContact) =>
  [friend.firstName, friend.lastName]
    .map(normalizeBasicText)
    .filter(Boolean)
    .join(' ')
    .trim();

const friendContactKey = (friend: FriendOfBusinessContact) => {
  const email = normalizeContactEmails(friend.email)[0];
  if (email) return `email:${email}`;

  const name = fullFriendName(friend).toLowerCase();
  const organization = normalizeBasicText(friend.titleOrCompany).toLowerCase();
  if (!name && !organization) return '';

  return `name:${name}|org:${organization}`;
};

const itemContactKey = (item: PipelineItem) => {
  const email = normalizeContactEmails(item.contactEmails)[0];
  if (email) return `email:${email}`;
  return `name:${item.title.trim().toLowerCase()}|org:${item.organization.trim().toLowerCase()}`;
};

const buildFriendAnalysisNotes = (friend: FriendOfBusinessContact) => {
  const relationshipContext = normalizeBasicText(friend.titleOrCompany);
  const notes = normalizeBasicText(friend.notes);
  const emailStatus = normalizeBasicText(friend.emailStatus || friend.lastEmailEvent);
  const openCount = Number.isFinite(friend.emailOpenCount) ? Number(friend.emailOpenCount) : 0;
  const clickCount = Number.isFinite(friend.emailClickCount) ? Number(friend.emailClickCount) : 0;
  const clickedLink = normalizeBasicText(friend.lastEmailClickedLink);
  const engagementParts = [
    emailStatus,
    openCount > 0 ? `${openCount} opens` : '',
    clickCount > 0 ? `${clickCount} clicks` : '',
    clickedLink ? `last clicked ${clickedLink}` : '',
  ].filter(Boolean);

  return [
    'Imported from Friends of the Business for investor updates.',
    relationshipContext ? `Relationship context: ${relationshipContext}.` : '',
    notes ? `Existing notes: ${notes}` : '',
    engagementParts.length > 0 ? `Email engagement: ${engagementParts.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
};

const normalizeEmailStatus = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeContactEmailStatusInput = (value: unknown) => {
  const status = normalizeEmailStatus(value);
  if (!status) return 'not_sent';
  if (status === 'request') return 'sent';
  if (status === 'unique_opened' || status === 'uniqueopened' || status === 'proxy_open' || status === 'unique_proxy_open' || status === 'uniqueproxyopen') return 'opened';
  if (status === 'click') return 'clicked';
  if (status === 'unsubscribe') return 'unsubscribed';
  return status;
};

const emailStatusLabel = (item: Pick<PipelineItem, 'emailStatus' | 'lastEmailEvent'>) => {
  const status = normalizeContactEmailStatusInput(item.emailStatus || item.lastEmailEvent);
  if (!status || status === 'not_sent') return 'Not sent';
  if (status === 'request') return 'Sent';
  if (status === 'opened') return 'Opened';
  if (status === 'click' || status === 'clicked') return 'Clicked';
  if (status === 'delivered') return 'Delivered';
  if (status === 'sent') return 'Sent';
  if (status === 'soft_bounce') return 'Soft bounce';
  if (status === 'hard_bounce') return 'Hard bounce';
  if (status === 'invalid_email') return 'Invalid email';
  if (status === 'unsubscribed' || status === 'unsubscribe') return 'Unsubscribed';
  return status
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const emailStatusTone = (item: Pick<PipelineItem, 'emailStatus' | 'lastEmailEvent'>) => {
  const status = normalizeContactEmailStatusInput(item.emailStatus || item.lastEmailEvent);
  if (status === 'opened' || status === 'click' || status === 'clicked') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'delivered') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (status === 'sent' || status === 'request') return 'border-stone-200 bg-stone-50 text-stone-600';
  if (['soft_bounce', 'hard_bounce', 'blocked', 'deferred', 'spam', 'unsubscribe', 'unsubscribed', 'invalid_email', 'error'].includes(status)) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-stone-200 bg-white text-stone-400';
};

const normalizeLeadInputUrl = (value: string) => {
  const trimmed = value.trim();
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(trimmed)
      ? `https://${trimmed}`
      : '';

  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
};

const fallbackLeadTitleFromInput = (value: string) => {
  const parsedUrl = normalizeLeadInputUrl(value);
  if (parsedUrl) return parsedUrl.hostname.replace(/^www\./, '');
  return value.trim();
};

const makeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const shareDocumentIdForList = (ownerUid: string, listId: string) => `${ownerUid}-${listId}`;
const shareDocumentIdForLead = (ownerUid: string, listId: string, itemId: string) =>
  `${ownerUid}-${listId}-${itemId}`;

const shouldUseRedirectSignIn = () => {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent || '';
  const isMobileUserAgent = /Android|iPhone|iPad|iPod|CriOS|FxiOS|Mobile/i.test(userAgent);
  const isTouchFirst = window.matchMedia?.('(pointer: coarse)').matches || false;

  return isMobileUserAgent || isTouchFirst;
};

const defaultDraft = (stage = generalStages[0].id): ItemDraft => ({
  title: '',
  organization: '',
  owner: '',
  contactEmails: [],
  contactPhone: '',
  linkedinUrl: '',
  emailStatus: '',
  lastEmailType: '',
  lastEmailEvent: '',
  lastEmailMessageId: '',
  lastEmailSentAt: '',
  lastEmailDeliveredAt: '',
  lastEmailOpenedAt: '',
  lastEmailClickedAt: '',
  emailOpenCount: 0,
  emailClickCount: 0,
  lastEmailClickedLink: '',
  stage,
  priority: 'medium',
  amount: '',
  dueDate: '',
  nextStep: '',
  notes: '',
  sourceUrl: '',
  segment: '',
  decisionMaker: '',
  acv: '',
  expectedCloseDate: '',
  contractTerm: '',
  pilotScope: '',
  athleteCount: '',
  pilotStart: '',
  pilotEnd: '',
  conversionLikelihood: '',
  grossMargin: '',
  partnerCost: '',
  hardwareCost: '',
  lossReason: '',
  expansionPath: '',
  attachments: [],
});

const defaultLogDraft = (templateKey: TemplateKey = 'partner'): ActivityLogDraft => ({
  type: templateKey === 'university-pilot' ? 'metrics' : 'update',
  weekOf: new Date().toISOString().slice(0, 10),
  summary: '',
  nextStep: '',
  followUpDate: '',
  rosteredAthletes: '',
  completedCheckIns: '',
  checkInRate: '',
  biometricSyncRate: '',
  signalEvents: '',
  noraEngagementRate: '',
  noraSessions: '',
  escalations: '',
  staffFeedbackScore: '',
  notes: '',
});

const stripAiConfidenceNote = (value?: string) =>
  String(value || '')
    .split(/\r?\n/)
    .filter((line) => !/^\s*AI confidence:\s*\d+(?:\.\d+)?%?\s*$/i.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const emailMessageUrlRegex = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const escapeComposerHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const linkifyComposerText = (value: string) =>
  escapeComposerHtml(value).replace(emailMessageUrlRegex, (url) => {
    const href = url.toLowerCase().startsWith('http') ? url : `https://${url}`;
    return `<a href="${href}" target="_blank" rel="noreferrer" style="color:#2563eb;text-decoration:underline;text-underline-offset:3px;">${url}</a>`;
  });

const linkifyComposerBodyHtml = (value: string) => linkifyComposerText(value).replace(/\n/g, '<br>');

const sanitizeComposerBodyHtml = (value: string) =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\sstyle=(?:"[^"]*"|'[^']*')/gi, '');

const composerHtmlHasBreakMarkup = (value: string) => /<br\s*\/?>|<\/?(div|p)\b/i.test(value);

const normalizeComposerBodyHtml = (html: string, textFallback = '') => {
  const sanitized = sanitizeComposerBodyHtml(html);
  if (!sanitized.trim()) return textFallback ? linkifyComposerBodyHtml(textFallback) : '';
  const normalized = sanitized.replace(/\r?\n/g, '<br>');
  if (!composerHtmlHasBreakMarkup(normalized) && textFallback.includes('\n') && !/<a\b/i.test(normalized)) {
    return linkifyComposerBodyHtml(textFallback);
  }
  return normalized
    .replace(/<div><br><\/div>/gi, '<br>')
    .replace(/<\/div><div>/gi, '<br>')
    .replace(/^<div>/i, '')
    .replace(/<\/div>$/i, '')
    .replace(/<p><br><\/p>/gi, '<br>')
    .replace(/<\/p><p>/gi, '<br><br>')
    .replace(/^<p>/i, '')
    .replace(/<\/p>$/i, '');
};

const serializeComposerNodeToHtml = (node: ChildNode, linkifyText = true): string => {
  if (node.nodeType === 3) {
    const escaped = escapeComposerHtml(node.textContent || '').replace(/\r?\n/g, '<br>');
    return linkifyText ? escaped.replace(emailMessageUrlRegex, (url) => {
      const href = url.toLowerCase().startsWith('http') ? url : `https://${url}`;
      return `<a href="${escapeComposerHtml(href)}" target="_blank" rel="noreferrer">${url}</a>`;
    }) : escaped;
  }
  if (node.nodeType !== 1) return '';

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'br') return '<br>';

  const childHtml = Array.from(element.childNodes)
    .map((child) => serializeComposerNodeToHtml(child, tagName !== 'a'))
    .join('');

  if (tagName === 'a') {
    const href = normalizeComposerHref(element.getAttribute('href') || '');
    return href ? `<a href="${escapeComposerHtml(href)}" target="_blank" rel="noreferrer">${childHtml}</a>` : childHtml;
  }
  if (tagName === 'div') return childHtml ? `${childHtml}<br>` : '<br>';
  if (tagName === 'p') return childHtml ? `${childHtml}<br><br>` : '<br><br>';
  return childHtml;
};

const serializeComposerEditorHtml = (editor: HTMLDivElement) =>
  normalizeComposerBodyHtml(
    Array.from(editor.childNodes)
      .map((node) => serializeComposerNodeToHtml(node))
      .join(''),
    editor.innerText.replace(/\u00a0/g, ' '),
  );

const normalizeComposerHref = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const href = /^(https?:\/\/|mailto:)/i.test(trimmed)
    ? trimmed
    : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
      ? `mailto:${trimmed}`
      : `https://${trimmed}`;
  try {
    const parsed = new URL(href);
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',').pop() || '' : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read attachment.'));
    reader.readAsDataURL(file);
  });

const isBackdropClick = (event: React.MouseEvent<HTMLElement>) => event.target === event.currentTarget;

const cleanDealNotes = (value?: string) => {
  const cleaned = stripAiConfidenceNote(value);
  if (!cleaned) return '';

  const genericPageSummaryPatterns = [
    /^\s*(this|the)\s+page\s+(serves|appears|is|provides|showcases|contains|describes|highlights)\b/i,
    /^\s*(this|the)\s+(website|site)\s+(serves|appears|is|provides|showcases|contains|describes|highlights)\b/i,
    /\bmay be relevant for partnerships? or sponsorships?\b/i,
    /\bcould be relevant for partnerships? or sponsorships?\b/i,
    /\bshowcasing various\b/i,
    /\bofficial athletics website\b/i,
  ];

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .filter((paragraph) => !genericPageSummaryPatterns.some((pattern) => pattern.test(paragraph)));

  return paragraphs.join('\n\n').trim();
};

const createItem = (draft: ItemDraft, id = makeId()): PipelineItem => {
  const now = new Date().toISOString();
  return {
    ...draft,
    contactEmails: normalizeContactEmails(draft.contactEmails),
    contactPhone: draft.contactPhone.trim(),
    linkedinUrl: normalizeLeadInputUrl(draft.linkedinUrl)?.toString() || '',
    notes: cleanDealNotes(draft.notes),
    id,
    weeklyLogs: [],
    createdAt: now,
    updatedAt: now,
  };
};

const pitchCompetitionRecommendations: { id: string; draft: ItemDraft }[] = [
  {
    id: 'philadelphia-regional-startup-world-cup-2026',
    draft: {
      ...defaultDraft('identified'),
      title: 'Philadelphia Regional Startup World Cup Pitch Competition',
      organization: 'City of Philadelphia / Startup World Cup',
      owner: 'Tre',
      priority: 'high',
      amount: '$20k first / $10k second / $5k third',
      dueDate: '2026-07-15',
      expectedCloseDate: '2026-08-14',
      pilotStart: '2026-09-18',
      sourceUrl: 'https://www.phila.gov/2026-06-11-tech-startups-can-apply-to-compete-at-the-2026-philadelphia-regional-startup-world-cup-pitch-competition/',
      segment: 'Tech startup / Startup World Cup',
      decisionMaker: 'Selection committee',
      nextStep: 'Confirm Sept. 18 onsite availability in Philadelphia and submit application by 11:59 p.m.',
      expansionPath: 'First place advances toward Startup World Cup for a chance at the $1M investment prize.',
      notes: [
        'Analysis: Strong visibility play if travel works; the deadline is urgent.',
        'Fit: Tech startup pitch with clear regional prizes and a global Startup World Cup path.',
        'Prep: Emphasize PulseCheck as mental-readiness and performance-support technology with pilot traction, clear buyer, and a concise go-to-market story.',
      ].join('\n\n'),
    },
  },
  {
    id: 'sent-ventures-pitch-competition-2026',
    draft: {
      ...defaultDraft('identified'),
      title: 'SENT Ventures Pitch Competition',
      organization: 'SENT Ventures',
      owner: 'Tre',
      priority: 'medium',
      amount: '$10k cash prize + $50k+ in-kind prizes',
      dueDate: '2026-07-24',
      expectedCloseDate: '2026-08-15',
      sourceUrl: 'https://www.sentventures.com/pitch-2026',
      segment: 'Angel / pre-seed / seed',
      decisionMaker: 'SENT Summit investor judges',
      nextStep: 'Verify values alignment and submit before the July 24 deadline.',
      notes: [
        'Analysis: Good investor-room opportunity if the values-aligned community is a real fit.',
        'Fit: Seeking angel, pre-seed, and seed teams to pitch at SENT Summit in Denver.',
        'Prep: Keep the application grounded in mission, founder conviction, and why mental-performance health technology can create durable impact.',
      ].join('\n\n'),
    },
  },
  {
    id: 'alibaba-cocreate-pitch-los-angeles-2026',
    draft: {
      ...defaultDraft('identified'),
      title: 'Alibaba CoCreate Pitch - Los Angeles',
      organization: 'Alibaba CoCreate',
      owner: 'Tre',
      priority: 'medium',
      amount: '$1M+ prize pool',
      dueDate: '2026-07-25',
      expectedCloseDate: '2026-08-10',
      pilotStart: '2026-09-09',
      pilotEnd: '2026-09-10',
      sourceUrl: 'https://www.alibabacocreate.com/pitch',
      segment: 'Global tech / product growth',
      decisionMaker: 'CoCreate judges',
      nextStep: 'Confirm the Los Angeles track is the right fit and submit the product story before July 25.',
      notes: [
        'Analysis: Broader tech exposure rather than health-specific; worth adding because the LA deadline is still open and the prize pool is meaningful.',
        'Fit: Best positioned around AI-enabled product, scalable operations, and how PulseCheck can grow beyond one sports vertical.',
        'Prep: Lead with product clarity, customer workflow, market size, and why now.',
      ].join('\n\n'),
    },
  },
  {
    id: 'agetech-august-open-mic-pitch-challenge-2026',
    draft: {
      ...defaultDraft('identified'),
      title: 'AgeTech August Open Mic Pitch Challenge',
      organization: 'AgeTech Collaborative from AARP',
      owner: 'Tre',
      priority: 'medium',
      amount: 'Accelerator mentorship / AgeTech exposure',
      dueDate: '2026-07-31',
      expectedCloseDate: '2026-08-18',
      pilotStart: '2026-08-27',
      sourceUrl: 'https://agetechcollaborative.org/custom_events/august-open-mic-pitch-challenge/',
      segment: 'AgeTech / healthspan / wellness',
      decisionMaker: 'AgeTech selection committee',
      nextStep: 'Frame PulseCheck around healthspan, recovery habits, and helping people stay in the game as they age.',
      notes: [
        'Analysis: Not a pure athlete pipeline, but it can fit if positioned around healthspan, wellness, independence, and long-term performance.',
        'Fit: MVP-stage solutions in AgeTech, healthspan, or wellness; online pitch is 3 minutes plus 5 minutes of Q&A.',
        'Prep: Avoid youth-sports language here; focus on recovery, daily behavior, confidence, and durable participation for the 50+ audience.',
      ].join('\n\n'),
    },
  },
  {
    id: 'pitch-and-pour-medtech-conference-2026',
    draft: {
      ...defaultDraft('identified'),
      title: 'Pitch & Pour: Start-Up Pitch Competition',
      organization: 'The MedTech Conference / MTEC',
      owner: 'Tre',
      priority: 'medium',
      amount: '$7.5k cash prize + 2027 conference pass and presentation slot',
      dueDate: '2026-08-06',
      expectedCloseDate: '2026-08-24',
      pilotStart: '2026-10-18',
      sourceUrl: 'https://themedtechconference.com/start-up-pitch-competition/',
      segment: 'Medtech / military health',
      decisionMaker: 'Pitch & Pour judges',
      nextStep: 'Decide the military-health angle before applying; build a 5-minute pitch around readiness, recovery, and performance.',
      notes: [
        'Analysis: Strong healthcare conference exposure, but eligibility depends on having a credible military-focused application.',
        'Fit: Companies must have raised less than $10M, offer a military-focused medtech, diagnostics, digital health, or imaging application, and pitch in person in Boston on Oct. 18 if selected.',
        'Prep: Use a practical readiness/wellness use case and be clear about current product status, data, market, IP, milestones, and path to market.',
      ].join('\n\n'),
    },
  },
  {
    id: 'venture-atlanta-2026-pitch',
    draft: {
      ...defaultDraft('identified'),
      title: 'Venture Atlanta 2026 Pitch',
      organization: 'Venture Atlanta',
      owner: 'Tre',
      priority: 'high',
      amount: 'Investor exposure + two complimentary tickets if selected',
      dueDate: '2026-08-07',
      expectedCloseDate: '2026-08-21',
      pilotStart: '2026-08-27',
      pilotEnd: '2026-10-15',
      sourceUrl: 'https://www.ventureatlanta.org/pitch/',
      segment: 'Southeast digital health / investor pitch',
      decisionMaker: 'Venture Atlanta committee',
      nextStep: 'Apply as digital health/software with Southeast fit, pilot traction, and an 18-month raise plan.',
      notes: [
        'Analysis: High-priority investor exposure if PulseCheck qualifies as Southeast-based and is raising or planning to raise within 18 months.',
        'Fit: Venture Atlanta accepts digital health and tech-enabled Southeast companies; it does not accept bio, pharma, life sciences, or medtech.',
        'Prep: Emphasize buyer urgency, pilots, retention/engagement signals, revenue path, and what capital unlocks.',
      ].join('\n\n'),
    },
  },
  {
    id: 'sxsw-edu-launch-startup-competition-2027',
    draft: {
      ...defaultDraft('identified'),
      title: 'SXSW EDU Launch Startup Competition',
      organization: 'SXSW EDU',
      owner: 'Tre',
      priority: 'medium',
      amount: 'Startup exposure, credentials, coaching, and awards',
      dueDate: '2026-09-11',
      expectedCloseDate: '2026-11-01',
      pilotStart: '2027-03-13',
      pilotEnd: '2027-03-16',
      sourceUrl: 'https://sxswedu.com/competitions/',
      segment: 'Education / athlete development',
      decisionMaker: 'SXSW EDU Launch judges',
      nextStep: 'Choose whether the education positioning is strong enough before the Sept. 11 early deadline; final deadline is Nov. 1.',
      notes: [
        'Analysis: Good only if the application leads with schools, teams, coaching education, or athlete-development learning outcomes.',
        'Fit: Early-stage education startups need a management team, public website, sustainable business model, and traction/adoption metrics; companies over $8M raised are ineligible.',
        'Prep: Frame PulseCheck as a learning and behavior-change platform for athlete mental readiness, not just a health app.',
      ].join('\n\n'),
    },
  },
  {
    id: 'sxsw-pitch-2027',
    draft: {
      ...defaultDraft('identified'),
      title: 'SXSW Pitch 2027',
      organization: 'SXSW',
      owner: 'Tre',
      priority: 'high',
      amount: 'Global startup exposure; investor, press, and early-adopter audience',
      dueDate: '2026-09-13',
      expectedCloseDate: '2026-11-13',
      pilotStart: '2027-03-15',
      pilotEnd: '2027-03-21',
      sourceUrl: 'https://sxsw.com/news/2026/2027-pitch-applications/',
      segment: 'Healthcare / sports digital platform',
      decisionMaker: 'SXSW Pitch judges',
      nextStep: 'Confirm launch-date eligibility and pick the strongest category before the Sept. 13 early-bird deadline.',
      notes: [
        'Analysis: High-upside awareness and investor opportunity if eligibility checks out.',
        'Fit: Relevant categories include Life Sciences, Healthcare & Assistive Tech and Entertainment, Media, Sports & Digital Platforms.',
        'Eligibility to verify: product/service launched before Jan. 1, 2024, company has not raised over $10M, and founders retain ownership.',
        'Prep: Position the story around why mental-performance infrastructure for athletes and health teams belongs at a cross-industry innovation event.',
      ].join('\n\n'),
    },
  },
];

const createPitchCompetitionRecommendationItems = () =>
  pitchCompetitionRecommendations.map(({ id, draft }) => createItem(draft, id));

const normalizeOpportunityKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

const generatedLeadKey = (lead: Pick<ItemDraft, 'title' | 'organization' | 'sourceUrl'>) =>
  lead.sourceUrl
    ? normalizeOpportunityKey(lead.sourceUrl)
    : normalizeOpportunityKey(`${lead.title} ${lead.organization}`);

const isIsoDateOnOrAfter = (dateValue: string, minimumDate: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return false;

  const dateTime = new Date(`${dateValue}T12:00:00`).getTime();
  const minimumTime = new Date(`${minimumDate}T00:00:00`).getTime();
  return !Number.isNaN(dateTime) && dateTime >= minimumTime;
};

const clampLeadGenCount = (value: number) => Math.min(10, Math.max(3, value));

const defaultLeadSearchBrief = (_list: PipeList): LeadSearchBrief => {
  return {
    productName: '',
    productContext: '',
    searchFocus: '',
    targetAudience: '',
    opportunityTypes: '',
    preferredSources: '',
    mustInclude: '',
    mustExclude: '',
    positioning: '',
    requireFutureDeadline: false,
    officialSourcesOnly: false,
    includeAdjacentFit: false,
    leadCount: 6,
  };
};

const normalizeLeadSearchBrief = (brief: Partial<LeadSearchBrief> | undefined, list: PipeList): LeadSearchBrief => {
  const fallback = defaultLeadSearchBrief(list);
  const readString = (field: keyof LeadSearchBrief) =>
    typeof brief?.[field] === 'string' ? (brief[field] as string) : (fallback[field] as string);

  return {
    productName: readString('productName'),
    productContext: readString('productContext'),
    searchFocus: readString('searchFocus'),
    targetAudience: readString('targetAudience'),
    opportunityTypes: readString('opportunityTypes'),
    preferredSources: readString('preferredSources'),
    mustInclude: readString('mustInclude'),
    mustExclude: readString('mustExclude'),
    positioning: readString('positioning'),
    requireFutureDeadline: brief?.requireFutureDeadline ?? fallback.requireFutureDeadline,
    officialSourcesOnly: brief?.officialSourcesOnly ?? fallback.officialSourcesOnly,
    includeAdjacentFit: brief?.includeAdjacentFit ?? fallback.includeAdjacentFit,
    leadCount: clampLeadGenCount(Number(brief?.leadCount) || fallback.leadCount),
  };
};

const buildLeadSearchPrompt = (brief: LeadSearchBrief) =>
  [
    brief.productName ? `Product / company: ${brief.productName}` : '',
    brief.productContext ? `Product context: ${brief.productContext}` : '',
    brief.searchFocus ? `Search focus: ${brief.searchFocus}` : '',
    brief.targetAudience ? `Target buyer / audience: ${brief.targetAudience}` : '',
    brief.opportunityTypes ? `Opportunity types: ${brief.opportunityTypes}` : '',
    brief.preferredSources ? `Preferred sources: ${brief.preferredSources}` : '',
    brief.includeAdjacentFit
      ? 'Include adjacent-fit leads when there is a practical positioning or outreach path.'
      : '',
    brief.requireFutureDeadline
      ? 'Require a current or future application/submission deadline. Exclude undated, expired, closed, or already-passed opportunities.'
      : '',
    brief.officialSourcesOnly
      ? 'Use official/current sources first and verify against official pages before returning a lead.'
      : '',
    brief.mustInclude ? `Must include: ${brief.mustInclude}` : '',
    brief.mustExclude ? `Must exclude: ${brief.mustExclude}` : '',
    brief.positioning ? `Positioning guidance: ${brief.positioning}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

const leadSearchStringFields = [
  'title',
  'organization',
  'owner',
  'contactPhone',
  'linkedinUrl',
  'stage',
  'amount',
  'dueDate',
  'nextStep',
  'notes',
  'sourceUrl',
  'segment',
  'decisionMaker',
  'acv',
  'expectedCloseDate',
  'contractTerm',
  'pilotScope',
  'athleteCount',
  'pilotStart',
  'pilotEnd',
  'conversionLikelihood',
  'grossMargin',
  'partnerCost',
  'hardwareCost',
  'lossReason',
  'expansionPath',
  'rationale',
  'sourceEvidence',
  'deadlineStatus',
] as const;

const leadSearchResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    leads: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...leadSearchStringFields.reduce<Record<string, { type: 'string' }>>(
            (properties, field) => ({ ...properties, [field]: { type: 'string' } }),
            { priority: { type: 'string' } },
          ),
          contactEmails: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['priority', ...leadSearchStringFields, 'contactEmails'],
      },
    },
  },
  required: ['leads'],
};

const parseJsonSafe = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const getResponsesApiText = (value: unknown) => {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  if (typeof record.output_text === 'string') return record.output_text;

  const output = Array.isArray(record.output) ? record.output : [];
  return output
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) return [];
      return content
        .map((part) => {
          if (!part || typeof part !== 'object') return '';
          const partRecord = part as Record<string, unknown>;
          return typeof partRecord.text === 'string' ? partRecord.text : '';
        })
        .filter(Boolean);
    })
    .join('\n');
};

const getApiErrorMessage = (payload: unknown, fallbackMessage: string) => {
  if (!payload || typeof payload !== 'object') return fallbackMessage;
  const record = payload as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (typeof error === 'string' && error.trim()) return error;
  if (typeof record.message === 'string' && record.message.trim()) return record.message;
  return fallbackMessage;
};

const getLeadSearchBridgeUrl = () => {
  if (typeof window === 'undefined') return '/api/openai/v1/responses';

  const host = window.location.hostname;
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  return isLocalHost ? `${PIPELISTS_REMOTE_BRIDGE_ORIGIN}/api/openai/v1/responses` : '/api/openai/v1/responses';
};

const getEasternDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value || '';
  const month = parts.find((part) => part.type === 'month')?.value || '';
  const day = parts.find((part) => part.type === 'day')?.value || '';
  return `${year}-${month}-${day}`;
};

const isPitchCompetitionList = (list: PipeList) =>
  list.id === PITCH_COMPETITIONS_LIST_ID ||
  list.templateKey === 'pitch' ||
  normalizeOpportunityKey(list.name) === PITCH_COMPETITIONS_LIST_ID;

const mergeRecommendedPitchCompetitions = (lists: PipeList[]) => {
  const recommendedItems = createPitchCompetitionRecommendationItems();
  let mergedIntoPitchList = false;

  return lists.map((list) => {
    if (mergedIntoPitchList || !isPitchCompetitionList(list)) return list;
    mergedIntoPitchList = true;

    const existingKeys = new Set(
      list.items.flatMap((item) => [
        item.id,
        normalizeOpportunityKey(item.title),
        item.sourceUrl ? normalizeOpportunityKey(item.sourceUrl) : '',
      ]),
    );
    const missingItems = recommendedItems.filter(
      (item) =>
        !existingKeys.has(item.id) &&
        !existingKeys.has(normalizeOpportunityKey(item.title)) &&
        (!item.sourceUrl || !existingKeys.has(normalizeOpportunityKey(item.sourceUrl))),
    );

    if (missingItems.length === 0) return list;
    return { ...list, items: [...missingItems, ...list.items] };
  });
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const isItemDeleted = (item: Pick<PipelineItem, 'deletedAt'>) => Boolean(item.deletedAt);
const canRestoreDeletedItem = (item: Pick<PipelineItem, 'deletedAt' | 'restorableUntil'>) =>
  Boolean(item.deletedAt && item.restorableUntil && new Date(item.restorableUntil).getTime() >= Date.now());

const createSystemLog = (
  item: Pick<PipelineItem, 'id' | 'title' | 'organization'>,
  action: NonNullable<ActivityLog['systemAction']>,
  summary: string,
  restorableUntil = '',
): ActivityLog => {
  const now = new Date();
  return {
    ...defaultLogDraft(),
    id: makeId(),
    type: 'decision',
    weekOf: now.toISOString().slice(0, 10),
    summary,
    nextStep: '',
    notes: item.organization ? `Organization: ${item.organization}` : '',
    createdAt: now.toISOString(),
    systemAction: action,
    relatedItemId: item.id,
    restorableUntil,
  };
};

const purgeExpiredDeletedItems = (lists: PipeList[]) =>
  lists.map((list) => ({
    ...list,
    items: list.items.filter(
      (item) => !item.deletedAt || !item.restorableUntil || new Date(item.restorableUntil).getTime() >= Date.now(),
    ),
  }));

const stripUndefined = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)]),
    ) as T;
  }

  return value;
};

const createList = (
  templateKey: TemplateKey,
  name = templateCatalog[templateKey].defaultName,
  index = 0,
  items: PipelineItem[] = [],
): PipeList => {
  const template = templateCatalog[templateKey];
  const list: PipeList = {
    id: makeId(),
    name,
    description: template.description,
    accent: template.accent || accentClasses[index % accentClasses.length],
    templateKey,
    stages: template.stages,
    items,
    createdAt: new Date().toISOString(),
  };
  return {
    ...list,
    searchBrief: defaultLeadSearchBrief(list),
  };
};

const initialLists: PipeList[] = [
  {
    ...createList('vc', 'VCs', 0),
    id: 'venture-capital',
    createdAt: '2026-07-03T00:00:00.000Z',
    items: [
      createItem(
        {
          ...defaultDraft('partner-meeting'),
          title: 'Seed fund partner intro',
          organization: 'Signal Ridge Ventures',
          owner: 'Tre',
          priority: 'high',
          amount: '$250k-$500k',
          expectedCloseDate: '2026-07-24',
          nextStep: 'Send updated traction note and pilot summary.',
          notes: 'Warm intro. Interested in athlete performance and wearable data.',
        },
        'seed-fund-partner-intro',
      ),
      createItem(
        {
          ...defaultDraft('diligence'),
          title: 'Sports tech scout meeting',
          organization: 'Northstar Capital',
          owner: 'Tre',
          priority: 'medium',
          amount: '$100k+',
          expectedCloseDate: '2026-08-05',
          nextStep: 'Share research site and PulseCheck demo.',
        },
        'sports-tech-scout-meeting',
      ),
    ],
  },
  {
    ...createList('grant', 'Grants', 1),
    id: 'grants',
    createdAt: '2026-07-03T00:00:00.000Z',
    items: [
      createItem(
        {
          ...defaultDraft('eligible'),
          title: 'Digital health innovation grant',
          organization: 'State Health Innovation Office',
          owner: 'Tre',
          amount: '$75k',
          expectedCloseDate: '2026-08-30',
          nextStep: 'Confirm eligibility and required partners.',
        },
        'digital-health-innovation-grant',
      ),
    ],
  },
  {
    ...createList('pitch', 'Pitch Competitions', 2),
    id: PITCH_COMPETITIONS_LIST_ID,
    createdAt: '2026-07-03T00:00:00.000Z',
    items: [
      ...createPitchCompetitionRecommendationItems(),
      createItem(
        {
          ...defaultDraft('prepping'),
          title: 'Health AI showcase',
          organization: 'Southeast Founder Forum',
          owner: 'Tre',
          priority: 'high',
          amount: '$25k prize',
          dueDate: '2026-07-20',
          nextStep: 'Finalize 3 minute pitch and product screenshots.',
          notes: 'Need crisp mental performance positioning.',
        },
        'health-ai-showcase',
      ),
    ],
  },
  {
    ...createList('university-pilot', 'University Pilots', 3),
    id: 'university-pilots',
    createdAt: '2026-07-03T00:00:00.000Z',
    items: [
      {
        ...createItem(
          {
            ...defaultDraft('pilot-active'),
            title: 'Athlete readiness pilot',
            organization: 'Coastal State University',
            owner: 'Tre',
            priority: 'high',
            segment: 'D3',
            decisionMaker: 'Sports Performance Director',
            acv: '$18k',
            amount: '$18k pilot',
            expectedCloseDate: '2026-08-15',
            pilotScope: 'Fall readiness cohort with check-ins, biometrics, and Nora support.',
            athleteCount: '42',
            pilotStart: '2026-07-01',
            pilotEnd: '2026-08-08',
            conversionLikelihood: '70%',
            nextStep: 'Send procurement packet and pilot scope.',
            notes: 'Sports performance staff wants a fall cohort.',
          },
          'athlete-readiness-pilot',
        ),
        weeklyLogs: [
          {
            id: 'coastal-week-1',
            type: 'metrics',
            weekOf: '2026-07-03',
            summary: 'First week of readiness pilot showed strong check-in behavior.',
            nextStep: 'Send staff a weekly summary and confirm procurement packet timing.',
            followUpDate: '2026-07-10',
            rosteredAthletes: '42',
            completedCheckIns: '34',
            checkInRate: '81%',
            biometricSyncRate: '74%',
            signalEvents: '5',
            noraEngagementRate: '62%',
            noraSessions: '9',
            escalations: '1',
            staffFeedbackScore: '8',
            notes: 'Early adherence is above the AuntEDNA floor. Staff asked for a weekly summary.',
            createdAt: '2026-07-03T00:00:00.000Z',
          },
        ],
      },
    ],
  },
  {
    ...createList('contract', 'Contract Negotiations', 4),
    id: 'contract-negotiations',
    createdAt: '2026-07-03T00:00:00.000Z',
    items: [
      createItem(
        {
          ...defaultDraft('proposal-sent'),
          title: 'Readiness platform first ARR',
          organization: 'Mid-Atlantic Athletics',
          owner: 'Tre',
          priority: 'high',
          segment: 'Mid-major',
          decisionMaker: 'Associate AD',
          acv: '$48k',
          amount: '$48k ARR',
          expectedCloseDate: '2026-07-31',
          contractTerm: '12 months',
          grossMargin: '72%',
          partnerCost: '$8k AuntEDNA routing reserve',
          hardwareCost: '$5k Polar bundle',
          expansionPath: 'Start with one sport, expand to full department after fall season.',
          nextStep: 'Confirm purchasing path and final data-processing language.',
        },
        'readiness-platform-first-arr',
      ),
    ],
  },
];

const getStage = (list: PipeList, stageId: string) =>
  list.stages.find((stage) => stage.id === stageId) || list.stages[0] || generalStages[0];

const isClosedStage = (list: PipeList, stageId: string) => getStage(list, stageId).outcome === 'won' || getStage(list, stageId).outcome === 'lost';
const isWonStage = (list: PipeList, stageId: string) => getStage(list, stageId).outcome === 'won';

const normalizeStageId = (stage: string, listStages: StageConfig[]) => {
  if (listStages.some((stageConfig) => stageConfig.id === stage)) return stage;
  const legacyMap: Record<string, string> = {
    sourced: listStages.find((stageConfig) => stageConfig.id === 'sourced')?.id || listStages[0]?.id || 'sourced',
    'cold-contact': listStages.find((stageConfig) => stageConfig.id === 'cold-contact')?.id || listStages[1]?.id || listStages[0]?.id || 'cold-contact',
    contacted: listStages.find((stageConfig) => stageConfig.id === 'contacted')?.id || listStages[1]?.id || listStages[0]?.id || 'contacted',
    'in-review': listStages.find((stageConfig) => stageConfig.id === 'in-review')?.id || listStages.find((stageConfig) => stageConfig.id === 'engaged')?.id || listStages[2]?.id || listStages[0]?.id || 'in-review',
    negotiating: listStages.find((stageConfig) => stageConfig.id === 'negotiating')?.id || listStages.find((stageConfig) => stageConfig.id === 'update-ready')?.id || listStages[0]?.id || 'negotiating',
    won: listStages.find((stageConfig) => stageConfig.outcome === 'won')?.id || listStages.find((stageConfig) => stageConfig.id === 'sent-update')?.id || listStages[0]?.id || 'won',
    parked: listStages.find((stageConfig) => stageConfig.outcome === 'lost')?.id || listStages.find((stageConfig) => stageConfig.id === 'paused')?.id || listStages[0]?.id || 'parked',
  };
  return legacyMap[stage] || listStages[0]?.id || stage;
};

const normalizeActivityLog = (log: Partial<ActivityLog>): ActivityLog => {
  const now = new Date().toISOString();
  const createdAt = pipeTimestampToDate(log.createdAt)?.toISOString() || (log.weekOf ? `${log.weekOf}T00:00:00.000Z` : now);
  const hasMetrics =
    log.rosteredAthletes ||
    log.completedCheckIns ||
    log.checkInRate ||
    log.biometricSyncRate ||
    log.signalEvents ||
    log.noraEngagementRate ||
    log.noraSessions ||
    log.escalations ||
    log.staffFeedbackScore;
  const cleanType = log.type && logTypeLabels[log.type] ? log.type : hasMetrics ? 'metrics' : 'update';

  return {
    id: log.id || makeId(),
    type: cleanType,
    weekOf: log.weekOf || now.slice(0, 10),
    summary: log.summary || '',
    nextStep: log.nextStep || '',
    followUpDate: log.followUpDate || '',
    rosteredAthletes: log.rosteredAthletes || '',
    completedCheckIns: log.completedCheckIns || '',
    checkInRate: log.checkInRate || '',
    biometricSyncRate: log.biometricSyncRate || '',
    signalEvents: log.signalEvents || '',
    noraEngagementRate: log.noraEngagementRate || '',
    noraSessions: log.noraSessions || '',
    escalations: log.escalations || '',
    staffFeedbackScore: log.staffFeedbackScore || '',
    notes: log.notes || '',
    createdAt,
    ...(log.systemAction ? { systemAction: log.systemAction } : {}),
    relatedItemId: log.relatedItemId || '',
    restorableUntil: log.restorableUntil || '',
  };
};

const normalizeAttachment = (attachment: Partial<LeadAttachment>): LeadAttachment | null => {
  const name = attachment.name?.trim() || attachment.fileName?.trim() || 'Attachment';
  const url = attachment.url?.trim() || '';
  if (!url) return null;

  return {
    id: attachment.id || makeId(),
    type: attachment.type === 'file' ? 'file' : 'link',
    name,
    url,
    fileName: attachment.fileName || '',
    contentType: attachment.contentType || '',
    size: typeof attachment.size === 'number' && Number.isFinite(attachment.size) ? attachment.size : 0,
    createdAt: attachment.createdAt || new Date().toISOString(),
    createdBy: attachment.createdBy || '',
  };
};

const normalizeItem = (item: Partial<PipelineItem>, listStages: StageConfig[]): PipelineItem => {
  const now = new Date().toISOString();
  const stage = normalizeStageId(item.stage || listStages[0]?.id || 'sourced', listStages);
  return {
    ...createItem(defaultDraft(stage), item.id || makeId()),
    ...item,
    title: item.title || 'Untitled opportunity',
    organization: item.organization || '',
    owner: item.owner || '',
    contactEmails: normalizeContactEmails(item.contactEmails),
    contactPhone: item.contactPhone || '',
    linkedinUrl: normalizeLeadInputUrl(item.linkedinUrl || '')?.toString() || '',
    emailStatus: item.emailStatus || '',
    lastEmailType: item.lastEmailType || '',
    lastEmailEvent: item.lastEmailEvent || item.emailStatus || '',
    lastEmailMessageId: item.lastEmailMessageId || '',
    lastEmailSentAt: item.lastEmailSentAt || '',
    lastEmailDeliveredAt: item.lastEmailDeliveredAt || '',
    lastEmailOpenedAt: item.lastEmailOpenedAt || '',
    lastEmailClickedAt: item.lastEmailClickedAt || '',
    emailOpenCount: Number.isFinite(item.emailOpenCount) ? Number(item.emailOpenCount) : 0,
    emailClickCount: Number.isFinite(item.emailClickCount) ? Number(item.emailClickCount) : 0,
    lastEmailClickedLink: item.lastEmailClickedLink || '',
    stage,
    priority: item.priority || 'medium',
    amount: item.amount || '',
    dueDate: item.dueDate || '',
    nextStep: item.nextStep || '',
    notes: cleanDealNotes(item.notes),
    sourceUrl: item.sourceUrl || '',
    segment: item.segment || '',
    decisionMaker: item.decisionMaker || '',
    acv: item.acv || '',
    expectedCloseDate: item.expectedCloseDate || '',
    contractTerm: item.contractTerm || '',
    pilotScope: item.pilotScope || '',
    athleteCount: item.athleteCount || '',
    pilotStart: item.pilotStart || '',
    pilotEnd: item.pilotEnd || '',
    conversionLikelihood: item.conversionLikelihood || '',
    grossMargin: item.grossMargin || '',
    partnerCost: item.partnerCost || '',
    hardwareCost: item.hardwareCost || '',
    lossReason: item.lossReason || '',
    expansionPath: item.expansionPath || '',
    attachments: Array.isArray(item.attachments)
      ? item.attachments
          .map((attachment) => normalizeAttachment(attachment))
          .filter((attachment): attachment is LeadAttachment => Boolean(attachment))
      : [],
    weeklyLogs: Array.isArray(item.weeklyLogs) ? item.weeklyLogs.map(normalizeActivityLog) : [],
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
    deletedAt: item.deletedAt || '',
    deletedByLogId: item.deletedByLogId || '',
    restorableUntil: item.restorableUntil || '',
  };
};

const normalizeList = (list: Partial<PipeList>, index: number): PipeList => {
  const templateKey = (list.templateKey && templateCatalog[list.templateKey] ? list.templateKey : 'partner') as TemplateKey;
  const template = templateCatalog[templateKey];
  const savedStages = Array.isArray(list.stages) && list.stages.length > 0 ? list.stages : template.stages;
  const stages =
    templateKey === 'investor-metrics' || templateKey === 'contacts'
      ? template.stages
      : templateKey === 'vc'
      ? template.stages.reduce<StageConfig[]>((mergedStages, templateStage) => {
          if (mergedStages.some((stage) => stage.id === templateStage.id)) return mergedStages;
          const insertAfterIndex = templateStage.id === 'cold-contact'
            ? mergedStages.findIndex((stage) => stage.id === 'targeted')
            : -1;
          if (insertAfterIndex >= 0) {
            return [
              ...mergedStages.slice(0, insertAfterIndex + 1),
              templateStage,
              ...mergedStages.slice(insertAfterIndex + 1),
            ];
          }
          return [...mergedStages, templateStage];
        }, savedStages)
      : templateKey === 'pitch'
      ? template.stages.reduce<StageConfig[]>((mergedStages, templateStage) => {
          if (mergedStages.some((stage) => stage.id === templateStage.id)) return mergedStages;
          const insertAfterIndex = templateStage.id === 'application-in-progress'
            ? mergedStages.findIndex((stage) => stage.id === 'identified')
            : -1;
          if (insertAfterIndex >= 0) {
            return [
              ...mergedStages.slice(0, insertAfterIndex + 1),
              templateStage,
              ...mergedStages.slice(insertAfterIndex + 1),
            ];
          }
          return [...mergedStages, templateStage];
        }, savedStages)
      : savedStages;
  const normalizedList: PipeList = {
    id: list.id || makeId(),
    name: list.name || template.defaultName,
    description: list.description || template.description,
    accent: list.accent || template.accent || accentClasses[index % accentClasses.length],
    templateKey,
    stages,
    items: Array.isArray(list.items) ? list.items.map((item) => normalizeItem(item, stages)) : [],
    createdAt: list.createdAt || new Date().toISOString(),
  };
  return {
    ...normalizedList,
    searchBrief: normalizeLeadSearchBrief(list.searchBrief, normalizedList),
  };
};

const normalizeShareEmails = (emails: unknown) =>
  Array.isArray(emails)
    ? emails
        .filter((email): email is string => typeof email === 'string')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    : [];

const normalizeInviteStatuses = (
  inviteStatuses: unknown,
  viewerEmails: string[],
  editorEmails: string[],
): Record<string, InviteStatus> => {
  const normalized: Record<string, InviteStatus> = {};

  if (inviteStatuses && typeof inviteStatuses === 'object' && !Array.isArray(inviteStatuses)) {
    Object.entries(inviteStatuses as Record<string, Partial<InviteStatus>>).forEach(([key, status]) => {
      const email = (typeof status.email === 'string' ? status.email : key).trim().toLowerCase();
      if (!email) return;
      const access: ShareAccess = status.access === 'edit' || editorEmails.includes(email) ? 'edit' : 'read';
      normalized[email] = {
        email,
        access,
        status: status.status === 'accepted' ? 'accepted' : 'sent',
        inviteId: typeof status.inviteId === 'string' ? status.inviteId : undefined,
        sentAt: status.sentAt,
        acceptedAt: status.acceptedAt,
      };
    });
  }

  viewerEmails.forEach((email) => {
    if (!normalized[email]) {
      normalized[email] = { email, access: 'read', status: 'sent' };
    }
  });

  editorEmails.forEach((email) => {
    normalized[email] = {
      ...(normalized[email] || { email, status: 'sent' as const }),
      email,
      access: 'edit',
    };
  });

  return normalized;
};

const normalizePipeListShare = (id: string, data: Partial<PipeListShare>, index = 0): PipeListShare | null => {
  if (!data.list) return null;
  const viewerEmails = normalizeShareEmails(data.viewerEmails);
  const editorEmails = normalizeShareEmails(data.editorEmails);

  return {
    id,
    ownerUid: data.ownerUid || '',
    ownerEmail: data.ownerEmail || '',
    list: normalizeList(data.list, index),
    access: data.access === 'edit' ? 'edit' : 'read',
    publicRead: data.publicRead === true,
    viewerEmails,
    editorEmails,
    inviteStatuses: normalizeInviteStatuses(data.inviteStatuses, viewerEmails, editorEmails),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

const formatCount = (count: number, singular: string) => {
  if (count === 1) return `${count} ${singular}`;
  const plural = singular.endsWith('y') ? `${singular.slice(0, -1)}ies` : `${singular}s`;
  return `${count} ${plural}`;
};

const timestampToDate = pipeTimestampToDate;

const formatInviteTimestamp = (value: unknown) => {
  const date = timestampToDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const escapeCsv = (value: string) => `"${String(value).replace(/"/g, '""')}"`;

const parseMoney = (value: string) => {
  if (!value) return 0;
  const matches = value
    .toLowerCase()
    .replace(/,/g, '')
    .match(/\d+(?:\.\d+)?\s*[km]?/g);

  if (!matches || matches.length === 0) return 0;

  const values = matches.map((match) => {
    const trimmed = match.trim();
    const number = Number.parseFloat(trimmed);
    if (Number.isNaN(number)) return 0;
    if (trimmed.endsWith('m')) return number * 1000000;
    if (trimmed.endsWith('k')) return number * 1000;
    return number;
  });

  return values.reduce((sum, item) => sum + item, 0) / values.length;
};

const parsePercent = (value: string) => {
  const parsed = Number.parseFloat(String(value).replace('%', ''));
  if (Number.isNaN(parsed)) return 0;
  return parsed;
};

const itemValue = (item: PipelineItem) => {
  const acvValue = parseMoney(item.acv);
  return acvValue > 0 ? acvValue : parseMoney(item.amount);
};

const formatMoney = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const itemAmountDisplay = (list: Pick<PipeList, 'templateKey'>, item: PipelineItem) => {
  if (isFundSizeList(list)) return item.amount || '';
  const computedValue = itemValue(item);
  return computedValue > 0 ? formatMoney(computedValue) : '';
};

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const average = (values: number[]) => {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const derivedCheckInRate = (log: ActivityLog) => {
  const explicit = parsePercent(log.checkInRate);
  if (explicit > 0) return explicit;
  const rostered = Number.parseFloat(log.rosteredAthletes);
  const completed = Number.parseFloat(log.completedCheckIns);
  if (!rostered || !completed) return 0;
  return (completed / rostered) * 100;
};

const logHasMetrics = (log: ActivityLog) =>
  Boolean(
    log.rosteredAthletes ||
      log.completedCheckIns ||
      log.checkInRate ||
      log.biometricSyncRate ||
      log.signalEvents ||
      log.noraEngagementRate ||
      log.noraSessions ||
      log.escalations ||
      log.staffFeedbackScore,
  );

const readAuthError = (error: unknown, fallbackMessage: string) => {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  if (code === 'auth/unauthorized-domain') {
    const host =
      typeof window !== 'undefined' && window.location.hostname
        ? window.location.hostname
        : 'this site';

    return `Firebase Auth is not allowing ${host}. Add ${host} in the SimpBudget Firebase project under Authentication > Settings > Authorized domains, then try again.`;
  }

  return error instanceof Error ? error.message : fallbackMessage;
};

const readFirestoreError = (error: unknown, fallbackMessage: string) => {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  if (code === 'permission-denied') {
    return 'PipeLists signed you in, but the SimpBudget Firebase project is rejecting Firestore access. Deploy the SimpBudget rules that allow signed-in users to read/write their own simpbudget-users/{uid} tree.';
  }

  return error instanceof Error ? error.message : fallbackMessage;
};

const readApiJson = async (response: Response, fallbackMessage: string) => {
  const raw = await response.text();
  const trimmed = raw.trim();

  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const contentType = response.headers.get('content-type') || 'unknown';
    const lowerPreview = trimmed.slice(0, 400).toLowerCase();
    console.error('[PipeLists] Expected JSON API response but received something else:', {
      status: response.status,
      contentType,
      preview: trimmed.slice(0, 160),
    });

    if (response.status === 500 && lowerPreview.includes('task timed out')) {
      throw new Error('Lead search took too long for the local bridge. Refresh and try again.');
    }

    if (response.status === 504 || lowerPreview.includes('timeout') || lowerPreview.includes('timed out')) {
      throw new Error('Lead search timed out. Try a smaller lead count or narrower search brief.');
    }

    if (contentType.includes('text/html') || lowerPreview.startsWith('<!doctype') || lowerPreview.startsWith('<html')) {
      throw new Error('Lead search returned a server page instead of JSON. Refresh and try again.');
    }

    throw new Error(fallbackMessage);
  }
};

const MessageBanner: React.FC<{ message: { type: MessageTone; text: string } | null }> = ({ message }) => {
  if (!message) return null;

  const className =
    message.type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : message.type === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-800'
        : 'border-sky-200 bg-sky-50 text-sky-800';

  return <div className={`rounded-lg border px-4 py-3 text-sm ${className}`}>{message.text}</div>;
};

interface PipeListsLoginProps {
  authReady: boolean;
  authMessage: { type: MessageTone; text: string } | null;
  magicEmail: string;
  sendingMagicLink: boolean;
  onMagicEmailChange: (email: string) => void;
  onGoogleSignIn: () => void;
  onSendMagicLink: () => void;
}

const PipeListsLogin: React.FC<PipeListsLoginProps> = ({
  authReady,
  authMessage,
  magicEmail,
  sendingMagicLink,
  onMagicEmailChange,
  onGoogleSignIn,
  onSendMagicLink,
}) => (
  <main className="min-h-screen bg-[#FAFAF7] text-stone-900">
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <nav className="flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-3" aria-label="Pulse home">
          <img src="/pulse-logo.svg" alt="Pulse" className="h-8" />
          <span className="hidden text-sm font-medium text-stone-500 sm:inline">PipeLists</span>
        </Link>
        <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-500 shadow-sm">
          Private RevOps
        </span>
      </nav>

      <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold uppercase text-stone-500 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Pulse Intelligence Labs
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-normal text-stone-950 sm:text-5xl lg:text-6xl">
            Your pipeline command center.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-stone-500 sm:text-lg">
            Sign in to manage your PipeLists or open the lists someone shared with your account.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ['Flexible Lists', 'Track investors, grants, partners, contracts, or custom lists.'],
              ['Focused Details', 'Open each lead to review notes, next steps, dates, and context.'],
              ['Metrics View', 'Simple list totals, logs, due dates, and status signals.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-stone-950">{title}</p>
                <p className="mt-2 text-sm leading-6 text-stone-500">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-stone-950">Sign in to PipeLists</h2>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              Data is stored in the same Firebase project as SimpBudget under your account.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={!authReady}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-stone-100" />
              <span className="text-xs font-semibold uppercase text-stone-400">or</span>
              <div className="h-px flex-1 bg-stone-100" />
            </div>

            <label className="block" htmlFor="pipelists-magic-email">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Email magic link</span>
              <input
                id="pipelists-magic-email"
                type="email"
                value={magicEmail}
                onChange={(event) => onMagicEmailChange(event.target.value)}
                className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                placeholder={TREMAINE_OWNER_EMAIL}
              />
            </label>

            <button
              type="button"
              onClick={onSendMagicLink}
              disabled={!authReady || sendingMagicLink}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mail className="h-4 w-4" />
              {sendingMagicLink ? 'Sending...' : 'Send Magic Link'}
            </button>

            <MessageBanner message={authMessage} />

            <p className="text-xs leading-5 text-stone-400">
              Owners see their full workspace. Collaborators only see the PipeLists shared with their email.
            </p>
          </div>
        </div>
      </section>
    </div>
  </main>
);

interface ProfileSetupProps {
  user: User;
  profileName: string;
  profilePhotoFile: File | null;
  saving: boolean;
  message: { type: MessageTone; text: string } | null;
  onProfileNameChange: (name: string) => void;
  onProfilePhotoFileChange: (file: File | null) => void;
  onSave: () => void;
  onSignOut: () => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({
  user,
  profileName,
  profilePhotoFile,
  saving,
  message,
  onProfileNameChange,
  onProfilePhotoFileChange,
  onSave,
  onSignOut,
}) => (
  <main className="flex min-h-screen items-center justify-center bg-[#FAFAF7] px-4 py-8 text-stone-900">
    <div className="w-full max-w-lg rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <Link href="/" className="mb-6 flex items-center gap-3" aria-label="Pulse home">
          <img src="/pulse-logo.svg" alt="Pulse" className="h-8" />
          <span className="text-sm font-medium text-stone-500">PipeLists</span>
        </Link>
        <h1 className="text-2xl font-bold text-stone-950">Finish your editor profile</h1>
        <p className="mt-2 text-sm leading-6 text-stone-500">
          You are signed in as {user.email}. Add a name so shared-list edits have a human attached.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block" htmlFor="pipelists-profile-name">
          <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Name</span>
          <input
            id="pipelists-profile-name"
            value={profileName}
            onChange={(event) => onProfileNameChange(event.target.value)}
            className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
            placeholder="Your name"
          />
        </label>

        <label className="block" htmlFor="pipelists-profile-photo">
          <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Profile image</span>
          <input
            id="pipelists-profile-photo"
            type="file"
            accept="image/*"
            onChange={(event) => onProfilePhotoFileChange(event.target.files?.[0] || null)}
            className="block w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm text-stone-600 file:mr-3 file:rounded-full file:border-0 file:bg-stone-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
          {profilePhotoFile && <p className="mt-2 text-xs text-stone-400">{profilePhotoFile.name}</p>}
        </label>

        <MessageBanner message={message} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-11 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  </main>
);

const PipelinePage: NextPage = () => {
  const [lists, setLists] = useState<PipeList[]>(initialLists);
  const [activeListId, setActiveListId] = useState(initialLists[0].id);
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [newListName, setNewListName] = useState('');
  const [newListTemplateKey, setNewListTemplateKey] = useState<TemplateKey>('university-pilot');
  const [isDeleteListModalOpen, setIsDeleteListModalOpen] = useState(false);
  const [draft, setDraft] = useState<ItemDraft>(defaultDraft(initialLists[0].stages[0].id));
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isNewListModalOpen, setIsNewListModalOpen] = useState(false);
  const [isLeadUrlModalOpen, setIsLeadUrlModalOpen] = useState(false);
  const [leadUrl, setLeadUrl] = useState('');
  const [isAnalyzingLead, setIsAnalyzingLead] = useState(false);
  const [leadExtractMessage, setLeadExtractMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [isLeadGenModalOpen, setIsLeadGenModalOpen] = useState(false);
  const [leadSearchBrief, setLeadSearchBrief] = useState<LeadSearchBrief>(() => defaultLeadSearchBrief(initialLists[0]));
  const [isGeneratingLeads, setIsGeneratingLeads] = useState(false);
  const [generatedLeads, setGeneratedLeads] = useState<GeneratedLead[]>([]);
  const [addedGeneratedLeadKeys, setAddedGeneratedLeadKeys] = useState<string[]>([]);
  const [leadGenMessage, setLeadGenMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [isPastedLeadListModalOpen, setIsPastedLeadListModalOpen] = useState(false);
  const [pastedLeadList, setPastedLeadList] = useState('');
  const [isAnalyzingPastedLeadList, setIsAnalyzingPastedLeadList] = useState(false);
  const [analyzedPastedLeads, setAnalyzedPastedLeads] = useState<GeneratedLead[]>([]);
  const [addedPastedLeadKeys, setAddedPastedLeadKeys] = useState<string[]>([]);
  const [pastedLeadListMessage, setPastedLeadListMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [isImportingFriends, setIsImportingFriends] = useState(false);
  const [friendsImportMessage, setFriendsImportMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [isContactEmailModalOpen, setIsContactEmailModalOpen] = useState(false);
  const [contactEmailType, setContactEmailType] = useState<ContactEmailType>('metrics-update');
  const [contactEmailRecipients, setContactEmailRecipients] = useState('');
  const [contactEmailSubject, setContactEmailSubject] = useState('');
  const [contactEmailBody, setContactEmailBody] = useState('');
  const [contactEmailBodyHtml, setContactEmailBodyHtml] = useState('');
  const [contactEmailAttachments, setContactEmailAttachments] = useState<ContactEmailAttachment[]>([]);
  const [contactEmailSendMessage, setContactEmailSendMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [isSendingContactEmail, setIsSendingContactEmail] = useState(false);
  const [composerLinkPopover, setComposerLinkPopover] = useState<{ left: number; top: number; url: string; error: string } | null>(null);
  const contactEmailBodyEditorRef = useRef<HTMLDivElement | null>(null);
  const contactEmailSelectionRef = useRef<Range | null>(null);
  const emailStatusSyncCheckedAtRef = useRef<Map<string, number>>(new Map());
  const autoImportedFriendsListIds = useRef<Set<string>>(new Set());
  const [isEnrichingVcSources, setIsEnrichingVcSources] = useState(false);
  const [vcSourceEnrichmentMessage, setVcSourceEnrichmentMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [leadCopyMessage, setLeadCopyMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [attachmentLinkName, setAttachmentLinkName] = useState('');
  const [attachmentLinkUrl, setAttachmentLinkUrl] = useState('');
  const [attachmentMessage, setAttachmentMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [leadShareMessage, setLeadShareMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [leadShareUrl, setLeadShareUrl] = useState('');
  const [leadMoveMessage, setLeadMoveMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [moveTargetListId, setMoveTargetListId] = useState('');
  const [contactEmailInput, setContactEmailInput] = useState('');
  const [contactEmailError, setContactEmailError] = useState('');
  const [selectedDetailItemId, setSelectedDetailItemId] = useState<string>('');
  const [detailModalMode, setDetailModalMode] = useState<DetailModalMode>('details');
  const [itemResearchPrompt, setItemResearchPrompt] = useState('');
  const [isResearchingItem, setIsResearchingItem] = useState(false);
  const [itemResearchResult, setItemResearchResult] = useState<GeneratedLead | null>(null);
  const [itemResearchMessage, setItemResearchMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [selectedLogItemId, setSelectedLogItemId] = useState<string>('');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(() => new Set());
  const [logListFilter, setLogListFilter] = useState<string>('all');
  const [logEmailFilter, setLogEmailFilter] = useState<LogEmailFilter>('all');
  const [logRecipientFilter, setLogRecipientFilter] = useState<string>('');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logTargetListId, setLogTargetListId] = useState<string>(initialLists[0].id);
  const [logTargetItemId, setLogTargetItemId] = useState<string>(initialLists[0].items[0]?.id || '');
  const [logDraft, setLogDraft] = useState<ActivityLogDraft>(defaultLogDraft(initialLists[0].templateKey));
  const [nextStepTooltip, setNextStepTooltip] = useState<NextStepTooltip | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [appMessage, setAppMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [magicEmail, setMagicEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('share') || params.get('leadShare')) return '';
    }
    return TREMAINE_OWNER_EMAIL;
  });
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [savingToCloud, setSavingToCloud] = useState(false);
  const [shareId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('share') || '';
  });
  const [inviteId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('invite') || '';
  });
  const [inviteEmail] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('inviteEmail')?.trim().toLowerCase() || '';
  });
  const [leadShareId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('leadShare') || '';
  });
  const [shareDoc, setShareDoc] = useState<PipeListShare | null>(null);
  const [ownerShareDocs, setOwnerShareDocs] = useState<PipeListShare[]>([]);
  const [accessibleShareDocs, setAccessibleShareDocs] = useState<PipeListShare[]>([]);
  const [leadShareDoc, setLeadShareDoc] = useState<PipeLeadShare | null>(null);
  const [shareMessage, setShareMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [shareAccess, setShareAccess] = useState<ShareAccess>('read');
  const [shareEditorEmails, setShareEditorEmails] = useState('');
  const [shareSelectedListIds, setShareSelectedListIds] = useState<string[]>([]);
  const [collaboratorSearch, setCollaboratorSearch] = useState('');
  const [profileSearchMessage, setProfileSearchMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [searchableProfiles, setSearchableProfiles] = useState<SearchablePipeListProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [resendingInviteEmails, setResendingInviteEmails] = useState<string[]>([]);
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const [profile, setProfile] = useState<PipeListProfile | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profileMessage, setProfileMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const normalizedUserEmail = user?.email?.toLowerCase() || '';
  const isLeadSharedView = Boolean(leadShareId);
  const isSharedView = Boolean(shareId || leadShareId);
  const isOwner = normalizedUserEmail === TREMAINE_OWNER_EMAIL;
  const activeList = useMemo(
    () => lists.find((list) => list.id === activeListId) || lists[0] || initialLists[0],
    [activeListId, lists],
  );
  const editableListIds = useMemo(() => {
    if (!normalizedUserEmail) return new Set<string>();
    return new Set(
      accessibleShareDocs
        .filter((share) => share.editorEmails.includes(normalizedUserEmail) || share.ownerEmail.toLowerCase() === normalizedUserEmail)
        .map((share) => share.list.id),
    );
  }, [accessibleShareDocs, normalizedUserEmail]);
  const sharedListIds = useMemo(
    () => new Set(accessibleShareDocs.map((share) => share.list.id)),
    [accessibleShareDocs],
  );
  const activeDashboardShare = !isSharedView && !isOwner
    ? accessibleShareDocs.find((share) => share.list.id === activeList.id) || null
    : null;
  const canEditShared =
    Boolean(shareId) &&
    !!user &&
    !!shareDoc &&
    (shareDoc.ownerUid === user.uid ||
      shareDoc.ownerEmail.toLowerCase() === normalizedUserEmail ||
      shareDoc.editorEmails.map((email) => email.toLowerCase()).includes(normalizedUserEmail));
  const canModify = isSharedView ? canEditShared : !sharedListIds.has(activeList.id) || editableListIds.has(activeList.id);
  const canManageWorkspace = !isSharedView && Boolean(user);
  const canManageActiveList = canManageWorkspace && !sharedListIds.has(activeList.id);
  const isContactListActive = isContactList(activeList);
  const isInvestorUpdateContactsList = isInvestorUpdateContactList(activeList);

  useEffect(() => {
    if (!toastMessage) return undefined;

    const timeout = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(simpBudgetAuth, async (currentUser) => {
      setAuthReady(true);
      setUser(currentUser);

      if (shareId || leadShareId) {
        if (!currentUser) {
          setProfile(null);
          setProfileName('');
          return;
        }

        if (leadShareId) return;

        try {
          const profileRef = doc(simpBudgetDb, PIPELIST_PROFILES_COLLECTION, currentUser.uid);
          const profileSnapshot = await getDoc(profileRef);
          if (profileSnapshot.exists()) {
            const nextProfile = profileSnapshot.data() as PipeListProfile;
            setProfile(nextProfile);
            setProfileName(nextProfile.displayName || currentUser.displayName || '');
          } else {
            setProfile(null);
            setProfileName(currentUser.displayName || '');
          }
        } catch (error) {
          console.error('Unable to load PipeLists profile:', error);
          setProfile(null);
          setProfileName(currentUser.displayName || '');
        }
        return;
      }

      if (!currentUser) {
        setDataReady(false);
        setAccessibleShareDocs([]);
        return;
      }

      const email = currentUser.email?.toLowerCase() || '';

      try {
        await setDoc(
          doc(simpBudgetDb, SIMPBUDGET_USERS_COLLECTION, currentUser.uid),
          {
            email: currentUser.email || '',
            displayName: currentUser.displayName || '',
            lastSeenAt: serverTimestamp(),
          },
          { merge: true },
        );

        await setDoc(
          doc(simpBudgetDb, PIPELIST_PROFILES_COLLECTION, currentUser.uid),
          stripUndefined({
            email: currentUser.email || '',
            displayName: currentUser.displayName || '',
            photoURL: currentUser.photoURL || '',
            updatedAt: serverTimestamp(),
          }),
          { merge: true },
        );

        const stateRef = doc(
          simpBudgetDb,
          SIMPBUDGET_USERS_COLLECTION,
          currentUser.uid,
          PIPELISTS_SUBCOLLECTION,
          PIPELISTS_STATE_DOCUMENT_ID,
        );
        const snapshot = await getDoc(stateRef);
        let privateLists: PipeList[] = isOwner ? initialLists : [];

        if (snapshot.exists()) {
          const data = snapshot.data() as { lists?: Partial<PipeList>[] };
          if (Array.isArray(data.lists) && data.lists.length > 0) {
            privateLists = purgeExpiredDeletedItems(data.lists.map(normalizeList));
          }
        } else if (isOwner && typeof window !== 'undefined') {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          if (stored) {
            try {
              const parsed = JSON.parse(stored) as Partial<PipeList>[];
              if (Array.isArray(parsed) && parsed.length > 0) {
                privateLists = purgeExpiredDeletedItems(parsed.map(normalizeList));
              }
            } catch (error) {
              console.warn('[PipeLists] Unable to parse stored local pipeline data:', error);
            }
          }
        }

        if (isOwner) {
          privateLists = mergeRecommendedPitchCompetitions(privateLists);
        }

        let nextShares: PipeListShare[] = [];

        if (!isOwner) {
          const sharesById = new Map<string, PipeListShare>();
          const sharesRef = collection(simpBudgetDb, PIPELIST_SHARES_COLLECTION);
          const [viewerSnapshot, editorSnapshot] = await Promise.all([
            getDocs(
              firestoreQuery(
                sharesRef,
                where('viewerEmails', 'array-contains', email),
                where('publicRead', '==', true),
              ),
            ),
            getDocs(
              firestoreQuery(
                sharesRef,
                where('editorEmails', 'array-contains', email),
                where('access', '==', 'edit'),
              ),
            ),
          ]);

          [...viewerSnapshot.docs, ...editorSnapshot.docs].forEach((shareSnapshot, index) => {
            const normalizedShare = normalizePipeListShare(shareSnapshot.id, shareSnapshot.data() as Partial<PipeListShare>, index);
            if (normalizedShare?.publicRead) sharesById.set(normalizedShare.id, normalizedShare);
          });

          nextShares = Array.from(sharesById.values());
        }

        let nextLists = [
          ...privateLists,
          ...nextShares
            .filter((share) => !privateLists.some((privateList) => privateList.id === share.list.id))
            .map((share) => share.list),
        ];

        if (nextLists.length === 0) {
          nextLists = [{ ...createList('vc', 'My PipeList', 0), items: [] }];
        }

        setAccessibleShareDocs(nextShares);
        setLists(nextLists);
        setActiveListId(nextLists[0]?.id || initialLists[0].id);
        setDraft(defaultDraft(nextLists[0]?.stages[0]?.id || initialLists[0].stages[0].id));
        setSelectedLogItemId('');
        setLogDraft(defaultLogDraft(nextLists[0]?.templateKey || initialLists[0].templateKey));
        setSelectedDetailItemId('');
        setDataReady(true);
        setAppMessage(null);
      } catch (error) {
        console.error('Unable to initialize PipeLists:', error);
        setDataReady(false);
        setAppMessage({
          type: 'error',
          text: readFirestoreError(error, 'Unable to initialize PipeLists.'),
        });
      }
    });

    return unsubscribe;
  }, [leadShareId, shareId]);

  useEffect(() => {
    if (isSharedView || shareId || leadShareId || !isOwner || !user || !dataReady) return undefined;

    const stateRef = doc(
      simpBudgetDb,
      SIMPBUDGET_USERS_COLLECTION,
      user.uid,
      PIPELISTS_SUBCOLLECTION,
      PIPELISTS_STATE_DOCUMENT_ID,
    );

    return onSnapshot(
      stateRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data() as { lists?: Partial<PipeList>[] };
        if (!Array.isArray(data.lists) || data.lists.length === 0) return;

        const nextLists = mergeRecommendedPitchCompetitions(
          purgeExpiredDeletedItems(data.lists.map(normalizeList)),
        );

        setLists((currentLists) => {
          if (JSON.stringify(currentLists) === JSON.stringify(nextLists)) return currentLists;
          return nextLists;
        });
        setActiveListId((currentId) =>
          nextLists.some((list) => list.id === currentId) ? currentId : nextLists[0]?.id || initialLists[0].id,
        );
      },
      (error) => {
        console.warn('[PipeLists] Live email status sync failed:', error);
      },
    );
  }, [dataReady, isOwner, isSharedView, leadShareId, shareId, user]);

  useEffect(() => {
    if (!shareId) return;

    const loadShare = async () => {
      setDataReady(false);
      setShareMessage(null);

      try {
        const shareRef = doc(simpBudgetDb, PIPELIST_SHARES_COLLECTION, shareId);
        const snapshot = await getDoc(shareRef);
        if (!snapshot.exists()) {
          setShareMessage({ type: 'error', text: 'This PipeLists share link was not found.' });
          setDataReady(true);
          return;
        }

        const data = snapshot.data() as Partial<PipeListShare>;
        if (!data.publicRead || !data.list) {
          setShareMessage({ type: 'error', text: 'This PipeLists share link is not available.' });
          setDataReady(true);
          return;
        }

        const nextShare = normalizePipeListShare(snapshot.id, data, 0);
        if (!nextShare) {
          setShareMessage({ type: 'error', text: 'This PipeLists share link is not available.' });
          setDataReady(true);
          return;
        }
        const normalizedList = purgeExpiredDeletedItems([nextShare.list])[0];

        setShareDoc({ ...nextShare, list: normalizedList });
        setLists([normalizedList]);
        setActiveListId(normalizedList.id);
        setDraft(defaultDraft(normalizedList.stages[0]?.id));
        setSelectedLogItemId('');
        setLogDraft(defaultLogDraft(normalizedList.templateKey));
        setSelectedDetailItemId('');
        setDataReady(true);
      } catch (error) {
        console.error('Unable to load shared PipeList:', error);
        setShareMessage({
          type: 'error',
          text: readFirestoreError(error, 'Unable to load this shared PipeList.'),
        });
        setDataReady(true);
      }
    };

    loadShare();
  }, [shareId]);

  useEffect(() => {
    if (!leadShareId) return;

    const loadLeadShare = async () => {
      setDataReady(false);
      setShareMessage(null);

      try {
        const shareRef = doc(simpBudgetDb, PIPELEAD_SHARES_COLLECTION, leadShareId);
        const snapshot = await getDoc(shareRef);
        if (!snapshot.exists()) {
          setShareMessage({ type: 'error', text: 'This lead share link was not found.' });
          setDataReady(true);
          return;
        }

        const data = snapshot.data() as Partial<PipeLeadShare>;
        if (!data.publicRead || !data.list) {
          setShareMessage({ type: 'error', text: 'This lead share link is not available.' });
          setDataReady(true);
          return;
        }

        const normalizedList = purgeExpiredDeletedItems([normalizeList(data.list, 0)])[0];
        const normalizedItem =
          normalizedList.items.find((item) => item.id === data.itemId) || normalizedList.items[0] || null;
        if (!normalizedItem) {
          setShareMessage({ type: 'error', text: 'This lead share does not include a readable lead.' });
          setDataReady(true);
          return;
        }

        const nextShare: PipeLeadShare = {
          id: snapshot.id,
          ownerUid: data.ownerUid || '',
          ownerEmail: data.ownerEmail || '',
          listId: data.listId || normalizedList.id,
          itemId: normalizedItem.id,
          list: normalizedList,
          publicRead: data.publicRead === true,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };

        setLeadShareDoc(nextShare);
        setLists([normalizedList]);
        setActiveListId(normalizedList.id);
        setDraft(defaultDraft(normalizedList.stages[0]?.id));
        setSelectedLogItemId(normalizedItem.id);
        setLogDraft(defaultLogDraft(normalizedList.templateKey));
        setSelectedDetailItemId(normalizedItem.id);
        setDetailModalMode('details');
        setDataReady(true);
      } catch (error) {
        console.error('Unable to load shared PipeList lead:', error);
        setShareMessage({
          type: 'error',
          text: readFirestoreError(error, 'Unable to load this shared lead.'),
        });
        setDataReady(true);
      }
    };

    loadLeadShare();
  }, [leadShareId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const completeGoogleRedirectSignIn = async () => {
      try {
        const result = await getRedirectResult(simpBudgetAuth);
        if (!result?.user) return;

        const email = result.user.email?.toLowerCase() || '';
        if (
          isSharedView &&
          shareDoc?.access === 'edit' &&
          email !== shareDoc.ownerEmail.toLowerCase() &&
          !shareDoc.editorEmails.map((editorEmail) => editorEmail.toLowerCase()).includes(email)
        ) {
          setAuthMessage({
            type: 'info',
            text: 'You are signed in and can view this list, but this email was not granted edit access.',
          });
        }
      } catch (error) {
        console.error('PipeLists Google redirect sign-in failed:', error);
        setAuthMessage({
          type: 'error',
          text: readAuthError(error, 'Unable to finish Google sign-in.'),
        });
      }
    };

    completeGoogleRedirectSignIn();
  }, [isSharedView, shareDoc]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isSignInWithEmailLink(simpBudgetAuth, window.location.href)) return;

    const completeEmailLinkSignIn = async () => {
      const storedEmail = window.localStorage.getItem(MAGIC_LINK_EMAIL_STORAGE_KEY);
      const urlParams = new URLSearchParams(window.location.search);
      const inviteEmail = urlParams.get('inviteEmail')?.trim().toLowerCase() || '';
      const email = storedEmail || inviteEmail || window.prompt('Confirm your email for PipeLists sign-in') || '';
      if (!email) return;

      try {
        await signInWithEmailLink(simpBudgetAuth, email, window.location.href);
        window.localStorage.removeItem(MAGIC_LINK_EMAIL_STORAGE_KEY);
        setAuthMessage({ type: 'success', text: 'Signed in with magic link.' });
      } catch (error) {
        console.error('PipeLists magic link sign-in failed:', error);
        setAuthMessage({
          type: 'error',
          text: readAuthError(error, 'Unable to finish magic link sign-in.'),
        });
      }
    };

    completeEmailLinkSignIn();
  }, []);

  useEffect(() => {
    if (!user || (!inviteId && !inviteEmail)) return;

    let cancelled = false;

    const markInviteAccepted = async () => {
      const acceptedEmail = (inviteEmail || user.email || '').trim().toLowerCase();
      if (!acceptedEmail) return;

      try {
        const inviteSnapshot = inviteId ? await getDoc(doc(simpBudgetDb, PIPELIST_SHARES_COLLECTION, inviteId)) : null;
        const inviteOwnerUid = inviteSnapshot?.exists() ? (inviteSnapshot.data() as Partial<PipeListShare>).ownerUid || '' : '';
        const [viewerSnapshots, editorSnapshots] = await Promise.all([
          getDocs(
            firestoreQuery(collection(simpBudgetDb, PIPELIST_SHARES_COLLECTION), where('viewerEmails', 'array-contains', acceptedEmail)),
          ),
          getDocs(
            firestoreQuery(collection(simpBudgetDb, PIPELIST_SHARES_COLLECTION), where('editorEmails', 'array-contains', acceptedEmail)),
          ),
        ]);
        const shareSnapshots = new Map(
          [...viewerSnapshots.docs, ...editorSnapshots.docs]
            .filter((snapshot) => !inviteOwnerUid || (snapshot.data() as Partial<PipeListShare>).ownerUid === inviteOwnerUid)
            .map((snapshot) => [snapshot.id, snapshot]),
        );

        await Promise.all(
          Array.from(shareSnapshots.values()).map((shareSnapshot) =>
            setDoc(
              doc(simpBudgetDb, PIPELIST_SHARES_COLLECTION, shareSnapshot.id),
              stripUndefined({
                inviteStatuses: {
                  [acceptedEmail]: {
                    email: acceptedEmail,
                    access: normalizeShareEmails(shareSnapshot.data().editorEmails).includes(acceptedEmail) ? 'edit' : 'read',
                    status: 'accepted',
                    inviteId: inviteId || undefined,
                    acceptedAt: serverTimestamp(),
                  },
                },
                updatedAt: serverTimestamp(),
              }),
              { merge: true },
            ),
          ),
        );

        if (!cancelled && shareSnapshots.size > 0) {
          setAuthMessage({ type: 'success', text: 'Invite accepted. Your shared PipeLists are ready.' });
        }
      } catch (error) {
        console.error('Unable to mark PipeLists invite accepted:', error);
      }
    };

    markInviteAccepted();

    return () => {
      cancelled = true;
    };
  }, [inviteEmail, inviteId, user]);

  useEffect(() => {
    if (isSharedView) return;
    if (!user || !dataReady) return;

    let cancelled = false;

    const saveLists = async () => {
      setSavingToCloud(true);

      try {
        const listsToPersist = purgeExpiredDeletedItems(lists.filter((list) => !sharedListIds.has(list.id)));
        if (isOwner && JSON.stringify(listsToPersist) !== JSON.stringify(lists)) {
          setLists(listsToPersist);
        }
        const stateRef = doc(
          simpBudgetDb,
          SIMPBUDGET_USERS_COLLECTION,
          user.uid,
          PIPELISTS_SUBCOLLECTION,
          PIPELISTS_STATE_DOCUMENT_ID,
        );
        await setDoc(
          stateRef,
          stripUndefined({
            ownerEmail: user.email || '',
            lists: listsToPersist,
            updatedAt: serverTimestamp(),
          }),
          { merge: true },
        );

        if (isOwner && typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listsToPersist));
        }

        if (!cancelled) setAppMessage(null);
      } catch (error) {
        console.error('Unable to save PipeLists:', error);
        if (!cancelled) {
          setAppMessage({
            type: 'error',
            text: readFirestoreError(error, 'Unable to save PipeLists.'),
          });
        }
      } finally {
        if (!cancelled) setSavingToCloud(false);
      }
    };

    saveLists();

    return () => {
      cancelled = true;
    };
  }, [dataReady, isOwner, isSharedView, lists, sharedListIds, user]);

  useEffect(() => {
    if (!shareId || !shareDoc || !dataReady || !canEditShared) return;

    let cancelled = false;

    const saveSharedList = async () => {
      setSavingToCloud(true);

      try {
        const nextList = purgeExpiredDeletedItems(lists)[0];
        if (!nextList) return;

        const shareRef = doc(simpBudgetDb, PIPELIST_SHARES_COLLECTION, shareId);
        await setDoc(
          shareRef,
          stripUndefined({
            list: nextList,
            updatedAt: serverTimestamp(),
            lastEditedBy: {
              uid: user?.uid || '',
              email: user?.email || '',
              displayName: profile?.displayName || user?.displayName || '',
              photoURL: profile?.photoURL || user?.photoURL || '',
            },
          }),
          { merge: true },
        );

        if (!cancelled) {
          setShareDoc((current) => (current ? { ...current, list: nextList } : current));
          setShareMessage(null);
        }
      } catch (error) {
        console.error('Unable to save shared PipeList:', error);
        if (!cancelled) {
          setShareMessage({
            type: 'error',
            text: readFirestoreError(error, 'Unable to save shared PipeList.'),
          });
        }
      } finally {
        if (!cancelled) setSavingToCloud(false);
      }
    };

    saveSharedList();

    return () => {
      cancelled = true;
    };
  }, [canEditShared, dataReady, lists, profile, shareDoc, shareId, user]);

  useEffect(() => {
    if (isSharedView || isOwner || !user || !dataReady || accessibleShareDocs.length === 0) return;

    const editableShares = accessibleShareDocs.filter((share) => share.editorEmails.includes(normalizedUserEmail));
    if (editableShares.length === 0) return;

    let cancelled = false;

    const saveAccessibleSharedLists = async () => {
      setSavingToCloud(true);

      try {
        await Promise.all(
          editableShares.map((share) => {
            const nextList = lists.find((list) => list.id === share.list.id);
            if (!nextList) return Promise.resolve();

            return setDoc(
              doc(simpBudgetDb, PIPELIST_SHARES_COLLECTION, share.id),
              stripUndefined({
                list: nextList,
                updatedAt: serverTimestamp(),
                lastEditedBy: {
                  uid: user.uid,
                  email: user.email || '',
                  displayName: profile?.displayName || user.displayName || '',
                  photoURL: profile?.photoURL || user.photoURL || '',
                },
              }),
              { merge: true },
            );
          }),
        );

        if (!cancelled) setAppMessage(null);
      } catch (error) {
        console.error('Unable to save collaborator PipeLists:', error);
        if (!cancelled) {
          setAppMessage({
            type: 'error',
            text: readFirestoreError(error, 'Unable to save shared PipeList changes.'),
          });
        }
      } finally {
        if (!cancelled) setSavingToCloud(false);
      }
    };

    saveAccessibleSharedLists();

    return () => {
      cancelled = true;
    };
  }, [accessibleShareDocs, dataReady, isOwner, isSharedView, lists, normalizedUserEmail, profile, user]);

  const leadSearchPromptPreview = useMemo(() => buildLeadSearchPrompt(leadSearchBrief), [leadSearchBrief]);
  const persistLeadSearchBrief = (brief: LeadSearchBrief = leadSearchBrief) => {
    const normalizedBrief = normalizeLeadSearchBrief(brief, activeList);

    setLeadSearchBrief(normalizedBrief);
    setLists((currentLists) =>
      currentLists.map((list) =>
        list.id === activeList.id
          ? {
              ...list,
              searchBrief: normalizedBrief,
            }
          : list,
      ),
    );

    return normalizedBrief;
  };
  const updateLeadSearchBrief = <Key extends keyof LeadSearchBrief>(field: Key, value: LeadSearchBrief[Key]) => {
    setLeadSearchBrief((currentBrief) => ({
      ...currentBrief,
      [field]: value,
    }));
  };
  const updateAndPersistLeadSearchBrief = <Key extends keyof LeadSearchBrief>(field: Key, value: LeadSearchBrief[Key]) => {
    persistLeadSearchBrief({
      ...leadSearchBrief,
      [field]: value,
    });
  };
  const ownerShareId = !isSharedView && user ? shareDocumentIdForList(user.uid, activeList.id) : '';

  useEffect(() => {
    if (isSharedView || !user || !isOwner || !dataReady || !activeList?.id) return;

    let cancelled = false;

    const loadActiveListShare = async () => {
      const nextShareId = shareDocumentIdForList(user.uid, activeList.id);
      setShareMessage(null);

      try {
        const shareSnapshot = await getDoc(doc(simpBudgetDb, PIPELIST_SHARES_COLLECTION, nextShareId));
        if (!shareSnapshot.exists()) {
          if (!cancelled) {
            setShareDoc(null);
            setShareAccess('read');
            setShareEditorEmails('');
          }
          return;
        }

        const data = shareSnapshot.data() as Partial<PipeListShare>;
        const normalizedShare = normalizePipeListShare(shareSnapshot.id, data, 0);
        if (!cancelled) {
          const fallbackViewerEmails = normalizeShareEmails(data.viewerEmails);
          const fallbackEditorEmails = normalizeShareEmails(data.editorEmails);
          setShareDoc(
            normalizedShare || {
              id: shareSnapshot.id,
              ownerUid: data.ownerUid || user.uid,
              ownerEmail: data.ownerEmail || user.email || TREMAINE_OWNER_EMAIL,
              list: activeList,
              access: data.access === 'edit' ? 'edit' : 'read',
              publicRead: data.publicRead === true,
              viewerEmails: fallbackViewerEmails,
              editorEmails: fallbackEditorEmails,
              inviteStatuses: normalizeInviteStatuses(data.inviteStatuses, fallbackViewerEmails, fallbackEditorEmails),
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            },
          );
          setShareAccess(data.access === 'edit' ? 'edit' : 'read');
          const accountEmails = data.access === 'edit' ? normalizeShareEmails(data.editorEmails) : normalizeShareEmails(data.viewerEmails);
          setShareEditorEmails(accountEmails.join(', '));
        }
      } catch (error) {
        console.error('Unable to load PipeList invite:', error);
        if (!cancelled) {
          setShareDoc(null);
          setShareMessage({
            type: 'error',
            text: readFirestoreError(error, 'Unable to load invite settings for this PipeList.'),
          });
        }
      }
    };

    loadActiveListShare();

    return () => {
      cancelled = true;
    };
  }, [activeList.id, dataReady, isOwner, isSharedView, user]);

  useEffect(() => {
    if (isSharedView || !user || !isOwner || !dataReady || !shareDoc || shareDoc.id !== ownerShareId) return;

    let cancelled = false;

    const syncSharedListSnapshot = async () => {
      try {
        await setDoc(
          doc(simpBudgetDb, PIPELIST_SHARES_COLLECTION, shareDoc.id),
          stripUndefined({
            list: activeList,
            updatedAt: serverTimestamp(),
          }),
          { merge: true },
        );

        if (!cancelled) {
          setShareDoc((current) => (current && current.id === shareDoc.id ? { ...current, list: activeList } : current));
        }
      } catch (error) {
        console.error('Unable to sync PipeList invite:', error);
      }
    };

    syncSharedListSnapshot();

    return () => {
      cancelled = true;
    };
  }, [activeList, dataReady, isOwner, isSharedView, ownerShareId, shareDoc?.id, user]);

  useEffect(() => {
    if (isSharedView || !user || !isOwner || !isSharePanelOpen) return;

    let cancelled = false;

    const loadOwnerInviteHistory = async () => {
      try {
        const shareSnapshots = await getDocs(
          firestoreQuery(collection(simpBudgetDb, PIPELIST_SHARES_COLLECTION), where('ownerUid', '==', user.uid)),
        );
        const shares = shareSnapshots.docs
          .map((shareSnapshot, index) => normalizePipeListShare(shareSnapshot.id, shareSnapshot.data() as Partial<PipeListShare>, index))
          .filter((share): share is PipeListShare => Boolean(share));

        if (!cancelled) setOwnerShareDocs(shares);
      } catch (error) {
        console.error('Unable to load PipeLists invite history:', error);
        if (!cancelled) {
          setShareMessage({
            type: 'error',
            text: readFirestoreError(error, 'Unable to load invite history.'),
          });
        }
      }
    };

    loadOwnerInviteHistory();

    return () => {
      cancelled = true;
    };
  }, [isOwner, isSharePanelOpen, isSharedView, user]);

  const allItemRows = useMemo(
    () => lists.flatMap((list) => list.items.map((item) => ({ list, item }))),
    [lists],
  );

  const allRows = useMemo(
    () => allItemRows.filter(({ item }) => !isItemDeleted(item)),
    [allItemRows],
  );

  const activeListItems = useMemo(
    () => activeList.items.filter((item) => !isItemDeleted(item)),
    [activeList.items],
  );
  const activeContactEmails = useMemo(
    () => Array.from(new Set(activeListItems.flatMap((item) => normalizeContactEmails(item.contactEmails)))),
    [activeListItems],
  );
  const missingVcSourceItems = useMemo(
    () =>
      activeList.templateKey === 'vc'
        ? activeListItems.filter((item) => !item.sourceUrl.trim())
        : [],
    [activeList.templateKey, activeListItems],
  );
  const activeLeadKeys = useMemo(
    () =>
      new Set(
        activeListItems.flatMap((item) =>
          [
            normalizeOpportunityKey(`${item.title} ${item.organization}`),
            item.sourceUrl ? normalizeOpportunityKey(item.sourceUrl) : '',
          ].filter(Boolean),
        ),
      ),
    [activeListItems],
  );

  const allLogRows = useMemo(
    () =>
      allItemRows
        .flatMap(({ list, item }) =>
          item.weeklyLogs.map((log) => ({
            list,
            item,
            log,
          })),
        )
        .sort((left, right) => logTimestampMs(right.log) - logTimestampMs(left.log)),
    [allItemRows],
  );

  const filteredLogRows = useMemo(
    () =>
      allLogRows.filter(({ list, log }) => {
        const matchesList = logListFilter === 'all' || list.id === logListFilter;
        if (!matchesList) return false;

        const matchesEmailType = logEmailFilter === 'all' || emailFilterForLog(log) === logEmailFilter;
        if (!matchesEmailType) return false;

        const recipient = logRecipientFilter.trim().toLowerCase();
        if (!recipient) return true;
        const details = parseEmailLogNotes(log.notes || '');
        return details.to.toLowerCase() === recipient;
      }),
    [allLogRows, logEmailFilter, logListFilter, logRecipientFilter],
  );

  const logTargetList = lists.find((list) => list.id === logTargetListId) || activeList;
  const logTargetListItems = logTargetList.items.filter((item) => !isItemDeleted(item));
  const logTargetItem = logTargetListItems.find((item) => item.id === logTargetItemId) || logTargetListItems[0] || null;

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase();

    const dueTime = (item: PipelineItem) => {
      const dateValue = item.expectedCloseDate || item.dueDate || item.pilotEnd;
      if (!dateValue) return Number.POSITIVE_INFINITY;

      const parsed = new Date(`${dateValue}T12:00:00`).getTime();
      return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
    };

    return activeListItems
      .filter((item) => {
        const matchesStage = isInvestorUpdateContactsList || stageFilter === 'all' || item.stage === stageFilter;
        const matchesQuery =
          search.length === 0 ||
          [
            item.title,
            item.organization,
            item.owner,
            item.nextStep,
            item.amount,
            item.acv,
            item.sourceUrl,
            item.segment,
            item.decisionMaker,
            item.notes,
          ]
            .join(' ')
            .toLowerCase()
            .includes(search);

        return matchesStage && matchesQuery;
      })
      .sort((left, right) => {
        const dateDifference = dueTime(left) - dueTime(right);
        if (dateDifference !== 0) return dateDifference;

        return left.title.localeCompare(right.title);
      });
  }, [activeListItems, isInvestorUpdateContactsList, query, stageFilter]);

  const countsByStage = useMemo(
    () =>
      activeList.stages.reduce<Record<string, number>>((accumulator, stage) => {
        accumulator[stage.id] = activeListItems.filter((item) => item.stage === stage.id).length;
        return accumulator;
      }, {}),
    [activeListItems, activeList.stages],
  );

  const activeItems = activeListItems.filter((item) => !isClosedStage(activeList, item.stage)).length;
  const wonItems = activeListItems.filter((item) => isWonStage(activeList, item.stage)).length;
  const loggedItems = activeListItems.filter((item) => item.weeklyLogs.length > 0).length;
  const sentEmailItems = activeListItems.filter((item) =>
    ['request', 'sent', 'delivered', 'opened', 'click', 'clicked'].includes(normalizeEmailStatus(item.emailStatus || item.lastEmailEvent)),
  ).length;
  const deliveredEmailItems = activeListItems.filter((item) =>
    ['delivered', 'opened', 'click', 'clicked'].includes(normalizeEmailStatus(item.emailStatus || item.lastEmailEvent)),
  ).length;
  const openedEmailItems = activeListItems.filter((item) =>
    ['opened', 'click', 'clicked'].includes(normalizeEmailStatus(item.emailStatus || item.lastEmailEvent)),
  ).length;
  const dueSoonItems = activeListItems.filter((item) => {
    const dueDate = item.expectedCloseDate || item.dueDate || item.pilotEnd;
    if (!dueDate) return false;
    const dueTime = new Date(`${dueDate}T12:00:00`).getTime();
    const now = new Date().getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return dueTime >= now - 24 * 60 * 60 * 1000 && dueTime <= now + sevenDays;
  }).length;
  const activeOpenValue = activeListItems
    .filter((item) => !isClosedStage(activeList, item.stage))
    .reduce((sum, item) => sum + itemValue(item), 0);

  const scorecardMetrics = useMemo(() => {
    const openRows = allRows.filter(({ list, item }) => !isClosedStage(list, item.stage));
    const wonRows = allRows.filter(({ list, item }) => isWonStage(list, item.stage));
    const logs = allRows.flatMap(({ item }) => item.weeklyLogs);
    const metricLogs = logs.filter(logHasMetrics);
    const expectedDates = openRows
      .map(({ item }) => item.expectedCloseDate || item.dueDate || item.pilotEnd)
      .filter(Boolean)
      .sort();
    const dueSoonRows = openRows.filter(({ item }) => {
      const dueDate = item.expectedCloseDate || item.dueDate || item.pilotEnd;
      if (!dueDate) return false;
      const dueTime = new Date(`${dueDate}T12:00:00`).getTime();
      const now = new Date().getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      return dueTime >= now - 24 * 60 * 60 * 1000 && dueTime <= now + sevenDays;
    });
    const loggedRows = allRows.filter(({ item }) => item.weeklyLogs.length > 0);

    return {
      totalOpenDeals: openRows.length,
      totalOpenValue: openRows.reduce((sum, row) => sum + itemValue(row.item), 0),
      averageContractValue: average(allRows.map(({ item }) => itemValue(item))),
      firstExpectedCloseDate: expectedDates[0] || '',
      wonRate: allRows.length > 0 ? (wonRows.length / allRows.length) * 100 : 0,
      dueSoon: dueSoonRows.length,
      loggedItems: loggedRows.length,
      totalLogs: logs.length,
      checkInRate: average(metricLogs.map(derivedCheckInRate)),
      biometricSyncRate: average(metricLogs.map((log) => parsePercent(log.biometricSyncRate))),
      signalEvents: metricLogs.reduce((sum, log) => sum + (Number.parseFloat(log.signalEvents) || 0), 0),
      noraEngagementRate: average(metricLogs.map((log) => parsePercent(log.noraEngagementRate))),
      escalations: metricLogs.reduce((sum, log) => sum + (Number.parseFloat(log.escalations) || 0), 0),
      staffScore: average(metricLogs.map((log) => Number.parseFloat(log.staffFeedbackScore))),
    };
  }, [allRows]);

  const selectedLogItem =
    activeListItems.find((item) => item.id === selectedLogItemId) ||
    activeListItems.find((item) => item.weeklyLogs.length > 0 || item.stage.includes('pilot')) ||
    activeListItems[0];

  const selectedDetailItem = activeList.items.find((item) => item.id === selectedDetailItemId) || null;

  useEffect(() => {
    if (selectedDetailItemId && !activeList.items.some((item) => item.id === selectedDetailItemId)) {
      setSelectedDetailItemId('');
      setDetailModalMode('details');
    }
  }, [activeList.items, selectedDetailItemId]);

  const applySyncedEmailStatus = (args: {
    listId: string;
    itemId: string;
    messageId: string;
    summary: SyncedEmailEventSummary;
  }) => {
    const eventAt = args.summary.eventAt || new Date().toISOString();
    const normalizedStatus = normalizeContactEmailStatusInput(args.summary.status);
    if (!normalizedStatus || normalizedStatus === 'sent') return;

    setLists((currentLists) =>
      currentLists.map((list) => {
        if (list.id !== args.listId) return list;

        return {
          ...list,
          items: list.items.map((item) => {
            if (item.id !== args.itemId) return item;
            const currentStatus = normalizeContactEmailStatusInput(item.emailStatus || item.lastEmailEvent);
            if (emailStatusRank(normalizedStatus) < emailStatusRank(currentStatus)) return item;

            const eventLog = buildSyncedEmailEventLog({
              item,
              status: args.summary.status,
              messageId: args.messageId,
              eventAt,
              link: args.summary.link,
            });
            const hasEventLog = item.weeklyLogs.some((log) => log.id === eventLog.id);

            return {
              ...item,
              emailStatus: normalizedStatus,
              lastEmailEvent: normalizedStatus,
              lastEmailEventAt: eventAt,
              lastEmailMessageId: args.messageId,
              lastEmailDeliveredAt:
                normalizedStatus === 'delivered' || normalizedStatus === 'opened' || normalizedStatus === 'clicked'
                  ? item.lastEmailDeliveredAt || eventAt
                  : item.lastEmailDeliveredAt,
              lastEmailOpenedAt:
                normalizedStatus === 'opened' || normalizedStatus === 'clicked' ? eventAt : item.lastEmailOpenedAt,
              lastEmailClickedAt: normalizedStatus === 'clicked' ? eventAt : item.lastEmailClickedAt,
              emailOpenCount:
                normalizedStatus === 'opened' && currentStatus !== 'opened' && currentStatus !== 'clicked'
                  ? Math.max(1, Number(item.emailOpenCount) || 0)
                  : item.emailOpenCount,
              emailClickCount:
                normalizedStatus === 'clicked' && currentStatus !== 'clicked'
                  ? Math.max(1, Number(item.emailClickCount) || 0)
                  : item.emailClickCount,
              lastEmailClickedLink: normalizedStatus === 'clicked' ? args.summary.link || item.lastEmailClickedLink : item.lastEmailClickedLink,
              updatedAt: eventAt,
              weeklyLogs: hasEventLog ? item.weeklyLogs : [eventLog, ...item.weeklyLogs],
            };
          }),
        };
      }),
    );
  };

  useEffect(() => {
    if (!user || !isOwner || isSharedView) return undefined;
    if (viewMode !== 'logs' && detailModalMode !== 'logs') return undefined;

    const candidates = new Map<string, { listId: string; itemId: string; messageId: string }>();
    const addCandidate = (listId: string, item: PipelineItem) => {
      const messageId = item.lastEmailMessageId.trim();
      const status = normalizeContactEmailStatusInput(item.emailStatus || item.lastEmailEvent);
      if (!messageId || emailStatusRank(status) >= emailStatusRank('opened')) return;
      candidates.set(messageId, { listId, itemId: item.id, messageId });
    };

    if (detailModalMode === 'logs' && selectedDetailItem) {
      addCandidate(activeList.id, selectedDetailItem);
    }
    if (viewMode === 'logs') {
      filteredLogRows.forEach(({ list, item }) => addCandidate(list.id, item));
    }

    const now = Date.now();
    const staleAfterMs = 20_000;
    const pending = Array.from(candidates.values())
      .filter((candidate) => now - (emailStatusSyncCheckedAtRef.current.get(candidate.messageId) || 0) > staleAfterMs)
      .slice(0, 8);
    if (pending.length === 0) return undefined;

    let cancelled = false;
    pending.forEach((candidate) => {
      emailStatusSyncCheckedAtRef.current.set(candidate.messageId, now);
    });

    const syncStatuses = async () => {
      const idToken = await user.getIdToken();
      await Promise.all(
        pending.map(async (candidate) => {
          try {
            const response = await fetch('/api/pipelists/check-email-events', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ messageId: candidate.messageId }),
            });
            const result = await response.json().catch(() => ({}));
            if (cancelled || !response.ok || result?.success === false || !result?.summary) return;
            applySyncedEmailStatus({
              ...candidate,
              summary: result.summary as SyncedEmailEventSummary,
            });
          } catch (error) {
            console.warn('[PipeLists] Unable to sync Brevo email status:', error);
          }
        }),
      );
    };

    syncStatuses();

    return () => {
      cancelled = true;
    };
  }, [activeList.id, detailModalMode, filteredLogRows, isOwner, isSharedView, selectedDetailItem, user, viewMode]);

  useEffect(() => {
    if (!selectedDetailItemId) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && detailModalMode !== 'email') {
        setSelectedDetailItemId('');
        setDetailModalMode('details');
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [detailModalMode, selectedDetailItemId]);

  useEffect(() => {
    setLeadCopyMessage(null);
    setAttachmentMessage(null);
    setLeadShareMessage(null);
    setLeadShareUrl('');
    setLeadMoveMessage(null);
    setMoveTargetListId('');
    setAttachmentLinkName('');
    setAttachmentLinkUrl('');
  }, [selectedDetailItemId, detailModalMode]);

  useEffect(() => {
    const editor = contactEmailBodyEditorRef.current;
    if (!editor || (typeof document !== 'undefined' && document.activeElement === editor)) return;
    editor.innerHTML = contactEmailBodyHtml || linkifyComposerBodyHtml(contactEmailBody);
  }, [detailModalMode, isContactEmailModalOpen, selectedDetailItemId]);

  const syncContactEmailComposerState = (editor: HTMLDivElement) => {
    const text = editor.innerText.replace(/\u00a0/g, ' ');
    setContactEmailBody(text);
    setContactEmailBodyHtml(serializeComposerEditorHtml(editor));
  };

  const commitContactEmailComposerState = (editor: HTMLDivElement) => {
    const text = editor.innerText.replace(/\u00a0/g, ' ');
    const html = serializeComposerEditorHtml(editor);
    setContactEmailBody(text);
    setContactEmailBodyHtml(html);
    editor.innerHTML = html;
  };

  const saveContactEmailSelection = () => {
    const editor = contactEmailBodyEditorRef.current;
    if (!editor || typeof window === 'undefined') return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    contactEmailSelectionRef.current = range.cloneRange();
  };

  const openComposerLinkPopover = () => {
    const editor = contactEmailBodyEditorRef.current;
    if (!editor || typeof window === 'undefined') return;
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 && !selection.isCollapsed ? selection.getRangeAt(0) : contactEmailSelectionRef.current;
    if (!range || !editor.contains(range.commonAncestorContainer) || !range.toString().trim()) {
      setContactEmailSendMessage({ type: 'error', text: 'Highlight text in the message before adding a link.' });
      return;
    }
    contactEmailSelectionRef.current = range.cloneRange();
    const editorRect = editor.getBoundingClientRect();
    const rangeRect = range.getBoundingClientRect();
    const popoverWidth = 300;
    const left = Math.min(Math.max(rangeRect.left - editorRect.left, 8), Math.max(editorRect.width - popoverWidth - 8, 8));
    const top = Math.max(rangeRect.bottom - editorRect.top + 8, 8);
    setComposerLinkPopover({ left, top, url: '', error: '' });
  };

  const applyComposerLink = () => {
    const editor = contactEmailBodyEditorRef.current;
    const range = contactEmailSelectionRef.current;
    const href = normalizeComposerHref(composerLinkPopover?.url || '');
    if (!composerLinkPopover || !editor || !range) return;
    if (!href) {
      setComposerLinkPopover({ ...composerLinkPopover, error: 'Enter a valid URL or email address.' });
      return;
    }

    const selectionText = range.toString();
    if (!selectionText.trim()) {
      setComposerLinkPopover({ ...composerLinkPopover, error: 'Highlight text first.' });
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.textContent = selectionText;
    anchor.style.color = '#2563eb';
    anchor.style.textDecoration = 'underline';
    anchor.style.textUnderlineOffset = '3px';

    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    range.deleteContents();
    range.insertNode(anchor);
    range.setStartAfter(anchor);
    range.setEndAfter(anchor);
    selection?.removeAllRanges();
    selection?.addRange(range);
    syncContactEmailComposerState(editor);
    setComposerLinkPopover(null);
  };

  const renderComposerLinkPopover = () =>
    composerLinkPopover ? (
      <div
        className="absolute z-20 w-[300px] rounded-lg border border-stone-200 bg-white p-3 shadow-xl"
        style={{ left: composerLinkPopover.left, top: composerLinkPopover.top }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase text-stone-400">Link address</span>
          <input
            value={composerLinkPopover.url}
            onChange={(event) => setComposerLinkPopover({ ...composerLinkPopover, url: event.target.value, error: '' })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyComposerLink();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setComposerLinkPopover(null);
              }
            }}
            autoFocus
            className="h-10 w-full rounded-md border border-stone-200 px-3 text-sm outline-none focus:border-stone-400"
            placeholder="https://example.com"
          />
        </label>
        {composerLinkPopover.error && <p className="mt-2 text-xs text-rose-600">{composerLinkPopover.error}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setComposerLinkPopover(null)}
            className="h-8 rounded-full border border-stone-200 px-3 text-xs font-semibold text-stone-600"
          >
            Cancel
          </button>
          <button type="button" onClick={applyComposerLink} className="h-8 rounded-full bg-stone-950 px-3 text-xs font-semibold text-white">
            OK
          </button>
        </div>
      </div>
    ) : null;

  const resetEditor = () => {
    setDraft(defaultDraft(activeList.stages[0]?.id));
    setContactEmailInput('');
    setContactEmailError('');
    setEditingItemId(null);
    setIsEditorOpen(false);
  };

  const addContactEmailTokens = (value: string) => {
    const tokens = value
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (tokens.length === 0) return true;
    const invalidEmails = tokens.filter((email) => !isValidContactEmail(email));
    if (invalidEmails.length > 0) {
      setContactEmailInput(value.trim());
      setContactEmailError('Enter a valid email address.');
      return false;
    }

    const inferredContactName = tokens.map(contactNameFromEmail).find(Boolean) || '';
    setDraft((current) => ({
      ...current,
      title: isContactListActive && !current.title.trim() && inferredContactName ? inferredContactName : current.title,
      contactEmails: Array.from(new Set([...current.contactEmails, ...tokens])),
    }));
    setContactEmailInput('');
    setContactEmailError('');
    return true;
  };

  const removeContactEmail = (email: string) => {
    setDraft((current) => ({
      ...current,
      contactEmails: current.contactEmails.filter((contactEmail) => contactEmail !== email),
    }));
  };

  const openLogModal = (listId?: string, itemId?: string) => {
    if (!canModify) return;
    const targetList = lists.find((list) => list.id === listId) || (logListFilter !== 'all' ? lists.find((list) => list.id === logListFilter) : null) || activeList;
    const targetItems = targetList.items.filter((item) => !isItemDeleted(item));
    const targetItem = targetItems.find((item) => item.id === itemId) || targetItems[0];

    setLogTargetListId(targetList.id);
    setLogTargetItemId(targetItem?.id || '');
    setLogDraft(defaultLogDraft(targetList.templateKey));
    setIsLogModalOpen(true);
  };

  const closeLogModal = () => {
    setIsLogModalOpen(false);
    setLogDraft(defaultLogDraft(logTargetList.templateKey));
  };

  const showNextStepTooltip = (event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>, text: string) => {
    if (!text || text === 'No next step') return;
    if (typeof window === 'undefined') return;

    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipWidth = Math.min(360, window.innerWidth - 32);
    const left = Math.min(Math.max(rect.left, 16), window.innerWidth - tooltipWidth - 16);
    const placement = rect.bottom + 160 > window.innerHeight ? 'above' : 'below';
    const top = placement === 'above' ? rect.top - 8 : rect.bottom + 8;

    setNextStepTooltip({ text, left, top, width: tooltipWidth, placement });
  };

  const openLeadUrlModal = () => {
    if (!canModify) return;
    setLeadUrl('');
    setLeadExtractMessage(null);
    setIsLeadUrlModalOpen(true);
    setSelectedDetailItemId('');
    setDetailModalMode('details');
    setViewMode('pipeline');
  };

  const parseRecipientEmails = (value: string) =>
    Array.from(
      new Set(
        value
          .split(/[\s,;]+/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

  const prepareContactEmailComposer = (emails?: string[], subject = '') => {
    const nextEmails = emails && emails.length > 0 ? normalizeContactEmails(emails) : activeContactEmails;
    setContactEmailType('metrics-update');
    setContactEmailRecipients(nextEmails.join(', '));
    setContactEmailSubject(subject);
    setContactEmailBody('');
    setContactEmailBodyHtml('');
    setContactEmailAttachments([]);
    setComposerLinkPopover(null);
    setContactEmailSendMessage(
      isOwner
        ? null
        : {
            type: 'info',
            text: 'Pulse Brevo is only available to tremaine.grant@gmail.com. Collaborators will need their own email provider before sending.',
          },
    );
  };

  const openContactEmailModal = (emails?: string[], subject = '') => {
    prepareContactEmailComposer(emails, subject);
    setIsContactEmailModalOpen(true);
  };

  const openContactEmailComposerForItem = (item: PipelineItem) => {
    prepareContactEmailComposer(
      item.contactEmails,
      item.organization ? `${item.organization} investor update` : `${item.title} investor update`,
    );
    setDetailModalMode('email');
  };

  const openItemResearch = (item: PipelineItem) => {
    if (!canModify) return;
    setItemResearchPrompt('');
    setItemResearchResult(null);
    setItemResearchMessage(null);
    setSelectedDetailItemId(item.id);
    setDetailModalMode('research');
  };

  const handleResearchItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canModify || !selectedDetailItem || isResearchingItem) return;

    const researchRequest = itemResearchPrompt.trim();
    if (!researchRequest) {
      setItemResearchMessage({ type: 'error', text: 'Describe what you want to learn about this contact or opportunity.' });
      return;
    }

    if (researchRequest.length > 4000) {
      setItemResearchMessage({ type: 'error', text: 'Keep the research request under 4,000 characters.' });
      return;
    }

    setIsResearchingItem(true);
    setItemResearchResult(null);
    setItemResearchMessage(null);

    try {
      const bridgeAuthUser = simpBudgetAuth.currentUser || quickLiftsAuth.currentUser;
      const idToken = await bridgeAuthUser?.getIdToken();
      if (!idToken) {
        throw new Error('Please sign in again before researching this lead.');
      }

      const response = await fetch(getLeadSearchBridgeUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'openai-organization': PIPELISTS_LEAD_SEARCH_FEATURE_ID,
          'x-pulsecheck-firebase-mode': 'prod',
        },
        body: JSON.stringify({
          model: PIPELISTS_LEAD_SEARCH_MODEL,
          temperature: 0.1,
          max_output_tokens: 3200,
          tools: [{ type: 'web_search' }],
          text: {
            format: {
              type: 'json_schema',
              name: 'pipelists_lead_research',
              strict: true,
              schema: leadSearchResponseSchema,
            },
          },
          input: [
            {
              role: 'system',
              content: `You are a meticulous research assistant for PipeLists. Research exactly one existing contact or lead using current web sources and the user's specific request.

Return one enriched result only. Validate every claim against a credible source. Do not stop at the saved source: run focused searches for the person's name plus organization, then separately look for a public work email, LinkedIn profile, and business phone number. Prefer a direct official bio, organization profile, staff page, or public LinkedIn profile. Find a published work email, LinkedIn profile, and public business phone number when available, but never infer or fabricate contact data. sourceUrl must be a valid http(s) URL. Use empty strings or an empty contactEmails array for unavailable fields; never return placeholders such as "N/A", "unknown", or "not found".

Preserve the identity of the existing record unless a source corrects it. Provide a concise rationale, sourceEvidence, and a concrete nextStep only when supported by the research. Keep notes blank unless there is genuinely useful relationship context. Return JSON only.`,
            },
            {
              role: 'user',
              content: JSON.stringify(
                {
                  listName: activeList.name,
                  templateLabel: templateCatalog[activeList.templateKey].label,
                  researchRequest,
                  existingLead: {
                    title: selectedDetailItem.title,
                    organization: selectedDetailItem.organization,
                    contactEmails: selectedDetailItem.contactEmails,
                    contactPhone: selectedDetailItem.contactPhone,
                    linkedinUrl: selectedDetailItem.linkedinUrl,
                    sourceUrl: selectedDetailItem.sourceUrl,
                    segment: selectedDetailItem.segment,
                    relationshipContext: selectedDetailItem.decisionMaker,
                    notes: selectedDetailItem.notes,
                  },
                  allowedStages: activeList.stages.map((stage) => ({ id: stage.id, label: stage.label })),
                },
                null,
                2,
              ),
            },
          ],
        }),
      });

      const payload = await readApiJson(response, 'Lead research returned an unexpected response. Refresh and try again.');
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, 'Unable to research this lead.'));
      }

      const parsed = parseJsonSafe(getResponsesApiText(payload) || '{}');
      const rawResult = parsed && typeof parsed === 'object' && Array.isArray(parsed.leads) ? parsed.leads[0] : null;
      if (!rawResult || typeof rawResult !== 'object') {
        throw new Error('Research did not return a usable result. Try a more specific request.');
      }

      const suggestedResult = sanitizeGeneratedLead(rawResult as Partial<GeneratedLead>);
      const result: GeneratedLead = {
        ...suggestedResult,
        title: suggestedResult.title === 'Untitled opportunity' ? selectedDetailItem.title : suggestedResult.title,
        organization: suggestedResult.organization || selectedDetailItem.organization,
        owner: suggestedResult.owner || selectedDetailItem.owner,
        sourceUrl: suggestedResult.sourceUrl || normalizeLeadInputUrl(selectedDetailItem.sourceUrl)?.toString() || '',
        segment: suggestedResult.segment || selectedDetailItem.segment,
        decisionMaker: suggestedResult.decisionMaker || selectedDetailItem.decisionMaker,
      };
      if (!result.sourceUrl) {
        throw new Error('Research needs a credible source URL. Add one to this lead first, then try again.');
      }

      const foundNewPublicData = Boolean(
        suggestedResult.contactEmails.length ||
          suggestedResult.contactPhone ||
          suggestedResult.linkedinUrl ||
          suggestedResult.rationale ||
          suggestedResult.sourceEvidence ||
          suggestedResult.nextStep ||
          suggestedResult.notes,
      );
      setItemResearchResult(result);
      setItemResearchMessage(
        foundNewPublicData
          ? { type: 'success', text: 'Research is ready to review. Apply it only when the findings look right.' }
          : { type: 'info', text: 'Research confirmed the current record but did not find new public contact details. You can refine the prompt or keep the record as is.' },
      );
    } catch (error) {
      console.error('[PipeLists] Item research failed:', error);
      setItemResearchMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to research this lead.',
      });
    } finally {
      setIsResearchingItem(false);
    }
  };

  const handleApplyItemResearch = () => {
    if (!canModify || !selectedDetailItem || !itemResearchResult) return;

    const result = itemResearchResult;
    const contactEmails = Array.from(
      new Set([...normalizeContactEmails(selectedDetailItem.contactEmails), ...normalizeContactEmails(result.contactEmails)]),
    );
    const researchNotes = cleanDealNotes(result.notes);
    const emailSearchNote = contactEmails.length === 0 ? 'Contact email could not be found in public sources.' : '';
    const notes = Array.from(new Set([cleanDealNotes(selectedDetailItem.notes), researchNotes, emailSearchNote].filter(Boolean))).join('\n\n');
    const now = new Date().toISOString();

    setLists((currentLists) =>
      currentLists.map((list) =>
        list.id === activeList.id
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === selectedDetailItem.id
                  ? {
                      ...item,
                      title: result.title || item.title,
                      organization: result.organization || item.organization,
                      owner: result.owner || item.owner,
                      contactEmails,
                      contactPhone: result.contactPhone || item.contactPhone,
                      linkedinUrl: result.linkedinUrl || item.linkedinUrl,
                      sourceUrl: result.sourceUrl || item.sourceUrl,
                      segment: result.segment || item.segment,
                      decisionMaker: result.decisionMaker || item.decisionMaker,
                      nextStep: result.nextStep || item.nextStep,
                      notes,
                      updatedAt: now,
                      weeklyLogs: [
                        {
                          ...defaultLogDraft(activeList.templateKey),
                          id: makeId(),
                          summary: `Applied research to ${item.title}.`,
                          notes: `Research request: ${itemResearchPrompt.trim()}`,
                          createdAt: now,
                        },
                        ...item.weeklyLogs,
                      ],
                    }
                  : item,
              ),
            }
          : list,
      ),
    );
    setDetailModalMode('details');
    setItemResearchResult(null);
    setToastMessage({ type: 'success', text: `Applied research to ${selectedDetailItem.title}.` });
  };

  const openEmailActivityForItem = (item: PipelineItem) => {
    const recipient = normalizeContactEmails(item.contactEmails)[0] || '';
    const emailFilter: LogEmailFilter = item.lastEmailType === 'general-update' ? 'general-update' : 'investor-update';
    setActiveListId(activeList.id);
    setLogListFilter(activeList.id);
    setLogEmailFilter(emailFilter);
    setLogRecipientFilter(recipient);
    setSelectedDetailItemId('');
    setSelectedLogItemId(item.id);
    setViewMode('logs');
  };

  const toggleExpandedLog = (logId: string) => {
    setExpandedLogIds((current) => {
      const next = new Set(current);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const closeContactEmailModal = () => {
    if (isSendingContactEmail) return;
    setIsContactEmailModalOpen(false);
    setContactEmailSendMessage(null);
  };

  const handleContactEmailAttachments = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const nextFiles = Array.from(files).slice(0, Math.max(0, 5 - contactEmailAttachments.length));
    if (nextFiles.length === 0) {
      setContactEmailSendMessage({ type: 'error', text: 'You can attach up to 5 files.' });
      return;
    }

    const oversizedFile = nextFiles.find((file) => file.size > 7 * 1024 * 1024);
    if (oversizedFile) {
      setContactEmailSendMessage({ type: 'error', text: `${oversizedFile.name} is too large. Keep attachments under 7 MB each.` });
      return;
    }

    const currentSize = contactEmailAttachments.reduce((total, attachment) => total + attachment.size, 0);
    const nextSize = nextFiles.reduce((total, file) => total + file.size, 0);
    if (currentSize + nextSize > 15 * 1024 * 1024) {
      setContactEmailSendMessage({ type: 'error', text: 'Keep total attachments under 15 MB.' });
      return;
    }

    try {
      const encodedFiles = await Promise.all(
        nextFiles.map(async (file) => ({
          id: makeId(),
          name: file.name,
          size: file.size,
          type: file.type,
          content: await readFileAsBase64(file),
        })),
      );
      setContactEmailAttachments((current) => [...current, ...encodedFiles]);
      setContactEmailSendMessage(null);
    } catch (error) {
      setContactEmailSendMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to attach that file.',
      });
    }
  };

  const removeContactEmailAttachment = (attachmentId: string) => {
    setContactEmailAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  };

  const handleSendContactEmail = async () => {
    if (!user) {
      setContactEmailSendMessage({ type: 'error', text: 'Please sign in again.' });
      return;
    }
    if (!isOwner) {
      setContactEmailSendMessage({
        type: 'error',
        text: 'Pulse Brevo sending is only enabled for tremaine.grant@gmail.com.',
      });
      return;
    }

    const toEmails = parseRecipientEmails(contactEmailRecipients);
    const invalidEmail = toEmails.find((email) => !isValidContactEmail(email));
    if (toEmails.length === 0) {
      setContactEmailSendMessage({ type: 'error', text: 'Add at least one recipient.' });
      return;
    }
    if (invalidEmail) {
      setContactEmailSendMessage({ type: 'error', text: `Invalid recipient: ${invalidEmail}` });
      return;
    }
    const sentSubject = contactEmailSubject.trim();
    const sentMessage = contactEmailBody.trim();
    if (!sentSubject) {
      setContactEmailSendMessage({ type: 'error', text: 'Add a subject.' });
      return;
    }
    if (!sentMessage) {
      setContactEmailSendMessage({ type: 'error', text: 'Add a message.' });
      return;
    }

    setIsSendingContactEmail(true);
    setContactEmailSendMessage(null);
    const recipientItems = toEmails.map((email) => ({
      email,
      itemIds: activeListItems
        .filter((item) => normalizeContactEmails(item.contactEmails).includes(email))
        .map((item) => item.id),
    }));
    const batchId = makeId();

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/pipelists/send-contact-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          provider: 'pulse-brevo',
          emailType: contactEmailType,
          toEmails,
          subject: sentSubject,
          message: sentMessage,
          messageHtml: contactEmailBodyHtml || linkifyComposerBodyHtml(sentMessage),
          attachments: contactEmailAttachments.map((attachment) => ({
            name: attachment.name,
            content: attachment.content,
          })),
          listId: activeList.id,
          listName: activeList.name,
          ownerUid: user.uid,
          batchId,
          recipientItems,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || 'Unable to send email.');
      }

      const resultRows: Array<{ toEmail?: string; messageId?: string; skipped?: boolean; suppressed?: boolean; suppressionReason?: string }> =
        Array.isArray(result?.results) ? result.results : [];
      const sentRows = resultRows.filter((row) => row?.toEmail && row.skipped !== true);
      const skippedRows = resultRows.filter((row) => row?.skipped === true);
      const sentCount = Number.isFinite(Number(result?.sentCount)) ? Number(result.sentCount) : sentRows.length || toEmails.length;
      const skippedCount = Number.isFinite(Number(result?.skippedCount)) ? Number(result.skippedCount) : skippedRows.length;

      if (sentCount <= 0) {
        const skippedReason = skippedRows.find((row) => row.suppressionReason)?.suppressionReason;
        const skippedText = skippedReason
          ? `No new email was sent. Brevo skipped the recipient because of ${skippedReason.replace(/[_-]/g, ' ')}.`
          : 'No new email was sent. Brevo skipped this request, likely because it matched an existing send or recipient suppression.';
        setContactEmailSendMessage({ type: 'error', text: skippedText });
        setToastMessage({ type: 'error', text: skippedText });
        return;
      }

      const sendSuccessText =
        skippedCount > 0
          ? `Sent ${formatCount(sentCount, 'email')} and skipped ${formatCount(skippedCount, 'recipient')}.`
          : `Sent ${formatCount(sentCount, 'email')}.`;
      const messageIdsByEmail = new Map<string, string>(
        resultRows
          .filter((row) => row.skipped !== true)
          .map((row): [string, string] => [String(row.toEmail || '').toLowerCase(), String(row.messageId || '')])
          .filter(([email]) => Boolean(email)),
      );
      const sentEmails = new Set(sentRows.map((row) => String(row.toEmail || '').toLowerCase()).filter(Boolean));
      const sentAt = new Date().toISOString();
      const emailTypeLabel = contactEmailTypeLabels[contactEmailType];
      const emailLogType = contactEmailTypeLogType[contactEmailType];

      setLists((currentLists) =>
        currentLists.map((list) => {
          if (list.id !== activeList.id) return list;

          return {
            ...list,
            items: list.items.map((item) => {
              const matchingEmail = normalizeContactEmails(item.contactEmails).find((email) => toEmails.includes(email));
              if (!matchingEmail) return item;
              if (sentEmails.size > 0 && !sentEmails.has(matchingEmail)) return item;

              const summary = `${emailTypeLabel} sent to ${matchingEmail}.`;
              const attachmentNames = contactEmailAttachments.map((attachment) => attachment.name).filter(Boolean);
              const messageId = messageIdsByEmail.get(matchingEmail) || '';
              const emailLogNotes = [
                `To: ${matchingEmail}`,
                `Subject: ${sentSubject}`,
                ...(attachmentNames.length > 0 ? [`Attachments: ${attachmentNames.join(', ')}`] : []),
                ...(messageId ? [`Message ID: ${messageId}`] : []),
                '',
                'Message:',
                sentMessage,
              ].join('\n');
              const alreadyLogged = item.weeklyLogs.some(
                (log) =>
                  log.systemAction === 'email-sent' &&
                  log.summary === summary &&
                  log.notes === emailLogNotes &&
                  log.createdAt.slice(0, 10) === sentAt.slice(0, 10),
              );
              const emailLog = createSystemLog(item, 'email-sent', summary);
              emailLog.type = emailLogType;
              emailLog.notes = emailLogNotes;

              return {
                ...item,
                emailStatus: 'sent',
                lastEmailType: contactEmailType,
                lastEmailEvent: 'sent',
                lastEmailSentAt: sentAt,
                lastEmailMessageId: messageId || item.lastEmailMessageId,
                updatedAt: sentAt,
                weeklyLogs: alreadyLogged ? item.weeklyLogs : [emailLog, ...item.weeklyLogs],
              };
            }),
          };
        }),
      );
      setToastMessage({ type: 'success', text: sendSuccessText });
      if (detailModalMode === 'email') {
        setContactEmailSendMessage(null);
        setDetailModalMode('details');
      } else {
        setContactEmailSendMessage({
          type: 'success',
          text: sendSuccessText,
        });
        if (isContactEmailModalOpen) {
          setIsContactEmailModalOpen(false);
        }
      }
      setContactEmailSubject('');
      setContactEmailBody('');
      setContactEmailBodyHtml('');
      setComposerLinkPopover(null);
      setContactEmailAttachments([]);
    } catch (error) {
      setContactEmailSendMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to send email.',
      });
    } finally {
      setIsSendingContactEmail(false);
    }
  };

  const openLeadGenModal = () => {
    if (!canModify) return;
    setLeadSearchBrief(normalizeLeadSearchBrief(activeList.searchBrief, activeList));
    setGeneratedLeads([]);
    setAddedGeneratedLeadKeys([]);
    setLeadGenMessage(null);
    setIsLeadGenModalOpen(true);
    setSelectedDetailItemId('');
    setDetailModalMode('details');
    setViewMode('pipeline');
  };

  const closeLeadGenModal = () => {
    if (isGeneratingLeads) return;
    persistLeadSearchBrief();
    setIsLeadGenModalOpen(false);
  };

  const openPastedLeadListModal = () => {
    if (!canModify || !isContactListActive) return;
    setPastedLeadList('');
    setAnalyzedPastedLeads([]);
    setAddedPastedLeadKeys([]);
    setPastedLeadListMessage(null);
    setIsPastedLeadListModalOpen(true);
    setSelectedDetailItemId('');
    setDetailModalMode('details');
    setViewMode('pipeline');
  };

  const closePastedLeadListModal = () => {
    if (isAnalyzingPastedLeadList) return;
    setIsPastedLeadListModalOpen(false);
  };

  const handleImportFriendsOfBusiness = async () => {
    if (!isOwner || !canManageActiveList || !isInvestorUpdateContactsList || isImportingFriends) return;

    setIsImportingFriends(true);
    setFriendsImportMessage(null);

    try {
      const snapshot = await getDocs(collection(quickLiftsDb, FRIENDS_OF_BUSINESS_COLLECTION));
      const friends = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...(documentSnapshot.data() as FriendOfBusinessContact),
      }));

      if (friends.length === 0) {
        setFriendsImportMessage({ type: 'info', text: 'No Friends of the Business contacts were found to import.' });
        return;
      }

      const targetList = lists.find((list) => list.id === activeList.id) || activeList;
      const firstStage = targetList.stages[0]?.id || 'sourced';
      const existingKeys = new Set(targetList.items.map(itemContactKey));
      const importedItems: PipelineItem[] = [];
      let skippedCount = 0;

      friends.forEach((friend) => {
        const contactKey = friendContactKey(friend);
        if (!contactKey || existingKeys.has(contactKey)) {
          skippedCount += 1;
          return;
        }

        const contactEmails = normalizeContactEmails(friend.email);
        const displayName = fullFriendName(friend);
        const organization = normalizeBasicText(friend.titleOrCompany);
        const title = displayName || contactEmails[0] || organization || 'Investor update contact';
        const friendEmailStatus = normalizeBasicText(friend.emailStatus || friend.lastEmailEvent);
        const nextItemBase = createItem(
          {
            ...defaultDraft(firstStage),
            title,
            organization,
            owner: 'Tre',
            contactEmails,
            emailStatus: friendEmailStatus,
            lastEmailEvent: friendEmailStatus,
            emailOpenCount: Number.isFinite(friend.emailOpenCount) ? Number(friend.emailOpenCount) : 0,
            emailClickCount: Number.isFinite(friend.emailClickCount) ? Number(friend.emailClickCount) : 0,
            lastEmailClickedLink: normalizeBasicText(friend.lastEmailClickedLink),
            stage: firstStage,
            priority: 'medium',
            segment: 'Investor update contact',
            decisionMaker: displayName || title,
            nextStep: 'Include in the next investor update and personalize around existing relationship context.',
            notes: buildFriendAnalysisNotes(friend),
          },
          `friend-${friend.id || makeId()}`,
        );
        const nextItem = {
          ...nextItemBase,
          weeklyLogs: [
            createSystemLog(
              nextItemBase,
              'item-created',
              `Imported ${nextItemBase.title} from Friends of the Business.`,
            ),
          ],
        };

        importedItems.push(nextItem);
        existingKeys.add(contactKey);
      });

      if (importedItems.length > 0) {
        setLists((currentLists) =>
          currentLists.map((list) =>
            list.id === targetList.id
              ? {
                  ...list,
                  items: [...importedItems, ...list.items],
                }
              : list,
          ),
        );
      }

      setFriendsImportMessage({
        type: importedItems.length > 0 ? 'success' : 'info',
        text:
          importedItems.length > 0
            ? `Imported ${formatCount(importedItems.length, 'contact')}${skippedCount > 0 ? ` and skipped ${formatCount(skippedCount, 'duplicate')}` : ''}.`
            : `No new contacts to import. Skipped ${formatCount(skippedCount, 'duplicate')}.`,
      });

      if (importedItems.length > 0) {
        setToastMessage({ type: 'success', text: `Imported ${formatCount(importedItems.length, 'investor update contact')}.` });
      }
    } catch (error) {
      console.error('[PipeLists] Friends of the Business import failed:', error);
      setFriendsImportMessage({
        type: 'error',
        text: readFirestoreError(error, 'Unable to import Friends of the Business contacts.'),
      });
    } finally {
      setIsImportingFriends(false);
    }
  };

  useEffect(() => {
    if (
      !dataReady ||
      isImportingFriends ||
      !isOwner ||
      !canManageActiveList ||
      !isInvestorUpdateContactsList ||
      activeListItems.length > 0 ||
      autoImportedFriendsListIds.current.has(activeList.id)
    ) {
      return;
    }

    autoImportedFriendsListIds.current.add(activeList.id);
    void handleImportFriendsOfBusiness();
  }, [
    activeList.id,
    activeListItems.length,
    canManageActiveList,
    dataReady,
    isImportingFriends,
    isInvestorUpdateContactsList,
    isOwner,
  ]);

  const sanitizeGeneratedLead = (lead: Partial<GeneratedLead>): GeneratedLead => {
    const stage = normalizeStageId(lead.stage || activeList.stages[0]?.id || 'sourced', activeList.stages);
    const priority = lead.priority === 'high' || lead.priority === 'low' ? lead.priority : 'medium';

    return {
      ...defaultDraft(stage),
      title: normalizeResearchText(lead.title) || normalizeResearchText(lead.organization) || 'Untitled opportunity',
      organization: normalizeResearchText(lead.organization),
      owner: normalizeResearchText(lead.owner),
      contactEmails: normalizeContactEmails((lead as { contactEmails?: unknown }).contactEmails),
      contactPhone: normalizeResearchText(lead.contactPhone),
      linkedinUrl: normalizeLeadInputUrl(normalizeResearchText(lead.linkedinUrl))?.toString() || '',
      stage,
      priority,
      amount: normalizeResearchText(lead.amount),
      dueDate: normalizeResearchText(lead.dueDate),
      nextStep: normalizeResearchText(lead.nextStep),
      notes: cleanDealNotes(normalizeResearchText(lead.notes)),
      sourceUrl: normalizeLeadInputUrl(normalizeResearchText(lead.sourceUrl))?.toString() || '',
      segment: normalizeResearchText(lead.segment),
      decisionMaker: normalizeResearchText(lead.decisionMaker),
      acv: normalizeResearchText(lead.acv),
      expectedCloseDate: normalizeResearchText(lead.expectedCloseDate),
      contractTerm: normalizeResearchText(lead.contractTerm),
      pilotScope: normalizeResearchText(lead.pilotScope),
      athleteCount: normalizeResearchText(lead.athleteCount),
      pilotStart: normalizeResearchText(lead.pilotStart),
      pilotEnd: normalizeResearchText(lead.pilotEnd),
      conversionLikelihood: normalizeResearchText(lead.conversionLikelihood),
      grossMargin: normalizeResearchText(lead.grossMargin),
      partnerCost: normalizeResearchText(lead.partnerCost),
      hardwareCost: normalizeResearchText(lead.hardwareCost),
      lossReason: normalizeResearchText(lead.lossReason),
      expansionPath: normalizeResearchText(lead.expansionPath),
      rationale: normalizeResearchText(lead.rationale),
      sourceEvidence: normalizeResearchText(lead.sourceEvidence),
      deadlineStatus: normalizeResearchText(lead.deadlineStatus),
    };
  };

  const handleAnalyzePastedLeadList = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canModify || !isContactListActive || isAnalyzingPastedLeadList) return;

    const rawList = pastedLeadList.trim();
    if (!rawList) {
      setPastedLeadListMessage({ type: 'error', text: 'Paste at least one person, organization, or profile link to analyze.' });
      return;
    }

    if (rawList.length > 16000) {
      setPastedLeadListMessage({ type: 'error', text: 'Keep each pasted batch under 16,000 characters so it can be reviewed reliably.' });
      return;
    }

    setIsAnalyzingPastedLeadList(true);
    setAnalyzedPastedLeads([]);
    setAddedPastedLeadKeys([]);
    setPastedLeadListMessage(null);

    try {
      const bridgeAuthUser = simpBudgetAuth.currentUser || quickLiftsAuth.currentUser;
      const idToken = await bridgeAuthUser?.getIdToken();
      if (!idToken) {
        throw new Error('Please sign in again before analyzing this list.');
      }

      const normalizedBrief = normalizeLeadSearchBrief(leadSearchBrief, activeList);
      const stageOptions = activeList.stages.map((stage) => ({
        id: stage.id,
        label: stage.label,
        probability: stage.probability,
      }));
      const existingItems = activeListItems.map((item) => ({
        title: item.title,
        organization: item.organization,
        sourceUrl: item.sourceUrl,
        contactEmails: item.contactEmails,
      }));

      const response = await fetch(getLeadSearchBridgeUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'openai-organization': PIPELISTS_LEAD_SEARCH_FEATURE_ID,
          'x-pulsecheck-firebase-mode': 'prod',
        },
        body: JSON.stringify({
          model: PIPELISTS_LEAD_SEARCH_MODEL,
          temperature: 0.1,
          max_output_tokens: 5000,
          tools: [{ type: 'web_search' }],
          text: {
            format: {
              type: 'json_schema',
              name: 'pipelists_pasted_contact_analysis',
              strict: true,
              schema: leadSearchResponseSchema,
            },
          },
          input: [
            {
              role: 'system',
              content: `You are a contact-research analyst for PipeLists, a relationship CRM.

Research the user's pasted list entry by entry using current web sources. The pasted text may contain names, organizations, profile URLs, copied list rows, or short descriptions.

Rules:
- Return one result for each clear, distinct person or organization you can identify, up to 25 total results.
- Do not return a directory, article, search result, or list of people as a contact. If an entry is a directory or list, resolve the actual people or organizations named in it instead.
- Do a real enrichment pass for every person: search the name and organization, then specifically search for their published email, LinkedIn profile, and public business phone number before returning a result.
- Prefer a direct official biography, organization profile, university/team staff page, or verified public profile as sourceUrl. sourceUrl must be a valid http(s) URL. Never use placeholders such as "N/A" or "not found".
- Never invent roles, organizations, email addresses, dates, relationship history, or source links.
- Include contactEmails only when a valid email is visibly published by a credible source. Otherwise return an empty array after checking; do not guess email patterns.
- Include linkedinUrl only for a valid public LinkedIn profile URL. Include contactPhone only for a publicly published business phone number. Leave either field as an empty string when no credible source provides it.
- For a person, title must be the person's name and organization should identify their current role and organization. For an organization, title and organization may match when no individual is named.
- Use the provided stage ids only. For new contacts, default to the first stage unless the pasted text clearly establishes a stronger relationship status.
- Keep notes blank unless there is material relationship context, an introduction path, a concrete partnership angle, or a specific constraint.
- rationale should explain the useful relationship angle in one concise sentence. sourceEvidence should identify the supporting source and what it establishes. deadlineStatus should be "no fixed deadline" for contact research.
- Omit anything that cannot be identified with enough confidence to give a credible sourceUrl, role/organization, and direct relationship angle.
- Return JSON only.`,
            },
            {
              role: 'user',
              content: JSON.stringify(
                {
                  listName: activeList.name,
                  templateLabel: templateCatalog[activeList.templateKey].label,
                  searchBrief: normalizedBrief,
                  stageOptions,
                  existingItems,
                  pastedList: rawList,
                },
                null,
                2,
              ),
            },
          ],
        }),
      });

      const payload = await readApiJson(response, 'List analysis returned an unexpected response. Refresh and try again.');
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, 'Unable to analyze this list.'));
      }

      const parsed = parseJsonSafe(getResponsesApiText(payload) || '{}');
      const rawLeads = parsed && typeof parsed === 'object' && Array.isArray(parsed.leads) ? parsed.leads : [];
      const uniqueLeads = new Map<string, GeneratedLead>();
      let excludedUnverifiedCount = 0;

      rawLeads.forEach((lead: Partial<GeneratedLead>) => {
        const sanitizedLead = sanitizeGeneratedLead(lead);
        if (!sanitizedLead.sourceUrl || !sanitizedLead.organization || !sanitizedLead.rationale) {
          excludedUnverifiedCount += 1;
          return;
        }
        const key = generatedLeadKey(sanitizedLead);
        if (!activeLeadKeys.has(key) && !uniqueLeads.has(key)) {
          uniqueLeads.set(key, sanitizedLead);
        }
      });

      const nextLeads = Array.from(uniqueLeads.values()).slice(0, 25);
      setAnalyzedPastedLeads(nextLeads);
      setPastedLeadListMessage(
        nextLeads.length > 0
          ? {
              type: 'success',
              text: `Analyzed ${formatCount(nextLeads.length, 'contact')}. Review each one before adding it.${excludedUnverifiedCount ? ` Excluded ${formatCount(excludedUnverifiedCount, 'unverified result')}.` : ''}`,
            }
          : { type: 'info', text: 'No new contacts could be verified from this list. Try including names, organizations, or profile links.' },
      );
    } catch (error) {
      console.error('[PipeLists] Pasted contact analysis failed:', error);
      setPastedLeadListMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to analyze this list.',
      });
    } finally {
      setIsAnalyzingPastedLeadList(false);
    }
  };

  const handleGenerateLeads = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canModify || isGeneratingLeads) return;

    setIsGeneratingLeads(true);
    setGeneratedLeads([]);
    setAddedGeneratedLeadKeys([]);
    setLeadGenMessage(null);

    try {
      const bridgeAuthUser = simpBudgetAuth.currentUser || quickLiftsAuth.currentUser;
      const idToken = await bridgeAuthUser?.getIdToken();
      if (!idToken) {
        throw new Error('Please sign in again before generating leads.');
      }

      const today = getEasternDate();
      const normalizedBrief = normalizeLeadSearchBrief(leadSearchBrief, activeList);
      const userAdjustments = buildLeadSearchPrompt(normalizedBrief);
      persistLeadSearchBrief(normalizedBrief);
      const deadlineRequired = normalizedBrief.requireFutureDeadline;
      const stageOptions = activeList.stages.map((stage) => ({
        id: stage.id,
        label: stage.label,
        probability: stage.probability,
      }));
      const existingItems = activeListItems.map((item) => ({
        title: item.title,
        organization: item.organization,
        sourceUrl: item.sourceUrl,
        dueDate: item.dueDate,
      }));

      const response = await fetch(getLeadSearchBridgeUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'openai-organization': PIPELISTS_LEAD_SEARCH_FEATURE_ID,
          'x-pulsecheck-firebase-mode': 'prod',
        },
        body: JSON.stringify({
          model: PIPELISTS_LEAD_SEARCH_MODEL,
          temperature: 0.15,
          max_output_tokens: 3500,
          tools: [{ type: 'web_search' }],
          text: {
            format: {
              type: 'json_schema',
              name: 'pipelists_lead_generation',
              strict: true,
              schema: leadSearchResponseSchema,
            },
          },
          input: [
            {
              role: 'system',
              content: `You are a lead-generation researcher for PipeLists, a CRM-style opportunity tracker.

Current date: ${today}.

Research rules:
- Use the user's search brief as the primary instruction source.
- Use web search and return leads supported by current sources.
- Return only leads that are relevant to the active PipeList and the user's search brief.
- Avoid duplicates already in the user's list.
- Never invent deadlines, prizes, contacts, amounts, fit claims, or organizations.
- Only include contactEmails when the source visibly provides valid email addresses. Never invent contact emails.
- If a source has an explicit deadline, dueDate must use ISO format YYYY-MM-DD.
- If requireFutureDeadline is true in the search brief, every returned lead must have a verified dueDate on or after ${today}.
- If requireFutureDeadline is false, dueDate can be "" unless the source provides a real deadline.
- If officialSourcesOnly is true in the search brief, prefer official/current sources and verify against official pages before returning a lead.
- Pick stage from the provided stage ids only. If unsure, use the first stage id.
- Keep notes blank unless there is deal-moving context: risk, eligibility nuance, budget/funding detail, buyer angle, procurement constraint, strategic fit, or prep detail. Do not summarize what the page is. Do not write generic "may be relevant" notes or "AI confidence".
- sourceEvidence must briefly name the source support used, including the deadline when relevant.
- deadlineStatus must state whether the lead has a future deadline, no fixed deadline, or an optional follow-up date.
- Return JSON only.`,
            },
            {
              role: 'user',
              content: JSON.stringify(
                {
                  requestedLeadCount: normalizedBrief.leadCount,
                  listName: activeList.name,
                  templateLabel: templateCatalog[activeList.templateKey].label,
                  templateKey: activeList.templateKey,
                  searchBrief: normalizedBrief,
                  deadlineRequired,
                  stageOptions,
                  userAdjustments,
                  existingItems,
                },
                null,
                2,
              ),
            },
          ],
        }),
      });

      const payload = await readApiJson(response, 'Search leads returned an unexpected response. Refresh and try again.');
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, 'Unable to generate leads.'));
      }

      const parsed = parseJsonSafe(getResponsesApiText(payload) || '{}');
      const rawLeads = parsed && typeof parsed === 'object' && Array.isArray(parsed.leads) ? parsed.leads : [];
      const sanitizedLeads: GeneratedLead[] = rawLeads.length > 0
        ? rawLeads.map((lead: Partial<GeneratedLead>) => sanitizeGeneratedLead(lead))
        : [];
      const nextLeads = sanitizedLeads.filter((lead) => !normalizedBrief.requireFutureDeadline || isIsoDateOnOrAfter(lead.dueDate, today));

      setGeneratedLeads(nextLeads);
      setLeadGenMessage(
        nextLeads.length > 0
          ? {
              type: 'success',
              text:
                sanitizedLeads.length > nextLeads.length
                  ? `Found ${formatCount(nextLeads.length, 'lead')}. Filtered out expired matches.`
                  : `Found ${formatCount(nextLeads.length, 'lead')}. Review and add the ones you want.`,
            }
          : {
              type: 'info',
              text:
                sanitizedLeads.length > 0
                  ? 'The search only found expired matches. Try widening the search or turning off future deadline.'
                  : 'No new leads matched this search. Try widening the adjustments.',
            },
      );
    } catch (error) {
      console.error('[PipeLists] Lead generation failed:', error);
      setLeadGenMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to generate leads.',
      });
    } finally {
      setIsGeneratingLeads(false);
    }
  };

  const handleAddGeneratedLead = (lead: GeneratedLead) => {
    if (!canModify) return;
    const key = generatedLeadKey(lead);
    if (activeLeadKeys.has(key) || addedGeneratedLeadKeys.includes(key)) {
      setLeadGenMessage({ type: 'info', text: `${lead.title} is already in this PipeList.` });
      return;
    }

    const stage = normalizeStageId(lead.stage || activeList.stages[0]?.id || 'sourced', activeList.stages);
    const nextItemBase = createItem(
      {
        ...defaultDraft(stage),
        ...lead,
        stage,
        priority: lead.priority || 'medium',
        notes: [
          cleanDealNotes(lead.notes),
          lead.rationale ? `Why this fits: ${lead.rationale}` : '',
          lead.sourceEvidence ? `Source evidence: ${lead.sourceEvidence}` : '',
          lead.deadlineStatus ? `Deadline status: ${lead.deadlineStatus}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
      makeId(),
    );
    const nextItem: PipelineItem = {
      ...nextItemBase,
      weeklyLogs: [
        createSystemLog(
          nextItemBase,
          'item-created',
          `Added ${nextItemBase.title} to ${activeList.name}.`,
        ),
      ],
    };

    setLists((currentLists) =>
      currentLists.map((list) =>
        list.id === activeList.id
          ? {
              ...list,
              items: [nextItem, ...list.items],
            }
          : list,
      ),
    );
    setAddedGeneratedLeadKeys((currentKeys) => [...currentKeys, key]);
    setSelectedLogItemId(nextItem.id);
    setStageFilter('all');
    setViewMode('pipeline');
    setLeadGenMessage({ type: 'success', text: `Added ${nextItem.title} to ${activeList.name}.` });
  };

  const handleAddAnalyzedPastedLead = (lead: GeneratedLead) => {
    if (!canModify) return;
    const key = generatedLeadKey(lead);
    if (activeLeadKeys.has(key) || addedPastedLeadKeys.includes(key)) {
      setPastedLeadListMessage({ type: 'info', text: `${lead.title} is already in this PipeList.` });
      return;
    }

    const stage = normalizeStageId(lead.stage || activeList.stages[0]?.id || 'sourced', activeList.stages);
    const nextItemBase = createItem(
      {
        ...defaultDraft(stage),
        ...lead,
        stage,
        priority: lead.priority || 'medium',
        // Keep research rationale in the review card, but make an unsuccessful public-email search explicit.
        notes:
          normalizeContactEmails(lead.contactEmails).length > 0
            ? cleanDealNotes(lead.notes)
            : 'Contact email could not be found in public sources.',
      },
      makeId(),
    );
    const nextItem: PipelineItem = {
      ...nextItemBase,
      weeklyLogs: [
        createSystemLog(
          nextItemBase,
          'item-created',
          `Added ${nextItemBase.title} to ${activeList.name}.`,
        ),
      ],
    };

    setLists((currentLists) =>
      currentLists.map((list) =>
        list.id === activeList.id
          ? {
              ...list,
              items: [nextItem, ...list.items],
            }
          : list,
      ),
    );
    setAddedPastedLeadKeys((currentKeys) => [...currentKeys, key]);
    setSelectedLogItemId(nextItem.id);
    setStageFilter('all');
    setViewMode('pipeline');
    setPastedLeadListMessage({ type: 'success', text: `Added ${nextItem.title} to ${activeList.name}.` });
  };

  const formatClipboardSection = (title: string, rows: Array<[string, string | number | undefined]>) => {
    const body = rows
      .map(([label, value]) => [label, String(value || '').trim()] as const)
      .filter(([, value]) => value.length > 0)
      .map(([label, value]) => `${label}: ${value}`)
      .join('\n');

    return body ? `${title}\n${body}` : '';
  };

  const buildLeadDetailsClipboardText = (item: PipelineItem, stage: StageConfig) => {
    const valueText = itemAmountDisplay(activeList, item);
    const attachmentsText =
      item.attachments.length > 0
        ? item.attachments
            .map((attachment, index) =>
              formatClipboardSection(`Attachment ${index + 1}`, [
                ['Name', attachment.name],
                ['Type', attachment.type],
                ['URL', attachment.url],
                ['File Name', attachment.fileName],
                ['Content Type', attachment.contentType],
                ['Size', formatFileSize(attachment.size)],
                ['Created By', attachment.createdBy],
                ['Created At', attachment.createdAt],
              ]),
            )
            .filter(Boolean)
            .join('\n\n')
        : 'No attachments.';
    const logsText =
      item.weeklyLogs.length > 0
        ? item.weeklyLogs
            .map((log, index) =>
              formatClipboardSection(`Log ${index + 1}`, [
                ['Type', logDisplayLabel(log)],
                ['Date', log.weekOf],
                [followUpDateLabel(log.nextStep), log.followUpDate],
                ['Summary', log.summary],
                ['Next Step', log.nextStep],
                ['Rostered Athletes', log.rosteredAthletes],
                ['Completed Check-Ins', log.completedCheckIns],
                ['Check-In Rate', log.checkInRate],
                ['Biometric Sync Rate', log.biometricSyncRate],
                ['Signal Events', log.signalEvents],
                ['Nora Engagement Rate', log.noraEngagementRate],
                ['Nora Sessions', log.noraSessions],
                ['Escalations', log.escalations],
                ['Staff Feedback Score', log.staffFeedbackScore],
                ['Notes', log.notes],
                ['Created At', log.createdAt],
              ]),
            )
            .filter(Boolean)
            .join('\n\n')
        : 'No logs recorded.';
    const detailRows: Array<[string, string | number | undefined]> = [
      ['Title', item.title],
      ['PipeList', activeList.name],
      ['Template', templateCatalog[activeList.templateKey].label],
      ['Organization', item.organization],
      isInvestorUpdateContactsList
        ? ['Email Status', emailStatusLabel(item)]
        : ['Stage', `${stage.label} (${item.stage})`],
      ['Importance', importanceLabel(item.priority)],
      ...(isContactListActive ? [] : [[isFundSizeList(activeList) ? amountFieldLabelForList(activeList) : 'Value', valueText] as [string, string | number | undefined]]),
      [isContactListActive ? 'Relationship Owner' : 'Owner', item.owner],
      ['Contact Emails', item.contactEmails.join(', ')],
      ...(isContactListActive ? [['Phone', item.contactPhone], ['LinkedIn', item.linkedinUrl]] as [string, string | number | undefined][] : []),
      ['Segment', item.segment],
      [isContactListActive ? 'Relationship Context' : 'Decision Maker', item.decisionMaker],
      ['Next Step', item.nextStep],
      ['Source URL', item.sourceUrl],
    ];
    const timelineRows: Array<[string, string | number | undefined]> = isContactListActive
      ? [
          [isInvestorUpdateContactsList ? 'Next Update Date' : 'Next Touchpoint', item.expectedCloseDate],
          ['Follow-Up Date', item.dueDate],
          ['First Contacted', item.pilotStart],
          ['Last Contacted', item.pilotEnd],
          ...(isInvestorUpdateContactsList ? [['Update Cadence', item.athleteCount] as [string, string | number | undefined]] : []),
        ]
      : [
          ['ACV', item.acv],
          [amountFieldLabelForList(activeList), item.amount],
          ['Expected Close', item.expectedCloseDate],
          ['Due Date', item.dueDate],
          ['Contract Term', item.contractTerm],
          ['Partner Cost', item.partnerCost],
          ['Hard Cost', item.hardwareCost],
          ['Margin Notes', item.grossMargin],
        ];

    return [
      formatClipboardSection(isContactListActive ? 'Contact Details' : 'Lead Details', detailRows),
      formatClipboardSection(isContactListActive ? 'Relationship Dates' : 'Financials & Dates', timelineRows),
      formatClipboardSection('Scope & Expansion', [
        ['Scope', item.pilotScope],
        ['Count', item.athleteCount],
        ['Start Date', item.pilotStart],
        ['End Date', item.pilotEnd],
        ['Conversion Likelihood', item.conversionLikelihood],
        ['Expansion Path', item.expansionPath],
        ['Loss Reason', item.lossReason],
      ]),
      formatClipboardSection('Notes', [['Notes', stripAiConfidenceNote(item.notes)]]),
      `Attachments\n${attachmentsText}`,
      `Logs\n${logsText}`,
      formatClipboardSection('Internal Metadata', [
        ['Lead ID', item.id],
        ['Created At', item.createdAt],
        ['Updated At', item.updatedAt],
        ['Deleted At', item.deletedAt],
        ['Restorable Until', item.restorableUntil],
      ]),
    ]
      .filter(Boolean)
      .join('\n\n');
  };

  const writeClipboardText = async (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    if (typeof document === 'undefined') {
      throw new Error('Clipboard is not available in this browser.');
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const didCopy = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!didCopy) {
      throw new Error('Clipboard is not available in this browser.');
    }
  };

  const handleCopyLeadDetails = async (item: PipelineItem, stage: StageConfig) => {
    try {
      await writeClipboardText(buildLeadDetailsClipboardText(item, stage));
      setLeadCopyMessage({ type: 'success', text: 'Lead details copied to clipboard.' });
    } catch (error) {
      console.error('[PipeLists] Copy lead details failed:', error);
      setLeadCopyMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to copy lead details.',
      });
    }
  };

  const updateLeadAttachments = (
    itemId: string,
    updater: (attachments: LeadAttachment[]) => LeadAttachment[],
  ) => {
    setLists((currentLists) =>
      currentLists.map((list) =>
        list.id === activeList.id
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      attachments: updater(item.attachments || []),
                      updatedAt: new Date().toISOString(),
                    }
                  : item,
              ),
            }
          : list,
      ),
    );
  };

  const safeAttachmentFileName = (value: string) =>
    value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'attachment';

  const handleUploadLeadAttachments = async (item: PipelineItem, files: FileList | null) => {
    if (!canModify) return;
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length === 0) return;
    if (!user) {
      setAttachmentMessage({ type: 'error', text: 'Sign in before uploading attachments.' });
      return;
    }

    setUploadingAttachment(true);
    setAttachmentMessage(null);

    try {
      const ownerUid = shareDoc?.ownerUid || user.uid;
      const nextAttachments: LeadAttachment[] = [];

      for (const file of selectedFiles) {
        const cleanFileName = safeAttachmentFileName(file.name);
        const attachmentRef = storageRef(
          simpBudgetStorage,
          `pipelists-attachments/${ownerUid}/${activeList.id}/${item.id}/${Date.now()}-${cleanFileName}`,
        );

        await uploadBytes(attachmentRef, file, {
          contentType: file.type || 'application/octet-stream',
          customMetadata: {
            listId: activeList.id,
            itemId: item.id,
            uploadedBy: user.email || user.uid,
          },
        });

        const url = await getDownloadURL(attachmentRef);
        nextAttachments.push({
          id: makeId(),
          type: 'file',
          name: file.name,
          url,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          createdAt: new Date().toISOString(),
          createdBy: profile?.displayName || user.email || user.uid,
        });
      }

      updateLeadAttachments(item.id, (attachments) => [...nextAttachments, ...attachments]);
      setAttachmentMessage({ type: 'success', text: `Added ${formatCount(nextAttachments.length, 'attachment')}.` });
    } catch (error) {
      console.error('[PipeLists] Attachment upload failed:', error);
      setAttachmentMessage({
        type: 'error',
        text: readFirestoreError(error, 'Unable to upload attachment.'),
      });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleAddAttachmentLink = (event: React.FormEvent<HTMLFormElement>, item: PipelineItem) => {
    event.preventDefault();
    if (!canModify) return;

    const cleanUrl = attachmentLinkUrl.trim();
    if (!cleanUrl) {
      setAttachmentMessage({ type: 'error', text: 'Add an attachment link first.' });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(cleanUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported URL protocol');
    } catch {
      setAttachmentMessage({ type: 'error', text: 'Use a valid http or https attachment link.' });
      return;
    }

    const nextAttachment: LeadAttachment = {
      id: makeId(),
      type: 'link',
      name: attachmentLinkName.trim() || parsedUrl.hostname.replace(/^www\./, ''),
      url: parsedUrl.toString(),
      fileName: '',
      contentType: '',
      size: 0,
      createdAt: new Date().toISOString(),
      createdBy: profile?.displayName || user?.email || '',
    };

    updateLeadAttachments(item.id, (attachments) => [nextAttachment, ...attachments]);
    setAttachmentLinkName('');
    setAttachmentLinkUrl('');
    setAttachmentMessage({ type: 'success', text: 'Attachment link added.' });
  };

  const handleDeleteAttachment = (itemId: string, attachmentId: string) => {
    if (!canModify) return;
    updateLeadAttachments(itemId, (attachments) => attachments.filter((attachment) => attachment.id !== attachmentId));
    setAttachmentMessage({ type: 'success', text: 'Attachment removed from this lead.' });
  };

  const buildLeadShareList = (item: PipelineItem): PipeList => ({
    ...activeList,
    name: item.title || activeList.name,
    description: `${activeList.name} read-only lead share`,
    items: [item],
  });

  const createOrUpdateLeadShareLink = async (item: PipelineItem) => {
    if (!canModify || !user || isLeadSharedView) return;
    setLeadShareMessage(null);

    try {
      const ownerUid = shareDoc?.ownerUid || user.uid;
      const ownerEmail = shareDoc?.ownerEmail || user.email || TREMAINE_OWNER_EMAIL;
      const nextShareId = shareDocumentIdForLead(ownerUid, activeList.id, item.id);
      const nextShareUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/PipeLists?leadShare=${encodeURIComponent(nextShareId)}`
          : '';
      const payload: PipeLeadShare = {
        id: nextShareId,
        ownerUid,
        ownerEmail,
        listId: activeList.id,
        itemId: item.id,
        list: buildLeadShareList(item),
        publicRead: true,
      };

      await setDoc(
        doc(simpBudgetDb, PIPELEAD_SHARES_COLLECTION, nextShareId),
        stripUndefined({
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        { merge: true },
      );

      setLeadShareUrl(nextShareUrl);
      setLeadShareMessage({ type: 'success', text: 'Read-only lead share link created and copied.' });
      if (nextShareUrl) {
        try {
          await writeClipboardText(nextShareUrl);
          setToastMessage({ type: 'success', text: 'Copied share link to clipboard.' });
        } catch {
          setToastMessage({ type: 'info', text: 'Share link created. Copy it from the link field.' });
          setLeadShareMessage({ type: 'info', text: nextShareUrl });
        }
      }
    } catch (error) {
      console.error('[PipeLists] Lead share link failed:', error);
      setLeadShareMessage({
        type: 'error',
        text: readFirestoreError(error, 'Unable to create this lead share link.'),
      });
    }
  };

  const handleExtractLead = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canModify) return;

    const cleanInput = leadUrl.trim();
    if (!cleanInput) {
      setLeadExtractMessage({ type: 'error', text: 'Add a lead URL, person, organization, fund, school, or program name first.' });
      return;
    }

    const directContactEmail = isContactListActive ? normalizeContactEmails(cleanInput)[0] : '';
    if (directContactEmail) {
      const stage = normalizeStageId(activeList.stages[0]?.id || 'sourced', activeList.stages);
      const inferredContactName = contactNameFromEmail(directContactEmail);
      const nextItemBase = createItem(
        {
          ...defaultDraft(stage),
          title: inferredContactName || directContactEmail,
          organization: '',
          contactEmails: [directContactEmail],
          stage,
        },
        makeId(),
      );
      const nextItem: PipelineItem = {
        ...nextItemBase,
        weeklyLogs: [
          createSystemLog(
            nextItemBase,
            'item-created',
            `Added ${nextItemBase.title} to ${activeList.name}.`,
          ),
        ],
      };

      setLists((currentLists) =>
        currentLists.map((list) =>
          list.id === activeList.id
            ? {
                ...list,
                items: [nextItem, ...list.items],
              }
            : list,
        ),
      );
      setStageFilter('all');
      setSelectedDetailItemId(nextItem.id);
      setSelectedLogItemId(nextItem.id);
      setDetailModalMode('details');
      setDraft({
        ...defaultDraft(nextItem.stage),
        title: nextItem.title,
        organization: nextItem.organization,
        owner: nextItem.owner,
        contactEmails: nextItem.contactEmails,
        stage: nextItem.stage,
        priority: nextItem.priority,
        amount: nextItem.amount,
        dueDate: nextItem.dueDate,
        nextStep: nextItem.nextStep,
        notes: nextItem.notes,
        sourceUrl: nextItem.sourceUrl,
        segment: nextItem.segment,
        decisionMaker: nextItem.decisionMaker,
        acv: nextItem.acv,
        expectedCloseDate: nextItem.expectedCloseDate,
        contractTerm: nextItem.contractTerm,
        pilotScope: nextItem.pilotScope,
        athleteCount: nextItem.athleteCount,
        pilotStart: nextItem.pilotStart,
        pilotEnd: nextItem.pilotEnd,
        conversionLikelihood: nextItem.conversionLikelihood,
        grossMargin: nextItem.grossMargin,
        partnerCost: nextItem.partnerCost,
        hardwareCost: nextItem.hardwareCost,
        lossReason: nextItem.lossReason,
        expansionPath: nextItem.expansionPath,
        attachments: nextItem.attachments,
      });
      setEditingItemId(nextItem.id);
      setIsEditorOpen(true);
      setLeadUrl('');
      setLeadExtractMessage(null);
      setIsLeadUrlModalOpen(false);
      setViewMode('pipeline');
      return;
    }

    setIsLeadUrlModalOpen(false);
    setIsAnalyzingLead(true);
    setLeadExtractMessage(null);

    try {
      const bridgeAuthUser = simpBudgetAuth.currentUser || quickLiftsAuth.currentUser;
      const idToken = await bridgeAuthUser?.getIdToken();
      if (!idToken) {
        throw new Error('Please sign in again before analyzing leads.');
      }

      const response = await fetch('/api/pipelists/extract-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          input: cleanInput,
          listName: activeList.name,
          templateLabel: templateCatalog[activeList.templateKey].label,
          templateKey: activeList.templateKey,
          stages: activeList.stages.map((stage) => ({
            id: stage.id,
            label: stage.label,
            probability: stage.probability,
          })),
        }),
      });

      const payload = await readApiJson(response, 'Analyze lead returned an unexpected response. Refresh and try again.');
      if (!response.ok || !payload?.item) {
        throw new Error(payload?.error || 'Unable to analyze that lead.');
      }

      const extracted = payload.item as Partial<PipelineItem> & {
        confidence?: number;
        missingFields?: string[];
      };
      const stage = normalizeStageId(
        extracted.stage || activeList.stages[0]?.id || 'sourced',
        activeList.stages,
      );
      const nextItemBase = createItem(
        {
          ...defaultDraft(stage),
          ...extracted,
          stage,
          priority: extracted.priority || 'medium',
          title: extracted.title?.trim() || fallbackLeadTitleFromInput(cleanInput),
          organization: extracted.organization?.trim() || '',
          contactEmails: normalizeContactEmails(extracted.contactEmails),
          sourceUrl: extracted.sourceUrl?.trim() || normalizeLeadInputUrl(cleanInput)?.toString() || '',
          notes: cleanDealNotes(extracted.notes),
        },
        makeId(),
      );
      const nextItem: PipelineItem = {
        ...nextItemBase,
        weeklyLogs: [
          createSystemLog(
            nextItemBase,
            'item-created',
            `Added ${nextItemBase.title} to ${activeList.name}.`,
          ),
        ],
      };

      setLists((currentLists) =>
        currentLists.map((list) =>
          list.id === activeList.id
            ? {
                ...list,
                items: [nextItem, ...list.items],
              }
            : list,
        ),
      );
      setStageFilter('all');
      setSelectedDetailItemId(nextItem.id);
      setSelectedLogItemId(nextItem.id);
      setDetailModalMode('details');
      setDraft({
        ...defaultDraft(nextItem.stage),
        title: nextItem.title,
        organization: nextItem.organization,
        owner: nextItem.owner,
        contactEmails: nextItem.contactEmails,
        stage: nextItem.stage,
        priority: nextItem.priority,
        amount: nextItem.amount,
        dueDate: nextItem.dueDate,
        nextStep: nextItem.nextStep,
        notes: nextItem.notes,
        sourceUrl: nextItem.sourceUrl,
        segment: nextItem.segment,
        decisionMaker: nextItem.decisionMaker,
        acv: nextItem.acv,
        expectedCloseDate: nextItem.expectedCloseDate,
        contractTerm: nextItem.contractTerm,
        pilotScope: nextItem.pilotScope,
        athleteCount: nextItem.athleteCount,
        pilotStart: nextItem.pilotStart,
        pilotEnd: nextItem.pilotEnd,
        conversionLikelihood: nextItem.conversionLikelihood,
        grossMargin: nextItem.grossMargin,
        partnerCost: nextItem.partnerCost,
        hardwareCost: nextItem.hardwareCost,
        lossReason: nextItem.lossReason,
        expansionPath: nextItem.expansionPath,
        attachments: nextItem.attachments,
      });
      setEditingItemId(nextItem.id);
      setIsEditorOpen(true);
      setLeadUrl('');
      setViewMode('pipeline');
    } catch (error) {
      console.error('[PipeLists] Lead extraction failed:', error);
      setLeadExtractMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to analyze that lead.',
      });
      setIsLeadUrlModalOpen(true);
    } finally {
      setIsAnalyzingLead(false);
    }
  };

  const handleEnrichMissingVcSources = async () => {
    if (!canModify || activeList.templateKey !== 'vc' || isEnrichingVcSources) return;

    const targets = missingVcSourceItems;
    if (targets.length === 0) {
      setVcSourceEnrichmentMessage({ type: 'info', text: 'Every lead in this VC list already has a source link.' });
      return;
    }

    setIsEnrichingVcSources(true);
    setVcSourceEnrichmentMessage({
      type: 'info',
      text: `Analyzing ${formatCount(targets.length, 'VC lead')} with missing source links...`,
    });

    try {
      const bridgeAuthUser = simpBudgetAuth.currentUser || quickLiftsAuth.currentUser;
      const idToken = await bridgeAuthUser?.getIdToken();
      if (!idToken) {
        throw new Error('Please sign in again before analyzing VC leads.');
      }

      const updatesByItemId = new Map<string, Partial<PipelineItem>>();
      let skippedCount = 0;

      for (const item of targets) {
        const searchInput = [
          item.title,
          item.organization && item.organization !== item.title ? item.organization : '',
          'venture capital firm official website investment focus',
        ]
          .filter(Boolean)
          .join(' ');

        try {
          const response = await fetch('/api/pipelists/extract-lead', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              input: searchInput,
              listName: activeList.name,
              templateLabel: templateCatalog[activeList.templateKey].label,
              templateKey: activeList.templateKey,
              stages: activeList.stages.map((stage) => ({
                id: stage.id,
                label: stage.label,
                probability: stage.probability,
              })),
            }),
          });

          const payload = await readApiJson(response, `Analyze lead returned an unexpected response for ${item.title}.`);
          if (!response.ok || !payload?.item) {
            skippedCount += 1;
            continue;
          }

          const extracted = payload.item as Partial<PipelineItem> & {
            contactEmails?: unknown;
          };
          const normalizedSourceUrl = normalizeLeadInputUrl(extracted.sourceUrl?.trim() || '')?.toString() || '';
          if (!normalizedSourceUrl) {
            skippedCount += 1;
            continue;
          }

          updatesByItemId.set(item.id, {
            sourceUrl: normalizedSourceUrl,
            organization: item.organization.trim() ? item.organization : extracted.organization?.trim() || '',
            amount: item.amount.trim() ? item.amount : extracted.amount?.trim() || '',
            segment: item.segment.trim() ? item.segment : extracted.segment?.trim() || '',
            decisionMaker: item.decisionMaker.trim() ? item.decisionMaker : extracted.decisionMaker?.trim() || '',
            nextStep: item.nextStep.trim() ? item.nextStep : extracted.nextStep?.trim() || '',
            notes: item.notes.trim() ? item.notes : cleanDealNotes(extracted.notes),
            contactEmails:
              item.contactEmails.length > 0 ? item.contactEmails : normalizeContactEmails(extracted.contactEmails),
          });
        } catch (error) {
          console.error('[PipeLists] VC source enrichment failed for lead:', item.title, error);
          skippedCount += 1;
        }
      }

      if (updatesByItemId.size > 0) {
        const now = new Date().toISOString();
        setLists((currentLists) =>
          currentLists.map((list) =>
            list.id === activeList.id
              ? {
                  ...list,
                  items: list.items.map((item) => {
                    const update = updatesByItemId.get(item.id);
                    if (!update) return item;

                    const updatedItem = { ...item, ...update, updatedAt: now };
                    return {
                      ...updatedItem,
                      weeklyLogs: [
                        {
                          ...defaultLogDraft(),
                          id: makeId(),
                          type: 'update',
                          weekOf: now.slice(0, 10),
                          summary: `Added source link for ${updatedItem.title}.`,
                          nextStep: '',
                          notes: update.sourceUrl ? `Source: ${update.sourceUrl}` : '',
                          createdAt: now,
                        },
                        ...item.weeklyLogs,
                      ],
                    };
                  }),
                }
              : list,
          ),
        );
      }

      setVcSourceEnrichmentMessage({
        type: updatesByItemId.size > 0 ? 'success' : 'info',
        text:
          updatesByItemId.size > 0
            ? `Added source links to ${formatCount(updatesByItemId.size, 'VC lead')}${
                skippedCount > 0 ? `; ${formatCount(skippedCount, 'lead')} still needs manual review.` : '.'
              }`
            : `No source links were found automatically. ${formatCount(skippedCount, 'lead')} need manual review.`,
      });

      if (updatesByItemId.size > 0) {
        setToastMessage({ type: 'success', text: `Added ${formatCount(updatesByItemId.size, 'source link')}.` });
      }
    } catch (error) {
      console.error('[PipeLists] VC source enrichment failed:', error);
      setVcSourceEnrichmentMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to analyze missing VC source links.',
      });
    } finally {
      setIsEnrichingVcSources(false);
    }
  };

  const handleCreateList = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageWorkspace) return;
    const template = templateCatalog[newListTemplateKey];
    const name = newListName.trim() || template.defaultName;
    const nextList = createList(newListTemplateKey, name, lists.length);

    setLists((currentLists) => [...currentLists, nextList]);
    setActiveListId(nextList.id);
    setStageFilter('all');
    setNewListName('');
    setDraft(defaultDraft(nextList.stages[0]?.id));
    setSelectedLogItemId('');
    setLogDraft(defaultLogDraft(nextList.templateKey));
    setSelectedDetailItemId('');
    setDetailModalMode('details');
    setIsNewListModalOpen(false);
    resetEditor();
  };

  const handleSaveItem = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canModify) return;
    const pendingContactTokens = contactEmailInput
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const invalidPendingContactEmails = pendingContactTokens.filter((email) => !isValidContactEmail(email));
    if (invalidPendingContactEmails.length > 0) {
      setContactEmailError('Enter a valid email address.');
      return;
    }

    const normalizedContactEmails = Array.from(new Set([...draft.contactEmails, ...pendingContactTokens]));
    const inferredContactName = normalizedContactEmails.map(contactNameFromEmail).find(Boolean) || '';
    const draftToSave = {
      ...draft,
      title: isContactListActive && !draft.title.trim() && inferredContactName ? inferredContactName : draft.title,
      contactEmails: normalizedContactEmails,
      notes: cleanDealNotes(draft.notes),
    };
    if (!draftToSave.title.trim() && !draftToSave.organization.trim()) return;
    setContactEmailInput('');
    setContactEmailError('');

    setLists((currentLists) =>
      currentLists.map((list) => {
        if (list.id !== activeList.id) return list;

        if (editingItemId) {
          return {
            ...list,
            items: list.items.map((item) =>
              item.id === editingItemId
                ? {
                    ...item,
                    ...draftToSave,
                    title: draftToSave.title.trim() || item.title,
                    organization: draftToSave.organization.trim(),
                    updatedAt: new Date().toISOString(),
                  }
                : item,
            ),
          };
        }

        const newItemBase = createItem({
          ...draftToSave,
          title: draftToSave.title.trim() || 'Untitled opportunity',
          organization: draftToSave.organization.trim(),
        });
        const newItem: PipelineItem = {
          ...newItemBase,
          weeklyLogs: [
            createSystemLog(
              newItemBase,
              'item-created',
              `Added ${newItemBase.title} to ${list.name}.`,
            ),
          ],
        };

        return {
          ...list,
          items: [newItem, ...list.items],
        };
      }),
    );

    resetEditor();
  };

  const handleEditItem = (item: PipelineItem) => {
    if (!canModify) return;
    const { id, createdAt, updatedAt, weeklyLogs, deletedAt, deletedByLogId, restorableUntil, ...editableItem } = item;
    void id;
    void createdAt;
    void updatedAt;
    void weeklyLogs;
    void deletedAt;
    void deletedByLogId;
    void restorableUntil;
    setDraft({
      ...editableItem,
      contactEmails: normalizeContactEmails(editableItem.contactEmails),
      notes: cleanDealNotes(editableItem.notes),
    });
    setContactEmailInput('');
    setContactEmailError('');
    setEditingItemId(item.id);
    setIsEditorOpen(true);
    setSelectedDetailItemId(item.id);
    setDetailModalMode('details');
  };

  const handleDeleteItem = (itemId: string) => {
    if (!canModify) return;
    const now = new Date();
    const deletedAt = now.toISOString();
    const restorableUntil = addDays(now, SOFT_DELETE_RESTORE_DAYS).toISOString();
    setLists((currentLists) =>
      currentLists.map((list) =>
        list.id === activeList.id
          ? {
              ...list,
              items: list.items.map((item) => {
                if (item.id !== itemId || isItemDeleted(item)) return item;
                const deletionLog = createSystemLog(
                  item,
                  'item-deleted',
                  `Deleted ${item.title} from ${list.name}.`,
                  restorableUntil,
                );
                return {
                  ...item,
                  deletedAt,
                  deletedByLogId: deletionLog.id,
                  restorableUntil,
                  weeklyLogs: [deletionLog, ...item.weeklyLogs],
                  updatedAt: deletedAt,
                };
              }),
            }
          : list,
      ),
    );

    if (editingItemId === itemId) resetEditor();
    if (selectedLogItemId === itemId) setSelectedLogItemId('');
    if (selectedDetailItemId === itemId) {
      setSelectedDetailItemId('');
      setDetailModalMode('details');
    }
  };

  const handleRestoreDeletedItem = (listId: string, itemId: string) => {
    if (!canModify) return;
    const now = new Date().toISOString();

    setLists((currentLists) =>
      currentLists.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((item) => {
                if (item.id !== itemId || !canRestoreDeletedItem(item)) return item;
                return {
                  ...item,
                  deletedAt: '',
                  deletedByLogId: '',
                  restorableUntil: '',
                  weeklyLogs: [
                    createSystemLog(item, 'item-restored', `Restored ${item.title} to ${list.name}.`),
                    ...item.weeklyLogs,
                  ],
                  updatedAt: now,
                };
              }),
            }
          : list,
      ),
    );
    setActiveListId(listId);
    setSelectedDetailItemId(itemId);
    setDetailModalMode('details');
  };

  const handleMoveItem = (itemId: string, targetListId: string) => {
    if (!canModify || !targetListId || targetListId === activeList.id) return;
    if (!isOwner && (!editableListIds.has(activeList.id) || !editableListIds.has(targetListId))) {
      setMoveTargetListId('');
      setLeadMoveMessage({ type: 'error', text: 'You need edit access on both PipeLists to move this lead.' });
      return;
    }

    const sourceList = lists.find((list) => list.id === activeList.id);
    const targetList = lists.find((list) => list.id === targetListId);
    const itemToMove = sourceList?.items.find((item) => item.id === itemId);

    if (!sourceList || !targetList || !itemToMove || isItemDeleted(itemToMove)) {
      setMoveTargetListId('');
      setLeadMoveMessage({ type: 'error', text: 'Unable to move this lead.' });
      return;
    }

    const now = new Date().toISOString();
    const targetStage = normalizeStageId(itemToMove.stage, targetList.stages);
    const movedItem: PipelineItem = {
      ...itemToMove,
      stage: targetStage,
      updatedAt: now,
      weeklyLogs: [
        createSystemLog(
          itemToMove,
          'item-moved',
          `Moved ${itemToMove.title} from ${sourceList.name} to ${targetList.name}.`,
        ),
        ...itemToMove.weeklyLogs,
      ],
    };

    setLists((currentLists) => {
      return currentLists.map((list) => {
        if (list.id === sourceList.id) {
          return {
            ...list,
            items: list.items.filter((item) => item.id !== itemId),
          };
        }

        if (list.id === targetList.id) {
          const withoutExistingCopy = list.items.filter((item) => item.id !== itemId);
          return {
            ...list,
            items: [movedItem, ...withoutExistingCopy],
          };
        }

        return list;
      });
    });

    if (editingItemId === itemId) resetEditor();
    setActiveListId(targetListId);
    setStageFilter('all');
    setQuery('');
    setSelectedDetailItemId(itemId);
    setSelectedLogItemId(itemId);
    setDetailModalMode('details');
    setMoveTargetListId('');
    setLeadMoveMessage({
      type: 'success',
      text: `Moved ${movedItem.title} from ${sourceList.name} to ${targetList.name}.`,
    });
  };

  const handleDeleteList = () => {
    if (!canManageActiveList) return;
    if (lists.length <= 1) return;

    const nextLists = lists.filter((list) => list.id !== activeList.id);
    setLists(nextLists);
    setActiveListId(nextLists[0].id);
    setStageFilter('all');
    setSelectedLogItemId('');
    setLogDraft(defaultLogDraft(nextLists[0].templateKey));
    setSelectedDetailItemId('');
    setDetailModalMode('details');
    setIsDeleteListModalOpen(false);
    resetEditor();
  };

  const handleSaveLog = (
    event: React.FormEvent<HTMLFormElement>,
    options: { listId?: string; itemId?: string; closeOnSave?: boolean } = {},
  ) => {
    event.preventDefault();
    if (!canModify) return;
    const targetListId = options.listId || activeList.id;
    const targetList = lists.find((list) => list.id === targetListId);
    const targetItemId = options.itemId || selectedLogItem?.id || '';
    if (!targetList || !targetItemId) return;
    const hasMetricInput = Boolean(
      logDraft.rosteredAthletes ||
        logDraft.completedCheckIns ||
        logDraft.checkInRate ||
        logDraft.biometricSyncRate ||
        logDraft.signalEvents ||
        logDraft.noraEngagementRate ||
        logDraft.noraSessions ||
        logDraft.escalations ||
        logDraft.staffFeedbackScore,
    );
    if (!logDraft.summary.trim() && !logDraft.notes.trim() && !logDraft.nextStep.trim() && !hasMetricInput) return;

    const nextLog: ActivityLog = {
      ...logDraft,
      summary: logDraft.summary.trim(),
      nextStep: logDraft.nextStep.trim(),
      notes: logDraft.notes.trim(),
      id: makeId(),
      createdAt: new Date().toISOString(),
    };

    setLists((currentLists) =>
      currentLists.map((list) =>
        list.id === targetList.id
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === targetItemId
                  ? {
                      ...item,
                      weeklyLogs: [nextLog, ...item.weeklyLogs],
                      updatedAt: new Date().toISOString(),
                    }
                  : item,
              ),
            }
          : list,
      ),
    );
    setLogDraft(defaultLogDraft(targetList.templateKey));
    if (options.closeOnSave) {
      setIsLogModalOpen(false);
    }
  };

  const handleDeleteLog = (itemId: string, logId: string, listId = activeList.id) => {
    if (!canModify) return;
    setLists((currentLists) =>
      currentLists.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      weeklyLogs: item.weeklyLogs.filter((log) => log.id !== logId),
                    }
                  : item,
              ),
            }
          : list,
      ),
    );
  };

  const handleExport = () => {
    if (typeof window === 'undefined') return;

    const rows = [
      [
        'List',
        'Template',
        'Title',
        'Organization',
        'Stage',
        'Importance',
        'Owner',
        'Contact Emails',
        'Segment',
        'Decision Maker',
        'ACV',
        'Amount',
        'Expected Close Date',
        'Due Date',
        'Scope',
        'Count',
        'Margin Notes',
        'Partner Cost',
        'Hard Cost',
        'Next Step',
        'Expansion Path',
        'Loss Reason',
        'Notes',
        'Source URL',
        'Attachments',
      ],
      ...activeListItems.map((item) => {
        const stage = getStage(activeList, item.stage);
        return [
          activeList.name,
          templateCatalog[activeList.templateKey].label,
          item.title,
          item.organization,
          stage.label,
          item.priority,
          item.owner,
          item.contactEmails.join('\n'),
          item.segment,
          item.decisionMaker,
          item.acv,
          item.amount,
          item.expectedCloseDate,
          item.dueDate,
          item.pilotScope,
          item.athleteCount,
          item.grossMargin,
          item.partnerCost,
          item.hardwareCost,
          item.nextStep,
          item.expansionPath,
          item.lossReason,
          item.notes,
          item.sourceUrl,
          item.attachments.map((attachment) => `${attachment.name}: ${attachment.url}`).join('\n'),
        ];
      }),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeList.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-pipeline.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const normalizeEmailList = (value: string) =>
    Array.from(
      new Set(
        value
          .split(/[\n,;]/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

  const selectedShareLists = lists.filter((list) => shareSelectedListIds.includes(list.id));
  const selectedShareListIds = selectedShareLists.length > 0 ? selectedShareLists.map((list) => list.id) : [activeList.id];
  const inviteHistory = useMemo(() => {
    const selectedIds = new Set(selectedShareListIds);
    const shareDocsById = new Map<string, PipeListShare>();
    ownerShareDocs.forEach((share) => shareDocsById.set(share.id, share));
    if (shareDoc) shareDocsById.set(shareDoc.id, shareDoc);

    const grouped = new Map<string, InviteHistoryEntry>();

    Array.from(shareDocsById.values())
      .filter((share) => selectedIds.has(share.list.id))
      .forEach((share) => {
        Object.values(share.inviteStatuses).forEach((invite) => {
          const existing = grouped.get(invite.email);
          const nextAccess: ShareAccess = invite.access === 'edit' || existing?.access === 'edit' ? 'edit' : 'read';
          const nextStatus = invite.status === 'accepted' || existing?.status === 'accepted' ? 'accepted' : 'sent';
          const origin = typeof window !== 'undefined' ? window.location.origin : 'https://fitwithpulse.ai';
          const inviteUrl =
            existing?.inviteUrl ||
            `${origin}/PipeLists?invite=${encodeURIComponent(share.id)}${
              invite.inviteId ? `&inviteBatch=${encodeURIComponent(invite.inviteId)}` : ''
            }&inviteEmail=${encodeURIComponent(invite.email)}`;
          grouped.set(invite.email, {
            email: invite.email,
            access: nextAccess,
            status: nextStatus,
            sentAt: existing?.sentAt || invite.sentAt,
            acceptedAt: existing?.acceptedAt || invite.acceptedAt,
            listNames: Array.from(new Set([...(existing?.listNames || []), share.list.name])),
            shareIds: Array.from(new Set([...(existing?.shareIds || []), share.id])),
            inviteUrl,
          });
        });
      });

    return Array.from(grouped.values()).sort((left, right) => {
      if (left.status !== right.status) return left.status === 'sent' ? -1 : 1;
      return left.email.localeCompare(right.email);
    });
  }, [activeList.id, ownerShareDocs, selectedShareListIds, shareDoc]);
  const moveTargetLists = lists.filter((list) => list.id !== activeList.id && (isOwner || editableListIds.has(list.id)));
  const collaboratorAccountEmails = normalizeEmailList(shareEditorEmails);
  const filteredCollaboratorProfiles = useMemo(() => {
    const search = collaboratorSearch.trim().toLowerCase();
    if (!search) return searchableProfiles.slice(0, 6);

    return searchableProfiles
      .filter((account) =>
        [account.displayName, account.email]
          .join(' ')
          .toLowerCase()
          .includes(search),
      )
      .slice(0, 6);
  }, [collaboratorSearch, searchableProfiles]);

  const openSharePanel = () => {
    setShareSelectedListIds([activeList.id]);
    setCollaboratorSearch('');
    setProfileSearchMessage(null);
    setIsSharePanelOpen(true);
  };

  const toggleShareListSelection = (listId: string) => {
    setShareSelectedListIds((currentIds) => {
      if (currentIds.includes(listId)) {
        return currentIds.length > 1 ? currentIds.filter((id) => id !== listId) : currentIds;
      }

      return [...currentIds, listId];
    });
  };

  const addCollaboratorEmail = (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setShareEditorEmails((currentValue) => Array.from(new Set([...normalizeEmailList(currentValue), cleanEmail])).join(', '));
    setCollaboratorSearch('');
  };

  const copyInviteUrl = async (inviteUrl: string) => {
    try {
      await writeClipboardText(inviteUrl);
      setToastMessage({ type: 'success', text: 'Copied invite link to clipboard.' });
    } catch {
      setToastMessage({ type: 'error', text: 'Unable to copy invite link.' });
    }
  };

  const sendCollaboratorInviteEmail = async (args: {
    email: string;
    inviteUrl: string;
    listNames: string[];
    access: ShareAccess;
    inviteBatchId: string;
  }) => {
    if (!user) throw new Error('Please sign in again.');

    const idToken = await user.getIdToken();
    const response = await fetch('/api/pipelists/send-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        toEmail: args.email,
        inviteUrl: args.inviteUrl,
        listNames: args.listNames,
        access: args.access,
        ownerName: profile?.displayName || user.displayName || 'Tremaine Grant',
        ownerEmail: user.email || TREMAINE_OWNER_EMAIL,
        inviteBatchId: args.inviteBatchId,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) {
      throw new Error(result?.error || `Unable to email ${args.email}.`);
    }
  };

  const resendInviteEmail = async (invite: InviteHistoryEntry) => {
    if (!user || !isOwner) return;

    setShareMessage(null);
    setResendingInviteEmails((currentEmails) => Array.from(new Set([...currentEmails, invite.email])));

    try {
      const inviteBatchId = makeId();
      await sendCollaboratorInviteEmail({
        email: invite.email,
        inviteUrl: invite.inviteUrl,
        listNames: invite.listNames,
        access: invite.access,
        inviteBatchId,
      });

      await Promise.all(
        invite.shareIds.map((shareId) =>
          setDoc(
            doc(simpBudgetDb, PIPELIST_SHARES_COLLECTION, shareId),
            stripUndefined({
              inviteStatuses: {
                [invite.email]: {
                  email: invite.email,
                  access: invite.access,
                  status: invite.status,
                  sentAt: serverTimestamp(),
                },
              },
              updatedAt: serverTimestamp(),
            }),
            { merge: true },
          ),
        ),
      );

      setOwnerShareDocs((currentShares) =>
        currentShares.map((share) =>
          invite.shareIds.includes(share.id)
            ? {
                ...share,
                inviteStatuses: {
                  ...share.inviteStatuses,
                  [invite.email]: {
                    ...(share.inviteStatuses[invite.email] || invite),
                    email: invite.email,
                    access: invite.access,
                    status: invite.status,
                    sentAt: new Date().toISOString(),
                  },
                },
              }
            : share,
        ),
      );
      setShareMessage({ type: 'success', text: `Invite resent to ${invite.email}.` });
    } catch (error) {
      console.error('Unable to resend PipeLists invite:', error);
      setShareMessage({
        type: 'error',
        text: error instanceof Error ? error.message : readFirestoreError(error, 'Unable to resend this invite.'),
      });
    } finally {
      setResendingInviteEmails((currentEmails) => currentEmails.filter((email) => email !== invite.email));
    }
  };

  useEffect(() => {
    if (!isSharePanelOpen || !isOwner || !user) return;

    let cancelled = false;

    const loadProfiles = async () => {
      setLoadingProfiles(true);
      setProfileSearchMessage(null);

      try {
        const profileSnapshot = await getDocs(collection(simpBudgetDb, PIPELIST_PROFILES_COLLECTION));
        const profiles = profileSnapshot.docs
          .map((profileDoc) => {
            const data = profileDoc.data() as Partial<PipeListProfile>;
            return {
              uid: profileDoc.id,
              displayName: data.displayName || '',
              photoURL: data.photoURL || '',
              email: data.email || '',
              updatedAt: data.updatedAt,
            };
          })
          .filter((account) => account.email && account.email.toLowerCase() !== normalizedUserEmail)
          .sort((left, right) => (left.displayName || left.email).localeCompare(right.displayName || right.email));

        if (!cancelled) setSearchableProfiles(profiles);
      } catch (error) {
        console.error('Unable to search PipeLists profiles:', error);
        if (!cancelled) {
          setSearchableProfiles([]);
          setProfileSearchMessage({
            type: 'error',
            text: readFirestoreError(error, 'Unable to load existing PipeLists accounts.'),
          });
        }
      } finally {
        if (!cancelled) setLoadingProfiles(false);
      }
    };

    loadProfiles();

    return () => {
      cancelled = true;
    };
  }, [isOwner, isSharePanelOpen, normalizedUserEmail, user]);

  const createOrUpdateShareLink = async () => {
    if (!user || !isOwner || isSharedView) return;

    setShareMessage(null);

    try {
      const targetLists = selectedShareLists.length > 0 ? selectedShareLists : [activeList];
      const accountEmails = collaboratorAccountEmails;
      const editorEmails = shareAccess === 'edit' ? accountEmails : [];
      const viewerEmails = shareAccess === 'read' ? accountEmails : [];
      if (accountEmails.length === 0) {
        setShareMessage({ type: 'error', text: 'Add at least one collaborator email first.' });
        return;
      }

      const inviteBatchId = makeId();
      const payloads = targetLists.map((list) => {
        const id = shareDocumentIdForList(user.uid, list.id);
        const existingShare = ownerShareDocs.find((share) => share.id === id) || (shareDoc?.id === id ? shareDoc : null);
        return {
          id,
          ownerUid: user.uid,
          ownerEmail: user.email || TREMAINE_OWNER_EMAIL,
          list,
          access: shareAccess,
          publicRead: true,
          viewerEmails,
          editorEmails,
          inviteStatuses: accountEmails.reduce<Record<string, InviteStatus>>(
            (statuses, email) => {
              statuses[email] = {
                ...(statuses[email] || {}),
                email,
                access: shareAccess,
                status: 'sent',
                inviteId: inviteBatchId,
                sentAt: serverTimestamp(),
              };
              return statuses;
            },
            { ...(existingShare?.inviteStatuses || {}) },
          ),
        } satisfies PipeListShare;
      });

      await Promise.all(
        payloads.map((payload) =>
          setDoc(
            doc(simpBudgetDb, PIPELIST_SHARES_COLLECTION, payload.id),
            stripUndefined({
              ...payload,
              createdAt:
                ownerShareDocs.find((existingShare) => existingShare.id === payload.id)?.createdAt ||
                (payload.id === shareDoc?.id ? shareDoc.createdAt : undefined) ||
                serverTimestamp(),
              updatedAt: serverTimestamp(),
            }),
            { merge: true },
          ),
        ),
      );

      const activePayload = payloads.find((payload) => payload.list.id === activeList.id) || payloads[0];
      setShareDoc(activePayload);
      if (typeof window !== 'undefined') {
        await Promise.all(
          accountEmails.map(async (email) => {
            const invitePath = `/PipeLists?invite=${encodeURIComponent(activePayload.id)}&inviteBatch=${encodeURIComponent(inviteBatchId)}&inviteEmail=${encodeURIComponent(email)}`;
            const inviteUrl = `${window.location.origin}${invitePath}`;
            await sendCollaboratorInviteEmail({
              email,
              inviteUrl,
              listNames: targetLists.map((list) => list.name),
              access: shareAccess,
              inviteBatchId,
            });
          }),
        );
      }
      setOwnerShareDocs((currentShares) => {
        const sharesById = new Map(currentShares.map((share) => [share.id, share]));
        payloads.forEach((payload) => sharesById.set(payload.id, payload));
        return Array.from(sharesById.values());
      });
      setShareMessage({
        type: 'success',
        text:
          shareAccess === 'edit'
            ? `Editor invite emailed to ${formatCount(accountEmails.length, 'person')} for ${formatCount(targetLists.length, 'PipeList')}.`
            : `Read-only invite emailed to ${formatCount(accountEmails.length, 'person')} for ${formatCount(targetLists.length, 'PipeList')}.`,
      });
    } catch (error) {
      console.error('Unable to create PipeLists share link:', error);
      setShareMessage({
        type: 'error',
        text: error instanceof Error ? error.message : readFirestoreError(error, 'Unable to create this share link.'),
      });
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    const cleanName = profileName.trim();
    if (!cleanName) {
      setProfileMessage({ type: 'error', text: 'Add your name first.' });
      return;
    }

    setSavingProfile(true);
    setProfileMessage(null);

    try {
      let photoURL = profile?.photoURL || user.photoURL || '';

      if (profilePhotoFile) {
        const profileRef = storageRef(simpBudgetStorage, `pipelists-profiles/${user.uid}/avatar-${Date.now()}-${profilePhotoFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`);
        await uploadBytes(profileRef, profilePhotoFile, {
          contentType: profilePhotoFile.type || 'image/png',
        });
        photoURL = await getDownloadURL(profileRef);
      }

      const nextProfile: PipeListProfile = {
        displayName: cleanName,
        photoURL,
        email: user.email || '',
      };

      await setDoc(
        doc(simpBudgetDb, PIPELIST_PROFILES_COLLECTION, user.uid),
        stripUndefined({
          ...nextProfile,
          updatedAt: serverTimestamp(),
        }),
        { merge: true },
      );

      setProfile(nextProfile);
      setProfilePhotoFile(null);
      setProfileMessage({ type: 'success', text: 'Profile saved.' });
    } catch (error) {
      console.error('Unable to save PipeLists profile:', error);
      setProfileMessage({
        type: 'error',
        text: readFirestoreError(error, 'Unable to save your profile.'),
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthMessage(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      if (shouldUseRedirectSignIn()) {
        setAuthMessage({ type: 'info', text: 'Opening Google sign-in...' });
        await signInWithRedirect(simpBudgetAuth, provider);
        return;
      }

      const result = await signInWithPopup(simpBudgetAuth, provider);
      const email = result.user.email?.toLowerCase() || '';
      if (
        isSharedView &&
        shareDoc?.access === 'edit' &&
        email !== shareDoc.ownerEmail.toLowerCase() &&
        !shareDoc.editorEmails.map((editorEmail) => editorEmail.toLowerCase()).includes(email)
      ) {
        setAuthMessage({
          type: 'info',
          text: 'You are signed in and can view this list, but this email was not granted edit access.',
        });
      }
    } catch (error) {
      console.error('PipeLists Google sign-in failed:', error);
      setAuthMessage({
        type: 'error',
        text: readAuthError(error, 'Unable to sign in with Google.'),
      });
    }
  };

  const sendMagicLink = async () => {
    const email = magicEmail.trim().toLowerCase();
    if (!email) {
      setAuthMessage({ type: 'error', text: 'Enter an email address first.' });
      return;
    }

    if (
      isSharedView &&
      shareDoc?.access === 'edit' &&
      email !== shareDoc.ownerEmail.toLowerCase() &&
      !shareDoc.editorEmails.map((editorEmail) => editorEmail.toLowerCase()).includes(email)
    ) {
      setAuthMessage({ type: 'error', text: 'This email was not granted edit access for this shared list.' });
      return;
    }

    setSendingMagicLink(true);
    setAuthMessage(null);

    try {
      const path = shareId ? `/PipeLists?share=${encodeURIComponent(shareId)}` : '/PipeLists';
      const actionCodeSettings = {
        url: typeof window !== 'undefined' ? window.location.origin + path : `https://fitwithpulse.ai${path}`,
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(simpBudgetAuth, email, actionCodeSettings);
      window.localStorage.setItem(MAGIC_LINK_EMAIL_STORAGE_KEY, email);
      setAuthMessage({ type: 'success', text: 'Magic link sent. Open it on this device to finish sign-in.' });
    } catch (error) {
      console.error('Unable to send PipeLists magic link:', error);
      setAuthMessage({
        type: 'error',
        text: readAuthError(error, 'Unable to send magic link.'),
      });
    } finally {
      setSendingMagicLink(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(simpBudgetAuth);
    setUser(null);
    setDataReady(isSharedView);
    setAuthMessage(null);
  };

  const renderMetricCard = (
    label: string,
    value: string,
    helper: string,
    icon: React.ReactNode,
    tone = 'bg-stone-100 text-stone-600',
  ) => (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full ${tone}`}>{icon}</div>
      <p className="text-2xl font-semibold text-stone-950">{value}</p>
      <p className="mt-1 text-sm font-medium text-stone-600">{label}</p>
      <p className="mt-1 text-xs leading-5 text-stone-400">{helper}</p>
    </div>
  );

  const selectedDetailStage = selectedDetailItem ? getStage(activeList, selectedDetailItem.stage) : null;
  const selectedDetailIsEditing = Boolean(selectedDetailItem && isEditorOpen && editingItemId === selectedDetailItem.id);
  const shouldBlockEditShare = isSharedView && shareDoc?.access === 'edit' && !canEditShared;

  const isEmptyDetailValue = (value: React.ReactNode) =>
    value === null || value === undefined || value === false || (typeof value === 'string' && value.trim() === '');

  const renderDetailField = (label: string, value: React.ReactNode, wide = false, showWhenEmpty = false) => {
    const isEmpty = isEmptyDetailValue(value);
    if (isEmpty && !showWhenEmpty) return null;

    return (
      <div key={label} className={`rounded-md border border-stone-100 bg-[#FAFAF7] px-3 py-2 ${wide ? 'md:col-span-2' : ''}`}>
        <p className="text-xs font-semibold uppercase text-stone-400">{label}</p>
        <div className="mt-1 break-words text-sm leading-6 text-stone-700">{isEmpty ? 'Not set' : value}</div>
      </div>
    );
  };

  const renderDetailGrid = (
    className: string,
    fields: { label: string; value: React.ReactNode; wide?: boolean; showWhenEmpty?: boolean }[],
  ) => {
    const renderedFields = fields
      .map((field) => renderDetailField(field.label, field.value, field.wide, field.showWhenEmpty))
      .filter((field): field is React.ReactElement => Boolean(field));

    if (renderedFields.length === 0) return null;

    return <div className={className}>{renderedFields}</div>;
  };

  const renderDetailSection = (
    title: string,
    fields: { label: string; value: React.ReactNode; wide?: boolean; showWhenEmpty?: boolean }[],
    gridClassName = 'grid gap-3 md:grid-cols-2',
  ) => {
    const grid = renderDetailGrid(gridClassName, fields);
    if (!grid) return null;

    return (
      <div>
        <h4 className="mb-3 text-sm font-semibold text-stone-950">{title}</h4>
        {grid}
      </div>
    );
  };

  const renderItemEditor = () => (
    <form id="pipe-item-editor-form" onSubmit={handleSaveItem} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(isContactListActive
          ? [
              ['title', 'Contact Name', 'Name'],
              ['organization', 'Role / Organization', 'Partner, investor, advisor'],
              ['owner', 'Relationship Owner', 'Owner'],
              ['segment', 'Segment', 'Investor, operator, advisor'],
              ['decisionMaker', 'Relationship Context', 'How they know us or why they matter'],
              ['expectedCloseDate', isInvestorUpdateContactsList ? 'Next Update Date' : 'Next Touchpoint', 'date'],
              ['pilotStart', 'First Contacted', 'date'],
              ['pilotEnd', 'Last Contacted', 'date'],
              ...(isInvestorUpdateContactsList ? [['athleteCount', 'Update Cadence', 'Monthly, quarterly']] : []),
              ['contactPhone', 'Phone', 'Public business phone'],
              ['linkedinUrl', 'LinkedIn URL', 'https://linkedin.com/in/...'],
              ['sourceUrl', 'Source URL', 'https://example.com'],
            ]
          : [
              ['title', 'Opportunity Name', 'Opportunity name'],
              ['organization', 'Organization', 'Company, school, fund'],
              ['owner', 'Owner', 'Owner'],
              ['segment', 'Segment', 'Category, fit, or type'],
              ['decisionMaker', 'Decision Maker', 'Role or name'],
              ['acv', 'ACV', '$'],
              ['amount', amountFieldLabelForList(activeList), '$'],
              ['expectedCloseDate', 'Expected Close', 'date'],
              ['contractTerm', 'Contract Term', '12 months'],
              ['pilotStart', 'Start Date', 'date'],
              ['pilotEnd', 'End Date', 'date'],
              ['athleteCount', 'Count', '42'],
              ['sourceUrl', 'Source URL', 'https://example.com'],
            ]).map(([key, label, placeholder]) => (
          <label key={key} className={key === 'sourceUrl' || key === 'linkedinUrl' ? 'block md:col-span-2' : 'block'} htmlFor={`pipe-${key}`}>
            <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">{label}</span>
            <input
              id={`pipe-${key}`}
              type={placeholder === 'date' ? 'date' : key === 'sourceUrl' || key === 'linkedinUrl' ? 'url' : 'text'}
              value={String(draft[key as keyof ItemDraft] || '')}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
              className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
              placeholder={placeholder === 'date' ? undefined : placeholder}
            />
          </label>
        ))}

        {isInvestorUpdateContactsList ? (
          <label className="block" htmlFor="pipe-email-status">
            <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Email Status</span>
            <select
              id="pipe-email-status"
              value={normalizeContactEmailStatusInput(draft.emailStatus || draft.lastEmailEvent)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  emailStatus: event.target.value,
                }))
              }
              className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
            >
              {contactEmailStatusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block" htmlFor="pipe-stage">
            <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Stage</span>
            <select
              id="pipe-stage"
              value={draft.stage}
              onChange={(event) => setDraft((current) => ({ ...current, stage: event.target.value }))}
              className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
            >
              {activeList.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {isContactListActive && !isInvestorUpdateContactsList && (
          <label className="block" htmlFor="pipe-email-status">
            <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Email Status</span>
            <select
              id="pipe-email-status"
              value={normalizeContactEmailStatusInput(draft.emailStatus || draft.lastEmailEvent)}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  emailStatus: event.target.value,
                }))
              }
              className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
            >
              {contactEmailStatusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block" htmlFor="pipe-priority">
          <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Importance</span>
          <select
            id="pipe-priority"
            value={draft.priority}
            onChange={(event) =>
              setDraft((current) => ({ ...current, priority: event.target.value as PipelinePriority }))
            }
            className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm capitalize outline-none transition focus:border-stone-400 focus:bg-white"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label className="block" htmlFor="pipe-dueDate">
          <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">{isContactListActive ? 'Follow-Up Date' : 'Due Date'}</span>
          <input
            id="pipe-dueDate"
            type="date"
            value={draft.dueDate}
            onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
            className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
          />
        </label>
      </div>

      <label className="block" htmlFor="pipe-contact-emails">
        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Contact Email</span>
        <div
          className={`flex min-h-11 flex-wrap items-center gap-2 rounded-md border bg-[#FAFAF7] px-2 py-2 transition focus-within:bg-white ${
            contactEmailError ? 'border-rose-300' : 'border-stone-200 focus-within:border-stone-400'
          }`}
        >
          {draft.contactEmails.map((email) => (
            <span
              key={email}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-white px-2.5 text-xs font-semibold text-stone-700 ring-1 ring-stone-200"
            >
              {email}
              <button
                type="button"
                onClick={() => removeContactEmail(email)}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-950"
                aria-label={`Remove ${email}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            id="pipe-contact-emails"
            type="text"
            inputMode="email"
            value={contactEmailInput}
            onChange={(event) => {
              setContactEmailInput(event.target.value);
              if (contactEmailError) setContactEmailError('');
            }}
            onKeyDown={(event) => {
              if (event.key === ',' || event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                addContactEmailTokens(contactEmailInput);
              }
            }}
            onPaste={(event) => {
              const pastedText = event.clipboardData.getData('text');
              if (/[\s,;]/.test(pastedText)) {
                event.preventDefault();
                addContactEmailTokens(`${contactEmailInput} ${pastedText}`);
              }
            }}
            onBlur={() => {
              if (contactEmailInput.trim()) addContactEmailTokens(contactEmailInput);
            }}
            className="h-7 min-w-44 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-stone-400"
            placeholder={draft.contactEmails.length > 0 ? 'Add another email' : 'name@example.com'}
          />
        </div>
        {contactEmailError ? (
          <span className="mt-1.5 block text-xs font-medium text-rose-600">{contactEmailError}</span>
        ) : (
          <span className="mt-1.5 block text-xs text-stone-400">Use comma or space to add each email.</span>
        )}
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        {[
          ['pilotScope', 'Scope', 'Timeline, scope, requirements, and commitments'],
          ['nextStep', 'Next Step', 'The next action that moves this forward'],
          ['grossMargin', 'Margin Notes', 'Revenue, costs, or margin context'],
          ['partnerCost', 'Partner Cost', 'Partner, implementation, or service share'],
          ['hardwareCost', 'Hard Cost', 'Hardware, fulfillment, or delivery costs'],
          ['expansionPath', 'Expansion Path', 'Renewal, upsell, or next relationship path'],
          ['lossReason', 'Loss Reason', 'Only if paused or closed lost'],
          ['notes', 'Notes', 'Context'],
        ].map(([key, label, placeholder]) => (
          <label key={key} className={key === 'notes' ? 'block md:col-span-2' : 'block'} htmlFor={`pipe-${key}`}>
            <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">{label}</span>
            <textarea
              id={`pipe-${key}`}
              value={String(draft[key as keyof ItemDraft] || '')}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
              className="min-h-20 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
              placeholder={placeholder}
            />
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-stone-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        {editingItemId ? (
          <button
            type="button"
            onClick={() => handleDeleteItem(editingItemId)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete Item
          </button>
        ) : (
          <span />
        )}
      </div>
    </form>
  );

  if (isSharedView && !dataReady) {
    return (
      <>
        <PageHead
          metaData={{
            pageId: 'pipe-lists-shared-loading',
            pageTitle: 'Shared PipeList - Pulse',
            metaDescription: 'Loading shared PipeList.',
            ogTitle: 'Shared PipeList - Pulse',
            ogDescription: 'Loading shared PipeList.',
            lastUpdated: new Date().toISOString(),
          }}
          pageOgUrl="https://fitwithpulse.ai/PipeLists"
          pageOgImage="/pil-og.png"
        />
        <main className="flex min-h-screen items-center justify-center bg-[#FAFAF7] px-6 text-stone-900">
          <div className="text-center">
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-stone-200 border-t-stone-900" />
            <p className="text-base font-semibold text-stone-950">
              {isLeadSharedView ? 'Loading shared lead' : 'Loading shared PipeList'}
            </p>
          </div>
        </main>
      </>
    );
  }

  if (isSharedView && shareMessage?.type === 'error' && !shareDoc && !leadShareDoc) {
    return (
      <>
        <PageHead
          metaData={{
            pageId: 'pipe-lists-share-error',
            pageTitle: 'Shared PipeList - Pulse',
            metaDescription: 'Shared PipeList unavailable.',
            ogTitle: 'Shared PipeList - Pulse',
            ogDescription: 'Shared PipeList unavailable.',
            lastUpdated: new Date().toISOString(),
          }}
          pageOgUrl="https://fitwithpulse.ai/PipeLists"
          pageOgImage="/pil-og.png"
        />
        <main className="flex min-h-screen items-center justify-center bg-[#FAFAF7] px-6 text-stone-900">
          <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-5 text-center shadow-sm">
            <p className="text-base font-semibold text-stone-950">Share link unavailable</p>
            <p className="mt-2 text-sm leading-6 text-stone-500">{shareMessage.text}</p>
          </div>
        </main>
      </>
    );
  }

  if (isSharedView && shareDoc?.access === 'edit' && user && canEditShared && !profile?.displayName) {
    return (
      <>
        <PageHead
          metaData={{
            pageId: 'pipe-lists-profile',
            pageTitle: 'PipeLists Profile - Pulse',
            metaDescription: 'Complete your PipeLists editor profile.',
            ogTitle: 'PipeLists Profile - Pulse',
            ogDescription: 'Complete your PipeLists editor profile.',
            lastUpdated: new Date().toISOString(),
          }}
          pageOgUrl="https://fitwithpulse.ai/PipeLists"
          pageOgImage="/pil-og.png"
        />
        <ProfileSetup
          user={user}
          profileName={profileName}
          profilePhotoFile={profilePhotoFile}
          saving={savingProfile}
          message={profileMessage}
          onProfileNameChange={setProfileName}
          onProfilePhotoFileChange={setProfilePhotoFile}
          onSave={saveProfile}
          onSignOut={handleSignOut}
        />
      </>
    );
  }

  if (!isSharedView && (!authReady || !user)) {
    return (
      <>
        <PageHead
          metaData={{
            pageId: 'pipe-lists-login',
            pageTitle: 'PipeLists Login - Pulse',
            metaDescription: 'Private PipeLists login for Pulse Intelligence Labs RevOps.',
            ogTitle: 'PipeLists Login - Pulse',
            ogDescription: 'Private PipeLists login for Pulse Intelligence Labs RevOps.',
            lastUpdated: new Date().toISOString(),
          }}
          pageOgUrl="https://fitwithpulse.ai/PipeLists"
          pageOgImage="/pil-og.png"
        />
        <PipeListsLogin
          authReady={authReady}
          authMessage={authMessage}
          magicEmail={magicEmail}
          sendingMagicLink={sendingMagicLink}
          onMagicEmailChange={setMagicEmail}
          onGoogleSignIn={handleGoogleSignIn}
          onSendMagicLink={sendMagicLink}
        />
      </>
    );
  }

  if (!isSharedView && !dataReady) {
    return (
      <>
        <PageHead
          metaData={{
            pageId: 'pipe-lists-loading',
            pageTitle: 'PipeLists - Pulse',
            metaDescription: 'Loading your private PipeLists workspace.',
            ogTitle: 'PipeLists - Pulse',
            ogDescription: 'Loading your private PipeLists workspace.',
            lastUpdated: new Date().toISOString(),
          }}
          pageOgUrl="https://fitwithpulse.ai/PipeLists"
          pageOgImage="/pil-og.png"
        />
        <main className="flex min-h-screen items-center justify-center bg-[#FAFAF7] px-6 text-stone-900">
          <div className="text-center">
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-stone-200 border-t-stone-900" />
            <p className="text-base font-semibold text-stone-950">Loading PipeLists</p>
            <p className="mt-1 text-sm text-stone-500">Fetching your RevOps workspace from Firebase.</p>
          </div>
        </main>
      </>
    );
  }

  if (!isSharedView && dataReady && user && !isOwner && lists.length === 0) {
    return (
      <>
        <PageHead
          metaData={{
            pageId: 'pipe-lists-no-access',
            pageTitle: 'PipeLists Access - Pulse',
            metaDescription: 'PipeLists account access.',
            ogTitle: 'PipeLists Access - Pulse',
            ogDescription: 'PipeLists account access.',
            lastUpdated: new Date().toISOString(),
          }}
          pageOgUrl="https://fitwithpulse.ai/PipeLists"
          pageOgImage="/pil-og.png"
        />
        <main className="flex min-h-screen items-center justify-center bg-[#FAFAF7] px-6 text-stone-900">
          <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-5 text-center shadow-sm">
            <div className="mx-auto mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-700">
              <Users className="h-4 w-4" />
            </div>
            <p className="text-base font-semibold text-stone-950">No PipeLists shared yet</p>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              You are signed in as {user.email || 'this account'}, but no PipeLists have been shared with this email.
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
            >
              Sign out
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHead
        metaData={{
          pageId: 'pipe-lists',
          pageTitle: 'PipeLists - Pulse',
          metaDescription: 'A clean RevOps pipeline management surface for Pulse opportunities.',
          ogTitle: 'PipeLists - Pulse',
          ogDescription: 'A clean RevOps pipeline management surface for Pulse opportunities.',
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl="https://fitwithpulse.ai/PipeLists"
        pageOgImage="/pil-og.png"
      />

      <main className="min-h-screen bg-[#FAFAF7] text-stone-900">
        <nav className="sticky top-0 z-40 border-b border-stone-200/70 bg-[#FAFAF7]/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Pulse home">
              <img src="/pulse-logo.svg" alt="Pulse" className="h-8 shrink-0" />
              <span className="hidden text-sm font-medium text-stone-500 sm:inline">PipeLists</span>
            </Link>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-500 shadow-sm md:flex">
                <span className={`h-2 w-2 rounded-full ${savingToCloud ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                <span>
                  {isSharedView
                    ? canEditShared
                      ? 'Shared editor'
                      : isLeadSharedView
                        ? 'Read-only lead'
                        : 'Read-only share'
                    : activeDashboardShare
                      ? activeDashboardShare.editorEmails.includes(normalizedUserEmail)
                        ? 'Editor access'
                        : 'Read-only access'
                    : savingToCloud
                      ? 'Saving'
                      : 'Saved'}
                </span>
                {user?.email && (
                  <>
                    <span className="text-stone-300">·</span>
                    <span>{user.email}</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-900"
                title="Export current list"
              >
                <Download className="h-4 w-4" />
              </button>
              {isOwner && !isSharedView && (
                <button
                  type="button"
                  onClick={openSharePanel}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-950"
                >
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Invite</span>
                </button>
              )}
              {canManageWorkspace && (
                <button
                  type="button"
                  data-testid="pipe-new-list"
                  onClick={() => setIsNewListModalOpen(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-700"
                >
                  <ListPlus className="h-4 w-4" />
                  Add new list
                </button>
              )}
              {user && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition hover:border-stone-300 hover:text-stone-900"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </nav>

        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-8">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between px-1">
                <h1 className="text-base font-semibold text-stone-900">PipeLists</h1>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">
                  {formatCount(lists.length, 'list')}
                </span>
              </div>

              <div className="space-y-1.5">
                {lists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => {
                      setActiveListId(list.id);
                      setViewMode('pipeline');
                      setStageFilter('all');
                      setSelectedLogItemId('');
                      setLogDraft(defaultLogDraft(list.templateKey));
                      setSelectedDetailItemId('');
                      setDraft(defaultDraft(list.stages[0]?.id));
                      resetEditor();
                    }}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition ${
                      activeListId === list.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${list.accent}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{list.name}</span>
                      <span
                        className={`block truncate text-xs ${
                          activeListId === list.id ? 'text-stone-300' : 'text-stone-400'
                        }`}
                      >
                        {formatCount(list.items.filter((item) => !isItemDeleted(item)).length, listItemNoun(list))} · {templateCatalog[list.templateKey].label}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {isSharedView && (
                <div className="mt-4 border-t border-stone-100 pt-4">
                  <div className="rounded-lg border border-stone-200 bg-[#FAFAF7] p-3">
                    <p className="text-sm font-semibold text-stone-950">
                      {canEditShared ? 'Editor access' : isLeadSharedView ? 'Read-only lead' : 'Read-only share'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">
                      {canEditShared
                        ? 'Your changes save back to this shared list.'
                        : isLeadSharedView
                          ? 'Anyone with this link can read this lead and open its attachments.'
                          : 'Anyone with this link can read this list. Sign in only if you were granted edit access.'}
                    </p>

                    {shareDoc?.access === 'edit' && !canEditShared && (
                      <div className="mt-3 space-y-2">
                        <button
                          type="button"
                          onClick={handleGoogleSignIn}
                          className="inline-flex h-9 w-full items-center justify-center rounded-full bg-stone-900 px-3 text-sm font-semibold text-white transition hover:bg-stone-700"
                        >
                          Sign in with Google
                        </button>
                        <input
                          value={magicEmail}
                          onChange={(event) => setMagicEmail(event.target.value)}
                          className="h-9 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none"
                          placeholder="email@example.com"
                        />
                        <button
                          type="button"
                          onClick={sendMagicLink}
                          disabled={sendingMagicLink}
                          className="inline-flex h-9 w-full items-center justify-center rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-600 transition hover:text-stone-950 disabled:opacity-50"
                        >
                          {sendingMagicLink ? 'Sending...' : 'Send Magic Link'}
                        </button>
                        <MessageBanner message={authMessage} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>

          <section className="min-w-0">
            <MessageBanner message={appMessage} />

            <div className="mb-5 flex flex-col gap-4 border-b border-stone-200 pb-5 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${activeList.accent}`} />
                  <span className="text-xs font-semibold uppercase text-stone-400">
                    {templateCatalog[activeList.templateKey].label}
                  </span>
                </div>
                <h2 className="truncate text-3xl font-bold tracking-normal text-stone-950 md:text-4xl">
                  {activeList.name}
                </h2>
                {activeList.description && (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">{activeList.description}</p>
                )}
              </div>

              {canManageActiveList && (
                <button
                  type="button"
                  onClick={() => setIsDeleteListModalOpen(true)}
                  disabled={lists.length <= 1}
                  title={lists.length <= 1 ? 'Create another PipeList before deleting this one' : 'Delete this PipeList'}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-stone-500 shadow-sm transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete List
                </button>
              )}
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              {[
                { id: 'pipeline' as const, label: 'Pipeline', icon: <Layers className="h-4 w-4" /> },
                { id: 'metrics' as const, label: 'Metrics', icon: <BarChart3 className="h-4 w-4" /> },
                { id: 'logs' as const, label: 'Logs', icon: <ClipboardList className="h-4 w-4" /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setViewMode(tab.id)}
                  className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                    viewMode === tab.id
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 bg-white text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {viewMode === 'metrics' && (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {renderMetricCard(
                    'Open Pipeline',
                    formatMoney(scorecardMetrics.totalOpenValue),
                    `${scorecardMetrics.totalOpenDeals} open opportunities across all lists`,
                    <DollarSign className="h-4 w-4" />,
                  )}
                  {renderMetricCard(
                    'Average Value',
                    formatMoney(scorecardMetrics.averageContractValue),
                    'Blended across items with ACV or amount',
                    <TrendingUp className="h-4 w-4" />,
                    'bg-sky-50 text-sky-700',
                  )}
                  {renderMetricCard(
                    'Next Date',
                    scorecardMetrics.firstExpectedCloseDate || 'Not set',
                    'Earliest expected close, due date, or end date',
                    <Calendar className="h-4 w-4" />,
                    'bg-amber-50 text-amber-700',
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {renderMetricCard(
                    'Won Rate',
                    `${Math.round(scorecardMetrics.wonRate)}%`,
                    'Won items divided by all tracked items',
                    <Users className="h-4 w-4" />,
                    'bg-indigo-50 text-indigo-700',
                  )}
                  {renderMetricCard(
                    'Due Soon',
                    String(scorecardMetrics.dueSoon),
                    'Open items with a date inside the next week',
                    <Target className="h-4 w-4" />,
                    'bg-emerald-50 text-emerald-700',
                  )}
                  {renderMetricCard(
                    'Logged Items',
                    String(scorecardMetrics.loggedItems),
                    `${scorecardMetrics.totalLogs} total logs across tracked items`,
                    <Activity className="h-4 w-4" />,
                    'bg-teal-50 text-teal-700',
                  )}
                  {renderMetricCard(
                    'Signal Events',
                    String(Math.round(scorecardMetrics.signalEvents)),
                    `${Math.round(scorecardMetrics.checkInRate)}% check-in rate, ${Math.round(
                      scorecardMetrics.escalations,
                    )} escalations`,
                    <CheckCircle2 className="h-4 w-4" />,
                    'bg-rose-50 text-rose-700',
                  )}
                </div>

                <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
                  <div className="border-b border-stone-100 px-4 py-3">
                    <h3 className="text-sm font-semibold text-stone-950">Scoreboard</h3>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {[
                      ['How much is open?', `${scorecardMetrics.totalOpenDeals} open opportunities, ${formatMoney(scorecardMetrics.totalOpenValue)} total listed value.`],
                      ['What needs attention soon?', scorecardMetrics.firstExpectedCloseDate || 'Add expected close or due dates to important items.'],
                      ['How much is documented?', `${scorecardMetrics.loggedItems} items have logs, with ${scorecardMetrics.totalLogs} total records.`],
                      ['What proof signals exist?', `${Math.round(scorecardMetrics.checkInRate)}% check-in rate, ${Math.round(scorecardMetrics.signalEvents)} signal events, ${Math.round(scorecardMetrics.staffScore) || 0}/10 staff score from metric logs.`],
                      ['Where do costs need attention?', 'Track margin notes, partner costs, and hard costs when those fields apply.'],
                    ].map(([question, answer]) => (
                      <div key={question} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(220px,0.8fr)_1fr]">
                        <p className="text-sm font-semibold text-stone-800">{question}</p>
                        <p className="text-sm leading-6 text-stone-500">{answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'logs' && (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="sr-only" htmlFor="log-list-filter">
                      Filter logs by PipeList
                    </label>
                    <select
                      id="log-list-filter"
                      value={logListFilter}
                      onChange={(event) => setLogListFilter(event.target.value)}
                      className="h-11 min-w-[220px] rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm font-medium text-stone-700 outline-none transition focus:border-stone-400 focus:bg-white"
                    >
                      <option value="all">All PipeLists</option>
                      {lists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                        </option>
                      ))}
                    </select>
                    <label className="sr-only" htmlFor="log-email-filter">
                      Filter logs by email type
                    </label>
                    <select
                      id="log-email-filter"
                      value={logEmailFilter}
                      onChange={(event) => setLogEmailFilter(event.target.value as LogEmailFilter)}
                      className="h-11 min-w-[210px] rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm font-medium text-stone-700 outline-none transition focus:border-stone-400 focus:bg-white"
                    >
                      {(Object.keys(logEmailFilterLabels) as LogEmailFilter[]).map((filter) => (
                        <option key={filter} value={filter}>
                          {logEmailFilterLabels[filter]}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm text-stone-400">
                      {formatCount(filteredLogRows.length, 'log')}
                    </span>
                  </div>

                  {canModify && (
                    <button
                      type="button"
                      onClick={() => openLogModal()}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add Log
                    </button>
                  )}
                </div>

                {logRecipientFilter && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500 shadow-sm">
                    <span>
                      Showing {logEmailFilterLabels[logEmailFilter]} for <strong className="text-stone-800">{logRecipientFilter}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setLogRecipientFilter('')}
                      className="inline-flex h-8 items-center rounded-full border border-stone-200 px-3 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-950"
                    >
                      Clear recipient
                    </button>
                  </div>
                )}

                <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                  <div className="border-b border-stone-100 bg-stone-50 px-4 py-3 text-xs font-semibold uppercase text-stone-400">
                    Timeline
                  </div>
                  {filteredLogRows.length > 0 ? (
                    <div className="divide-y divide-stone-100">
                      {filteredLogRows.map(({ list, item, log }) => {
                        const logRowId = `${list.id}-${item.id}-${log.id}`;
                        const isExpanded = expandedLogIds.has(logRowId);

                        return (
                        <article key={logRowId} className="px-4 py-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
                                  {logDisplayLabel(log)}
                                </span>
                                <span className="text-xs text-stone-400">{formatLogTimestamp(log)}</span>
                                {isExpanded && <span className="text-xs text-stone-400">{list.name}</span>}
                                {isExpanded && log.followUpDate && (
                                  <span className="text-xs text-stone-400">
                                    {followUpDateLabel(log.nextStep)} {log.followUpDate}
                                  </span>
                                )}
                              </div>
                              <h4 className="mt-2 text-sm font-semibold text-stone-950">{displayLogSummary(log)}</h4>
                              {isExpanded && (
                                <>
                                  <p className="mt-1 text-sm text-stone-500">
                                    {item.title}
                                    {item.organization ? ` · ${item.organization}` : ''}
                                  </p>
                                  {log.nextStep && <p className="mt-1 text-sm leading-6 text-stone-500">Next: {log.nextStep}</p>}
                                  {log.systemAction === 'email-sent' ? (
                                    <EmailLogDetails log={log} />
                                  ) : (
                                    log.notes && log.notes !== log.summary && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-500">{log.notes}</p>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2 self-start">
                              <button
                                type="button"
                                onClick={() => toggleExpandedLog(logRowId)}
                                aria-expanded={isExpanded}
                                className="inline-flex h-9 items-center gap-1 rounded-full border border-stone-200 px-3 text-xs font-semibold text-stone-500 transition hover:border-stone-300 hover:text-stone-900"
                              >
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                {isExpanded ? 'Collapse' : 'Expand'}
                              </button>
                              {log.systemAction === 'item-deleted' && canRestoreDeletedItem(item) && (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreDeletedItem(list.id, item.id)}
                                  className="inline-flex h-9 items-center justify-center rounded-full bg-stone-900 px-3 text-xs font-semibold text-white transition hover:bg-stone-700"
                                >
                                  Undo Delete
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveListId(list.id);
                                  setSelectedDetailItemId(item.id);
                                  setSelectedLogItemId(item.id);
                                  setDetailModalMode('logs');
                                }}
                                className="inline-flex h-9 items-center justify-center rounded-full border border-stone-200 px-3 text-xs font-semibold text-stone-500 transition hover:border-stone-300 hover:text-stone-900"
                              >
                                Open
                              </button>
                              {canModify && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLog(item.id, log.id, list.id)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-rose-200 hover:text-rose-600"
                                  title="Delete log"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-16 text-center">
                      <p className="text-sm font-semibold text-stone-900">No logs yet</p>
                      <p className="mt-1 text-sm text-stone-500">Add updates from here or from any lead details modal.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {viewMode === 'pipeline' && (
              <>
                <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {isInvestorUpdateContactsList ? (
                    <>
                      {renderMetricCard('Contacts', String(activeListItems.length), 'People in this update list', <Users className="h-4 w-4" />)}
                      {renderMetricCard('Sent', String(sentEmailItems), 'Contacts with an email sent', <Mail className="h-4 w-4" />, 'bg-sky-50 text-sky-700')}
                      {renderMetricCard('Delivered', String(deliveredEmailItems), 'Emails delivered by Brevo', <CheckCircle2 className="h-4 w-4" />, 'bg-indigo-50 text-indigo-700')}
                      {renderMetricCard('Opened', String(openedEmailItems), 'Contacts who opened an email', <ClipboardList className="h-4 w-4" />, 'bg-emerald-50 text-emerald-700')}
                    </>
                  ) : isContactListActive ? (
                    <>
                      {renderMetricCard('Contacts', String(activeListItems.length), 'People in this list', <Users className="h-4 w-4" />)}
                      {renderMetricCard('Active', String(activeItems), 'Contacts not paused', <Clock className="h-4 w-4" />, 'bg-sky-50 text-sky-700')}
                      {renderMetricCard('Follow-Ups', String(dueSoonItems), 'Contacts due soon', <ClipboardList className="h-4 w-4" />, 'bg-amber-50 text-amber-700')}
                      {renderMetricCard('Emailed', String(sentEmailItems), 'Contacts with an email sent', <Mail className="h-4 w-4" />, 'bg-emerald-50 text-emerald-700')}
                    </>
                  ) : (
                    <>
                      {renderMetricCard('Total', String(activeListItems.length), 'All opportunities in this list', <FileText className="h-4 w-4" />)}
                      {renderMetricCard('Active', String(activeItems), 'Not closed won or lost', <Clock className="h-4 w-4" />, 'bg-sky-50 text-sky-700')}
                      {renderMetricCard('Won', String(wonItems), 'Closed or awarded opportunities', <CheckCircle2 className="h-4 w-4" />, 'bg-emerald-50 text-emerald-700')}
                      {renderMetricCard(
                        isFundSizeList(activeList) ? 'Fund Size' : 'Open Value',
                        formatMoney(activeOpenValue),
                        isFundSizeList(activeList) ? 'Fund sizes for active items' : 'ACV or amount for active items',
                        <DollarSign className="h-4 w-4" />,
                        'bg-amber-50 text-amber-700',
                      )}
                    </>
                  )}
                </div>

                <div className="mb-5 flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm xl:flex-row xl:items-center">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] pl-9 pr-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                      placeholder="Search"
                    />
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {!isInvestorUpdateContactsList && (
                      <div className="inline-flex h-11 items-center gap-2 rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-stone-500">
                        <Filter className="h-4 w-4" />
                        <select
                          value={stageFilter}
                          onChange={(event) => setStageFilter(event.target.value)}
                          className="bg-transparent text-sm text-stone-700 outline-none"
                          aria-label="Stage filter"
                        >
                          <option value="all">All stages</option>
                          {activeList.stages.map((stage) => (
                            <option key={stage.id} value={stage.id}>
                              {stage.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setStageFilter('all');
                      }}
                      className="inline-flex h-11 items-center justify-center rounded-md border border-stone-200 bg-white px-3 text-sm font-medium text-stone-500 transition hover:text-stone-900"
                    >
                      Clear
                    </button>

                    {isContactListActive && (
                      <>
                        <button
                          type="button"
                          onClick={() => openContactEmailModal()}
                          className="inline-flex h-11 items-center gap-2 rounded-md border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950"
                        >
                          <Mail className="h-4 w-4" />
                          Send email
                        </button>
                        {isInvestorUpdateContactsList && isOwner && canManageActiveList && (
                          <button
                            type="button"
                            onClick={handleImportFriendsOfBusiness}
                            disabled={isImportingFriends}
                            className="inline-flex h-11 items-center gap-2 rounded-md border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Users className="h-4 w-4" />
                          {isImportingFriends ? 'Importing...' : 'Import contacts'}
                          </button>
                        )}
                      </>
                    )}

                    {canModify && (
                      <>
                        {activeList.templateKey === 'vc' && missingVcSourceItems.length > 0 && (
                          <button
                            type="button"
                            onClick={handleEnrichMissingVcSources}
                            disabled={isEnrichingVcSources}
                            className="inline-flex h-11 items-center gap-2 rounded-md border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Sparkles className="h-4 w-4" />
                            {isEnrichingVcSources ? 'Analyzing...' : 'Analyze sources'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={openLeadGenModal}
                          className="inline-flex h-11 items-center gap-2 rounded-md border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950"
                        >
                          <Search className="h-4 w-4" />
                          Find leads
                        </button>
                        {isContactListActive && (
                          <button
                            type="button"
                            onClick={openPastedLeadListModal}
                            className="inline-flex h-11 items-center gap-2 rounded-md border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950"
                          >
                            <ListPlus className="h-4 w-4" />
                            Analyze list
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={openLeadUrlModal}
                          className="inline-flex h-11 items-center gap-2 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                        >
                          <Plus className="h-4 w-4" />
                          {isContactListActive ? 'Add contact' : 'Add new lead'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isInvestorUpdateContactsList && <MessageBanner message={friendsImportMessage} />}
                {activeList.templateKey === 'vc' && <MessageBanner message={vcSourceEnrichmentMessage} />}

                {!isInvestorUpdateContactsList && (
                  <div className="mb-4 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
                    {activeList.stages.map((stage) => (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => setStageFilter(stageFilter === stage.id ? 'all' : stage.id)}
                        className={`rounded-lg border px-3 py-3 text-left transition ${
                          stageFilter === stage.id
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        <span className="block truncate text-sm font-semibold">{stage.label}</span>
                        <span className={stageFilter === stage.id ? 'text-xs text-stone-300' : 'text-xs text-stone-400'}>
                          {formatCount(countsByStage[stage.id] || 0, 'item')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                  <div
                    className={`hidden gap-4 border-b border-stone-100 bg-stone-50 px-4 py-3 text-xs font-semibold uppercase text-stone-400 lg:grid ${
                      isInvestorUpdateContactsList
                        ? 'min-w-[1180px] grid-cols-[280px_240px_160px_140px_280px_104px]'
                        : isContactListActive
                          ? 'min-w-[1320px] grid-cols-[260px_220px_140px_150px_140px_280px_104px]'
                          : 'min-w-[1280px] grid-cols-[260px_210px_128px_120px_140px_280px_104px]'
                    }`}
                  >
                    <span>{isContactListActive ? 'Contact' : 'Item'}</span>
                    <span>Organization</span>
                    {isInvestorUpdateContactsList ? (
                      <span>Email Status</span>
                    ) : isContactListActive ? (
                      <>
                        <span>Stage</span>
                        <span>Email Status</span>
                      </>
                    ) : (
                      <>
                        <span>Stage</span>
                        <span>{isFundSizeList(activeList) ? amountFieldLabelForList(activeList) : 'Value'}</span>
                      </>
                    )}
                    <span>{isContactListActive ? 'Follow-Up' : 'Due Date'}</span>
                    <span>Next Step</span>
                    <span className="text-right">Actions</span>
                  </div>

                  {filteredItems.length > 0 ? (
                    <div className={`divide-y divide-stone-100 ${isInvestorUpdateContactsList ? 'lg:min-w-[1180px]' : isContactListActive ? 'lg:min-w-[1320px]' : 'lg:min-w-[1280px]'}`}>
                      {filteredItems.map((item) => {
                        const stage = getStage(activeList, item.stage);
                        const itemValueText = itemAmountDisplay(activeList, item);
                        const tableValueText = isContactListActive ? item.contactEmails[0] || '' : itemValueText;
                        const hasItemValue = Boolean(tableValueText);
                        const dueDate = item.expectedCloseDate || item.dueDate || item.pilotEnd;
                        const nextStepText = item.nextStep || item.notes || item.expansionPath;

                        return (
                          <article
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Open details for ${item.title}`}
                            onClick={() => {
                              setSelectedDetailItemId(item.id);
                              setDetailModalMode('details');
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedDetailItemId(item.id);
                                setDetailModalMode('details');
                              }
                            }}
                            className={`grid cursor-pointer gap-3 px-4 py-4 transition hover:bg-stone-50/80 focus:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-stone-300 lg:items-center lg:gap-4 ${
                              isInvestorUpdateContactsList
                                ? 'lg:grid-cols-[280px_240px_160px_140px_280px_104px]'
                                : isContactListActive
                                  ? 'lg:grid-cols-[260px_220px_140px_150px_140px_280px_104px]'
                                  : 'lg:grid-cols-[260px_210px_128px_120px_140px_280px_104px]'
                            }`}
                          >
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-stone-950">{item.title}</h3>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                                {item.owner && <span>{item.owner}</span>}
                                {item.segment && <span>{item.segment}</span>}
                                {dueDate && (
                                  <span className="inline-flex items-center gap-1 lg:hidden">
                                    <Calendar className="h-3 w-3" />
                                    {dueDate}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className={`min-w-0 items-center gap-2 text-sm text-stone-600 ${item.organization ? 'flex' : 'hidden lg:flex'}`}>
                              <Building2 className="h-4 w-4 shrink-0 text-stone-400" />
                              <span className="truncate">{item.organization}</span>
                            </div>

                            {isInvestorUpdateContactsList ? (
                              <div className="min-w-0">
                                {emailStatusHasActivity(item) ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openEmailActivityForItem(item);
                                    }}
                                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold transition hover:shadow-sm ${emailStatusTone(item)}`}
                                    title={`View email activity for ${item.title}`}
                                  >
                                    View
                                  </button>
                                ) : (
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${emailStatusTone(item)}`}>
                                    Not sent
                                  </span>
                                )}
                                {emailStatusHasActivity(item) && (
                                  <p className="mt-1 truncate text-xs font-medium text-stone-500">{emailStatusLabel(item)}</p>
                                )}
                                {item.contactEmails[0] && <p className="mt-1 truncate text-xs text-stone-500">{item.contactEmails[0]}</p>}
                                {(item.emailOpenCount > 0 || item.emailClickCount > 0) && (
                                  <p className="mt-1 truncate text-xs text-stone-400">
                                    {item.emailOpenCount > 0 ? `${item.emailOpenCount} opens` : ''}
                                    {item.emailOpenCount > 0 && item.emailClickCount > 0 ? ' · ' : ''}
                                    {item.emailClickCount > 0 ? `${item.emailClickCount} clicks` : ''}
                                  </p>
                                )}
                              </div>
                            ) : isContactListActive ? (
                              <>
                                <div>
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${stage.tone}`}>
                                    {stage.label}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  {emailStatusHasActivity(item) ? (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openEmailActivityForItem(item);
                                      }}
                                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold transition hover:shadow-sm ${emailStatusTone(item)}`}
                                      title={`View email activity for ${item.title}`}
                                    >
                                      View
                                    </button>
                                  ) : (
                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${emailStatusTone(item)}`}>
                                      Not sent
                                    </span>
                                  )}
                                  {emailStatusHasActivity(item) && (
                                    <p className="mt-1 truncate text-xs font-medium text-stone-500">{emailStatusLabel(item)}</p>
                                  )}
                                  {item.contactEmails[0] && <p className="mt-1 truncate text-xs text-stone-500">{item.contactEmails[0]}</p>}
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${stage.tone}`}>
                                    {stage.label}
                                  </span>
                                </div>

                                <p className={`text-sm font-semibold text-stone-800 ${hasItemValue ? '' : 'hidden lg:block'}`}>
                                  {tableValueText}
                                </p>
                              </>
                            )}

                            <div className={`min-w-0 text-sm text-stone-600 ${dueDate ? '' : 'hidden lg:block'}`}>
                              {dueDate && (
                                <span className="inline-flex max-w-full items-center gap-1.5 truncate">
                                  <Calendar className="h-4 w-4 shrink-0 text-stone-400" />
                                  <span className="truncate">{dueDate}</span>
                                </span>
                              )}
                            </div>

                            <div className={`min-w-0 ${nextStepText ? '' : 'hidden lg:block'}`}>
                              {nextStepText && (
                                <span
                                  onMouseEnter={(event) => showNextStepTooltip(event, nextStepText)}
                                  onMouseLeave={() => setNextStepTooltip(null)}
                                  className="block max-w-full truncate text-sm leading-5 text-stone-600"
                                >
                                  {nextStepText}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedLogItemId(item.id);
                                  setViewMode('logs');
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-stone-300 hover:text-stone-900"
                                title="Open logs"
                              >
                                <ClipboardList className="h-4 w-4" />
                              </button>
                              {canModify && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleEditItem(item);
                                    }}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-stone-300 hover:text-stone-900"
                                    title="Edit opportunity"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDeleteItem(item.id);
                                    }}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-rose-200 hover:text-rose-600"
                                    title="Delete opportunity"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-16 text-center">
                      <p className="text-sm font-semibold text-stone-900">{isContactListActive ? 'No contacts found' : 'No items found'}</p>
                      <p className="mt-1 text-sm text-stone-500">
                        {isContactListActive ? 'Adjust the filter or add a new contact.' : 'Adjust the filter or add a new item.'}
                      </p>
                      {canModify && (
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                          {isInvestorUpdateContactsList && isOwner && canManageActiveList && (
                            <button
                              type="button"
                              onClick={handleImportFriendsOfBusiness}
                              disabled={isImportingFriends}
                              className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Users className="h-4 w-4" />
                              {isImportingFriends ? 'Importing...' : 'Import contacts'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={openLeadGenModal}
                            className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950"
                          >
                            <Search className="h-4 w-4" />
                            Find leads
                          </button>
                          {isContactListActive && (
                            <button
                              type="button"
                              onClick={openPastedLeadListModal}
                              className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950"
                            >
                              <ListPlus className="h-4 w-4" />
                              Analyze list
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={openLeadUrlModal}
                            className="inline-flex h-10 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                          >
                            <Plus className="h-4 w-4" />
                            {isContactListActive ? 'Add contact' : 'Add new lead'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 text-sm text-stone-500">
                  {dueSoonItems} due soon · {loggedItems} with logs.
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {toastMessage && (
        <div className="fixed left-1/2 top-5 z-[90] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2" aria-live="polite">
          <div
            className={`rounded-full border px-4 py-3 text-center text-sm font-semibold shadow-2xl ${
              toastMessage.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : toastMessage.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            {toastMessage.text}
          </div>
        </div>
      )}

      {shouldBlockEditShare && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#FAFAF7]/95 px-4 py-6 backdrop-blur-md">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-share-auth-title"
            className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-5 text-stone-900 shadow-2xl"
          >
            <div className="mb-5">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-700">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h3 id="edit-share-auth-title" className="text-xl font-bold text-stone-950">
                Sign in for edit access
              </h3>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                This invite includes editing permissions for {activeList.name}. Sign in or create an account with the invited email to open the editable list.
              </p>
              {user && !canEditShared && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
                  You are signed in as {user.email || 'this account'}, but that email has not been invited to edit this PipeList.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={!authReady}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                Continue with Google
              </button>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-stone-100" />
                <span className="text-xs font-semibold uppercase text-stone-400">or</span>
                <div className="h-px flex-1 bg-stone-100" />
              </div>

              <label className="block" htmlFor="edit-share-magic-email">
                <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Email magic link</span>
                <input
                  id="edit-share-magic-email"
                  type="email"
                  value={magicEmail}
                  onChange={(event) => setMagicEmail(event.target.value)}
                  className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                  placeholder="you@example.com"
                />
              </label>

              <button
                type="button"
                onClick={sendMagicLink}
                disabled={!authReady || sendingMagicLink}
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingMagicLink ? 'Sending...' : 'Send Magic Link'}
              </button>

              {user && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex h-10 w-full items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-500 transition hover:text-stone-950"
                >
                  Sign out and use another account
                </button>
              )}

              <MessageBanner message={authMessage} />
            </div>
          </section>
        </div>
      )}

      {nextStepTooltip && (
        <div
          className="pointer-events-none fixed z-[70] max-w-sm rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm leading-6 text-stone-700 shadow-xl"
          style={{
            left: nextStepTooltip.left,
            top: nextStepTooltip.top,
            width: nextStepTooltip.width,
            transform: nextStepTooltip.placement === 'above' ? 'translateY(-100%)' : undefined,
          }}
        >
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words">{nextStepTooltip.text}</p>
        </div>
      )}

      {isSharePanelOpen && !isSharedView && isOwner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-950/30 px-4 py-10 backdrop-blur-sm sm:py-12"
          onClick={(event) => {
            if (isBackdropClick(event)) setIsSharePanelOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipe-share-title"
            onClick={(event) => event.stopPropagation()}
            className="my-auto flex max-h-[calc(100dvh-5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-100 px-5 py-5">
              <div>
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-700">
                  <Users className="h-4 w-4" />
                </div>
                <h3 id="pipe-share-title" className="text-xl font-bold text-stone-950">
                  Invite collaborators
                </h3>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  Choose the PipeLists this person should see, then send one dashboard invite link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSharePanelOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:text-stone-900"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
                <div className="space-y-4">
                  <div className="rounded-lg border border-stone-200 bg-[#FAFAF7] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase text-stone-400">Apply to PipeLists</span>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-stone-500">
                        {formatCount(selectedShareLists.length || 1, 'list')}
                      </span>
                    </div>
                    <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                      {lists.map((list) => (
                        <label
                          key={list.id}
                          className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700"
                        >
                          <input
                            type="checkbox"
                            checked={shareSelectedListIds.includes(list.id)}
                            onChange={() => toggleShareListSelection(list.id)}
                            className="h-4 w-4 rounded border-stone-300 accent-stone-900"
                          />
                          <span className={`h-2 w-2 shrink-0 rounded-full ${list.accent}`} />
                          <span className="truncate">{list.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="block" htmlFor="pipe-share-access">
                    <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Access</span>
                    <select
                      id="pipe-share-access"
                      value={shareAccess}
                      onChange={(event) => setShareAccess(event.target.value as ShareAccess)}
                      className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                    >
                      <option value="read">Read only</option>
                      <option value="edit">Read and edit</option>
                    </select>
                  </label>

                  <div className="rounded-lg border border-stone-200 bg-white p-3">
                    <label className="block" htmlFor="pipe-account-search">
                      <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Find account</span>
                      <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-[#FAFAF7] px-3">
                        <Search className="h-4 w-4 shrink-0 text-stone-400" />
                        <input
                          id="pipe-account-search"
                          value={collaboratorSearch}
                          onChange={(event) => setCollaboratorSearch(event.target.value)}
                          className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
                          placeholder="Search name or email"
                        />
                      </div>
                    </label>

                    <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                      {loadingProfiles ? (
                        <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-500">Loading accounts...</p>
                      ) : filteredCollaboratorProfiles.length > 0 ? (
                        filteredCollaboratorProfiles.map((account) => (
                          <button
                            key={account.uid}
                            type="button"
                            onClick={() => addCollaboratorEmail(account.email)}
                            className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition hover:bg-stone-50"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-stone-900">
                                {account.displayName || account.email}
                              </span>
                              <span className="block truncate text-xs text-stone-500">{account.email}</span>
                            </span>
                            <Plus className="h-4 w-4 shrink-0 text-stone-500" />
                          </button>
                        ))
                      ) : collaboratorSearch.trim() ? (
                        <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-500">No matching PipeLists account found.</p>
                      ) : null}
                    </div>

                    <MessageBanner message={profileSearchMessage} />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block" htmlFor="pipe-share-editors">
                    <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">
                      {shareAccess === 'edit' ? 'Account edit access' : 'Account read access'}
                    </span>
                    <textarea
                      id="pipe-share-editors"
                      value={shareEditorEmails}
                      onChange={(event) => setShareEditorEmails(event.target.value)}
                      className="min-h-24 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                      placeholder="name@example.com, teammate@example.com"
                    />
                    <span className="mt-1.5 block text-xs leading-5 text-stone-400">
                      Search accounts above or paste emails. Signed-in collaborators will see these lists on their dashboard.
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={createOrUpdateShareLink}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                  >
                    <Mail className="h-4 w-4" />
                    Save & Send Invite
                  </button>

                  <MessageBanner message={shareMessage} />

                  <div className="rounded-lg border border-stone-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase text-stone-400">Invites</span>
                      <span className="rounded-full bg-stone-50 px-2 py-1 text-xs font-medium text-stone-500">
                        {formatCount(inviteHistory.length, 'person')}
                      </span>
                    </div>

                    {inviteHistory.length > 0 ? (
                      <div className="max-h-56 space-y-2 overflow-y-auto">
                        {inviteHistory.map((invite) => (
                          <div
                            key={invite.email}
                            className="space-y-2 rounded-md border border-stone-100 bg-[#FAFAF7] px-3 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-stone-900">{invite.email}</p>
                                <p
                                  className="mt-1 text-xs leading-5 text-stone-500"
                                  style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {invite.listNames.join(', ')}
                                </p>
                              </div>
                              <span
                                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                                  invite.status === 'accepted'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {invite.status === 'accepted' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                {invite.status === 'accepted' ? 'Accepted' : 'Pending'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                              <span className="rounded-full bg-white px-2 py-1 font-medium capitalize text-stone-600">
                                {invite.access === 'edit' ? 'Read and edit' : 'Read only'}
                              </span>
                              {invite.status === 'accepted' && invite.acceptedAt ? (
                                <span>Accepted {formatInviteTimestamp(invite.acceptedAt)}</span>
                              ) : invite.sentAt ? (
                                <span>Sent {formatInviteTimestamp(invite.sentAt)}</span>
                              ) : (
                                <span>Invite sent</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-2 py-1.5">
                              <input
                                value={invite.inviteUrl}
                                readOnly
                                aria-label={`Invite link for ${invite.email}`}
                                className="min-w-0 flex-1 truncate bg-transparent text-xs text-stone-500 outline-none"
                                onFocus={(event) => event.currentTarget.select()}
                              />
                              <button
                                type="button"
                                onClick={() => copyInviteUrl(invite.inviteUrl)}
                                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-stone-200 px-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-950"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                              </button>
                              {invite.status === 'sent' && (
                                <button
                                  type="button"
                                  onClick={() => resendInviteEmail(invite)}
                                  disabled={resendingInviteEmails.includes(invite.email)}
                                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-stone-200 px-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                  {resendingInviteEmails.includes(invite.email) ? 'Sending...' : 'Resend'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-md bg-stone-50 px-3 py-4 text-center text-sm text-stone-500">
                        No invites for the selected PipeLists yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {isContactEmailModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-950/30 px-4 py-8 backdrop-blur-sm"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-email-title"
            onClick={(event) => event.stopPropagation()}
            className="my-auto flex max-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-100 px-5 py-5">
              <div>
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-700">
                  <Mail className="h-4 w-4" />
                </div>
                <h3 id="contact-email-title" className="text-xl font-bold text-stone-950">
                  Send email
                </h3>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  Send a direct update to contacts in {activeList.name}.
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <label className="block" htmlFor="contact-email-provider">
                <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Email configuration</span>
                <select
                  id="contact-email-provider"
                  value="pulse-brevo"
                  disabled={!isOwner}
                  className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:text-stone-400 focus:border-stone-400 focus:bg-white"
                >
                  <option value="pulse-brevo">Pulse Brevo</option>
                </select>
                <span className="mt-1.5 block text-xs leading-5 text-stone-400">
                  Uses the Brevo sender configured in Netlify. This option only sends when signed in as {TREMAINE_OWNER_EMAIL}.
                </span>
              </label>

              <div className="rounded-lg border border-stone-200 bg-[#FAFAF7] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase text-stone-400">External providers</span>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-stone-500">Coming next</span>
                </div>
                <p className="text-sm leading-6 text-stone-500">
                  Outside users will configure their own email service here before sending from PipeLists. They will still be able to track sent, delivered, and opened once connected.
                </p>
              </div>

              <label className="block" htmlFor="contact-email-recipients">
                <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Recipients</span>
                <textarea
                  id="contact-email-recipients"
                  value={contactEmailRecipients}
                  onChange={(event) => setContactEmailRecipients(event.target.value)}
                  className="min-h-20 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                  placeholder="name@example.com, teammate@example.com"
                />
                <span className="mt-1.5 block text-xs leading-5 text-stone-400">
                  Use commas, spaces, or new lines. Emails are validated before sending.
                </span>
              </label>

              <label className="block" htmlFor="contact-email-type">
                <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Email type</span>
                <select
                  id="contact-email-type"
                  value={contactEmailType}
                  onChange={(event) => setContactEmailType(event.target.value as ContactEmailType)}
                  className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                >
                  {(Object.keys(contactEmailTypeLabels) as ContactEmailType[]).map((emailType) => (
                    <option key={emailType} value={emailType}>
                      {contactEmailTypeLabels[emailType]}
                    </option>
                  ))}
                </select>
                <span className="mt-1.5 block text-xs leading-5 text-stone-400">
                  This is used for the automatic log and email tracking.
                </span>
              </label>

              <label className="block" htmlFor="contact-email-subject">
                <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Subject</span>
                <input
                  id="contact-email-subject"
                  value={contactEmailSubject}
                  onChange={(event) => setContactEmailSubject(event.target.value)}
                  className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                  placeholder="PulseCheck investor update"
                />
              </label>

              <label className="block" htmlFor="contact-email-body">
                <span className="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold uppercase text-stone-400">
                  Message
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={openComposerLinkPopover}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-xs font-semibold normal-case text-stone-600 transition hover:text-stone-950"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Link
                  </button>
                </span>
                <div className="relative">
                  <div
                    id="contact-email-body"
                    ref={contactEmailBodyEditorRef}
                    role="textbox"
                    aria-multiline="true"
                    contentEditable
                    suppressContentEditableWarning
                    onMouseUp={saveContactEmailSelection}
                    onKeyUp={saveContactEmailSelection}
                    onInput={(event) => syncContactEmailComposerState(event.currentTarget)}
                    onBlur={(event) => commitContactEmailComposerState(event.currentTarget)}
                    className="min-h-48 w-full resize-y overflow-auto whitespace-pre-wrap rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm leading-6 outline-none transition focus:border-stone-400 focus:bg-white [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-4"
                  />
                  {renderComposerLinkPopover()}
                  {!contactEmailBody && (
                    <span className="pointer-events-none absolute left-3 top-2 text-sm text-stone-400">
                      Write the update you want to send.
                    </span>
                  )}
                </div>
              </label>

              <div className="rounded-lg border border-stone-200 bg-[#FAFAF7] p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs font-semibold uppercase text-stone-400">Attachments</span>
                    <span className="mt-1 block text-xs text-stone-400">Up to 5 files, 15 MB total.</span>
                  </div>
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition hover:text-stone-950">
                    <Paperclip className="h-3.5 w-3.5" />
                    Add files
                    <input
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={async (event) => {
                        await handleContactEmailAttachments(event.target.files);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {contactEmailAttachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {contactEmailAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-stone-700">{attachment.name}</p>
                          <p className="text-xs text-stone-400">{formatFileSize(attachment.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeContactEmailAttachment(attachment.id)}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:text-stone-950"
                          title={`Remove ${attachment.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <MessageBanner message={contactEmailSendMessage} />
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-stone-100 px-5 py-4">
              <button
                type="button"
                onClick={closeContactEmailModal}
                disabled={isSendingContactEmail}
                className="inline-flex h-10 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendContactEmail}
                disabled={isSendingContactEmail || !isOwner}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-stone-900 px-5 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                {isSendingContactEmail ? 'Sending...' : 'Send email'}
              </button>
            </div>
          </section>
        </div>
      )}

      {isNewListModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/30 px-4 py-6 backdrop-blur-sm"
          onClick={(event) => {
            if (isBackdropClick(event)) setIsNewListModalOpen(false);
          }}
        >
          <form
            onSubmit={handleCreateList}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-lg border border-stone-200 bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-700">
                  <ListPlus className="h-4 w-4" />
                </div>
                <h3 className="text-xl font-bold text-stone-950">Add new list</h3>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  Choose a template and create a focused PipeList for a new type of pipeline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewListModalOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:text-stone-900"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="block" htmlFor="modal-new-list-template">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Template</span>
              <select
                id="modal-new-list-template"
                value={newListTemplateKey}
                onChange={(event) => setNewListTemplateKey(event.target.value as TemplateKey)}
                className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:bg-white"
              >
                {(Object.keys(templateCatalog) as TemplateKey[]).map((key) => (
                  <option key={key} value={key}>
                    {templateCatalog[key].label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block" htmlFor="modal-new-list-name">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">List Name</span>
              <input
                id="modal-new-list-name"
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                placeholder={templateCatalog[newListTemplateKey].defaultName}
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewListModalOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
              >
                <ListPlus className="h-4 w-4" />
                Create List
              </button>
            </div>
          </form>
        </div>
      )}

      {isDeleteListModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/30 px-4 py-6 backdrop-blur-sm"
          onClick={(event) => {
            if (isBackdropClick(event)) setIsDeleteListModalOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-list-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </div>
                <h3 id="delete-list-title" className="text-xl font-bold text-stone-950">
                  Delete PipeList
                </h3>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  Delete {activeList.name} and its {formatCount(activeListItems.length, 'active lead')}. This removes the full list from your workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteListModalOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:text-stone-900"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {lists.length <= 1 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                You need at least one PipeList. Create another list before deleting this one.
              </div>
            ) : (
              <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                This cannot be undone from the Logs restore flow because it deletes the whole PipeList.
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteListModalOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteList}
                disabled={lists.length <= 1}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete List
              </button>
            </div>
          </section>
        </div>
      )}

      {isLeadUrlModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/30 px-4 py-6 backdrop-blur-sm"
          onClick={(event) => {
            if (isBackdropClick(event)) setIsLeadUrlModalOpen(false);
          }}
        >
          <form
            onSubmit={handleExtractLead}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-lg border border-stone-200 bg-white p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-700">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-xl font-bold text-stone-950">{isContactListActive ? 'Add contact' : 'Add new lead'}</h3>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  {isContactListActive
                    ? 'Enter an email, URL, person, or organization. PipeLists will create the contact for review.'
                    : 'Paste a URL or type a person, organization, fund, school, program, or partner name. PipeLists will pull what it can and create the item for review.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLeadUrlModalOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:text-stone-900"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="block" htmlFor="pipe-lead-url">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">{isContactListActive ? 'Email, URL, or Name' : 'Lead URL or Name'}</span>
              <input
                id="pipe-lead-url"
                type="text"
                value={leadUrl}
                onChange={(event) => setLeadUrl(event.target.value)}
                className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                placeholder={isContactListActive ? 'jane.doe@example.com or Jane Doe' : 'https://example.com or Wisdom Ventures'}
                autoFocus
              />
            </label>

            <div className="mt-4">
              <MessageBanner message={leadExtractMessage} />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsLeadUrlModalOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
              >
                <Sparkles className="h-4 w-4" />
                Analyze lead
              </button>
            </div>
          </form>
        </div>
      )}

      {isLeadGenModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/30 px-4 py-6 backdrop-blur-sm"
          onClick={(event) => {
            if (isBackdropClick(event)) closeLeadGenModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipe-lead-gen-title"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 border-b border-stone-100 bg-white px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-700">
                    <Search className="h-4 w-4" />
                  </div>
                  <h3 id="pipe-lead-gen-title" className="text-xl font-bold text-stone-950">
                    Find leads
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-stone-500">
                    Tune the search, then review each recommendation before it goes into {activeList.name}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeLeadGenModal}
                  disabled={isGeneratingLeads}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isGeneratingLeads ? (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-stone-200 border-t-stone-900" />
                <h4 className="text-base font-semibold text-stone-950">Searching leads</h4>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">
                  Researching current sources, checking template fit, and filtering against existing items.
                </p>
              </div>
            ) : (
              <form onSubmit={handleGenerateLeads} className="max-h-[calc(100vh-10rem)] overflow-y-auto px-5 py-5">
                <div className="grid gap-4 md:grid-cols-[1fr_160px]">
                  <label className="block" htmlFor="pipe-lead-brief-product">
                    <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">
                      Product / company
                    </span>
                    <input
                      id="pipe-lead-brief-product"
                      value={leadSearchBrief.productName}
                      onChange={(event) => updateLeadSearchBrief('productName', event.target.value)}
                      onBlur={() => persistLeadSearchBrief()}
                      className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                      placeholder="PulseCheck"
                    />
                  </label>

                  <label className="block" htmlFor="pipe-lead-gen-count">
                    <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Lead count</span>
                    <input
                      id="pipe-lead-gen-count"
                      type="number"
                      min={3}
                      max={10}
                      value={leadSearchBrief.leadCount}
                      onChange={(event) => updateLeadSearchBrief('leadCount', clampLeadGenCount(Number(event.target.value) || 3))}
                      onBlur={() => persistLeadSearchBrief()}
                      className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                    />
                    <p className="mt-2 text-xs leading-5 text-stone-400">3 to 10 leads.</p>
                  </label>
                </div>

                <label className="mt-4 block" htmlFor="pipe-lead-brief-focus">
                  <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">
                    Search focus
                  </span>
                  <textarea
                    id="pipe-lead-brief-focus"
                    value={leadSearchBrief.searchFocus}
                    onChange={(event) => updateLeadSearchBrief('searchFocus', event.target.value)}
                    onBlur={() => persistLeadSearchBrief()}
                    className="min-h-28 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                    placeholder="What kind of leads should this PipeList search for?"
                  />
                </label>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block" htmlFor="pipe-lead-brief-audience">
                    <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">
                      Target buyer / audience
                    </span>
                    <textarea
                      id="pipe-lead-brief-audience"
                      value={leadSearchBrief.targetAudience}
                      onChange={(event) => updateLeadSearchBrief('targetAudience', event.target.value)}
                      onBlur={() => persistLeadSearchBrief()}
                      className="min-h-24 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                      placeholder="Who should these leads be for?"
                    />
                  </label>

                  <label className="block" htmlFor="pipe-lead-brief-types">
                    <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">
                      Opportunity types
                    </span>
                    <textarea
                      id="pipe-lead-brief-types"
                      value={leadSearchBrief.opportunityTypes}
                      onChange={(event) => updateLeadSearchBrief('opportunityTypes', event.target.value)}
                      onBlur={() => persistLeadSearchBrief()}
                      className="min-h-24 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                      placeholder="Grants, pitch competitions, investors, pilots..."
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <label className="flex min-h-11 items-center gap-2 rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm font-medium text-stone-700">
                    <input
                      type="checkbox"
                      checked={leadSearchBrief.requireFutureDeadline}
                      onChange={(event) => updateAndPersistLeadSearchBrief('requireFutureDeadline', event.target.checked)}
                      className="h-4 w-4 rounded border-stone-300"
                    />
                    Future deadline
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm font-medium text-stone-700">
                    <input
                      type="checkbox"
                      checked={leadSearchBrief.officialSourcesOnly}
                      onChange={(event) => updateAndPersistLeadSearchBrief('officialSourcesOnly', event.target.checked)}
                      className="h-4 w-4 rounded border-stone-300"
                    />
                    Official sources
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm font-medium text-stone-700">
                    <input
                      type="checkbox"
                      checked={leadSearchBrief.includeAdjacentFit}
                      onChange={(event) => updateAndPersistLeadSearchBrief('includeAdjacentFit', event.target.checked)}
                      className="h-4 w-4 rounded border-stone-300"
                    />
                    Adjacent fit
                  </label>
                </div>

                <details className="mt-4 rounded-lg border border-stone-200 bg-white">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-stone-700">
                    Advanced brief
                  </summary>
                  <div className="space-y-4 border-t border-stone-100 p-4">
                    <label className="block" htmlFor="pipe-lead-brief-context">
                      <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">
                        Product context
                      </span>
                      <textarea
                        id="pipe-lead-brief-context"
                        value={leadSearchBrief.productContext}
                        onChange={(event) => updateLeadSearchBrief('productContext', event.target.value)}
                        onBlur={() => persistLeadSearchBrief()}
                        className="min-h-28 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                      />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block" htmlFor="pipe-lead-brief-sources">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">
                          Preferred sources
                        </span>
                        <textarea
                          id="pipe-lead-brief-sources"
                          value={leadSearchBrief.preferredSources}
                          onChange={(event) => updateLeadSearchBrief('preferredSources', event.target.value)}
                          onBlur={() => persistLeadSearchBrief()}
                          className="min-h-24 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                        />
                      </label>

                      <label className="block" htmlFor="pipe-lead-brief-positioning">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">
                          Positioning
                        </span>
                        <textarea
                          id="pipe-lead-brief-positioning"
                          value={leadSearchBrief.positioning}
                          onChange={(event) => updateLeadSearchBrief('positioning', event.target.value)}
                          onBlur={() => persistLeadSearchBrief()}
                          className="min-h-24 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block" htmlFor="pipe-lead-brief-include">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">
                          Must include
                        </span>
                        <textarea
                          id="pipe-lead-brief-include"
                          value={leadSearchBrief.mustInclude}
                          onChange={(event) => updateLeadSearchBrief('mustInclude', event.target.value)}
                          onBlur={() => persistLeadSearchBrief()}
                          className="min-h-24 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                        />
                      </label>

                      <label className="block" htmlFor="pipe-lead-brief-exclude">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">
                          Must exclude
                        </span>
                        <textarea
                          id="pipe-lead-brief-exclude"
                          value={leadSearchBrief.mustExclude}
                          onChange={(event) => updateLeadSearchBrief('mustExclude', event.target.value)}
                          onBlur={() => persistLeadSearchBrief()}
                          className="min-h-24 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                        />
                      </label>
                    </div>

                    <details className="rounded-md border border-stone-200 bg-[#FAFAF7]">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase text-stone-400">
                        Prompt preview
                      </summary>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-stone-200 px-3 py-3 text-xs leading-5 text-stone-600">
                        {leadSearchPromptPreview}
                      </pre>
                    </details>
                  </div>
                </details>

                <div className="mt-4">
                  <MessageBanner message={leadGenMessage} />
                </div>

                {generatedLeads.length > 0 && (
                  <div className="mt-5 border-t border-stone-100 pt-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold uppercase tracking-normal text-stone-400">
                        Results
                      </h4>
                      <span className="text-sm text-stone-500">{formatCount(generatedLeads.length, 'lead')}</span>
                    </div>

                    <div className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
                      {generatedLeads.map((lead) => {
                        const stage = getStage(activeList, lead.stage);
                        const key = generatedLeadKey(lead);
                        const alreadyAdded = addedGeneratedLeadKeys.includes(key);
                        const alreadyInList = activeLeadKeys.has(key);
                        const addDisabled = alreadyAdded || alreadyInList;

                        return (
                          <article
                            key={key}
                            className="rounded-lg border border-stone-200 bg-[#FAFAF7] p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <h5 className="break-words text-base font-semibold text-stone-950">{lead.title}</h5>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                                  {lead.organization && <span>{lead.organization}</span>}
                                  {lead.segment && <span>{lead.segment}</span>}
                                  {lead.dueDate && (
                                    <span className="inline-flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {lead.dueDate}
                                    </span>
                                  )}
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${stage.tone}`}>
                                    {stage.label}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddGeneratedLead(lead)}
                                disabled={addDisabled}
                                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
                              >
                                {addDisabled ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {alreadyAdded ? 'Added' : alreadyInList ? 'In list' : 'Add'}
                              </button>
                            </div>

                            <div className="mt-3 grid gap-3 text-sm leading-6 text-stone-600 md:grid-cols-2">
                              {lead.rationale && (
                                <p className="break-words">
                                  <span className="font-semibold text-stone-800">Fit:</span> {lead.rationale}
                                </p>
                              )}
                              {lead.nextStep && (
                                <p className="break-words">
                                  <span className="font-semibold text-stone-800">Next:</span> {lead.nextStep}
                                </p>
                              )}
                              {lead.sourceEvidence && (
                                <p className="break-words">
                                  <span className="font-semibold text-stone-800">Source:</span> {lead.sourceEvidence}
                                </p>
                              )}
                              {lead.deadlineStatus && (
                                <p className="break-words">
                                  <span className="font-semibold text-stone-800">Date:</span> {lead.deadlineStatus}
                                </p>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                              {lead.amount && <span className="font-semibold text-stone-800">{lead.amount}</span>}
                              {lead.sourceUrl && (
                                <a
                                  href={lead.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="break-all font-medium text-sky-700 underline-offset-4 hover:underline"
                                >
                                  View source
                                </a>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex justify-end gap-2 border-t border-stone-100 pt-4">
                  <button
                    type="button"
                    onClick={closeLeadGenModal}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                  >
                    <Search className="h-4 w-4" />
                    Search leads
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {isPastedLeadListModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/30 px-4 py-6 backdrop-blur-sm"
          onClick={(event) => {
            if (isBackdropClick(event)) closePastedLeadListModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipe-pasted-list-title"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xl"
          >
            <div className="border-b border-stone-100 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-700">
                    <ListPlus className="h-4 w-4" />
                  </div>
                  <h3 id="pipe-pasted-list-title" className="text-xl font-bold text-stone-950">
                    Analyze pasted list
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-stone-500">
                    Paste names, organizations, emails, profile links, or copied list rows. PipeLists will verify and enrich each contact before you add it to {activeList.name}.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={closePastedLeadListModal}
                      disabled={isAnalyzingPastedLeadList}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="pipe-pasted-lead-list-form"
                      disabled={isAnalyzingPastedLeadList}
                      className="inline-flex h-10 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
                    >
                      <Sparkles className="h-4 w-4" />
                      {isAnalyzingPastedLeadList ? 'Analyzing' : analyzedPastedLeads.length > 0 ? 'Analyze again' : 'Analyze list'}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closePastedLeadListModal}
                  disabled={isAnalyzingPastedLeadList}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isAnalyzingPastedLeadList ? (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-stone-200 border-t-stone-900" />
                <h4 className="text-base font-semibold text-stone-950">Analyzing your list</h4>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">
                  Resolving each entry, finding credible sources, and mapping the contacts for review.
                </p>
              </div>
            ) : (
              <form id="pipe-pasted-lead-list-form" onSubmit={handleAnalyzePastedLeadList} className="max-h-[calc(100vh-12.75rem)] overflow-y-auto px-5 py-5">
                <label className="block" htmlFor="pipe-pasted-lead-list">
                  <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Paste a contact list</span>
                  <textarea
                    id="pipe-pasted-lead-list"
                    value={pastedLeadList}
                    onChange={(event) => setPastedLeadList(event.target.value)}
                    className="min-h-44 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                    placeholder={'Jane Doe - Atlanta Hawks\nJohn Smith, Emory Sports Medicine\nhttps://example.com/team'}
                    autoFocus
                  />
                  <p className="mt-2 text-xs leading-5 text-stone-400">
                    Include one contact or source per line when possible. Lists, directories, and profiles are resolved into individual contacts rather than added as generic leads.
                  </p>
                </label>

                <div className="mt-4">
                  <MessageBanner message={pastedLeadListMessage} />
                </div>

                {analyzedPastedLeads.length > 0 && (
                  <div className="mt-5 border-t border-stone-100 pt-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold uppercase tracking-normal text-stone-400">Review contacts</h4>
                      <span className="text-sm text-stone-500">{formatCount(analyzedPastedLeads.length, 'contact')}</span>
                    </div>

                    <div className="max-h-[46vh] space-y-3 overflow-y-auto pr-1">
                      {analyzedPastedLeads.map((lead) => {
                        const stage = getStage(activeList, lead.stage);
                        const key = generatedLeadKey(lead);
                        const alreadyAdded = addedPastedLeadKeys.includes(key);
                        const alreadyInList = activeLeadKeys.has(key);
                        const addDisabled = alreadyAdded || alreadyInList;

                        return (
                          <article key={key} className="rounded-lg border border-stone-200 bg-[#FAFAF7] p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <h5 className="break-words text-base font-semibold text-stone-950">{lead.title}</h5>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                                  {lead.organization && <span>{lead.organization}</span>}
                                  {lead.segment && <span>{lead.segment}</span>}
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${stage.tone}`}>
                                    {stage.label}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddAnalyzedPastedLead(lead)}
                                disabled={addDisabled}
                                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
                              >
                                {addDisabled ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {alreadyAdded ? 'Added' : alreadyInList ? 'In list' : 'Add'}
                              </button>
                            </div>

                            <div className="mt-3 grid gap-3 text-sm leading-6 text-stone-600 md:grid-cols-2">
                              {lead.rationale && (
                                <p className="break-words">
                                  <span className="font-semibold text-stone-800">Fit:</span> {lead.rationale}
                                </p>
                              )}
                              {lead.nextStep && (
                                <p className="break-words">
                                  <span className="font-semibold text-stone-800">Next:</span> {lead.nextStep}
                                </p>
                              )}
                              {lead.sourceEvidence && (
                                <p className="break-words">
                                  <span className="font-semibold text-stone-800">Source:</span> {lead.sourceEvidence}
                                </p>
                              )}
                              <p className="break-all">
                                <span className="font-semibold text-stone-800">Email:</span>{' '}
                                {lead.contactEmails.length > 0 ? lead.contactEmails.join(', ') : 'No public email found'}
                              </p>
                              {lead.contactPhone && (
                                <p className="break-words">
                                  <span className="font-semibold text-stone-800">Phone:</span> {lead.contactPhone}
                                </p>
                              )}
                            </div>

                            {(lead.sourceUrl || lead.linkedinUrl) && (
                              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                                {lead.sourceUrl && (
                                <a
                                  href={lead.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="break-all font-medium text-sky-700 underline-offset-4 hover:underline"
                                >
                                  View source
                                </a>
                                )}
                                {lead.linkedinUrl && (
                                  <a
                                    href={lead.linkedinUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="break-all font-medium text-sky-700 underline-offset-4 hover:underline"
                                  >
                                    LinkedIn
                                  </a>
                                )}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                )}

              </form>
            )}
          </section>
        </div>
      )}

      {isLogModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/30 px-4 py-6 backdrop-blur-sm"
          onClick={(event) => {
            if (isBackdropClick(event)) closeLogModal();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipe-log-modal-title"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 border-b border-stone-100 bg-white px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="pipe-log-modal-title" className="text-2xl font-bold tracking-normal text-stone-950">
                    Add Log
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-stone-500">
                    Record an update and choose where it belongs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeLogModal}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:text-stone-900"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form
              onSubmit={(event) =>
                handleSaveLog(event, {
                  listId: logTargetList.id,
                  itemId: logTargetItem?.id,
                  closeOnSave: true,
                })
              }
              className="space-y-4 px-5 py-5"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block" htmlFor="modal-log-list">
                  <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">PipeList</span>
                  <select
                    id="modal-log-list"
                    value={logTargetList.id}
                    onChange={(event) => {
                      const nextList = lists.find((list) => list.id === event.target.value) || activeList;
                      setLogTargetListId(nextList.id);
                      setLogTargetItemId(nextList.items[0]?.id || '');
                      setLogDraft(defaultLogDraft(nextList.templateKey));
                    }}
                    className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                  >
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block" htmlFor="modal-log-item">
                  <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Lead</span>
                  <select
                    id="modal-log-item"
                    value={logTargetItem?.id || ''}
                    onChange={(event) => setLogTargetItemId(event.target.value)}
                    className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                    disabled={logTargetListItems.length === 0}
                  >
                    {logTargetListItems.length > 0 ? (
                      logTargetListItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))
                    ) : (
                      <option value="">No leads in this PipeList</option>
                    )}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <label className="block" htmlFor="modal-log-weekOf">
                  <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Date</span>
                  <input
                    id="modal-log-weekOf"
                    type="date"
                    value={logDraft.weekOf}
                    onChange={(event) => setLogDraft((current) => ({ ...current, weekOf: event.target.value }))}
                    className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                  />
                </label>

                <label className="block" htmlFor="modal-log-type">
                  <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Type</span>
                  <select
                    id="modal-log-type"
                    value={logDraft.type}
                    onChange={(event) =>
                      setLogDraft((current) => updateLogDraftType(current, event.target.value as ActivityLogType))
                    }
                    className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                  >
                    {(Object.keys(logTypeLabels) as ActivityLogType[]).map((type) => (
                      <option key={type} value={type}>
                        {logTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2" htmlFor="modal-log-summary">
                  <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Summary</span>
                  <input
                    id="modal-log-summary"
                    value={logDraft.summary}
                    onChange={(event) => setLogDraft((current) => ({ ...current, summary: event.target.value }))}
                    className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                    placeholder="What happened?"
                  />
                </label>

                <label className="block md:col-span-2" htmlFor="modal-log-nextStep">
                  <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Next Step</span>
                  <select
                    id="modal-log-nextStep"
                    value={logDraft.nextStep}
                    onChange={(event) => setLogDraft((current) => ({ ...current, nextStep: event.target.value }))}
                    className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                  >
                    <option value="">No next step</option>
                    {logNextStepOptions[logDraft.type].map((nextStep) => (
                      <option key={nextStep} value={nextStep}>
                        {nextStep}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2" htmlFor="modal-log-followUpDate">
                  <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">{followUpDateLabel(logDraft.nextStep)}</span>
                  <input
                    id="modal-log-followUpDate"
                    type="date"
                    value={logDraft.followUpDate}
                    onChange={(event) => setLogDraft((current) => ({ ...current, followUpDate: event.target.value }))}
                    className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                  />
                </label>
              </div>

              <label className="block" htmlFor="modal-log-notes">
                <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Notes</span>
                <textarea
                  id="modal-log-notes"
                  value={logDraft.notes}
                  onChange={(event) => setLogDraft((current) => ({ ...current, notes: event.target.value }))}
                  className="min-h-24 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                  placeholder="Details, risk, context"
                />
              </label>

              <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={closeLogModal}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-stone-500 transition hover:text-stone-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!logTargetItem}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Add Log
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isAnalyzingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/30 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-5 text-center shadow-2xl">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-stone-200 border-t-stone-900" />
            <h3 className="text-base font-semibold text-stone-950">Analyzing lead</h3>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Pulling page content, extracting useful fields, and mapping it to this list.
            </p>
          </div>
        </div>
      )}

      {selectedDetailItem && selectedDetailStage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/30 px-4 py-6 backdrop-blur-sm"
          onClick={(event) => {
            if (detailModalMode !== 'email' && isBackdropClick(event)) {
              resetEditor();
              setSelectedDetailItemId('');
              setDetailModalMode('details');
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipe-detail-title"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 border-b border-stone-100 bg-white px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {isInvestorUpdateContactsList ? (
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${emailStatusTone(selectedDetailItem)}`}>
                        {emailStatusLabel(selectedDetailItem)}
                      </span>
                    ) : (
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${selectedDetailStage.tone}`}>
                        {selectedDetailStage.label}
                      </span>
                    )}
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityStyles[selectedDetailItem.priority]}`}>
                      {importanceLabel(selectedDetailItem.priority)}
                    </span>
                  </div>
                  <h3 id="pipe-detail-title" className="break-words text-2xl font-bold tracking-normal text-stone-950">
                    {selectedDetailIsEditing ? 'Edit Item' : selectedDetailItem.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-stone-500">
                    {selectedDetailItem.organization || 'No organization'} · {activeList.name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {selectedDetailIsEditing && (
                    <>
                      <button
                        type="button"
                        onClick={resetEditor}
                        className="inline-flex h-9 items-center justify-center rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        form="pipe-item-editor-form"
                        data-testid="pipe-save-opportunity"
                        className="inline-flex h-9 items-center justify-center rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                      >
                        Save
                      </button>
                    </>
                  )}
                  {!selectedDetailIsEditing && (
                    <>
                      {canModify && !isLeadSharedView && (
                        <button
                          type="button"
                          onClick={() => createOrUpdateLeadShareLink(selectedDetailItem)}
                          className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
                          title="Share lead"
                        >
                          <Share2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Share lead</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyLeadDetails(selectedDetailItem, selectedDetailStage)}
                        className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
                        title="Copy lead details"
                      >
                        <Copy className="h-4 w-4" />
                        <span className="hidden sm:inline">Copy details</span>
                      </button>
                    </>
                  )}
                  {detailModalMode !== 'email' && (
                    <button
                      type="button"
                      onClick={() => {
                        resetEditor();
                        setSelectedDetailItemId('');
                        setDetailModalMode('details');
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:text-stone-900"
                      title="Close details"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!selectedDetailIsEditing && detailModalMode !== 'details' && detailModalMode !== 'email' && (
                  <button
                    type="button"
                    onClick={() => setDetailModalMode('details')}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
                  >
                    <Layers className="h-4 w-4" />
                    Details
                  </button>
                )}
                {canModify && !selectedDetailIsEditing && detailModalMode !== 'email' && (
                  <button
                    type="button"
                    onClick={() => handleEditItem(selectedDetailItem)}
                    className="inline-flex h-9 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                )}
                {!selectedDetailIsEditing && detailModalMode !== 'email' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLogItemId(selectedDetailItem.id);
                      setDetailModalMode('logs');
                    }}
                    className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
                      detailModalMode === 'logs'
                        ? 'bg-stone-900 text-white hover:bg-stone-700'
                        : 'border border-stone-200 bg-white text-stone-600 hover:text-stone-950'
                    }`}
                  >
                    <ClipboardList className="h-4 w-4" />
                    Logs
                  </button>
                )}
                {canModify && !selectedDetailIsEditing && detailModalMode !== 'email' && (
                  <button
                    type="button"
                    onClick={() => openItemResearch(selectedDetailItem)}
                    className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
                      detailModalMode === 'research'
                        ? 'bg-stone-900 text-white hover:bg-stone-700'
                        : 'border border-stone-200 bg-white text-stone-600 hover:text-stone-950'
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    Research
                  </button>
                )}
                {isContactListActive && canModify && !selectedDetailIsEditing && detailModalMode !== 'email' && (
                  <button
                    type="button"
                    onClick={() => openContactEmailComposerForItem(selectedDetailItem)}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
                  >
                    <Mail className="h-4 w-4" />
                    Send email
                  </button>
                )}
                {canModify && !selectedDetailIsEditing && detailModalMode !== 'email' && !isLeadSharedView && moveTargetLists.length > 0 && (
                  <label className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-600 transition focus-within:border-stone-400 hover:text-stone-950">
                    <ListPlus className="h-4 w-4" />
                    <span className="sr-only">Move lead to another PipeList</span>
                    <select
                      value={moveTargetListId}
                      onChange={(event) => {
                        const nextListId = event.target.value;
                        setMoveTargetListId(nextListId);
                        if (nextListId) handleMoveItem(selectedDetailItem.id, nextListId);
                      }}
                      className="max-w-[160px] bg-transparent text-sm font-semibold outline-none"
                    >
                      <option value="">Move to...</option>
                      {moveTargetLists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </div>
            </div>

            {!selectedDetailIsEditing && (leadCopyMessage || leadShareMessage || leadMoveMessage || attachmentMessage) && (
              <div className="space-y-2 border-b border-stone-100 px-5 py-3">
                <MessageBanner message={leadCopyMessage} />
                <MessageBanner message={leadShareMessage} />
                <MessageBanner message={leadMoveMessage} />
                <MessageBanner message={attachmentMessage} />
                {leadShareUrl && (
                  <input
                    readOnly
                    value={leadShareUrl}
                    className="h-10 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-xs text-stone-500"
                    aria-label="Lead share link"
                  />
                )}
              </div>
            )}

            {selectedDetailIsEditing ? (
              <div className="px-5 py-5">{renderItemEditor()}</div>
            ) : detailModalMode === 'email' ? (
              <div className="space-y-5 px-5 py-5">
                <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-col gap-1">
                    <h4 className="text-sm font-semibold text-stone-950">Email composer</h4>
                    <p className="text-sm text-stone-500">
                      Send a direct update to {selectedDetailItem.title}.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="block" htmlFor="detail-contact-email-provider">
                      <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Email configuration</span>
                      <select
                        id="detail-contact-email-provider"
                        value="pulse-brevo"
                        disabled={!isOwner}
                        className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:text-stone-400 focus:border-stone-400 focus:bg-white"
                      >
                        <option value="pulse-brevo">Pulse Brevo</option>
                      </select>
                      <span className="mt-1.5 block text-xs leading-5 text-stone-400">
                        Sends only when signed in as {TREMAINE_OWNER_EMAIL}.
                      </span>
                    </label>

                    <label className="block" htmlFor="detail-contact-email-type">
                      <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Email type</span>
                      <select
                        id="detail-contact-email-type"
                        value={contactEmailType}
                        onChange={(event) => setContactEmailType(event.target.value as ContactEmailType)}
                        className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                      >
                        {(Object.keys(contactEmailTypeLabels) as ContactEmailType[]).map((emailType) => (
                          <option key={emailType} value={emailType}>
                            {contactEmailTypeLabels[emailType]}
                          </option>
                        ))}
                      </select>
                      <span className="mt-1.5 block text-xs leading-5 text-stone-400">
                        Used for the automatic log and tracking status.
                      </span>
                    </label>
                  </div>

                  <label className="mt-4 block" htmlFor="detail-contact-email-recipients">
                    <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Recipients</span>
                    <textarea
                      id="detail-contact-email-recipients"
                      value={contactEmailRecipients}
                      onChange={(event) => setContactEmailRecipients(event.target.value)}
                      className="min-h-20 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                      placeholder="name@example.com, teammate@example.com"
                    />
                    <span className="mt-1.5 block text-xs leading-5 text-stone-400">
                      Use commas, spaces, or new lines. Emails are validated before sending.
                    </span>
                  </label>

                  <label className="mt-4 block" htmlFor="detail-contact-email-subject">
                    <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Subject</span>
                    <input
                      id="detail-contact-email-subject"
                      value={contactEmailSubject}
                      onChange={(event) => setContactEmailSubject(event.target.value)}
                      className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                      placeholder="PulseCheck investor update"
                    />
                  </label>

                  <label className="mt-4 block" htmlFor="detail-contact-email-body">
                    <span className="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold uppercase text-stone-400">
                      Message
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={openComposerLinkPopover}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-xs font-semibold normal-case text-stone-600 transition hover:text-stone-950"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Link
                      </button>
                    </span>
                    <div className="relative">
                      <div
                        id="detail-contact-email-body"
                        ref={contactEmailBodyEditorRef}
                        role="textbox"
                        aria-multiline="true"
                        contentEditable
                        suppressContentEditableWarning
                        onMouseUp={saveContactEmailSelection}
                        onKeyUp={saveContactEmailSelection}
                        onInput={(event) => syncContactEmailComposerState(event.currentTarget)}
                        onBlur={(event) => commitContactEmailComposerState(event.currentTarget)}
                        className="min-h-56 w-full resize-y overflow-auto whitespace-pre-wrap rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm leading-6 outline-none transition focus:border-stone-400 focus:bg-white [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-4"
                      />
                      {renderComposerLinkPopover()}
                      {!contactEmailBody && (
                        <span className="pointer-events-none absolute left-3 top-2 text-sm text-stone-400">
                          Write the update you want to send.
                        </span>
                      )}
                    </div>
                  </label>

                  <div className="mt-4 rounded-lg border border-stone-200 bg-[#FAFAF7] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="block text-xs font-semibold uppercase text-stone-400">Attachments</span>
                        <span className="mt-1 block text-xs text-stone-400">Up to 5 files, 15 MB total.</span>
                      </div>
                      <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition hover:text-stone-950">
                        <Paperclip className="h-3.5 w-3.5" />
                        Add files
                        <input
                          type="file"
                          multiple
                          className="sr-only"
                          onChange={async (event) => {
                            await handleContactEmailAttachments(event.target.files);
                            event.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                    {contactEmailAttachments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {contactEmailAttachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-stone-700">{attachment.name}</p>
                              <p className="text-xs text-stone-400">{formatFileSize(attachment.size)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeContactEmailAttachment(attachment.id)}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:text-stone-950"
                              title={`Remove ${attachment.name}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <MessageBanner message={contactEmailSendMessage} />
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDetailModalMode('details');
                        setContactEmailSendMessage(null);
                      }}
                      disabled={isSendingContactEmail}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSendContactEmail}
                      disabled={isSendingContactEmail || !isOwner}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-stone-900 px-5 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Mail className="h-4 w-4" />
                      {isSendingContactEmail ? 'Sending...' : 'Send email'}
                    </button>
                  </div>
                </section>
              </div>
            ) : detailModalMode === 'research' ? (
              <div className="space-y-5 px-5 py-5">
                <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-stone-950">Research {selectedDetailItem.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-stone-500">
                      Ask for the information that would help you decide how to approach this relationship.
                    </p>
                  </div>

                  <form onSubmit={handleResearchItem}>
                    <label className="block" htmlFor="detail-item-research-prompt">
                      <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Research prompt</span>
                      <textarea
                        id="detail-item-research-prompt"
                        value={itemResearchPrompt}
                        onChange={(event) => setItemResearchPrompt(event.target.value)}
                        className="min-h-28 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                        placeholder="Find Bob's current role, the best public contact information, his LinkedIn profile, and a specific reason to reach out."
                        autoFocus
                      />
                    </label>

                    <div className="mt-4">
                      <MessageBanner message={itemResearchMessage} />
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailModalMode('details')}
                        disabled={isResearchingItem}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isResearchingItem}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
                      >
                        <Sparkles className="h-4 w-4" />
                        {isResearchingItem ? 'Researching...' : itemResearchResult ? 'Research again' : 'Research'}
                      </button>
                    </div>
                  </form>
                </section>

                {itemResearchResult && (
                  <section className="rounded-lg border border-stone-200 bg-[#FAFAF7] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase text-stone-400">Suggested updates</p>
                        <h4 className="mt-1 text-lg font-semibold text-stone-950">{itemResearchResult.title}</h4>
                        {itemResearchResult.organization && <p className="mt-1 text-sm text-stone-500">{itemResearchResult.organization}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyItemResearch}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Apply findings
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm leading-6 text-stone-600 md:grid-cols-2">
                      <p>
                        <span className="font-semibold text-stone-800">Email:</span>{' '}
                        {itemResearchResult.contactEmails.length > 0 ? itemResearchResult.contactEmails.join(', ') : 'No public email found'}
                      </p>
                      {itemResearchResult.contactPhone && (
                        <p>
                          <span className="font-semibold text-stone-800">Phone:</span> {itemResearchResult.contactPhone}
                        </p>
                      )}
                      {itemResearchResult.rationale && (
                        <p className="md:col-span-2">
                          <span className="font-semibold text-stone-800">Why it matters:</span> {itemResearchResult.rationale}
                        </p>
                      )}
                      {itemResearchResult.nextStep && (
                        <p className="md:col-span-2">
                          <span className="font-semibold text-stone-800">Suggested next step:</span> {itemResearchResult.nextStep}
                        </p>
                      )}
                      {itemResearchResult.sourceEvidence && (
                        <p className="md:col-span-2">
                          <span className="font-semibold text-stone-800">Source:</span> {itemResearchResult.sourceEvidence}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                      <a
                        href={itemResearchResult.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-sky-700 underline-offset-4 hover:underline"
                      >
                        View source
                      </a>
                      {itemResearchResult.linkedinUrl && (
                        <a
                          href={itemResearchResult.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-sky-700 underline-offset-4 hover:underline"
                        >
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </section>
                )}
              </div>
            ) : detailModalMode === 'logs' ? (
              <div className="space-y-5 px-5 py-5">
                {canModify ? (
                  <form onSubmit={handleSaveLog} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex flex-col gap-1">
                      <h4 className="text-sm font-semibold text-stone-950">Add Log</h4>
                      <p className="text-sm text-stone-500">{selectedDetailItem.organization || selectedDetailItem.title}</p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <label className="block" htmlFor="detail-log-weekOf">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Date</span>
                        <input
                          id="detail-log-weekOf"
                          type="date"
                          value={logDraft.weekOf}
                          onChange={(event) => setLogDraft((current) => ({ ...current, weekOf: event.target.value }))}
                          className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                        />
                      </label>

                      <label className="block" htmlFor="detail-log-type">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Type</span>
                        <select
                          id="detail-log-type"
                          value={logDraft.type}
                          onChange={(event) =>
                            setLogDraft((current) => updateLogDraftType(current, event.target.value as ActivityLogType))
                          }
                          className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                        >
                          {(Object.keys(logTypeLabels) as ActivityLogType[]).map((type) => (
                            <option key={type} value={type}>
                              {logTypeLabels[type]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block md:col-span-2" htmlFor="detail-log-summary">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Summary</span>
                        <input
                          id="detail-log-summary"
                          value={logDraft.summary}
                          onChange={(event) => setLogDraft((current) => ({ ...current, summary: event.target.value }))}
                          className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                          placeholder="What happened?"
                        />
                      </label>

                      <label className="block md:col-span-2" htmlFor="detail-log-nextStep">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Next Step</span>
                        <select
                          id="detail-log-nextStep"
                          value={logDraft.nextStep}
                          onChange={(event) => setLogDraft((current) => ({ ...current, nextStep: event.target.value }))}
                          className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                        >
                          <option value="">No next step</option>
                          {logNextStepOptions[logDraft.type].map((nextStep) => (
                            <option key={nextStep} value={nextStep}>
                              {nextStep}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block md:col-span-2" htmlFor="detail-log-followUpDate">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">{followUpDateLabel(logDraft.nextStep)}</span>
                        <input
                          id="detail-log-followUpDate"
                          type="date"
                          value={logDraft.followUpDate}
                          onChange={(event) => setLogDraft((current) => ({ ...current, followUpDate: event.target.value }))}
                          className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                        />
                      </label>
                    </div>

                    <label className="mt-3 block" htmlFor="detail-log-notes">
                      <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Notes</span>
                      <textarea
                        id="detail-log-notes"
                        value={logDraft.notes}
                        onChange={(event) => setLogDraft((current) => ({ ...current, notes: event.target.value }))}
                        className="min-h-20 w-full resize-y rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                        placeholder="Details, risk, context"
                      />
                    </label>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                      >
                        <Plus className="h-4 w-4" />
                        Add Log
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                    <h4 className="text-sm font-semibold text-stone-950">Logs</h4>
                    <p className="mt-1 text-sm leading-6 text-stone-500">This shared list is read-only. Logs are visible below.</p>
                  </div>
                )}

                <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-3">
                    <h4 className="text-xs font-semibold uppercase text-stone-400">Timeline</h4>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-500">
                      {formatCount(selectedDetailItem.weeklyLogs.length, 'log')}
                    </span>
                  </div>
                  {selectedDetailItem.weeklyLogs.length > 0 ? (
                    <div className="divide-y divide-stone-100">
                      {[...selectedDetailItem.weeklyLogs].sort((left, right) => logTimestampMs(right) - logTimestampMs(left)).map((log) => {
                        const detailLogRowId = `${activeList.id}-${selectedDetailItem.id}-${log.id}`;
                        const isExpanded = expandedLogIds.has(detailLogRowId);

                        return (
                          <article key={log.id} className="px-4 py-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
                                    {logDisplayLabel(log)}
                                  </span>
                                  <span className="text-xs text-stone-400">{formatLogTimestamp(log)}</span>
                                  {isExpanded && log.followUpDate && (
                                    <span className="text-xs text-stone-400">
                                      {followUpDateLabel(log.nextStep)} {log.followUpDate}
                                    </span>
                                  )}
                                </div>
                                <h5 className="mt-2 text-sm font-semibold text-stone-950">{displayLogSummary(log)}</h5>
                                {isExpanded && (
                                  <>
                                    {log.nextStep && <p className="mt-1 text-sm leading-6 text-stone-500">Next: {log.nextStep}</p>}
                                    {log.systemAction === 'email-sent' ? (
                                      <EmailLogDetails log={log} />
                                    ) : (
                                      log.notes &&
                                      log.notes !== log.summary && (
                                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-500">{log.notes}</p>
                                      )
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-2 self-start">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandedLog(detailLogRowId)}
                                  aria-expanded={isExpanded}
                                  className="inline-flex h-9 items-center gap-1 rounded-full border border-stone-200 px-3 text-xs font-semibold text-stone-500 transition hover:border-stone-300 hover:text-stone-900"
                                >
                                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  {isExpanded ? 'Collapse' : 'Expand'}
                                </button>
                                {canModify && log.systemAction === 'item-deleted' && canRestoreDeletedItem(selectedDetailItem) && (
                                  <button
                                    type="button"
                                    onClick={() => handleRestoreDeletedItem(activeList.id, selectedDetailItem.id)}
                                    className="inline-flex h-9 items-center justify-center rounded-full bg-stone-900 px-3 text-xs font-semibold text-white transition hover:bg-stone-700"
                                  >
                                    Undo Delete
                                  </button>
                                )}
                                {canModify && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLog(selectedDetailItem.id, log.id)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-rose-200 hover:text-rose-600"
                                    title="Delete log"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-12 text-center text-sm text-stone-400">No logs yet.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-5 px-5 py-5">
                {renderDetailGrid('grid gap-3 sm:grid-cols-2', [
                  ...(isContactListActive
                    ? [
                        ...(isInvestorUpdateContactsList
                          ? []
                          : [
                              {
                                label: 'Stage',
                                value: selectedDetailStage.label,
                              },
                            ]),
                        {
                          label: 'Email Status',
                          value: emailStatusLabel(selectedDetailItem),
                        },
                        {
                          label: 'Contact Email',
                          value: selectedDetailItem.contactEmails.join(', '),
                        },
                      ]
                    : [
                        {
                          label: isFundSizeList(activeList) ? amountFieldLabelForList(activeList) : 'Value',
                          value: itemAmountDisplay(activeList, selectedDetailItem),
                        },
                      ]),
                  {
                    label: isContactListActive ? 'Next Follow-Up' : 'Next Date',
                    value: selectedDetailItem.expectedCloseDate || selectedDetailItem.dueDate || selectedDetailItem.pilotEnd,
                  },
                ])}

                {renderDetailGrid('grid gap-3 md:grid-cols-2', [
                  { label: 'Next Step', value: selectedDetailItem.nextStep, wide: true },
                  { label: 'Notes', value: selectedDetailItem.notes, wide: true },
                  {
                    label: 'Source URL',
                    value: selectedDetailItem.sourceUrl ? (
                      <a
                        href={selectedDetailItem.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-stone-950 underline decoration-stone-300 underline-offset-4"
                      >
                        {selectedDetailItem.sourceUrl}
                      </a>
                    ) : (
                      ''
                    ),
                    wide: true,
                  },
                ])}

                <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-stone-950">Attachments</h4>
                      <p className="mt-1 text-xs text-stone-400">
                        {formatCount(selectedDetailItem.attachments.length, 'attachment')}
                      </p>
                    </div>
                    {canModify && (
                      <label
                        htmlFor="lead-attachment-upload"
                        className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                      >
                        <UploadCloud className="h-4 w-4" />
                        {uploadingAttachment ? 'Uploading...' : 'Upload file'}
                        <input
                          id="lead-attachment-upload"
                          type="file"
                          multiple
                          className="sr-only"
                          disabled={uploadingAttachment}
                          onChange={async (event) => {
                            await handleUploadLeadAttachments(selectedDetailItem, event.target.files);
                            event.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {selectedDetailItem.attachments.length > 0 ? (
                    <div className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200">
                      {selectedDetailItem.attachments.map((attachment) => (
                        <article key={attachment.id} className="flex flex-col gap-3 bg-[#FAFAF7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {attachment.type === 'file' ? (
                                <Paperclip className="h-4 w-4 shrink-0 text-stone-400" />
                              ) : (
                                <Link2 className="h-4 w-4 shrink-0 text-stone-400" />
                              )}
                              <a
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                download={attachment.type === 'file' ? attachment.fileName || attachment.name : undefined}
                                className="truncate text-sm font-semibold text-stone-950 underline-offset-4 hover:underline"
                              >
                                {attachment.name}
                              </a>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-400">
                              <span>{attachment.type === 'file' ? 'Uploaded file' : 'External link'}</span>
                              {attachment.contentType && <span>{attachment.contentType}</span>}
                              {attachment.size > 0 && <span>{formatFileSize(attachment.size)}</span>}
                              {attachment.createdAt && <span>{attachment.createdAt.slice(0, 10)}</span>}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              download={attachment.type === 'file' ? attachment.fileName || attachment.name : undefined}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-600 transition hover:text-stone-950"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </a>
                            {canModify && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAttachment(selectedDetailItem.id, attachment.id)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:border-rose-200 hover:text-rose-600"
                                title="Remove attachment"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-stone-200 bg-[#FAFAF7] px-4 py-8 text-center text-sm text-stone-400">
                      No attachments yet.
                    </div>
                  )}

                  {canModify && (
                    <form
                      onSubmit={(event) => handleAddAttachmentLink(event, selectedDetailItem)}
                      className="mt-4 grid gap-2 border-t border-stone-100 pt-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]"
                    >
                      <label className="block" htmlFor="lead-attachment-name">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Name</span>
                        <input
                          id="lead-attachment-name"
                          value={attachmentLinkName}
                          onChange={(event) => setAttachmentLinkName(event.target.value)}
                          className="h-10 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                          placeholder="Deck, memo, doc"
                        />
                      </label>
                      <label className="block" htmlFor="lead-attachment-url">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Link</span>
                        <input
                          id="lead-attachment-url"
                          type="url"
                          value={attachmentLinkUrl}
                          onChange={(event) => setAttachmentLinkUrl(event.target.value)}
                          className="h-10 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                          placeholder="https://drive.google.com/..."
                        />
                      </label>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:text-stone-950 md:w-auto"
                        >
                          <Link2 className="h-4 w-4" />
                          Add Link
                        </button>
                      </div>
                    </form>
                  )}
                </section>

                {renderDetailSection(
                  isContactListActive ? 'Contact Details' : 'Pipeline Details',
                  isContactListActive
                    ? [
                        { label: 'Relationship Owner', value: selectedDetailItem.owner },
                        { label: 'Contact Email', value: selectedDetailItem.contactEmails.join(', ') },
                        { label: 'Phone', value: selectedDetailItem.contactPhone },
                        {
                          label: 'LinkedIn',
                          value: selectedDetailItem.linkedinUrl ? (
                            <a
                              href={selectedDetailItem.linkedinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-sky-700 underline-offset-4 hover:underline"
                            >
                              View profile
                            </a>
                          ) : (
                            ''
                          ),
                        },
                        { label: 'Role / Organization', value: selectedDetailItem.organization },
                        { label: 'Segment', value: selectedDetailItem.segment },
                        { label: 'Relationship Context', value: selectedDetailItem.decisionMaker },
                        { label: isInvestorUpdateContactsList ? 'Next Update Date' : 'Next Touchpoint', value: selectedDetailItem.expectedCloseDate },
                        { label: 'Follow-Up Date', value: selectedDetailItem.dueDate },
                        { label: 'First Contacted', value: selectedDetailItem.pilotStart },
                        { label: 'Last Contacted', value: selectedDetailItem.pilotEnd },
                        ...(isInvestorUpdateContactsList ? [{ label: 'Update Cadence', value: selectedDetailItem.athleteCount }] : []),
                      ]
                    : [
                        { label: 'Owner', value: selectedDetailItem.owner },
                        { label: 'Contact Email', value: selectedDetailItem.contactEmails.join(', ') },
                        { label: 'Organization', value: selectedDetailItem.organization },
                        { label: 'Segment', value: selectedDetailItem.segment },
                        { label: 'Decision Maker', value: selectedDetailItem.decisionMaker },
                        ...(isFundSizeList(activeList)
                          ? []
                          : [
                              { label: 'ACV', value: selectedDetailItem.acv },
                              { label: amountFieldLabelForList(activeList), value: selectedDetailItem.amount },
                            ]),
                        { label: 'Expected Close', value: selectedDetailItem.expectedCloseDate },
                        { label: 'Due Date', value: selectedDetailItem.dueDate },
                        { label: 'Contract Term', value: selectedDetailItem.contractTerm },
                        { label: 'Margin Notes', value: selectedDetailItem.grossMargin },
                        { label: 'Partner Cost', value: selectedDetailItem.partnerCost },
                        { label: 'Hard Cost', value: selectedDetailItem.hardwareCost },
                      ],
                  'grid gap-3 md:grid-cols-2 lg:grid-cols-3',
                )}

                {renderDetailSection('Scope & Expansion', [
                  { label: 'Scope', value: selectedDetailItem.pilotScope, wide: true },
                  { label: 'Expansion Path', value: selectedDetailItem.expansionPath, wide: true },
                  { label: 'Count', value: selectedDetailItem.athleteCount },
                  { label: 'Start Date', value: selectedDetailItem.pilotStart },
                  { label: 'End Date', value: selectedDetailItem.pilotEnd },
                  { label: 'Loss Reason', value: selectedDetailItem.lossReason },
                ])}

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-stone-950">Recent Logs</h4>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">
                        {formatCount(selectedDetailItem.weeklyLogs.length, 'log')}
                      </span>
                      {canModify && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLogItemId(selectedDetailItem.id);
                            setDetailModalMode('logs');
                          }}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-stone-900 px-3 text-xs font-semibold text-white transition hover:bg-stone-700"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Log
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedDetailItem.weeklyLogs.length > 0 ? (
                    <div className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200">
                      {[...selectedDetailItem.weeklyLogs]
                        .sort((left, right) => logTimestampMs(right) - logTimestampMs(left))
                        .slice(0, 3)
                        .map((log) => (
                        <article key={log.id} className="bg-white px-4 py-3">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-stone-900">{displayLogSummary(log)}</p>
                              <p className="mt-1 text-xs text-stone-400">
                                {formatLogTimestamp(log)} · {logDisplayLabel(log)}
                              </p>
                              {log.nextStep && <p className="mt-1 text-sm leading-6 text-stone-500">Next: {log.nextStep}</p>}
                            </div>
                            {logHasMetrics(log) && (
                              <div className="grid grid-cols-3 gap-2 text-right text-xs text-stone-500">
                                <span>{Math.round(derivedCheckInRate(log))}% check-ins</span>
                                <span>{log.signalEvents || '0'} signals</span>
                                <span>{log.staffFeedbackScore || '-'} staff</span>
                              </div>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-stone-200 bg-[#FAFAF7] px-4 py-8 text-center text-sm text-stone-400">
                      No logs yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
};

export default PipelinePage;
