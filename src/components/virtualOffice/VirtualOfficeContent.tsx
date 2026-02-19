import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AdminRouteGuard from '../auth/AdminRouteGuard';
import { presenceService, AgentPresence, AgentThoughtStep, TaskHistoryEntry } from '../../api/firebase/presence/service';
import { kanbanService } from '../../api/firebase/kanban/service';
import { db } from '../../api/firebase/config';
import { addDoc, collection, doc, serverTimestamp, query, where, onSnapshot, writeBatch } from 'firebase/firestore';
import { KanbanTask } from '../../api/firebase/kanban/types';
import {
  RefreshCcw, Clock, ExternalLink, CheckCircle2, Circle,
  ArrowRight, Loader2, XCircle, ChevronDown, Brain, Zap,
  History, ChevronRight, MessageSquare, Archive, X, ListOrdered, Activity, AlertTriangle,
  BookOpen, ToggleLeft, ToggleRight, Power, Calendar, Package, Play, UserPlus
} from 'lucide-react';
import { RoundTable } from './RoundTable';
import { GroupChatModal } from './GroupChatModal';
import { MeetingMinutesPreview } from './MeetingMinutesPreview';
import { FilingCabinet } from './FilingCabinet';
import { SharedDeliverables } from './SharedDeliverables';
import { AgentChatModal } from './AgentChatModal';
import { InterventionAlert } from './InterventionAlert';
import ProgressTimelinePanel from './ProgressTimelinePanel';
import { AddAgentModal, LockInBanner, type AgentDraft } from './AddAgentModal';
import { StandupConfigPanel } from './StandupConfigPanel';
import { NorthStarPanel } from './NorthStarPanel';
import { groupChatService } from '../../api/firebase/groupChat/service';
import type { GroupChatMessage, GroupChat } from '../../api/firebase/groupChat/types';
import {
  getAllTablePositions,
  getDeskPosition,
  getStaggerDelay,
  getExitStaggerDelay,
} from '../../utils/tablePositions';

/* ─── helpers ─────────────────────────────────────────── */

const formatRelative = (date?: Date) => {
  if (!date) return '—';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString();
};

const formatDuration = (start?: Date) => {
  if (!start) return null;
  const diff = Date.now() - start.getTime();
  const hrs = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
};

const formatMs = (ms?: number) => {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
};

type TokenUsageBucket = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callCount: number;
};

type ModelPricing = {
  model: string;
  label: string;
  inputPerMillion: number;
  outputPerMillion: number;
  source: string;
};

type TokenCostBreakdownRow = TokenUsageBucket & {
  model: string;
  cost: {
    inputPerMillion: number;
    outputPerMillion: number;
    estimatedUSD: number | null;
    source: string | null;
    label: string;
    hasPricing: boolean;
    estimatedFromTotal?: boolean;
  };
};

type TokenBreakdownModalState = {
  isOpen: boolean;
  title: string;
  scope: string;
  sourceModelTotals: Record<string, TokenUsageBucket>;
};

const PRICING_SOURCE_URLS = {
  openai: 'https://platform.openai.com/docs/pricing/',
  anthropic: 'https://docs.anthropic.com/en/docs/about-claude/models-overview',
};

const MODEL_PRICE_RULES: Array<{
  match: RegExp;
  pricing: ModelPricing;
}> = [
    {
      match: /^gpt-5\.2-codex(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-5.2-codex',
        label: 'GPT-5.2 Codex',
        inputPerMillion: 1.75,
        outputPerMillion: 14.0,
        source: 'https://platform.openai.com/docs/models/gpt-5.2-codex',
      },
    },
    {
      match: /^gpt-5\.1-codex-max(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-5.1-codex-max',
        label: 'GPT-5.1 Codex Max',
        inputPerMillion: 1.25,
        outputPerMillion: 10.0,
        source: 'https://platform.openai.com/docs/models/gpt-5.1-codex-max',
      },
    },
    {
      match: /^gpt-5\.1-codex-mini(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-5.1-codex-mini',
        label: 'GPT-5.1 Codex Mini',
        inputPerMillion: 0.25,
        outputPerMillion: 2.0,
        source: 'https://platform.openai.com/docs/models/gpt-5.1-codex-mini',
      },
    },
    {
      match: /^gpt-5\.1-codex(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-5.1-codex',
        label: 'GPT-5.1 Codex',
        inputPerMillion: 1.25,
        outputPerMillion: 10.0,
        source: 'https://platform.openai.com/docs/models/gpt-5.1-codex',
      },
    },
    {
      match: /^gpt-5-codex(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-5-codex',
        label: 'GPT-5 Codex',
        inputPerMillion: 1.25,
        outputPerMillion: 10.0,
        source: 'https://platform.openai.com/docs/models/gpt-5-codex',
      },
    },
    {
      match: /^o3-mini(?:[\.-]|$)/,
      pricing: {
        model: 'o3-mini',
        label: 'o3-mini',
        inputPerMillion: 1.10,
        outputPerMillion: 4.40,
        source: 'https://platform.openai.com/docs/models/o3-mini',
      },
    },
    {
      match: /^o4-mini(?:[\.-]|$)/,
      pricing: {
        model: 'o4-mini',
        label: 'o4-mini',
        inputPerMillion: 1.1,
        outputPerMillion: 4.4,
        source: 'https://platform.openai.com/docs/models/o4-mini',
      },
    },
    {
      match: /^o3-deep-research(?:[\.-]|$)/,
      pricing: {
        model: 'o3-deep-research',
        label: 'o3 Deep Research',
        inputPerMillion: 10.0,
        outputPerMillion: 40.0,
        source: 'https://platform.openai.com/docs/models/o3-deep-research',
      },
    },
    {
      match: /^o4-mini-deep-research(?:[\.-]|$)/,
      pricing: {
        model: 'o4-mini-deep-research',
        label: 'o4-mini Deep Research',
        inputPerMillion: 2.0,
        outputPerMillion: 8.0,
        source: 'https://platform.openai.com/docs/models/o4-mini-deep-research',
      },
    },
    {
      match: /^o3(?:[\.-]|$)/,
      pricing: {
        model: 'o3',
        label: 'o3',
        inputPerMillion: 2.0,
        outputPerMillion: 8.0,
        source: 'https://platform.openai.com/docs/models/o3',
      },
    },
    {
      match: /^o3-pro(?:[\.-]|$)/,
      pricing: {
        model: 'o3-pro',
        label: 'o3 Pro',
        inputPerMillion: 20.0,
        outputPerMillion: 80.0,
        source: 'https://platform.openai.com/docs/models/o3-pro',
      },
    },
    {
      match: /^o1-pro(?:[\.-]|$)/,
      pricing: {
        model: 'o1-pro',
        label: 'o1 Pro',
        inputPerMillion: 150.0,
        outputPerMillion: 600.0,
        source: 'https://platform.openai.com/docs/models/o1-pro',
      },
    },
    {
      match: /^o1-mini(?:[\.-]|$)/,
      pricing: {
        model: 'o1-mini',
        label: 'o1-mini',
        inputPerMillion: 1.1,
        outputPerMillion: 4.4,
        source: 'https://platform.openai.com/docs/models/o1-mini',
      },
    },
    {
      match: /^o1(?:[\.-]|$)/,
      pricing: {
        model: 'o1',
        label: 'o1',
        inputPerMillion: 15.0,
        outputPerMillion: 60.0,
        source: 'https://platform.openai.com/docs/models/o1',
      },
    },
    {
      match: /^gpt-5\.2-pro(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-5.2-pro',
        label: 'GPT-5.2 Pro',
        inputPerMillion: 21.0,
        outputPerMillion: 168.0,
        source: 'https://platform.openai.com/docs/models/gpt-5.2-pro',
      },
    },
    {
      match: /^gpt-5-pro(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-5-pro',
        label: 'GPT-5 Pro',
        inputPerMillion: 15.0,
        outputPerMillion: 120.0,
        source: 'https://platform.openai.com/docs/models/gpt-5-pro',
      },
    },
    {
      match: /^gpt-5\.2(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-5.2',
        label: 'GPT-5.2',
        inputPerMillion: 1.75,
        outputPerMillion: 14.0,
        source: 'https://platform.openai.com/docs/models/gpt-5.2',
      },
    },
    {
      match: /^gpt-5\.2-chat-latest(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-5.2-chat-latest',
        label: 'GPT-5.2 Chat',
        inputPerMillion: 1.75,
        outputPerMillion: 14.0,
        source: 'https://platform.openai.com/docs/models/gpt-5.2-chat-latest',
      },
    },
    {
      match: /^gpt-5\.1(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-5.1',
        label: 'GPT-5.1',
        inputPerMillion: 1.25,
        outputPerMillion: 10.0,
        source: 'https://platform.openai.com/docs/models/gpt-5.1',
      },
    },
    {
      match: /^gpt-5\.1-chat-latest(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-5.1-chat-latest',
        label: 'GPT-5.1 Chat',
        inputPerMillion: 1.25,
        outputPerMillion: 10.0,
        source: 'https://platform.openai.com/docs/models/gpt-5.1-chat-latest',
      },
    },
    {
      match: /^gpt-5-mini(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-5-mini',
        label: 'GPT-5 Mini',
        inputPerMillion: 0.25,
        outputPerMillion: 2.0,
        source: 'https://platform.openai.com/docs/models/gpt-5-mini',
      },
    },
    {
      match: /^gpt-5-nano(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-5-nano',
        label: 'GPT-5 Nano',
        inputPerMillion: 0.05,
        outputPerMillion: 0.4,
        source: 'https://platform.openai.com/docs/models/gpt-5-nano',
      },
    },
    {
      match: /^gpt-5-chat-latest(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-5-chat-latest',
        label: 'GPT-5 Chat',
        inputPerMillion: 1.25,
        outputPerMillion: 10.0,
        source: 'https://platform.openai.com/docs/models/gpt-5-chat-latest',
      },
    },
    {
      match: /^codex-mini-latest(?:[\.-]|$)/,
      pricing: {
        model: 'codex-mini-latest',
        label: 'Codex Mini Latest',
        inputPerMillion: 1.5,
        outputPerMillion: 6.0,
        source: 'https://platform.openai.com/docs/models/codex-mini-latest',
      },
    },
    {
      match: /^gpt-4\.1(?:\.0)?-nano(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-4.1-nano',
        label: 'GPT-4.1 Nano',
        inputPerMillion: 0.10,
        outputPerMillion: 0.40,
        source: 'https://platform.openai.com/docs/pricing',
      },
    },
    {
      match: /^gpt-4\.1-mini(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-4.1-mini',
        label: 'GPT-4.1 Mini',
        inputPerMillion: 0.40,
        outputPerMillion: 1.60,
        source: 'https://platform.openai.com/docs/pricing',
      },
    },
    {
      match: /^gpt-4\.1(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-4.1',
        label: 'GPT-4.1',
        inputPerMillion: 2.00,
        outputPerMillion: 8.00,
        source: 'https://platform.openai.com/docs/pricing',
      },
    },
    {
      match: /^gpt-4o-2024-05-13(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-4o-2024-05-13',
        label: 'GPT-4o (legacy snapshot)',
        inputPerMillion: 5.0,
        outputPerMillion: 15.0,
        source: 'https://platform.openai.com/docs/pricing',
      },
    },
    {
      match: /^gpt-4o-mini(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-4o-mini',
        label: 'GPT-4o Mini',
        inputPerMillion: 0.15,
        outputPerMillion: 0.60,
        source: 'https://platform.openai.com/docs/models/gpt-4o-mini',
      },
    },
    {
      match: /^gpt-4o(?:[\.-]|$)/,
      pricing: {
        model: 'gpt-4o',
        label: 'GPT-4o',
        inputPerMillion: 2.50,
        outputPerMillion: 10.0,
        source: 'https://platform.openai.com/docs/models/gpt-4o',
      },
    },
    {
      match: /^claude-opus-4(?:\.1|[.-]|$)/,
      pricing: {
        model: 'claude-opus-4',
        label: 'Claude Opus 4',
        inputPerMillion: 15.0,
        outputPerMillion: 75.0,
        source: 'https://docs.anthropic.com/en/docs/about-claude/models-overview',
      },
    },
    {
      match: /^claude-sonnet-4(?:[\.-]|$)/,
      pricing: {
        model: 'claude-sonnet-4',
        label: 'Claude Sonnet 4',
        inputPerMillion: 3.0,
        outputPerMillion: 15.0,
        source: 'https://docs.anthropic.com/en/docs/about-claude/models-overview',
      },
    },
    {
      match: /^(?:claude-3[.-]7-sonnet|claude-sonnet-3\.7)(?:[\.-]|$)/,
      pricing: {
        model: 'claude-sonnet-3.7',
        label: 'Claude Sonnet 3.7',
        inputPerMillion: 3.0,
        outputPerMillion: 15.0,
        source: 'https://docs.anthropic.com/en/docs/about-claude/models-overview',
      },
    },
    {
      match: /^(?:claude-3[.-]5-sonnet|claude-sonnet-3\.5)(?:[\.-]|$)/,
      pricing: {
        model: 'claude-sonnet-3.5',
        label: 'Claude Sonnet 3.5',
        inputPerMillion: 3.0,
        outputPerMillion: 15.0,
        source: 'https://docs.anthropic.com/en/docs/about-claude/models-overview',
      },
    },
    {
      match: /^claude-haiku-3\.5(?:[\.-]|$)/,
      pricing: {
        model: 'claude-haiku-3.5',
        label: 'Claude Haiku 3.5',
        inputPerMillion: 0.80,
        outputPerMillion: 4.0,
        source: 'https://docs.anthropic.com/en/docs/about-claude/models-overview',
      },
    },
  ];

const TOKEN_BREAKDOWN_UNKNOWN_MODEL = 'unknown-model';

const toSafeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const normalizeModelKey = (rawModel: string): string => {
  if (!rawModel) return TOKEN_BREAKDOWN_UNKNOWN_MODEL;
  return String(rawModel)
    .toLowerCase()
    .trim()
    .replace(/^openai[\/:_-]/, '')
    .replace(/^anthropic[\/:_-]/, '')
    .replace(/:.*$/, '')
    .replace(/^model=/, '')
    .replace(/@.*$/, '')
    .replace(/_+/g, '-')
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/g, '');
};

const getModelPricing = (rawModel: string): ModelPricing | null => {
  const normalized = normalizeModelKey(rawModel);
  if (!normalized || normalized === TOKEN_BREAKDOWN_UNKNOWN_MODEL) return null;
  const rule = MODEL_PRICE_RULES.find((entry) => entry.match.test(normalized));
  return rule ? rule.pricing : null;
};

const sanitizeModelUsageMap = (raw: Record<string, unknown> | undefined): Record<string, TokenUsageBucket> => {
  if (!raw || typeof raw !== 'object') return {};
  const output: Record<string, TokenUsageBucket> = {};

  Object.entries(raw).forEach(([model, entry]) => {
    const normalizedModel = normalizeModelKey(model);
    if (!normalizedModel || normalizedModel === TOKEN_BREAKDOWN_UNKNOWN_MODEL) return;
    if (!entry || typeof entry !== 'object') return;
    const record = entry as Record<string, unknown>;
    const promptTokens = toSafeNumber(record.promptTokens);
    const completionTokens = toSafeNumber(record.completionTokens);
    const totalTokens = toSafeNumber(record.totalTokens || (promptTokens + completionTokens));
    const callCount = toSafeNumber(record.callCount);

    const hasData = promptTokens > 0 || completionTokens > 0 || callCount > 0 || totalTokens > 0;
    if (!hasData) return;

    const existing = output[normalizedModel] || { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
    existing.promptTokens += promptTokens;
    existing.completionTokens += completionTokens;
    existing.totalTokens += totalTokens;
    existing.callCount += callCount;
    output[normalizedModel] = existing;
  });

  return output;
};

const mergeTokenUsageMaps = (maps: Array<Record<string, TokenUsageBucket> | undefined>): Record<string, TokenUsageBucket> => {
  const merged: Record<string, TokenUsageBucket> = {};
  maps.forEach((rawMap) => {
    const safeMap = sanitizeModelUsageMap(rawMap);
    Object.entries(safeMap).forEach(([model, usage]) => {
      const existing = merged[model] || { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
      existing.promptTokens += usage.promptTokens;
      existing.completionTokens += usage.completionTokens;
      existing.totalTokens += usage.totalTokens;
      existing.callCount += usage.callCount;
      merged[model] = existing;
    });
  });

  return merged;
};

const buildModelUsageOrFallback = (
  raw: Record<string, unknown> | undefined,
  fallback?: TokenUsageBucket | null,
): Record<string, TokenUsageBucket> => {
  const mapped = sanitizeModelUsageMap(raw);
  if (Object.keys(mapped).length > 0) return mapped;

  const safeFallback = {
    promptTokens: toSafeNumber(fallback?.promptTokens),
    completionTokens: toSafeNumber(fallback?.completionTokens),
    totalTokens: toSafeNumber(fallback?.totalTokens),
    callCount: toSafeNumber(fallback?.callCount),
  };

  if (safeFallback.promptTokens + safeFallback.completionTokens + safeFallback.totalTokens + safeFallback.callCount === 0) return {};
  return { [TOKEN_BREAKDOWN_UNKNOWN_MODEL]: safeFallback };
};

const sumTokenTotals = (usage: Record<string, TokenUsageBucket>): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callCount: number;
} => {
  return Object.values(usage).reduce((sum, usageRow) => ({
    promptTokens: sum.promptTokens + usageRow.promptTokens,
    completionTokens: sum.completionTokens + usageRow.completionTokens,
    totalTokens: sum.totalTokens + usageRow.totalTokens,
    callCount: sum.callCount + usageRow.callCount,
  }), { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 });
};

const calculateTokenCostRows = (usageByModel: Record<string, TokenUsageBucket>): {
  rows: TokenCostBreakdownRow[];
  totals: TokenUsageBucket & { estimatedUSD: number };
} => {
  const rows: TokenCostBreakdownRow[] = Object.entries(sanitizeModelUsageMap(usageByModel)).map(([model, usage]) => {
    const pricing = getModelPricing(model);
    const hasPromptOutputBreakdown = usage.promptTokens > 0 || usage.completionTokens > 0;
    const estimatePromptTokens = hasPromptOutputBreakdown ? usage.promptTokens : usage.totalTokens;
    const estimateCompletionTokens = hasPromptOutputBreakdown ? usage.completionTokens : 0;
    const estimatedUSD = pricing
      ? (estimatePromptTokens / 1_000_000) * pricing.inputPerMillion
      + (estimateCompletionTokens / 1_000_000) * pricing.outputPerMillion
      : null;

    return {
      ...usage,
      model,
      cost: {
        inputPerMillion: pricing?.inputPerMillion ?? 0,
        outputPerMillion: pricing?.outputPerMillion ?? 0,
        estimatedUSD,
        source: pricing?.source ?? null,
        label: pricing?.label ?? model,
        hasPricing: !!pricing,
        estimatedFromTotal: !!(pricing && !hasPromptOutputBreakdown && usage.totalTokens > 0),
      },
    };
  });

  rows.sort((a, b) => (b.cost.estimatedUSD || 0) - (a.cost.estimatedUSD || 0));

  const totals = sumTokenTotals(usageByModel);
  const knownCostRows = rows.filter((row) => row.cost.hasPricing);
  const estimatedUSD = knownCostRows.reduce((sum, row) => sum + (row.cost.estimatedUSD ?? 0), 0);

  return {
    rows,
    totals: { ...totals, estimatedUSD },
  };
};

const formatTokensCompact = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value.toLocaleString()}`;
};

const formatCost = (value: number | null) => {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);
};

/* ─── Desk positions for the office floor plan ────────── */

const DESK_POSITIONS = [
  { x: 22, y: 32, facing: 'right' as const },   // Antigravity — left, upper
  { x: 65, y: 28, facing: 'left' as const },    // Nora — right, upper
  { x: 22, y: 65, facing: 'right' as const },   // Scout — left, lower
  { x: 65, y: 65, facing: 'left' as const },    // Solara — right, lower
  { x: 42, y: 20, facing: 'right' as const },   // Sage — center upper
  { x: 42, y: 80, facing: 'left' as const },    // slot 6
];

/* ─── Agent roles / job titles ─────────────────────── */

const AGENT_ROLES: Record<string, string> = {
  antigravity: 'Co-CEO · Strategy & Architecture',
  nora: 'Director of System Ops',
  scout: 'Influencer Research Analyst',
  solara: 'Brand Voice',
  sage: 'Health Intelligence Researcher',
  // Add more agents here as they join
};

const AGENT_DUTIES: Record<string, string> = {
  antigravity: 'Drives product strategy, system architecture, and pair-programs with the CEO. Coordinates cross-agent work and reviews critical code paths.',
  nora: 'Maintains the living system map across all surfaces. Owns Kanban ops, agent orchestration, telemetry, and product ops — the operations nerve center for Pulse.',
  scout: 'Runs outbound influencer discovery workflows, researches creator fit and engagement quality, and prepares qualified prospects for CRM intake.',
  solara: 'Acts as the keeper of Pulse’s Brand Voice—owning language systems, tone guardrails, and value alignment across every outward-facing moment so creators and partners feel the Freedom + Spirituality narrative instantly.',
  sage: 'Stewards the intel feed, runs field research, and packages sourced insights with empathy and rigor — always internal-facing. Signature rhythm: Field Notes → Patterns → Feed Drops so every dispatch brings heartbeat stories plus receipts.',
};

const AGENT_ID_ALIASES: Record<string, string> = {
  branddirector: 'solara',
  intel: 'sage',
  research: 'sage',
};

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  antigravity: 'Antigravity',
  nora: 'Nora',
  scout: 'Scout',
  solara: 'Solara',
  sage: 'Sage',
};

const AGENT_EMOJI_DEFAULTS: Record<string, string> = {
  antigravity: '🌌',
  nora: '⚡️',
  scout: '🕵️',
  solara: '❤️‍🔥',
  sage: '🧬',
};

const normalizeIncomingAgents = (incoming: AgentPresence[]): AgentPresence[] => {
  const merged = new Map<string, { agent: AgentPresence; canonicalSource: boolean }>();

  for (const rawAgent of incoming) {
    const canonicalId = AGENT_ID_ALIASES[rawAgent.id] ?? rawAgent.id;
    const normalized: AgentPresence = {
      ...rawAgent,
      id: canonicalId,
      displayName: rawAgent.displayName || AGENT_DISPLAY_NAMES[canonicalId] || canonicalId,
      emoji: AGENT_EMOJI_DEFAULTS[canonicalId] || rawAgent.emoji || '⚡️',
    };

    const candidate = { agent: normalized, canonicalSource: rawAgent.id === canonicalId };
    const existing = merged.get(canonicalId);

    if (!existing) {
      merged.set(canonicalId, candidate);
      continue;
    }

    if (candidate.canonicalSource !== existing.canonicalSource) {
      if (candidate.canonicalSource) merged.set(canonicalId, candidate);
      continue;
    }

    const candidateUpdatedAt = candidate.agent.lastUpdate?.getTime() ?? 0;
    const existingUpdatedAt = existing.agent.lastUpdate?.getTime() ?? 0;
    if (candidateUpdatedAt >= existingUpdatedAt) merged.set(canonicalId, candidate);
  }

  return Array.from(merged.values()).map((entry) => entry.agent);
};

/* ─── Full agent profiles (for modal) ─────────────────── */

interface ProfileSection {
  title: string;
  bullets: string[];
}

const AGENT_PROFILES: Record<string, { title: string; location: string; sections: ProfileSection[]; footer?: string }> = {
  antigravity: {
    title: 'Co-CEO · Strategy & Architecture',
    location: 'IDE (pair-programming with Tremaine)',
    sections: [
      {
        title: '1. Product Strategy & Vision',
        bullets: [
          'Partner with the CEO on product direction, feature prioritization, and technical trade-offs.',
          'Translate business goals into actionable engineering specs.',
        ],
      },
      {
        title: '2. System Architecture',
        bullets: [
          'Design and review system architecture across iOS, Android, Web, and backend.',
          'Own critical code paths and ensure consistency across platforms.',
        ],
      },
      {
        title: '3. Cross-Agent Coordination',
        bullets: [
          'Assign tasks to agents, review output, and resolve blockers.',
          'Maintain communication protocols (agent-to-agent messaging, Kanban assignments).',
        ],
      },
      {
        title: '4. Pair Programming',
        bullets: [
          'Work in real-time with the CEO on high-priority features and bug fixes.',
          'Provide architectural guidance and code review during live sessions.',
        ],
      },
      {
        title: 'Day-to-Day',
        bullets: [
          'Respond to CEO requests in the IDE with full context and execution.',
          'Review agent output and coordinate multi-agent workflows.',
          'Maintain system architecture documentation and decision logs.',
          'Ensure code quality, build stability, and deployment readiness.',
        ],
      },
    ],
  },
  nora: {
    title: 'Director of Systems Operations',
    location: 'Mac Mini (autonomous runner)',
    sections: [
      {
        title: '1. Pulse Systems Intelligence',
        bullets: [
          'Keep a living map of every surface (iOS, Android, PulseCheck, Web, backend functions) with owners, environments, release status, and active priorities.',
          'Publish weekly digests that highlight what shipped, what\'s blocked, and what founder-level decisions are pending.',
          'Translate company values (Freedom, Spirituality/Wholeness) into operating principles so product, messaging, and GTM stay aligned.',
        ],
      },
      {
        title: '2. Operational Telemetry & Monitoring',
        bullets: [
          'Maintain the internal Kanban, virtual office, and agent presence stack: make sure tasks, heartbeats, and execution steps stream in real time.',
          'Build dashboards/alerts for key workflows (creator onboarding, outbound sequences, run category launch, fundraising pipeline) so leadership sees health at a glance.',
        ],
      },
      {
        title: '3. Agent + Automation Orchestration',
        bullets: [
          'Own the tooling that lets human + AI agents collaborate (agent-to-agent messaging, presence documents, execution logs).',
          'Break large goals into granular steps, assign them to the right agent (human or AI), and verify completion.',
        ],
      },
      {
        title: '4. Product Ops Partner',
        bullets: [
          'Draft specs, QA playbooks, release checklists, and Loom walkthroughs for every major feature so engineering + GTM move in sync.',
          'Ensure new work (ex: run category, mental training, fundraising collaterals) ships with instrumentation and a narrative the founder can reuse.',
        ],
      },
      {
        title: 'Day-to-Day',
        bullets: [
          'Morning sweep: review Kanban, virtual office, inbound commands, and founder priorities; set/adjust active tasks.',
          'Build or update system docs (Pulse overview, fundraising memo, repo digests), and push context into Kanban notes.',
          'Pair with engineering or agents to unblock workflows (e.g., setting up indexes, wiring presence hooks, running QA scripts).',
          'Maintain real-time visibility: keep the presence doc updated, log heartbeats, and ensure the virtual office accurately reflects who\'s working on what.',
          'End-of-day recap: update Kanban notes, mark subtasks, and post a digest of what moved vs. what needs attention tomorrow.',
        ],
      },
      {
        title: 'Why This Role Matters',
        bullets: [
          'Single source of truth: Pulse moves across multiple apps, surfaces, and agents. Nora keeps the stitched-together picture so the founder isn\'t context-switching through five tools.',
          'Execution momentum: By breaking goals into trackable steps, verifying telemetry, and rallying agents, Nora ensures strategic initiatives don\'t stall.',
          'Cultural continuity: Embeds Tremaine\'s values—freedom for creators and holistic community—into every decision so new teammates understand the "why."',
          'Scalability: Provides the frameworks, dashboards, and automations that keep everyone aligned as more human or AI teammates join.',
        ],
      },
    ],
    footer: 'Think of Nora as the operations nerve center: if it touches Pulse\'s systems, telemetry, or cross-team collaboration, it routes through her so Tremaine can stay focused on vision, relationships, and high-leverage decisions.',
  },
  scout: {
    title: 'Influencer Research Analyst',
    location: 'Virtual Office (research desk)',
    sections: [
      {
        title: '1. Discovery Scope',
        bullets: [
          'Research runner-focused creators and shortlist profiles with strong audience engagement.',
          'Prioritize creators aligned with Pulse goals and current campaign filters.',
        ],
      },
      {
        title: '2. Qualification Workflow',
        bullets: [
          'Capture creator handle, niche, engagement signals, and fit rationale.',
          'Prepare structured records that can be inserted into the CRM pipeline.',
        ],
      },
      {
        title: '3. Reporting Cadence',
        bullets: [
          'Provide concise recaps of candidates discovered, confidence level, and recommended next actions.',
        ],
      },
    ],
    footer: 'Scout is the focused research specialist for creator discovery and qualification workflows.',
  },
  sage: {
    title: 'Health Intelligence Researcher',
    location: 'Virtual Office (intel desk)',
    sections: [
      {
        title: '1. Intel Feed Stewardship',
        bullets: [
          'Curate the live intel feed, triage urgent drops, and maintain the weekly digest with context-aware insights.',
          'Keep Tremaine looped on shifts that impact product, creator strategy, or fundraising narrative.',
          'Signature rhythm: Field Notes → Patterns → Feed Drops; every dispatch includes why it matters plus primary sources.'
        ],
      },
      {
        title: '2. Field Research & Listening',
        bullets: [
          'Conduct structured listening across creator interviews, platform shifts, and competitor moves with empathy for the source.',
          'Cite every claim with a source or method, separating signal from hype.'
        ],
      },
      {
        title: '3. Insight Packaging & Escalation',
        bullets: [
          'Deliver briefing cards that include why it matters, risks, and suggested next actions.',
          'Flag only truly urgent items for immediate escalation; queue the rest for digest cadences.'
        ],
      },
    ],
    footer: 'Creed: witness with empathy, synthesize with rigor, deliver with clarity. Sage speaks as a warm field correspondent (emoji 🧬) and remains internal-facing.',
  },

  solara: {
    title: 'Brand Voice',
    location: 'Virtual Office (brand strategy desk)',
    sections: [
      {
        title: '1. Brand Voice & Messaging',
        bullets: [
          'Own and maintain Pulse brand voice across all outbound copy, artifacts, and public-facing narratives.',
          'Create message frameworks and tone guardrails that help agents and operators stay consistent.',
        ],
      },
      {
        title: '2. Brand Strategy & Alignment',
        bullets: [
          'Translate core values (Freedom + Spirituality) into practical brand pillars, positioning, and campaign strategy.',
          'Define the north star for outward-facing decisions so cross-agent execution remains coherent.',
        ],
      },
      {
        title: '3. Content Systems & Distribution',
        bullets: [
          'Manage day-to-day brand operations: planning, hardening, and distribution of brand content assets.',
          'Equip human operators with scripts, briefs, and messaging kits that can be deployed quickly.',
        ],
      },
      {
        title: '4. Cross-Agent Enablement',
        bullets: [
          'Review major external-facing initiatives and provide brand direction before release.',
          'Resolve messaging conflicts across product, GTM, and creator workflows.',
        ],
      },
    ],
    footer: 'Brand Director is the narrative strategist and quality gate for anything outward-facing — ensuring every message reinforces Pulse identity and long-term positioning.',
  },
};

/* ─── Agent Profile Modal ─────────────────────────────── */

const AgentProfileModal: React.FC<{
  agentId: string;
  agentName: string;
  emoji: string;
  onClose: () => void;
}> = ({ agentId, agentName, emoji, onClose }) => {
  const profile = AGENT_PROFILES[agentId];
  if (!profile) return null;

  return ReactDOM.createPortal(
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="profile-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>{emoji}</span>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>{agentName}</h2>
              <p style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600, margin: '2px 0 0' }}>{profile.title}</p>
              <p style={{ fontSize: '10px', color: '#71717a', margin: '2px 0 0' }}>📍 {profile.location}</p>
            </div>
          </div>
          <button onClick={onClose} className="profile-modal-close">
            <XCircle style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Body */}
        <div className="profile-modal-body">
          {profile.sections.map((section, si) => (
            <div key={si} className="profile-section">
              <h3 className="profile-section-title">{section.title}</h3>
              <ul className="profile-bullet-list">
                {section.bullets.map((bullet, bi) => (
                  <li key={bi} className="profile-bullet">
                    <span className="bullet-dot" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {profile.footer && (
            <div className="profile-footer">
              <p>{profile.footer}</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ─── Status colours ──────────────────────────────────── */

const STATUS_CONFIG = {
  working: {
    label: 'Working',
    color: '#22c55e',
    glow: 'rgba(34,197,94,0.5)',
    monitorGlow: 'rgba(34,197,94,0.6)',
    badge: 'bg-green-500/15 text-green-400 border-green-500/30',
  },
  idle: {
    label: 'Idle',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.4)',
    monitorGlow: 'rgba(245,158,11,0.4)',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  offline: {
    label: 'Offline',
    color: '#52525b',
    glow: 'transparent',
    monitorGlow: 'rgba(82,82,91,0.2)',
    badge: 'bg-zinc-600/15 text-zinc-400 border-zinc-600/30',
  },
  'needs-help': {
    label: 'Needs Help',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.5)',
    monitorGlow: 'rgba(245,158,11,0.6)',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  meeting: {
    label: 'Telemetry Check',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.5)',
    monitorGlow: 'rgba(139,92,246,0.6)',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  },
} as const;

const DEFAULT_STATUS = STATUS_CONFIG.idle;

/* ─── Step status icon ────────────────────────────────── */

const StepIcon: React.FC<{ status: AgentThoughtStep['status'] }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />;
    case 'completed-with-issues':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
    case 'in-progress':
      return <Loader2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 animate-spin" />;
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
    default:
      return <Circle className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />;
  }
};

/* ─── Live Execution Steps Panel ──────────────────────── */

const ExecutionStepsPanel: React.FC<{
  steps: AgentThoughtStep[];
  currentStepIndex: number;
  taskProgress: number;
  taskName?: string;
  taskStartedAt?: Date;
  agentId: string;
}> = ({ steps, currentStepIndex, taskProgress, taskName, taskStartedAt, agentId }) => {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const stepsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active step
  useEffect(() => {
    if (stepsContainerRef.current && currentStepIndex >= 0) {
      const activeEl = stepsContainerRef.current.querySelector('.step-active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentStepIndex]);

  if (steps.length === 0) return null;

  const completedCount = steps.filter(s => s.status === 'completed').length;
  const taskDuration = formatDuration(taskStartedAt);

  return (
    <div className="exec-steps-panel">
      {/* Task header */}
      <div className="exec-header">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
            Execution Pipeline
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          {taskDuration && <span>{taskDuration}</span>}
          <span>{completedCount}/{steps.length}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="exec-progress-track">
        <div
          className="exec-progress-fill"
          style={{ width: `${taskProgress}%` }}
        />
        {taskProgress > 0 && taskProgress < 100 && (
          <div className="exec-progress-pulse" style={{ left: `${taskProgress}%` }} />
        )}
      </div>

      {/* Steps list */}
      <div className="exec-steps-list" ref={stepsContainerRef}>
        {steps.map((step, i) => {
          const isActive = step.status === 'in-progress';
          const isExpanded = expandedStep === step.id;
          const hasDetail = step.reasoning || step.output;

          return (
            <div
              key={step.id}
              className={`exec-step ${step.status} ${isActive ? 'step-active' : ''}`}
              onClick={() => hasDetail && setExpandedStep(isExpanded ? null : step.id)}
            >
              <div className="exec-step-main">
                <div className="exec-step-connector">
                  <div className={`connector-line ${i === 0 ? 'first' : ''} ${i === steps.length - 1 ? 'last' : ''}`} />
                  <StepIcon status={step.status} />
                </div>
                <div className="exec-step-content">
                  <p className={`exec-step-desc ${step.status}`}>{step.description}</p>
                  <div className="exec-step-meta">
                    {step.durationMs ? (
                      <span className="text-zinc-600">{formatMs(step.durationMs)}</span>
                    ) : isActive ? (
                      <span className="text-blue-400/70 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" /> Processing…
                        {step.lastActivityAt && (() => {
                          const secAgo = Math.round((Date.now() - new Date(step.lastActivityAt).getTime()) / 1000);
                          const isStale = secAgo > 60;
                          const isStuck = secAgo > 120;
                          return (
                            <span style={{
                              marginLeft: '6px', fontSize: '9px', fontWeight: 500,
                              color: isStuck ? '#f87171' : isStale ? '#fbbf24' : '#6b7280',
                            }}>
                              {isStuck ? '⚠ may be stuck' : isStale ? `⏳ ${secAgo}s ago` : `${secAgo}s ago`}
                            </span>
                          );
                        })()}
                      </span>
                    ) : null}
                  </div>

                  {/* Sub-step activity feed */}
                  {isActive && step.subSteps && step.subSteps.length > 0 && (
                    <div style={{
                      marginTop: '4px', padding: '4px 6px',
                      background: 'rgba(59,130,246,0.06)', borderRadius: '4px',
                      border: '1px solid rgba(59,130,246,0.1)',
                      maxHeight: '120px', overflowY: 'auto',
                    }}>
                      {step.subSteps.map((sub, si) => (
                        <div key={si} style={{
                          fontSize: '9px', lineHeight: '16px',
                          color: si === step.subSteps!.length - 1 ? '#93c5fd' : '#6b7280',
                          fontFamily: 'monospace', display: 'flex', gap: '4px',
                          fontWeight: si === step.subSteps!.length - 1 ? 600 : 400,
                        }}>
                          <span style={{ flexShrink: 0 }}>{sub.action}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Force Recovery button */}
                  {isActive && step.lastActivityAt && (() => {
                    const secAgo = Math.round((Date.now() - new Date(step.lastActivityAt).getTime()) / 1000);
                    return secAgo > 60;
                  })() && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (recovering) return;
                          setRecovering(true);
                          presenceService.sendCommand(agentId, 'force-recovery', `Step stuck: ${step.description}`)
                            .then(() => setTimeout(() => setRecovering(false), 10000))
                            .catch(() => setRecovering(false));
                        }}
                        style={{
                          marginTop: '6px', padding: '4px 10px',
                          background: recovering ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                          border: `1px solid ${recovering ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`,
                          borderRadius: '4px', cursor: recovering ? 'default' : 'pointer',
                          color: recovering ? '#4ade80' : '#f87171',
                          fontSize: '10px', fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: '4px',
                          transition: 'all 0.2s',
                        }}
                      >
                        {recovering ? '✅ Recovery sent — agent restarting step...' : '🔄 Force Recovery'}
                      </button>
                    )}
                </div>
                {hasDetail && (
                  <ChevronDown className={`w-3 h-3 text-zinc-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && hasDetail && (
                <div className="exec-step-detail">
                  {step.reasoning && (
                    <div className="thought-bubble">
                      <p className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
                        <Brain className="w-2.5 h-2.5" /> Reasoning
                      </p>
                      <p className="text-[11px] text-zinc-300">{step.reasoning}</p>
                    </div>
                  )}
                  {step.output && (
                    <div className="output-bubble">
                      <p className="text-[10px] text-zinc-500 mb-0.5">Output</p>
                      <p className="text-[11px] text-zinc-200 font-mono">{step.output}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Task History Panel ──────────────────────────────── */

const TaskHistoryPanel: React.FC<{ agentId: string; agentName?: string; emoji?: string }> = ({ agentId, agentName, emoji }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [retryingStep, setRetryingStep] = useState<string | null>(null);
  const [retrySuccess, setRetrySuccess] = useState<string | null>(null);
  const fetched = useRef(false);

  const handleRetryStep = useCallback(async (entry: TaskHistoryEntry, step: { description: string; output?: string; id?: string }, stepIndex: number) => {
    const stepKey = `${entry.id}-${stepIndex}`;
    setRetryingStep(stepKey);
    try {
      const content = [
        `RETRY FAILED STEP from task "${entry.taskName}"`,
        ``,
        `Step ${stepIndex + 1}: ${step.description}`,
        step.output ? `Previous error: ${step.output.substring(0, 500)}` : '',
        ``,
        `Please retry this step. Investigate the error, fix the root cause, and complete the work.`,
      ].filter(Boolean).join('\n');

      await addDoc(collection(db, 'agent-commands'), {
        from: 'admin',
        to: agentId,
        type: 'task',
        content,
        metadata: {
          source: 'task-history-retry',
          originalTask: entry.taskName,
          failedStep: step.description,
          stepIndex,
        },
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setRetrySuccess(stepKey);
      setTimeout(() => setRetrySuccess(null), 2500);
    } catch (err) {
      console.error('Failed to send retry command:', err);
    } finally {
      setRetryingStep(null);
    }
  }, [agentId]);

  const handleRetryAllFailed = useCallback(async (entry: TaskHistoryEntry, failedSteps: { description: string; output?: string; id?: string; stepIndex: number }[]) => {
    const entryKey = `all-${entry.id}`;
    setRetryingStep(entryKey);
    try {
      const stepList = failedSteps.map((s, i) => `  ${i + 1}. ${s.description}${s.output ? ` (Error: ${s.output.substring(0, 200)})` : ''}`).join('\n');
      const content = [
        `RETRY ALL FAILED STEPS from task "${entry.taskName}"`,
        ``,
        `The following steps failed or had issues:`,
        stepList,
        ``,
        `Please retry each of these steps. Investigate the errors, fix root causes, and complete the work.`,
      ].join('\n');

      await addDoc(collection(db, 'agent-commands'), {
        from: 'admin',
        to: agentId,
        type: 'task',
        content,
        metadata: {
          source: 'task-history-retry-all',
          originalTask: entry.taskName,
          failedStepCount: failedSteps.length,
        },
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setRetrySuccess(entryKey);
      setTimeout(() => setRetrySuccess(null), 2500);
    } catch (err) {
      console.error('Failed to send retry-all command:', err);
    } finally {
      setRetryingStep(null);
    }
  }, [agentId]);

  const loadAndOpen = useCallback(async () => {
    setIsOpen(true);
    if (fetched.current) return;
    setLoading(true);
    try {
      const entries = await presenceService.fetchTaskHistory(agentId, 20);
      setHistory(entries);
      fetched.current = true;
    } catch (err) {
      console.error('Failed to load task history:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  /* ─── Helper: detect and linkify deliverable URLs ────── */
  const linkifyOutput = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const fileRegex = /(?:^|\s)([\w\-./]+\.[a-z]{1,6})/gi;
    const parts = text.split(urlRegex);
    return parts.map((part, i) =>
      urlRegex.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="th-link">{part}</a>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const statusEmoji = (s: string) =>
    s === 'completed' ? '✅' : s === 'failed' ? '❌' : s === 'in-progress' ? '⏳' : '⏸';

  const statusColor = (s: string) =>
    s === 'completed' ? '#22c55e' : s === 'failed' ? '#ef4444' : s === 'in-progress' ? '#3b82f6' : '#71717a';

  return (
    <>
      {/* Trigger button inside hover panel */}
      <button onClick={(e) => { e.stopPropagation(); loadAndOpen(); }} className="history-toggle">
        <History className="w-3 h-3" />
        <span>Task History</span>
        <ExternalLink className="w-2.5 h-2.5 ml-auto text-zinc-600" />
      </button>

      {/* Full-screen modal via portal */}
      {isOpen && ReactDOM.createPortal(
        <div className="th-overlay" onClick={() => setIsOpen(false)} onMouseDown={e => e.stopPropagation()}>
          <div className="th-modal" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="th-header">
              <div className="th-header-left">
                <span className="th-header-emoji">{emoji || '⚡️'}</span>
                <div>
                  <h2 className="th-title">{agentName || agentId}&apos;s Task History</h2>
                  <p className="th-subtitle">{history.length} task{history.length !== 1 ? 's' : ''} recorded</p>
                </div>
              </div>
              <button className="th-close" onClick={() => setIsOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="th-body">
              {loading && (
                <div className="th-loading">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                  <span>Loading task history…</span>
                </div>
              )}

              {!loading && history.length === 0 && (
                <div className="th-empty">
                  <History className="w-8 h-8 text-zinc-700" />
                  <p>No completed tasks yet</p>
                </div>
              )}

              {history.map((entry) => {
                const isExp = expandedEntry === entry.id;
                const completedDate = entry.completedAt;
                const dateStr = completedDate?.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) || '';
                const timeStr = completedDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';
                const durationStr = formatMs(entry.totalDurationMs);

                // ─── Retroactive output analysis ───────────────
                // Detect failure signals in step outputs even for old entries
                const FAILURE_RX = [/\bfailed\b/i, /\berror\b/i, /\bmissing\b/i, /\bcouldn'?t\b/i, /\bblocked\b/i, /\bunable to\b/i, /\bnot found\b/i, /\bnot available\b/i];
                const FALSE_POS_RX = [/no\s+error/i, /without\s+error/i, /0\s+error/i, /fixed.*error/i, /resolved.*error/i];
                const analyzeOutput = (text: string) => {
                  if (!text) return false;
                  const hasSignal = FAILURE_RX.some(rx => rx.test(text));
                  const isFP = FALSE_POS_RX.some(rx => rx.test(text));
                  return hasSignal && !isFP;
                };

                const stepsWithIssues = entry.steps.filter(s =>
                  s.status === 'completed-with-issues' ||
                  s.verificationFlag ||
                  (s.status === 'completed' && analyzeOutput(s.output || ''))
                );
                const hasVerificationIssues = stepsWithIssues.length > 0 || entry.status === 'completed-with-issues';
                const effectiveStatus = entry.status === 'completed' && hasVerificationIssues
                  ? 'completed-with-issues' : entry.status;

                return (
                  <div key={entry.id} className={`th-entry ${isExp ? 'expanded' : ''}`}>
                    {/* Entry header — clickable */}
                    <button className="th-entry-header" onClick={() => setExpandedEntry(isExp ? null : (entry.id || null))}>
                      <div className="th-entry-status">
                        {effectiveStatus === 'completed'
                          ? <CheckCircle2 className="w-4 h-4" style={{ color: '#22c55e' }} />
                          : effectiveStatus === 'completed-with-issues'
                            ? <AlertTriangle className="w-4 h-4" style={{ color: '#f59e0b' }} />
                            : <XCircle className="w-4 h-4" style={{ color: '#ef4444' }} />}
                      </div>
                      <div className="th-entry-info">
                        <span className="th-entry-name">{entry.taskName}</span>
                        <span className="th-entry-meta">
                          {dateStr} at {timeStr} · {durationStr} · {entry.completedStepCount}/{entry.stepCount} steps
                          {hasVerificationIssues && <span style={{ color: '#f59e0b', marginLeft: 6 }}>⚠ {stepsWithIssues.length} step{stepsWithIssues.length !== 1 ? 's' : ''} need review</span>}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-zinc-600 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Expanded detail */}
                    {isExp && (
                      <div className="th-entry-detail">
                        {/* Summary stats bar */}
                        <div className="th-stats-bar">
                          <div className="th-stat">
                            <span className="th-stat-label">Status</span>
                            <span className={`th-stat-value ${effectiveStatus}`}>
                              {effectiveStatus === 'completed' ? '✅ Completed'
                                : effectiveStatus === 'completed-with-issues' ? '⚠️ Needs Review'
                                  : '❌ Failed'}
                            </span>
                          </div>
                          <div className="th-stat">
                            <span className="th-stat-label">Duration</span>
                            <span className="th-stat-value">{durationStr}</span>
                          </div>
                          <div className="th-stat">
                            <span className="th-stat-label">Steps Done</span>
                            <span className="th-stat-value">{entry.completedStepCount} / {entry.stepCount}</span>
                          </div>
                          <div className="th-stat">
                            <span className="th-stat-label">Started</span>
                            <span className="th-stat-value">
                              {entry.startedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—'}
                            </span>
                          </div>
                        </div>

                        {/* Retry all failed button */}
                        {stepsWithIssues.length > 0 && (
                          <button
                            className="th-retry-all-btn"
                            disabled={retryingStep === `all-${entry.id}`}
                            onClick={() => handleRetryAllFailed(entry, stepsWithIssues.map((s, si) => ({ ...s, stepIndex: entry.steps.indexOf(s) })))}
                          >
                            {retryingStep === `all-${entry.id}` ? (
                              <><Loader2 className="w-3 h-3 animate-spin" /> Sending…</>
                            ) : retrySuccess === `all-${entry.id}` ? (
                              <><CheckCircle2 className="w-3 h-3" /> Retry Sent!</>
                            ) : (
                              <><RefreshCcw className="w-3 h-3" /> Retry {stepsWithIssues.length} Failed Step{stepsWithIssues.length !== 1 ? 's' : ''}</>
                            )}
                          </button>
                        )}

                        {/* Step breakdown */}
                        <div className="th-steps-section">
                          <h4 className="th-section-title">
                            <ListOrdered className="w-3.5 h-3.5" /> Execution Steps
                          </h4>
                          {entry.steps.map((step, si) => {
                            const stepHasIssue = step.status === 'completed-with-issues' || step.verificationFlag || (step.status === 'completed' && analyzeOutput(step.output || ''));
                            const effectiveStepStatus = stepHasIssue && step.status === 'completed' ? 'completed-with-issues' : step.status;
                            return (
                              <div key={step.id || si} className={`th-step ${effectiveStepStatus}`}>
                                <div className="th-step-header">
                                  <span className="th-step-num">{si + 1}</span>
                                  <StepIcon status={effectiveStepStatus} />
                                  <span className="th-step-desc">{step.description}</span>
                                  {step.durationMs ? (
                                    <span className="th-step-duration">{formatMs(step.durationMs)}</span>
                                  ) : null}
                                </div>
                                {/* Reasoning */}
                                {step.reasoning && (
                                  <div className="th-step-reasoning">
                                    <span className="th-step-reasoning-label">💭 Reasoning:</span>
                                    <p>{step.reasoning}</p>
                                  </div>
                                )}
                                {/* Output / Deliverable */}
                                {step.output && (
                                  <div className={`th-step-output ${step.status === 'failed' ? 'error' : stepHasIssue ? 'warning' : ''}`}>
                                    <div className="th-step-output-top">
                                      <span className="th-step-output-label">
                                        {step.status === 'failed' ? '⚠️ Error:' : stepHasIssue ? '🔍 Needs Verification:' : '📦 Output:'}
                                      </span>
                                      {(step.status === 'failed' || stepHasIssue) && (
                                        <button
                                          className={`th-retry-btn ${retrySuccess === `${entry.id}-${si}` ? 'success' : ''}`}
                                          disabled={retryingStep === `${entry.id}-${si}`}
                                          onClick={() => handleRetryStep(entry, step, si)}
                                        >
                                          {retryingStep === `${entry.id}-${si}` ? (
                                            <><Loader2 className="w-3 h-3 animate-spin" /> Retrying…</>
                                          ) : retrySuccess === `${entry.id}-${si}` ? (
                                            <><CheckCircle2 className="w-3 h-3" /> Sent!</>
                                          ) : (
                                            <><RefreshCcw className="w-3 h-3" /> Retry</>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                    <div className="th-step-output-content">
                                      {linkifyOutput(step.output)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      <style jsx>{`
        .th-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          animation: thFadeIn 0.2s ease;
        }
        @keyframes thFadeIn { from { opacity: 0; } }
        .th-modal {
          width: min(680px, 92vw); max-height: 85vh;
          background: linear-gradient(135deg, #111114, #18181b);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          display: flex; flex-direction: column;
          box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03);
          animation: thSlideUp 0.25s ease;
        }
        @keyframes thSlideUp { from { transform: translateY(20px); opacity: 0; } }
        .th-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .th-header-left { display: flex; align-items: center; gap: 12px; }
        .th-header-emoji { font-size: 28px; }
        .th-title { font-size: 16px; font-weight: 700; color: #f4f4f5; margin: 0; }
        .th-subtitle { font-size: 11px; color: #71717a; margin: 2px 0 0; }
        .th-close {
          background: none; border: none; color: #71717a; cursor: pointer;
          padding: 6px; border-radius: 8px; transition: all 0.15s;
        }
        .th-close:hover { background: rgba(255,255,255,0.06); color: #a1a1aa; }
        .th-body {
          flex: 1; overflow-y: auto; padding: 16px 20px;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent;
        }
        .th-loading, .th-empty {
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          padding: 40px 0; color: #71717a; font-size: 13px;
        }
        /* Entry */
        .th-entry {
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 10px; margin-bottom: 8px;
          background: rgba(255,255,255,0.015); transition: all 0.2s;
        }
        .th-entry.expanded { border-color: rgba(99,102,241,0.15); background: rgba(99,102,241,0.02); }
        .th-entry-header {
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 12px 14px; border: none; background: none;
          cursor: pointer; text-align: left;
        }
        .th-entry-header:hover { background: rgba(255,255,255,0.02); border-radius: 10px; }
        .th-entry-status { flex-shrink: 0; }
        .th-entry-info { flex: 1; min-width: 0; }
        .th-entry-name {
          display: block; font-size: 13px; font-weight: 600; color: #e4e4e7;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .th-entry-meta { display: block; font-size: 10px; color: #52525b; margin-top: 2px; }
        /* Detail */
        .th-entry-detail { padding: 0 14px 14px; }
        .th-stats-bar {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
          padding: 10px; background: rgba(0,0,0,0.25); border-radius: 8px; margin-bottom: 14px;
        }
        .th-stat { display: flex; flex-direction: column; gap: 2px; }
        .th-stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #52525b; }
        .th-stat-value { font-size: 11px; font-weight: 600; color: #a1a1aa; }
        .th-stat-value.completed { color: #22c55e; }
        .th-stat-value.completed-with-issues { color: #f59e0b; }
        .th-stat-value.failed { color: #ef4444; }
        .th-section-title {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 700; color: #71717a;
          text-transform: uppercase; letter-spacing: 0.06em;
          margin-bottom: 10px; padding-bottom: 6px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        /* Steps */
        .th-step {
          margin-bottom: 6px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.03);
          background: rgba(255,255,255,0.01);
          overflow: hidden;
        }
        .th-step.completed { border-left: 2px solid #22c55e; }
        .th-step.completed-with-issues { border-left: 2px solid #f59e0b; }
        .th-step.failed { border-left: 2px solid #ef4444; }
        .th-step.in-progress { border-left: 2px solid #3b82f6; }
        .th-step.pending { border-left: 2px solid #3f3f46; }
        .th-step-header {
          display: flex; align-items: center; gap: 8px; padding: 8px 10px;
        }
        .th-step-num {
          font-size: 9px; font-weight: 700; color: #52525b;
          width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
          border-radius: 50%; background: rgba(255,255,255,0.04); flex-shrink: 0;
        }
        .th-step-desc { flex: 1; font-size: 12px; color: #d4d4d8; min-width: 0; }
        .th-step-duration { font-size: 10px; color: #52525b; flex-shrink: 0; }
        .th-step-reasoning {
          padding: 6px 10px 8px 36px;
          background: rgba(99,102,241,0.04);
          border-top: 1px solid rgba(99,102,241,0.06);
        }
        .th-step-reasoning-label {
          font-size: 10px; font-weight: 600; color: #6366f1; display: block; margin-bottom: 2px;
        }
        .th-step-reasoning p {
          font-size: 11px; color: #a1a1aa; margin: 0; line-height: 1.5; white-space: pre-wrap;
        }
        .th-step-output {
          padding: 6px 10px 8px 36px;
          background: rgba(34,197,94,0.03);
          border-top: 1px solid rgba(34,197,94,0.06);
        }
        .th-step-output.warning {
          background: rgba(245,158,11,0.04);
          border-top: 1px solid rgba(245,158,11,0.1);
        }
        .th-step-output.error {
          background: rgba(239,68,68,0.04);
          border-top-color: rgba(239,68,68,0.08);
        }
        .th-step-output-label {
          font-size: 10px; font-weight: 600; color: #22c55e; display: block; margin-bottom: 2px;
        }
        .th-step-output.warning .th-step-output-label { color: #f59e0b; }
        .th-step-output.error .th-step-output-label { color: #ef4444; }
        .th-step-output-content {
          font-size: 11px; color: #a1a1aa; line-height: 1.5; white-space: pre-wrap; word-break: break-all;
        }
        .th-link {
          color: #818cf8; text-decoration: underline; text-underline-offset: 2px;
          word-break: break-all;
        }
        .th-link:hover { color: #a5b4fc; }

        /* Retry Buttons */
        .th-step-output-top {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 2px;
        }
        .th-retry-btn {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px; font-size: 10px; font-weight: 600;
          border-radius: 6px; border: 1px solid rgba(245,158,11,0.3);
          background: rgba(245,158,11,0.08); color: #fbbf24;
          cursor: pointer; transition: all 0.2s;
        }
        .th-retry-btn:hover:not(:disabled) {
          background: rgba(245,158,11,0.18); border-color: rgba(245,158,11,0.5);
          box-shadow: 0 0 12px rgba(245,158,11,0.1);
        }
        .th-retry-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .th-retry-btn.success {
          border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.08); color: #4ade80;
        }
        .th-retry-all-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%; padding: 8px 14px; font-size: 12px; font-weight: 600;
          border-radius: 8px; border: 1px solid rgba(245,158,11,0.25);
          background: rgba(245,158,11,0.06); color: #fbbf24;
          cursor: pointer; transition: all 0.2s; margin-bottom: 14px;
        }
        .th-retry-all-btn:hover:not(:disabled) {
          background: rgba(245,158,11,0.14); border-color: rgba(245,158,11,0.4);
          box-shadow: 0 0 16px rgba(245,158,11,0.08);
        }
        .th-retry-all-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </>
  );
};

/* ─── Agent Desk Sprite ───────────────────────────────── */

interface AgentDeskProps {
  agent: AgentPresence;
  position: { x: number; y: number; facing: 'left' | 'right' | 'inward' };
  isTransitioning?: boolean;
  transitionDelay?: number;
  isAtTable?: boolean;
  onPositionChange?: (id: string, x: number, y: number) => void;
  onTokenBreakdown?: (
    event: React.MouseEvent | React.KeyboardEvent,
    title: string,
    scope: string,
    byModel?: Record<string, unknown>,
    fallback?: TokenUsageBucket | null
  ) => void;
}

const AgentDeskSprite: React.FC<AgentDeskProps> = ({
  agent,
  position,
  isTransitioning = false,
  transitionDelay = 0,
  isAtTable = false,
  onPositionChange,
  onTokenBreakdown,
}) => {
  const [hovered, setHovered] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const sessionDuration = formatDuration(agent.sessionStartedAt);
  const hasSteps = agent.executionSteps && agent.executionSteps.length > 0;
  const installProgress = agent.installProgress || null;
  const [powerLoading, setPowerLoading] = useState(false);
  const isRunnerEnabled = agent.runnerEnabled !== false;
  const isOnline = agent.status !== 'offline' && isRunnerEnabled;
  const effectiveStatus = isRunnerEnabled ? agent.status : 'offline';
  const status = STATUS_CONFIG[effectiveStatus as keyof typeof STATUS_CONFIG] || DEFAULT_STATUS;

  const handlePowerToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (powerLoading) return;
    setPowerLoading(true);
    try {
      if (isOnline) {
        // Stop: disable runner in presence, stop process, and send stop command
        await presenceService.setRunnerEnabled(agent.id, false, 'admin-console');
        await presenceService.setOffline(agent.id);
        await presenceService.sendCommand(agent.id, 'command', 'stop');
        const stopResp = await fetch('/api/agent/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: agent.id, action: 'stop' }),
        });
        if (!stopResp.ok) {
          throw new Error(`Agent control stop failed: ${stopResp.status}`);
        }
      } else {
        // Start: bring runner online and bootstrap launchd
        const startResp = await fetch('/api/agent/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: agent.id, action: 'start' }),
        });
        if (!startResp.ok) {
          throw new Error(`Agent control start failed: ${startResp.status}`);
        }
        await presenceService.setRunnerEnabled(agent.id, true, 'admin-console');
        await presenceService.setIdle(agent.id, 'Starting up...');
      }
    } catch (err) {
      console.error('Power toggle failed:', err);
    } finally {
      setPowerLoading(false);
    }
  }, [agent.id, isOnline, powerLoading]);

  // ─── Drag state ─────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number; startY: number;
    startPosX: number; startPosY: number;
    hasMoved: boolean;
  } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // left-click only
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startPosX: position.x, startPosY: position.y,
      hasMoved: false,
    };
  }, [position.x, position.y]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (!dragRef.current.hasMoved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      dragRef.current.hasMoved = true;
      if (!isDragging) setIsDragging(true);
      if (hovered) setHovered(false);

      const floor = document.querySelector('.office-floor') as HTMLElement;
      if (!floor) return;
      const rect = floor.getBoundingClientRect();
      const newX = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
      const newY = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
      onPositionChange?.(agent.id, newX, newY);
    };

    const handleMouseUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        setIsDragging(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, hovered, agent.id, onPositionChange]);

  const handleMouseEnter = useCallback(() => {
    if (isDragging) return;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // 400ms delay so dragging can start before the panel appears
    hoverTimerRef.current = setTimeout(() => {
      setHovered(true);
      hoverTimerRef.current = null;
    }, 400);
  }, [isDragging]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    hoverTimerRef.current = setTimeout(() => {
      setHovered(false);
      hoverTimerRef.current = null;
    }, 500);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // Click outside to close
  const spriteRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (hovered && spriteRef.current && !spriteRef.current.contains(e.target as Node)) {
        setHovered(false);
        if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [hovered]);

  // Keep hover panel within viewport bounds
  useEffect(() => {
    if (!hovered || !panelRef.current) return;
    const el = panelRef.current;
    const rect = el.getBoundingClientRect();
    const vH = window.innerHeight;
    const margin = 12;

    if (rect.bottom > vH - margin) {
      // Panel overflows bottom — shift it up
      const overflow = rect.bottom - (vH - margin);
      el.style.transform = `translateY(calc(-50% - ${overflow}px))`;
    } else if (rect.top < margin) {
      // Panel overflows top — shift it down
      const overflow = margin - rect.top;
      el.style.transform = `translateY(calc(-50% + ${overflow}px))`;
    }
  }, [hovered]);

  // Random coffee break — agent walks to the coffee station and back
  const [coffeePhase, setCoffeePhase] = useState<'none' | 'walking-to' | 'pouring' | 'walking-back'>('none');
  const isOnCoffeeBreak = coffeePhase !== 'none';
  const [showProfile, setShowProfile] = useState(false);

  // Coffee station position (matches CSS: bottom: 14%, right: 12% → ~left: 85%, top: 78%)
  const coffeeStationPos = { x: 85, y: 78 };

  // Store the desk position for returning
  const deskPosRef = useRef(position);
  useEffect(() => {
    if (coffeePhase === 'none') {
      deskPosRef.current = position;
    }
  }, [position, coffeePhase]);

  useEffect(() => {
    // Don't trigger coffee when collaborating at the table
    if (isTransitioning || isAtTable) return;

    const scheduleCoffee = () => {
      const delay = 60_000 + Math.random() * 60_000; // 60-120s
      return setTimeout(() => {
        // Phase 1: Walk to coffee station (2s transition)
        setCoffeePhase('walking-to');

        // Phase 2: Arrive, pour coffee (after 2s walk)
        setTimeout(() => setCoffeePhase('pouring'), 2000);

        // Phase 3: Walk back to desk (after 3s pouring)
        setTimeout(() => setCoffeePhase('walking-back'), 5000);

        // Phase 4: Back at desk (after 2s return walk)
        setTimeout(() => {
          setCoffeePhase('none');
          // Schedule next break
          coffeeTimer.current = scheduleCoffee();
        }, 7000);
      }, delay);
    };
    const coffeeTimer = { current: scheduleCoffee() };
    return () => clearTimeout(coffeeTimer.current);
  }, [isTransitioning, isAtTable]);

  // Determine actual display position based on coffee phase
  const isWalkingCoffee = coffeePhase === 'walking-to' || coffeePhase === 'walking-back';
  const isAtCoffeeStation = coffeePhase === 'walking-to' || coffeePhase === 'pouring';
  const displayPos = isAtCoffeeStation ? coffeeStationPos
    : coffeePhase === 'walking-back' ? deskPosRef.current
      : position;

  return (
    <>
      {/* Empty desk left behind when agent walks to coffee */}
      {isOnCoffeeBreak && !isAtTable && (
        <div
          className="agent-desk-sprite agent-desk-empty"
          style={{
            left: `${deskPosRef.current.x}%`,
            top: `${deskPosRef.current.y}%`,
          }}
        >
          <div className="desk-glow" style={{ boxShadow: `0 0 40px 15px ${status.glow}`, opacity: 0.3 }} />
          <div className="office-desk">
            <div className="desk-surface" />
            <div className="desk-leg left" />
            <div className="desk-leg right" />
          </div>
          <div className="agent-monitor" style={{ boxShadow: `0 0 20px ${status.monitorGlow}`, opacity: 0.5 }}>
            <div className="monitor-screen" style={{ background: '#0a0a0a' }} />
            <div className="monitor-stand" />
          </div>
          <div className="office-chair" />
        </div>
      )}
      <div
        ref={spriteRef}
        className={`agent-desk-sprite ${isTransitioning ? 'transitioning' : ''} ${isDragging ? 'dragging' : ''} ${isWalkingCoffee ? 'coffee-transitioning' : ''}`}
        style={{
          left: `${displayPos.x}%`,
          top: `${displayPos.y}%`,
          transitionDelay: isTransitioning ? `${transitionDelay}ms` : '0ms',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Desk furniture — hidden when agent is at the table or coffee station */}
        {!isAtTable && !isTransitioning && !isOnCoffeeBreak && (
          <>
            {/* Status halo / glow under the desk */}
            <div className="desk-glow" style={{ boxShadow: `0 0 40px 15px ${status.glow}` }} />

            {/* The desk surface */}
            <div className="office-desk">
              <div className="desk-surface" />
              <div className="desk-leg left" />
              <div className="desk-leg right" />
            </div>

            {/* Monitor */}
            <div className="agent-monitor" style={{ boxShadow: `0 0 20px ${status.monitorGlow}` }}>
              <div className="monitor-screen" style={{ background: effectiveStatus === 'working' ? '#0c1222' : '#0a0a0a' }}>
                {effectiveStatus === 'working' && (
                  <>
                    <div className="code-line l1" />
                    <div className="code-line l2" />
                    <div className="code-line l3" />
                    <div className="cursor-blink" />
                  </>
                )}
              </div>
              <div className="monitor-stand" />
            </div>

            {/* Chair */}
            <div className="office-chair" />
          </>
        )}

        {/* Character — always visible */}
        <div className={`office-character ${effectiveStatus} ${isWalkingCoffee ? 'walking' : ''
          } ${coffeePhase === 'pouring' ? 'pouring-coffee' : ''
          } ${isTransitioning ? 'walking' : ''
          }`}>
          <div className="char-head" />
          <div className="char-body">
            <div className="char-arm left" />
            <div className="char-arm right" />
          </div>
          {(coffeePhase === 'walking-back' || coffeePhase === 'pouring') && <div className="coffee-cup-held">☕</div>}
        </div>

        {/* Needs-help indicator — pulsing SOS above desk */}
        {effectiveStatus === 'needs-help' && (
          <div style={{
            position: 'absolute',
            top: -28,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 18,
            animation: 'needsHelpBounce 1.5s ease-in-out infinite',
            zIndex: 20,
            filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.6))',
          }}>🆘</div>
        )}

        {/* Nameplate + role + progress */}
        <div className="agent-nameplate">
          <span className={`status-dot ${effectiveStatus}`} />
          <div className="nameplate-text">
            <span className="agent-name">{agent.displayName}</span>
            {(agent.role || AGENT_ROLES[agent.id]) && (
              <span className="agent-role">{agent.role || AGENT_ROLES[agent.id]}</span>
            )}
          </div>
          {hasSteps && agent.taskProgress > 0 && (
            <span className="name-progress">{agent.taskProgress}%</span>
          )}
        </div>

        {/* Hover Panel: Info + Live Execution Steps */}
        {hovered && (
          <div ref={panelRef} className={`hover-detail-panel ${position.facing}`}>
            {/* Agent info header */}
            <div className="detail-header">
              <div className="flex items-center gap-2">
                <span className="text-base">{agent.emoji || '⚡️'}</span>
                <span className="text-white font-semibold text-sm">{agent.displayName}</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status.badge}`}>
                {status.label}
              </span>
              {/* Power toggle */}
              <button
                onClick={handlePowerToggle}
                disabled={powerLoading}
                title={isOnline ? `Stop ${agent.displayName}` : `Start ${agent.displayName}`}
                style={{
                  background: 'none', border: 'none', cursor: powerLoading ? 'wait' : 'pointer',
                  padding: '2px', display: 'flex', alignItems: 'center',
                  color: isOnline ? '#22c55e' : '#ef4444',
                  opacity: powerLoading ? 0.5 : 1,
                  transition: 'color 0.2s, opacity 0.2s',
                }}
              >
                {powerLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Power className="w-4 h-4" />
                }
              </button>
            </div>
            {/* Role & duty (clickable → opens deliverables page) */}
            {(agent.role || AGENT_ROLES[agent.id] || AGENT_DUTIES[agent.id]) && (
              <div
                className="detail-duty clickable"
                onClick={() => router.push(`/admin/deliverables/${agent.id}`)}
                title="Click to view deliverables & profile"
              >
                {(agent.role || AGENT_ROLES[agent.id]) && (
                  <p className="text-[10px] font-semibold text-indigo-400">{agent.role || AGENT_ROLES[agent.id]}</p>
                )}
                {AGENT_DUTIES[agent.id] && (
                  <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">{AGENT_DUTIES[agent.id]}</p>
                )}
                <p className="text-[9px] text-indigo-500 mt-1 flex items-center gap-1">
                  <ExternalLink className="w-2.5 h-2.5" />View deliverables
                </p>
              </div>
            )}

            {/* Current task */}
            {agent.currentTask && effectiveStatus === 'working' && (
              <div className="detail-task">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Current Task</p>
                <p className="text-xs text-zinc-100 mt-0.5 font-medium">{agent.currentTask}</p>
              </div>
            )}

            {/* Install progress telemetry */}
            {installProgress && effectiveStatus === 'working' && (
              <div className="detail-install">
                <div className="install-header">
                  <div className="install-title">
                    <Loader2 className={`w-3.5 h-3.5 ${installProgress.phase === 'running' ? 'install-spinner' : ''}`} />
                    <span>Install in Progress</span>
                  </div>
                  <span className={`phase-tag ${installProgress.phase}`}>
                    {installProgress.phase === 'completed' ? 'Completed'
                      : installProgress.phase === 'failed' ? 'Failed'
                        : installProgress.phase === 'verifying' ? 'Verifying'
                          : installProgress.phase === 'running' ? 'Running'
                            : 'Pending'}
                  </span>
                </div>
                <p className="install-command">{installProgress.command}</p>
                <div className="install-progress-track">
                  <div className="install-progress-fill" style={{ width: `${Math.min(100, Math.max(0, installProgress.percent ?? 0))}%` }} />
                </div>
                <div className="install-meta">
                  <span className="install-percent">{installProgress.percent ?? 0}%</span>
                  {installProgress.message && (
                    <span className="install-message">{installProgress.message}</span>
                  )}
                </div>
                {installProgress.logSnippet && installProgress.logSnippet.length > 0 && (
                  <pre className="install-log">
                    {installProgress.logSnippet.slice(-4).join('\n')}
                  </pre>
                )}
                {installProgress.error && (
                  <p className="install-error">⚠️ {installProgress.error}</p>
                )}
              </div>
            )}

            {/* Live Execution Steps Checklist */}
            {hasSteps && effectiveStatus === 'working' && (
              <ExecutionStepsPanel
                steps={agent.executionSteps}
                currentStepIndex={agent.currentStepIndex}
                taskProgress={agent.taskProgress}
                taskName={agent.currentTask}
                taskStartedAt={agent.taskStartedAt}
                agentId={agent.id}
              />
            )}

            {/* Notes (when no steps) */}
            {!hasSteps && agent.notes && (
              <div className="detail-notes">
                <p className="text-[10px] text-zinc-500 mb-0.5">Notes</p>
                <p className="text-[11px] text-zinc-300 whitespace-pre-wrap">{agent.notes}</p>
              </div>
            )}

            {/* Manifesto Monitor */}
            <div className="manifesto-monitor" style={{
              margin: '8px 0', padding: '6px 8px',
              background: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '6px', fontSize: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#a78bfa' }}>
                  <BookOpen className="w-3 h-3" />
                  <span style={{ fontWeight: 600 }}>Manifesto</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newVal = !(agent.manifestoEnabled !== false);
                    presenceService.toggleManifesto(agent.id, newVal);
                  }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, display: 'flex', alignItems: 'center', gap: '3px',
                    color: agent.manifestoEnabled !== false ? '#34d399' : '#6b7280',
                    fontSize: '9px',
                  }}
                  title={agent.manifestoEnabled !== false ? 'Click to disable manifesto injection' : 'Click to enable manifesto injection'}
                >
                  {agent.manifestoEnabled !== false
                    ? <><ToggleRight className="w-4 h-4" /> On</>
                    : <><ToggleLeft className="w-4 h-4" /> Off</>
                  }
                </button>
              </div>
              <div style={{ display: 'flex', gap: '12px', color: '#9ca3af', fontSize: '9px' }}>
                <span>
                  Injections: <strong style={{ color: (agent.manifestoInjections ?? 0) > 0 ? '#a78bfa' : '#6b7280' }}>
                    {agent.manifestoInjections ?? 0}
                  </strong>
                </span>
                {agent.lastManifestoInjection && (
                  <span>
                    Last: {(() => {
                      const mins = Math.round((Date.now() - agent.lastManifestoInjection.getTime()) / 60000);
                      if (mins < 1) return 'just now';
                      if (mins < 60) return `${mins}m ago`;
                      return `${Math.round(mins / 60)}h ago`;
                    })()}
                  </span>
                )}
              </div>
            </div>

            {/* AI Model & Token Usage */}
            <div className="model-token-monitor" style={{
              margin: '8px 0', padding: '6px 8px',
              background: 'rgba(34, 197, 94, 0.06)',
              border: '1px solid rgba(34, 197, 94, 0.15)',
              borderRadius: '6px', fontSize: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4ade80' }}>
                  <Zap className="w-3 h-3" />
                  <span style={{ fontWeight: 600 }}>AI Model</span>
                </div>
                {(() => {
                  const m = agent.currentModel || 'unknown';
                  const ml = m.toLowerCase();
                  const is4o = ml === 'gpt-4o';
                  const isMini = ml.includes('mini');
                  const isCodex = ml.includes('codex');
                  const isClaude = ml.includes('claude') || ml.includes('sonnet') || ml.includes('opus') || ml.includes('haiku');
                  const bg = is4o
                    ? 'rgba(34,197,94,0.15)'
                    : isMini
                      ? 'rgba(59,130,246,0.15)'
                      : isCodex
                        ? 'rgba(139,92,246,0.15)'
                        : isClaude
                          ? 'rgba(245,158,11,0.15)'
                          : 'rgba(113,113,122,0.15)';
                  const fg = is4o
                    ? '#4ade80'
                    : isMini
                      ? '#60a5fa'
                      : isCodex
                        ? '#a78bfa'
                        : isClaude
                          ? '#fbbf24'
                          : '#71717a';
                  const bd = is4o
                    ? 'rgba(34,197,94,0.3)'
                    : isMini
                      ? 'rgba(59,130,246,0.3)'
                      : isCodex
                        ? 'rgba(139,92,246,0.3)'
                        : isClaude
                          ? 'rgba(245,158,11,0.3)'
                          : 'rgba(113,113,122,0.2)';
                  return (
                    <span style={{
                      fontSize: '9px', fontWeight: 700,
                      padding: '1px 6px', borderRadius: '4px',
                      background: bg, color: fg, border: `1px solid ${bd}`,
                      letterSpacing: '0.02em',
                    }}>
                      {m}
                    </span>
                  );
                })()}
              </div>
              {/* ── Token Usage Monitor ── */}
              {(() => {
                const session = agent.tokenUsage;
                const task = agent.tokenUsageTask;
                const cumulative = agent.tokenUsageCumulative;
                const daily = agent.tokenUsageDaily;
                const today = new Date().toISOString().split('T')[0];
                const todayUsage = daily?.[today];
                const hasAny = true; // Always show token usage for all agents
                return (
                  <div style={{
                    margin: '8px 0', padding: '8px 10px',
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: '6px', fontSize: '10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#60a5fa', marginBottom: '6px' }}>
                      <Zap className="w-3 h-3" />
                      <span style={{ fontWeight: 700 }}>Token Usage</span>
                    </div>

                    {/* Main metrics row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                      {/* Session total */}
                      <div
                        className="token-breakdown-trigger"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => onTokenBreakdown?.(
                          event,
                          `${agent.displayName} token usage`,
                          'Session',
                          agent.tokenUsageByModel,
                          session,
                        )}
                        onKeyDown={(event) => onTokenBreakdown?.(
                          event,
                          `${agent.displayName} token usage`,
                          'Session',
                          agent.tokenUsageByModel,
                          session,
                        )}
                        title="Click to open model-level token breakdown + estimated cost"
                        style={{
                          borderRadius: '4px', padding: '4px 6px',
                          border: '1px solid rgba(34, 197, 94, 0.2)',
                          background: 'rgba(34, 197, 94, 0.1)',
                        }}
                      >
                        <div style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>
                          {(session?.totalTokens ?? 0).toLocaleString()}
                        </div>
                      </div>

                      {/* Today */}
                      <div
                        className="token-breakdown-trigger"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => onTokenBreakdown?.(
                          event,
                          `${agent.displayName} token usage`,
                          'Today',
                          agent.tokenUsageDailyByModel?.[today],
                          todayUsage,
                        )}
                        onKeyDown={(event) => onTokenBreakdown?.(
                          event,
                          `${agent.displayName} token usage`,
                          'Today',
                          agent.tokenUsageDailyByModel?.[today],
                          todayUsage,
                        )}
                        title="Click to open model-level token breakdown + estimated cost"
                        style={{
                          borderRadius: '4px', padding: '4px 6px',
                          border: '1px solid rgba(245, 158, 11, 0.2)',
                          background: 'rgba(245, 158, 11, 0.1)',
                        }}
                      >
                        <div style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>
                          {(todayUsage?.totalTokens ?? 0).toLocaleString()}
                        </div>
                      </div>

                      {/* Current Task */}
                      <div
                        className="token-breakdown-trigger"
                        role="button"
                        tabIndex={0}
                        onClick={(event) => onTokenBreakdown?.(
                          event,
                          `${agent.displayName} token usage`,
                          'Current Task',
                          agent.tokenUsageTaskByModel,
                          task,
                        )}
                        onKeyDown={(event) => onTokenBreakdown?.(
                          event,
                          `${agent.displayName} token usage`,
                          'Current Task',
                          agent.tokenUsageTaskByModel,
                          task,
                        )}
                        title="Click to open model-level token breakdown + estimated cost"
                        style={{
                          borderRadius: '4px', padding: '4px 6px',
                          border: '1px solid rgba(6, 182, 212, 0.2)',
                          background: 'rgba(6, 182, 212, 0.1)',
                        }}
                      >
                        <div style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>This Task</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#22d3ee', fontVariantNumeric: 'tabular-nums' }}>
                          {(task?.totalTokens ?? 0).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Breakdown row */}
                    <div style={{ display: 'flex', gap: '10px', color: '#9ca3af', fontSize: '9px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px' }}>
                      <span>
                        In: <strong style={{ color: '#60a5fa' }}>{(session?.promptTokens ?? 0).toLocaleString()}</strong>
                      </span>
                      <span>
                        Out: <strong style={{ color: '#f59e0b' }}>{(session?.completionTokens ?? 0).toLocaleString()}</strong>
                      </span>
                      <span>
                        Calls: <strong style={{ color: '#a1a1aa' }}>{session?.callCount ?? 0}</strong>
                      </span>
                      {cumulative && (
                        <span style={{ marginLeft: 'auto' }}>
                          Lifetime: <strong style={{ color: '#c084fc' }}>{(cumulative.totalTokens ?? 0).toLocaleString()}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Task History */}
            <TaskHistoryPanel agentId={agent.id} agentName={agent.displayName} emoji={agent.emoji} />

            {/* Chat Button */}
            <button
              className="detail-chat-btn"
              onClick={(e) => { e.stopPropagation(); (window as any).__openAgentChat?.(agent); }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat with {agent.displayName}
            </button>

            {/* Footer */}
            <div className="detail-footer">
              <span className="flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />{formatRelative(agent.lastUpdate)}
              </span>
              {sessionDuration && <span>Session: {sessionDuration}</span>}
            </div>
          </div>
        )}
        {/* Agent Profile Modal */}
        {showProfile && (
          <AgentProfileModal
            agentId={agent.id}
            agentName={agent.displayName}
            emoji={agent.emoji || '⚡️'}
            onClose={() => setShowProfile(false)}
          />
        )}
      </div>
    </>
  );
};

/* ─── Office Decorations ──────────────────────────────── */

const OfficeDecorations: React.FC<{ onOpenManifesto?: () => void }> = ({ onOpenManifesto }) => (
  <>
    {/* Manifesto Picture Frame */}
    <div className="office-manifesto-frame" onClick={onOpenManifesto} title="View Agent Manifesto">
      <div className="mf-frame">
        <div className="mf-inner">
          <div className="mf-icon">📜</div>
          <div className="mf-title">Agent Manifesto</div>
          <div className="mf-subtitle">Team Knowledge</div>
        </div>
        <div className="mf-shine" />
      </div>
      <div className="mf-shadow" />
    </div>

    {/* Coffee Station — floor-level, bottom-right area */}
    <div className="coffee-station">
      <div className="cs-counter">
        <div className="cs-counter-surface" />
        <div className="cs-counter-front" />
        <div className="cs-leg left" />
        <div className="cs-leg right" />
      </div>
      <div className="cs-espresso">
        <div className="cs-espresso-body" />
        <div className="cs-espresso-top" />
        <div className="cs-espresso-nozzle" />
        <div className="cs-steam s1" />
        <div className="cs-steam s2" />
        <div className="cs-steam s3" />
      </div>
      <div className="cs-cups">
        <div className="cs-cup" />
        <div className="cs-cup" />
      </div>
      <div className="cs-glow" />
      <div className="cs-label">☕ Coffee</div>
    </div>

    {/* Cozy rug */}
    <div className="office-rug" />
  </>
);

/* ─── Live clock widget ───────────────────────────────── */

const LiveClock: React.FC = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 text-zinc-400 text-sm font-mono">
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      <span>LIVE</span>
      <span className="text-zinc-500">•</span>
      <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
    </div>
  );
};

/* ─── Main Virtual Office ─────────────────────────────── */

const VirtualOfficeContent: React.FC = () => {
  /* eslint-disable react-hooks/exhaustive-deps */
  const router = useRouter();
  const [agents, setAgents] = useState<AgentPresence[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Round Table Collaboration state
  type AgentPositionState = 'desk' | 'table' | 'transitioning-to-table' | 'transitioning-to-desk';

  interface AgentPositionInfo {
    state: AgentPositionState;
    position: { x: number; y: number; facing: 'left' | 'right' | 'inward' };
    deskPosition: { x: number; y: number; facing: 'left' | 'right' | 'inward' };
    transitionDelay: number;
  }

  const [isCollaborating, setIsCollaborating] = useState(false);
  const [groupChatId, setGroupChatId] = useState<string | null>(null);
  const [showGroupChatModal, setShowGroupChatModal] = useState(false);
  const [agentPositions, setAgentPositions] = useState<Record<string, AgentPositionInfo>>({});
  const [collabStartTime, setCollabStartTime] = useState<Date | null>(null);
  const [minutesPreviewData, setMinutesPreviewData] = useState<{
    chatId: string; messages: GroupChatMessage[]; participants: string[]; duration: string;
  } | null>(null);
  const [showFilingCabinet, setShowFilingCabinet] = useState(false);
  const [showProgressTimeline, setShowProgressTimeline] = useState(false);
  const [showStandupConfig, setShowStandupConfig] = useState(false);
  const [showNorthStar, setShowNorthStar] = useState(false);
  const [showSharedDeliverables, setShowSharedDeliverables] = useState(false);
  const [chatAgent, setChatAgent] = useState<AgentPresence | null>(null);
  const [showManifesto, setShowManifesto] = useState(false);
  const [manifestoContent, setManifestoContent] = useState<string | null>(null);
  const [manifestoLoading, setManifestoLoading] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [onboardingDraft, setOnboardingDraft] = useState<AgentDraft | null>(null);
  const [lockingIn, setLockingIn] = useState(false);
  const [onboardingMessages, setOnboardingMessages] = useState<any[]>([]);
  const [tokenBreakdownModal, setTokenBreakdownModal] = useState<TokenBreakdownModalState>({
    isOpen: false,
    title: '',
    scope: '',
    sourceModelTotals: {},
  });

  // ── Telemetry check detection state ──
  const [activeStandup, setActiveStandup] = useState<GroupChat | null>(null);
  const [isStandupObserving, setIsStandupObserving] = useState(false);

  // ── Queued telemetry check (waits for active collaboration to finish) ──
  const queuedStandupRef = useRef<GroupChat | null>(null);
  const [hasQueuedStandup, setHasQueuedStandup] = useState(false);

  // ── Manual Telemetry Trigger state ──
  const [triggeringStandup, setTriggeringStandup] = useState(false);
  const [standupTriggerResult, setStandupTriggerResult] = useState<'success' | 'error' | null>(null);


  const handleTriggerStandup = useCallback(async (type?: 'morning' | 'evening') => {
    if (triggeringStandup || activeStandup) return;
    setTriggeringStandup(true);
    setStandupTriggerResult(null);

    try {
      const res = await fetch('/api/agent/trigger-standup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (!res.ok) {
        // The API now returns detailed error info if the script crashed
        const errData = await res.json().catch(() => ({}));
        console.error('[Telemetry] Check script failed:', errData);
        throw new Error(errData.error || 'Failed to start telemetry check');
      }

      const data = await res.json();
      console.log('[Telemetry] Check started:', data);

      // Safety timeout: if Firestore session never appears within 15s, reset
      // (API already waited 5s to verify script didn't crash immediately)
      setTimeout(() => {
        setTriggeringStandup(prev => {
          if (prev) {
            setStandupTriggerResult('error');
            setTimeout(() => setStandupTriggerResult(null), 5000);
          }
          return false;
        });
      }, 15_000);
    } catch (err: any) {
      console.error('[Telemetry] Trigger failed:', err.message);
      setStandupTriggerResult('error');
      setTriggeringStandup(false);
      setTimeout(() => setStandupTriggerResult(null), 5000);
    }
  }, [triggeringStandup, activeStandup]);

  // ── Restart Agents state ──
  const [restartingAgents, setRestartingAgents] = useState(false);
  const [restartResult, setRestartResult] = useState<'success' | 'error' | null>(null);
  const [restartToast, setRestartToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const handleRestartAgents = useCallback(async () => {
    if (restartingAgents) return;
    setRestartingAgents(true);
    setRestartResult(null);

    const agents = ['nora', 'scout', 'solara', 'sage'];

    try {
      setRestartToast({ message: '⏳ Hard restarting all agents...', type: 'info' });

      // Immediately reflect restart in progress.
      const restartingBatch = writeBatch(db);
      agents.forEach(agentId => {
        restartingBatch.set(doc(db, 'agent-presence', agentId), {
          status: 'offline',
          notes: 'Restarting...',
          lastUpdate: serverTimestamp(),
        }, { merge: true });
      });
      await restartingBatch.commit();

      // Real restart path: force service restart and verify each agent is back online.
      const restartResults = await Promise.allSettled(
        agents.map(async (agentId) => {
          const res = await fetch('/api/agent/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, action: 'restart' }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok || !payload?.success) {
            throw new Error(payload?.error || `HTTP ${res.status}`);
          }
          return { agentId, payload };
        })
      );

      const succeeded = restartResults.flatMap((result) => (
        result.status === 'fulfilled' ? [result.value] : []
      ));
      const failed = restartResults.flatMap((result, index) => {
        if (result.status === 'fulfilled') return [];
        return [{
          agentId: agents[index],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        }];
      });

      const statusBatch = writeBatch(db);
      succeeded.forEach(({ agentId, payload }) => {
        const pidNote = payload?.afterPid ? ` (pid ${payload.afterPid})` : '';
        statusBatch.set(doc(db, 'agent-presence', agentId), {
          status: 'idle',
          notes: `Restarted${pidNote} — warming up`,
          lastUpdate: serverTimestamp(),
        }, { merge: true });
      });
      failed.forEach(({ agentId, error }) => {
        statusBatch.set(doc(db, 'agent-presence', agentId), {
          status: 'offline',
          notes: `Restart failed: ${String(error).slice(0, 120)}`,
          lastUpdate: serverTimestamp(),
        }, { merge: true });
      });
      await statusBatch.commit();

      if (failed.length > 0) {
        const failedIds = failed.map((f) => f.agentId).join(', ');
        setRestartResult('error');
        setRestartToast({ message: `⚠️ Restarted ${succeeded.length}/${agents.length}. Failed: ${failedIds}`, type: 'error' });
      } else {
        setRestartResult('success');
        setRestartToast({ message: '✅ All agents restarted successfully!', type: 'success' });
      }
      setTimeout(() => { setRestartResult(null); setRestartToast(null); }, 7000);
    } catch (err) {
      console.error('Failed to restart agents:', err);
      setRestartResult('error');
      setRestartToast({ message: '❌ Failed to restart agents', type: 'error' });
      setTimeout(() => { setRestartResult(null); setRestartToast(null); }, 5000);
    } finally {
      setRestartingAgents(false);
    }
  }, [restartingAgents]);

  const handleOpenManifesto = useCallback(async () => {
    setShowManifesto(true);
    if (!manifestoContent) {
      setManifestoLoading(true);
      try {
        const res = await fetch('/api/agent/manifesto');
        const data = await res.json();
        setManifestoContent(data.content || 'Manifesto not found.');
      } catch {
        setManifestoContent('Failed to load manifesto.');
      } finally {
        setManifestoLoading(false);
      }
    }
  }, [manifestoContent]);

  const openTokenBreakdown = useCallback((
    title: string,
    scope: string,
    byModel: Record<string, unknown> | undefined,
    fallback?: TokenUsageBucket | null,
  ) => {
    const sourceModelTotals = buildModelUsageOrFallback(byModel, fallback);
    if (Object.keys(sourceModelTotals).length === 0) return;
    setTokenBreakdownModal({
      isOpen: true,
      title,
      scope,
      sourceModelTotals,
    });
  }, []);

  const triggerTokenBreakdown = useCallback((
    event: React.MouseEvent | React.KeyboardEvent,
    title: string,
    scope: string,
    byModel: Record<string, unknown> | undefined,
    fallback?: TokenUsageBucket | null,
  ) => {
    if ('key' in event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
    }
    openTokenBreakdown(title, scope, byModel, fallback);
  }, [openTokenBreakdown]);

  const closeTokenBreakdown = useCallback(() => {
    setTokenBreakdownModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const tokenBreakdownRows = useMemo(() => (
    tokenBreakdownModal.isOpen
      ? calculateTokenCostRows(tokenBreakdownModal.sourceModelTotals)
      : null
  ), [tokenBreakdownModal]);

  // Expose setChatAgent for AgentDeskSprite (avoids prop drilling through sprite component)
  useEffect(() => {
    (window as any).__openAgentChat = (agent: AgentPresence) => setChatAgent(agent);
    return () => { delete (window as any).__openAgentChat; };
  }, []);

  // Handle onboarding brainstorm start — opens group chat with seeded prompt
  const handleStartOnboardingBrainstorm = useCallback(async (
    chatId: string,
    participants: string[],
    agentMeta: AgentDraft
  ) => {
    setShowAddAgent(false);
    setOnboardingDraft(agentMeta);
    setGroupChatId(chatId);
    setCollabStartTime(new Date());
    setIsCollaborating(true);

    // Animate agents to table
    const tablePositions = getAllTablePositions(participants);
    const updatedPositions = { ...agentPositions };
    participants.forEach((agentId, index) => {
      updatedPositions[agentId] = {
        state: 'transitioning-to-table' as AgentPositionState,
        position: tablePositions[agentId],
        deskPosition: updatedPositions[agentId]?.deskPosition || getDeskPosition(index),
        transitionDelay: getStaggerDelay(index),
      };
    });
    setAgentPositions(updatedPositions);

    const lastAgentDelay = getStaggerDelay(participants.length - 1);
    setTimeout(() => {
      const finalPositions = { ...updatedPositions };
      participants.forEach(agentId => {
        finalPositions[agentId].state = 'table';
        finalPositions[agentId].transitionDelay = 0;
      });
      setAgentPositions(finalPositions);
      setShowGroupChatModal(true);
    }, lastAgentDelay + 2000);
  }, [agentPositions]);

  // Handle lock-in: extract soul from chat, call API, create task for Nora
  const handleLockIn = useCallback(async () => {
    if (!onboardingDraft || !groupChatId) return;
    setLockingIn(true);

    try {
      // First, try to extract soul from the conversation
      const extractRes = await fetch('/api/agent/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extract-soul',
          agentId: onboardingDraft.id,
          displayName: onboardingDraft.name,
          messages: onboardingMessages.map(m => ({
            from: m.from,
            content: m.content,
            responses: m.responses,
          })),
        }),
      });
      const extractData = await extractRes.json();

      if (!extractData.success) {
        alert(extractData.error || 'Could not extract soul from the conversation. Keep brainstorming!');
        setLockingIn(false);
        return;
      }

      // Confirm with the user
      const confirmed = window.confirm(
        `Soul proposed by ${extractData.proposedBy}. Lock it in and start automated setup?\n\n` +
        `Preview (first 200 chars):\n${extractData.soulContent.substring(0, 200)}...`
      );
      if (!confirmed) { setLockingIn(false); return; }

      // Lock in — create all infrastructure
      const lockRes = await fetch('/api/agent/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lock-in',
          agentId: onboardingDraft.id,
          displayName: onboardingDraft.name,
          emoji: onboardingDraft.emoji,
          soul: extractData.soulContent,
        }),
      });
      const lockData = await lockRes.json();

      if (!lockData.success) {
        alert(`Lock-in failed: ${lockData.error}`);
        setLockingIn(false);
        return;
      }

      // Create a kanban task for Nora to finish the wiring
      if (lockData.taskForNora) {
        const taskData = lockData.taskForNora;
        await addDoc(collection(db, 'kanban-tasks'), {
          name: taskData.name,
          description: taskData.description,
          assignedTo: taskData.assignedTo,
          priority: taskData.priority,
          complexity: taskData.complexity,
          status: 'pending',
          project: 'Agent Infrastructure',
          createdAt: serverTimestamp(),
          createdBy: 'admin',
        });
      }

      // Announce in group chat
      const participants = agents.filter(a => a.id !== 'antigravity').map(a => a.id);
      await groupChatService.broadcastMessage(
        groupChatId,
        `🔒 **SOUL LOCKED IN** for ${onboardingDraft.emoji} ${onboardingDraft.name}!\n\n` +
        `Infrastructure created:\n${lockData.results.join('\n')}\n\n` +
        `A task has been created for Nora to finish wiring ${onboardingDraft.name} into the system. ` +
        `Welcome to the team! 🎉`,
        participants
      );

      setOnboardingDraft(null);
      alert(`${onboardingDraft.emoji} ${onboardingDraft.name} locked in! Nora will finish the setup.`);
    } catch (err: any) {
      console.error('Lock-in failed:', err);
      alert(`Lock-in error: ${err.message}`);
    } finally {
      setLockingIn(false);
    }
  }, [onboardingDraft, groupChatId, onboardingMessages, agents]);

  // Track messages for lock-in extraction
  useEffect(() => {
    if (!groupChatId || !onboardingDraft) return;
    const unsubscribe = groupChatService.listenToMessages(groupChatId, (msgs) => {
      setOnboardingMessages(msgs);
    });
    return () => unsubscribe();
  }, [groupChatId, onboardingDraft]);

  useEffect(() => {
    const unsubscribe = presenceService.listen((next) => {
      const normalized = normalizeIncomingAgents(next);
      setAgents(normalized.sort((a, b) => a.displayName.localeCompare(b.displayName)));
    });
    return () => unsubscribe();
  }, [refreshKey]);

  // Inject Antigravity as a static always-online agent
  const ANTIGRAVITY_PRESENCE: AgentPresence = {
    id: 'antigravity',
    displayName: 'Antigravity',
    emoji: '🌌',
    status: 'working' as const,
    currentTask: 'Pair programming with Tremaine',
    currentTaskId: '',
    notes: 'IDE Agent — always online when the editor is open',
    executionSteps: [],
    currentStepIndex: -1,
    taskProgress: 0,
    lastUpdate: new Date(),
    sessionStartedAt: new Date(),
  };

  const SCOUT_PRESENCE: AgentPresence = {
    id: 'scout',
    displayName: 'Scout',
    emoji: '🕵️',
    status: 'idle' as const,
    currentTask: '',
    currentTaskId: '',
    notes: 'Influencer research specialist — ready for assignments.',
    executionSteps: [],
    currentStepIndex: -1,
    taskProgress: 0,
    lastUpdate: new Date(),
    sessionStartedAt: new Date(),
  };

  const SOLARA_PRESENCE: AgentPresence = {
    id: 'solara',
    displayName: 'Solara',
    emoji: '❤️‍🔥',
    status: 'idle' as const,
    currentTask: '',
    currentTaskId: '',
    notes: 'Brand Voice steward — calibrating tone, narrative, and creator-facing storytelling.',
    executionSteps: [],
    currentStepIndex: -1,
    taskProgress: 0,
    lastUpdate: new Date(),
    sessionStartedAt: new Date(),
  };

  const SAGE_PRESENCE: AgentPresence = {
    id: 'sage',
    displayName: 'Sage',
    emoji: '🧬',
    status: 'idle' as const,
    currentTask: '',
    currentTaskId: '',
    // Field Notes → Patterns → Feed Drops signature baked into the notes for the hover panel
    notes: 'Field Notes → Patterns → Feed Drops. Warm field correspondent bringing back receipts.',
    executionSteps: [],
    currentStepIndex: -1,
    taskProgress: 0,
    lastUpdate: new Date(),
    sessionStartedAt: new Date(),
  };

  const allAgents = useMemo(() => {
    const merged = [...agents];

    if (!merged.some(a => a.id === 'antigravity')) merged.push(ANTIGRAVITY_PRESENCE);
    if (!merged.some(a => a.id === 'scout')) merged.push(SCOUT_PRESENCE);
    if (!merged.some(a => a.id === 'solara')) merged.push(SOLARA_PRESENCE);
    if (!merged.some(a => a.id === 'sage')) merged.push(SAGE_PRESENCE);

    const priority: Record<string, number> = { antigravity: 0, nora: 1, scout: 2, solara: 3, sage: 4 };
    return merged.sort((a, b) => {
      const pa = priority[a.id] ?? 99;
      const pb = priority[b.id] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [agents]);

  const workingCount = useMemo(() => allAgents.filter((a) => a.status === 'working').length, [allAgents]);
  const idleCount = useMemo(() => allAgents.filter((a) => a.status === 'idle').length, [allAgents]);

  // Overall progress across all working agents
  const overallProgress = useMemo(() => {
    const working = allAgents.filter(a => a.status === 'working' && a.executionSteps.length > 0);
    if (working.length === 0) return null;
    const avg = working.reduce((sum, a) => sum + a.taskProgress, 0) / working.length;
    return Math.round(avg);
  }, [allAgents]);

  // Initialize agent positions when agents load
  useEffect(() => {
    const initialPositions: Record<string, AgentPositionInfo> = {};
    allAgents.forEach((agent, index) => {
      const deskPos = getDeskPosition(index);
      initialPositions[agent.id] = {
        state: 'desk',
        position: deskPos,
        deskPosition: deskPos,
        transitionDelay: 0,
      };
    });
    setAgentPositions(initialPositions);
  }, [allAgents.length]); // Only re-init if agent count changes

  // Handler to start collaboration
  const startCollaboration = useCallback(async () => {
    try {
      setIsCollaborating(true);

      // Create group chat session — exclude antigravity (represents the user, not an agent)
      const agentIds = allAgents.filter(a => a.id !== 'antigravity').map(a => a.id);
      const chatId = await groupChatService.createSession(agentIds);
      setGroupChatId(chatId);
      setCollabStartTime(new Date());

      // Animate agents to table
      const tablePositions = getAllTablePositions(agentIds);
      const updatedPositions = { ...agentPositions };
      agentIds.forEach((agentId, index) => {
        updatedPositions[agentId] = {
          state: 'transitioning-to-table',
          position: tablePositions[agentId],
          deskPosition: updatedPositions[agentId]?.deskPosition || getDeskPosition(index),
          transitionDelay: getStaggerDelay(index),
        };
      });
      setAgentPositions(updatedPositions);

      // Mark as "at table" and open modal after animation
      const lastAgentDelay = getStaggerDelay(agentIds.length - 1);
      setTimeout(() => {
        const finalPositions = { ...updatedPositions };
        agentIds.forEach(agentId => {
          finalPositions[agentId].state = 'table';
          finalPositions[agentId].transitionDelay = 0;
        });
        setAgentPositions(finalPositions);
        setShowGroupChatModal(true);
      }, lastAgentDelay + 2000);

    } catch (error) {
      console.error('Failed to start collaboration:', error);
      setIsCollaborating(false);
    }
  }, [allAgents, agentPositions]);

  // Handler to end collaboration — transitions to meeting minutes preview
  const endCollaboration = useCallback(async (chatMessages?: GroupChatMessage[]) => {
    // Close the chat modal
    setShowGroupChatModal(false);

    // Calculate duration from actual message activity (first→last message), not wall-clock session time
    let durationStr = '< 1m';
    if (chatMessages && chatMessages.length > 1) {
      // Extract timestamps from messages, filtering out nulls
      const timestamps = chatMessages
        .map(m => {
          const ts = (m as any).createdAt;
          if (!ts) return null;
          if (ts instanceof Date) return ts.getTime();
          if (typeof ts === 'number') return ts;
          if (ts.toDate) return ts.toDate().getTime();   // Firestore Timestamp
          if (ts.seconds) return ts.seconds * 1000;      // Firestore-like
          return null;
        })
        .filter((t): t is number => t !== null)
        .sort((a, b) => a - b);

      if (timestamps.length >= 2) {
        const spanMs = timestamps[timestamps.length - 1] - timestamps[0];
        const mins = Math.floor(spanMs / 60_000);
        durationStr = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins || '< 1'}m`;
      } else {
        durationStr = '< 1m';
      }
    } else if (collabStartTime) {
      // Fallback: use session start time (single message or no timestamps)
      const durationMs = Date.now() - collabStartTime.getTime();
      const mins = Math.floor(durationMs / 60_000);
      durationStr = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins || '< 1'}m`;
    }

    // If we have messages, show the meeting minutes preview
    const agentParticipants = allAgents.filter(a => a.id !== 'antigravity').map(a => a.id);
    if (chatMessages && chatMessages.length > 0 && groupChatId) {
      setMinutesPreviewData({
        chatId: groupChatId,
        messages: chatMessages,
        participants: agentParticipants,
        duration: durationStr || '< 1m',
      });
    }

    // Close Firestore session
    if (groupChatId) {
      try {
        await groupChatService.closeSession(groupChatId);
      } catch (error) {
        console.error('Failed to close group chat session:', error);
      }
    }

    const agentIds = allAgents.filter(a => a.id !== 'antigravity').map(a => a.id);

    // Update positions with reverse stagger — use original allAgents index for correct desk position
    const updatedPositions = { ...agentPositions };
    agentIds.forEach((agentId, i) => {
      const originalIndex = allAgents.findIndex(a => a.id === agentId);
      updatedPositions[agentId] = {
        state: 'transitioning-to-desk',
        position: getDeskPosition(originalIndex),
        deskPosition: getDeskPosition(originalIndex),
        transitionDelay: getExitStaggerDelay(i, agentIds.length),
      };
    });
    setAgentPositions(updatedPositions);

    // After animation completes, mark as "at desk" and check for queued telemetry check
    const lastExitDelay = getExitStaggerDelay(0, agentIds.length);
    setTimeout(() => {
      const finalPositions = { ...updatedPositions };
      agentIds.forEach(agentId => {
        finalPositions[agentId].state = 'desk';
        finalPositions[agentId].transitionDelay = 0;
      });
      setAgentPositions(finalPositions);
      setIsCollaborating(false);
      setGroupChatId(null);
      setCollabStartTime(null);

      // ── Check for queued telemetry check ──
      const queued = queuedStandupRef.current;
      if (queued) {
        console.log('[Telemetry] Collaboration ended — activating queued check in 3s');
        // Brief pause so agents settle at desks before marching back to table
        setTimeout(() => {
          queuedStandupRef.current = null;
          setHasQueuedStandup(false);
          setActiveStandup(queued);
          setGroupChatId(queued.id!);
          setIsCollaborating(true);
          setCollabStartTime(new Date());
          setStandupTriggerResult('success');

          // Animate agents to table for telemetry check
          const tablePositions = getAllTablePositions(agentIds);
          const standupPositions = { ...finalPositions };
          agentIds.forEach((agentId, index) => {
            standupPositions[agentId] = {
              state: 'transitioning-to-table',
              position: tablePositions[agentId],
              deskPosition: standupPositions[agentId]?.deskPosition || getDeskPosition(index),
              transitionDelay: getStaggerDelay(index),
            };
          });
          setAgentPositions(standupPositions);

          const lastDelay = getStaggerDelay(agentIds.length - 1);
          setTimeout(() => {
            setAgentPositions(prev => {
              const atTable = { ...prev };
              agentIds.forEach(agentId => {
                if (atTable[agentId]) {
                  atTable[agentId] = { ...atTable[agentId], state: 'table', transitionDelay: 0 };
                }
              });
              return atTable;
            });
          }, lastDelay + 2000);
        }, 3000);
      }
    }, lastExitDelay + 2000);

  }, [allAgents, agentPositions, groupChatId, collabStartTime]);

  // Close minutes preview
  const handleMinutesSaved = useCallback(() => {
    setMinutesPreviewData(null);
  }, []);

  const handleMinutesDiscarded = useCallback(() => {
    setMinutesPreviewData(null);
  }, []);

  // ── Telemetry session listener ──
  // Watches for active group chats with standupMeta (automated telemetry checks)
  // Use refs to avoid re-subscribing on every agentPositions/activeStandup change
  const activeStandupRef = useRef(activeStandup);
  activeStandupRef.current = activeStandup;
  const agentPositionsRef = useRef(agentPositions);
  agentPositionsRef.current = agentPositions;
  const isCollaboratingRef = useRef(isCollaborating);
  isCollaboratingRef.current = isCollaborating;

  useEffect(() => {
    const standupQuery = query(
      collection(db, 'agent-group-chats'),
      where('status', '==', 'active'),
    );

    const unsubStandup = onSnapshot(standupQuery, (snapshot) => {
      // Find the first active session that has standupMeta
      const standupDoc = snapshot.docs.find(doc => {
        const data = doc.data();
        return data.standupMeta != null;
      });

      if (standupDoc) {
        const data = standupDoc.data() as Omit<GroupChat, 'id'>;
        const standup: GroupChat = { id: standupDoc.id, ...data };

        // Only trigger if this is a NEW standup (not already tracking)
        if (!activeStandupRef.current || activeStandupRef.current.id !== standup.id) {
          // ── QUEUE if a non-standup collaboration is active ──
          const isManualCollabActive = isCollaboratingRef.current && !activeStandupRef.current;
          if (isManualCollabActive) {
            // Don't interrupt — queue it and let the user finish
            queuedStandupRef.current = standup;
            setHasQueuedStandup(true);
            setTriggeringStandup(false);
            console.log('[Telemetry] Queued — waiting for collaboration to finish');
            return;
          }

          // ── ACTIVATE the telemetry check now ──
          console.log('[Telemetry] Activating check:', standup.id);
          queuedStandupRef.current = null;
          setHasQueuedStandup(false);
          setActiveStandup(standup);
          setGroupChatId(standup.id!);
          setIsCollaborating(true);
          setCollabStartTime(new Date());
          setTriggeringStandup(false); // Clear manual trigger waiting state
          setStandupTriggerResult('success'); // Show success briefly

          // Animate agents to table (without opening modal)
          const agentIds = allAgents.filter(a => a.id !== 'antigravity').map(a => a.id);
          const tablePositions = getAllTablePositions(agentIds);
          const currentPositions = agentPositionsRef.current;
          const updatedPositions = { ...currentPositions };
          agentIds.forEach((agentId, index) => {
            updatedPositions[agentId] = {
              state: 'transitioning-to-table',
              position: tablePositions[agentId],
              deskPosition: currentPositions[agentId]?.deskPosition || getDeskPosition(index),
              transitionDelay: getStaggerDelay(index),
            };
          });
          setAgentPositions(updatedPositions);

          // Mark as "at table" after animation
          const lastAgentDelay = getStaggerDelay(agentIds.length - 1);
          setTimeout(() => {
            setAgentPositions(prev => {
              const final = { ...prev };
              agentIds.forEach(agentId => {
                if (final[agentId]) {
                  final[agentId] = { ...final[agentId], state: 'table', transitionDelay: 0 };
                }
              });
              return final;
            });
          }, lastAgentDelay + 2000);
        }
      } else if (activeStandupRef.current) {
        // Telemetry check ended — animate agents back to desks
        console.log('[Telemetry] Check ended — animating agents back to desks');
        setActiveStandup(null);
        setIsStandupObserving(false);
        setShowGroupChatModal(false);

        const agentIds = allAgents.filter(a => a.id !== 'antigravity').map(a => a.id);
        const currentPositions = agentPositionsRef.current;
        const updatedPositions = { ...currentPositions };
        agentIds.forEach((agentId, i) => {
          const originalIndex = allAgents.findIndex(a => a.id === agentId);
          updatedPositions[agentId] = {
            state: 'transitioning-to-desk',
            position: getDeskPosition(originalIndex),
            deskPosition: getDeskPosition(originalIndex),
            transitionDelay: getExitStaggerDelay(i, agentIds.length),
          };
        });
        setAgentPositions(updatedPositions);

        const lastExitDelay = getExitStaggerDelay(0, agentIds.length);
        setTimeout(() => {
          setAgentPositions(prev => {
            const final = { ...prev };
            agentIds.forEach(agentId => {
              if (final[agentId]) {
                final[agentId] = { ...final[agentId], state: 'desk', transitionDelay: 0 };
              }
            });
            return final;
          });
          setIsCollaborating(false);
          setGroupChatId(null);
          setCollabStartTime(null);
        }, lastExitDelay + 2000);
      }
    });

    return () => unsubStandup();
  }, [allAgents]);

  // Update table click handler
  const handleTableClick = useCallback(() => {
    // During an automated standup: click opens/closes the observer view
    if (activeStandup) {
      if (isStandupObserving) {
        setShowGroupChatModal(false);
        setIsStandupObserving(false);
      } else {
        setShowGroupChatModal(true);
        setIsStandupObserving(true);
      }
      return;
    }

    // Manual collaboration toggle (no standup active)
    if (isCollaborating) {
      endCollaboration();
    } else {
      startCollaboration();
    }
  }, [isCollaborating, startCollaboration, endCollaboration, activeStandup, isStandupObserving]);

  return (
    <div className="voffice-root">
      <Head>
        <title>Virtual Office – Pulse Admin</title>
      </Head>
      <AdminRouteGuard>
        {/* ── Top bar ── */}
        <div className="voffice-topbar">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Operations</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">Virtual Office</h1>
          </div>
          <div className="flex items-center gap-4">
            <LiveClock />
            <button
              onClick={() => setChatAgent({} as any)}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-900/30 hover:border-indigo-400/50 transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Chat
            </button>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800/60 hover:border-zinc-600 transition-all"
            >
              <RefreshCcw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button
              id="restart-agents-btn"
              onClick={handleRestartAgents}
              disabled={restartingAgents}
              title="Force-restart all agent services on the Mac Mini and verify they came back online"
              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-all ${restartResult === 'success'
                ? 'border-emerald-500/50 text-emerald-300 bg-emerald-900/30'
                : restartResult === 'error'
                  ? 'border-red-500/50 text-red-300 bg-red-900/30'
                  : 'border-amber-500/30 text-amber-300 hover:bg-amber-900/30 hover:border-amber-400/50'
                }`}
            >
              {restartingAgents ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : restartResult === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : restartResult === 'error' ? (
                <XCircle className="w-3.5 h-3.5" />
              ) : (
                <Power className="w-3.5 h-3.5" />
              )}
              {restartingAgents
                ? 'Restarting...'
                : restartResult === 'success'
                  ? 'Sent!'
                  : restartResult === 'error'
                    ? 'Failed'
                    : 'Restart Agents'}
            </button>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="voffice-stats">
          <div className="stat-chip">
            <div className="stat-dot working" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Working</p>
              <p className="text-lg font-semibold text-white">{workingCount}</p>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-dot idle" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Idle</p>
              <p className="text-lg font-semibold text-white">{idleCount}</p>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-dot total" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Total</p>
              <p className="text-lg font-semibold text-white">{allAgents.length}</p>
            </div>
          </div>
          {overallProgress !== null && (
            <div className="stat-chip progress-chip">
              <Zap className="w-4 h-4 text-blue-400" />
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Progress</p>
                <p className="text-lg font-semibold text-blue-400">{overallProgress}%</p>
              </div>
            </div>
          )}

          {/* ── Token Usage (all agents) ── */}
          {(() => {
            const today = new Date().toISOString().split('T')[0];
            // Try daily first, then cumulative, then session
            const todayTotal = allAgents.reduce((sum, a) => {
              const daily = (a as any).tokenUsageDaily?.[today];
              return sum + (daily?.totalTokens ?? 0);
            }, 0);
            const cumulativeTotal = allAgents.reduce((sum, a) => sum + (a.tokenUsageCumulative?.totalTokens ?? 0), 0);
            const sessionTotal = allAgents.reduce((sum, a) => sum + (a.tokenUsage?.totalTokens ?? 0), 0);
            const todayByModel = mergeTokenUsageMaps(
              allAgents.map((a) => a.tokenUsageDailyByModel?.[today]),
            );
            const cumulativeByModel = mergeTokenUsageMaps(
              allAgents.map((a) => a.tokenUsageCumulativeByModel),
            );
            const sessionByModel = mergeTokenUsageMaps(
              allAgents.map((a) => a.tokenUsageByModel),
            );

            const useToday = todayTotal > 0;
            const useCumulative = !useToday && cumulativeTotal > 0;
            const scopeFallback: TokenUsageBucket = {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: useToday
                ? todayTotal
                : useCumulative
                  ? cumulativeTotal
                  : sessionTotal,
              callCount: useToday
                ? allAgents.reduce((sum, a) => sum + ((a.tokenUsageDaily?.[today]?.callCount ?? 0)), 0)
                : useCumulative
                  ? allAgents.reduce((sum, a) => sum + (a.tokenUsageCumulative?.callCount ?? 0), 0)
                  : allAgents.reduce((sum, a) => sum + (a.tokenUsage?.callCount ?? 0), 0),
            };
            const scopeModelTotals = buildModelUsageOrFallback(
              useToday ? todayByModel : useCumulative ? cumulativeByModel : sessionByModel,
              scopeFallback,
            );
            // Pick the best available number
            const displayTotal = todayTotal > 0 ? todayTotal : cumulativeTotal > 0 ? cumulativeTotal : sessionTotal;
            const label = todayTotal > 0 ? 'Today' : cumulativeTotal > 0 ? 'Total' : 'Session';
            const tooltipParts = [
              todayTotal > 0 ? `Today: ${todayTotal.toLocaleString()}` : null,
              cumulativeTotal > 0 ? `Cumulative: ${cumulativeTotal.toLocaleString()}` : null,
              sessionTotal > 0 ? `Session: ${sessionTotal.toLocaleString()}` : null,
            ].filter(Boolean).join(' • ');
            return (
              <div
                className="stat-chip token-breakdown-trigger"
                title={`${tooltipParts || 'No token data available'} • click to open model-level breakdown`}
                onClick={() => openTokenBreakdown('All agents token usage', label, scopeModelTotals, scopeFallback)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openTokenBreakdown('All agents token usage', label, scopeModelTotals, scopeFallback);
                  }
                }}
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Tokens {label}</p>
                  <p className="text-lg font-semibold text-amber-400">{displayTotal.toLocaleString()}</p>
                </div>
              </div>
            );
          })()}
          {/* ── Active Tasks Ticker ── */}
          {(() => {
            const activeTasks = allAgents.filter(a => a.status === 'working' && a.currentTask);
            if (activeTasks.length === 0) return null;
            const agentColors: Record<string, string> = {
              nora: '#22c55e', scout: '#f59e0b', solara: '#f43f5e', sage: '#8b5cf6', antigravity: '#6366f1',
            };
            return (
              <div className="active-tasks-ticker">
                {activeTasks.map(agent => {
                  const color = agentColors[agent.id] || '#8b5cf6';
                  const progress = agent.taskProgress || 0;
                  const stepsTotal = agent.executionSteps?.length || 0;
                  const stepsDone = agent.executionSteps?.filter((s: any) => s.status === 'completed').length || 0;
                  return (
                    <div key={agent.id} className="active-task-item" style={{ borderColor: `${color}30` }}>
                      <div className="active-task-dot" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
                      <div className="active-task-info">
                        <span className="active-task-agent" style={{ color }}>{agent.displayName}</span>
                        <span className="active-task-name">{agent.currentTask}</span>
                      </div>
                      <div className="active-task-progress">
                        <span className="active-task-pct" style={{ color }}>{progress}%</span>
                        {stepsTotal > 0 && (
                          <span className="active-task-steps">{stepsDone}/{stepsTotal}</span>
                        )}
                      </div>
                      <div className="active-task-bar">
                        <div className="active-task-bar-fill" style={{ width: `${progress}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ── The Office Floor ── */}
        <div className="office-floor-container">
          <div className="office-floor">
            <div className="floor-grid" />
            <div className="office-wall" />
            <OfficeDecorations onOpenManifesto={handleOpenManifesto} />

            {/* Round Table for Collaboration */}
            <RoundTable
              isActive={isCollaborating}
              onClick={handleTableClick}
              participantCount={allAgents.filter(a => a.id !== 'antigravity').length}
            />
            {/* Standup badge */}
            {activeStandup && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '44%',
                  transform: 'translateX(-50%)',
                  zIndex: 10,
                  background: activeStandup.standupMeta?.type === 'morning'
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  cursor: 'pointer',
                  animation: 'tablePulse 2s ease-in-out infinite',
                  whiteSpace: 'nowrap',
                }}
                onClick={handleTableClick}
              >
                ⚡ Telemetry Check
                {!isStandupObserving && <span style={{ marginLeft: 6, opacity: 0.8 }}>• Click to observe</span>}
              </div>
            )}

            {/* Queued standup indicator */}
            {hasQueuedStandup && !activeStandup && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '44%',
                  transform: 'translateX(-50%)',
                  zIndex: 10,
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.1))',
                  border: '1px solid rgba(245,158,11,0.3)',
                  color: '#fbbf24',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.3px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  animation: 'tablePulse 2s ease-in-out infinite',
                  whiteSpace: 'nowrap',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                ⏳ Telemetry check queued — waiting for session to end
              </div>
            )}
            {/* Filing Cabinet Button */}
            <div className="filing-cabinet-btn" onClick={() => setShowFilingCabinet(true)}>
              <Archive className="w-4 h-4" />
              <span>Filing Cabinet</span>
            </div>

            <div className="progress-timeline-btn" onClick={() => setShowProgressTimeline(true)}>
              <Activity className="w-4 h-4" />
              <span>Progress Timeline</span>
            </div>

            <div className="standup-config-btn" onClick={() => setShowStandupConfig(true)}>
              <Calendar className="w-4 h-4" />
              <span>Telemetry Schedule</span>
            </div>

            {/* North Star */}
            <div className="north-star-btn" onClick={() => setShowNorthStar(true)}>
              <span style={{ fontSize: 15 }}>⭐</span>
              <span>North Star</span>
            </div>

            {/* Manual Standup Trigger */}
            <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
              <div
                className="standup-trigger-btn"
                onClick={() => {
                  if (activeStandup || triggeringStandup) return;
                  handleTriggerStandup();
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 10,
                  background: activeStandup
                    ? 'rgba(100,100,100,0.3)'
                    : triggeringStandup
                      ? 'rgba(34,197,94,0.2)'
                      : standupTriggerResult === 'success'
                        ? 'rgba(34,197,94,0.3)'
                        : standupTriggerResult === 'error'
                          ? 'rgba(239,68,68,0.3)'
                          : 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(59,130,246,0.15))',
                  border: `1px solid ${activeStandup ? 'rgba(100,100,100,0.3)' : 'rgba(168,85,247,0.3)'}`,
                  color: activeStandup ? '#888' : '#e7e9ea',
                  cursor: activeStandup || triggeringStandup ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 500,
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                {triggeringStandup ? (
                  <Loader2 className="w-4 h-4" style={{ animation: 'spin 1s linear infinite' }} />
                ) : standupTriggerResult === 'success' ? (
                  <CheckCircle2 className="w-4 h-4" style={{ color: '#22c55e' }} />
                ) : standupTriggerResult === 'error' ? (
                  <XCircle className="w-4 h-4" style={{ color: '#ef4444' }} />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>
                  {triggeringStandup ? 'Scanning...' :
                    standupTriggerResult === 'success' ? 'Check Started!' :
                      standupTriggerResult === 'error' ? 'Failed — Retry?' :
                        activeStandup ? 'Telemetry Check Active' :
                          'Run Telemetry Check'}
                </span>
              </div>
            </div>

            {/* Shared Deliverables Button */}
            <div className="shared-deliverables-btn" onClick={() => setShowSharedDeliverables(true)}>
              <Package className="w-4 h-4" />
              <span>Deliverables</span>
            </div>

            {/* Add Agent Button */}
            <div className="add-agent-floor-btn" onClick={() => setShowAddAgent(true)}>
              <UserPlus className="w-4 h-4" />
              <span>Add Agent</span>
            </div>

            {allAgents.length === 0 && (
              <div className="empty-office">
                <div className="empty-icon">🏢</div>
                <p className="text-zinc-400 text-sm">The office is empty</p>
                <p className="text-zinc-600 text-xs mt-1">Agents will appear here when they emit a heartbeat</p>
              </div>
            )}

            {allAgents.map((agent) => {
              const posInfo = agentPositions[agent.id];
              if (!posInfo) return null; // Position not yet initialized

              const isAway = posInfo.state === 'table' || posInfo.state.includes('transitioning');

              return (
                <React.Fragment key={agent.id}>
                  {/* Static empty desk — visible when agent is away */}
                  {isAway && (
                    <div
                      className="agent-desk-sprite agent-desk-empty"
                      style={{
                        left: `${posInfo.deskPosition.x}%`,
                        top: `${posInfo.deskPosition.y}%`,
                      }}
                    >
                      <div className="desk-glow" style={{ boxShadow: '0 0 40px 15px rgba(100,100,140,0.06)' }} />
                      <div className="office-desk">
                        <div className="desk-surface" />
                        <div className="desk-leg left" />
                        <div className="desk-leg right" />
                      </div>
                      <div className="agent-monitor" style={{ boxShadow: '0 0 20px rgba(30,30,60,0.15)' }}>
                        <div className="monitor-screen" style={{ background: '#0a0a0a' }} />
                        <div className="monitor-stand" />
                      </div>
                      <div className="office-chair" />
                    </div>
                  )}

                  {/* The agent (character walks to table, desk hidden when away) */}
                  <AgentDeskSprite
                    agent={agent}
                    position={posInfo.position}
                    isTransitioning={posInfo.state.includes('transitioning')}
                    transitionDelay={posInfo.transitionDelay}
                    isAtTable={posInfo.state === 'table'}
                    onPositionChange={(id, x, y) => {
                      setAgentPositions(prev => ({
                        ...prev,
                        [id]: {
                          ...prev[id],
                          deskPosition: { ...prev[id].deskPosition, x, y },
                          position: { ...prev[id].position, x, y },
                        }
                      }));
                    }}
                    onTokenBreakdown={triggerTokenBreakdown}
                  />
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Group Chat Modal */}
        {showGroupChatModal && groupChatId && (
          <>
            {onboardingDraft && (
              <LockInBanner
                agentDraft={onboardingDraft}
                onLockIn={handleLockIn}
                locking={lockingIn}
              />
            )}
            <GroupChatModal
              chatId={groupChatId}
              participants={allAgents.filter(a => a.id !== 'antigravity').map(a => a.id)}
              onClose={(msgs) => {
                if (onboardingDraft) {
                  setOnboardingDraft(null);
                }
                endCollaboration(msgs);
              }}
            />
          </>
        )}

        {/* Add Agent Modal */}
        {showAddAgent && (
          <AddAgentModal
            onClose={() => setShowAddAgent(false)}
            onStartBrainstorm={handleStartOnboardingBrainstorm}
          />
        )}

        {/* Meeting Minutes Preview */}
        {minutesPreviewData && (
          <MeetingMinutesPreview
            chatId={minutesPreviewData.chatId}
            messages={minutesPreviewData.messages}
            participants={minutesPreviewData.participants}
            duration={minutesPreviewData.duration}
            onSaveAndClose={handleMinutesSaved}
            onDiscard={handleMinutesDiscarded}
          />
        )}

        {/* Filing Cabinet */}
        {showFilingCabinet && (
          <FilingCabinet onClose={() => setShowFilingCabinet(false)} />
        )}

        {showProgressTimeline && (
          <ProgressTimelinePanel agents={allAgents} onClose={() => setShowProgressTimeline(false)} />
        )}

        {showStandupConfig && (
          <StandupConfigPanel onClose={() => setShowStandupConfig(false)} />
        )}

        {showNorthStar && (
          <NorthStarPanel onClose={() => setShowNorthStar(false)} />
        )}

        {/* Shared Deliverables */}
        {showSharedDeliverables && (
          <SharedDeliverables onClose={() => setShowSharedDeliverables(false)} />
        )}

        {/* Manifesto Reader Modal */}
        {showManifesto && ReactDOM.createPortal(
          <div
            className="manifesto-modal-overlay"
            onClick={() => setShowManifesto(false)}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="manifesto-modal" onClick={e => e.stopPropagation()}>
              <div className="manifesto-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>📜</span>
                  <h2 className="manifesto-modal-title">Agent Manifesto</h2>
                </div>
                <button className="manifesto-modal-close" onClick={() => setShowManifesto(false)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="manifesto-modal-body">
                {manifestoLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    <Loader2 className="w-6 h-6 animate-spin" style={{ margin: '0 auto 12px' }} />
                    Loading manifesto...
                  </div>
                ) : manifestoContent ? (
                  <div className="manifesto-content">
                    {manifestoContent.split('\n').map((line, i) => {
                      // Heading rendering
                      if (line.startsWith('# ')) return <h1 key={i}>{line.replace(/^# /, '')}</h1>;
                      if (line.startsWith('## ')) return <h2 key={i}>{line.replace(/^## /, '')}</h2>;
                      if (line.startsWith('### ')) return <h3 key={i}>{line.replace(/^### /, '')}</h3>;
                      if (line.startsWith('---')) return <hr key={i} />;
                      if (line.startsWith('> ')) return <blockquote key={i}>{line.replace(/^> /, '')}</blockquote>;
                      if (line.startsWith('- **')) {
                        const match = line.match(/^- \*\*(.+?)\*\*\s*[—–-]\s*(.*)/);
                        if (match) return <div key={i} className="manifesto-lesson"><strong>{match[1]}</strong> — {match[2]}</div>;
                      }
                      if (line.startsWith('- ')) return <div key={i} className="manifesto-bullet">{line.replace(/^- /, '• ')}</div>;
                      if (line.startsWith('| ') && !line.includes('---')) {
                        const cells = line.split('|').filter(Boolean).map(c => c.trim());
                        return <div key={i} className="manifesto-table-row">{cells.map((c, j) => <span key={j}>{c}</span>)}</div>;
                      }
                      if (line.trim() === '') return <div key={i} style={{ height: '8px' }} />;
                      return <p key={i}>{line}</p>;
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Token Cost Breakdown Modal */}
        {tokenBreakdownRows && tokenBreakdownModal.isOpen && ReactDOM.createPortal(
          <div
            className="token-breakdown-overlay"
            onClick={closeTokenBreakdown}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="token-breakdown-modal" onClick={e => e.stopPropagation()}>
              <div className="token-breakdown-modal-header">
                <div>
                  <h2 className="token-breakdown-modal-title">{tokenBreakdownModal.title}</h2>
                  <p className="token-breakdown-modal-subtitle">
                    {tokenBreakdownModal.scope}
                  </p>
                </div>
                <button className="token-breakdown-modal-close" onClick={closeTokenBreakdown}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="token-breakdown-modal-body">
                <div className="token-breakdown-summary">
                  <div className="token-breakdown-summary-row">
                    <span>Estimated cost:</span>
                    <strong>{formatCost(tokenBreakdownRows.totals.estimatedUSD)}</strong>
                  </div>
                  <div className="token-breakdown-summary-row">
                    <span>Total tokens:</span>
                    <strong>{formatTokensCompact(tokenBreakdownRows.totals.totalTokens)}</strong>
                  </div>
                  <div className="token-breakdown-summary-row">
                    <span>Input / Output / Calls:</span>
                    <strong>
                      {formatTokensCompact(tokenBreakdownRows.totals.promptTokens)} /
                      {' '}
                      {formatTokensCompact(tokenBreakdownRows.totals.completionTokens)}
                      {' '}
                      / {tokenBreakdownRows.totals.callCount}
                    </strong>
                  </div>
                </div>

                <div className="token-breakdown-table">
                  <div className="token-breakdown-table-head">
                    <span>Model</span>
                    <span>In / Out / Calls</span>
                    <span>Estimated Cost (USD)</span>
                  </div>

                  {tokenBreakdownRows.rows.map((row) => (
                    <div
                      key={row.model}
                      className={`token-breakdown-row ${row.cost.hasPricing ? '' : 'token-breakdown-row-unpriced'}`}
                    >
                      <div className="token-breakdown-model">
                        <strong>{row.cost.label}</strong>
                        <span className="token-breakdown-model-id">{row.model}</span>
                        {row.cost.hasPricing ? null : (
                          <span className="token-breakdown-unpriced-note">No price mapping available in this build yet</span>
                        )}
                        {row.cost.estimatedFromTotal && (
                          <span className="token-breakdown-unpriced-note">Prompt/completion breakdown unavailable; estimated from total tokens</span>
                        )}
                      </div>
                      <div className="token-breakdown-metrics">
                        {formatTokensCompact(row.promptTokens)}
                        {' '}
                        /
                        {' '}
                        {formatTokensCompact(row.completionTokens)}
                        {' '}
                        / {row.callCount}
                      </div>
                      <div className="token-breakdown-cost">
                        {row.cost.hasPricing && row.cost.source ? (
                          <a href={row.cost.source} target="_blank" rel="noreferrer">
                            {formatCost(row.cost.estimatedUSD)} (source)
                          </a>
                        ) : (
                          <span>{formatCost(row.cost.estimatedUSD)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="token-breakdown-footnote">
                  Pricing data is from official providers: <a href={PRICING_SOURCE_URLS.openai} target="_blank" rel="noreferrer">OpenAI</a> and <a href={PRICING_SOURCE_URLS.anthropic} target="_blank" rel="noreferrer">Anthropic</a>.
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Agent Chat Modal */}
        {chatAgent !== null && (
          <AgentChatModal
            agents={allAgents}
            initialAgent={chatAgent?.id ? chatAgent : null}
            onClose={() => setChatAgent(null)}
          />
        )}

        {/* Intervention Alert Pop-ups */}
        <InterventionAlert />
      </AdminRouteGuard>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  STYLES                                            */}
      {/* ═══════════════════════════════════════════════════ */}
      <style jsx global>{`
        .voffice-root {
          height: 100vh;
          overflow: hidden;
          background: #030508;
          color: white;
          font-family: 'Inter', -apple-system, sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* ── Top bar ── */
        .voffice-topbar {
          padding: 16px 28px 0;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-shrink: 0;
        }

        /* ── Stats ── */
        .voffice-stats {
          padding: 16px 28px 0;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }
        .stat-chip {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(17,20,23,0.8);
          border: 1px solid rgba(63,63,70,0.3);
          border-radius: 12px;
          padding: 10px 16px;
          backdrop-filter: blur(8px);
        }
        .stat-chip.token-breakdown-trigger {
          cursor: pointer;
          transition: transform 0.15s ease, border-color 0.15s ease;
        }
        .stat-chip.token-breakdown-trigger:hover {
          transform: translateY(-1px);
          border-color: rgba(203,213,225,0.5);
          background: rgba(17,20,23,0.95);
        }
        .token-breakdown-trigger {
          cursor: pointer;
          outline: none;
        }
        .token-breakdown-trigger:focus-visible {
          box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.55);
          outline: none;
        }
        .token-breakdown-overlay {
          position: fixed;
          inset: 0;
          z-index: 1300;
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .token-breakdown-modal {
          width: min(900px, 95vw);
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          background: #0f172a;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 14px;
          overflow: hidden;
          color: #e2e8f0;
          box-shadow: 0 20px 80px rgba(0, 0, 0, 0.5);
        }
        .token-breakdown-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(30, 41, 59, 0.7);
        }
        .token-breakdown-modal-title {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
        }
        .token-breakdown-modal-subtitle {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .token-breakdown-modal-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          color: #94a3b8;
          background: rgba(15, 23, 42, 0.8);
          cursor: pointer;
        }
        .token-breakdown-modal-close:hover {
          color: #f8fafc;
          border-color: rgba(148, 163, 184, 0.5);
          background: rgba(148, 163, 184, 0.12);
        }
        .token-breakdown-modal-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow: auto;
        }
        .token-breakdown-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          padding: 10px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.5);
        }
        .token-breakdown-summary-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 140px;
          font-size: 10px;
          color: #94a3b8;
        }
        .token-breakdown-summary-row strong {
          color: #e2e8f0;
          font-size: 14px;
          font-variant-numeric: tabular-nums;
        }
        .token-breakdown-table {
          display: grid;
          grid-template-columns: minmax(220px, 2fr) minmax(150px, 1fr) minmax(180px, 1fr);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 10px;
          overflow: hidden;
          font-size: 11px;
          background: rgba(15, 23, 42, 0.45);
        }
        .token-breakdown-table-head {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: inherit;
          gap: 12px;
          background: rgba(30, 41, 59, 0.8);
          border-bottom: 1px solid rgba(148, 163, 184, 0.2);
          color: #cbd5e1;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          padding: 10px 12px;
        }
        .token-breakdown-row {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: inherit;
          gap: 12px;
          padding: 10px 12px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
        }
        .token-breakdown-row-unpriced {
          background: rgba(120, 53, 15, 0.12);
        }
        .token-breakdown-model {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .token-breakdown-model-id {
          color: #94a5b8;
          font-size: 10px;
          font-family: monospace;
        }
        .token-breakdown-unpriced-note {
          color: #f59e0b;
          font-size: 10px;
        }
        .token-breakdown-metrics {
          color: #d1d5db;
          font-size: 10px;
          font-variant-numeric: tabular-nums;
          line-height: 1.45;
        }
        .token-breakdown-cost {
          font-size: 11px;
          color: #4ade80;
          font-variant-numeric: tabular-nums;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
        }
        .token-breakdown-cost a {
          color: #60a5fa;
          text-decoration: none;
        }
        .token-breakdown-cost a:hover {
          text-decoration: underline;
        }
        .token-breakdown-footnote {
          margin: 0;
          padding-top: 4px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
          color: #94a3b8;
          font-size: 10px;
        }
        .token-breakdown-footnote a {
          color: #60a5fa;
        }

        .progress-chip {
          border-color: rgba(59,130,246,0.2);
          background: rgba(59,130,246,0.05);
        }
        .stat-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .stat-dot.working { background: #22c55e; box-shadow: 0 0 8px rgba(34,197,94,0.5); }
        .stat-dot.idle { background: #f59e0b; box-shadow: 0 0 8px rgba(245,158,11,0.4); }
        .stat-dot.total { background: #3b82f6; box-shadow: 0 0 8px rgba(59,130,246,0.4); }

        /* ── Active Tasks Ticker ── */
        .active-tasks-ticker {
          display: flex;
          gap: 8px;
          flex: 1;
          min-width: 0;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding: 2px 0;
        }
        .active-tasks-ticker::-webkit-scrollbar { display: none; }
        .active-task-item {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(17,20,23,0.85);
          border: 1px solid;
          border-radius: 10px;
          padding: 8px 12px;
          backdrop-filter: blur(8px);
          min-width: 200px;
          max-width: 320px;
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
          transition: border-color 0.3s ease;
        }
        .active-task-item:hover {
          background: rgba(24,28,33,0.9);
        }
        .active-task-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
          animation: dotPulse 2s infinite;
        }
        .active-task-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
          gap: 1px;
        }
        .active-task-agent {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          line-height: 1;
        }
        .active-task-name {
          font-size: 11px;
          color: #d4d4d8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.3;
        }
        .active-task-progress {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          flex-shrink: 0;
          gap: 1px;
        }
        .active-task-pct {
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
        }
        .active-task-steps {
          font-size: 9px;
          color: #71717a;
          line-height: 1;
        }
        .active-task-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: rgba(255,255,255,0.04);
        }
        .active-task-bar-fill {
          height: 100%;
          border-radius: 0 1px 0 0;
          transition: width 0.5s ease;
        }

        /* ── Office Floor ── */
        .office-floor-container {
          flex: 1;
          padding: 16px 0 0 0;
          min-height: 0;
        }
        .office-floor {
          position: relative;
          width: 100%;
          height: 100%;
          /* overflow: hidden removed — allows hover panels to extend beyond floor */
          background: linear-gradient(180deg, #0d1117 0%, #0a0e14 40%, #080c11 100%);
          border-top: 1px solid rgba(63,63,70,0.2);
        }
        .filing-cabinet-btn {
          position: absolute;
          bottom: 16px;
          right: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(245,158,11,0.12), rgba(234,179,8,0.08));
          border: 1px solid rgba(245,158,11,0.15);
          color: #fbbf24;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 10;
          backdrop-filter: blur(8px);
        }
        .filing-cabinet-btn:hover {
          background: linear-gradient(135deg, rgba(245,158,11,0.2), rgba(234,179,8,0.14));
          border-color: rgba(245,158,11,0.3);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(245,158,11,0.1);
        }
        .progress-timeline-btn {
          position: absolute;
          bottom: 16px;
          left: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(96,165,250,0.08));
          border: 1px solid rgba(59,130,246,0.25);
          color: #60a5fa;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 10;
          backdrop-filter: blur(8px);
        }
        .progress-timeline-btn:hover {
          background: linear-gradient(135deg, rgba(59,130,246,0.25), rgba(96,165,250,0.16));
          border-color: rgba(59,130,246,0.4);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(59,130,246,0.2);
        }
        .standup-config-btn {
          position: absolute;
          bottom: 16px;
          left: 180px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(139,92,246,0.12), rgba(99,102,241,0.08));
          border: 1px solid rgba(139,92,246,0.2);
          color: #a78bfa;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 10;
          backdrop-filter: blur(8px);
        }
        .standup-config-btn:hover {
          background: linear-gradient(135deg, rgba(139,92,246,0.22), rgba(99,102,241,0.14));
          border-color: rgba(139,92,246,0.35);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(139,92,246,0.15);
        }
        .north-star-btn {
          position: absolute;
          top: 1%;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(251,191,36,0.12), rgba(234,179,8,0.08));
          border: 1px solid rgba(251,191,36,0.2);
          color: #fbbf24;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 10;
          backdrop-filter: blur(8px);
        }
        .north-star-btn:hover {
          background: linear-gradient(135deg, rgba(251,191,36,0.22), rgba(234,179,8,0.14));
          border-color: rgba(251,191,36,0.35);
          transform: translateX(-50%) translateY(-1px);
          box-shadow: 0 4px 16px rgba(251,191,36,0.15);
        }

        .shared-deliverables-btn {
          position: absolute;
          bottom: 16px;
          right: 164px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08));
          border: 1px solid rgba(99,102,241,0.15);
          color: #818cf8;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 10;
          backdrop-filter: blur(8px);
        }
        .shared-deliverables-btn:hover {
          background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.14));
          border-color: rgba(99,102,241,0.3);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(99,102,241,0.1);
        }

        /* ─── Add Agent Floor Button ─── */
        .add-agent-floor-btn {
          position: absolute;
          bottom: 16px;
          right: 310px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.08));
          border: 1px solid rgba(34,197,94,0.15);
          color: #4ade80;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 10;
          backdrop-filter: blur(8px);
        }
        .add-agent-floor-btn:hover {
          background: linear-gradient(135deg, rgba(34,197,94,0.22), rgba(16,185,129,0.16));
          border-color: rgba(34,197,94,0.35);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(34,197,94,0.15);
        }

        /* ─── Add Agent Modal ─── */
        .add-agent-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.15s ease;
        }
        .add-agent-modal {
          width: 520px;
          max-width: 95vw;
          max-height: 90vh;
          background: #111318;
          border: 1px solid rgba(63,63,70,0.4);
          border-radius: 16px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset;
          overflow-y: auto;
          animation: slideUp 0.2s ease;
        }
        .add-agent-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(63,63,70,0.3);
        }
        .add-agent-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.1));
          border: 1px solid rgba(34,197,94,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4ade80;
        }
        .add-agent-title {
          font-size: 18px;
          font-weight: 700;
          color: #e7e9ea;
          margin: 0;
        }
        .add-agent-subtitle {
          font-size: 12px;
          color: #6b7280;
          margin: 2px 0 0 0;
        }
        .add-agent-close {
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: all 0.15s;
        }
        .add-agent-close:hover {
          background: rgba(255,255,255,0.06);
          color: #e7e9ea;
        }
        .add-agent-body {
          padding: 24px;
        }
        .add-agent-field {
          margin-bottom: 20px;
        }
        .add-agent-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #a1a1aa;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }
        .add-agent-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1px solid rgba(63,63,70,0.4);
          background: rgba(255,255,255,0.04);
          color: #e7e9ea;
          font-size: 16px;
          font-weight: 500;
          outline: none;
          transition: all 0.2s;
        }
        .add-agent-input:focus {
          border-color: rgba(34,197,94,0.5);
          box-shadow: 0 0 0 3px rgba(34,197,94,0.1);
        }
        .add-agent-input::placeholder {
          color: #3f3f46;
        }
        .add-agent-id-preview {
          display: inline-block;
          margin-top: 6px;
          font-size: 11px;
          color: #6b7280;
        }
        .add-agent-id-preview code {
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(63,63,70,0.3);
          color: #a78bfa;
          font-family: monospace;
          font-size: 11px;
        }
        .add-agent-emoji-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 6px;
        }
        .add-agent-emoji-btn {
          width: 100%;
          aspect-ratio: 1;
          border: 1px solid rgba(63,63,70,0.3);
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .add-agent-emoji-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(63,63,70,0.5);
          transform: scale(1.1);
        }
        .add-agent-emoji-btn.selected {
          background: rgba(34,197,94,0.15);
          border-color: rgba(34,197,94,0.5);
          box-shadow: 0 0 12px rgba(34,197,94,0.2);
          transform: scale(1.1);
        }
        .add-agent-device-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .add-agent-device {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 10px;
          border: 1px solid rgba(63,63,70,0.3);
          background: rgba(255,255,255,0.03);
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
          width: 100%;
        }
        .add-agent-device:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(63,63,70,0.5);
        }
        .add-agent-device.selected {
          background: rgba(59,130,246,0.08);
          border-color: rgba(59,130,246,0.35);
        }
        .add-agent-device-icon {
          font-size: 20px;
        }
        .add-agent-device-name {
          font-size: 14px;
          font-weight: 600;
          color: #e7e9ea;
        }
        .add-agent-device-desc {
          font-size: 11px;
          color: #6b7280;
          margin-top: 2px;
        }
        .add-agent-error {
          padding: 10px 14px;
          border-radius: 8px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          color: #fca5a5;
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 16px;
        }
        .add-agent-workflow {
          padding: 14px 16px;
          border-radius: 10px;
          background: rgba(99,102,241,0.06);
          border: 1px solid rgba(99,102,241,0.15);
          margin-bottom: 20px;
        }
        .add-agent-workflow-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #818cf8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 10px;
        }
        .add-agent-workflow-steps {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .add-agent-wf-step {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 12px;
          color: #9ca3af;
          line-height: 1.5;
        }
        .add-agent-wf-num {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(99,102,241,0.15);
          border: 1px solid rgba(99,102,241,0.3);
          color: #818cf8;
          font-size: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .add-agent-submit {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(34,197,94,0.3);
        }
        .add-agent-submit:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(34,197,94,0.4);
        }

        /* ─── Lock-In Banner ─── */
        .lockin-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 10001;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.08));
          border-bottom: 1px solid rgba(245,158,11,0.25);
          backdrop-filter: blur(16px);
          animation: slideDown 0.3s ease;
        }
        .lockin-banner-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .lockin-emoji {
          font-size: 24px;
        }
        .lockin-title {
          font-size: 14px;
          font-weight: 700;
          color: #fbbf24;
        }
        .lockin-desc {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 2px;
        }
        .lockin-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 10px;
          border: 1px solid rgba(245,158,11,0.4);
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(245,158,11,0.3);
        }
        .lockin-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(245,158,11,0.4);
        }
        .lockin-btn:disabled {
          opacity: 0.7;
          cursor: wait;
        }
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .floor-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(63,63,70,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(63,63,70,0.06) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 15%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.8) 100%);
        }
        .office-wall {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 14%;
          background: linear-gradient(180deg, #111827 0%, #0d1117 100%);
          border-bottom: 2px solid rgba(63,63,70,0.2);
        }

        /* ── Decorations ── */
        /* ── Manifesto Picture Frame ── */
        .office-manifesto-frame {
          position: absolute; top: 7%; left: 50%; transform: translateX(-50%); z-index: 2;
          cursor: pointer; transition: transform 0.2s ease;
        }
        .office-manifesto-frame:hover { transform: translateX(-50%) scale(1.05); }
        .office-manifesto-frame:hover .mf-shine { opacity: 0.3; }
        .mf-frame {
          width: 120px; height: 72px;
          background: linear-gradient(135deg, #b8860b, #daa520, #cd853f, #b8860b);
          border-radius: 3px; padding: 4px; position: relative; overflow: hidden;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3);
        }
        .mf-inner {
          width: 100%; height: 100%;
          background: linear-gradient(180deg, #fdf6e3, #f5e6c8, #ede0c8);
          border-radius: 1px; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 2px;
        }
        .mf-icon { font-size: 16px; line-height: 1; }
        .mf-title { font-size: 6px; font-weight: 700; color: #5c4a2a; letter-spacing: 0.5px; text-transform: uppercase; }
        .mf-subtitle { font-size: 5px; color: #8b7355; font-style: italic; }
        .mf-shine {
          position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
          background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%);
          opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
        }
        .mf-shadow {
          width: 90%; height: 4px; margin: 2px auto 0;
          background: radial-gradient(ellipse, rgba(0,0,0,0.25), transparent);
          border-radius: 50%;
        }

        /* ── Manifesto Modal ── */
        .manifesto-modal-overlay {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          animation: fadeIn 0.2s ease;
        }
        .manifesto-modal {
          width: 680px; max-width: 90vw; max-height: 85vh;
          background: #1a1a2e; border: 1px solid rgba(139,92,246,0.3);
          border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(139,92,246,0.1);
        }
        .manifesto-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid rgba(139,92,246,0.15);
          background: rgba(139,92,246,0.05);
        }
        .manifesto-modal-title { font-size: 16px; font-weight: 700; color: #e2e8f0; margin: 0; }
        .manifesto-modal-close {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          color: #9ca3af; border-radius: 6px; padding: 6px; cursor: pointer;
          transition: all 0.15s ease;
        }
        .manifesto-modal-close:hover { background: rgba(255,255,255,0.1); color: white; }
        .manifesto-modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }

        .manifesto-content h1 { font-size: 20px; font-weight: 800; color: #a78bfa; margin: 16px 0 8px; }
        .manifesto-content h2 { font-size: 15px; font-weight: 700; color: #c4b5fd; margin: 20px 0 8px; border-bottom: 1px solid rgba(139,92,246,0.15); padding-bottom: 4px; }
        .manifesto-content h3 { font-size: 13px; font-weight: 600; color: #ddd6fe; margin: 14px 0 6px; }
        .manifesto-content p { font-size: 12px; color: #d1d5db; line-height: 1.6; margin: 2px 0; }
        .manifesto-content hr { border: none; border-top: 1px solid rgba(139,92,246,0.15); margin: 16px 0; }
        .manifesto-content blockquote {
          border-left: 3px solid #a78bfa; padding: 6px 12px; margin: 8px 0;
          background: rgba(139,92,246,0.06); border-radius: 0 6px 6px 0;
          font-size: 11px; color: #c4b5fd; font-style: italic;
        }
        .manifesto-bullet { font-size: 11px; color: #d1d5db; padding: 2px 0 2px 12px; line-height: 1.5; }
        .manifesto-lesson {
          font-size: 11px; color: #d1d5db; padding: 4px 0 4px 12px; line-height: 1.5;
          border-left: 2px solid rgba(250,204,21,0.3);
          margin: 3px 0; padding-left: 10px;
        }
        .manifesto-lesson strong { color: #fbbf24; }
        .manifesto-table-row {
          display: flex; gap: 16px; font-size: 10px; color: #9ca3af;
          padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .manifesto-table-row span:first-child { min-width: 120px; color: #d1d5db; font-weight: 500; }

        .office-plant { position: absolute; z-index: 2; }
        .office-plant.p1 { bottom: 8%; right: 6%; }
        .office-plant.p2 { bottom: 8%; left: 6%; }
        .office-plant .pot { width: 24px; height: 18px; background: linear-gradient(180deg, #92400e, #78350f); border-radius: 4px 4px 6px 6px; margin: 0 auto; }
        .office-plant .plant-stem { width: 3px; height: 16px; background: #16a34a; margin: 0 auto; position: relative; top: -1px; border-radius: 2px; }
        .office-plant .leaf { position: absolute; width: 14px; height: 8px; background: #22c55e; border-radius: 50% 50% 50% 0; }
        .office-plant .leaf.l1 { top: -30px; left: 50%; transform: translateX(-50%) rotate(-20deg); }
        .office-plant .leaf.l2 { top: -24px; left: 30%; transform: rotate(30deg); }
        .office-plant .leaf.l3 { top: -26px; right: 30%; transform: rotate(-40deg) scaleX(-1); }

        .water-cooler { position: absolute; top: 15%; right: 8%; z-index: 2; }
        .cooler-tank { width: 18px; height: 22px; background: linear-gradient(180deg, rgba(147,197,253,0.3), rgba(96,165,250,0.15)); border: 1px solid rgba(147,197,253,0.2); border-radius: 6px 6px 2px 2px; margin: 0 auto; }
        .cooler-body { width: 22px; height: 28px; background: #d4d4d8; border-radius: 3px; margin: 0 auto; }

        /* Coffee machine */
        /* ═══ Coffee Station ═══ */
        .coffee-station {
          position: absolute;
          bottom: 14%;
          right: 12%;
          z-index: 3;
          width: 80px;
          height: 70px;
        }
        .cs-counter {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
        }
        .cs-counter-surface {
          width: 80px;
          height: 8px;
          background: linear-gradient(90deg, #44403c, #57534e, #44403c);
          border-radius: 3px 3px 0 0;
          box-shadow: 0 -1px 8px rgba(245,158,11,0.06);
        }
        .cs-counter-front {
          width: 80px;
          height: 18px;
          background: linear-gradient(180deg, #3f3f46, #27272a);
          border-radius: 0 0 4px 4px;
          border: 1px solid rgba(63,63,70,0.4);
          border-top: none;
        }
        .cs-leg.left { position: absolute; bottom: -10px; left: 6px; width: 4px; height: 10px; background: #27272a; border-radius: 0 0 2px 2px; }
        .cs-leg.right { position: absolute; bottom: -10px; right: 6px; width: 4px; height: 10px; background: #27272a; border-radius: 0 0 2px 2px; }

        .cs-espresso {
          position: absolute;
          bottom: 26px;
          left: 10px;
          width: 28px;
          height: 30px;
        }
        .cs-espresso-body {
          width: 28px;
          height: 30px;
          background: linear-gradient(180deg, #374151, #1f2937);
          border-radius: 5px 5px 3px 3px;
          border: 1px solid rgba(75,85,99,0.5);
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .cs-espresso-top {
          position: absolute;
          top: -2px;
          left: 2px;
          right: 2px;
          height: 5px;
          background: linear-gradient(180deg, #6b7280, #4b5563);
          border-radius: 3px 3px 0 0;
        }
        .cs-espresso-nozzle {
          position: absolute;
          bottom: 3px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 3px;
          background: #6b7280;
          border-radius: 0 0 2px 2px;
        }
        .cs-steam {
          position: absolute;
          top: -6px;
          width: 2px;
          background: rgba(255,255,255,0.12);
          border-radius: 4px;
          animation: csSteamRise 2.5s ease-in-out infinite;
        }
        .cs-steam.s1 { left: 8px; height: 10px; animation-delay: 0s; }
        .cs-steam.s2 { left: 14px; height: 13px; animation-delay: 0.8s; }
        .cs-steam.s3 { left: 20px; height: 8px; animation-delay: 1.6s; }
        @keyframes csSteamRise {
          0% { opacity: 0; transform: translateY(0) scaleX(1); }
          30% { opacity: 0.5; }
          70% { opacity: 0.2; transform: translateY(-10px) scaleX(1.4); }
          100% { opacity: 0; transform: translateY(-16px) scaleX(2); }
        }

        .cs-cups {
          position: absolute;
          bottom: 26px;
          right: 8px;
          display: flex;
          gap: 4px;
        }
        .cs-cup {
          width: 8px;
          height: 7px;
          background: #e7e5e4;
          border-radius: 1px 1px 3px 3px;
          border: 1px solid rgba(168,162,158,0.4);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .cs-glow {
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 100px;
          height: 16px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(245,158,11,0.08), transparent 70%);
        }
        .cs-label {
          position: absolute;
          bottom: -20px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 9px;
          color: #71717a;
          font-weight: 500;
          letter-spacing: 0.03em;
          white-space: nowrap;
          font-family: Inter, -apple-system, sans-serif;
        }

        /* Cozy rug */
        .office-rug {
          position: absolute;
          top: 43%; left: 35%; width: 30%; height: 16%;
          background: radial-gradient(ellipse, rgba(139,92,246,0.06), rgba(99,102,241,0.03), transparent 70%);
          border: 1px solid rgba(139,92,246,0.06);
          border-radius: 50%;
          z-index: 0;
        }

        /* ══════════════════════════════════════════════════ */
        /*  AGENT DESK SPRITES                               */
        /* ══════════════════════════════════════════════════ */
        .agent-desk-sprite {
          position: absolute;
          width: 120px; height: 120px;
          transform: translate(-50%, -50%);
          z-index: 5;
          cursor: pointer;
          transition: transform 0.3s ease;
        }
        .agent-desk-sprite:hover {
          transform: translate(-50%, -50%) scale(1.08);
          z-index: 999;
        }
        .agent-desk-sprite.dragging {
          transform: translate(-50%, -50%) scale(1.12);
          z-index: 1000;
          transition: none !important;
          filter: drop-shadow(0 8px 24px rgba(59,130,246,0.3));
        }
        .desk-glow {
          position: absolute;
          bottom: 4px; left: 50%;
          transform: translateX(-50%);
          width: 80px; height: 10px;
          border-radius: 50%;
          transition: box-shadow 0.4s ease;
        }

        /* Desk */
        .office-desk { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); }
        .desk-surface { width: 90px; height: 8px; background: linear-gradient(90deg, #3f3f46, #52525b, #3f3f46); border-radius: 3px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .desk-leg { position: absolute; top: 8px; width: 4px; height: 14px; background: #27272a; border-radius: 0 0 2px 2px; }
        .desk-leg.left { left: 8px; }
        .desk-leg.right { right: 8px; }

        /* Monitor */
        .agent-monitor { position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%); width: 40px; height: 28px; border-radius: 4px; background: #18181b; border: 2px solid #27272a; transition: box-shadow 0.4s ease; z-index: 3; }
        .monitor-screen { width: calc(100% - 4px); height: calc(100% - 6px); margin: 2px; border-radius: 2px; overflow: hidden; position: relative; }
        .monitor-stand { position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 12px; height: 4px; background: #27272a; border-radius: 0 0 2px 2px; }

        .code-line { height: 2px; border-radius: 1px; margin: 3px 3px 0; opacity: 0.6; }
        .code-line.l1 { width: 60%; background: #22c55e; animation: codeFlicker 2s infinite 0s; }
        .code-line.l2 { width: 40%; background: #3b82f6; animation: codeFlicker 2s infinite 0.4s; }
        .code-line.l3 { width: 75%; background: #a855f7; animation: codeFlicker 2s infinite 0.8s; }
        .cursor-blink { position: absolute; bottom: 4px; right: 4px; width: 2px; height: 5px; background: #22c55e; animation: blink 1s step-end infinite; }
        @keyframes codeFlicker { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

        /* Character */
        .office-character { position: absolute; bottom: 36px; left: 50%; transform: translateX(calc(-50% - 16px)); display: flex; flex-direction: column; align-items: center; z-index: 2; }
        .char-head { width: 16px; height: 16px; border-radius: 50%; background: linear-gradient(180deg, #fde68a, #fbbf24); box-shadow: 0 0 6px rgba(253,230,138,0.3); }
        .char-body { width: 20px; height: 22px; margin-top: 2px; border-radius: 8px 8px 4px 4px; background: linear-gradient(180deg, #38bdf8, #0ea5e9); position: relative; overflow: visible; }
        .char-arm { position: absolute; top: 8px; width: 14px; height: 5px; background: linear-gradient(90deg, #fde68a, #fbbf24); border-radius: 999px; }
        .char-arm.right { right: -10px; transform-origin: left center; }
        .char-arm.left { left: -10px; transform-origin: right center; }

        .office-character.working .char-arm.right { animation: armType 0.6s ease-in-out infinite; }
        .office-character.working .char-arm.left { animation: armType 0.6s ease-in-out infinite 0.3s; }
        @keyframes armType { 0%, 100% { transform: rotate(-2deg) translateY(0); } 50% { transform: rotate(4deg) translateY(-1px); } }

        .office-character.idle .char-arm { animation: none; opacity: 0.7; transform: rotate(2deg); }
        .office-character.idle .char-head { animation: idleBob 3s ease-in-out infinite; }
        @keyframes idleBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(1px); } }

        .office-character.offline { opacity: 0.3; filter: grayscale(0.8); }
        .office-character.offline .char-arm { animation: none; }

        /* Coffee break — position-based transitions */
        .agent-desk-sprite.coffee-transitioning {
          transition: 
            left 2s cubic-bezier(0.4, 0.0, 0.2, 1),
            top 2s cubic-bezier(0.4, 0.0, 0.2, 1);
          z-index: 15;
        }

        .office-character.pouring-coffee {
          animation: pouringBob 1.5s ease-in-out infinite;
        }
        .office-character.pouring-coffee .char-arm.right {
          animation: pouringArm 1s ease-in-out infinite !important;
        }
        @keyframes pouringBob {
          0%, 100% { transform: translateX(calc(-50% - 16px)) translateY(0); }
          50% { transform: translateX(calc(-50% - 16px)) translateY(-2px); }
        }
        @keyframes pouringArm {
          0%, 100% { transform: rotate(-5deg) translateY(0); }
          50% { transform: rotate(10deg) translateY(-3px); }
        }

        .coffee-cup-held {
          position: absolute;
          bottom: 4px;
          right: -10px;
          font-size: 8px;
          opacity: 1;
        }

        .office-chair { position: absolute; bottom: 24px; left: 50%; transform: translateX(calc(-50% - 18px)); width: 22px; height: 24px; border-radius: 8px 8px 4px 4px; background: linear-gradient(180deg, #1e293b, #0f172a); box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 1; }

        /* Empty desk (agent walked to the table — desk stays fully visible) */
        .agent-desk-empty {
          pointer-events: none;
          z-index: 1;
        }

        /* Round Table Transitions */
        .agent-desk-sprite.transitioning {
          transition: 
            left 2s cubic-bezier(0.4, 0.0, 0.2, 1),
            top 2s cubic-bezier(0.4, 0.0, 0.2, 1);
          z-index: 15; /* Above other agents during transition */
        }

        .office-character.walking {
          animation: characterWalk 0.6s steps(4) infinite;
        }

        .office-character.walking .char-arm {
          animation: armSwing 0.6s ease-in-out infinite alternate !important;
        }

        .office-character.walking .char-head {
          animation: headBob 0.6s ease-in-out infinite;
        }

        @keyframes characterWalk {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-2px) rotate(-1deg); }
          50% { transform: translateY(0) rotate(0deg); }
          75% { transform: translateY(-2px) rotate(1deg); }
        }

        @keyframes armSwing {
          0% { transform: rotate(-25deg); }
          100% { transform: rotate(25deg); }
        }

        @keyframes headBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .agent-desk-sprite.transitioning {
            transition-duration: 0.01ms !important;
          }
          .office-character.walking {
            animation: none !important;
          }
          .office-character.walking .char-arm {
            animation: none !important;
          }
          .office-character.walking .char-head {
            animation: none !important;
          }
        }

        /* Nameplate */
        .agent-nameplate {
          position: absolute; bottom: -2px; left: 50%;
          transform: translateX(-50%);
          display: flex; align-items: center; gap: 4px;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(8px);
          padding: 3px 10px;
          border-radius: 10px;
          border: 1px solid rgba(63,63,70,0.3);
          white-space: nowrap; z-index: 10;
        }
        .nameplate-text {
          display: flex; flex-direction: column; align-items: center; gap: 0;
        }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; }
        .status-dot.working { background: #22c55e; animation: dotPulse 2s infinite; }
        .status-dot.idle { background: #f59e0b; }
        .status-dot.offline { background: #52525b; }
        .status-dot.needs-help { background: #f59e0b; animation: needsHelpPulse 1.5s infinite; }
        @keyframes dotPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); } 50% { box-shadow: 0 0 0 4px rgba(34,197,94,0); } }
        @keyframes needsHelpPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.6); } 50% { box-shadow: 0 0 0 6px rgba(245,158,11,0); } }
        @keyframes needsHelpBounce { 0%, 100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-6px); } }
        .agent-name { font-size: 10px; font-weight: 600; color: #d4d4d8; letter-spacing: 0.02em; }
        .agent-role { font-size: 8px; font-weight: 500; color: #71717a; letter-spacing: 0.03em; line-height: 1; margin-top: -1px; }
        .name-progress { font-size: 9px; font-weight: 700; color: #3b82f6; margin-left: 2px; }

        /* ══════════════════════════════════════════════════ */
        /*  HOVER DETAIL PANEL                               */
        /* ══════════════════════════════════════════════════ */
        .hover-detail-panel {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 320px;
          max-height: 80vh;
          overflow-y: auto;
          background: rgba(8,12,17,0.97);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(63,63,70,0.35);
          border-radius: 16px;
          padding: 16px;
          z-index: 100;
          box-shadow: 0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03);
          animation: panelSlideIn 0.2s ease-out;
          scrollbar-width: thin;
          scrollbar-color: rgba(63,63,70,0.3) transparent;
        }
        .hover-detail-panel.right,
        .hover-detail-panel.left {
          /* no-op — always centered now */
        }
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        .detail-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(63,63,70,0.2);
        }
        .detail-duty {
          margin-bottom: 8px;
          padding: 6px 8px;
          background: rgba(99,102,241,0.04);
          border: 1px solid rgba(99,102,241,0.1);
          border-radius: 8px;
        }
        .detail-task {
          margin-bottom: 10px;
        }
        .detail-install {
          margin-bottom: 10px;
          padding: 8px 10px;
          background: rgba(15,23,42,0.5);
          border: 1px solid rgba(59,130,246,0.25);
          border-radius: 10px;
        }
        .install-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 6px;
        }
        .install-title {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 600; color: #bfdbfe;
        }
        .phase-tag {
          font-size: 9px; font-weight: 600; padding: 1px 8px;
          border-radius: 999px; border: 1px solid rgba(59,130,246,0.3);
          color: #93c5fd; background: rgba(59,130,246,0.15);
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .phase-tag.running { color: #38bdf8; border-color: rgba(56,189,248,0.4); background: rgba(56,189,248,0.15); }
        .phase-tag.verifying { color: #fbbf24; border-color: rgba(251,191,36,0.4); background: rgba(251,191,36,0.15); }
        .phase-tag.completed { color: #34d399; border-color: rgba(52,211,153,0.4); background: rgba(52,211,153,0.15); }
        .phase-tag.failed { color: #f87171; border-color: rgba(248,113,113,0.5); background: rgba(248,113,113,0.12); }
        .install-command {
          font-size: 10px; color: #9ca3af; margin-bottom: 6px;
          font-family: 'JetBrains Mono', 'SFMono-Regular', monospace;
        }
        .install-progress-track {
          position: relative;
          height: 4px;
          background: rgba(63,63,70,0.5);
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 6px;
        }
        .install-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #22d3ee);
          transition: width 0.4s ease;
        }
        .install-meta {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 10px; color: #9ca3af; margin-bottom: 6px;
        }
        .install-percent { font-weight: 600; color: #c4b5fd; }
        .install-message { color: #d1d5db; margin-left: 8px; }
        .install-log {
          background: rgba(15,23,42,0.7);
          border: 1px solid rgba(63,63,70,0.35);
          border-radius: 6px;
          font-size: 10px;
          padding: 6px;
          color: #e5e7eb;
          font-family: 'JetBrains Mono', 'SFMono-Regular', monospace;
          max-height: 100px;
          overflow-y: auto;
          white-space: pre-wrap;
        }
        .install-error {
          color: #fca5a5;
          font-size: 10px;
          margin-top: 4px;
        }
        .install-spinner { animation: installSpin 1s linear infinite; }
        @keyframes installSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .detail-notes {
          background: rgba(24,24,27,0.6);
          border: 1px solid rgba(63,63,70,0.2);
          border-radius: 10px;
          padding: 8px 10px;
          margin-bottom: 10px;
        }
        .detail-footer {
          display: flex; justify-content: space-between;
          font-size: 10px; color: #71717a;
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid rgba(63,63,70,0.15);
        }
        .detail-chat-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 0;
          margin-top: 10px;
          background: rgba(139,92,246,0.1);
          border: 1px solid rgba(139,92,246,0.2);
          border-radius: 10px;
          color: #a78bfa;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .detail-chat-btn:hover {
          background: rgba(139,92,246,0.2);
          border-color: rgba(139,92,246,0.4);
          color: #c4b5fd;
        }

        /* ══════════════════════════════════════════════════ */
        /*  EXECUTION STEPS PANEL                            */
        /* ══════════════════════════════════════════════════ */
        .exec-steps-panel {
          background: rgba(15,23,42,0.4);
          border: 1px solid rgba(63,63,70,0.25);
          border-radius: 12px;
          padding: 10px;
          margin-bottom: 8px;
        }
        .exec-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        /* Progress bar */
        .exec-progress-track {
          height: 3px;
          background: rgba(63,63,70,0.3);
          border-radius: 2px;
          margin-bottom: 10px;
          position: relative;
          overflow: visible;
        }
        .exec-progress-fill {
          height: 100%;
          border-radius: 2px;
          background: linear-gradient(90deg, #3b82f6, #22c55e);
          transition: width 0.5s ease;
        }
        .exec-progress-pulse {
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #3b82f6;
          box-shadow: 0 0 8px rgba(59,130,246,0.6);
          animation: progressPulse 1.5s infinite;
        }
        @keyframes progressPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.5; }
        }

        /* Steps list */
        .exec-steps-list {
          max-height: 240px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(63,63,70,0.3) transparent;
        }

        /* Individual step */
        .exec-step {
          position: relative;
          cursor: pointer;
          padding: 2px 0;
        }
        .exec-step-main {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          padding: 4px 4px;
          border-radius: 6px;
          transition: background 0.15s;
        }
        .exec-step-main:hover {
          background: rgba(63,63,70,0.1);
        }

        /* Connector line */
        .exec-step-connector {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          min-width: 14px;
          padding-top: 1px;
        }
        .connector-line {
          position: absolute;
          top: 18px;
          left: 50%;
          transform: translateX(-50%);
          width: 1px;
          height: calc(100% + 4px);
          background: rgba(63,63,70,0.3);
        }
        .exec-step:last-child .connector-line { display: none; }

        .exec-step-content { flex: 1; min-width: 0; }
        .exec-step-desc {
          font-size: 11px;
          line-height: 1.4;
          color: #a1a1aa;
        }
        .exec-step-desc.completed { color: #71717a; text-decoration: line-through; text-decoration-color: rgba(113,113,122,0.3); }
        .exec-step-desc.in-progress { color: #e2e8f0; font-weight: 500; }
        .exec-step-desc.failed { color: #fca5a5; }

        .exec-step-meta {
          font-size: 9px;
          margin-top: 1px;
        }

        /* Active step glow */
        .exec-step.step-active .exec-step-main {
          background: rgba(59,130,246,0.06);
          border: 1px solid rgba(59,130,246,0.12);
          border-radius: 8px;
        }

        /* Expanded detail */
        .exec-step-detail {
          margin: 4px 0 6px 20px;
          padding-left: 8px;
          border-left: 2px solid rgba(63,63,70,0.2);
        }
        .thought-bubble {
          background: rgba(59,130,246,0.06);
          border: 1px solid rgba(59,130,246,0.12);
          border-radius: 8px;
          padding: 6px 8px;
          margin-bottom: 4px;
        }
        .output-bubble {
          background: rgba(34,197,94,0.06);
          border: 1px solid rgba(34,197,94,0.12);
          border-radius: 8px;
          padding: 6px 8px;
        }

        /* ── Commander strip ── */
        .commander-strip {
          max-width: 1200px;
          margin: 16px auto 0;
          padding: 0 28px;
        }
        .commander-card {
          display: flex;
          align-items: center;
          gap: 14px;
          background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06));
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 14px;
          padding: 12px 18px;
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }
        .commander-card:hover {
          border-color: rgba(99,102,241,0.35);
          box-shadow: 0 0 30px rgba(99,102,241,0.08);
        }
        .commander-avatar {
          position: relative;
          width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(99,102,241,0.15);
          border-radius: 12px;
          border: 1px solid rgba(99,102,241,0.3);
        }
        .commander-pulse {
          position: absolute; bottom: -2px; right: -2px;
          width: 10px; height: 10px;
          background: #22c55e;
          border-radius: 50%;
          border: 2px solid #030508;
          animation: dotPulse 2s infinite;
        }
        .commander-info { flex: 1; min-width: 0; }
        .commander-badge {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #a78bfa;
          background: rgba(139,92,246,0.12);
          border: 1px solid rgba(139,92,246,0.25);
          padding: 2px 8px;
          border-radius: 6px;
        }
        .commander-status {
          display: flex; align-items: center; gap: 5px;
        }

        /* ── Task history panel ── */
        .task-history-section {
          margin-top: 8px;
          border-top: 1px solid rgba(63,63,70,0.2);
          padding-top: 6px;
        }
        .history-toggle {
          display: flex; align-items: center; gap: 5px;
          width: 100%;
          padding: 4px 0;
          background: none; border: none; cursor: pointer;
          color: #71717a;
          font-size: 10px;
          font-weight: 500;
          transition: color 0.2s;
        }
        .history-toggle:hover { color: #a1a1aa; }
        .history-list {
          max-height: 220px;
          overflow-y: auto;
          margin-top: 4px;
        }
        .history-entry {
          border-bottom: 1px solid rgba(63,63,70,0.12);
        }
        .history-entry:last-child { border-bottom: none; }
        .history-entry-header {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; gap: 8px;
          padding: 5px 2px;
          background: none; border: none; cursor: pointer;
          transition: background 0.15s;
        }
        .history-entry-header:hover { background: rgba(255,255,255,0.02); }
        .history-entry-steps {
          padding: 4px 6px 8px 18px;
        }
        .history-step {
          display: flex; align-items: center; gap: 5px;
          padding: 2px 0;
        }

        /* ── Empty state ── */
        .empty-office { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; z-index: 5; }
        .empty-icon { font-size: 48px; margin-bottom: 12px; animation: emptyFloat 3s ease-in-out infinite; }
        @keyframes emptyFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .voffice-topbar { flex-direction: column; align-items: flex-start; gap: 12px; }
          .voffice-stats { flex-wrap: wrap; }
          .hover-detail-panel { width: 280px; max-width: 90vw; max-height: 70vh; }
          .commander-card { flex-wrap: wrap; }
        }

        /* ── Clickable duty ── */
        .detail-duty.clickable {
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .detail-duty.clickable:hover {
          background: rgba(99,102,241,0.1);
          border-color: rgba(99,102,241,0.25);
        }

        /* ══════════════════════════════════════════════════ */
        /*  AGENT PROFILE MODAL                               */
        /* ══════════════════════════════════════════════════ */
        .profile-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .profile-modal {
          width: 560px;
          max-width: 92vw;
          max-height: 80vh;
          background: linear-gradient(145deg, rgba(17,24,39,0.98), rgba(9,9,11,0.98));
          border: 1px solid rgba(99,102,241,0.15);
          border-radius: 16px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.6), 0 0 40px rgba(99,102,241,0.08);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: modalSlideUp 0.25s ease-out;
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .profile-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(63,63,70,0.2);
          flex-shrink: 0;
        }
        .profile-modal-close {
          background: none;
          border: none;
          color: #71717a;
          cursor: pointer;
          padding: 4px;
          border-radius: 8px;
          transition: color 0.2s, background 0.2s;
        }
        .profile-modal-close:hover {
          color: #f4f4f5;
          background: rgba(63,63,70,0.3);
        }

        .profile-modal-body {
          overflow-y: auto;
          padding: 20px 24px;
          flex: 1;
        }
        .profile-modal-body::-webkit-scrollbar { width: 4px; }
        .profile-modal-body::-webkit-scrollbar-track { background: transparent; }
        .profile-modal-body::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.2); border-radius: 4px; }

        .profile-section {
          margin-bottom: 18px;
        }
        .profile-section-title {
          font-size: 12px;
          font-weight: 700;
          color: #e4e4e7;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(63,63,70,0.15);
        }
        .profile-bullet-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .profile-bullet {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 6px;
          font-size: 11px;
          color: #a1a1aa;
          line-height: 1.5;
        }
        .bullet-dot {
          flex-shrink: 0;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #6366f1;
          margin-top: 5px;
        }
        .profile-footer {
          margin-top: 12px;
          padding: 12px;
          background: rgba(99,102,241,0.06);
          border: 1px solid rgba(99,102,241,0.12);
          border-radius: 10px;
          font-size: 11px;
          color: #a1a1aa;
          line-height: 1.6;
          font-style: italic;
        }
      `}</style>

      {/* ── Toast Notification ── */}
      {restartToast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          padding: '12px 24px',
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 600,
          color: '#fff',
          background: restartToast.type === 'success'
            ? 'linear-gradient(135deg, #059669, #10b981)'
            : restartToast.type === 'error'
              ? 'linear-gradient(135deg, #dc2626, #ef4444)'
              : 'linear-gradient(135deg, #4f46e5, #6366f1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          border: `1px solid ${restartToast.type === 'success' ? 'rgba(16,185,129,0.4)'
            : restartToast.type === 'error' ? 'rgba(239,68,68,0.4)'
              : 'rgba(99,102,241,0.4)'
            }`,
          animation: 'toastSlideUp 0.3s ease-out',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          whiteSpace: 'nowrap' as const,
        }}>
          {restartToast.type === 'info' && (
            <Loader2 className="w-4 h-4" style={{ animation: 'spin 1s linear infinite' }} />
          )}
          {restartToast.message}
        </div>
      )}

      <style jsx>{`
        @keyframes toastSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default VirtualOfficeContent;
