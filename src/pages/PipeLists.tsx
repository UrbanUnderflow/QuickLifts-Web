import React, { useEffect, useMemo, useState } from 'react';
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
import { collection, doc, getDoc, getDocs, query as firestoreQuery, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
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
import { auth as quickLiftsAuth } from '../api/firebase/config';
import { simpBudgetAuth, simpBudgetDb, simpBudgetStorage } from '../api/firebase/simpBudgetConfig';

type PipelinePriority = 'high' | 'medium' | 'low';
type ViewMode = 'pipeline' | 'metrics' | 'logs';
type DetailModalMode = 'details' | 'logs';
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
type ActivityLogType = 'update' | 'application' | 'meeting' | 'follow-up' | 'decision' | 'risk' | 'document' | 'metrics';
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
  | 'investor-metrics';

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
  systemAction?: 'item-created' | 'item-deleted' | 'item-restored' | 'item-moved';
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
  return logTypeLabels[log.type];
};

const generalStages: StageConfig[] = [
  { id: 'sourced', label: 'Sourced', probability: 10, track: 'general', tone: 'bg-stone-100 text-stone-700 border-stone-200' },
  { id: 'contacted', label: 'Contacted', probability: 20, track: 'general', tone: 'bg-sky-50 text-sky-700 border-sky-100' },
  { id: 'in-review', label: 'In Review', probability: 45, track: 'general', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { id: 'negotiating', label: 'Negotiating', probability: 75, track: 'run', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: 'won', label: 'Won', probability: 100, track: 'run', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', outcome: 'won' },
  { id: 'parked', label: 'Parked', probability: 0, track: 'general', tone: 'bg-zinc-50 text-zinc-500 border-zinc-200', outcome: 'lost' },
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
    label: 'Investor Update Metrics',
    defaultName: 'Investor Metrics',
    description: 'Investor questions, proof points, data sources, and update readiness.',
    accent: 'bg-stone-700',
    stages: generalStages,
  },
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

const isLikelyPitchApplicationOpportunity = (lead: GeneratedLead) => {
  const combinedText = [
    lead.title,
    lead.organization,
    lead.nextStep,
    lead.notes,
    lead.sourceUrl,
    lead.segment,
    lead.rationale,
    lead.sourceEvidence,
    lead.deadlineStatus,
  ]
    .join(' ')
    .toLowerCase();
  const nextStepText = lead.nextStep.toLowerCase();

  if (combinedText.includes('event has passed') || combinedText.includes('event passed')) return false;

  const eventOnlyLanguage = [
    'demo day',
    'showcase',
    'networking event',
    'alumni event',
    'speaker event',
    'webinar',
    'conference session',
  ].some((token) => combinedText.includes(token));
  const applicationLanguage = [
    'apply',
    'application',
    'applications open',
    'application deadline',
    'submit',
    'submission',
    'submissions',
    'call for startups',
    'startup competition',
    'pitch competition',
    'prize competition',
    'compete',
  ].some((token) => combinedText.includes(token));
  const spectatorNextStep = /^(attend|register|watch|join|visit|go to)\b/.test(nextStepText);

  return !eventOnlyLanguage || (applicationLanguage && !spectatorNextStep);
};

const isGeneratedLeadEligible = (lead: GeneratedLead, list: PipeList, today: string) => {
  if (isDeadlineDrivenTemplate(list) && !isIsoDateOnOrAfter(lead.dueDate, today)) return false;
  if (isPitchCompetitionList(list) && !isLikelyPitchApplicationOpportunity(lead)) return false;

  return true;
};

const defaultLeadGenAdjustments = (list: PipeList) => {
  const identity = `${list.templateKey} ${list.name} ${templateCatalog[list.templateKey].label}`.toLowerCase();

  if (identity.includes('pitch') || identity.includes('competition') || identity.includes('prize')) {
    return 'Find open startup pitch competitions, prize competitions, startup challenges, and founder award applications relevant to PulseCheck: athlete mental readiness, sport psychology, sports performance, digital health, wellness, AI, education, youth/college athletics, and team markets. Only include opportunities where PulseCheck can apply, submit, or compete, with application deadlines today or later. Exclude demo days, showcase-only events, networking events, spectator events, and accelerator cohort events unless there is a current application to pitch or compete. Prefer official pages, U.S. or remote options, meaningful prize/investor exposure, and opportunities not already in this list.';
  }

  if (identity.includes('grant') || identity.includes('award') || identity.includes('challenge')) {
    return 'Find open grants, awards, challenges, or non-dilutive funding opportunities relevant to PulseCheck: athlete mental readiness, sport psychology, sports performance, digital health, wellness, youth/college athletics, education, AI, and healthcare-adjacent innovation. Only include application deadlines today or later and prefer official funder pages.';
  }

  if (identity.includes('vc') || identity.includes('investor')) {
    return 'Find investors, angel groups, accelerators, and founder programs that are a strong fit for PulseCheck across athlete mental readiness, sport psychology, sports performance, digital health, wellness, AI, education, and athlete/team operations. Do not force deadlines; prioritize fit, thesis alignment, and a practical outreach next step.';
  }

  if (identity.includes('university') || identity.includes('pilot')) {
    return 'Find universities, athletic departments, sports performance labs, wellness programs, mental-performance groups, sport psychology teams, and innovation offices that could plausibly run a PulseCheck pilot. Do not force deadlines; prioritize buyer fit, pilot scope, decision-maker clues, and a practical follow-up.';
  }

  return 'Find highly relevant opportunities for this PipeList. Match the template purpose: require future deadlines for application-based opportunities, but leave due dates blank for relationship-based leads unless the source has a real deadline.';
};

const clampLeadGenCount = (value: number) => Math.min(10, Math.max(3, value));

const defaultLeadSearchBrief = (list: PipeList): LeadSearchBrief => {
  const identity = `${list.templateKey} ${list.name} ${templateCatalog[list.templateKey].label}`.toLowerCase();
  const productContext =
    'PulseCheck helps teams, schools, clinics, and sports/wellness programs track mental readiness, wellbeing signals, engagement, early alerts, referrals, support navigation, and outcomes reporting.';

  if (identity.includes('grant') || identity.includes('award') || identity.includes('challenge')) {
    return {
      productName: 'PulseCheck',
      productContext:
        'PulseCheck is a student check-in, wellbeing, early-alert, referral-routing, support-navigation, and outcomes-reporting platform for universities. It can support campus mental health, suicide prevention, basic needs, retention, student success, advising, belonging, substance-use screening/referral, case management, STEM persistence, first-generation/low-income student support, and grant reporting.',
      searchFocus: defaultLeadGenAdjustments(list),
      targetAudience:
        'Universities, colleges, community colleges, HBCUs, MSIs, TRIO programs, student-success offices, counseling centers, basic-needs offices, advising teams, and research faculty.',
      opportunityTypes:
        'Federal grants, current or recurring federal programs, formula grants, cooperative agreements, SBIR/STTR opportunities, adjacent federal funding, state pass-through grants, and foundation grants aligned to federal priorities.',
      preferredSources:
        'Official sources first: Grants.gov, Simpler.Grants.gov, SAMHSA, U.S. Department of Education, NSF, NIH, NIMH, HRSA, Department of Labor, DOJ/OVW, CDC, USDA, AmeriCorps, and official agency pages.',
      mustInclude:
        'Grant/program name, agency, opportunity number when available, current status, deadline, eligible applicants, award size, project period, university eligibility, PulseCheck positioning, fit score, funded activities, buyer/champion, budget language, reporting/outcomes, risks, and official source link.',
      mustExclude:
        'Expired one-off opportunities with no recurring path, vague pages, unofficial aggregators unless verified against an official source, and anything that cannot plausibly fund PulseCheck as implementation infrastructure.',
      positioning:
        'Frame PulseCheck as implementation infrastructure for a federally funded student-success, wellbeing, behavioral-health, retention, basic-needs, or evaluation initiative. Do not frame it as simply a grant to buy software.',
      requireFutureDeadline: true,
      officialSourcesOnly: true,
      includeAdjacentFit: true,
      leadCount: 6,
    };
  }

  if (identity.includes('pitch') || identity.includes('competition') || identity.includes('prize')) {
    return {
      productName: 'PulseCheck',
      productContext,
      searchFocus: defaultLeadGenAdjustments(list),
      targetAudience: 'Startup accelerators, pitch competitions, founder awards, innovation challenges, demo competitions, and prize programs where PulseCheck can apply or submit.',
      opportunityTypes: 'Open pitch competitions, prize competitions, startup challenges, founder award applications, and accelerator pitch applications.',
      preferredSources: 'Official program pages, organizer pages, accelerator pages, university innovation-center pages, and reputable startup ecosystem pages only when they link to official applications.',
      mustInclude: 'Application deadline, prize or investor exposure, eligibility, fit rationale, source link, and a practical application next step.',
      mustExclude: 'Passed events, demo-day-only pages, showcase-only events, spectator events, networking events, webinars, closed applications, vague deadlines, and anything without an active application or submission path.',
      positioning: 'Position PulseCheck around athlete mental readiness, sport psychology, sports performance, digital health, wellness, AI, education, youth/college athletics, and team markets.',
      requireFutureDeadline: true,
      officialSourcesOnly: true,
      includeAdjacentFit: false,
      leadCount: 6,
    };
  }

  if (identity.includes('vc') || identity.includes('investor')) {
    return {
      productName: 'PulseCheck',
      productContext,
      searchFocus: defaultLeadGenAdjustments(list),
      targetAudience: 'Venture funds, angels, family offices, accelerators, founder programs, and strategic investors.',
      opportunityTypes: 'Investor targets, warm-intro paths, accelerator investor programs, and thesis-aligned capital sources.',
      preferredSources: 'Official investor websites, portfolio pages, fund thesis pages, LinkedIn/company pages when official pages are thin, and reputable startup databases when available.',
      mustInclude: 'Investor thesis, relevant portfolio signals, check/stage fit when available, best contact or intro path, fit rationale, source link, and next outreach step.',
      mustExclude: 'Investors with no clear fit, inactive funds, irrelevant geographies/stages, and sources that do not support a practical next step.',
      positioning: 'Frame PulseCheck as a sports/wellness performance and mental-readiness infrastructure company with education, team, and healthcare-adjacent markets.',
      requireFutureDeadline: false,
      officialSourcesOnly: false,
      includeAdjacentFit: true,
      leadCount: 6,
    };
  }

  return {
    productName: 'PulseCheck',
    productContext,
    searchFocus: defaultLeadGenAdjustments(list),
    targetAudience: 'Organizations, partners, buyers, programs, or institutions that match this PipeList.',
    opportunityTypes: templateCatalog[list.templateKey].label,
    preferredSources: 'Official and current sources first. Use reputable secondary sources only when they add useful context.',
    mustInclude: 'Name, organization, source link, amount or value when available, due date when relevant, fit rationale, and next step.',
    mustExclude: 'Expired, closed, irrelevant, vague, duplicate, or unsupported opportunities.',
    positioning: 'Position PulseCheck using the strongest buyer-specific fit for this PipeList.',
    requireFutureDeadline: isDeadlineDrivenTemplate(list),
    officialSourcesOnly: isDeadlineDrivenTemplate(list),
    includeAdjacentFit: true,
    leadCount: 6,
  };
};

const normalizeLeadSearchBrief = (brief: Partial<LeadSearchBrief> | undefined, list: PipeList): LeadSearchBrief => {
  const fallback = defaultLeadSearchBrief(list);
  return {
    productName: brief?.productName || fallback.productName,
    productContext: brief?.productContext || fallback.productContext,
    searchFocus: brief?.searchFocus || fallback.searchFocus,
    targetAudience: brief?.targetAudience || fallback.targetAudience,
    opportunityTypes: brief?.opportunityTypes || fallback.opportunityTypes,
    preferredSources: brief?.preferredSources || fallback.preferredSources,
    mustInclude: brief?.mustInclude || fallback.mustInclude,
    mustExclude: brief?.mustExclude || fallback.mustExclude,
    positioning: brief?.positioning || fallback.positioning,
    requireFutureDeadline: brief?.requireFutureDeadline ?? fallback.requireFutureDeadline,
    officialSourcesOnly: brief?.officialSourcesOnly ?? fallback.officialSourcesOnly,
    includeAdjacentFit: brief?.includeAdjacentFit ?? fallback.includeAdjacentFit,
    leadCount: clampLeadGenCount(Number(brief?.leadCount) || fallback.leadCount),
  };
};

const buildLeadSearchPrompt = (brief: LeadSearchBrief) =>
  [
    `Research role: act as a lead-generation research strategist helping ${brief.productName} find leads for this PipeList.`,
    `Product context: ${brief.productContext}`,
    `Research goal: ${brief.searchFocus}`,
    `Target audience/customer: ${brief.targetAudience}`,
    `Opportunity types: ${brief.opportunityTypes}`,
    `Preferred sources: ${brief.preferredSources}`,
    brief.includeAdjacentFit
      ? 'Include both direct-fit opportunities and adjacent opportunities where PulseCheck could be positioned as a vendor, implementation partner, subrecipient, evaluator, research tool, data platform, referral system, or pilot-site technology.'
      : 'Only include direct-fit opportunities with a clear path for PulseCheck to apply, submit, compete, sell, partner, or outreach.',
    brief.requireFutureDeadline
      ? 'Require a current or future application/submission deadline. Exclude undated, expired, closed, or already-passed opportunities.'
      : 'Do not force deadlines unless the source has a real application/submission deadline.',
    brief.officialSourcesOnly
      ? 'Use official/current sources first and verify against official pages before returning a lead.'
      : 'Use current sources and prefer official pages, but allow reputable secondary sources when they provide useful context.',
    `Must include: ${brief.mustInclude}`,
    `Must exclude: ${brief.mustExclude}`,
    `Positioning guidance: ${brief.positioning}`,
  ]
    .filter(Boolean)
    .join('\n\n');

const leadSearchStringFields = [
  'title',
  'organization',
  'owner',
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
        properties: leadSearchStringFields.reduce<Record<string, { type: 'string' }>>(
          (properties, field) => ({ ...properties, [field]: { type: 'string' } }),
          { priority: { type: 'string' } },
        ),
        required: ['priority', ...leadSearchStringFields],
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

const isDeadlineDrivenTemplate = (list: PipeList) => {
  const identity = `${list.templateKey} ${list.name} ${templateCatalog[list.templateKey].label}`.toLowerCase();
  return ['pitch', 'grant', 'competition', 'challenge', 'award', 'prize', 'rfp', 'application deadline'].some((token) =>
    identity.includes(token),
  );
};

const leadSearchTemplatePolicy = (list: PipeList, today: string) => {
  const identity = `${list.templateKey} ${list.name} ${templateCatalog[list.templateKey].label}`.toLowerCase();

  if (identity.includes('pitch') || identity.includes('competition') || identity.includes('prize')) {
    return `Template policy: this is a pitch competition list. Find only open startup pitch competitions, founder award applications, startup challenges, and prize competitions that PulseCheck can apply to, submit to, or compete in. Only include opportunities with an explicit application/submission deadline on or after ${today}. Put that deadline in dueDate. Exclude expired, closed, waitlist-only, vague, undated, event-only, spectator-only, demo-day-only, showcase-only, networking, webinar, and accelerator-cohort pages unless the page has a current application to pitch or compete. Prefer official program pages or organizer pages.`;
  }

  if (identity.includes('grant') || identity.includes('award') || identity.includes('challenge')) {
    return `Template policy: this is a grant or non-dilutive funding list. Find open grant, award, challenge, innovation fund, or public/private funding opportunities relevant to PulseCheck. Only include opportunities with an explicit application deadline on or after ${today}. Put that deadline in dueDate. Exclude expired, closed, vague, or undated opportunities. Prefer official funder pages.`;
  }

  if (identity.includes('vc') || identity.includes('investor')) {
    return `Template policy: this is an investor list. Find relevant venture funds, angel groups, accelerators, or investor programs for sports performance, digital health, wellness, education technology, AI, or athlete/team markets. Do not force a dueDate unless there is a real application deadline. Use nextStep for the best outreach or application action.`;
  }

  if (identity.includes('university') || identity.includes('pilot')) {
    return `Template policy: this is a university pilot list. Find universities, athletic departments, sports performance labs, wellness programs, psychology/mental-performance groups, or innovation offices that could plausibly run a PulseCheck pilot. Do not force a dueDate. Use pilotScope, decisionMaker, segment, athleteCount, and nextStep when the source supports them.`;
  }

  if (identity.includes('contract')) {
    return `Template policy: this is a contract pipeline. Find procurement, partnership, RFP, vendor, or paid-program opportunities relevant to PulseCheck. If the source has a submission deadline, dueDate must be on or after ${today}; otherwise leave dueDate blank and use expectedCloseDate only for a practical follow-up target if supported.`;
  }

  return `Template policy: match the user's PipeList purpose. If this looks like a deadline-driven application list, only include leads with explicit deadlines on or after ${today}. If it is relationship-driven, do not invent dates and leave dueDate blank unless a real deadline exists.`;
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
    sourced: listStages[0]?.id || 'sourced',
    contacted: listStages[1]?.id || listStages[0]?.id || 'contacted',
    'in-review': listStages[2]?.id || listStages[0]?.id || 'in-review',
    negotiating: listStages.find((stageConfig) => stageConfig.id === 'negotiating')?.id || listStages[0]?.id || 'negotiating',
    won: listStages.find((stageConfig) => stageConfig.outcome === 'won')?.id || listStages[0]?.id || 'won',
    parked: listStages.find((stageConfig) => stageConfig.outcome === 'lost')?.id || listStages[0]?.id || 'parked',
  };
  return legacyMap[stage] || listStages[0]?.id || stage;
};

const normalizeActivityLog = (log: Partial<ActivityLog>): ActivityLog => {
  const now = new Date().toISOString();
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
    createdAt: log.createdAt || now,
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
    templateKey === 'pitch'
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

const timestampToDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  return null;
};

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

const itemValue = (item: PipelineItem) => parseMoney(item.acv || item.amount);

const formatMoney = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
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
  const [leadCopyMessage, setLeadCopyMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [attachmentLinkName, setAttachmentLinkName] = useState('');
  const [attachmentLinkUrl, setAttachmentLinkUrl] = useState('');
  const [attachmentMessage, setAttachmentMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [leadShareMessage, setLeadShareMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [leadShareUrl, setLeadShareUrl] = useState('');
  const [leadMoveMessage, setLeadMoveMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [moveTargetListId, setMoveTargetListId] = useState('');
  const [selectedDetailItemId, setSelectedDetailItemId] = useState<string>('');
  const [detailModalMode, setDetailModalMode] = useState<DetailModalMode>('details');
  const [selectedLogItemId, setSelectedLogItemId] = useState<string>('');
  const [logListFilter, setLogListFilter] = useState<string>('all');
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
  const updateLeadSearchBrief = <Key extends keyof LeadSearchBrief>(field: Key, value: LeadSearchBrief[Key]) => {
    setLeadSearchBrief((currentBrief) => ({
      ...currentBrief,
      [field]: value,
    }));
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
        .sort((left, right) => {
          const leftDate = left.log.weekOf || left.log.createdAt;
          const rightDate = right.log.weekOf || right.log.createdAt;
          return rightDate.localeCompare(leftDate);
        }),
    [allItemRows],
  );

  const filteredLogRows = useMemo(
    () => allLogRows.filter(({ list }) => logListFilter === 'all' || list.id === logListFilter),
    [allLogRows, logListFilter],
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
        const matchesStage = stageFilter === 'all' || item.stage === stageFilter;
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
  }, [activeListItems, query, stageFilter]);

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

  useEffect(() => {
    if (!selectedDetailItemId) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedDetailItemId('');
        setDetailModalMode('details');
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedDetailItemId]);

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

  const resetEditor = () => {
    setDraft(defaultDraft(activeList.stages[0]?.id));
    setEditingItemId(null);
    setIsEditorOpen(false);
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
    setIsLeadGenModalOpen(false);
  };

  const sanitizeGeneratedLead = (lead: Partial<GeneratedLead>): GeneratedLead => {
    const stage = normalizeStageId(lead.stage || activeList.stages[0]?.id || 'sourced', activeList.stages);
    const priority = lead.priority === 'high' || lead.priority === 'low' ? lead.priority : 'medium';

    return {
      ...defaultDraft(stage),
      title: lead.title?.trim() || lead.organization?.trim() || 'Untitled opportunity',
      organization: lead.organization?.trim() || '',
      owner: lead.owner?.trim() || '',
      stage,
      priority,
      amount: lead.amount?.trim() || '',
      dueDate: lead.dueDate?.trim() || '',
      nextStep: lead.nextStep?.trim() || '',
      notes: cleanDealNotes(lead.notes),
      sourceUrl: lead.sourceUrl?.trim() || '',
      segment: lead.segment?.trim() || '',
      decisionMaker: lead.decisionMaker?.trim() || '',
      acv: lead.acv?.trim() || '',
      expectedCloseDate: lead.expectedCloseDate?.trim() || '',
      contractTerm: lead.contractTerm?.trim() || '',
      pilotScope: lead.pilotScope?.trim() || '',
      athleteCount: lead.athleteCount?.trim() || '',
      pilotStart: lead.pilotStart?.trim() || '',
      pilotEnd: lead.pilotEnd?.trim() || '',
      conversionLikelihood: lead.conversionLikelihood?.trim() || '',
      grossMargin: lead.grossMargin?.trim() || '',
      partnerCost: lead.partnerCost?.trim() || '',
      hardwareCost: lead.hardwareCost?.trim() || '',
      lossReason: lead.lossReason?.trim() || '',
      expansionPath: lead.expansionPath?.trim() || '',
      rationale: lead.rationale?.trim() || '',
      sourceEvidence: lead.sourceEvidence?.trim() || '',
      deadlineStatus: lead.deadlineStatus?.trim() || '',
    };
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
      const deadlineRequired = isDeadlineDrivenTemplate(activeList);
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

PulseCheck context: PulseCheck helps teams, athletes, schools, clinics, and sports/wellness programs track mental readiness, wellness signals, engagement, and performance support. Favor opportunities related to sport psychology, athlete mental readiness, sports performance, digital health, wellness, mental performance, athlete support, AI, education, team operations, youth/college athletics, and healthcare-adjacent innovation.

Current date: ${today}.

Research rules:
- Use web search and prioritize official/current sources.
- Return only leads that are relevant to the active PipeList and PulseCheck.
- Avoid duplicates already in the user's list.
- Never invent deadlines, prizes, contacts, amounts, fit claims, or organizations.
- If a source has an explicit deadline, dueDate must use ISO format YYYY-MM-DD and must not be before ${today}.
- If the template is deadline-driven, every returned lead must have a verified dueDate on or after ${today}.
- If the template is relationship-driven, dueDate can be "" unless the source provides a real deadline.
- For pitch competition lists, do not return demo-day/showcase/networking/spectator event pages unless they have an active application or submission path for PulseCheck to compete.
- For pitch competition lists, nextStep should be an application/submission action, not "attend", "watch", or "register for" an event.
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
                  templatePolicy: leadSearchTemplatePolicy(activeList, today),
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
      const nextLeads = sanitizedLeads.filter((lead) => isGeneratedLeadEligible(lead, activeList, today));

      setGeneratedLeads(nextLeads);
      setLeadGenMessage(
        nextLeads.length > 0
          ? {
              type: 'success',
              text:
                sanitizedLeads.length > nextLeads.length
                  ? `Found ${formatCount(nextLeads.length, 'lead')}. Filtered out event-only or expired matches.`
                  : `Found ${formatCount(nextLeads.length, 'lead')}. Review and add the ones you want.`,
            }
          : {
              type: 'info',
              text:
                sanitizedLeads.length > 0
                  ? 'The search only found expired or event-only matches. Try searching for open application deadlines.'
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

  const formatClipboardSection = (title: string, rows: Array<[string, string | number | undefined]>) => {
    const body = rows
      .map(([label, value]) => [label, String(value || '').trim()] as const)
      .filter(([, value]) => value.length > 0)
      .map(([label, value]) => `${label}: ${value}`)
      .join('\n');

    return body ? `${title}\n${body}` : '';
  };

  const buildLeadDetailsClipboardText = (item: PipelineItem, stage: StageConfig) => {
    const valueText = item.acv || item.amount ? formatMoney(itemValue(item)) : '';
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

    return [
      formatClipboardSection('Lead Details', [
        ['Title', item.title],
        ['PipeList', activeList.name],
        ['Template', templateCatalog[activeList.templateKey].label],
        ['Organization', item.organization],
        ['Stage', `${stage.label} (${item.stage})`],
        ['Importance', importanceLabel(item.priority)],
        ['Value', valueText],
        ['Owner', item.owner],
        ['Segment', item.segment],
        ['Decision Maker', item.decisionMaker],
        ['Next Step', item.nextStep],
        ['Source URL', item.sourceUrl],
      ]),
      formatClipboardSection('Financials & Dates', [
        ['ACV', item.acv],
        ['Amount / Prize', item.amount],
        ['Expected Close', item.expectedCloseDate],
        ['Due Date', item.dueDate],
        ['Contract Term', item.contractTerm],
        ['Partner Cost', item.partnerCost],
        ['Hard Cost', item.hardwareCost],
        ['Margin Notes', item.grossMargin],
      ]),
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

    const cleanUrl = leadUrl.trim();
    if (!cleanUrl) {
      setLeadExtractMessage({ type: 'error', text: 'Paste a lead URL first.' });
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
          url: cleanUrl,
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
        throw new Error(payload?.error || 'Unable to analyze that URL.');
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
          title: extracted.title?.trim() || new URL(cleanUrl).hostname.replace(/^www\./, ''),
          organization: extracted.organization?.trim() || '',
          sourceUrl: cleanUrl,
          notes: [
            cleanDealNotes(extracted.notes),
            extracted.missingFields && extracted.missingFields.length > 0
              ? `Missing fields to review: ${extracted.missingFields.join(', ')}`
              : '',
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
      setStageFilter('all');
      setSelectedDetailItemId(nextItem.id);
      setSelectedLogItemId(nextItem.id);
      setDetailModalMode('details');
      setDraft({
        title: nextItem.title,
        organization: nextItem.organization,
        owner: nextItem.owner,
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
        text: error instanceof Error ? error.message : 'Unable to analyze that URL.',
      });
      setIsLeadUrlModalOpen(true);
    } finally {
      setIsAnalyzingLead(false);
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
    const draftToSave = { ...draft, notes: cleanDealNotes(draft.notes) };
    if (!draftToSave.title.trim() && !draftToSave.organization.trim()) return;

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
    setDraft({ ...editableItem, notes: cleanDealNotes(editableItem.notes) });
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

    const grouped = new Map<
      string,
      {
        email: string;
        access: ShareAccess;
        status: 'sent' | 'accepted';
        sentAt?: unknown;
        acceptedAt?: unknown;
        listNames: string[];
        inviteUrl: string;
      }
    >();

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
        const idToken = await user.getIdToken();
        await Promise.all(
          accountEmails.map(async (email) => {
            const invitePath = `/PipeLists?invite=${encodeURIComponent(activePayload.id)}&inviteBatch=${encodeURIComponent(inviteBatchId)}&inviteEmail=${encodeURIComponent(email)}`;
            const inviteUrl = `${window.location.origin}${invitePath}`;
            const response = await fetch('/api/pipelists/send-invite', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                toEmail: email,
                inviteUrl,
                listNames: targetLists.map((list) => list.name),
                access: shareAccess,
                ownerName: profile?.displayName || user.displayName || 'Tremaine Grant',
                ownerEmail: user.email || TREMAINE_OWNER_EMAIL,
                inviteBatchId,
              }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result?.success === false) {
              throw new Error(result?.error || `Unable to email ${email}.`);
            }
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
    <form onSubmit={handleSaveItem} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['title', 'Opportunity Name', 'Opportunity name'],
          ['organization', 'Organization', 'Company, school, fund'],
          ['owner', 'Owner', 'Owner'],
          ['segment', 'Segment', 'Category, fit, or type'],
          ['decisionMaker', 'Decision Maker', 'Role or name'],
          ['acv', 'ACV', '$'],
          ['amount', 'Amount / Prize', '$'],
          ['expectedCloseDate', 'Expected Close', 'date'],
          ['contractTerm', 'Contract Term', '12 months'],
          ['pilotStart', 'Start Date', 'date'],
          ['pilotEnd', 'End Date', 'date'],
          ['athleteCount', 'Count', '42'],
          ['sourceUrl', 'Source URL', 'https://example.com'],
        ].map(([key, label, placeholder]) => (
          <label key={key} className={key === 'sourceUrl' ? 'block md:col-span-2' : 'block'} htmlFor={`pipe-${key}`}>
            <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">{label}</span>
            <input
              id={`pipe-${key}`}
              type={placeholder === 'date' ? 'date' : 'text'}
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
          <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Due Date</span>
          <input
            id="pipe-dueDate"
            type="date"
            value={draft.dueDate}
            onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
            className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
          />
        </label>
      </div>

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

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={resetEditor}
            className="inline-flex h-10 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-stone-500 transition hover:text-stone-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-testid="pipe-save-opportunity"
            className="inline-flex h-10 items-center justify-center rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
          >
            Save
          </button>
        </div>
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
                        {formatCount(list.items.filter((item) => !isItemDeleted(item)).length, 'opportunity')} · {templateCatalog[list.templateKey].label}
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

                <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                  <div className="border-b border-stone-100 bg-stone-50 px-4 py-3 text-xs font-semibold uppercase text-stone-400">
                    Timeline
                  </div>
                  {filteredLogRows.length > 0 ? (
                    <div className="divide-y divide-stone-100">
                      {filteredLogRows.map(({ list, item, log }) => (
                        <article key={`${list.id}-${item.id}-${log.id}`} className="px-4 py-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
                                  {logDisplayLabel(log)}
                                </span>
                                <span className="text-xs text-stone-400">{log.weekOf}</span>
                                <span className="text-xs text-stone-400">{list.name}</span>
                                {log.followUpDate && (
                                  <span className="text-xs text-stone-400">
                                    {followUpDateLabel(log.nextStep)} {log.followUpDate}
                                  </span>
                                )}
                              </div>
                              <h4 className="mt-2 text-sm font-semibold text-stone-950">{log.summary || log.notes || 'Untitled log'}</h4>
                              <p className="mt-1 text-sm text-stone-500">
                                {item.title}
                                {item.organization ? ` · ${item.organization}` : ''}
                              </p>
                              {log.nextStep && <p className="mt-1 text-sm leading-6 text-stone-500">Next: {log.nextStep}</p>}
                              {log.notes && log.notes !== log.summary && <p className="mt-1 text-sm leading-6 text-stone-500">{log.notes}</p>}
                            </div>
                            <div className="flex items-center gap-2 self-start">
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
                      ))}
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
                  {renderMetricCard('Total', String(activeListItems.length), 'All opportunities in this list', <FileText className="h-4 w-4" />)}
                  {renderMetricCard('Active', String(activeItems), 'Not closed won or lost', <Clock className="h-4 w-4" />, 'bg-sky-50 text-sky-700')}
                  {renderMetricCard('Won', String(wonItems), 'Closed or awarded opportunities', <CheckCircle2 className="h-4 w-4" />, 'bg-emerald-50 text-emerald-700')}
                  {renderMetricCard('Open Value', formatMoney(activeOpenValue), 'ACV or amount for active items', <DollarSign className="h-4 w-4" />, 'bg-amber-50 text-amber-700')}
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

                    {canModify && (
                      <>
                        <button
                          type="button"
                          onClick={openLeadGenModal}
                          className="inline-flex h-11 items-center gap-2 rounded-md border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950"
                        >
                          <Search className="h-4 w-4" />
                          Find leads
                        </button>
                        <button
                          type="button"
                          onClick={openLeadUrlModal}
                          className="inline-flex h-11 items-center gap-2 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                        >
                          <Plus className="h-4 w-4" />
                          Add new lead
                        </button>
                      </>
                    )}
                  </div>
                </div>

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

                <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                  <div className="hidden min-w-[1280px] grid-cols-[260px_210px_128px_120px_140px_280px_104px] gap-4 border-b border-stone-100 bg-stone-50 px-4 py-3 text-xs font-semibold uppercase text-stone-400 lg:grid">
                    <span>Item</span>
                    <span>Organization</span>
                    <span>Stage</span>
                    <span>Value</span>
                    <span>Due Date</span>
                    <span>Next Step</span>
                    <span className="text-right">Actions</span>
                  </div>

                  {filteredItems.length > 0 ? (
                    <div className="divide-y divide-stone-100 lg:min-w-[1280px]">
                      {filteredItems.map((item) => {
                        const stage = getStage(activeList, item.stage);
                        const hasItemValue = Boolean(item.acv || item.amount);
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
                            className="grid cursor-pointer gap-3 px-4 py-4 transition hover:bg-stone-50/80 focus:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-stone-300 lg:grid-cols-[260px_210px_128px_120px_140px_280px_104px] lg:items-center lg:gap-4"
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

                            <div>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${stage.tone}`}>
                                {stage.label}
                              </span>
                            </div>

                            <p className={`text-sm font-semibold text-stone-800 ${hasItemValue ? '' : 'hidden lg:block'}`}>
                              {hasItemValue ? formatMoney(itemValue(item)) : ''}
                            </p>

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
                      <p className="text-sm font-semibold text-stone-900">No items found</p>
                      <p className="mt-1 text-sm text-stone-500">Adjust the filter or add a new item.</p>
                      {canModify && (
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={openLeadGenModal}
                            className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:text-stone-950"
                          >
                            <Search className="h-4 w-4" />
                            Find leads
                          </button>
                          <button
                            type="button"
                            onClick={openLeadUrlModal}
                            className="inline-flex h-10 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                          >
                            <Plus className="h-4 w-4" />
                            Add new lead
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 text-sm text-stone-500">
                  {dueSoonItems} due soon · {activeListItems.filter((item) => item.weeklyLogs.length > 0).length} with logs.
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
          onClick={() => setIsSharePanelOpen(false)}
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
                            className="rounded-md border border-stone-100 bg-[#FAFAF7] px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-stone-900">{invite.email}</p>
                                <p className="mt-0.5 truncate text-xs text-stone-500">
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
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
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
                            <div className="mt-2 flex items-center gap-2 rounded-md border border-stone-200 bg-white px-2 py-1.5">
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

      {isNewListModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/30 px-4 py-6 backdrop-blur-sm"
          onClick={() => setIsNewListModalOpen(false)}
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
          onClick={() => setIsDeleteListModalOpen(false)}
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
          onClick={() => setIsLeadUrlModalOpen(false)}
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
                <h3 className="text-xl font-bold text-stone-950">Add new lead</h3>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  Paste a URL for an investor, grant, competition, school, partner, or contract lead. PipeLists will pull what it can and create the item for review.
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
              <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Lead URL</span>
              <input
                id="pipe-lead-url"
                type="url"
                value={leadUrl}
                onChange={(event) => setLeadUrl(event.target.value)}
                className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                placeholder="https://example.com"
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
          onClick={closeLeadGenModal}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipe-lead-gen-title"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xl"
          >
            <div className="border-b border-stone-100 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
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
                      onChange={(event) => updateLeadSearchBrief('requireFutureDeadline', event.target.checked)}
                      className="h-4 w-4 rounded border-stone-300"
                    />
                    Future deadline
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm font-medium text-stone-700">
                    <input
                      type="checkbox"
                      checked={leadSearchBrief.officialSourcesOnly}
                      onChange={(event) => updateLeadSearchBrief('officialSourcesOnly', event.target.checked)}
                      className="h-4 w-4 rounded border-stone-300"
                    />
                    Official sources
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm font-medium text-stone-700">
                    <input
                      type="checkbox"
                      checked={leadSearchBrief.includeAdjacentFit}
                      onChange={(event) => updateLeadSearchBrief('includeAdjacentFit', event.target.checked)}
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

      {isLogModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/30 px-4 py-6 backdrop-blur-sm"
          onClick={closeLogModal}
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
          onClick={() => {
            resetEditor();
            setSelectedDetailItemId('');
            setDetailModalMode('details');
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
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${selectedDetailStage.tone}`}>
                      {selectedDetailStage.label}
                    </span>
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
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {!selectedDetailIsEditing && detailModalMode === 'logs' && (
                  <button
                    type="button"
                    onClick={() => setDetailModalMode('details')}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
                  >
                    <Layers className="h-4 w-4" />
                    Details
                  </button>
                )}
                {canModify && !selectedDetailIsEditing && (
                  <button
                    type="button"
                    onClick={() => handleEditItem(selectedDetailItem)}
                    className="inline-flex h-9 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                )}
                {!selectedDetailIsEditing && (
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
                {canModify && !selectedDetailIsEditing && !isLeadSharedView && moveTargetLists.length > 0 && (
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
                      {selectedDetailItem.weeklyLogs.map((log) => (
                        <article key={log.id} className="px-4 py-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
                                  {logDisplayLabel(log)}
                                </span>
                                <span className="text-xs text-stone-400">{log.weekOf}</span>
                                {log.followUpDate && (
                                  <span className="text-xs text-stone-400">
                                    {followUpDateLabel(log.nextStep)} {log.followUpDate}
                                  </span>
                                )}
                              </div>
                              <h5 className="mt-2 text-sm font-semibold text-stone-950">{log.summary || log.notes || 'Untitled log'}</h5>
                              {log.nextStep && <p className="mt-1 text-sm leading-6 text-stone-500">Next: {log.nextStep}</p>}
                              {log.notes && log.notes !== log.summary && <p className="mt-1 text-sm leading-6 text-stone-500">{log.notes}</p>}
                            </div>
                            {canModify && (
                              <div className="flex items-center gap-2">
                                {log.systemAction === 'item-deleted' && canRestoreDeletedItem(selectedDetailItem) && (
                                  <button
                                    type="button"
                                    onClick={() => handleRestoreDeletedItem(activeList.id, selectedDetailItem.id)}
                                    className="inline-flex h-9 items-center justify-center rounded-full bg-stone-900 px-3 text-xs font-semibold text-white transition hover:bg-stone-700"
                                  >
                                    Undo Delete
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLog(selectedDetailItem.id, log.id)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-rose-200 hover:text-rose-600"
                                  title="Delete log"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-12 text-center text-sm text-stone-400">No logs yet.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-5 px-5 py-5">
                {renderDetailGrid('grid gap-3 sm:grid-cols-2', [
                  {
                    label: 'Value',
                    value: selectedDetailItem.acv || selectedDetailItem.amount ? formatMoney(itemValue(selectedDetailItem)) : '',
                  },
                  {
                    label: 'Next Date',
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
                  'Pipeline Details',
                  [
                    { label: 'Owner', value: selectedDetailItem.owner },
                    { label: 'Organization', value: selectedDetailItem.organization },
                    { label: 'Segment', value: selectedDetailItem.segment },
                    { label: 'Decision Maker', value: selectedDetailItem.decisionMaker },
                    { label: 'ACV', value: selectedDetailItem.acv },
                    { label: 'Amount / Prize', value: selectedDetailItem.amount },
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
                      {selectedDetailItem.weeklyLogs.slice(0, 3).map((log) => (
                        <article key={log.id} className="bg-white px-4 py-3">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-stone-900">{log.summary || log.notes || logDisplayLabel(log)}</p>
                              <p className="mt-1 text-xs text-stone-400">
                                {log.weekOf} · {logDisplayLabel(log)}
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
