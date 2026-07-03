import React, { useEffect, useMemo, useState } from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import {
  GoogleAuthProvider,
  User,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  DollarSign,
  Download,
  Edit,
  FileText,
  Filter,
  Layers,
  ListPlus,
  LogOut,
  Mail,
  Percent,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import PageHead from '../components/PageHead';
import { simpBudgetAuth, simpBudgetDb, simpBudgetStorage } from '../api/firebase/simpBudgetConfig';

type PipelinePriority = 'high' | 'medium' | 'low';
type ViewMode = 'pipeline' | 'metrics' | 'logs';
type MessageTone = 'success' | 'error' | 'info';
type ShareAccess = 'read' | 'edit';
type ActivityLogType = 'update' | 'meeting' | 'follow-up' | 'decision' | 'risk' | 'document' | 'metrics';
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
  weeklyLogs: ActivityLog[];
  createdAt: string;
  updatedAt: string;
};

type PipeList = {
  id: string;
  name: string;
  description: string;
  accent: string;
  templateKey: TemplateKey;
  stages: StageConfig[];
  items: PipelineItem[];
  createdAt: string;
};

type PipeListShare = {
  id: string;
  ownerUid: string;
  ownerEmail: string;
  list: PipeList;
  access: ShareAccess;
  publicRead: boolean;
  editorEmails: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

type PipeListProfile = {
  displayName: string;
  photoURL: string;
  email: string;
  updatedAt?: unknown;
};

type ItemDraft = Omit<PipelineItem, 'id' | 'createdAt' | 'updatedAt' | 'weeklyLogs'>;
type ActivityLogDraft = Omit<ActivityLog, 'id' | 'createdAt'>;

const STORAGE_KEY = 'pulse-pipe-lists-v2';
const SIMPBUDGET_USERS_COLLECTION = 'simpbudget-users';
const PIPELISTS_SUBCOLLECTION = 'pipeLists';
const PIPELISTS_STATE_DOCUMENT_ID = 'state';
const PIPELIST_SHARES_COLLECTION = 'pipeListShares';
const PIPELIST_PROFILES_COLLECTION = 'pipeListProfiles';
const TREMAINE_OWNER_EMAIL = 'tremaine.grant@gmail.com';
const MAGIC_LINK_EMAIL_STORAGE_KEY = 'pipelists.web.pendingMagicEmail';

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

const logTypeLabels: Record<ActivityLogType, string> = {
  update: 'General Update',
  meeting: 'Meeting',
  'follow-up': 'Follow-Up',
  decision: 'Decision',
  risk: 'Risk',
  document: 'Document Sent',
  metrics: 'Metrics / Pilot Update',
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
    description: 'Formal proposals, term negotiation, gross margin, and close forecasting.',
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

const createItem = (draft: ItemDraft, id = makeId()): PipelineItem => {
  const now = new Date().toISOString();
  return {
    ...draft,
    id,
    weeklyLogs: [],
    createdAt: now,
    updatedAt: now,
  };
};

const createList = (
  templateKey: TemplateKey,
  name = templateCatalog[templateKey].defaultName,
  index = 0,
  items: PipelineItem[] = [],
): PipeList => {
  const template = templateCatalog[templateKey];
  return {
    id: makeId(),
    name,
    description: template.description,
    accent: template.accent || accentClasses[index % accentClasses.length],
    templateKey,
    stages: template.stages,
    items,
    createdAt: new Date().toISOString(),
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
    id: 'pitch-competitions',
    createdAt: '2026-07-03T00:00:00.000Z',
    items: [
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
    notes: item.notes || '',
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
    weeklyLogs: Array.isArray(item.weeklyLogs) ? item.weeklyLogs.map(normalizeActivityLog) : [],
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
  };
};

const normalizeList = (list: Partial<PipeList>, index: number): PipeList => {
  const templateKey = (list.templateKey && templateCatalog[list.templateKey] ? list.templateKey : 'partner') as TemplateKey;
  const template = templateCatalog[templateKey];
  const stages = Array.isArray(list.stages) && list.stages.length > 0 ? list.stages : template.stages;
  return {
    id: list.id || makeId(),
    name: list.name || template.defaultName,
    description: list.description || template.description,
    accent: list.accent || template.accent || accentClasses[index % accentClasses.length],
    templateKey,
    stages,
    items: Array.isArray(list.items) ? list.items.map((item) => normalizeItem(item, stages)) : [],
    createdAt: list.createdAt || new Date().toISOString(),
  };
};

const formatCount = (count: number, singular: string) => {
  if (count === 1) return `${count} ${singular}`;
  const plural = singular.endsWith('y') ? `${singular.slice(0, -1)}ies` : `${singular}s`;
  return `${count} ${plural}`;
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
const itemProbability = (list: PipeList, item: PipelineItem) => parsePercent(item.conversionLikelihood) || getStage(list, item.stage).probability;
const weightedValue = (list: PipeList, item: PipelineItem) => itemValue(item) * (itemProbability(list, item) / 100);

const formatMoney = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
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
            Sign in with {TREMAINE_OWNER_EMAIL} to manage VC, grants, pitch competitions,
            pilots, contract negotiations, weighted forecasts, and list metrics.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ['Pilot Track', 'Institution stages plus weekly product proof.'],
              ['Contract Track', 'ACV, close dates, margin, and expansion path.'],
              ['Metrics View', 'Weighted value, logs, due dates, and proof signals.'],
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
              Access is limited to {TREMAINE_OWNER_EMAIL}. Other accounts are signed out automatically.
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
  const [draft, setDraft] = useState<ItemDraft>(defaultDraft(initialLists[0].stages[0].id));
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isLeadUrlModalOpen, setIsLeadUrlModalOpen] = useState(false);
  const [leadUrl, setLeadUrl] = useState('');
  const [isAnalyzingLead, setIsAnalyzingLead] = useState(false);
  const [leadExtractMessage, setLeadExtractMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [selectedDetailItemId, setSelectedDetailItemId] = useState<string>('');
  const [selectedLogItemId, setSelectedLogItemId] = useState<string>('');
  const [logDraft, setLogDraft] = useState<ActivityLogDraft>(defaultLogDraft(initialLists[0].templateKey));
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [appMessage, setAppMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [magicEmail, setMagicEmail] = useState(TREMAINE_OWNER_EMAIL);
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [savingToCloud, setSavingToCloud] = useState(false);
  const [shareId] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('share') || '';
  });
  const [shareDoc, setShareDoc] = useState<PipeListShare | null>(null);
  const [shareMessage, setShareMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [shareAccess, setShareAccess] = useState<ShareAccess>('read');
  const [shareEditorEmails, setShareEditorEmails] = useState('');
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const [profile, setProfile] = useState<PipeListProfile | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profileMessage, setProfileMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const normalizedUserEmail = user?.email?.toLowerCase() || '';
  const isSharedView = Boolean(shareId);
  const isOwner = normalizedUserEmail === TREMAINE_OWNER_EMAIL;
  const canEditShared =
    isSharedView &&
    !!user &&
    !!shareDoc &&
    (shareDoc.ownerUid === user.uid ||
      shareDoc.ownerEmail.toLowerCase() === normalizedUserEmail ||
      shareDoc.editorEmails.map((email) => email.toLowerCase()).includes(normalizedUserEmail));
  const canModify = !isSharedView || canEditShared;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(simpBudgetAuth, async (currentUser) => {
      setAuthReady(true);
      setUser(currentUser);

      if (shareId) {
        if (!currentUser) {
          setProfile(null);
          setProfileName('');
          return;
        }

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
        return;
      }

      const email = currentUser.email?.toLowerCase() || '';
      if (email !== TREMAINE_OWNER_EMAIL) {
        setAuthMessage({
          type: 'error',
          text: `Signed in as ${currentUser.email || 'another account'}. PipeLists is limited to ${TREMAINE_OWNER_EMAIL}.`,
        });
        setDataReady(false);
        await signOut(simpBudgetAuth);
        return;
      }

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

        const stateRef = doc(
          simpBudgetDb,
          SIMPBUDGET_USERS_COLLECTION,
          currentUser.uid,
          PIPELISTS_SUBCOLLECTION,
          PIPELISTS_STATE_DOCUMENT_ID,
        );
        const snapshot = await getDoc(stateRef);
        let nextLists = initialLists;

        if (snapshot.exists()) {
          const data = snapshot.data() as { lists?: Partial<PipeList>[] };
          if (Array.isArray(data.lists) && data.lists.length > 0) {
            nextLists = data.lists.map(normalizeList);
          }
        } else if (typeof window !== 'undefined') {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          if (stored) {
            try {
              const parsed = JSON.parse(stored) as Partial<PipeList>[];
              if (Array.isArray(parsed) && parsed.length > 0) {
                nextLists = parsed.map(normalizeList);
              }
            } catch (error) {
              console.warn('[PipeLists] Unable to parse stored local pipeline data:', error);
            }
          }
        }

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
  }, [shareId]);

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

        const normalizedList = normalizeList(data.list, 0);
        const nextShare: PipeListShare = {
          id: snapshot.id,
          ownerUid: data.ownerUid || '',
          ownerEmail: data.ownerEmail || '',
          list: normalizedList,
          access: data.access === 'edit' ? 'edit' : 'read',
          publicRead: data.publicRead === true,
          editorEmails: Array.isArray(data.editorEmails) ? data.editorEmails : [],
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };

        setShareDoc(nextShare);
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
    if (typeof window === 'undefined') return;
    if (!isSignInWithEmailLink(simpBudgetAuth, window.location.href)) return;

    const completeEmailLinkSignIn = async () => {
      const storedEmail = window.localStorage.getItem(MAGIC_LINK_EMAIL_STORAGE_KEY);
      const email = storedEmail || window.prompt('Confirm your email for PipeLists sign-in') || '';
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
    if (shareId) return;
    if (!user || !dataReady) return;
    if ((user.email || '').toLowerCase() !== TREMAINE_OWNER_EMAIL) return;

    let cancelled = false;

    const saveLists = async () => {
      setSavingToCloud(true);

      try {
        const stateRef = doc(
          simpBudgetDb,
          SIMPBUDGET_USERS_COLLECTION,
          user.uid,
          PIPELISTS_SUBCOLLECTION,
          PIPELISTS_STATE_DOCUMENT_ID,
        );
        await setDoc(
          stateRef,
          {
            ownerEmail: user.email || '',
            lists,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
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
  }, [dataReady, lists, shareId, user]);

  useEffect(() => {
    if (!shareId || !shareDoc || !dataReady || !canEditShared) return;

    let cancelled = false;

    const saveSharedList = async () => {
      setSavingToCloud(true);

      try {
        const nextList = lists[0];
        if (!nextList) return;

        const shareRef = doc(simpBudgetDb, PIPELIST_SHARES_COLLECTION, shareId);
        await setDoc(
          shareRef,
          {
            list: nextList,
            updatedAt: serverTimestamp(),
            lastEditedBy: {
              uid: user?.uid || '',
              email: user?.email || '',
              displayName: profile?.displayName || user?.displayName || '',
              photoURL: profile?.photoURL || user?.photoURL || '',
            },
          },
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

  const activeList = useMemo(
    () => lists.find((list) => list.id === activeListId) || lists[0],
    [activeListId, lists],
  );

  const allRows = useMemo(
    () => lists.flatMap((list) => list.items.map((item) => ({ list, item }))),
    [lists],
  );

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase();

    return activeList.items.filter((item) => {
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
    });
  }, [activeList.items, query, stageFilter]);

  const countsByStage = useMemo(
    () =>
      activeList.stages.reduce<Record<string, number>>((accumulator, stage) => {
        accumulator[stage.id] = activeList.items.filter((item) => item.stage === stage.id).length;
        return accumulator;
      }, {}),
    [activeList.items, activeList.stages],
  );

  const activeItems = activeList.items.filter((item) => !isClosedStage(activeList, item.stage)).length;
  const wonItems = activeList.items.filter((item) => isWonStage(activeList, item.stage)).length;
  const dueSoonItems = activeList.items.filter((item) => {
    const dueDate = item.expectedCloseDate || item.dueDate || item.pilotEnd;
    if (!dueDate) return false;
    const dueTime = new Date(`${dueDate}T12:00:00`).getTime();
    const now = new Date().getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return dueTime >= now - 24 * 60 * 60 * 1000 && dueTime <= now + sevenDays;
  }).length;
  const activeOpenValue = activeList.items
    .filter((item) => !isClosedStage(activeList, item.stage))
    .reduce((sum, item) => sum + itemValue(item), 0);
  const activeWeightedValue = activeList.items.reduce((sum, item) => sum + weightedValue(activeList, item), 0);

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
      weightedValue: allRows.reduce((sum, row) => sum + weightedValue(row.list, row.item), 0),
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
    activeList.items.find((item) => item.id === selectedLogItemId) ||
    activeList.items.find((item) => item.weeklyLogs.length > 0 || item.stage.includes('pilot')) ||
    activeList.items[0];
  const showLogMetrics = activeList.templateKey === 'university-pilot' || logDraft.type === 'metrics';

  const selectedDetailItem = activeList.items.find((item) => item.id === selectedDetailItemId) || null;

  useEffect(() => {
    if (selectedDetailItemId && !activeList.items.some((item) => item.id === selectedDetailItemId)) {
      setSelectedDetailItemId('');
    }
  }, [activeList.items, selectedDetailItemId]);

  useEffect(() => {
    if (!selectedDetailItemId) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedDetailItemId('');
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedDetailItemId]);

  const resetEditor = () => {
    setDraft(defaultDraft(activeList.stages[0]?.id));
    setEditingItemId(null);
    setIsEditorOpen(false);
  };

  const openLeadUrlModal = () => {
    if (!canModify) return;
    setLeadUrl('');
    setLeadExtractMessage(null);
    setIsLeadUrlModalOpen(true);
    setSelectedDetailItemId('');
    setViewMode('pipeline');
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
      const idToken = await simpBudgetAuth.currentUser?.getIdToken();
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

      const payload = await response.json();
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
      const nextItem = createItem(
        {
          ...defaultDraft(stage),
          ...extracted,
          stage,
          priority: extracted.priority || 'medium',
          title: extracted.title?.trim() || new URL(cleanUrl).hostname.replace(/^www\./, ''),
          organization: extracted.organization?.trim() || '',
          sourceUrl: cleanUrl,
          notes: [
            extracted.notes,
            extracted.confidence !== undefined ? `AI confidence: ${Math.round(extracted.confidence)}%` : '',
            extracted.missingFields && extracted.missingFields.length > 0
              ? `Missing fields to review: ${extracted.missingFields.join(', ')}`
              : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
        makeId(),
      );

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
    if (isSharedView) return;
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
    resetEditor();
  };

  const handleSaveItem = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canModify) return;
    if (!draft.title.trim() && !draft.organization.trim()) return;

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
                    ...draft,
                    title: draft.title.trim() || item.title,
                    organization: draft.organization.trim(),
                    updatedAt: new Date().toISOString(),
                  }
                : item,
            ),
          };
        }

        return {
          ...list,
          items: [
            createItem({
              ...draft,
              title: draft.title.trim() || 'Untitled opportunity',
              organization: draft.organization.trim(),
            }),
            ...list.items,
          ],
        };
      }),
    );

    resetEditor();
  };

  const handleEditItem = (item: PipelineItem) => {
    if (!canModify) return;
    const { id, createdAt, updatedAt, weeklyLogs, ...editableItem } = item;
    void id;
    void createdAt;
    void updatedAt;
    void weeklyLogs;
    setDraft(editableItem);
    setEditingItemId(item.id);
    setIsEditorOpen(true);
    setViewMode('pipeline');
    setSelectedDetailItemId('');
  };

  const handleDeleteItem = (itemId: string) => {
    if (!canModify) return;
    setLists((currentLists) =>
      currentLists.map((list) =>
        list.id === activeList.id
          ? {
              ...list,
              items: list.items.filter((item) => item.id !== itemId),
            }
          : list,
      ),
    );

    if (editingItemId === itemId) resetEditor();
    if (selectedLogItemId === itemId) setSelectedLogItemId('');
    if (selectedDetailItemId === itemId) setSelectedDetailItemId('');
  };

  const handleDeleteList = () => {
    if (isSharedView) return;
    if (lists.length <= 1) return;

    const nextLists = lists.filter((list) => list.id !== activeList.id);
    setLists(nextLists);
    setActiveListId(nextLists[0].id);
    setStageFilter('all');
    setSelectedLogItemId('');
    setLogDraft(defaultLogDraft(nextLists[0].templateKey));
    setSelectedDetailItemId('');
    resetEditor();
  };

  const handleSaveLog = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canModify) return;
    if (!selectedLogItem) return;
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
        list.id === activeList.id
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === selectedLogItem.id
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
    setLogDraft(defaultLogDraft(activeList.templateKey));
  };

  const handleDeleteLog = (itemId: string, logId: string) => {
    if (!canModify) return;
    setLists((currentLists) =>
      currentLists.map((list) =>
        list.id === activeList.id
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
        'Stage Probability',
        'Weighted Value',
        'Priority',
        'Owner',
        'Segment',
        'Decision Maker',
        'ACV',
        'Amount',
        'Expected Close Date',
        'Due Date',
        'Pilot Scope',
        'Athlete Count',
        'Gross Margin',
        'Partner Cost',
        'Hardware Cost',
        'Next Step',
        'Expansion Path',
        'Loss Reason',
        'Notes',
        'Source URL',
      ],
      ...activeList.items.map((item) => {
        const stage = getStage(activeList, item.stage);
        return [
          activeList.name,
          templateCatalog[activeList.templateKey].label,
          item.title,
          item.organization,
          stage.label,
          `${itemProbability(activeList, item)}%`,
          String(Math.round(weightedValue(activeList, item))),
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

  const shareUrl =
    typeof window !== 'undefined' && shareDoc
      ? `${window.location.origin}/PipeLists?share=${shareDoc.id}`
      : '';

  const normalizeEmailList = (value: string) =>
    Array.from(
      new Set(
        value
          .split(/[\n,;]/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    );

  const createOrUpdateShareLink = async () => {
    if (!user || !isOwner || isSharedView) return;

    setShareMessage(null);

    try {
      const nextShareId = shareDoc?.id || makeId();
      const editorEmails = shareAccess === 'edit' ? normalizeEmailList(shareEditorEmails) : [];
      const payload: PipeListShare = {
        id: nextShareId,
        ownerUid: user.uid,
        ownerEmail: user.email || TREMAINE_OWNER_EMAIL,
        list: activeList,
        access: shareAccess,
        publicRead: true,
        editorEmails,
      };

      await setDoc(
        doc(simpBudgetDb, PIPELIST_SHARES_COLLECTION, nextShareId),
        {
          ...payload,
          createdAt: shareDoc?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setShareDoc(payload);
      setShareMessage({
        type: 'success',
        text:
          shareAccess === 'edit'
            ? 'Share link is live. Invited editors can sign in to edit; everyone else sees read-only.'
            : 'Read-only share link is live.',
      });
    } catch (error) {
      console.error('Unable to create PipeLists share link:', error);
      setShareMessage({
        type: 'error',
        text: readFirestoreError(error, 'Unable to create this share link.'),
      });
    }
  };

  const copyShareLink = async () => {
    if (!shareUrl || typeof navigator === 'undefined') return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage({ type: 'success', text: 'Share link copied.' });
    } catch (error) {
      setShareMessage({ type: 'info', text: shareUrl });
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
        {
          ...nextProfile,
          updatedAt: serverTimestamp(),
        },
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
      const result = await signInWithPopup(simpBudgetAuth, provider);
      const email = result.user.email?.toLowerCase() || '';
      if (!isSharedView && email !== TREMAINE_OWNER_EMAIL) {
        setAuthMessage({
          type: 'error',
          text: `That account is ${result.user.email || 'not the owner account'}. Please sign in with ${TREMAINE_OWNER_EMAIL}.`,
        });
        await signOut(simpBudgetAuth);
      } else if (
        isSharedView &&
        shareDoc?.access === 'edit' &&
        shareDoc.editorEmails.length > 0 &&
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

    if (!isSharedView && email !== TREMAINE_OWNER_EMAIL) {
      setAuthMessage({ type: 'error', text: `PipeLists is limited to ${TREMAINE_OWNER_EMAIL}.` });
      return;
    }

    if (
      isSharedView &&
      shareDoc?.access === 'edit' &&
      shareDoc.editorEmails.length > 0 &&
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

  const renderDetailField = (label: string, value: React.ReactNode, wide = false) => {
    const isEmpty = value === null || value === undefined || value === '';
    return (
      <div className={`rounded-md border border-stone-100 bg-[#FAFAF7] px-3 py-2 ${wide ? 'md:col-span-2' : ''}`}>
        <p className="text-xs font-semibold uppercase text-stone-400">{label}</p>
        <div className="mt-1 break-words text-sm leading-6 text-stone-700">{isEmpty ? 'Not set' : value}</div>
      </div>
    );
  };

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
            <p className="text-base font-semibold text-stone-950">Loading shared PipeList</p>
          </div>
        </main>
      </>
    );
  }

  if (isSharedView && shareMessage?.type === 'error' && !shareDoc) {
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

  if (!isSharedView && (!authReady || !user || !isOwner)) {
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
                      : 'Read-only share'
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
              {canModify && (
                <button
                  type="button"
                  data-testid="pipe-new-opportunity"
                  onClick={openLeadUrlModal}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-700"
                >
                  <Plus className="h-4 w-4" />
                  Add new lead
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
                        {formatCount(list.items.length, 'opportunity')} · {templateCatalog[list.templateKey].label}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {!isSharedView && (
                <form onSubmit={handleCreateList} className="mt-4 border-t border-stone-100 pt-4">
                  <label className="mb-1.5 block text-xs font-semibold uppercase text-stone-400" htmlFor="new-list-template">
                    Template
                  </label>
                  <select
                    id="new-list-template"
                    value={newListTemplateKey}
                    onChange={(event) => setNewListTemplateKey(event.target.value as TemplateKey)}
                    className="mb-2 h-10 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:bg-white"
                  >
                    {(Object.keys(templateCatalog) as TemplateKey[]).map((key) => (
                      <option key={key} value={key}>
                        {templateCatalog[key].label}
                      </option>
                    ))}
                  </select>

                  <label className="sr-only" htmlFor="new-list-name">
                    List name
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="new-list-name"
                      value={newListName}
                      onChange={(event) => setNewListName(event.target.value)}
                      className="min-w-0 flex-1 rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white"
                      placeholder={templateCatalog[newListTemplateKey].defaultName}
                    />
                    <button
                      type="submit"
                      data-testid="pipe-add-list"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-stone-900 text-white transition hover:bg-stone-700"
                      title="Add list"
                    >
                      <ListPlus className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}

              {!isSharedView && isOwner && (
                <div className="mt-4 border-t border-stone-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsSharePanelOpen((current) => !current)}
                    className="inline-flex h-10 w-full items-center justify-center rounded-md border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:text-stone-950"
                  >
                    Share Selected List
                  </button>

                  {isSharePanelOpen && (
                    <div className="mt-3 space-y-3 rounded-lg border border-stone-200 bg-[#FAFAF7] p-3">
                      <label className="block" htmlFor="pipe-share-access">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Access</span>
                        <select
                          id="pipe-share-access"
                          value={shareAccess}
                          onChange={(event) => setShareAccess(event.target.value as ShareAccess)}
                          className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none focus:border-stone-400"
                        >
                          <option value="read">Read-only public link</option>
                          <option value="edit">Read-only public + invited editors</option>
                        </select>
                      </label>

                      {shareAccess === 'edit' && (
                        <label className="block" htmlFor="pipe-share-editors">
                          <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Editor emails</span>
                          <textarea
                            id="pipe-share-editors"
                            value={shareEditorEmails}
                            onChange={(event) => setShareEditorEmails(event.target.value)}
                            className="min-h-20 w-full resize-y rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-stone-400"
                            placeholder="name@example.com, teammate@example.com"
                          />
                        </label>
                      )}

                      <button
                        type="button"
                        onClick={createOrUpdateShareLink}
                        className="inline-flex h-10 w-full items-center justify-center rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                      >
                        Create / Update Link
                      </button>

                      {shareUrl && (
                        <div className="space-y-2">
                          <input
                            readOnly
                            value={shareUrl}
                            className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-xs text-stone-500"
                          />
                          <button
                            type="button"
                            onClick={copyShareLink}
                            className="inline-flex h-9 w-full items-center justify-center rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
                          >
                            Copy Link
                          </button>
                        </div>
                      )}

                      <MessageBanner message={shareMessage} />
                    </div>
                  )}
                </div>
              )}

              {isSharedView && (
                <div className="mt-4 border-t border-stone-100 pt-4">
                  <div className="rounded-lg border border-stone-200 bg-[#FAFAF7] p-3">
                    <p className="text-sm font-semibold text-stone-950">
                      {canEditShared ? 'Editor access' : 'Read-only share'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">
                      {canEditShared
                        ? 'Your changes save back to this shared list.'
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

              {!isSharedView && (
                <button
                  type="button"
                  onClick={handleDeleteList}
                  disabled={lists.length <= 1}
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
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {renderMetricCard(
                    'Open Pipeline',
                    formatMoney(scorecardMetrics.totalOpenValue),
                    `${scorecardMetrics.totalOpenDeals} open opportunities across all lists`,
                    <DollarSign className="h-4 w-4" />,
                  )}
                  {renderMetricCard(
                    'Weighted Forecast',
                    formatMoney(scorecardMetrics.weightedValue),
                    'ACV or amount multiplied by stage probability',
                    <Percent className="h-4 w-4" />,
                    'bg-emerald-50 text-emerald-700',
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
                      ['How much is open?', `${scorecardMetrics.totalOpenDeals} open opportunities, ${formatMoney(scorecardMetrics.totalOpenValue)} unweighted value.`],
                      ['What is weighted value?', `${formatMoney(scorecardMetrics.weightedValue)} based on stage probabilities.`],
                      ['What needs attention soon?', scorecardMetrics.firstExpectedCloseDate || 'Add expected close or due dates to important items.'],
                      ['How much is documented?', `${scorecardMetrics.loggedItems} items have logs, with ${scorecardMetrics.totalLogs} total records.`],
                      ['What proof signals exist?', `${Math.round(scorecardMetrics.checkInRate)}% check-in rate, ${Math.round(scorecardMetrics.signalEvents)} signal events, ${Math.round(scorecardMetrics.staffScore) || 0}/10 staff score from metric logs.`],
                      ['Where does margin compress?', 'Track Gross Margin, Partner Cost, and Hardware Cost when those fields apply.'],
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
              <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                  <h3 className="mb-3 px-1 text-sm font-semibold text-stone-950">Items</h3>
                  <div className="space-y-1.5">
                    {activeList.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedLogItemId(item.id)}
                        className={`w-full rounded-md px-3 py-3 text-left transition ${
                          selectedLogItem?.id === item.id ? 'bg-stone-900 text-white' : 'hover:bg-stone-100'
                        }`}
                      >
                        <span className="block truncate text-sm font-semibold">{item.title}</span>
                        <span className={selectedLogItem?.id === item.id ? 'text-xs text-stone-300' : 'text-xs text-stone-400'}>
                          {item.organization || 'No organization'} · {formatCount(item.weeklyLogs.length, 'log')}
                        </span>
                      </button>
                    ))}
                    {activeList.items.length === 0 && (
                      <p className="px-2 py-8 text-center text-sm text-stone-400">Add an opportunity first.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  {selectedLogItem ? (
                    <>
                      {canModify ? (
                        <form onSubmit={handleSaveLog} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                          <div className="mb-4">
                            <h3 className="text-base font-semibold text-stone-950">Add Log</h3>
                            <p className="mt-1 text-sm text-stone-500">
                              {selectedLogItem.organization || selectedLogItem.title}
                            </p>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            <label className="block" htmlFor="log-weekOf">
                              <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Date</span>
                              <input
                                id="log-weekOf"
                                type="date"
                                value={logDraft.weekOf}
                                onChange={(event) => setLogDraft((current) => ({ ...current, weekOf: event.target.value }))}
                                className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                              />
                            </label>

                            <label className="block" htmlFor="log-type">
                              <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Type</span>
                              <select
                                id="log-type"
                                value={logDraft.type}
                                onChange={(event) =>
                                  setLogDraft((current) => ({
                                    ...current,
                                    type: event.target.value as ActivityLogType,
                                  }))
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

                            <label className="block md:col-span-2" htmlFor="log-summary">
                              <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Summary</span>
                              <input
                                id="log-summary"
                                value={logDraft.summary}
                                onChange={(event) => setLogDraft((current) => ({ ...current, summary: event.target.value }))}
                                className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                                placeholder="What happened?"
                              />
                            </label>

                            <label className="block md:col-span-2" htmlFor="log-nextStep">
                              <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Next Step</span>
                              <input
                                id="log-nextStep"
                                value={logDraft.nextStep}
                                onChange={(event) => setLogDraft((current) => ({ ...current, nextStep: event.target.value }))}
                                className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                                placeholder="Optional follow-up"
                              />
                            </label>

                            <label className="block" htmlFor="log-followUpDate">
                              <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Follow-Up</span>
                              <input
                                id="log-followUpDate"
                                type="date"
                                value={logDraft.followUpDate}
                                onChange={(event) => setLogDraft((current) => ({ ...current, followUpDate: event.target.value }))}
                                className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                              />
                            </label>
                          </div>

                          {showLogMetrics && (
                            <div className="mt-3 rounded-lg border border-stone-100 bg-[#FAFAF7] p-3">
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                {[
                                  ['rosteredAthletes', 'Rostered Athletes'],
                                  ['completedCheckIns', 'Completed Check-Ins'],
                                  ['checkInRate', 'Check-In Rate'],
                                  ['biometricSyncRate', 'Biometric Sync'],
                                  ['signalEvents', 'Signal Events'],
                                  ['noraEngagementRate', 'Nora Engagement'],
                                  ['noraSessions', 'Nora Sessions'],
                                  ['staffFeedbackScore', 'Staff Score'],
                                ].map(([key, label]) => (
                                  <label key={key} className="block" htmlFor={`log-${key}`}>
                                    <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">{label}</span>
                                    <input
                                      id={`log-${key}`}
                                      value={logDraft[key as keyof ActivityLogDraft]}
                                      onChange={(event) =>
                                        setLogDraft((current) => ({
                                          ...current,
                                          [key]: event.target.value,
                                        }))
                                      }
                                      className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-stone-400"
                                      placeholder={key.includes('Rate') ? '%' : undefined}
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          <label className="mt-3 block" htmlFor="log-notes">
                            <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Notes</span>
                            <textarea
                              id="log-notes"
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
                          <h3 className="text-base font-semibold text-stone-950">Logs</h3>
                          <p className="mt-1 text-sm leading-6 text-stone-500">
                            This shared list is read-only. Records are visible below.
                          </p>
                        </div>
                      )}

                      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                        <div className="border-b border-stone-100 bg-stone-50 px-4 py-3 text-xs font-semibold uppercase text-stone-400">
                          Timeline
                        </div>
                        {selectedLogItem.weeklyLogs.length > 0 ? (
                          <div className="divide-y divide-stone-100">
                            {selectedLogItem.weeklyLogs.map((log) => (
                              <article key={log.id} className="px-4 py-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
                                        {logTypeLabels[log.type]}
                                      </span>
                                      <span className="text-xs text-stone-400">{log.weekOf}</span>
                                      {log.followUpDate && <span className="text-xs text-stone-400">Follow up {log.followUpDate}</span>}
                                    </div>
                                    <h4 className="mt-2 text-sm font-semibold text-stone-950">{log.summary || log.notes || 'Untitled log'}</h4>
                                    {log.nextStep && <p className="mt-1 text-sm leading-6 text-stone-500">Next: {log.nextStep}</p>}
                                    {log.notes && log.notes !== log.summary && <p className="mt-1 text-sm leading-6 text-stone-500">{log.notes}</p>}
                                  </div>
                                  {canModify && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteLog(selectedLogItem.id, log.id)}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:border-rose-200 hover:text-rose-600"
                                      title="Delete log"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                                {logHasMetrics(log) && (
                                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                                    {[
                                      ['Check-ins', `${Math.round(derivedCheckInRate(log))}%`],
                                      ['Biometrics', log.biometricSyncRate || '-'],
                                      ['Signals', log.signalEvents || '0'],
                                      ['Nora', log.noraEngagementRate || '-'],
                                      ['Staff', log.staffFeedbackScore || '-'],
                                    ].map(([label, value]) => (
                                      <div key={label} className="rounded-md border border-stone-100 bg-[#FAFAF7] px-3 py-2">
                                        <p className="text-xs text-stone-400">{label}</p>
                                        <p className="text-sm font-semibold text-stone-800">{value}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="px-4 py-12 text-center text-sm text-stone-400">No logs yet.</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-stone-200 bg-white px-4 py-16 text-center shadow-sm">
                      <p className="text-sm font-semibold text-stone-900">No item selected</p>
                      <p className="mt-1 text-sm text-stone-500">Add an opportunity, then record updates here.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {viewMode === 'pipeline' && (
              <>
                <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {renderMetricCard('Total', String(activeList.items.length), 'All opportunities in this list', <FileText className="h-4 w-4" />)}
                  {renderMetricCard('Active', String(activeItems), 'Not closed won or lost', <Clock className="h-4 w-4" />, 'bg-sky-50 text-sky-700')}
                  {renderMetricCard('Won', String(wonItems), 'Closed or awarded opportunities', <CheckCircle2 className="h-4 w-4" />, 'bg-emerald-50 text-emerald-700')}
                  {renderMetricCard('Open Value', formatMoney(activeOpenValue), 'Unweighted ACV or amount', <DollarSign className="h-4 w-4" />, 'bg-amber-50 text-amber-700')}
                  {renderMetricCard('Weighted', formatMoney(activeWeightedValue), 'Stage-adjusted forecast', <Percent className="h-4 w-4" />, 'bg-indigo-50 text-indigo-700')}
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
                      <button
                        type="button"
                        onClick={openLeadUrlModal}
                        className="inline-flex h-11 items-center gap-2 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                      >
                        <Plus className="h-4 w-4" />
                        Add new lead
                      </button>
                    )}
                  </div>
                </div>

                {isEditorOpen && editingItemId && (
                  <form onSubmit={handleSaveItem} className="mb-5 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-stone-950">
                          Edit Item
                        </h3>
                        <p className="mt-1 text-sm text-stone-500">{activeList.name}</p>
                      </div>
                      <button
                        type="button"
                        onClick={resetEditor}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:text-stone-900"
                        title="Close editor"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {[
                        ['title', 'Item', 'Name'],
                        ['organization', 'Organization', 'Company, school, fund'],
                        ['owner', 'Owner', 'Owner'],
                        ['segment', 'Segment', 'D3, mid-major, pro'],
                        ['decisionMaker', 'Decision Maker', 'Role or name'],
                        ['acv', 'ACV', '$'],
                        ['amount', 'Amount / Prize', '$'],
                        ['expectedCloseDate', 'Expected Close', 'date'],
                        ['contractTerm', 'Contract Term', '12 months'],
                        ['pilotStart', 'Pilot Start', 'date'],
                        ['pilotEnd', 'Pilot End', 'date'],
                        ['athleteCount', 'Athlete Count', '42'],
                      ].map(([key, label, placeholder]) => (
                        <label key={key} className="block" htmlFor={`pipe-${key}`}>
                          <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">{label}</span>
                          <input
                            id={`pipe-${key}`}
                            type={placeholder === 'date' ? 'date' : 'text'}
                            value={draft[key as keyof ItemDraft]}
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
                              {stage.label} · {stage.probability}%
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block" htmlFor="pipe-priority">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Priority</span>
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
                      <label className="block" htmlFor="pipe-conversionLikelihood">
                        <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">Override Probability</span>
                        <input
                          id="pipe-conversionLikelihood"
                          value={draft.conversionLikelihood}
                          onChange={(event) => setDraft((current) => ({ ...current, conversionLikelihood: event.target.value }))}
                          className="h-11 w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 text-sm outline-none transition focus:border-stone-400 focus:bg-white"
                          placeholder="%"
                        />
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

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {[
                        ['pilotScope', 'Pilot Scope', 'Timeline, scope, sports, and institution commitment'],
                        ['nextStep', 'Next Step', 'The next action that moves this forward'],
                        ['grossMargin', 'Gross Margin', 'Software margin after partner and hardware costs'],
                        ['partnerCost', 'Partner Cost', 'AuntEDNA, implementation, or service share'],
                        ['hardwareCost', 'Hardware Cost', 'Polar or other device costs'],
                        ['expansionPath', 'Expansion Path', 'One sport to full program, conference, or renewal path'],
                        ['lossReason', 'Loss Reason', 'Only if paused or closed lost'],
                        ['notes', 'Notes', 'Context'],
                      ].map(([key, label, placeholder]) => (
                        <label key={key} className={key === 'notes' ? 'block md:col-span-2' : 'block'} htmlFor={`pipe-${key}`}>
                          <span className="mb-1.5 block text-xs font-semibold uppercase text-stone-400">{label}</span>
                          <textarea
                            id={`pipe-${key}`}
                            value={draft[key as keyof ItemDraft]}
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

                    <div className="mt-4 flex justify-end gap-2">
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
                  </form>
                )}

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
                        {countsByStage[stage.id] || 0} · {stage.probability}%
                      </span>
                    </button>
                  ))}
                </div>

                <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                  <div className="hidden grid-cols-[minmax(220px,1.3fr)_minmax(160px,0.8fr)_120px_110px_120px_minmax(220px,1fr)_104px] gap-4 border-b border-stone-100 bg-stone-50 px-4 py-3 text-xs font-semibold uppercase text-stone-400 lg:grid">
                    <span>Item</span>
                    <span>Organization</span>
                    <span>Stage</span>
                    <span>Value</span>
                    <span>Weighted</span>
                    <span>Next Step</span>
                    <span className="text-right">Actions</span>
                  </div>

                  {filteredItems.length > 0 ? (
                    <div className="divide-y divide-stone-100">
                      {filteredItems.map((item) => {
                        const stage = getStage(activeList, item.stage);
                        return (
                          <article
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Open details for ${item.title}`}
                            onClick={() => setSelectedDetailItemId(item.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedDetailItemId(item.id);
                              }
                            }}
                            className="grid cursor-pointer gap-3 px-4 py-4 transition hover:bg-stone-50/80 focus:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-stone-300 lg:grid-cols-[minmax(220px,1.3fr)_minmax(160px,0.8fr)_120px_110px_120px_minmax(220px,1fr)_104px] lg:items-center lg:gap-4"
                          >
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-stone-950">{item.title}</h3>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                                {item.owner && <span>{item.owner}</span>}
                                {item.segment && <span>{item.segment}</span>}
                                {item.expectedCloseDate && (
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {item.expectedCloseDate}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex min-w-0 items-center gap-2 text-sm text-stone-600">
                              <Building2 className="h-4 w-4 shrink-0 text-stone-400" />
                              <span className="truncate">{item.organization || 'Unassigned'}</span>
                            </div>

                            <div>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${stage.tone}`}>
                                {stage.label}
                              </span>
                            </div>

                            <p className="text-sm font-semibold text-stone-800">{formatMoney(itemValue(item))}</p>
                            <p className="text-sm text-stone-600">{formatMoney(weightedValue(activeList, item))}</p>

                            <p className="min-w-0 text-sm leading-5 text-stone-600 lg:truncate">
                              {item.nextStep || item.notes || item.expansionPath || 'No next step'}
                            </p>

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
                        <button
                          type="button"
                          onClick={openLeadUrlModal}
                          className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                        >
                          <Plus className="h-4 w-4" />
                          Add new lead
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 text-sm text-stone-500">
                  {dueSoonItems} due soon · {activeList.items.filter((item) => item.weeklyLogs.length > 0).length} with logs.
                </div>
              </>
            )}
          </section>
        </div>
      </main>

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
          onClick={() => setSelectedDetailItemId('')}
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
                      {selectedDetailItem.priority}
                    </span>
                  </div>
                  <h3 id="pipe-detail-title" className="break-words text-2xl font-bold tracking-normal text-stone-950">
                    {selectedDetailItem.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-stone-500">
                    {selectedDetailItem.organization || 'No organization'} · {activeList.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDetailItemId('')}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:text-stone-900"
                  title="Close details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {canModify && (
                  <button
                    type="button"
                    onClick={() => handleEditItem(selectedDetailItem)}
                    className="inline-flex h-9 items-center gap-2 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-700"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLogItemId(selectedDetailItem.id);
                    setSelectedDetailItemId('');
                    setViewMode('logs');
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 transition hover:text-stone-950"
                >
                  <ClipboardList className="h-4 w-4" />
                  Logs
                </button>
              </div>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {renderDetailField('Value', formatMoney(itemValue(selectedDetailItem)))}
                {renderDetailField('Weighted', formatMoney(weightedValue(activeList, selectedDetailItem)))}
                {renderDetailField('Probability', `${itemProbability(activeList, selectedDetailItem)}%`)}
                {renderDetailField(
                  'Next Date',
                  selectedDetailItem.expectedCloseDate || selectedDetailItem.dueDate || selectedDetailItem.pilotEnd || 'Not set',
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {renderDetailField('Next Step', selectedDetailItem.nextStep, true)}
                {renderDetailField('Notes', selectedDetailItem.notes, true)}
                {renderDetailField(
                  'Source URL',
                  selectedDetailItem.sourceUrl ? (
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
                  true,
                )}
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold text-stone-950">Pipeline Details</h4>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {renderDetailField('Owner', selectedDetailItem.owner || 'Unassigned')}
                  {renderDetailField('Organization', selectedDetailItem.organization || 'Unassigned')}
                  {renderDetailField('Segment', selectedDetailItem.segment)}
                  {renderDetailField('Decision Maker', selectedDetailItem.decisionMaker)}
                  {renderDetailField('ACV', selectedDetailItem.acv)}
                  {renderDetailField('Amount / Prize', selectedDetailItem.amount)}
                  {renderDetailField('Expected Close', selectedDetailItem.expectedCloseDate)}
                  {renderDetailField('Due Date', selectedDetailItem.dueDate)}
                  {renderDetailField('Contract Term', selectedDetailItem.contractTerm)}
                  {renderDetailField('Gross Margin', selectedDetailItem.grossMargin)}
                  {renderDetailField('Partner Cost', selectedDetailItem.partnerCost)}
                  {renderDetailField('Hardware Cost', selectedDetailItem.hardwareCost)}
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold text-stone-950">Pilot & Expansion</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  {renderDetailField('Pilot Scope', selectedDetailItem.pilotScope, true)}
                  {renderDetailField('Expansion Path', selectedDetailItem.expansionPath, true)}
                  {renderDetailField('Athlete Count', selectedDetailItem.athleteCount)}
                  {renderDetailField('Pilot Start', selectedDetailItem.pilotStart)}
                  {renderDetailField('Pilot End', selectedDetailItem.pilotEnd)}
                  {renderDetailField('Loss Reason', selectedDetailItem.lossReason)}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-stone-950">Recent Logs</h4>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">
                    {formatCount(selectedDetailItem.weeklyLogs.length, 'log')}
                  </span>
                </div>
                {selectedDetailItem.weeklyLogs.length > 0 ? (
                  <div className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200">
                    {selectedDetailItem.weeklyLogs.slice(0, 3).map((log) => (
                      <article key={log.id} className="bg-white px-4 py-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-stone-900">{log.summary || log.notes || logTypeLabels[log.type]}</p>
                            <p className="mt-1 text-xs text-stone-400">
                              {log.weekOf} · {logTypeLabels[log.type]}
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
          </section>
        </div>
      )}
    </>
  );
};

export default PipelinePage;
