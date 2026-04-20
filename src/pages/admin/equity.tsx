import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy, addDoc, deleteDoc, doc, Timestamp, updateDoc, where, serverTimestamp, getDoc, deleteField } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PieChart, Users, FileText, Download, Trash2, Loader2, Sparkles, Clock, 
  AlertCircle, CheckCircle, RefreshCw, Eye, Edit3, X,
  Plus, TrendingUp, Calendar, DollarSign, Award,
  UserPlus, Send, Check, Share2, Copy, ChevronDown,
  Shield, Building, Scale, PenTool, Mail, ClipboardCheck, AlertTriangle,
  Paperclip, Link2
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type StakeholderType = 'founder' | 'employee' | 'advisor' | 'investor' | 'contractor';
type EquityType = 'common' | 'preferred' | 'iso' | 'nso' | 'rsu';
type GrantStatus = 'draft' | 'pending_signature' | 'active' | 'terminated' | 'exercised';
type VestingSchedule = '4-year-1-cliff' | '4-year-monthly' | '2-year-monthly' | 'immediate' | 'custom';

interface Stakeholder {
  id: string;
  name: string;
  email: string;
  type: StakeholderType;
  title?: string;
  startDate: Timestamp | Date;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  grants: Grant[];
  // Legacy fields (still used for backward compatibility)
  totalShares?: number;
  totalVested?: number;
  totalUnvested?: number;
  ownershipPercentage?: number;
  // New fields for better option vs share tracking
  optionsGranted?: number;      // Total options granted (not shares until exercised)
  optionsVested?: number;       // Options that have vested
  optionsUnvested?: number;     // Options not yet vested
  optionsExercised?: number;    // Options that have been exercised
  sharesOwned?: number;         // Actual shares owned (after exercise or direct grant)
  // Board consent linkage / verification
  boardConsentDocId?: string | null;
  boardApprovalDate?: string | null; // human-readable date (e.g., "Jan 11, 2026")
  boardConsentVerifiedAt?: Timestamp | Date;
  documents: StakeholderDocument[];
  notes?: string;
  isReservedPool?: boolean;     // Legacy flag for filtering out old pool entries
}

interface Grant {
  id: string;
  stakeholderId: string;
  equityType: EquityType;
  numberOfShares: number;
  strikePrice?: number;
  grantDate: Timestamp | Date;
  vestingSchedule: VestingSchedule;
  vestingStartDate: Timestamp | Date;
  cliffMonths: number;
  vestingMonths: number;
  vestedShares: number;
  unvestedShares: number;
  exercisedShares: number;
  status: GrantStatus;
  boardApprovalDate?: Timestamp | Date;
  expirationDate?: Timestamp | Date;
  documents: GrantDocument[];
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

interface GrantDocument {
  id: string;
  grantId: string;
  documentType: 'option_agreement' | 'board_consent' | 'stockholder_consent' | 'fast_agreement' | 'eip' | 'other';
  title: string;
  status: 'draft' | 'pending_signature' | 'signed';
  documentUrl?: string;
  signedAt?: Timestamp | Date;
  signingRequestId?: string;
  createdAt: Timestamp | Date;
}

interface StakeholderDocument {
  id: string;
  stakeholderId: string;
  documentType: string;
  title: string;
  documentUrl?: string;
  status: 'draft' | 'pending' | 'signed';
  createdAt: Timestamp | Date;
}

interface CapTableSummary {
  totalAuthorizedShares: number;
  totalIssuedShares: number;
  totalReservedOptions: number;
  totalAvailable: number;
  founderShares: number;
  employeeOptions: number;
  advisorShares: number;
  investorShares: number;
}

interface ConvertibleNote {
  id: string;
  holderName: string;
  holderType: string;
  principal: number;
  cap?: number;
  discount?: number;
  interestRate?: number;
  maturityDate?: Timestamp | Date;
  status: 'unconverted' | 'converted';
  notes?: string;
  documentUrl?: string;
  createdAt: Timestamp | Date;
}

interface EquityDocument {
  id: string;
  title: string;
  prompt: string;
  content: string;
  documentType: string;
  requiresSignature?: boolean;
  signingRequestId?: string;
  signingRequestIds?: string[];
  stakeholderId?: string | null;
  stakeholderName?: string | null;
  stakeholderEmail?: string | null;
  stakeholderType?: StakeholderType | null;
  grantDetails?: any;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  status: 'generating' | 'completed' | 'error';
  errorMessage?: string;
  revisionHistory?: { prompt: string; timestamp: Timestamp | Date }[];
  // Exhibits - other documents attached as exhibits
  exhibits?: string[];
  needsResendSignature?: boolean;
  autoSigned?: boolean;
  autoSignedAt?: Timestamp | Date;
  originalDocumentId?: string;
  isAmendment?: boolean;
}

interface SigningRequest {
  id: string;
  documentType: string;
  documentName: string;
  recipientName: string;
  recipientEmail: string;
  status: 'pending' | 'sent' | 'viewed' | 'signed';
  createdAt: Timestamp;
  sentAt?: Timestamp;
  viewedAt?: Timestamp;
  signedAt?: Timestamp;
  equityDocumentId?: string;
  signerRole?: string;
  stakeholderId?: string;
  signingGroupId?: string;
  signingOrder?: number;
  invalidatedAt?: Timestamp | Date;
  invalidatedReason?: string;
  previewMode?: boolean;
}

type SignerRow = {
  id: string;
  role: string;
  stakeholderId?: string;
  name: string;
  email: string;
  signingRequestId?: string;
};

interface AuditResult {
  overallStatus: 'ready' | 'needs-work' | 'critical-issues';
  score: number;
  summary: string;
  criticalIssues: string[];
  missingElements: string[];
  recommendations: string[];
  strengths: string[];
}

type InlineStatus = {
  type: 'success' | 'error' | 'info';
  text: string;
};

// Equity Pool Interface - tracks the option pool reserve (separate from stakeholders)
interface EquityPool {
  id?: string;
  totalReserved: number;      // Total pool size (e.g., 1,000,000)
  granted: number;            // Options granted but not exercised
  exercised: number;          // Options exercised (now actual shares)
  available: number;          // Remaining in pool (totalReserved - granted - exercised)
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

// Default cap table data for Pulse Intelligence Labs
const DEFAULT_CAP_TABLE = {
  authorizedShares: 10000000,
  founder: {
    name: 'Tremaine Grant',
    email: 'tre@fitwithpulse.ai',
    title: 'CEO & President of the Board',
    type: 'founder' as StakeholderType,
    shares: 9000000,
    ownershipPercentage: 90,
    vestingSchedule: '4-year-1-cliff' as VestingSchedule,
    cliffMonths: 12,
    vestingMonths: 48,
    notes: 'Double-trigger acceleration',
    startDate: new Date('2023-01-01'),
  },
  equityPool: {
    totalReserved: 1000000,
    granted: 0,
    exercised: 0,
    available: 1000000,
    notes: 'Reserved for employees, advisors, and contractors (ESOP)',
  },
  convertibleNotes: [
    {
      holderName: 'Launch (Founder University)',
      holderType: 'Convertible Note',
      principal: 25000,
      notes: 'Terms per Template_25k_Founder_University_Convertible_Note',
      status: 'unconverted' as const,
    },
  ],
};

// ============================================================================
// CONSTANTS
// ============================================================================

const STAKEHOLDER_TYPES: { id: StakeholderType; label: string; icon: string; color: string }[] = [
  { id: 'founder', label: 'Founder', icon: '👑', color: '#E0FE10' },
  { id: 'employee', label: 'Employee', icon: '💼', color: '#3B82F6' },
  { id: 'advisor', label: 'Advisor', icon: '🎯', color: '#8B5CF6' },
  { id: 'investor', label: 'Investor', icon: '💰', color: '#10B981' },
  { id: 'contractor', label: 'Contractor', icon: '🔧', color: '#F59E0B' },
];

const EQUITY_TYPES: { id: EquityType; label: string; description: string }[] = [
  { id: 'common', label: 'Common Stock', description: 'Standard voting shares' },
  { id: 'preferred', label: 'Preferred Stock', description: 'Preferred shares with special rights' },
  { id: 'iso', label: 'ISO', description: 'Incentive Stock Options (employees only)' },
  { id: 'nso', label: 'NSO', description: 'Non-Qualified Stock Options' },
  { id: 'rsu', label: 'RSU', description: 'Restricted Stock Units' },
];

const VESTING_SCHEDULES: { id: VestingSchedule; label: string; description: string }[] = [
  { id: '4-year-1-cliff', label: '4-Year with 1-Year Cliff', description: 'Standard startup vesting' },
  { id: '4-year-monthly', label: '4-Year Monthly', description: 'Monthly vesting, no cliff' },
  { id: '2-year-monthly', label: '2-Year Monthly', description: 'Accelerated vesting schedule' },
  { id: 'immediate', label: 'Immediate', description: 'Fully vested on grant date' },
  { id: 'custom', label: 'Custom', description: 'Define custom vesting terms' },
];

const DOCUMENT_TYPES = [
  { id: 'option_agreement', label: 'Stock Option Agreement', icon: '📄' },
  { id: 'board_consent', label: 'Board Consent', icon: '📋' },
  { id: 'stockholder_consent', label: 'Stockholder Consent', icon: '✍️' },
  { id: 'fast_agreement', label: 'FAST Agreement', icon: '⚡' },
  { id: 'advisor_nso_agreement', label: 'Advisor Agreement + NSO Grant', icon: '🎯' },
  { id: 'eip', label: 'Equity Incentive Plan', icon: '📊' },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatDate = (date: Timestamp | Date | string | undefined): string => {
  if (!date) return 'N/A';
  let dateObject: Date;
  if (date instanceof Timestamp) {
    dateObject = date.toDate();
  } else if (date instanceof Date) {
    dateObject = date;
  } else if (typeof date === 'string') {
    dateObject = new Date(date);
  } else {
    return 'Invalid Date';
  }
  if (Number.isNaN(dateObject.getTime())) return 'Invalid Date';
  return dateObject.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric'
  });
};

const getDateValue = (date?: Timestamp | Date): number => {
  if (!date) return 0;
  if (date instanceof Timestamp) return date.toDate().getTime();
  if (date instanceof Date) return date.getTime();
  const parsed = new Date(date as any).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortEquityDocumentsNewest = (documents: EquityDocument[]) =>
  [...documents].sort((a, b) => getDateValue(b.updatedAt || b.createdAt) - getDateValue(a.updatedAt || a.createdAt));

const getEquityDocumentFamilyKey = (equityDoc: EquityDocument) =>
  `${equityDoc.stakeholderId || 'company'}::${equityDoc.documentType}`;

const getLatestRelevantDocuments = (documents: EquityDocument[]) => {
  const latestByFamily = new Map<string, EquityDocument>();

  for (const equityDoc of sortEquityDocumentsNewest(documents)) {
    const familyKey = getEquityDocumentFamilyKey(equityDoc);
    if (!latestByFamily.has(familyKey)) {
      latestByFamily.set(familyKey, equityDoc);
    }
  }

  return sortEquityDocumentsNewest(Array.from(latestByFamily.values()));
};

const getDocumentFamilyHistory = (anchorDoc: EquityDocument, documents: EquityDocument[]) =>
  sortEquityDocumentsNewest(
    documents.filter(doc => getEquityDocumentFamilyKey(doc) === getEquityDocumentFamilyKey(anchorDoc) && doc.id !== anchorDoc.id)
  );

const getEquityDocumentRevisionEntries = (equityDoc: EquityDocument) =>
  [...(equityDoc.revisionHistory || [])].sort(
    (a, b) => getDateValue(b.timestamp) - getDateValue(a.timestamp)
  );

const AUTO_EXECUTED_COMPANY_DOC_TYPES = ['board_consent', 'stockholder_consent', 'eip'] as const;
const LOCAL_EQUITY_FUNCTION_FALLBACK_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai').replace(/\/+$/, '');

const isAutoExecutedCompanyDocType = (documentType?: string | null): boolean =>
  Boolean(documentType && AUTO_EXECUTED_COMPANY_DOC_TYPES.includes(documentType as typeof AUTO_EXECUTED_COMPANY_DOC_TYPES[number]));

const isAutoExecutedCompanyDoc = (document?: Pick<EquityDocument, 'documentType'> | null): boolean =>
  Boolean(document && isAutoExecutedCompanyDocType(document.documentType));

const formatLegalDate = (date?: Timestamp | Date): string => {
  if (!date) {
    return new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  const resolved = date instanceof Timestamp ? date.toDate() : date;
  return resolved.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const getDateInputValue = (date?: Timestamp | Date | string | null): string => {
  if (!date) return '';

  const resolved =
    date instanceof Timestamp
      ? date.toDate()
      : date instanceof Date
      ? date
      : new Date(date);

  if (Number.isNaN(resolved.getTime())) return '';

  const year = resolved.getFullYear();
  const month = `${resolved.getMonth() + 1}`.padStart(2, '0');
  const day = `${resolved.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value: string): Date | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const resolved = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    Number.isNaN(resolved.getTime()) ||
    resolved.getFullYear() !== year ||
    resolved.getMonth() !== month - 1 ||
    resolved.getDate() !== day
  ) {
    return null;
  }

  return resolved;
};

const isLocalEquityRuntime = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const getEquityFunctionOverrideOrigin = (): string | null => {
  if (typeof window === 'undefined') return null;

  const localStorageOverride = window.localStorage.getItem('equity_functions_origin');
  if (localStorageOverride) {
    return localStorageOverride.replace(/\/+$/, '');
  }

  const runtimeOverride = (window as typeof window & {
    __EQUITY_FUNCTIONS_ORIGIN__?: string;
  }).__EQUITY_FUNCTIONS_ORIGIN__;

  return runtimeOverride ? runtimeOverride.replace(/\/+$/, '') : null;
};

const getEquityFunctionFallbackOrigin = (): string | null => {
  if (!isLocalEquityRuntime()) return null;
  return getEquityFunctionOverrideOrigin() || LOCAL_EQUITY_FUNCTION_FALLBACK_ORIGIN;
};

const readFunctionPayload = async (response: Response, functionPath: string) => {
  const contentType = response.headers.get('content-type') || '';
  const rawBody = await response.text();
  let parsed: any = null;

  if (contentType.includes('application/json') && rawBody) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      if (response.ok) {
        throw new Error(`Received invalid JSON from ${functionPath}.`);
      }
    }
  }

  return { contentType, rawBody, parsed };
};

const buildFunctionPayloadError = (
  response: Response,
  functionPath: string,
  payload: { contentType: string; rawBody: string; parsed: any }
) => {
  if (payload.parsed && typeof payload.parsed.error === 'string') {
    return new Error(payload.parsed.error);
  }

  if (!response.ok && payload.rawBody.includes('<!DOCTYPE')) {
    return new Error(
      `The Netlify function ${functionPath} is not available in this local server. You are likely running plain Next dev. Use Netlify dev and open http://localhost:8888, or run this in the deployed environment.`
    );
  }

  return new Error(payload.rawBody.slice(0, 200) || `Request to ${functionPath} failed.`);
};

const shouldRetryEquityFunctionRemotely = (
  functionPath: string,
  response: Response,
  payload: { contentType: string; rawBody: string; parsed: any }
) => {
  if (!isLocalEquityRuntime()) return false;
  if (!functionPath.startsWith('/.netlify/functions/')) return false;
  if (response.ok) return false;

  const errorText = [
    payload.rawBody,
    typeof payload.parsed?.error === 'string' ? payload.parsed.error : '',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    response.status === 404 ||
    payload.rawBody.includes('<!DOCTYPE') ||
    /Function not found/i.test(errorText) ||
    /OpenAI API key not configured/i.test(errorText) ||
    /missing OPENAI_API_KEY or OPEN_AI_SECRET_KEY/i.test(errorText) ||
    /OPEN_AI_SECRET_KEY not configured/i.test(errorText) ||
    /OPENAI_API_KEY is not configured/i.test(errorText)
  );
};

const postEquityFunctionJson = async <T = any>(functionPath: string, requestBody: unknown) => {
  const requestInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  };

  let response = await fetch(functionPath, requestInit);
  let payload = await readFunctionPayload(response, functionPath);
  let usedFallback = false;

  if (shouldRetryEquityFunctionRemotely(functionPath, response, payload)) {
    const fallbackOrigin = getEquityFunctionFallbackOrigin();
    if (fallbackOrigin) {
      const fallbackResponse = await fetch(`${fallbackOrigin}${functionPath}`, requestInit);
      const fallbackPayload = await readFunctionPayload(fallbackResponse, `${fallbackOrigin}${functionPath}`);

      if (fallbackResponse.ok || fallbackPayload.parsed) {
        response = fallbackResponse;
        payload = fallbackPayload;
        usedFallback = true;
      }
    }
  }

  if (!payload.parsed) {
    throw buildFunctionPayloadError(response, functionPath, payload);
  }

  return {
    ok: response.ok,
    status: response.status,
    result: payload.parsed as T,
    usedFallback,
  };
};

// Improved content formatter that properly handles markdown
const formatContentForPdf = (content: string): string => {
  // Normalize line endings
  let result = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Convert **bold** to <strong>
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Convert *italic* to <em>
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Convert headers (must be done before other processing)
  result = result.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  result = result.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  result = result.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  result = result.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  
  // Convert horizontal rules
  result = result.replace(/^---+$/gm, '<hr>');
  
  // Process the content line by line for better list handling
  const lines = result.split('\n');
  const processedLines: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Skip empty lines but close lists
    if (!trimmedLine) {
      if (inList) {
        processedLines.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
        listType = null;
      }
      processedLines.push('');
      continue;
    }
    
    // Check for bullet points (-, •, *, en-dash, em-dash). Allow missing space after marker.
    const bulletMatch = trimmedLine.match(/^([-•*]|–|—)\s*(.+)$/);
    if (bulletMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) processedLines.push(listType === 'ol' ? '</ol>' : '</ul>');
        processedLines.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      processedLines.push(`<li>${bulletMatch[2]}</li>`);
      continue;
    }
    
    // Check for numbered lists (supports 1. and 1) formats)
    const numberedMatch = trimmedLine.match(/^([0-9]+|[a-z]|[ivxlc]+)[\.\)]\s+(.+)$/i);
    if (numberedMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) processedLines.push(listType === 'ol' ? '</ol>' : '</ul>');
        const startAttr = /^\d+$/.test(numberedMatch[1]) ? ` start="${numberedMatch[1]}"` : '';
        processedLines.push(`<ol${startAttr}>`);
        inList = true;
        listType = 'ol';
      }
      processedLines.push(`<li>${numberedMatch[2]}</li>`);
      continue;
    }
    
    // Close list if we hit non-list content
    if (inList) {
      processedLines.push(listType === 'ol' ? '</ol>' : '</ul>');
      inList = false;
      listType = null;
    }
    
    // Pass through headers and hr unchanged
    if (trimmedLine.startsWith('<h') || trimmedLine === '<hr>') {
      processedLines.push(trimmedLine);
      continue;
    }
    
    // Regular text becomes a paragraph
    processedLines.push(`<p>${trimmedLine}</p>`);
  }
  
  // Close any open list
  if (inList) {
    processedLines.push(listType === 'ol' ? '</ol>' : '</ul>');
  }
  
  // Join and clean up
  result = processedLines.join('\n');
  
  // Remove empty paragraphs
  result = result.replace(/<p><\/p>/g, '');
  
  // Merge consecutive empty lines
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result;
};

// Generate exhibits HTML for PDF
const generateExhibitsHtml = (exhibits: EquityDocument[]): string => {
  if (!exhibits.length) return '';
  
  return exhibits.map((exhibit, index) => `
    <div class="exhibit" style="page-break-before: always;">
      <div class="exhibit-header" style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333;">
        <h2 style="font-size: 18pt; margin: 0;">EXHIBIT ${String.fromCharCode(65 + index)}</h2>
        <p style="font-size: 12pt; color: #666; margin-top: 8px;">${exhibit.title}</p>
      </div>
      <div class="exhibit-content">
        ${formatContentForPdf(exhibit.content)}
      </div>
    </div>
  `).join('\n');
};

// Equity documents are always legal-style (option agreements, EIPs, board consents, etc.)
// Note: Signature lines are controlled by the AI-generated document content itself (based on requiresSignature flag during generation)
const generatePdfFromEquityDoc = (document: EquityDocument, exhibits: EquityDocument[] = []) => {
  const exhibitsHtml = generateExhibitsHtml(exhibits);
  const hasExhibits = exhibits.length > 0;
  const documentTimestamp = document.updatedAt || document.createdAt;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${document.title} - Pulse Intelligence Labs</title>
        <style>
          @page { margin: 1in; }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #111;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 40px;
          }
          h1 {
            font-size: 18pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 24px;
            text-transform: uppercase;
            border-bottom: 2px solid #333;
            padding-bottom: 12px;
          }
          h2 { font-size: 14pt; font-weight: bold; margin-top: 24px; margin-bottom: 12px; }
          h3 { font-size: 12pt; font-weight: bold; margin-top: 18px; margin-bottom: 8px; }
          h4 { font-size: 12pt; font-weight: bold; margin-top: 14px; margin-bottom: 6px; }
          p { margin-bottom: 12px; text-align: justify; }
          .header { text-align: center; margin-bottom: 30px; }
          .company-name { font-size: 14pt; font-weight: bold; margin-bottom: 4px; }
          .document-date { font-size: 10pt; color: #666; margin-bottom: 20px; }
          ul, ol { margin: 12px 0; padding-left: 24px; }
          ul { list-style-type: disc; }
          ol { list-style-type: decimal; }
          li { margin-bottom: 8px; }
          hr { border: none; border-top: 1px solid #999; margin: 20px 0; }
          strong { font-weight: bold; }
          em { font-style: italic; }
          .exhibits-reference { margin-top: 40px; padding: 16px; border: 1px solid #ccc; }
          .exhibits-reference h3 { margin-top: 0; text-transform: uppercase; font-size: 12pt; }
          .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 9pt; color: #666; text-align: center; }
          .confidential { font-size: 9pt; color: #999; text-align: center; margin-top: 20px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">PULSE INTELLIGENCE LABS, INC.</div>
          <div class="document-date">Last Updated: ${formatDate(documentTimestamp)}</div>
        </div>
        <h1>${document.title}</h1>
        <div class="content">
          ${formatContentForPdf(document.content)}
        </div>

        ${hasExhibits ? `
          <div class="exhibits-reference">
            <h3>Exhibits</h3>
            <p>The following exhibits are attached hereto and incorporated herein by reference:</p>
            <ul>
              ${exhibits.map((ex, i) => `<li><strong>Exhibit ${String.fromCharCode(65 + i)}:</strong> ${ex.title}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="footer">
          <p>© ${new Date().getFullYear()} Pulse Intelligence Labs, Inc. All rights reserved.</p>
        </div>
        <div class="confidential">CONFIDENTIAL - This document contains proprietary information.</div>
        
        ${exhibitsHtml}
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};

const formatCurrency = (num: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
};

const formatPercentage = (num: number): string => {
  return `${num.toFixed(2)}%`;
};

const getStakeholderTypeConfig = (type: StakeholderType) => {
  return STAKEHOLDER_TYPES.find(t => t.id === type) || STAKEHOLDER_TYPES[0];
};

// ============================================================================
// COMPONENTS
// ============================================================================

// Floating Orb Background Component
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
      opacity: [0.2, 0.4, 0.2],
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
  hover?: boolean;
}> = ({ children, accentColor = '#E0FE10', className = '', onClick, hover = true }) => (
  <motion.div
    whileHover={hover ? { scale: 1.01, y: -2 } : undefined}
    onClick={onClick}
    className={`relative group ${onClick ? 'cursor-pointer' : ''} ${className}`}
  >
    <div 
      className="absolute -inset-1 rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-all duration-700"
      style={{ background: `linear-gradient(135deg, ${accentColor}40, transparent 60%)` }}
    />
    <div className="relative rounded-2xl overflow-hidden backdrop-blur-xl bg-zinc-900/60 border border-white/10">
      <div 
        className="absolute top-0 left-0 right-0 h-[1px] opacity-40"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
      {children}
    </div>
  </motion.div>
);

const AuditStatusBadge: React.FC<{ status: AuditResult['overallStatus']; score: number }> = ({ status, score }) => {
  const configs = {
    ready: { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-800', icon: CheckCircle, label: 'Ready to Send' },
    'needs-work': { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-800', icon: AlertTriangle, label: 'Needs Work' },
    'critical-issues': { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-800', icon: AlertCircle, label: 'Critical Issues' },
  } as const;
  const config = configs[status] || configs['needs-work'];
  const Icon = config.icon;
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 ${config.bg} ${config.text} rounded-lg border ${config.border}`}>
      <Icon className="w-5 h-5" />
      <div>
        <div className="font-semibold">{config.label}</div>
        <div className="text-xs opacity-75">Score: {score}/100</div>
      </div>
    </div>
  );
};

// Vesting Progress Bar Component
const VestingProgressBar: React.FC<{ 
  vested: number; 
  unvested: number; 
  color: string;
  showLabels?: boolean;
}> = ({ vested, unvested, color, showLabels = true }) => {
  const total = vested + unvested;
  const percentage = total > 0 ? (vested / total) * 100 : 0;
  
  return (
    <div className="w-full">
      {showLabels && (
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-zinc-400">
            {formatNumber(vested)} vested
          </span>
          <span className="text-zinc-500">
            {formatNumber(unvested)} unvested
          </span>
        </div>
      )}
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ 
            background: `linear-gradient(90deg, ${color}, ${color}80)`,
            boxShadow: `0 0 10px ${color}40`
          }}
        />
      </div>
      {showLabels && (
        <div className="text-right mt-1">
          <span className="text-xs font-medium" style={{ color }}>
            {percentage.toFixed(1)}% vested
          </span>
        </div>
      )}
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color: string;
  delay?: number;
}> = ({ icon, label, value, subValue, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="relative group"
  >
    <div 
      className="absolute inset-0 rounded-xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500"
      style={{ backgroundColor: `${color}30` }}
    />
    <div className="relative p-5 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-colors">
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <p className="text-zinc-500 text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subValue && <p className="text-xs text-zinc-500 mt-1">{subValue}</p>}
    </div>
  </motion.div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const EquityAdminPage: React.FC = () => {
  // State
  const [loading, setLoading] = useState(true);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [convertibleNotes, setConvertibleNotes] = useState<ConvertibleNote[]>([]);
  const [equityDocuments, setEquityDocuments] = useState<EquityDocument[]>([]);
  const [signingRequests, setSigningRequests] = useState<SigningRequest[]>([]);
  const [equityPool, setEquityPool] = useState<EquityPool>({
    totalReserved: DEFAULT_CAP_TABLE.equityPool.totalReserved,
    granted: 0,
    exercised: 0,
    available: DEFAULT_CAP_TABLE.equityPool.totalReserved,
  });
  const [capTableSummary, setCapTableSummary] = useState<CapTableSummary>({
    totalAuthorizedShares: DEFAULT_CAP_TABLE.authorizedShares,
    totalIssuedShares: 0,
    totalReservedOptions: DEFAULT_CAP_TABLE.equityPool.totalReserved,
    totalAvailable: DEFAULT_CAP_TABLE.authorizedShares,
    founderShares: 0,
    employeeOptions: DEFAULT_CAP_TABLE.equityPool.totalReserved,
    advisorShares: 0,
    investorShares: 0,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'stakeholders' | 'grants' | 'documents'>('overview');
  const [seeding, setSeeding] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [deletingEquityDocId, setDeletingEquityDocId] = useState<string | null>(null);
  
  // Modal States
  const [isAddStakeholderModalOpen, setIsAddStakeholderModalOpen] = useState(false);
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [expandedStakeholder, setExpandedStakeholder] = useState<string | null>(null);
  const [expandedEquityDoc] = useState<string | null>(null);
  const [isEditEquityDocModalOpen, setIsEditEquityDocModalOpen] = useState(false);
  const [editingEquityDoc, setEditingEquityDoc] = useState<EquityDocument | null>(null);
  const [editEquityDocTitle, setEditEquityDocTitle] = useState('');
  const [editEquityDocPrompt, setEditEquityDocPrompt] = useState('');
  const [editRequiresSignature, setEditRequiresSignature] = useState(false);
  const [isRevisingEquityDoc, setIsRevisingEquityDoc] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditingEquityDoc, setAuditingEquityDoc] = useState<EquityDocument | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isDocHistoryModalOpen, setIsDocHistoryModalOpen] = useState(false);
  const [docHistoryAnchor, setDocHistoryAnchor] = useState<EquityDocument | null>(null);
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
  const [signingDoc, setSigningDoc] = useState<EquityDocument | null>(null);
  const [signers, setSigners] = useState<SignerRow[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [signingModalStatus, setSigningModalStatus] = useState<InlineStatus | null>(null);
  const [previewRecipientName, setPreviewRecipientName] = useState('');
  const [previewRecipientEmail, setPreviewRecipientEmail] = useState('');

  // Exhibits Modal State
  const [isExhibitsModalOpen, setIsExhibitsModalOpen] = useState(false);
  const [exhibitsDocument, setExhibitsDocument] = useState<EquityDocument | null>(null);
  const [selectedExhibits, setSelectedExhibits] = useState<string[]>([]);
  const [isSavingExhibits, setIsSavingExhibits] = useState(false);

  // Board Consent verification state (per stakeholder)
  const [boardConsentSelection, setBoardConsentSelection] = useState<Record<string, string>>({});
  const [boardConsentVerification, setBoardConsentVerification] = useState<Record<string, { status: 'idle' | 'verifying' | 'verified' | 'failed'; approvalDate?: string; issues?: string[] }>>({});

  // Edit Grant Terms state
  const [editingGrantStakeholderId, setEditingGrantStakeholderId] = useState<string | null>(null);
  const [editGrantOptionsValue, setEditGrantOptionsValue] = useState<number>(0);
  const [editGrantDateValue, setEditGrantDateValue] = useState(new Date().toISOString().split('T')[0]);
  const [isSavingGrantOptions, setIsSavingGrantOptions] = useState(false);
  
  // Form States
  const [newStakeholder, setNewStakeholder] = useState({
    name: '',
    email: '',
    type: 'employee' as StakeholderType,
    title: '',
    startDate: new Date().toISOString().split('T')[0],
    // Advisor NSO grant details (used when type === 'advisor')
    advisorShares: 10000,
    advisorVestingMonths: 24,
    advisorCliffMonths: 3,
    // Board consent linkage
    boardConsentDocId: '' as string,
  });
  
  const [newGrant, setNewGrant] = useState({
    equityType: 'nso' as EquityType,
    numberOfShares: 0,
    strikePrice: 0.001,
    vestingSchedule: '4-year-1-cliff' as VestingSchedule,
    vestingStartDate: new Date().toISOString().split('T')[0],
    cliffMonths: 12,
    vestingMonths: 48,
  });
  
  const [generating, setGenerating] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState('option_agreement');
  const requiresStakeholderForDoc = selectedDocType !== 'eip';
  const selectedDocIsAutoExecuted = isAutoExecutedCompanyDocType(selectedDocType);
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [requiresSignatureChecked, setRequiresSignatureChecked] = useState(false);

  useEffect(() => {
    // Reasonable defaults (user can override):
    // - Most people-facing agreements should be signable.
    // - Internal plan approvals are auto-executed in-app and should not open e-sign.
    const defaultOn = ['option_agreement', 'fast_agreement'].includes(selectedDocType);
    const defaultForType = selectedDocIsAutoExecuted ? false : defaultOn;
    setRequiresSignatureChecked(defaultForType);
  }, [selectedDocIsAutoExecuted, selectedDocType]);

  useEffect(() => {
    // EIP is company-wide; clear any previously selected stakeholder to avoid confusion.
    if (selectedDocType === 'eip') {
      setSelectedStakeholder(null);
    }
  }, [selectedDocType]);

  // Seed default cap table data
  const seedDefaultData = async () => {
    setSeeding(true);
    try {
      // Check if founder already exists
      const existingFounder = stakeholders.find(s => s.email === DEFAULT_CAP_TABLE.founder.email);
      if (existingFounder) {
        setMessage({ type: 'info', text: 'Cap table data already exists' });
        setSeeding(false);
        return;
      }

      // Add founder (Tremaine Grant)
      const founderData = {
        name: DEFAULT_CAP_TABLE.founder.name,
        email: DEFAULT_CAP_TABLE.founder.email,
        type: DEFAULT_CAP_TABLE.founder.type,
        title: DEFAULT_CAP_TABLE.founder.title,
        startDate: DEFAULT_CAP_TABLE.founder.startDate,
        createdAt: serverTimestamp(),
        grants: [],
        totalShares: DEFAULT_CAP_TABLE.founder.shares,
        totalVested: DEFAULT_CAP_TABLE.founder.shares, // Assuming vested for now based on timeline
        totalUnvested: 0,
        ownershipPercentage: DEFAULT_CAP_TABLE.founder.ownershipPercentage,
        documents: [],
        notes: DEFAULT_CAP_TABLE.founder.notes,
        vestingSchedule: DEFAULT_CAP_TABLE.founder.vestingSchedule,
        cliffMonths: DEFAULT_CAP_TABLE.founder.cliffMonths,
        vestingMonths: DEFAULT_CAP_TABLE.founder.vestingMonths,
      };
      await addDoc(collection(db, 'equity-stakeholders'), founderData);

      // Create the Equity Pool (separate from stakeholders - it's a reserve ledger)
      const poolData = {
        totalReserved: DEFAULT_CAP_TABLE.equityPool.totalReserved,
        granted: DEFAULT_CAP_TABLE.equityPool.granted,
        exercised: DEFAULT_CAP_TABLE.equityPool.exercised,
        available: DEFAULT_CAP_TABLE.equityPool.available,
        notes: DEFAULT_CAP_TABLE.equityPool.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'equity-pool'), poolData);

      // Add convertible notes
      for (const note of DEFAULT_CAP_TABLE.convertibleNotes) {
        await addDoc(collection(db, 'equity-convertible-notes'), {
          holderName: note.holderName,
          holderType: note.holderType,
          principal: note.principal,
          status: note.status,
          notes: note.notes,
          createdAt: serverTimestamp(),
        });
      }

      setMessage({ type: 'success', text: 'Cap table initialized with default data!' });
      loadData();
    } catch (error) {
      console.error('Error seeding data:', error);
      setMessage({ type: 'error', text: 'Failed to seed cap table data' });
    } finally {
      setSeeding(false);
    }
  };

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load stakeholders (filter out any legacy "pool" entries)
      const q = query(
        collection(db, 'equity-stakeholders'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const stakeholderData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter((s: any) => !s.isReservedPool) as Stakeholder[]; // Filter out legacy pool entries
      
      setStakeholders(stakeholderData);

      // Calculate total options granted to stakeholders (this comes from the pool)
      const totalGrantedOptions = stakeholderData.reduce((sum, sh) => {
        // Only count options (advisors, employees, contractors with option grants)
        if (['advisor', 'employee', 'contractor'].includes(sh.type)) {
          return sum + (sh.optionsGranted || sh.totalShares || 0);
        }
        return sum;
      }, 0);

      // Load equity pool (separate from stakeholders)
      try {
        const poolQuery = query(collection(db, 'equity-pool'));
        const poolSnapshot = await getDocs(poolQuery);
        if (!poolSnapshot.empty) {
          const poolDoc = poolSnapshot.docs[0];
          const poolData = poolDoc.data() as EquityPool;
          // Calculate available based on what's actually granted
          const granted = totalGrantedOptions;
          const exercised = poolData.exercised || 0;
          const available = poolData.totalReserved - granted - exercised;
          
          setEquityPool({
            id: poolDoc.id,
            totalReserved: poolData.totalReserved,
            granted,
            exercised,
            available: Math.max(0, available),
          });
        } else {
          // No pool in DB yet, calculate from defaults
          const available = DEFAULT_CAP_TABLE.equityPool.totalReserved - totalGrantedOptions;
          setEquityPool({
            totalReserved: DEFAULT_CAP_TABLE.equityPool.totalReserved,
            granted: totalGrantedOptions,
            exercised: 0,
            available: Math.max(0, available),
          });
        }
      } catch {
        // Pool collection might not exist yet, use defaults with calculated grants
        const available = DEFAULT_CAP_TABLE.equityPool.totalReserved - totalGrantedOptions;
        setEquityPool({
          totalReserved: DEFAULT_CAP_TABLE.equityPool.totalReserved,
          granted: totalGrantedOptions,
          exercised: 0,
          available: Math.max(0, available),
        });
      }

      // Load convertible notes
      try {
        const notesQuery = query(
          collection(db, 'equity-convertible-notes'),
          orderBy('createdAt', 'desc')
        );
        const notesSnapshot = await getDocs(notesQuery);
        const notesData = notesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ConvertibleNote[];
        setConvertibleNotes(notesData);
      } catch {
        // Collection might not exist yet
        setConvertibleNotes([]);
      }

      // Load equity documents
      try {
        const docsQuery = query(
          collection(db, 'equity-documents'),
          orderBy('createdAt', 'desc')
        );
        const docsSnapshot = await getDocs(docsQuery);
        const docsData = docsSnapshot.docs.map(d => ({
          ...d.data(),
          id: d.id
        })) as EquityDocument[];
        setEquityDocuments(docsData);
      } catch {
        setEquityDocuments([]);
      }

      // Load signing requests linked to equity docs
      try {
        const q = query(
          collection(db, 'signingRequests'),
          where('equityDocumentId', '!=', null),
          orderBy('equityDocumentId'),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const reqs = snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as SigningRequest[];
        setSigningRequests(reqs);
      } catch {
        // Fallback when compound index isn't available
        try {
          const fallbackQ = query(collection(db, 'signingRequests'), orderBy('createdAt', 'desc'));
          const fallbackSnapshot = await getDocs(fallbackQ);
          const reqs = fallbackSnapshot.docs
            .map(d => ({ ...d.data(), id: d.id } as SigningRequest))
            .filter(r => Boolean((r as any).equityDocumentId));
          setSigningRequests(reqs);
        } catch {
          setSigningRequests([]);
        }
      }
      
      // Calculate cap table summary
      // IMPORTANT: Options are NOT issued shares - they come from the pool
      // Only count actual shares (founder stock, exercised options, direct grants)
      let totalIssuedShares = 0;  // Actual shares issued
      let founderShares = 0;
      let advisorOptions = 0;
      let investorShares = 0;
      
      stakeholderData.forEach(sh => {
        switch (sh.type) {
          case 'founder': 
            // Founders have actual shares (issued stock)
            const fShares = sh.sharesOwned || sh.totalShares || 0;
            founderShares += fShares;
            totalIssuedShares += fShares;
            break;
          case 'employee': 
            // Employees typically have options (not issued shares yet)
            break;
          case 'advisor': 
            // Advisors typically have options (not issued shares yet)
            const advOpts = sh.optionsGranted || sh.totalShares || 0;
            advisorOptions += advOpts;
            break;
          case 'investor': 
            // Investors have actual shares
            const invShares = sh.sharesOwned || sh.totalShares || 0;
            investorShares += invShares;
            totalIssuedShares += invShares;
            break;
        }
      });
      
      // Available = Total Authorized - Issued Shares - Pool Reserved
      // The pool is reserved but options granted from it don't affect "available" at the company level
      const poolReserved = DEFAULT_CAP_TABLE.equityPool.totalReserved;
      const available = DEFAULT_CAP_TABLE.authorizedShares - totalIssuedShares - poolReserved;
      
      setCapTableSummary(prev => ({
        ...prev,
        totalIssuedShares: totalIssuedShares,
        totalAvailable: available,
        founderShares,
        employeeOptions: poolReserved, // Show the pool size, not granted options
        advisorShares: advisorOptions,
        investorShares,
      }));
      
    } catch (error) {
      console.error('Error loading equity data:', error);
      setMessage({ type: 'error', text: 'Failed to load equity data' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createAdvisorBoardConsentDocument = async ({
    stakeholderId,
    stakeholderName,
    stakeholderEmail,
    grantDetails,
  }: {
    stakeholderId: string;
    stakeholderName: string;
    stakeholderEmail: string;
    grantDetails: {
      equityType: string;
      numberOfShares: number;
      strikePrice: number;
      vestingSchedule: string;
      vestingStartDate: string | Date | Timestamp;
      cliffMonths: number;
      vestingMonths: number;
    };
  }) => {
    const docTitle = `Board Consent - ${stakeholderName}`;
    const createdAt = Timestamp.now();
    const boardApprovalDate = formatDate(createdAt);
    const placeholder = await addDoc(collection(db, 'equity-documents'), {
      title: docTitle,
      prompt: `Generate a Board Consent approving equity grant for ${stakeholderName}: ${grantDetails.numberOfShares} Non-Qualified Stock Options with ${grantDetails.vestingMonths} month vesting and ${grantDetails.cliffMonths} month cliff.`,
      content: '',
      documentType: 'board_consent',
      requiresSignature: false,
      stakeholderId,
      stakeholderName,
      stakeholderEmail,
      stakeholderType: 'advisor',
      grantDetails,
      autoSigned: true,
      autoSignedAt: createdAt,
      createdAt,
      status: 'generating',
    });

    try {
      const { result } = await postEquityFunctionJson('/.netlify/functions/generate-equity-document', {
        stakeholderId,
        stakeholderName,
        stakeholderEmail,
        stakeholderType: 'advisor',
        documentType: 'board_consent',
        requiresSignature: false,
        prompt: `Generate a Board Consent (Written Consent of the Board of Directors in Lieu of Meeting) approving equity grant for ${stakeholderName}: ${grantDetails.numberOfShares} Non-Qualified Stock Options with ${grantDetails.vestingMonths} month vesting and ${grantDetails.cliffMonths} month cliff.`,
        grantDetails,
      });

      if (!result.success || !result.content) {
        throw new Error(result.error || 'Failed to generate Board Consent');
      }

      await updateDoc(doc(db, 'equity-documents', placeholder.id), {
        content: result.content,
        title: result.title || docTitle,
        requiresSignature: false,
        autoSigned: true,
        autoSignedAt: serverTimestamp(),
        signingRequestId: deleteField(),
        signingRequestIds: deleteField(),
        needsResendSignature: false,
        status: 'completed',
        updatedAt: serverTimestamp(),
      });

      return {
        id: placeholder.id,
        title: result.title || docTitle,
        boardApprovalDate,
      };
    } catch (error: any) {
      await updateDoc(doc(db, 'equity-documents', placeholder.id), {
        status: 'error',
        errorMessage: error?.message || 'Failed to generate Board Consent',
        updatedAt: serverTimestamp(),
      });
      throw error;
    }
  };

  const createAdvisorAgreementDocument = async ({
    stakeholderId,
    stakeholderName,
    stakeholderEmail,
    grantDetails,
    boardApprovalDate,
  }: {
    stakeholderId: string;
    stakeholderName: string;
    stakeholderEmail: string;
    grantDetails: {
      equityType: string;
      numberOfShares: number;
      strikePrice: number;
      vestingSchedule: string;
      vestingStartDate: string | Date | Timestamp;
      cliffMonths: number;
      vestingMonths: number;
    };
    boardApprovalDate?: string;
  }) => {
    const docTitle = `Advisor Agreement + NSO Grant - ${stakeholderName}`;
    const placeholder = await addDoc(collection(db, 'equity-documents'), {
      title: docTitle,
      prompt: `Generate a combined Advisor Agreement and Non-Qualified Stock Option Grant for ${stakeholderName}`,
      content: '',
      documentType: 'advisor_nso_agreement',
      requiresSignature: true,
      stakeholderId,
      stakeholderName,
      stakeholderEmail,
      stakeholderType: 'advisor',
      grantDetails,
      createdAt: Timestamp.now(),
      status: 'generating',
    });

    try {
      const { result } = await postEquityFunctionJson('/.netlify/functions/generate-equity-document', {
        stakeholderId,
        stakeholderName,
        stakeholderEmail,
        stakeholderType: 'advisor',
        documentType: 'advisor_nso_agreement',
        requiresSignature: true,
        boardApprovalDate: boardApprovalDate || undefined,
        prompt: `Generate a combined Advisor Services Agreement and Non-Qualified Stock Option Grant (do not label as FAST unless explicitly requested).`,
        grantDetails,
      });

      if (!result.success || !result.content) {
        throw new Error(result.error || 'Failed to generate Advisor Agreement');
      }

      await updateDoc(doc(db, 'equity-documents', placeholder.id), {
        content: result.content,
        title: result.title || docTitle,
        status: 'completed',
        updatedAt: serverTimestamp(),
      });

      return {
        id: placeholder.id,
        title: result.title || docTitle,
      };
    } catch (error: any) {
      await updateDoc(doc(db, 'equity-documents', placeholder.id), {
        status: 'error',
        errorMessage: error?.message || 'Failed to generate Advisor Agreement',
        updatedAt: serverTimestamp(),
      });
      throw error;
    }
  };

  // Add Stakeholder
  const handleAddStakeholder = async () => {
    if (!newStakeholder.name.trim() || !newStakeholder.email.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }
    
    setGenerating(true);
    try {
      const isAdvisor = newStakeholder.type === 'advisor';
      const hasOptionGrant = isAdvisor && newStakeholder.advisorShares > 0;
      const stakeholderName = newStakeholder.name.trim();
      const stakeholderEmail = newStakeholder.email.toLowerCase().trim();
      const grantDetails = {
        equityType: 'nso',
        numberOfShares: newStakeholder.advisorShares,
        strikePrice: 0.001,
        vestingSchedule: 'monthly',
        vestingStartDate: newStakeholder.startDate,
        cliffMonths: newStakeholder.advisorCliffMonths,
        vestingMonths: newStakeholder.advisorVestingMonths,
      };
      
      // Get board consent date if linked
      const linkedBoardConsent = newStakeholder.boardConsentDocId 
        ? equityDocuments.find(d => d.id === newStakeholder.boardConsentDocId)
        : null;
      const boardApprovalDate = linkedBoardConsent 
        ? formatDate(linkedBoardConsent.createdAt)
        : null;
      
      const stakeholderData = {
        name: stakeholderName,
        email: stakeholderEmail,
        type: newStakeholder.type,
        title: newStakeholder.title.trim(),
        startDate: new Date(newStakeholder.startDate),
        createdAt: serverTimestamp(),
        grants: hasOptionGrant ? [{
          ...grantDetails,
          grantDate: newStakeholder.startDate,
          status: 'active',
        }] : [],
        // For option holders, use optionsGranted (not shares - they don't own shares until exercise)
        optionsGranted: hasOptionGrant ? newStakeholder.advisorShares : 0,
        optionsVested: 0,
        optionsUnvested: hasOptionGrant ? newStakeholder.advisorShares : 0,
        optionsExercised: 0,
        // Actual shares owned (only after exercise or if directly issued)
        sharesOwned: 0,
        documents: [],
        // Board consent linkage
        boardConsentDocId: newStakeholder.boardConsentDocId || null,
        boardApprovalDate: boardApprovalDate || null,
      };
      
      const stakeholderRef = await addDoc(collection(db, 'equity-stakeholders'), stakeholderData);
      
      // Update the equity pool if we're granting options
      if (hasOptionGrant && equityPool.id) {
        const newGranted = equityPool.granted + newStakeholder.advisorShares;
        const newAvailable = equityPool.totalReserved - newGranted - equityPool.exercised;
        
        await updateDoc(doc(db, 'equity-pool', equityPool.id), {
          granted: newGranted,
          available: newAvailable,
          updatedAt: serverTimestamp(),
        });
      }
      
      // Advisors with grants should always have the required board consent and advisor agreement.
      if (isAdvisor && hasOptionGrant) {
        setMessage({ type: 'info', text: 'Stakeholder added. Generating the required advisor documents...' });

        let resolvedBoardConsentId = newStakeholder.boardConsentDocId || null;
        let resolvedBoardApprovalDate = boardApprovalDate;

        if (!resolvedBoardConsentId) {
          const generatedBoardConsent = await createAdvisorBoardConsentDocument({
            stakeholderId: stakeholderRef.id,
            stakeholderName,
            stakeholderEmail,
            grantDetails,
          });

          resolvedBoardConsentId = generatedBoardConsent.id;
          resolvedBoardApprovalDate = generatedBoardConsent.boardApprovalDate;

          await updateDoc(doc(db, 'equity-stakeholders', stakeholderRef.id), {
            boardConsentDocId: resolvedBoardConsentId,
            boardApprovalDate: resolvedBoardApprovalDate,
            updatedAt: serverTimestamp(),
          });
        }

        await createAdvisorAgreementDocument({
          stakeholderId: stakeholderRef.id,
          stakeholderName,
          stakeholderEmail,
          grantDetails,
          boardApprovalDate: resolvedBoardApprovalDate || undefined,
        });

        setMessage({ type: 'success', text: 'Advisor added and required documents generated.' });
      } else if (isAdvisor) {
        setMessage({ type: 'success', text: 'Advisor added successfully. Add an option grant to generate the required documents.' });
      } else {
        setMessage({ type: 'success', text: 'Stakeholder added successfully!' });
      }
      
      setIsAddStakeholderModalOpen(false);
      setNewStakeholder({
        name: '',
        email: '',
        type: 'employee',
        title: '',
        startDate: new Date().toISOString().split('T')[0],
        advisorShares: 10000,
        advisorVestingMonths: 24,
        advisorCliffMonths: 3,
        boardConsentDocId: '',
      });
      loadData();
    } catch (error) {
      console.error('Error adding stakeholder:', error);
      setMessage({ type: 'error', text: 'Failed to add stakeholder' });
    } finally {
      setGenerating(false);
    }
  };

  // Generate Board Consent for an advisor and auto-attach it
  const handleGenerateBoardConsent = async (stakeholder: Stakeholder) => {
    if (stakeholder.type !== 'advisor') {
      setMessage({ type: 'error', text: 'This function is only for advisors' });
      return;
    }

    setGenerating(true);
    
    // Get grant details from the stakeholder's first grant (if any)
    const grant = stakeholder.grants?.[0];
    const grantDetails = grant ? {
      equityType: grant.equityType || 'nso',
      numberOfShares: grant.numberOfShares || stakeholder.optionsGranted || stakeholder.totalShares || 10000,
      strikePrice: grant.strikePrice || 0.001,
      vestingSchedule: grant.vestingSchedule || 'monthly',
      vestingStartDate: grant.vestingStartDate || stakeholder.startDate,
      cliffMonths: grant.cliffMonths || 3,
      vestingMonths: grant.vestingMonths || 24,
    } : {
      equityType: 'nso',
      numberOfShares: stakeholder.optionsGranted || stakeholder.totalShares || 10000,
      strikePrice: 0.001,
      vestingSchedule: 'monthly',
      vestingStartDate: stakeholder.startDate,
      cliffMonths: 3,
      vestingMonths: 24,
    };

    try {
      const docTitle = `Board Consent - ${stakeholder.name}`;
      
      // Check if there's an existing board consent document for this advisor
      const existingBoardConsent = equityDocuments.find(d => 
        d.stakeholderId === stakeholder.id && 
        d.documentType === 'board_consent' &&
        d.status === 'completed'
      );
      
      let documentId: string;
      
      if (existingBoardConsent) {
        // Update existing document instead of creating a new one
        documentId = existingBoardConsent.id;

        const existingBoardSigningRequests = getSigningRequestsForEquityDoc(existingBoardConsent.id);
        if (existingBoardSigningRequests.length > 0) {
          await invalidateSigningRequestsForDoc(
            existingBoardConsent,
            `Invalidated because the Board Consent for ${stakeholder.name} was regenerated as an auto-executed sole-director consent.`
          );
        }
        
        // Update the existing document to generating status
        await updateDoc(doc(db, 'equity-documents', documentId), {
          requiresSignature: false,
          autoSigned: true,
          autoSignedAt: Timestamp.now(),
          signingRequestId: deleteField(),
          signingRequestIds: deleteField(),
          needsResendSignature: false,
          status: 'generating',
          updatedAt: Timestamp.now(),
        });
        
        setMessage({ type: 'info', text: 'Regenerating Board Consent...' });
      } else {
        // Create new placeholder doc in Firestore
        const placeholder = await addDoc(collection(db, 'equity-documents'), {
          title: docTitle,
          prompt: `Generate a Board Consent approving equity grant for ${stakeholder.name}: ${grantDetails.numberOfShares} Non-Qualified Stock Options with ${grantDetails.vestingMonths} month vesting and ${grantDetails.cliffMonths} month cliff.`,
          content: '',
          documentType: 'board_consent',
          requiresSignature: false,
          stakeholderId: stakeholder.id,
          stakeholderName: stakeholder.name,
          stakeholderEmail: stakeholder.email,
          stakeholderType: 'advisor',
          grantDetails,
          autoSigned: true,
          autoSignedAt: Timestamp.now(),
          createdAt: Timestamp.now(),
          status: 'generating',
        });
        documentId = placeholder.id;
        setMessage({ type: 'info', text: 'Generating Board Consent...' });
      }

      // Call API to generate document
      const { result } = await postEquityFunctionJson('/.netlify/functions/generate-equity-document', {
        stakeholderId: stakeholder.id,
        stakeholderName: stakeholder.name,
        stakeholderEmail: stakeholder.email,
        stakeholderType: 'advisor',
        documentType: 'board_consent',
        requiresSignature: false,
        prompt: `Generate a Board Consent (Written Consent of the Board of Directors in Lieu of Meeting) approving equity grant for ${stakeholder.name}: ${grantDetails.numberOfShares} Non-Qualified Stock Options with ${grantDetails.vestingMonths} month vesting and ${grantDetails.cliffMonths} month cliff.`,
        grantDetails,
      });

      if (result.success && result.content) {
        await updateDoc(doc(db, 'equity-documents', documentId), {
          content: result.content,
          title: result.title || docTitle,
          requiresSignature: false,
          autoSigned: true,
          autoSignedAt: Timestamp.now(),
          signingRequestId: deleteField(),
          signingRequestIds: deleteField(),
          needsResendSignature: false,
          status: 'completed',
          updatedAt: Timestamp.now(),
        });
        
        // Auto-attach the generated board consent to the advisor
        setBoardConsentSelection(prev => ({ ...prev, [stakeholder.id]: documentId }));
        
        // Reset verification state since we're regenerating
        setBoardConsentVerification(prev => ({ ...prev, [stakeholder.id]: { status: 'idle' } }));
        
        // Refresh data to get the updated document
        await loadData();
        
        // Auto-verify and link the board consent after data is loaded
        // Use a small delay to ensure state is updated
        setTimeout(async () => {
          try {
            // Get the updated document from Firestore to ensure we have the latest content
            const docRef = doc(db, 'equity-documents', documentId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const newDoc = { id: docSnap.id, ...docSnap.data() } as EquityDocument;
              // Temporarily add to equityDocuments array for verification
              setEquityDocuments(prev => {
                const filtered = prev.filter(d => d.id !== documentId);
                return [newDoc, ...filtered];
              });
              await verifyAndLinkBoardConsent(stakeholder, documentId);
            }
          } catch (error) {
            console.error('Error auto-verifying board consent:', error);
            // If auto-verification fails, just select it and let user verify manually
            setMessage({ type: 'info', text: 'Board Consent regenerated. Please click Verify to link it.' });
          }
        }, 300);
        
        setMessage({ type: 'success', text: existingBoardConsent ? 'Board Consent regenerated, auto-executed, and attached! Verifying...' : 'Board Consent generated, auto-executed, and attached! Verifying...' });
      } else {
        await updateDoc(doc(db, 'equity-documents', documentId), {
          status: 'error',
          errorMessage: result.error || 'Failed to generate document',
        });
        setMessage({ type: 'error', text: result.error || 'Failed to generate document' });
      }
    } catch (error) {
      console.error('Error generating board consent:', error);
      setMessage({ type: 'error', text: 'Failed to generate Board Consent' });
    } finally {
      setGenerating(false);
    }
  };

  // Generate Advisor Agreement + NSO Grant directly for an advisor
  const handleGenerateAdvisorAgreement = async (stakeholder: Stakeholder) => {
    if (stakeholder.type !== 'advisor') {
      setMessage({ type: 'error', text: 'This function is only for advisors' });
      return;
    }

    // Require a VERIFIED Board Consent before generating
    const verification = boardConsentVerification[stakeholder.id];
    if (verification?.status !== 'verified' || !verification.approvalDate) {
      setMessage({ type: 'error', text: 'Board Consent must be linked and verified before generating. Select a Board Consent below and click Verify.' });
      return;
    }

    setGenerating(true);
    
    // Get grant details from the stakeholder's first grant (if any)
    const grant = stakeholder.grants?.[0];
    const grantDetails = grant ? {
      equityType: grant.equityType || 'nso',
      numberOfShares: grant.numberOfShares || stakeholder.optionsGranted || stakeholder.totalShares || 10000,
      strikePrice: grant.strikePrice || 0.001,
      vestingSchedule: grant.vestingSchedule || 'monthly',
      vestingStartDate: grant.vestingStartDate || stakeholder.startDate,
      cliffMonths: grant.cliffMonths || 3,
      vestingMonths: grant.vestingMonths || 24,
    } : {
      equityType: 'nso',
      numberOfShares: stakeholder.optionsGranted || stakeholder.totalShares || 10000,
      strikePrice: 0.001,
      vestingSchedule: 'monthly',
      vestingStartDate: stakeholder.startDate,
      cliffMonths: 3,
      vestingMonths: 24,
    };

    const boardApprovalDate = verification.approvalDate;

    try {
      const docTitle = `Advisor Agreement + NSO Grant - ${stakeholder.name}`;
      
      // Create placeholder doc in Firestore
      const placeholder = await addDoc(collection(db, 'equity-documents'), {
        title: docTitle,
        prompt: `Generate a combined Advisor Agreement and Non-Qualified Stock Option Grant for ${stakeholder.name}`,
        content: '',
        documentType: 'advisor_nso_agreement',
        requiresSignature: true,
        stakeholderId: stakeholder.id,
        stakeholderName: stakeholder.name,
        stakeholderEmail: stakeholder.email,
        stakeholderType: 'advisor',
        grantDetails,
        createdAt: Timestamp.now(),
        status: 'generating',
      });

      setMessage({ type: 'info', text: 'Generating Advisor Agreement + NSO Grant...' });

      // Call API to generate document
      const { result } = await postEquityFunctionJson('/.netlify/functions/generate-equity-document', {
        stakeholderId: stakeholder.id,
        stakeholderName: stakeholder.name,
        stakeholderEmail: stakeholder.email,
        stakeholderType: 'advisor',
        documentType: 'advisor_nso_agreement',
        requiresSignature: true,
        boardApprovalDate: boardApprovalDate || undefined,
        prompt: `Generate a combined Advisor Services Agreement and Non-Qualified Stock Option Grant (do not label as FAST unless explicitly requested).`,
        grantDetails,
      });

      if (result.success && result.content) {
        await updateDoc(doc(db, 'equity-documents', placeholder.id), {
          content: result.content,
          title: result.title || docTitle,
          status: 'completed',
          updatedAt: Timestamp.now(),
        });
        setMessage({ type: 'success', text: 'Advisor Agreement generated! Ready for signature.' });
        loadData(); // Refresh to show the new document
        setActiveTab('documents'); // Switch to documents tab to show it
      } else {
        await updateDoc(doc(db, 'equity-documents', placeholder.id), {
          status: 'error',
          errorMessage: result.error || 'Failed to generate document',
        });
        setMessage({ type: 'error', text: result.error || 'Failed to generate document' });
      }
    } catch (error) {
      console.error('Error generating advisor agreement:', error);
      setMessage({ type: 'error', text: 'Failed to generate document' });
    } finally {
      setGenerating(false);
    }
  };

  // Generate Document
  const handleGenerateDocument = async () => {
    if (requiresStakeholderForDoc && !selectedStakeholder) {
      setMessage({ type: 'error', text: 'Please select a stakeholder' });
      return;
    }
    
    setGenerating(true);
    try {
      const docTypeConfig = DOCUMENT_TYPES.find(d => d.id === selectedDocType);
      const effectiveRequiresSignature = selectedDocIsAutoExecuted ? false : Boolean(requiresSignatureChecked);
      const shouldAutoExecuteDoc = selectedDocIsAutoExecuted;
      const documentExecutionDate = formatLegalDate(new Date());

      // Create placeholder doc in Firestore (like legalDocuments.tsx)
      const placeholder = await addDoc(collection(db, 'equity-documents'), {
        title: `${docTypeConfig?.label || 'Equity Document'} - ${new Date().toLocaleDateString()}`,
        prompt: generationPrompt,
        content: '',
        documentType: selectedDocType,
        requiresSignature: effectiveRequiresSignature,
        stakeholderId: selectedStakeholder?.id ?? null,
        stakeholderName: selectedStakeholder?.name ?? null,
        stakeholderEmail: selectedStakeholder?.email ?? null,
        stakeholderType: selectedStakeholder?.type ?? null,
        grantDetails: newGrant,
        ...(shouldAutoExecuteDoc ? { autoSigned: true, autoSignedAt: Timestamp.now() } : {}),
        createdAt: Timestamp.now(),
        status: 'generating',
      });
      
      // Call API to generate document
      const { ok, result } = await postEquityFunctionJson('/.netlify/functions/generate-equity-document', {
        stakeholderId: selectedStakeholder?.id,
        stakeholderName: selectedStakeholder?.name,
        stakeholderEmail: selectedStakeholder?.email,
        stakeholderType: selectedStakeholder?.type,
        documentType: selectedDocType,
        prompt: generationPrompt,
        requiresSignature: effectiveRequiresSignature,
        boardApprovalDate: selectedDocType === 'board_consent' ? documentExecutionDate : undefined,
        documentDate: shouldAutoExecuteDoc ? documentExecutionDate : undefined,
        grantDetails: newGrant,
        documentId: placeholder.id,
      });

      if (!ok) {
        throw new Error(result.error || 'Failed to generate document');
      }

      // Update Firestore doc with generated output
      await updateDoc(doc(db, 'equity-documents', placeholder.id), {
        title: result.title || `${docTypeConfig?.label || 'Equity Document'} - ${new Date().toLocaleDateString()}`,
        content: result.content,
        requiresSignature: effectiveRequiresSignature,
        ...(shouldAutoExecuteDoc ? { autoSigned: true, autoSignedAt: Timestamp.now() } : {}),
        status: 'completed',
        updatedAt: Timestamp.now(),
      });

      setMessage({
        type: 'success',
        text: shouldAutoExecuteDoc
          ? `${docTypeConfig?.label || 'Document'} generated and auto-executed successfully!`
          : `${docTypeConfig?.label || 'Document'} generated successfully!`,
      });
      setGenerationPrompt('');
      loadData();
    } catch (error) {
      console.error('Error generating document:', error);
      // best effort: if placeholder exists, mark error
      try {
        // no-op if we can't identify placeholder
      } catch {}
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to generate document' });
    } finally {
      setGenerating(false);
    }
  };

  const openEditEquityDocModal = (docToEdit: EquityDocument) => {
    if (isEquityDocLockedForEditing(docToEdit)) {
      setMessage({
        type: 'info',
        text: 'This signed advisor document is locked. To change economics after signature, create a separate new equity grant for this stakeholder.',
      });
      return;
    }

    setEditingEquityDoc(docToEdit);
    setEditEquityDocTitle(docToEdit.title);
    setEditEquityDocPrompt('');
    setEditRequiresSignature(isAutoExecutedCompanyDoc(docToEdit) ? false : Boolean(docToEdit.requiresSignature));
    setIsEditEquityDocModalOpen(true);
  };

  const regenerateCompanyApprovalDocCleanly = async (equityDoc: EquityDocument, nextTitle: string, additionalInstructions: string) => {
    const founder = stakeholders.find(s => s.type === 'founder' && s.email);
    const preservedExecutionSource = equityDoc.autoSignedAt || equityDoc.createdAt;
    const preservedExecutionDate = formatLegalDate(preservedExecutionSource);
    const storedPrompt = [equityDoc.prompt?.trim(), additionalInstructions.trim()].filter(Boolean).join('\n\n');
    const generatorPrompt = [
      storedPrompt,
      `Clean regeneration instructions:
- Preserve the original approval/effective date as ${preservedExecutionDate}.
- Apply the latest approved document language and text cleanup.
- This is a clean refresh, not a new approval or ratification event.
- Keep the document already executed by Tremaine Grant with no blank signature lines and no e-sign workflow.`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const { ok, result } = await postEquityFunctionJson('/.netlify/functions/generate-equity-document', {
      stakeholderId: equityDoc.stakeholderId || founder?.id,
      stakeholderName: equityDoc.stakeholderName || founder?.name || 'Tremaine Grant',
      stakeholderEmail: equityDoc.stakeholderEmail || founder?.email || 'tre@fitwithpulse.ai',
      stakeholderType: equityDoc.stakeholderType || founder?.type || 'founder',
      documentType: equityDoc.documentType,
      prompt: generatorPrompt,
      requiresSignature: false,
      boardApprovalDate: equityDoc.documentType === 'board_consent' ? preservedExecutionDate : undefined,
      documentDate: preservedExecutionDate,
      grantDetails: equityDoc.grantDetails,
    });

    if (!ok || !result.success || !result.content) {
      throw new Error(result.error || 'Failed to regenerate document cleanly');
    }

    const revisionHistory = equityDoc.revisionHistory || [];
    const convertedHistory = revisionHistory.map(rev => ({
      prompt: rev.prompt,
      timestamp:
        rev.timestamp instanceof Timestamp
          ? rev.timestamp
          : Timestamp.fromDate(rev.timestamp instanceof Date ? rev.timestamp : new Date(rev.timestamp as any)),
    }));

    let invalidatedRequestCount = 0;
    const signingState = getEquityDocSignatureState(equityDoc);
    if (signingState.hasSignatureFlow) {
      invalidatedRequestCount = await invalidateSigningRequestsForDoc(
        equityDoc,
        `${equityDoc.title} was cleanly regenerated and is now managed as an auto-executed internal approval document.`
      );
    }

    await updateDoc(doc(db, 'equity-documents', equityDoc.id), {
      title: nextTitle,
      prompt: storedPrompt,
      content: result.content,
      requiresSignature: false,
      autoSigned: true,
      autoSignedAt: preservedExecutionSource,
      signingRequestId: deleteField(),
      signingRequestIds: deleteField(),
      needsResendSignature: false,
      status: 'completed',
      revisionHistory: [
        ...convertedHistory,
        {
          prompt: additionalInstructions.trim()
            ? `Clean regenerate: ${additionalInstructions.trim()}`
            : 'Clean regenerate using the latest approved template language while preserving the original execution date and auto-signature.',
          timestamp: Timestamp.now(),
        },
      ],
      updatedAt: Timestamp.now(),
    });

    setMessage({
      type: 'success',
      text: invalidatedRequestCount > 0
        ? 'Document regenerated cleanly. Old signature links were invalidated and the auto-executed version is now current.'
        : 'Document regenerated cleanly with the original date and auto-executed signature preserved.',
    });
  };

  const handleReviseEquityDoc = async () => {
    if (!editingEquityDoc) return;

    const titleChanged = editEquityDocTitle.trim() !== editingEquityDoc.title;
    const hasRevisionPrompt = editEquityDocPrompt.trim().length > 0;
    const signatureChanged = Boolean(editRequiresSignature) !== Boolean(editingEquityDoc.requiresSignature);
    const isCleanRegenerationDoc = isAutoExecutedCompanyDoc(editingEquityDoc);

    if (!isCleanRegenerationDoc && !titleChanged && !hasRevisionPrompt && !signatureChanged) {
      setMessage({ type: 'error', text: 'Enter a new title and/or revision instructions' });
      return;
    }

    setIsRevisingEquityDoc(true);
    try {
      const revisionReferenceDate = new Date();
      const revisionReferenceDateLabel = formatLegalDate(revisionReferenceDate);

      if (isCleanRegenerationDoc) {
        await regenerateCompanyApprovalDocCleanly(
          editingEquityDoc,
          editEquityDocTitle.trim() || editingEquityDoc.title,
          editEquityDocPrompt,
        );

        setIsEditEquityDocModalOpen(false);
        setEditingEquityDoc(null);
        setEditEquityDocTitle('');
        setEditEquityDocPrompt('');
        setEditRequiresSignature(false);
        loadData();
        return;
      }

      if (isEquityDocLockedForEditing(editingEquityDoc)) {
        throw new Error('This signed advisor document is locked. Create a separate new grant for this stakeholder instead of revising the executed document.');
      }

      let newContent = editingEquityDoc.content;

      const effectiveRevisionPrompt =
        hasRevisionPrompt
          ? editEquityDocPrompt
          : signatureChanged
          ? editRequiresSignature
            ? 'Add a clear signature section at the end with signature blocks for BOTH parties (Company and Recipient), including printed name + title + date lines.'
            : 'Remove signature lines/blocks and any signature section, unless strictly required.'
          : '';

      const advisorDateAlignmentPrompt =
        editingEquityDoc.documentType === 'advisor_nso_agreement'
          ? `Date alignment instructions:
- Update the Grant Date, Effective Date, Board approval written consent date, and Vesting Commencement Date so they all match exactly.
- Use ${revisionReferenceDateLabel} as the single controlling date everywhere in the document.
- Do not leave any prior grant-date or vesting-start-date references behind.`
          : '';

      const finalRevisionPrompt = [effectiveRevisionPrompt.trim(), advisorDateAlignmentPrompt]
        .filter(Boolean)
        .join('\n\n');

      if (finalRevisionPrompt.trim()) {
        const { ok, status, result } = await postEquityFunctionJson('/.netlify/functions/revise-equity-document', {
          documentId: editingEquityDoc.id,
          documentType: editingEquityDoc.documentType,
          currentContent: editingEquityDoc.content,
          revisionPrompt: finalRevisionPrompt,
          originalPrompt: editingEquityDoc.prompt,
          requiresSignature: Boolean(editRequiresSignature),
          stakeholderName: editingEquityDoc.stakeholderName,
          stakeholderEmail: editingEquityDoc.stakeholderEmail,
          stakeholderType: editingEquityDoc.stakeholderType,
          grantDetails: editingEquityDoc.grantDetails,
        });

        if (!ok) {
          throw new Error(result.error || `Failed to revise document (HTTP ${status})`);
        }
        newContent = result.content;
      }

      const revisionHistory = editingEquityDoc.revisionHistory || [];
      const convertedHistory = revisionHistory.map(rev => ({
        prompt: rev.prompt,
        timestamp:
          rev.timestamp instanceof Timestamp
            ? rev.timestamp
            : Timestamp.fromDate(rev.timestamp instanceof Date ? rev.timestamp : new Date(rev.timestamp as any)),
      }));

      const updateData: any = {
        title: editEquityDocTitle.trim(),
        requiresSignature: Boolean(editRequiresSignature),
        updatedAt: Timestamp.now(),
      };

      if (editingEquityDoc.documentType === 'advisor_nso_agreement' && editingEquityDoc.grantDetails) {
        updateData.grantDetails = {
          ...editingEquityDoc.grantDetails,
          vestingStartDate: revisionReferenceDate.toISOString(),
        };
      }

      if (finalRevisionPrompt.trim()) {
        updateData.content = newContent;
        updateData.revisionHistory = [
          ...convertedHistory,
          { prompt: finalRevisionPrompt, timestamp: Timestamp.now() },
        ];
      }

      const signedState = getEquityDocSignatureState(editingEquityDoc);
      const executedDoc = signedState.isFullyExecuted || Boolean(editingEquityDoc.autoSigned || editingEquityDoc.autoSignedAt);
      const updatedRequiresExternalSignature =
        Boolean(editRequiresSignature) && !isAutoExecutedCompanyDoc(editingEquityDoc);

      if (executedDoc) {
        const amendmentTitle = titleChanged
          ? editEquityDocTitle.trim()
          : `${editingEquityDoc.title} Amendment`;

        await addDoc(collection(db, 'equity-documents'), {
          title: amendmentTitle,
          prompt: editingEquityDoc.prompt,
          content: effectiveRevisionPrompt.trim() ? newContent : editingEquityDoc.content,
          documentType: editingEquityDoc.documentType,
          requiresSignature: Boolean(editRequiresSignature) && !isAutoExecutedCompanyDoc(editingEquityDoc),
          stakeholderId: editingEquityDoc.stakeholderId ?? null,
          stakeholderName: editingEquityDoc.stakeholderName ?? null,
          stakeholderEmail: editingEquityDoc.stakeholderEmail ?? null,
          stakeholderType: editingEquityDoc.stakeholderType ?? null,
          grantDetails: editingEquityDoc.grantDetails,
          status: 'completed',
          isAmendment: true,
          originalDocumentId: editingEquityDoc.id,
          needsResendSignature: updatedRequiresExternalSignature,
          ...(isAutoExecutedCompanyDoc(editingEquityDoc)
            ? { autoSigned: true, autoSignedAt: Timestamp.now() }
            : {}),
          revisionHistory: finalRevisionPrompt.trim()
            ? [
                ...convertedHistory,
                { prompt: finalRevisionPrompt, timestamp: Timestamp.now() },
              ]
            : convertedHistory,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        setMessage({
          type: 'success',
          text: 'Signed original preserved. A new amendment document was created with your updates.',
        });
      } else {
        let invalidatedRequestCount = 0;
        if (signedState.hasSignatureFlow) {
          invalidatedRequestCount = await invalidateSigningRequestsForDoc(
            editingEquityDoc,
            `Invalidated because ${editingEquityDoc.title} was revised before it was fully executed.`
          );
          updateData.signingRequestId = deleteField();
          updateData.signingRequestIds = deleteField();
          updateData.needsResendSignature = updatedRequiresExternalSignature && invalidatedRequestCount > 0;
        }

        await updateDoc(doc(db, 'equity-documents', editingEquityDoc.id), updateData);

        setMessage({
          type: 'success',
          text: invalidatedRequestCount > 0
            ? 'Document updated. Existing signature links were invalidated and the document now needs to be resent.'
            : hasRevisionPrompt
            ? 'Document revised successfully!'
            : 'Saved successfully!',
        });
      }

      setIsEditEquityDocModalOpen(false);
      setEditingEquityDoc(null);
      setEditEquityDocTitle('');
      setEditEquityDocPrompt('');
      setEditRequiresSignature(false);
      loadData();
    } catch (error) {
      console.error('Error revising equity document:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to revise document' });
    } finally {
      setIsRevisingEquityDoc(false);
    }
  };

  const getSigningRequestsForEquityDoc = (equityDocId: string) => {
    return signingRequests.filter(r => (r as any).equityDocumentId === equityDocId && !r.invalidatedAt);
  };

  const requiresExternalSignature = (equityDoc: EquityDocument) => {
    return Boolean(equityDoc.requiresSignature) && !isAutoExecutedCompanyDoc(equityDoc);
  };

  const getEquityDocSignatureState = (equityDoc: EquityDocument) => {
    const activeRequests = getSigningRequestsForEquityDoc(equityDoc.id);
    const hasSignatureFlow = activeRequests.length > 0;
    const isFullyExecuted = hasSignatureFlow && activeRequests.every(r => r.status === 'signed');
    const hasBeenSent = activeRequests.some(r => ['sent', 'viewed', 'signed'].includes(r.status));

    return {
      activeRequests,
      hasSignatureFlow,
      isFullyExecuted,
      hasBeenSent,
      needsResend: Boolean(equityDoc.needsResendSignature),
    };
  };

  const getEquityDocStatusBadge = (equityDoc: EquityDocument) => {
    const state = getEquityDocSignatureState(equityDoc);

    if (isAutoExecutedCompanyDoc(equityDoc) && (equityDoc.autoSigned || equityDoc.autoSignedAt)) {
      return { label: 'Auto-executed', className: 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' };
    }

    if (state.needsResend) {
      return { label: 'Needs Resend', className: 'bg-amber-900/40 text-amber-300 border border-amber-700' };
    }

    if (state.isFullyExecuted) {
      return { label: 'Signed', className: 'bg-green-900/50 text-green-400 border border-green-700' };
    }

    if (state.hasBeenSent) {
      return { label: 'Sent for Signature', className: 'bg-blue-900/50 text-blue-400 border border-blue-700' };
    }

    if (state.hasSignatureFlow) {
      return { label: 'Pending Signature', className: 'bg-zinc-800 text-zinc-400 border border-zinc-600' };
    }

    return null;
  };

  const invalidateSigningRequestsForDoc = async (equityDoc: EquityDocument, reason: string) => {
    const activeRequests = getSigningRequestsForEquityDoc(equityDoc.id);
    await Promise.all(
      activeRequests.map(request =>
        updateDoc(doc(db, 'signingRequests', request.id), {
          invalidatedAt: serverTimestamp(),
          invalidatedReason: reason,
        })
      )
    );
    return activeRequests.length;
  };

  const getDefaultCompanySigner = (): { stakeholderId?: string; name: string; email: string } => {
    const founder = stakeholders.find(s => s.type === 'founder' && s.email);
    return {
      stakeholderId: founder?.id,
      name: founder?.name || 'Pulse Intelligence Labs, Inc.',
      email: founder?.email || '',
    };
  };

  const buildDefaultSignersForDoc = (docToSign: EquityDocument): SignerRow[] => {
    const company = getDefaultCompanySigner();

    // Reuse any existing requests if present
    const existingReqs = getSigningRequestsForEquityDoc(docToSign.id);

    const makeRow = (row: Omit<SignerRow, 'id'>): SignerRow => {
      const existing = existingReqs.find(r => r.recipientEmail?.toLowerCase() === row.email?.toLowerCase() && r.signerRole === row.role);
      return {
        id: `${row.role}-${row.email || Math.random().toString(36).slice(2)}`,
        ...row,
        signingRequestId: existing?.id,
      };
    };

    // Document-type heuristics
    if (['advisor_nso_agreement', 'option_agreement', 'fast_agreement'].includes(docToSign.documentType)) {
      return [
        makeRow({ role: 'Company', stakeholderId: company.stakeholderId, name: company.name, email: company.email }),
        makeRow({ role: 'Recipient', stakeholderId: docToSign.stakeholderId || undefined, name: docToSign.stakeholderName || '', email: docToSign.stakeholderEmail || '' }),
      ];
    }

    if (docToSign.documentType === 'board_consent') {
      const directors = stakeholders.filter(s => s.type === 'founder' && s.email);
      if (directors.length) {
        return directors.map((d, idx) =>
          makeRow({ role: `Director ${idx + 1}`, stakeholderId: d.id, name: d.name, email: d.email })
        );
      }
      return [makeRow({ role: 'Director', name: '', email: '' })];
    }

    // Fallback: single signer (stakeholder)
    return [
      makeRow({ role: 'Recipient', stakeholderId: docToSign.stakeholderId || undefined, name: docToSign.stakeholderName || '', email: docToSign.stakeholderEmail || '' }),
    ];
  };

  const openSigningModal = (docToSign: EquityDocument) => {
    const company = getDefaultCompanySigner();
    setSigningDoc(docToSign);
    setSigners(buildDefaultSignersForDoc(docToSign));
    setPreviewRecipientName(company.name || 'Preview Tester');
    setPreviewRecipientEmail(company.email || '');
    setSigningModalStatus(null);
    setIsSigningModalOpen(true);
  };

  const closeSigningModal = () => {
    setIsSigningModalOpen(false);
    setSigningDoc(null);
    setSigners([]);
    setSigningModalStatus(null);
    setPreviewRecipientName('');
    setPreviewRecipientEmail('');
  };

  const handleSendForSignature = async () => {
    if (!signingDoc) return;

    const normalized = signers.map(s => ({
      ...s,
      name: (s.name || '').trim(),
      email: (s.email || '').trim().toLowerCase(),
    }));

    if (normalized.length === 0 || normalized.some(s => !s.name || !s.email)) {
      setSigningModalStatus({ type: 'error', text: 'Please fill in name and email for all signers.' });
      setMessage({ type: 'error', text: 'Please fill in name and email for all signers' });
      return;
    }

    setIsSending(true);
    setSigningModalStatus({ type: 'info', text: `Sending signature request${normalized.length === 1 ? '' : 's'}...` });
    try {
      const signingGroupId = `${signingDoc.id}-${Date.now()}`;
      const signingRequestIds: string[] = [];

      // Create or reuse signing requests per signer, then send/resend emails
      for (let i = 0; i < normalized.length; i++) {
        const signer = normalized[i];

        let requestId = signer.signingRequestId;
        if (!requestId) {
          const requestData: any = {
            documentType: signingDoc.documentType,
            documentName: signingDoc.title,
            recipientName: signer.name,
            recipientEmail: signer.email,
            status: 'pending',
            createdAt: serverTimestamp(),
            equityDocumentId: signingDoc.id,
            documentContent: signingDoc.content,
            signerRole: signer.role,
            stakeholderId: signer.stakeholderId || null,
            signingGroupId,
            signingOrder: i + 1,
          };
          const docRef = await addDoc(collection(db, 'signingRequests'), requestData);
          requestId = docRef.id;
        }

        signingRequestIds.push(requestId);

        const resp = await fetch('/.netlify/functions/send-signing-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: requestId,
            documentName: signingDoc.title,
            documentType: signingDoc.documentType,
            recipientName: signer.name,
            recipientEmail: signer.email,
          }),
        });
        if (!resp.ok) {
          let errorMessage = `Failed to send email to ${signer.email}`;
          try {
            const data = await resp.json();
            errorMessage = data?.message || data?.error || errorMessage;
          } catch {
            try {
              const text = await resp.text();
              if (text) errorMessage = text;
            } catch {}
          }
          throw new Error(errorMessage);
        }
      }

      // Update equity document with signing request linkages
      await updateDoc(doc(db, 'equity-documents', signingDoc.id), {
        signingRequestId: signingRequestIds[0],
        signingRequestIds,
        requiresSignature: true,
        needsResendSignature: false,
        updatedAt: Timestamp.now(),
      });

      setSigners(prev => prev.map((signer, idx) => ({
        ...signer,
        signingRequestId: signingRequestIds[idx] || signer.signingRequestId,
      })));
      setSigningModalStatus({
        type: 'success',
        text: `Signature request${signingRequestIds.length === 1 ? '' : 's'} sent successfully to ${signingRequestIds.length} signer${signingRequestIds.length === 1 ? '' : 's'}.`,
      });
      setMessage({ type: 'success', text: `Sent for signature to ${signingRequestIds.length} signer(s)!` });
      loadData();
    } catch (error) {
      console.error('Error sending document for signature:', error);
      setSigningModalStatus({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to send the signature request.',
      });
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to send document' });
    } finally {
      setIsSending(false);
    }
  };

  const handlePreviewSignatureFlow = async () => {
    if (!signingDoc) return;

    const previewName = previewRecipientName.trim();
    const previewEmail = previewRecipientEmail.trim().toLowerCase();

    if (!previewName || !previewEmail) {
      setSigningModalStatus({ type: 'error', text: 'Enter a preview recipient name and email before sending the preview.' });
      setMessage({ type: 'error', text: 'Enter a preview recipient name and email before sending the preview.' });
      return;
    }

    const company = getDefaultCompanySigner();

    setIsSending(true);
    setSigningModalStatus({ type: 'info', text: `Sending preview email to ${previewEmail}...` });

    try {
      const previewRequestRef = await addDoc(collection(db, 'signingRequests'), {
        documentType: signingDoc.documentType,
        documentName: `${signingDoc.title} (Preview)`,
        recipientName: previewName,
        recipientEmail: previewEmail,
        status: 'pending',
        createdAt: serverTimestamp(),
        documentContent: signingDoc.content,
        signerRole: 'Preview Recipient',
        companyName: company.name || 'Pulse Intelligence Labs, Inc.',
        previewMode: true,
        previewSourceEquityDocumentId: signingDoc.id,
      });

      const resp = await fetch('/.netlify/functions/send-signing-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: previewRequestRef.id,
          documentName: `${signingDoc.title} (Preview)`,
          documentType: signingDoc.documentType,
          recipientName: previewName,
          recipientEmail: previewEmail,
          companyName: company.name || 'Pulse Intelligence Labs, Inc.',
          previewMode: true,
        }),
      });

      if (!resp.ok) {
        let errorMessage = `Failed to send preview email to ${previewEmail}`;
        try {
          const data = await resp.json();
          errorMessage = data?.message || data?.error || errorMessage;
        } catch {
          try {
            const text = await resp.text();
            if (text) errorMessage = text;
          } catch {}
        }
        throw new Error(errorMessage);
      }

      setSigningModalStatus({
        type: 'success',
        text: `Preview email sent to ${previewEmail}. The link opens a sandbox signing flow and will not change the live document state.`,
      });
      setMessage({ type: 'success', text: `Preview email sent to ${previewEmail}.` });
    } catch (error) {
      console.error('Error sending preview signature email:', error);
      setSigningModalStatus({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to send preview email.',
      });
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to send preview email.' });
    } finally {
      setIsSending(false);
    }
  };

  const copySigningLink = async (signingRequestId: string) => {
    const shareUrl = `${window.location.origin}/sign/${signingRequestId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage({ type: 'success', text: 'Signing link copied to clipboard!' });
    } catch (error) {
      console.error('Failed to copy link:', error);
      setMessage({ type: 'error', text: 'Failed to copy link. Please try again.' });
    }
  };

  const handleShareEquityDoc = async (equityDoc: EquityDocument) => {
    const shareUrl = `${window.location.origin}/equity-doc/${equityDoc.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLinkId(equityDoc.id);
      setMessage({ type: 'success', text: 'Shareable link copied to clipboard!' });
      setTimeout(() => setCopiedLinkId(null), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      setMessage({ type: 'error', text: 'Failed to copy link. Please try again.' });
    }
  };

  // Open Exhibits Modal
  const openExhibitsModal = (equityDoc: EquityDocument) => {
    setExhibitsDocument(equityDoc);
    setSelectedExhibits(equityDoc.exhibits || []);
    setIsExhibitsModalOpen(true);
  };

  // Toggle exhibit selection
  const toggleExhibit = (exhibitId: string) => {
    setSelectedExhibits(prev => 
      prev.includes(exhibitId) 
        ? prev.filter(id => id !== exhibitId)
        : [...prev, exhibitId]
    );
  };

  // Save exhibits to document
  const handleSaveExhibits = async () => {
    if (!exhibitsDocument) return;

    setIsSavingExhibits(true);
    try {
      await updateDoc(doc(db, 'equity-documents', exhibitsDocument.id), {
        exhibits: selectedExhibits,
        updatedAt: Timestamp.now()
      });

      setMessage({ type: 'success', text: `${selectedExhibits.length} exhibit(s) attached successfully!` });
      setIsExhibitsModalOpen(false);
      setExhibitsDocument(null);
      loadData();
    } catch (error) {
      console.error('Error saving exhibits:', error);
      setMessage({ type: 'error', text: 'Failed to save exhibits' });
    } finally {
      setIsSavingExhibits(false);
    }
  };

  // Verify + link a Board Consent document to a stakeholder
  const verifyAndLinkBoardConsent = async (stakeholder: Stakeholder, boardConsentDocId: string) => {
    const consentDoc = equityDocuments.find(d => d.id === boardConsentDocId);
    if (!consentDoc?.content?.trim()) {
      setMessage({ type: 'error', text: 'Selected Board Consent has no content to verify.' });
      return;
    }

    setBoardConsentVerification(prev => ({
      ...prev,
      [stakeholder.id]: { status: 'verifying' }
    }));

    try {
      const expectedOptions = stakeholder.optionsGranted || stakeholder.totalShares || stakeholder.grants?.[0]?.numberOfShares;

      const { ok, result: data } = await postEquityFunctionJson('/.netlify/functions/verify-board-consent', {
        boardConsentContent: consentDoc.content,
        expectedStakeholderName: stakeholder.name,
        expectedNumberOfOptions: typeof expectedOptions === 'number' ? expectedOptions : undefined,
      });

      if (!ok || !data?.success) {
        throw new Error(data?.error || 'Failed to verify board consent');
      }

      if (!data.isValid || !data.approvalDate) {
        setBoardConsentVerification(prev => ({
          ...prev,
          [stakeholder.id]: { status: 'failed', approvalDate: data.approvalDate || undefined, issues: data.issues || [] }
        }));
        setMessage({ type: 'error', text: 'Board Consent verification failed. Please review the issues.' });
        return;
      }

      // Persist linkage on stakeholder
      await updateDoc(doc(db, 'equity-stakeholders', stakeholder.id), {
        boardConsentDocId,
        boardApprovalDate: data.approvalDate,
        boardConsentVerifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setBoardConsentVerification(prev => ({
        ...prev,
        [stakeholder.id]: { status: 'verified', approvalDate: data.approvalDate, issues: [] }
      }));
      setMessage({ type: 'success', text: `Board Consent verified (Approval Date: ${data.approvalDate}). You can now generate the Advisor Agreement.` });
      loadData();
    } catch (e) {
      console.error('verifyAndLinkBoardConsent error', e);
      setBoardConsentVerification(prev => ({
        ...prev,
        [stakeholder.id]: { status: 'failed', issues: [e instanceof Error ? e.message : 'Unknown error'] }
      }));
      setMessage({ type: 'error', text: 'Failed to verify Board Consent' });
    }
  };

  // Get exhibit documents for a document
  const getExhibitDocuments = (documentId: string): EquityDocument[] => {
    const equityDoc = equityDocuments.find(d => d.id === documentId);
    if (!equityDoc?.exhibits?.length) return [];
    return equityDocuments.filter(d => equityDoc.exhibits?.includes(d.id));
  };

  const isLatestDocumentInFamily = (equityDoc: EquityDocument) => {
    return getLatestRelevantDocuments(
      equityDocuments.filter(doc => getEquityDocumentFamilyKey(doc) === getEquityDocumentFamilyKey(equityDoc))
    ).some(doc => doc.id === equityDoc.id);
  };

  const isProtectedStakeholderDocument = (equityDoc: EquityDocument) => {
    return Boolean(
      equityDoc.stakeholderId &&
      ['board_consent', 'advisor_nso_agreement'].includes(equityDoc.documentType) &&
      isLatestDocumentInFamily(equityDoc)
    );
  };

  const handleDeleteEquityDoc = async (equityDocId: string) => {
    const equityDoc = equityDocuments.find(d => d.id === equityDocId);
    if (equityDoc && isProtectedStakeholderDocument(equityDoc)) {
      setMessage({
        type: 'error',
        text: 'Required stakeholder documents cannot be deleted. Regenerate or amend them instead.',
      });
      return;
    }

    if (!confirm('Are you sure you want to delete this equity document?')) return;
    setDeletingEquityDocId(equityDocId);
    try {
      await deleteDoc(doc(db, 'equity-documents', equityDocId));
      setEquityDocuments(prev => prev.filter(d => d.id !== equityDocId));
      if (docHistoryAnchor?.id === equityDocId) {
        setDocHistoryAnchor(null);
        setIsDocHistoryModalOpen(false);
      }
      setMessage({ type: 'success', text: 'Document deleted successfully' });
    } catch (error) {
      console.error('Error deleting equity document:', error);
      setMessage({ type: 'error', text: 'Failed to delete document' });
    } finally {
      setDeletingEquityDocId(null);
    }
  };

  const openAuditModal = async (documentToAudit: EquityDocument) => {
    setAuditingEquityDoc(documentToAudit);
    setAuditResult(null);
    setIsAuditModalOpen(true);
    setIsAuditing(true);
    try {
      const { ok, result } = await postEquityFunctionJson('/.netlify/functions/audit-equity-document', {
        documentId: documentToAudit.id,
        content: documentToAudit.content,
        documentType: documentToAudit.documentType,
        title: documentToAudit.title,
        requiresSignature: Boolean(documentToAudit.requiresSignature),
      });

      if (!ok) {
        throw new Error(result.error || 'Failed to audit document');
      }
      setAuditResult(result.audit);
    } catch (error) {
      console.error('Error auditing equity document:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to audit document' });
      setIsAuditModalOpen(false);
    } finally {
      setIsAuditing(false);
    }
  };

  // Delete Stakeholder
  const handleDeleteStakeholder = async (stakeholderId: string) => {
    if (!confirm('Are you sure you want to delete this stakeholder? This cannot be undone.')) return;
    
    try {
      await deleteDoc(doc(db, 'equity-stakeholders', stakeholderId));
      setMessage({ type: 'success', text: 'Stakeholder deleted' });
      loadData();
    } catch (error) {
      console.error('Error deleting stakeholder:', error);
      setMessage({ type: 'error', text: 'Failed to delete stakeholder' });
    }
  };

  // Render Overview Tab
  const renderOverview = () => (
    <div className="space-y-8">
      {/* Cap Table Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<PieChart className="w-5 h-5" />}
          label="Total Authorized"
          value={formatNumber(capTableSummary.totalAuthorizedShares)}
          subValue="Common shares"
          color="#E0FE10"
          delay={0}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Issued Shares"
          value={formatNumber(capTableSummary.totalIssuedShares)}
          subValue={`${((capTableSummary.totalIssuedShares / capTableSummary.totalAuthorizedShares) * 100).toFixed(1)}% of authorized`}
          color="#3B82F6"
          delay={0.1}
        />
        <StatCard
          icon={<Award className="w-5 h-5" />}
          label="Option Pool"
          value={formatNumber(capTableSummary.employeeOptions)}
          subValue="Reserved for employees"
          color="#8B5CF6"
          delay={0.2}
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Stakeholders"
          value={stakeholders.length.toString()}
          subValue="Total equity holders"
          color="#10B981"
          delay={0.3}
        />
      </div>

      {/* Ownership Breakdown */}
      <GlassCard accentColor="#E0FE10">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-[#E0FE10]" />
            Ownership Breakdown
          </h3>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Visual Breakdown */}
            <div className="space-y-4">
              {[
                { label: 'Founders', value: capTableSummary.founderShares, color: '#E0FE10', icon: '👑' },
                { label: 'Employees', value: capTableSummary.employeeOptions, color: '#3B82F6', icon: '💼' },
                { label: 'Advisors', value: capTableSummary.advisorShares, color: '#8B5CF6', icon: '🎯' },
                { label: 'Investors', value: capTableSummary.investorShares, color: '#10B981', icon: '💰' },
              ].map((item, idx) => {
                const percentage = capTableSummary.totalIssuedShares > 0 
                  ? (item.value / capTableSummary.totalIssuedShares) * 100 
                  : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{item.icon}</span>
                        <span className="text-white font-medium">{item.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-white font-semibold">{formatNumber(item.value)}</span>
                        <span className="text-zinc-500 text-sm ml-2">
                          ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.1 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Available Shares */}
            <div className="p-6 rounded-xl bg-zinc-800/50 border border-zinc-700">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#E0FE10]/10 border border-[#E0FE10]/20 mb-4">
                  <Scale className="w-8 h-8 text-[#E0FE10]" />
                </div>
                <h4 className="text-zinc-400 text-sm mb-2">Available for Issuance</h4>
                <p className="text-3xl font-bold text-white mb-1">
                  {formatNumber(capTableSummary.totalAvailable)}
                </p>
                <p className="text-[#E0FE10] text-sm">
                  {((capTableSummary.totalAvailable / capTableSummary.totalAuthorizedShares) * 100).toFixed(1)}% remaining
                </p>
              </div>
              
              <div className="mt-6 pt-4 border-t border-zinc-700">
                <p className="text-xs text-zinc-500 text-center">
                  Based on {formatNumber(capTableSummary.totalAuthorizedShares)} authorized shares
                </p>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Cap Table - Shareholders */}
      <GlassCard accentColor="#3B82F6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#3B82F6]" />
              Shareholders
            </h3>
            {stakeholders.length === 0 && (
              <button
                onClick={seedDefaultData}
                disabled={seeding}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#E0FE10] text-black rounded-lg text-sm font-medium hover:bg-[#d4f00f] transition-colors"
              >
                {seeding ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    Initialize Cap Table
                  </>
                )}
              </button>
            )}
          </div>
          
          {stakeholders.length === 0 ? (
            <div className="text-center py-8">
              <PieChart className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 mb-1">No cap table data yet</p>
              <p className="text-zinc-500 text-sm">Click "Initialize Cap Table" to seed with your current holdings</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left py-3 px-4 text-zinc-400 text-sm font-medium">Shareholder</th>
                    <th className="text-right py-3 px-4 text-zinc-400 text-sm font-medium">Shares</th>
                    <th className="text-right py-3 px-4 text-zinc-400 text-sm font-medium">Ownership</th>
                    <th className="text-center py-3 px-4 text-zinc-400 text-sm font-medium">Vesting</th>
                    <th className="text-center py-3 px-4 text-zinc-400 text-sm font-medium">Cliff</th>
                    <th className="text-left py-3 px-4 text-zinc-400 text-sm font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {stakeholders.map((stakeholder) => {
                    const typeConfig = getStakeholderTypeConfig(stakeholder.type);
                    const isPool = (stakeholder as Stakeholder & { isReservedPool?: boolean }).isReservedPool;
                    const vestingData = stakeholder as Stakeholder & { vestingSchedule?: string; cliffMonths?: number; vestingMonths?: number };
                    return (
                      <tr key={stakeholder.id} className="border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                              style={{ backgroundColor: `${typeConfig.color}20`, border: `1px solid ${typeConfig.color}40` }}
                            >
                              {isPool ? '📊' : typeConfig.icon}
                            </div>
                            <div>
                              <p className="text-white font-medium">{stakeholder.name}</p>
                              <p className="text-zinc-500 text-xs">{isPool ? 'Unissued / Reserved' : typeConfig.label}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="text-white font-semibold">{formatNumber(stakeholder.totalShares || 0)}</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className={`font-semibold ${(stakeholder.ownershipPercentage ?? 0) >= 50 ? 'text-[#E0FE10]' : 'text-white'}`}>
                            {stakeholder.ownershipPercentage ?? 0}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-zinc-400 text-sm">
                            {isPool ? '—' : vestingData.vestingMonths ? `${vestingData.vestingMonths / 12} years` : '—'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-zinc-400 text-sm">
                            {isPool ? '—' : vestingData.cliffMonths ? `${vestingData.cliffMonths / 12} year` : '—'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-zinc-500 text-sm">{stakeholder.notes || ''}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total Row */}
                  <tr className="bg-zinc-800/50">
                    <td className="py-4 px-4">
                      <span className="text-[#E0FE10] font-semibold">Total</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-white font-bold">{formatNumber(capTableSummary.totalAuthorizedShares)}</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-white font-bold">100%</span>
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Convertible Notes */}
      <GlassCard accentColor="#F59E0B">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#F59E0B]" />
              Convertible Notes
            </h3>
            <span className="px-2 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded text-xs font-medium">
              Unconverted
            </span>
          </div>
          
          {convertibleNotes.length === 0 && stakeholders.length === 0 ? (
            <div className="text-center py-6">
              <DollarSign className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">No convertible notes yet</p>
            </div>
          ) : convertibleNotes.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-zinc-400 text-sm">Initialize cap table to load convertible notes</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-700">
                      <th className="text-left py-3 px-4 text-zinc-400 text-sm font-medium">Holder</th>
                      <th className="text-right py-3 px-4 text-zinc-400 text-sm font-medium">Principal</th>
                      <th className="text-right py-3 px-4 text-zinc-400 text-sm font-medium">Cap</th>
                      <th className="text-right py-3 px-4 text-zinc-400 text-sm font-medium">Discount</th>
                      <th className="text-right py-3 px-4 text-zinc-400 text-sm font-medium">Interest</th>
                      <th className="text-center py-3 px-4 text-zinc-400 text-sm font-medium">Maturity</th>
                      <th className="text-left py-3 px-4 text-zinc-400 text-sm font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {convertibleNotes.map((note) => (
                      <tr key={note.id} className="border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                        <td className="py-4 px-4">
                          <div>
                            <p className="text-white font-medium">{note.holderName}</p>
                            <p className="text-zinc-500 text-xs">{note.holderType}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="text-white font-semibold">{formatCurrency(note.principal)}</span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="text-zinc-400">
                            {note.cap ? formatCurrency(note.cap) : '—'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="text-zinc-400">
                            {note.discount ? `${note.discount}%` : '—'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="text-zinc-400">
                            {note.interestRate ? `${note.interestRate}%` : '—'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-zinc-400">
                            {note.maturityDate ? formatDate(note.maturityDate) : '—'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-zinc-500 text-sm truncate block max-w-[200px]" title={note.notes}>
                            {note.notes || ''}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-zinc-500 mt-4 pt-4 border-t border-zinc-800">
                We can populate cap/discount/interest/maturity once the template PDF is added to the repo/public dataroom.
              </p>
            </>
          )}
        </div>
      </GlassCard>
    </div>
  );

  // Get the display values for a stakeholder
  const getStakeholderMetrics = (stakeholder: Stakeholder) => {
    // Check if they have option grants (optionsGranted field or grants with nso/iso)
    const optionsGranted = stakeholder.optionsGranted || 
      (stakeholder.grants?.reduce((sum, g) => 
        ['nso', 'iso'].includes(g.equityType) ? sum + (g.numberOfShares || 0) : sum, 0) || 0);
    
    // Actual shares owned (founders, exercised options, or direct grants)
    const sharesOwned = stakeholder.sharesOwned || stakeholder.totalShares || 0;
    
    // For founders, they have actual shares
    if (stakeholder.type === 'founder') {
      return {
        primaryValue: sharesOwned,
        primaryLabel: 'Shares Owned',
        showOwnership: true,
      };
    }
    
    // For option holders, show options granted
    if (optionsGranted > 0) {
      return {
        primaryValue: optionsGranted,
        primaryLabel: 'Options Granted',
        showOwnership: false, // Options aren't ownership until exercised
      };
    }
    
    // Fallback
    return {
      primaryValue: sharesOwned,
      primaryLabel: 'Shares Owned',
      showOwnership: sharesOwned > 0,
    };
  };

  const getStakeholderCompletedDocuments = (stakeholderId: string) => {
    return equityDocuments.filter(d => d.stakeholderId === stakeholderId && d.status === 'completed');
  };

  const getStakeholderVisibleDocuments = (stakeholderId: string) => {
    return getLatestRelevantDocuments(getStakeholderCompletedDocuments(stakeholderId));
  };

  const getVisibleGeneratedDocuments = () => {
    return getLatestRelevantDocuments(equityDocuments);
  };

  const openDocHistoryModal = (equityDoc: EquityDocument) => {
    setDocHistoryAnchor(equityDoc);
    setIsDocHistoryModalOpen(true);
  };

  const getStakeholderSignatureDocuments = (stakeholder: Stakeholder) => {
    const signaturePriority: Record<string, number> = {
      advisor_nso_agreement: 0,
      option_agreement: 1,
      fast_agreement: 2,
      board_consent: 3,
    };

    return getStakeholderCompletedDocuments(stakeholder.id)
      .filter(requiresExternalSignature)
      .sort((a, b) => {
        const priorityDiff = (signaturePriority[a.documentType] ?? 99) - (signaturePriority[b.documentType] ?? 99);
        if (priorityDiff !== 0) return priorityDiff;
        return getDateValue(b.updatedAt || b.createdAt) - getDateValue(a.updatedAt || a.createdAt);
      });
  };

  const getPrimaryStakeholderSignatureDoc = (stakeholder: Stakeholder) => {
    return getStakeholderSignatureDocuments(stakeholder)[0] || null;
  };

  const getCurrentAdvisorAgreementDoc = (stakeholderId: string) => {
    return getLatestRelevantDocuments(
      equityDocuments.filter(
        d =>
          d.stakeholderId === stakeholderId &&
          d.documentType === 'advisor_nso_agreement' &&
          d.status === 'completed'
      )
    )[0] || null;
  };

  const isStakeholderGrantLocked = (stakeholder: Stakeholder) => {
    if (stakeholder.type !== 'advisor') return false;
    const advisorAgreement = getCurrentAdvisorAgreementDoc(stakeholder.id);
    if (!advisorAgreement) return false;
    return getEquityDocSignatureState(advisorAgreement).isFullyExecuted;
  };

  const isEquityDocLockedForEditing = (equityDoc: EquityDocument) => {
    return requiresExternalSignature(equityDoc) && getEquityDocSignatureState(equityDoc).isFullyExecuted;
  };

  const getCurrentStakeholderGrantOptions = (stakeholder: Stakeholder) =>
    stakeholder.optionsGranted ||
    stakeholder.grants?.[0]?.numberOfShares ||
    stakeholder.totalShares ||
    0;

  const getCurrentStakeholderGrantDate = (stakeholder: Stakeholder) =>
    stakeholder.grants?.[0]?.vestingStartDate ||
    stakeholder.grants?.[0]?.grantDate ||
    stakeholder.startDate;

  // Start editing grant terms for a stakeholder
  const startEditingGrantTerms = (stakeholder: Stakeholder) => {
    if (isStakeholderGrantLocked(stakeholder)) {
      setMessage({
        type: 'info',
        text: 'This advisor grant is locked because the signature is complete. To issue more equity, create a separate new grant for this stakeholder.',
      });
      return;
    }

    setEditGrantOptionsValue(getCurrentStakeholderGrantOptions(stakeholder));
    setEditGrantDateValue(getDateInputValue(getCurrentStakeholderGrantDate(stakeholder)) || new Date().toISOString().split('T')[0]);
    setEditingGrantStakeholderId(stakeholder.id);
  };

  // Save updated grant options
  const saveGrantOptions = async (
    stakeholder: Stakeholder,
    options: {
      forceRegenerateDocuments?: boolean;
      optionsValue?: number;
      grantDateValue?: string;
    } = {}
  ) => {
    const nextOptionsValue = options.optionsValue ?? editGrantOptionsValue;
    const nextGrantDateValue = options.grantDateValue ?? editGrantDateValue;
    const forceRegenerateDocuments = Boolean(options.forceRegenerateDocuments);

    console.log('[saveGrantOptions] Function called with:', {
      stakeholderId: stakeholder.id,
      value: nextOptionsValue,
      forceRegenerateDocuments,
    });
    
    if (nextOptionsValue <= 0) {
      setMessage({ type: 'error', text: 'Options granted must be greater than 0' });
      return;
    }

    if (isStakeholderGrantLocked(stakeholder)) {
      setMessage({
        type: 'error',
        text: 'This advisor grant is fully executed and can no longer be edited. Add a separate new grant for any additional equity.',
      });
      setEditingGrantStakeholderId(null);
      return;
    }

    const oldOptions = getCurrentStakeholderGrantOptions(stakeholder);
    const currentAdvisorGrantDateValue =
      stakeholder.type === 'advisor'
        ? getDateInputValue(getCurrentStakeholderGrantDate(stakeholder))
        : '';
    const advisorGrantDateChanged =
      stakeholder.type === 'advisor' && currentAdvisorGrantDateValue !== nextGrantDateValue;

    if (stakeholder.type === 'advisor' && !parseDateInputValue(nextGrantDateValue)) {
      setMessage({ type: 'error', text: 'Choose a valid advisor grant / vesting date before saving.' });
      return;
    }

    if (nextOptionsValue === oldOptions && !advisorGrantDateChanged && !forceRegenerateDocuments) {
      setMessage({ type: 'info', text: 'No grant changes to save.' });
      return;
    }

    setIsSavingGrantOptions(true);
    try {
      const difference = nextOptionsValue - oldOptions;
      const revisedGrantDate =
        stakeholder.type === 'advisor'
          ? parseDateInputValue(nextGrantDateValue) || new Date()
          : new Date();
      const revisedGrantTimestamp = Timestamp.fromDate(revisedGrantDate);
      const revisedGrantDateIso = revisedGrantDate.toISOString();
      const revisedGrantDateLabel = formatLegalDate(revisedGrantDate);
      const optionsChanged = nextOptionsValue !== oldOptions;

      console.log('[saveGrantOptions] Starting update:', {
        stakeholderId: stakeholder.id,
        oldOptions,
        newOptions: nextOptionsValue,
        difference,
        revisedGrantDate: revisedGrantDateLabel,
        forceRegenerateDocuments,
      });

      // Update stakeholder
      const stakeholderUpdate: Record<string, any> = {
        optionsGranted: nextOptionsValue,
        optionsUnvested: nextOptionsValue - (stakeholder.optionsVested || 0),
        updatedAt: serverTimestamp(),
      };

      if (stakeholder.type === 'advisor') {
        stakeholderUpdate.startDate = revisedGrantTimestamp;
      }

      // Also update totalShares for backward compatibility
      if (!stakeholder.optionsGranted && stakeholder.totalShares) {
        stakeholderUpdate.totalShares = nextOptionsValue;
        stakeholderUpdate.totalUnvested = nextOptionsValue - (stakeholder.totalVested || 0);
      }

      try {
        await updateDoc(doc(db, 'equity-stakeholders', stakeholder.id), stakeholderUpdate);
        console.log('[saveGrantOptions] Stakeholder updated successfully');
      } catch (stakeholderError: any) {
        console.error('[saveGrantOptions] Failed to update stakeholder:', stakeholderError);
        throw new Error(`Failed to update stakeholder: ${stakeholderError.message}`);
      }

      // If stakeholder has grants, update the first grant's numberOfShares
      if (stakeholder.grants && stakeholder.grants.length > 0) {
        const grantId = stakeholder.grants[0].id;
        try {
          await updateDoc(doc(db, 'equity-grants', grantId), {
            numberOfShares: nextOptionsValue,
            unvestedShares: nextOptionsValue - (stakeholder.grants[0].vestedShares || 0),
            ...(stakeholder.type === 'advisor'
              ? { grantDate: revisedGrantTimestamp, vestingStartDate: revisedGrantTimestamp }
              : {}),
            updatedAt: serverTimestamp(),
          });
          console.log('[saveGrantOptions] Grant updated:', grantId);
        } catch (grantError) {
          console.warn('[saveGrantOptions] Failed to update grant (may not exist):', grantError);
          // Continue even if grant update fails
        }
      }

      // Build grant details for document generation
      const grant = stakeholder.grants?.[0];
      const grantDetails = grant ? {
        equityType: grant.equityType || 'nso',
        numberOfShares: nextOptionsValue,
        strikePrice: grant.strikePrice || 0.001,
        vestingSchedule: grant.vestingSchedule || 'monthly',
        vestingStartDate: stakeholder.type === 'advisor' ? revisedGrantDateIso : (grant.vestingStartDate || stakeholder.startDate),
        cliffMonths: grant.cliffMonths || 3,
        vestingMonths: grant.vestingMonths || 24,
      } : {
        equityType: 'nso',
        numberOfShares: nextOptionsValue,
        strikePrice: 0.001,
        vestingSchedule: 'monthly',
        vestingStartDate: stakeholder.type === 'advisor' ? revisedGrantDateIso : stakeholder.startDate,
        cliffMonths: 3,
        vestingMonths: 24,
      };

      const revisedBoardApprovalDate = revisedGrantDateLabel;
      let effectiveBoardApprovalDate = revisedBoardApprovalDate;
      let effectiveBoardConsentDocId = stakeholder.boardConsentDocId || null;

      let regeneratedDocCount = 0;
      let newDocsCreated = 0;

      // ============================================
      // 1. Handle Board Consent Document
      // ============================================
      const boardConsentDoc = equityDocuments.find(d => 
        d.id === stakeholder.boardConsentDocId ||
        (d.stakeholderId === stakeholder.id && d.documentType === 'board_consent' && d.status === 'completed')
      );

      if (boardConsentDoc) {
        const boardDocState = getEquityDocSignatureState(boardConsentDoc);
        const boardConsentExecuted = Boolean(boardConsentDoc.autoSigned || boardConsentDoc.autoSignedAt) || boardDocState.isFullyExecuted;
        const canRefreshBoardConsentInPlace =
          Boolean(boardConsentDoc.autoSigned || boardConsentDoc.autoSignedAt) &&
          (advisorGrantDateChanged || forceRegenerateDocuments) &&
          !optionsChanged;

        if (boardConsentExecuted && !canRefreshBoardConsentInPlace && forceRegenerateDocuments && !optionsChanged) {
          console.log('[saveGrantOptions] Skipping locked Board Consent refresh because no terms changed');
        } else if (boardConsentExecuted && !canRefreshBoardConsentInPlace) {
          console.log('[saveGrantOptions] Board Consent is executed, creating amendment');
          setMessage({ type: 'info', text: 'Creating auto-executed Board Consent Amendment...' });

          try {
            const amendmentTitle = `Board Consent Amendment - ${stakeholder.name} (Options: ${formatNumber(nextOptionsValue)})`;
            const placeholder = await addDoc(collection(db, 'equity-documents'), {
              title: amendmentTitle,
              prompt: `Generate a Board Consent Amendment to update the previously approved equity grant for ${stakeholder.name} from ${formatNumber(oldOptions)} options to ${formatNumber(nextOptionsValue)} options.`,
              content: '',
              documentType: 'board_consent',
              requiresSignature: false,
              stakeholderId: stakeholder.id,
              stakeholderName: stakeholder.name,
              stakeholderEmail: stakeholder.email,
              stakeholderType: stakeholder.type,
              grantDetails,
              isAmendment: true,
              originalDocumentId: boardConsentDoc.id,
              autoSigned: true,
              autoSignedAt: Timestamp.now(),
              createdAt: Timestamp.now(),
              status: 'generating',
            });

            const { result } = await postEquityFunctionJson('/.netlify/functions/generate-equity-document', {
              stakeholderId: stakeholder.id,
              stakeholderName: stakeholder.name,
              stakeholderEmail: stakeholder.email,
              stakeholderType: stakeholder.type,
              documentType: 'board_consent',
              requiresSignature: false,
              isAmendment: true,
              previousOptionsAmount: oldOptions,
              newOptionsAmount: nextOptionsValue,
              prompt: `Generate a Board Consent Amendment to update the previously approved equity grant for ${stakeholder.name}. The original grant was for ${formatNumber(oldOptions)} Non-Qualified Stock Options. This amendment approves increasing the grant to ${formatNumber(nextOptionsValue)} Non-Qualified Stock Options. Include all standard board consent language and signature lines.`,
              boardApprovalDate: revisedBoardApprovalDate,
              documentDate: revisedBoardApprovalDate,
              grantDetails,
            });

            if (result.success && result.content) {
              await updateDoc(doc(db, 'equity-documents', placeholder.id), {
                content: result.content,
                title: result.title || amendmentTitle,
                requiresSignature: false,
                autoSigned: true,
                autoSignedAt: serverTimestamp(),
                status: 'completed',
                updatedAt: serverTimestamp(),
              });
              effectiveBoardApprovalDate = revisedBoardApprovalDate;
              effectiveBoardConsentDocId = placeholder.id;
              console.log('[saveGrantOptions] Board Consent Amendment created:', placeholder.id);
              newDocsCreated++;
            } else {
              await updateDoc(doc(db, 'equity-documents', placeholder.id), {
                status: 'error',
                errorMessage: result.error || 'Failed to generate amendment',
              });
              console.error('[saveGrantOptions] Failed to create Board Consent Amendment');
            }
          } catch (amendError) {
            console.error('[saveGrantOptions] Error creating Board Consent Amendment:', amendError);
          }
        } else {
          console.log('[saveGrantOptions] Updating in-flight Board Consent with new options');
          setMessage({
            type: 'info',
            text: optionsChanged
              ? 'Updating Board Consent with the new grant terms...'
              : forceRegenerateDocuments
              ? 'Refreshing Board Consent from the current grant terms...'
              : 'Refreshing Board Consent with the updated approval date...',
          });

          try {
            if (boardDocState.hasSignatureFlow) {
              await invalidateSigningRequestsForDoc(
                boardConsentDoc,
                `Invalidated because ${stakeholder.name}'s equity terms changed before the Board Consent was fully executed.`
              );
            }

            await updateDoc(doc(db, 'equity-documents', boardConsentDoc.id), {
              grantDetails,
              requiresSignature: false,
              autoSigned: true,
              autoSignedAt: serverTimestamp(),
              signingRequestId: deleteField(),
              signingRequestIds: deleteField(),
              needsResendSignature: false,
              status: 'generating',
              updatedAt: serverTimestamp(),
            });

            const { result } = await postEquityFunctionJson('/.netlify/functions/generate-equity-document', {
              stakeholderId: stakeholder.id,
              stakeholderName: stakeholder.name,
              stakeholderEmail: stakeholder.email,
              stakeholderType: stakeholder.type,
              documentType: 'board_consent',
              requiresSignature: false,
              prompt: `Generate a Board Consent approving equity grants. For ${stakeholder.name}: ${formatNumber(nextOptionsValue)} Non-Qualified Stock Options with ${grantDetails.vestingMonths} month vesting and ${grantDetails.cliffMonths} month cliff.`,
              boardApprovalDate: revisedBoardApprovalDate,
              documentDate: revisedBoardApprovalDate,
              grantDetails,
            });

            if (result.success && result.content) {
              await updateDoc(doc(db, 'equity-documents', boardConsentDoc.id), {
                content: result.content,
                title: result.title || boardConsentDoc.title,
                requiresSignature: false,
                autoSigned: true,
                autoSignedAt: serverTimestamp(),
                status: 'completed',
                grantDetails,
                updatedAt: serverTimestamp(),
              });
              effectiveBoardApprovalDate = revisedBoardApprovalDate;
              effectiveBoardConsentDocId = boardConsentDoc.id;
              console.log('[saveGrantOptions] Board Consent regenerated:', boardConsentDoc.id);
              regeneratedDocCount++;
            } else {
              await updateDoc(doc(db, 'equity-documents', boardConsentDoc.id), {
                status: 'error',
                errorMessage: result.error || 'Failed to regenerate',
              });
            }
          } catch (docError) {
            console.error('[saveGrantOptions] Error regenerating Board Consent:', docError);
          }
        }
      }

      if (effectiveBoardApprovalDate !== stakeholder.boardApprovalDate || effectiveBoardConsentDocId !== stakeholder.boardConsentDocId) {
        await updateDoc(doc(db, 'equity-stakeholders', stakeholder.id), {
          boardApprovalDate: effectiveBoardApprovalDate,
          boardConsentDocId: effectiveBoardConsentDocId,
          updatedAt: serverTimestamp(),
        });
      }

      // ============================================
      // 2. Handle Advisor Agreement / NSO Grant Document
      // ============================================
      const stakeholderDocs = getLatestRelevantDocuments(
        equityDocuments.filter(d => 
          d.stakeholderId === stakeholder.id && 
          d.documentType === 'advisor_nso_agreement' &&
          d.status === 'completed'
        )
      );

      for (const equityDoc of stakeholderDocs) {
        const docSigningState = getEquityDocSignatureState(equityDoc);
        const isSigned = docSigningState.isFullyExecuted;
        const hasBeenSent = docSigningState.hasBeenSent;

        if (isSigned) {
          throw new Error('This advisor grant has already been signed. Add a separate new grant for this stakeholder instead of editing the executed grant.');
        } else {
          // Document not fully executed - regenerate the existing document and force a resend
          console.log('[saveGrantOptions] Regenerating Advisor Agreement');
          setMessage({
            type: 'info',
            text: hasBeenSent
              ? 'Invalidating old signature links and regenerating the Advisor Agreement...'
              : optionsChanged
              ? 'Regenerating Advisor Agreement with updated grant terms...'
              : forceRegenerateDocuments
              ? 'Refreshing Advisor Agreement from the current grant terms...'
              : 'Regenerating Advisor Agreement with the updated grant date...',
          });

          try {
            const updatedGrantDetails = {
              ...(equityDoc.grantDetails || {}),
              numberOfShares: nextOptionsValue,
              ...(stakeholder.type === 'advisor' ? { vestingStartDate: revisedGrantDateIso } : {}),
            };

            let invalidatedRequestCount = 0;
            if (docSigningState.hasSignatureFlow) {
              invalidatedRequestCount = await invalidateSigningRequestsForDoc(
                equityDoc,
                `Invalidated because ${stakeholder.name}'s equity grant changed before the document was fully executed.`
              );
            }

            await updateDoc(doc(db, 'equity-documents', equityDoc.id), {
              grantDetails: updatedGrantDetails,
              signingRequestId: deleteField(),
              signingRequestIds: deleteField(),
              needsResendSignature: invalidatedRequestCount > 0,
              status: 'generating',
              updatedAt: serverTimestamp(),
            });

            const { result } = await postEquityFunctionJson('/.netlify/functions/generate-equity-document', {
              stakeholderId: stakeholder.id,
              stakeholderName: stakeholder.name,
              stakeholderEmail: stakeholder.email,
              stakeholderType: stakeholder.type,
              documentType: 'advisor_nso_agreement',
              requiresSignature: true,
              boardApprovalDate: effectiveBoardApprovalDate,
              prompt: `Generate a combined Advisor Services Agreement and Non-Qualified Stock Option Grant for ${stakeholder.name}. The grant is for ${formatNumber(nextOptionsValue)} Non-Qualified Stock Options.`,
              grantDetails: updatedGrantDetails,
            });

            if (result.success && result.content) {
              await updateDoc(doc(db, 'equity-documents', equityDoc.id), {
                content: result.content,
                title: result.title || equityDoc.title,
                status: 'completed',
                grantDetails: updatedGrantDetails,
                needsResendSignature: invalidatedRequestCount > 0,
                updatedAt: serverTimestamp(),
              });
              console.log('[saveGrantOptions] Advisor Agreement regenerated:', equityDoc.id);
              regeneratedDocCount++;
            } else {
              await updateDoc(doc(db, 'equity-documents', equityDoc.id), {
                status: 'error',
                errorMessage: result.error || 'Failed to regenerate document',
                updatedAt: serverTimestamp(),
              });
              console.error('[saveGrantOptions] Failed to regenerate document:', result.error);
            }
          } catch (docError: any) {
            console.error('[saveGrantOptions] Error regenerating document:', docError);
          }
        }
      }

      // Update equity pool (only if pool exists and we have an ID)
      if (equityPool.id) {
        const newGranted = (equityPool.granted || 0) + difference;
        const newAvailable = equityPool.totalReserved - newGranted - (equityPool.exercised || 0);
        try {
          await updateDoc(doc(db, 'equity-pool', equityPool.id), {
            granted: newGranted,
            available: newAvailable,
            updatedAt: serverTimestamp(),
          });
          console.log('[saveGrantOptions] Equity pool updated');
        } catch (poolError) {
          console.warn('[saveGrantOptions] Failed to update equity pool:', poolError);
          // Continue even if pool update fails
        }
      } else {
        console.warn('[saveGrantOptions] No equity pool ID found, skipping pool update');
      }

      // Update local state
      setStakeholders(prev => prev.map(s => 
        s.id === stakeholder.id 
          ? { 
              ...s, 
              optionsGranted: nextOptionsValue,
              optionsUnvested: nextOptionsValue - (s.optionsVested || 0),
              ...(s.type === 'advisor'
                ? {
                    startDate: revisedGrantTimestamp,
                    boardApprovalDate: effectiveBoardApprovalDate,
                    boardConsentDocId: effectiveBoardConsentDocId,
                  }
                : {}),
              totalShares: s.totalShares ? nextOptionsValue : s.totalShares,
              totalUnvested: s.totalShares ? nextOptionsValue - (s.totalVested || 0) : s.totalUnvested,
              grants: s.grants?.map((g, idx) => 
                idx === 0 
                  ? {
                      ...g,
                      numberOfShares: nextOptionsValue,
                      unvestedShares: nextOptionsValue - (g.vestedShares || 0),
                      ...(s.type === 'advisor'
                        ? { grantDate: revisedGrantTimestamp, vestingStartDate: revisedGrantTimestamp }
                        : {}),
                    }
                  : g
              )
            }
          : s
      ));

      if (equityPool.id) {
        setEquityPool(prev => ({
          ...prev,
          granted: (prev.granted || 0) + difference,
          available: prev.totalReserved - ((prev.granted || 0) + difference) - (prev.exercised || 0),
        }));
      }

      // Build success message based on what was done
      let successMessage = forceRegenerateDocuments && !optionsChanged && !advisorGrantDateChanged
        ? 'Documents refreshed from current grant terms'
        : optionsChanged
        ? `Grant updated to ${formatNumber(nextOptionsValue)} options`
        : `Grant / vesting date updated to ${revisedGrantDateLabel}`;

      if (advisorGrantDateChanged && optionsChanged) {
        successMessage += ` with a ${revisedGrantDateLabel} vesting start`;
      }
      const docActions: string[] = [];
      
      if (regeneratedDocCount > 0) {
        docActions.push(`${regeneratedDocCount} document${regeneratedDocCount > 1 ? 's' : ''} updated`);
      }
      if (newDocsCreated > 0) {
        docActions.push(`${newDocsCreated} amendment${newDocsCreated > 1 ? 's' : ''} created (requires new signature)`);
      }
      
      if (docActions.length > 0) {
        successMessage += ` — ${docActions.join(', ')}`;
      }
      
      setMessage({ type: 'success', text: successMessage });
      setEditingGrantStakeholderId(null);
      setEditGrantDateValue(new Date().toISOString().split('T')[0]);
      console.log('[saveGrantOptions] Update completed successfully');
      
      // Auto-dismiss success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
      
      // Reload data to ensure UI is in sync
      setTimeout(() => loadData(), 500);
    } catch (error: any) {
      console.error('[saveGrantOptions] Error updating grant options:', error);
      const errorMessage = error?.message || 'Failed to update options. Please try again.';
      setMessage({ type: 'error', text: `Error: ${errorMessage}` });
      // Auto-dismiss error message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsSavingGrantOptions(false);
    }
  };

  // Render Stakeholders Tab
  const renderStakeholders = () => (
    <div className="space-y-6">
      {/* Equity Pool Card - Reserve Ledger (NOT a stakeholder) */}
      <GlassCard accentColor="#10B981">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <PieChart className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">Option Pool (Reserved)</h3>
                <p className="text-zinc-500 text-sm">Equity Incentive Plan Reserve</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-700">
              <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Pool Size</p>
              <p className="text-white font-semibold text-xl">{formatNumber(equityPool.totalReserved)}</p>
            </div>
            <div className="p-4 bg-emerald-900/20 rounded-xl border border-emerald-700">
              <p className="text-emerald-400 text-xs uppercase tracking-wide mb-1">Available</p>
              <p className="text-emerald-300 font-semibold text-xl">{formatNumber(equityPool.available)}</p>
            </div>
            <div className="p-4 bg-amber-900/20 rounded-xl border border-amber-700">
              <p className="text-amber-400 text-xs uppercase tracking-wide mb-1">Granted (Unvested)</p>
              <p className="text-amber-300 font-semibold text-xl">{formatNumber(equityPool.granted)}</p>
            </div>
            <div className="p-4 bg-blue-900/20 rounded-xl border border-blue-700">
              <p className="text-blue-400 text-xs uppercase tracking-wide mb-1">Exercised (Issued)</p>
              <p className="text-blue-300 font-semibold text-xl">{formatNumber(equityPool.exercised)}</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Stakeholders</h3>
        <button
          onClick={() => setIsAddStakeholderModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-xl font-medium hover:bg-[#d4f00f] transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add Stakeholder
        </button>
      </div>

      {/* Stakeholder List */}
      <div className="space-y-4">
        {stakeholders.length === 0 ? (
          <GlassCard accentColor="#8B5CF6">
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <h4 className="text-xl font-semibold text-white mb-2">No Stakeholders Yet</h4>
              <p className="text-zinc-500 mb-6 max-w-md mx-auto">
                Initialize with your current cap table data or start from scratch.
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={seedDefaultData}
                  disabled={seeding}
                  className="flex items-center gap-2 px-6 py-3 bg-[#E0FE10] text-black rounded-xl font-semibold hover:bg-[#d4f00f] transition-colors"
                >
                  {seeding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Initialize Cap Table
                    </>
                  )}
                </button>
                <button
                  onClick={() => setIsAddStakeholderModalOpen(true)}
                  className="px-6 py-3 bg-zinc-800 text-white rounded-xl font-semibold hover:bg-zinc-700 transition-colors"
                >
                  Add Manually
                </button>
              </div>
            </div>
          </GlassCard>
        ) : (
          stakeholders.map((stakeholder) => {
            const typeConfig = getStakeholderTypeConfig(stakeholder.type);
            const isExpanded = expandedStakeholder === stakeholder.id;
            
            return (
              <GlassCard key={stakeholder.id} accentColor={typeConfig.color}>
                <div className="p-5">
                  {/* Main Row */}
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedStakeholder(isExpanded ? null : stakeholder.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                        style={{ backgroundColor: `${typeConfig.color}20`, border: `1px solid ${typeConfig.color}40` }}
                      >
                        {typeConfig.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className="text-white font-semibold">{stakeholder.name}</h4>
                          <span 
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ 
                              backgroundColor: `${typeConfig.color}20`, 
                              color: typeConfig.color,
                              border: `1px solid ${typeConfig.color}40`
                            }}
                          >
                            {typeConfig.label}
                          </span>
                        </div>
                        <p className="text-zinc-500 text-sm">{stakeholder.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      {(() => {
                        const metrics = getStakeholderMetrics(stakeholder);
                        return (
                          <>
                            <div className="text-right">
                              <p className="text-white font-semibold text-lg">{formatNumber(metrics.primaryValue)}</p>
                              <p className="text-zinc-500 text-sm">{metrics.primaryLabel}</p>
                            </div>
                            {metrics.showOwnership && (
                              <div className="text-right hidden md:block">
                                <p className="text-white font-semibold">{formatPercentage(stakeholder.ownershipPercentage || 0)}</p>
                                <p className="text-zinc-500 text-sm">Ownership</p>
                              </div>
                            )}
                            {!metrics.showOwnership && stakeholder.grants && stakeholder.grants.length > 0 && (
                              <div className="text-right hidden md:block">
                                <p className="text-white font-semibold">{stakeholder.grants.length}</p>
                                <p className="text-zinc-500 text-sm">Grant{stakeholder.grants.length !== 1 ? 's' : ''}</p>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-5 h-5 text-zinc-500" />
                      </motion.div>
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-5 mt-5 border-t border-zinc-800">
                          {/* Vesting Progress */}
                          {(() => {
                            const metrics = getStakeholderMetrics(stakeholder);
                            const isOptionHolder = !metrics.showOwnership && metrics.primaryLabel === 'Options Granted';
                            const vested = isOptionHolder ? (stakeholder.optionsVested || 0) : (stakeholder.totalVested || 0);
                            const unvested = isOptionHolder ? (stakeholder.optionsUnvested || metrics.primaryValue) : (stakeholder.totalUnvested || 0);
                            
                            return (
                              <div className="mb-6">
                                <h5 className="text-zinc-400 text-sm mb-3">
                                  {isOptionHolder ? 'Options Vesting Progress' : 'Vesting Progress'}
                                </h5>
                                <VestingProgressBar
                                  vested={vested}
                                  unvested={unvested}
                                  color={typeConfig.color}
                                />
                                {isOptionHolder && (
                                  <div className="flex items-center justify-between mt-2 text-xs">
                                    <span className="text-zinc-500">{formatNumber(vested)} vested</span>
                                    <span className="text-zinc-500">{formatNumber(unvested)} unvested</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          
                          {/* Quick Stats */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="p-3 rounded-lg bg-zinc-800/50">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-zinc-500 text-xs mb-1">Start Date</p>
                                  <p className="text-white font-medium">{formatDate(stakeholder.startDate)}</p>
                                </div>
                                {stakeholder.type === 'advisor' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditingGrantTerms(stakeholder);
                                    }}
                                    disabled={isStakeholderGrantLocked(stakeholder)}
                                    title="Update grant date and regenerate active documents"
                                    aria-label="Update grant date"
                                    className="shrink-0 flex items-center gap-1 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-md text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Calendar className="w-3 h-3" />
                                    Update
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="p-3 rounded-lg bg-zinc-800/50">
                              <p className="text-zinc-500 text-xs mb-1">Title / Role</p>
                              <p className="text-white font-medium">{stakeholder.title || 'N/A'}</p>
                            </div>
                            {stakeholder.type === 'advisor' && stakeholder.grants?.[0] && (
                              <>
                                <div className="p-3 rounded-lg bg-zinc-800/50">
                                  <p className="text-zinc-500 text-xs mb-1">Vesting</p>
                                  <p className="text-white font-medium">{stakeholder.grants[0].vestingMonths || 24} months</p>
                                </div>
                                <div className="p-3 rounded-lg bg-zinc-800/50">
                                  <p className="text-zinc-500 text-xs mb-1">Cliff</p>
                                  <p className="text-white font-medium">{stakeholder.grants[0].cliffMonths || 3} months</p>
                                </div>
                              </>
                            )}
                            {stakeholder.type !== 'advisor' && (
                              <>
                                <div className="p-3 rounded-lg bg-zinc-800/50">
                                  <p className="text-zinc-500 text-xs mb-1">Grants</p>
                                  <p className="text-white font-medium">{stakeholder.grants?.length || 0}</p>
                                </div>
                                <div className="p-3 rounded-lg bg-zinc-800/50">
                                  <p className="text-zinc-500 text-xs mb-1">Documents</p>
                                  <p className="text-white font-medium">{stakeholder.documents?.length || 0}</p>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Edit Grant Terms (only for option holders, and only if documents haven't been signed) */}
                          {['advisor', 'employee', 'contractor'].includes(stakeholder.type) && (
                            <div className="mb-6 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
                              {(() => {
                                const grantLocked = isStakeholderGrantLocked(stakeholder);
                                const currentGrantOptions = getCurrentStakeholderGrantOptions(stakeholder);
                                const currentGrantDate = getCurrentStakeholderGrantDate(stakeholder);
                                const currentGrantDateInputValue = getDateInputValue(currentGrantDate) || new Date().toISOString().split('T')[0];
                                const canRefreshDocuments = stakeholder.type === 'advisor' && !grantLocked;
                                return (
                                  <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div>
                                      <h5 className="text-sm font-semibold text-white flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-blue-400" />
                                        Grant Terms
                                      </h5>
                                      <p className="text-xs text-zinc-500 mt-1">
                                        {grantLocked
                                          ? 'This grant is locked because the advisor agreement has already been signed. Issue any additional equity as a separate new grant for this stakeholder.'
                                          : 'Update options or the grant date here. Saving regenerates active documents and refreshes stale signature links.'}
                                      </p>
                                    </div>

                                    {editingGrantStakeholderId === stakeholder.id ? (
                                      <div className="flex items-end gap-2 flex-wrap justify-end">
                                        <label className="block">
                                          <span className="block text-[11px] text-zinc-500 mb-1">Options</span>
                                          <input
                                            type="number"
                                            value={editGrantOptionsValue}
                                            onChange={(e) => setEditGrantOptionsValue(parseInt(e.target.value) || 0)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-32 px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                                            min={1}
                                          />
                                        </label>
                                        {stakeholder.type === 'advisor' && (
                                          <>
                                            <label className="block">
                                              <span className="block text-[11px] text-zinc-500 mb-1">Grant / Vesting Date</span>
                                              <input
                                                type="date"
                                                value={editGrantDateValue}
                                                onChange={(e) => setEditGrantDateValue(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                aria-label="Advisor grant and vesting date"
                                                className="px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                                              />
                                            </label>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditGrantDateValue(new Date().toISOString().split('T')[0]);
                                              }}
                                              type="button"
                                              title="Set the advisor grant and vesting date to today"
                                              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs transition-colors"
                                            >
                                              Today
                                            </button>
                                          </>
                                        )}
                                        <button
                                          onClick={(e) => { e.stopPropagation(); saveGrantOptions(stakeholder); }}
                                          disabled={isSavingGrantOptions || (stakeholder.type === 'advisor' && !editGrantDateValue)}
                                          title="Save grant terms and update active documents"
                                          className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                                        >
                                          {isSavingGrantOptions ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                          ) : (
                                            <Check className="w-4 h-4" />
                                          )}
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingGrantStakeholderId(null);
                                          }}
                                          className="flex items-center gap-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-3 flex-wrap justify-end">
                                        <div className="text-right">
                                          <p className="text-white font-semibold text-lg leading-none">{formatNumber(currentGrantOptions)}</p>
                                          <p className="text-[11px] text-zinc-500 mt-1">Options</p>
                                        </div>
                                        {stakeholder.type === 'advisor' && (
                                          <div className="text-right">
                                            <p className="text-white font-semibold text-sm leading-none">{formatDate(currentGrantDate)}</p>
                                            <p className="text-[11px] text-zinc-500 mt-1">Grant Date</p>
                                          </div>
                                        )}
                                        <button
                                          onClick={(e) => { e.stopPropagation(); startEditingGrantTerms(stakeholder); }}
                                          disabled={grantLocked}
                                          className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs transition-colors ${
                                            grantLocked
                                              ? 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed'
                                              : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-500/40'
                                          }`}
                                        >
                                          <Edit3 className="w-3 h-3" />
                                          {grantLocked ? 'Locked After Signature' : 'Edit Terms'}
                                        </button>
                                        {canRefreshDocuments && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              saveGrantOptions(stakeholder, {
                                                forceRegenerateDocuments: true,
                                                optionsValue: currentGrantOptions,
                                                grantDateValue: currentGrantDateInputValue,
                                              });
                                            }}
                                            disabled={isSavingGrantOptions}
                                            title="Regenerate active documents from current grant terms"
                                            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 border border-zinc-600 rounded-lg text-xs transition-colors disabled:opacity-50"
                                          >
                                            {isSavingGrantOptions ? (
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <RefreshCw className="w-3 h-3" />
                                            )}
                                            Refresh Docs
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Board Consent Link + Verify (Advisors) */}
                          {stakeholder.type === 'advisor' && (
                            <div className="mb-6 p-4 rounded-xl bg-amber-900/10 border border-amber-700/40">
                              <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div>
                                  <h5 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                                    <Scale className="w-4 h-4" />
                                    Board Consent (Required)
                                  </h5>
                                  <p className="text-xs text-zinc-500 mt-1">
                                    Select a Board Consent, verify it matches this grant, then generate the agreement.
                                  </p>
                                </div>
                                {boardConsentVerification[stakeholder.id]?.status === 'verified' && (
                                  <span className="px-2 py-1 rounded-full text-xs bg-green-900/40 text-green-300 border border-green-700">
                                    ✓ Verified {boardConsentVerification[stakeholder.id]?.approvalDate ? `(${boardConsentVerification[stakeholder.id]?.approvalDate})` : ''}
                                  </span>
                                )}
                              </div>

                              <div className="mt-4 space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
                                  <div>
                                    <label className="block text-xs text-zinc-400 mb-2">Board Consent Document</label>
                                    <select
                                      value={
                                        boardConsentSelection[stakeholder.id] ??
                                        (stakeholder.boardConsentDocId ?? '')
                                      }
                                      onChange={(e) => {
                                        const selectedId = e.target.value;
                                        setBoardConsentSelection(prev => ({ ...prev, [stakeholder.id]: selectedId }));
                                        // Reset verification state when changing selection
                                        setBoardConsentVerification(prev => ({ ...prev, [stakeholder.id]: { status: 'idle' } }));
                                      }}
                                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                                    >
                                      <option value="">Select Board Consent…</option>
                                      {getLatestRelevantDocuments(
                                        equityDocuments.filter(d => d.documentType === 'board_consent' && d.status === 'completed')
                                      )
                                        .map(d => (
                                          <option key={d.id} value={d.id}>
                                            {d.title} ({formatDate(d.createdAt)})
                                          </option>
                                        ))}
                                    </select>
                                  </div>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGenerateBoardConsent(stakeholder);
                                    }}
                                    disabled={generating}
                                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                      generating
                                        ? 'bg-zinc-700 text-zinc-300 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-500'
                                    }`}
                                  >
                                    {generating ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Generating…
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="w-4 h-4" />
                                        Generate
                                      </>
                                    )}
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const selectedId = boardConsentSelection[stakeholder.id] ?? (stakeholder.boardConsentDocId ?? '');
                                      if (!selectedId) {
                                        setMessage({ type: 'error', text: 'Please select a Board Consent to verify.' });
                                        return;
                                      }
                                      verifyAndLinkBoardConsent(stakeholder, selectedId);
                                    }}
                                    disabled={boardConsentVerification[stakeholder.id]?.status === 'verifying' || !(boardConsentSelection[stakeholder.id] ?? stakeholder.boardConsentDocId)}
                                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                      boardConsentVerification[stakeholder.id]?.status === 'verifying'
                                        ? 'bg-zinc-700 text-zinc-300 cursor-not-allowed'
                                        : 'bg-amber-600 text-white hover:bg-amber-500'
                                    }`}
                                  >
                                    {boardConsentVerification[stakeholder.id]?.status === 'verifying' ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Verifying…
                                      </>
                                    ) : (
                                      <>
                                        <ClipboardCheck className="w-4 h-4" />
                                        Verify
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Verification feedback */}
                              {boardConsentVerification[stakeholder.id]?.status === 'failed' && (
                                <div className="mt-4 p-3 rounded-lg bg-red-900/20 border border-red-800">
                                  <p className="text-sm text-red-300 font-medium">Verification failed</p>
                                  {boardConsentVerification[stakeholder.id]?.issues?.length ? (
                                    <ul className="mt-2 space-y-1">
                                      {boardConsentVerification[stakeholder.id]?.issues?.slice(0, 6).map((issue, idx) => (
                                        <li key={idx} className="text-xs text-red-200 flex items-start gap-2">
                                          <span className="mt-0.5 text-red-400">•</span>
                                          <span>{issue}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-xs text-red-200 mt-2">Please double-check the selected Board Consent.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Attached Documents for this stakeholder */}
                          {(() => {
                            const stakeholderDocs = getStakeholderVisibleDocuments(stakeholder.id);
                            
                            if (stakeholderDocs.length > 0) {
                              return (
                                <div className="space-y-3 mb-4">
                                  <h5 className="text-zinc-400 text-sm font-medium">Documents</h5>
                                  {stakeholderDocs.map((edoc) => {
                                    const historyDocs = getDocumentFamilyHistory(edoc, getStakeholderCompletedDocuments(stakeholder.id));
                                    const revisionEntries = getEquityDocumentRevisionEntries(edoc);
                                    const historyCount = historyDocs.length + revisionEntries.length;
                                    const docState = getEquityDocSignatureState(edoc);
                                    const signingRequest = docState.activeRequests[0];
                                    const statusBadge = getEquityDocStatusBadge(edoc);
                                    const needsSignature = requiresExternalSignature(edoc);
                                    const canManageSignature = needsSignature && !docState.isFullyExecuted;
                                    return (
                                      <div key={edoc.id} className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
                                        <div className="flex items-start justify-between gap-4 mb-3">
                                          <div>
                                            <p className="text-white font-medium">{edoc.title}</p>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                              <span className="px-2 py-0.5 rounded-full text-xs bg-green-900/50 text-green-400 border border-green-700">
                                                ✓ Completed
                                              </span>
                                              {edoc.isAmendment && (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-fuchsia-900/40 text-fuchsia-300 border border-fuchsia-700">
                                                  Amendment
                                                </span>
                                              )}
                                              {isProtectedStakeholderDocument(edoc) && (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-900/40 text-cyan-300 border border-cyan-700">
                                                  Required
                                                </span>
                                              )}
                                              {needsSignature && (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-orange-900/50 text-orange-400 border border-orange-700">
                                                  Signature Required
                                                </span>
                                              )}
                                              {statusBadge && (
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge.className}`}>
                                                  {statusBadge.label}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); window.open(`/equity-doc/${edoc.id}`, '_blank'); }}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-xs transition-colors"
                                          >
                                            <Eye className="w-3 h-3" />
                                            Preview
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); openAuditModal(edoc); }}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-lg text-xs transition-colors"
                                          >
                                            <ClipboardCheck className="w-3 h-3" />
                                            Audit
                                          </button>
                                          {canManageSignature && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); openSigningModal(edoc); }}
                                              className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs transition-colors"
                                            >
                                              <Send className="w-3 h-3" />
                                              {docState.needsResend || signingRequest ? 'Resend Signature Email' : 'Send for Signature'}
                                            </button>
                                          )}
                                          {signingRequest && needsSignature && !docState.isFullyExecuted && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); window.open(`/sign/${signingRequest.id}`, '_blank'); }}
                                              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-xs transition-colors"
                                            >
                                              <Eye className="w-3 h-3" />
                                              View Signing Page
                                            </button>
                                          )}
                                          {signingRequest && needsSignature && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); copySigningLink(signingRequest.id); }}
                                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs transition-colors"
                                            >
                                              <Copy className="w-3 h-3" />
                                              Copy Link
                                            </button>
                                          )}
                                          {signingRequest && needsSignature && docState.isFullyExecuted && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); window.open(`/sign/${signingRequest.id}?download=true`, '_blank'); }}
                                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs transition-colors"
                                            >
                                              <Download className="w-3 h-3" />
                                              Download Signed
                                            </button>
                                          )}
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleShareEquityDoc(edoc); }}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs transition-colors"
                                          >
                                            <Share2 className="w-3 h-3" />
                                            Share
                                          </button>
                                          {historyCount > 0 && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); openDocHistoryModal(edoc); }}
                                              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-xs transition-colors"
                                            >
                                              <Clock className="w-3 h-3" />
                                              History ({historyCount})
                                            </button>
                                          )}
                                          <button
                                            onClick={(e) => { e.stopPropagation(); generatePdfFromEquityDoc(edoc, getExhibitDocuments(edoc.id)); }}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-[#E0FE10] text-black hover:bg-[#d4f00f] rounded-lg text-xs font-medium transition-colors"
                                          >
                                            <Download className="w-3 h-3" />
                                            Download PDF
                                          </button>
                                          {!isProtectedStakeholderDocument(edoc) && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); handleDeleteEquityDoc(edoc.id); }}
                                              disabled={deletingEquityDocId === edoc.id}
                                              className="flex items-center gap-1 px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-400 rounded-lg text-xs transition-colors disabled:opacity-50"
                                            >
                                              {deletingEquityDocId === edoc.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                              ) : (
                                                <Trash2 className="w-3 h-3" />
                                              )}
                                            </button>
                                          )}
                                        </div>
                                        {/* Preview content */}
                                        {expandedEquityDoc === edoc.id && (
                                          <div className="mt-4 p-4 bg-zinc-900 rounded-lg border border-zinc-700 max-h-64 overflow-y-auto">
                                            <div className="prose prose-invert prose-sm max-w-none">
                                              <div
                                                className="text-zinc-200 leading-relaxed"
                                                dangerouslySetInnerHTML={{ __html: formatContentForPdf(edoc.content) }}
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Actions */}
                          <div className="flex items-center gap-3 flex-wrap">
                            {(() => {
                              const primarySignatureDoc = getPrimaryStakeholderSignatureDoc(stakeholder);
                              if (!primarySignatureDoc) return null;

                              const signingState = getEquityDocSignatureState(primarySignatureDoc);
                              const signingRequest = signingState.activeRequests[0];

                              if (signingState.isFullyExecuted && signingRequest) {
                                return (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(`/sign/${signingRequest.id}?download=true`, '_blank');
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-500 transition-colors"
                                  >
                                    <Download className="w-4 h-4" />
                                    Download Signed Doc
                                  </button>
                                );
                              }

                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openSigningModal(primarySignatureDoc);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-500 transition-colors"
                                >
                                  <Send className="w-4 h-4" />
                                  {signingState.needsResend || signingRequest ? 'Resend Signature Doc' : 'Send Signature Doc'}
                                </button>
                              );
                            })()}
                            {/* For advisors: Generate the combined Advisor Agreement + NSO Grant directly (only if no doc exists) */}
                            {stakeholder.type === 'advisor' && !equityDocuments.some(d => d.stakeholderId === stakeholder.id && d.status === 'completed') && (() => {
                              const hasBoardConsent = (stakeholder as Stakeholder & { boardConsentDocId?: string; boardApprovalDate?: string }).boardConsentDocId || 
                                                      (stakeholder as Stakeholder & { boardApprovalDate?: string }).boardApprovalDate;
                              const isVerified = boardConsentVerification[stakeholder.id]?.status === 'verified';
                              return (
                                <div className="flex flex-col gap-2">
                                  {!hasBoardConsent && (
                                    <p className="text-xs text-amber-400 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      Board Consent required. Select one below and click Verify.
                                    </p>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGenerateAdvisorAgreement(stakeholder);
                                    }}
                                    disabled={generating || !isVerified}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                                      isVerified
                                        ? 'bg-[#E0FE10] text-black hover:bg-[#d4f00f]' 
                                        : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                                    }`}
                                  >
                                    {generating ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Generating...
                                      </>
                                    ) : (
                                      <>
                                        <FileText className="w-4 h-4" />
                                        Generate Advisor Agreement
                                      </>
                                    )}
                                  </button>
                                </div>
                              );
                            })()}
                            {/* For non-advisors: Show regular generate document button */}
                            {stakeholder.type !== 'advisor' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStakeholder(stakeholder);
                                  setActiveTab('documents');
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-lg font-medium hover:bg-[#d4f00f] transition-colors"
                              >
                                <FileText className="w-4 h-4" />
                                Generate Document
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteStakeholder(stakeholder.id);
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-red-900/30 text-red-400 rounded-lg font-medium hover:bg-red-900/50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );

  // Render Documents Tab
  const renderDocuments = () => {
    const visibleDocuments = getVisibleGeneratedDocuments();

    return (
    <div className="space-y-8">
      {/* Generate New Document - Legal Docs Style */}
      <GlassCard accentColor="#8B5CF6">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#E0FE10]" />
            Generate New Document
          </h2>
          
          {/* Document Type Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Document Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {DOCUMENT_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => setSelectedDocType(type.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    selectedDocType === type.id
                      ? 'bg-[#E0FE10] text-black font-medium'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <span>{type.icon}</span>
                  <span className="truncate">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* EIP Notice */}
          {selectedDocType === 'eip' && (
            <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700 rounded-xl">
              <div className="flex items-start gap-2">
                <Building className="w-4 h-4 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-blue-300 font-medium text-sm">Company-wide document</p>
                  <p className="text-blue-400/70 text-xs mt-0.5">
                    Equity Incentive Plans are not issued to a single stakeholder. This will be generated for Pulse Intelligence Labs, Inc.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stakeholder Selection (for non-EIP docs) */}
          {requiresStakeholderForDoc && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Stakeholder
              </label>
              <select
                value={selectedStakeholder?.id || ''}
                onChange={(e) => {
                  const found = stakeholders.find(s => s.id === e.target.value);
                  setSelectedStakeholder(found || null);
                }}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-[#8B5CF6] transition-colors"
              >
                <option value="">Select a stakeholder...</option>
                {stakeholders.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.type.charAt(0).toUpperCase() + s.type.slice(1)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Signature Requirement Toggle */}
          <div className="mb-4 flex items-center justify-between gap-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-700">
            <div>
              <p className="text-sm font-medium text-white">
                {selectedDocIsAutoExecuted ? 'Auto-executed internally' : 'Requires signature'}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {selectedDocIsAutoExecuted
                  ? 'This document is controlled internally, so Tremaine is rendered as already signed and no e-sign send is required.'
                  : 'When enabled, the PDF includes signature lines and e-signing tools are available.'}
              </p>
            </div>
            <label className="inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={requiresSignatureChecked}
                onChange={(e) => setRequiresSignatureChecked(e.target.checked)}
                disabled={selectedDocIsAutoExecuted}
                className="sr-only"
              />
              <div className={`w-12 h-7 rounded-full transition-colors ${selectedDocIsAutoExecuted ? 'bg-emerald-600' : requiresSignatureChecked ? 'bg-orange-600' : 'bg-zinc-700'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-1 ${requiresSignatureChecked ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </label>
          </div>

          {/* Prompt Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Document Details & Instructions
            </label>
            <textarea
              value={generationPrompt}
              onChange={(e) => setGenerationPrompt(e.target.value)}
              placeholder={
                selectedDocType === 'eip'
                  ? "Add any specific instructions for the EIP. For example: 'Include a 10M share reserve. Standard 4-year vesting with 1-year cliff for all grants.'"
                  : "Describe any specific terms or clauses. For example: 'Include a 90-day post-termination exercise period. Vesting accelerates 50% on change of control.'"
              }
              className="w-full h-32 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#8B5CF6] transition-colors resize-none"
            />
            <p className="text-xs text-zinc-500 mt-2">
              Be specific about any special terms, parties involved, or custom clauses you need.
            </p>
          </div>

          {/* Grant Details (for option agreement / FAST) */}
          {(selectedDocType === 'option_agreement' || selectedDocType === 'fast_agreement') && (
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-700 space-y-4">
              <h4 className="text-white font-medium">Grant Details (Optional)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Equity Type</label>
                  <select
                    value={newGrant.equityType}
                    onChange={(e) => setNewGrant({ ...newGrant, equityType: e.target.value as EquityType })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm"
                  >
                    {EQUITY_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Number of Shares</label>
                  <input
                    type="number"
                    value={newGrant.numberOfShares}
                    onChange={(e) => setNewGrant({ ...newGrant, numberOfShares: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm"
                    placeholder="e.g. 10,000"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Strike Price ($)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={newGrant.strikePrice}
                    onChange={(e) => setNewGrant({ ...newGrant, strikePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm"
                    placeholder="e.g. 0.001"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Vesting Schedule</label>
                  <select
                    value={newGrant.vestingSchedule}
                    onChange={(e) => setNewGrant({ ...newGrant, vestingSchedule: e.target.value as VestingSchedule })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm"
                  >
                    {VESTING_SCHEDULES.map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>{schedule.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerateDocument}
            disabled={generating || (requiresStakeholderForDoc && !selectedStakeholder)}
            className={`flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl font-semibold transition-all ${
              generating || (requiresStakeholderForDoc && !selectedStakeholder)
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                : 'bg-[#E0FE10] text-black hover:bg-[#d4f00f]'
            }`}
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Document...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Document
              </>
            )}
          </button>
        </div>
      </GlassCard>

      {/* Generated Equity Documents (like legalDocuments.tsx) */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-zinc-400" />
            Generated Documents
            <span className="ml-2 px-2 py-0.5 bg-zinc-800 rounded-full text-xs text-zinc-400">
              {visibleDocuments.length}
            </span>
          </h3>
        </div>

        {visibleDocuments.length === 0 ? (
          <GlassCard accentColor="#3B82F6">
            <div className="p-10 text-center">
              <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">No equity documents generated yet</p>
              <p className="text-zinc-500 text-sm mt-1">Use the form above to generate your first document</p>
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {visibleDocuments.map((edoc) => {
              const isExpanded = expandedEquityDoc === edoc.id;
              const signingState = getEquityDocSignatureState(edoc);
              const signingRequestsForDoc = signingState.activeRequests;
              const signingRequest = signingRequestsForDoc[0]; // For backwards-compatible UI
              const needsSignature = requiresExternalSignature(edoc);
              const statusBadge = getEquityDocStatusBadge(edoc);
              const historyDocs = getDocumentFamilyHistory(edoc, equityDocuments);
              const revisionEntries = getEquityDocumentRevisionEntries(edoc);
              const historyCount = historyDocs.length + revisionEntries.length;
              return (
                <GlassCard key={edoc.id} accentColor="#3B82F6">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          <h4 className="text-white font-semibold truncate">{edoc.title}</h4>
                          <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">
                            {DOCUMENT_TYPES.find(t => t.id === edoc.documentType)?.label || edoc.documentType}
                          </span>
                          {edoc.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/20 text-green-400 rounded-full text-xs border border-green-800">
                              <CheckCircle className="w-3 h-3" />
                              Completed
                            </span>
                          )}
                          {edoc.status === 'generating' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-900/20 text-yellow-400 rounded-full text-xs border border-yellow-800">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Generating
                            </span>
                          )}
                          {edoc.status === 'error' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-900/20 text-red-400 rounded-full text-xs border border-red-800">
                              <AlertCircle className="w-3 h-3" />
                              Error
                            </span>
                          )}
                          {edoc.isAmendment && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-fuchsia-900/30 text-fuchsia-300 rounded-full text-xs border border-fuchsia-800">
                              <RefreshCw className="w-3 h-3" />
                              Amendment
                            </span>
                          )}
                          {isProtectedStakeholderDocument(edoc) && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-900/30 text-cyan-300 rounded-full text-xs border border-cyan-800">
                              <Shield className="w-3 h-3" />
                              Required
                            </span>
                          )}
                          {statusBadge && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusBadge.className}`}>
                              {statusBadge.label === 'Signed' ? <Check className="w-3 h-3" /> : statusBadge.label === 'Sent for Signature' ? <Mail className="w-3 h-3" /> : statusBadge.label === 'Pending Signature' ? <Clock className="w-3 h-3" /> : statusBadge.label === 'Needs Resend' ? <AlertTriangle className="w-3 h-3" /> : <PenTool className="w-3 h-3" />}
                              {statusBadge.label}
                            </span>
                          )}
                          {needsSignature && !signingRequest && edoc.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-900/30 text-orange-400 rounded-full text-xs font-medium border border-orange-800">
                              <PenTool className="w-3 h-3" />
                              Signature Required
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-zinc-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(edoc.createdAt)}
                          </span>
                          {edoc.documentType !== 'eip' && edoc.stakeholderName && (
                            <span className="text-xs text-zinc-500">
                              For: {edoc.stakeholderName}
                            </span>
                          )}
                          {edoc.updatedAt && (
                            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                              Revised
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {edoc.status === 'completed' && (
                          <>
                            <button
                              onClick={() => window.open(`/equity-doc/${edoc.id}`, '_blank')}
                              className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              Preview
                            </button>
                            <button
                              onClick={() => openEditEquityDocModal(edoc)}
                              disabled={isEquityDocLockedForEditing(edoc)}
                              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                                isEquityDocLockedForEditing(edoc)
                                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                  : 'bg-blue-900/30 hover:bg-blue-900/50 text-blue-400'
                              }`}
                            >
                              <Edit3 className="w-4 h-4" />
                              {isEquityDocLockedForEditing(edoc) ? 'Locked' : 'Edit'}
                            </button>

                            <button
                              onClick={() => openAuditModal(edoc)}
                              className="flex items-center gap-1 px-3 py-2 bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 rounded-lg text-sm transition-colors"
                            >
                              <ClipboardCheck className="w-4 h-4" />
                              Audit
                            </button>

                            {/* Signing Actions */}
                            {signingState.isFullyExecuted && signingRequest ? (
                              <button
                                onClick={() => window.open(`/sign/${signingRequest.id}?download=true`, '_blank')}
                                className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                Download Signed
                              </button>
                            ) : needsSignature ? (
                              <button
                                onClick={() => openSigningModal(edoc)}
                                className="flex items-center gap-1 px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                <Send className="w-4 h-4" />
                                {signingState.needsResend || signingRequest ? 'Resend Signature Email' : 'Send for Signature'}
                              </button>
                            ) : signingRequest && needsSignature ? (
                              <button
                                onClick={() => window.open(`/sign/${signingRequest.id}`, '_blank')}
                                className="flex items-center gap-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                                View Signing Page
                              </button>
                            ) : null}

                            {signingRequest && needsSignature && (
                              <button
                                onClick={() => copySigningLink(signingRequest.id)}
                                className="flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                <Copy className="w-4 h-4" />
                                Copy Link
                              </button>
                            )}

                            <button
                              onClick={() => handleShareEquityDoc(edoc)}
                              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                copiedLinkId === edoc.id ? 'bg-green-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                              }`}
                            >
                              {copiedLinkId === edoc.id ? (
                                <>
                                  <Check className="w-4 h-4" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Share2 className="w-4 h-4" />
                                  Share
                                </>
                              )}
                            </button>

                            {historyCount > 0 && (
                              <button
                                onClick={() => openDocHistoryModal(edoc)}
                                className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                <Clock className="w-4 h-4" />
                                History ({historyCount})
                              </button>
                            )}

                            <button
                              onClick={() => openExhibitsModal(edoc)}
                              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                edoc.exhibits?.length
                                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                                  : 'bg-zinc-700 hover:bg-zinc-600 text-white'
                              }`}
                            >
                              <Paperclip className="w-4 h-4" />
                              Exhibits {edoc.exhibits?.length ? `(${edoc.exhibits.length})` : ''}
                            </button>

                            <button
                              onClick={() => generatePdfFromEquityDoc(edoc, getExhibitDocuments(edoc.id))}
                              className="flex items-center gap-1 px-3 py-2 bg-[#E0FE10] text-black hover:bg-[#d4f00f] rounded-lg text-sm font-medium transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              Download PDF
                            </button>

                            {!isProtectedStakeholderDocument(edoc) && (
                              <button
                                onClick={() => handleDeleteEquityDoc(edoc.id)}
                                disabled={deletingEquityDocId === edoc.id}
                                className="flex items-center gap-1 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm transition-colors"
                              >
                                {deletingEquityDocId === edoc.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </>
                        )}
                        {/* Delete button for error/generating states */}
                        {edoc.status !== 'completed' && !isProtectedStakeholderDocument(edoc) && (
                          <button
                            onClick={() => handleDeleteEquityDoc(edoc.id)}
                            disabled={deletingEquityDocId === edoc.id}
                            className="flex items-center gap-1 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm transition-colors"
                          >
                            {deletingEquityDocId === edoc.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && edoc.status === 'completed' && (
                      <div className="mt-4 p-4 bg-zinc-900 rounded-xl border border-zinc-700">
                        <div className="text-zinc-300 whitespace-pre-wrap text-sm leading-relaxed max-h-96 overflow-y-auto">
                          {edoc.content}
                        </div>
                        {edoc.prompt && (
                          <div className="mt-4 pt-4 border-t border-zinc-700">
                            <p className="text-xs text-zinc-500">
                              <strong>Original Prompt:</strong> {edoc.prompt}
                            </p>
                          </div>
                        )}
                        {edoc.revisionHistory && edoc.revisionHistory.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-zinc-400 font-medium">Revision History:</p>
                            {edoc.revisionHistory.map((rev, idx) => (
                              <p key={idx} className="text-xs text-zinc-500 mt-1">
                                • {rev.prompt}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {edoc.status === 'error' && edoc.errorMessage && (
                      <div className="mt-3 p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-400">
                        {edoc.errorMessage}
                      </div>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Equity Management | Pulse Admin</title>
      </Head>
      
      <div className="min-h-screen bg-[#0a0a0b] text-white relative overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 pointer-events-none">
          <FloatingOrb color="#E0FE10" size="w-[500px] h-[500px]" position={{ top: '-10%', left: '-10%' }} delay={0} />
          <FloatingOrb color="#8B5CF6" size="w-[400px] h-[400px]" position={{ top: '30%', right: '-5%' }} delay={2} />
          <FloatingOrb color="#3B82F6" size="w-[350px] h-[350px]" position={{ bottom: '10%', left: '20%' }} delay={4} />
          <div className="absolute inset-0 bg-[#0a0a0b]/80 backdrop-blur-3xl" />
        </div>

        <div className="relative z-10 py-10 px-4">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center">
                      <PieChart className="w-5 h-5 text-[#E0FE10]" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Equity Management</h1>
                  </div>
                  <p className="text-zinc-500">Cap table, grants, and equity documentation</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={loadData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  <button
                    onClick={() => setIsAddStakeholderModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-xl font-medium hover:bg-[#d4f00f] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Stakeholder
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Disclaimer Banner */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-4 rounded-xl bg-amber-900/20 border border-amber-800/50 flex items-start gap-3"
            >
              <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-200 text-sm font-medium mb-1">For Informational Purposes Only</p>
                <p className="text-amber-300/70 text-xs">
                  This cap table is for reference purposes only. In the event of any discrepancy, the governing documents 
                  (stock certificates, option agreements, board consents) shall control.
                </p>
              </div>
            </motion.div>

            {/* Tabs */}
            <div className="mb-8">
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-zinc-900/50 border border-zinc-800 w-fit">
                {[
                  { id: 'overview', label: 'Overview', icon: PieChart },
                  { id: 'stakeholders', label: 'Stakeholders', icon: Users },
                  { id: 'documents', label: 'Documents', icon: FileText },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                        isActive
                          ? 'bg-[#E0FE10] text-black'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Content */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#E0FE10]" />
              </div>
            ) : (
              <>
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'stakeholders' && renderStakeholders()}
                {activeTab === 'documents' && renderDocuments()}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Stakeholder Modal */}
      <AnimatePresence>
        {isAddStakeholderModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-lg overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-700">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-[#E0FE10]" />
                    Add Stakeholder
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">Add a new equity holder to your cap table</p>
                </div>
                <button
                  onClick={() => setIsAddStakeholderModalOpen(false)}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Full Name *</label>
                  <input
                    type="text"
                    value={newStakeholder.name}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, name: e.target.value })}
                    placeholder="John Smith"
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#E0FE10] transition-colors"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Email *</label>
                  <input
                    type="email"
                    value={newStakeholder.email}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#E0FE10] transition-colors"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Stakeholder Type *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {STAKEHOLDER_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setNewStakeholder({ ...newStakeholder, type: type.id })}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all ${
                          newStakeholder.type === type.id
                            ? 'bg-[#E0FE10] text-black font-medium'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        <span>{type.icon}</span>
                        <span>{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Title / Role</label>
                  <input
                    type="text"
                    value={newStakeholder.title}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, title: e.target.value })}
                    placeholder="e.g., CEO, Senior Engineer, Advisor"
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#E0FE10] transition-colors"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={newStakeholder.startDate}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, startDate: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-[#E0FE10] transition-colors"
                  />
                </div>

                {/* Advisor NSO Grant Details - Only shown when Advisor is selected */}
                {newStakeholder.type === 'advisor' && (
                  <div className="p-4 rounded-xl bg-purple-900/20 border border-purple-700 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🎯</span>
                      <div>
                        <h4 className="text-white font-medium">NSO Grant Details</h4>
                        <p className="text-xs text-purple-300">A required Board Consent and Advisor Agreement + NSO Grant will be generated for this advisor</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Number of Shares</label>
                        <input
                          type="number"
                          value={newStakeholder.advisorShares}
                          onChange={(e) => setNewStakeholder({ ...newStakeholder, advisorShares: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                          placeholder="10,000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Vesting (months)</label>
                        <input
                          type="number"
                          value={newStakeholder.advisorVestingMonths}
                          onChange={(e) => setNewStakeholder({ ...newStakeholder, advisorVestingMonths: parseInt(e.target.value) || 24 })}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                          placeholder="24"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Cliff (months)</label>
                        <input
                          type="number"
                          value={newStakeholder.advisorCliffMonths}
                          onChange={(e) => setNewStakeholder({ ...newStakeholder, advisorCliffMonths: parseInt(e.target.value) || 3 })}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                          placeholder="3"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Exercise price: $0.001/share • Monthly vesting • 10-year term
                    </p>

                    {/* Board Consent Linkage */}
                    <div className="mt-4 pt-4 border-t border-purple-700/50">
                      <label className="block text-xs text-zinc-400 mb-2">
                        Link to Board Consent (Optional)
                      </label>
                      <select
                        value={newStakeholder.boardConsentDocId}
                        onChange={(e) => setNewStakeholder({ ...newStakeholder, boardConsentDocId: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                      >
                        <option value="">No board consent linked</option>
                        {equityDocuments
                          .filter(d => d.documentType === 'board_consent' && d.status === 'completed')
                          .map(doc => (
                            <option key={doc.id} value={doc.id}>
                              {doc.title} ({formatDate(doc.createdAt)})
                            </option>
                          ))
                        }
                      </select>
                      <p className="text-xs text-purple-400 mt-1">
                        If you do not link one here, a new Board Consent will be auto-generated and attached.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
                <button
                  onClick={() => setIsAddStakeholderModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStakeholder}
                  disabled={generating || !newStakeholder.name.trim() || !newStakeholder.email.trim()}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    generating || !newStakeholder.name.trim() || !newStakeholder.email.trim()
                      ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                      : 'bg-[#E0FE10] text-black hover:bg-[#d4f00f]'
                  }`}
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Stakeholder
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Send for Signature Modal */}
      <AnimatePresence>
        {isSigningModalOpen && signingDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-700 shrink-0">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Send className="w-5 h-5 text-orange-400" />
                    Send for Signature
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">{signingDoc.title}</p>
                </div>
                <button
                  onClick={closeSigningModal}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                {signingModalStatus && (
                  <div
                    className={`rounded-xl border p-4 text-sm ${
                      signingModalStatus.type === 'success'
                        ? 'bg-green-900/20 border-green-800 text-green-300'
                        : signingModalStatus.type === 'error'
                        ? 'bg-red-900/20 border-red-800 text-red-300'
                        : 'bg-blue-900/20 border-blue-800 text-blue-300'
                    }`}
                  >
                    {signingModalStatus.text}
                  </div>
                )}

                <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-[#E0FE10]" />
                    <div>
                      <p className="text-white font-medium">{signingDoc.title}</p>
                      <p className="text-zinc-500 text-sm">
                        {DOCUMENT_TYPES.find(t => t.id === signingDoc.documentType)?.label || signingDoc.documentType}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-300">Signers</p>
                    <button
                      onClick={() => {
                        setSigners(prev => [
                          ...prev,
                          { id: `manual-${Date.now()}`, role: 'Signer', name: '', email: '' }
                        ]);
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                    >
                      + Add Signer
                    </button>
                  </div>

                  {signers.map((s, idx) => (
                    <div key={s.id} className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-700 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {s.role || `Signer ${idx + 1}`}
                          </span>
                          {s.signingRequestId ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-900/30 text-blue-300 border border-blue-800">
                              Existing link
                            </span>
                          ) : null}
                        </div>
                        <button
                          onClick={() => setSigners(prev => prev.filter(x => x.id !== s.id))}
                          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                          title="Remove signer"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">Stakeholder (optional)</label>
                          <select
                            value={s.stakeholderId || ''}
                            onChange={(e) => {
                              const stakeholderId = e.target.value || undefined;
                              const sh = stakeholders.find(st => st.id === stakeholderId);
                              setSigners(prev => prev.map(x => x.id === s.id ? {
                                ...x,
                                stakeholderId,
                                name: sh?.name || x.name,
                                email: sh?.email || x.email,
                              } : x));
                            }}
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                          >
                            <option value="">Manual entry</option>
                            {stakeholders
                              .filter(st => Boolean(st.email))
                              .map(st => (
                                <option key={st.id} value={st.id}>
                                  {st.name} ({st.email})
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="block text-xs text-zinc-400 mb-1">Name</label>
                            <input
                              type="text"
                              value={s.name}
                              onChange={(e) => setSigners(prev => prev.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))}
                              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                              placeholder="Full name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-zinc-400 mb-1">Email</label>
                            <input
                              type="email"
                              value={s.email}
                              onChange={(e) => setSigners(prev => prev.map(x => x.id === s.id ? { ...x, email: e.target.value } : x))}
                              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                              placeholder="email@example.com"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-xl">
                  <p className="text-blue-300 text-sm flex items-start gap-2">
                    <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      Each signer will receive an email with a secure signing link. Existing links will be re-sent.
                    </span>
                  </p>
                </div>

                <div className="p-4 bg-zinc-900/50 border border-zinc-700 rounded-xl space-y-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-300">Preview Email</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Send a sandbox signing email to yourself or another address to test the full email-to-sign experience without affecting the live document packet.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Preview Recipient Name</label>
                      <input
                        type="text"
                        value={previewRecipientName}
                        onChange={(e) => setPreviewRecipientName(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Preview Recipient Email</label>
                      <input
                        type="email"
                        value={previewRecipientEmail}
                        onChange={(e) => setPreviewRecipientEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700 shrink-0">
                <button
                  onClick={closeSigningModal}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                >
                  {signingModalStatus?.type === 'success' ? 'Close' : 'Cancel'}
                </button>
                <button
                  onClick={handlePreviewSignatureFlow}
                  disabled={isSending || !previewRecipientName.trim() || !previewRecipientEmail.trim()}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isSending || !previewRecipientName.trim() || !previewRecipientEmail.trim()
                      ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                      : 'bg-blue-900/40 text-blue-300 hover:bg-blue-900/60'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Send Preview Email
                </button>
                <button
                  onClick={handleSendForSignature}
                  disabled={isSending || signers.length === 0 || signers.some(s => !s.name.trim() || !s.email.trim())}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isSending || signers.length === 0 || signers.some(s => !s.name.trim() || !s.email.trim())
                      ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                      : 'bg-orange-600 text-white hover:bg-orange-500'
                  }`}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {signingModalStatus?.type === 'success'
                        ? `Send Again to ${signers.length} signer${signers.length !== 1 ? 's' : ''}`
                        : `Send to ${signers.length} signer${signers.length !== 1 ? 's' : ''}`}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit / Revise Equity Document Modal */}
      <AnimatePresence>
        {isEditEquityDocModalOpen && editingEquityDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-2xl max-h-[90vh] overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-700">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-blue-400" />
                    Edit Document
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">{editingEquityDoc.title}</p>
                </div>
                <button
                  onClick={() => {
                    setIsEditEquityDocModalOpen(false);
                    setEditingEquityDoc(null);
                    setEditEquityDocTitle('');
                    setEditEquityDocPrompt('');
                  }}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Document Title</label>
                  <input
                    type="text"
                    value={editEquityDocTitle}
                    onChange={(e) => setEditEquityDocTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {isAutoExecutedCompanyDoc(editingEquityDoc) ? (
                  <div className="flex items-start gap-3 p-4 bg-emerald-900/20 rounded-xl border border-emerald-800">
                    <Shield className="w-5 h-5 text-emerald-300 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-emerald-200">Auto-executed internal approval</p>
                      <p className="text-xs text-emerald-300/80 mt-1">
                        Regenerate cleanly to apply the latest text updates while preserving the original approval date and Tremaine&apos;s auto-signature. No signature email will be required for this document.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-700">
                    <div>
                      <p className="text-sm font-medium text-white">Requires signature</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Toggle to require e-signature. Changing this will regenerate signature blocks if needed.
                      </p>
                    </div>
                    <label className="inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editRequiresSignature}
                        onChange={(e) => setEditRequiresSignature(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-12 h-7 rounded-full transition-colors ${editRequiresSignature ? 'bg-orange-600' : 'bg-zinc-700'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-1 ${editRequiresSignature ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                    </label>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Current Document Preview</label>
                  <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-700 max-h-40 overflow-y-auto">
                    <p className="text-sm text-zinc-400 whitespace-pre-wrap">
                      {editingEquityDoc.content.substring(0, 800)}...
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Revision Instructions <span className="text-zinc-500 font-normal">(optional if only updating title)</span>
                  </label>
                  <textarea
                    value={editEquityDocPrompt}
                    onChange={(e) => setEditEquityDocPrompt(e.target.value)}
                    placeholder="Describe the changes you want. Examples: 'Change the option term from 10 years to 7 years.' 'Add a mutual non-solicit clause.' 'Add a board approval recital.'"
                    className="w-full h-40 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    {isAutoExecutedCompanyDoc(editingEquityDoc)
                      ? 'Use this to cleanly regenerate the document with updated language while preserving the original date and auto-executed signature.'
                      : 'This will regenerate the full document with your changes (mirrors the Legal Docs workflow).'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
                <button
                  onClick={() => {
                    setIsEditEquityDocModalOpen(false);
                    setEditingEquityDoc(null);
                    setEditEquityDocTitle('');
                    setEditEquityDocPrompt('');
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReviseEquityDoc}
                  disabled={
                    isRevisingEquityDoc ||
                    (!isAutoExecutedCompanyDoc(editingEquityDoc) &&
                      !editEquityDocPrompt.trim() &&
                      editEquityDocTitle.trim() === editingEquityDoc.title &&
                      Boolean(editRequiresSignature) === Boolean(editingEquityDoc.requiresSignature))
                  }
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isRevisingEquityDoc ||
                    (!isAutoExecutedCompanyDoc(editingEquityDoc) &&
                      !editEquityDocPrompt.trim() &&
                      editEquityDocTitle.trim() === editingEquityDoc.title &&
                      Boolean(editRequiresSignature) === Boolean(editingEquityDoc.requiresSignature))
                      ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-500'
                  }`}
                >
                  {isRevisingEquityDoc ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isAutoExecutedCompanyDoc(editingEquityDoc)
                        ? 'Regenerating...'
                        : editEquityDocPrompt.trim()
                        ? 'Revising...'
                        : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {isAutoExecutedCompanyDoc(editingEquityDoc)
                        ? 'Regenerate Cleanly'
                        : editEquityDocPrompt.trim()
                        ? 'Apply Changes'
                        : 'Save'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document History Modal */}
      <AnimatePresence>
        {isDocHistoryModalOpen && docHistoryAnchor && (
          (() => {
            const familyHistoryDocs = getDocumentFamilyHistory(docHistoryAnchor, equityDocuments);
            const revisionEntries = getEquityDocumentRevisionEntries(docHistoryAnchor);
            const hasAnyHistory = familyHistoryDocs.length > 0 || revisionEntries.length > 0;

            return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-3xl max-h-[90vh] overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-700">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-zinc-300" />
                    Document History
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">{docHistoryAnchor.title}</p>
                </div>
                <button
                  onClick={() => {
                    setIsDocHistoryModalOpen(false);
                    setDocHistoryAnchor(null);
                  }}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh]">
                {!hasAnyHistory ? (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                    <p className="text-zinc-400">No history is available for this document yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {familyHistoryDocs.length > 0 && (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-white">Older Document Versions</p>
                          <p className="text-xs text-zinc-500 mt-1">
                            These are older document records for the same grant/document family.
                          </p>
                        </div>
                        {familyHistoryDocs.map((historyDoc) => {
                          const statusBadge = getEquityDocStatusBadge(historyDoc);
                          return (
                            <div key={historyDoc.id} className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-700">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-white font-medium truncate">{historyDoc.title}</p>
                                    {historyDoc.isAmendment && (
                                      <span className="px-2 py-0.5 rounded-full text-xs bg-fuchsia-900/40 text-fuchsia-300 border border-fuchsia-700">
                                        Amendment
                                      </span>
                                    )}
                                    {statusBadge && (
                                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge.className}`}>
                                        {statusBadge.label}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 flex-wrap mt-1 text-xs text-zinc-500">
                                    <span>{formatDate(historyDoc.updatedAt || historyDoc.createdAt)}</span>
                                    <span>{DOCUMENT_TYPES.find(t => t.id === historyDoc.documentType)?.label || historyDoc.documentType}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                  <button
                                    onClick={() => window.open(`/equity-doc/${historyDoc.id}`, '_blank')}
                                    className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                                  >
                                    <Eye className="w-4 h-4" />
                                    Preview
                                  </button>
                                  {historyDoc.status === 'completed' && (
                                    <button
                                      onClick={() => generatePdfFromEquityDoc(historyDoc, getExhibitDocuments(historyDoc.id))}
                                      className="flex items-center gap-1 px-3 py-2 bg-[#E0FE10] text-black hover:bg-[#d4f00f] rounded-lg text-sm font-medium transition-colors"
                                    >
                                      <Download className="w-4 h-4" />
                                      Download PDF
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteEquityDoc(historyDoc.id)}
                                    disabled={deletingEquityDocId === historyDoc.id}
                                    className="flex items-center gap-1 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm transition-colors disabled:opacity-50"
                                  >
                                    {deletingEquityDocId === historyDoc.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {revisionEntries.length > 0 && (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-white">In-Place Revision Log</p>
                          <p className="text-xs text-zinc-500 mt-1">
                            These revisions were applied directly to the current document version, so there is not a separate file for each log entry.
                          </p>
                        </div>
                        {revisionEntries.map((revision, idx) => (
                          <div key={`${docHistoryAnchor.id}-revision-${idx}`} className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-700">
                            <div className="flex items-center justify-between gap-4 mb-2">
                              <p className="text-sm font-medium text-white">Revision {revisionEntries.length - idx}</p>
                              <span className="text-xs text-zinc-500">{formatDate(revision.timestamp)}</span>
                            </div>
                            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{revision.prompt}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
                <button
                  onClick={() => {
                    setIsDocHistoryModalOpen(false);
                    setDocHistoryAnchor(null);
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
            );
          })()
        )}
      </AnimatePresence>

      {/* Audit Modal (parity with Legal Docs) */}
      <AnimatePresence>
        {isAuditModalOpen && auditingEquityDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-3xl max-h-[90vh] overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-700">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-purple-400" />
                    Document Audit
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">{auditingEquityDoc.title}</p>
                </div>
                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh]">
                {isAuditing ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-12 h-12 animate-spin text-purple-400 mb-4" />
                    <p className="text-zinc-400">Analyzing document...</p>
                    <p className="text-sm text-zinc-500 mt-1">This may take a moment</p>
                  </div>
                ) : auditResult ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <AuditStatusBadge status={auditResult.overallStatus} score={auditResult.score} />
                    </div>

                    <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-700">
                      <h3 className="text-sm font-semibold text-zinc-300 mb-2">Summary</h3>
                      <p className="text-sm text-zinc-400">{auditResult.summary}</p>
                    </div>

                    {auditResult.criticalIssues.length > 0 && (
                      <div className="p-4 bg-red-900/20 rounded-xl border border-red-800">
                        <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Critical Issues ({auditResult.criticalIssues.length})
                        </h3>
                        <ul className="space-y-2">
                          {auditResult.criticalIssues.map((issue, idx) => (
                            <li key={idx} className="text-sm text-red-300 flex items-start gap-2">
                              <span className="text-red-500 mt-1">•</span>
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {auditResult.missingElements.length > 0 && (
                      <div className="p-4 bg-yellow-900/20 rounded-xl border border-yellow-800">
                        <h3 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Missing Elements ({auditResult.missingElements.length})
                        </h3>
                        <ul className="space-y-2">
                          {auditResult.missingElements.map((element, idx) => (
                            <li key={idx} className="text-sm text-yellow-300 flex items-start gap-2">
                              <span className="text-yellow-500 mt-1">•</span>
                              {element}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {auditResult.recommendations.length > 0 && (
                      <div className="p-4 bg-blue-900/20 rounded-xl border border-blue-800">
                        <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          Recommendations
                        </h3>
                        <ul className="space-y-2">
                          {auditResult.recommendations.map((rec, idx) => (
                            <li key={idx} className="text-sm text-blue-300 flex items-start gap-2">
                              <span className="text-blue-500 mt-1">•</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {auditResult.strengths.length > 0 && (
                      <div className="p-4 bg-green-900/20 rounded-xl border border-green-800">
                        <h3 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Strengths
                        </h3>
                        <ul className="space-y-2">
                          {auditResult.strengths.map((strength, idx) => (
                            <li key={idx} className="text-sm text-green-300 flex items-start gap-2">
                              <span className="text-green-500 mt-1">✓</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 p-6 border-t border-zinc-700">
                <p className="text-xs text-zinc-500">
                  This audit is AI-generated. Always have legal counsel review important equity documents.
                </p>
                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exhibits Modal */}
      <AnimatePresence>
        {isExhibitsModalOpen && exhibitsDocument && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-2xl max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-700">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Paperclip className="w-5 h-5 text-cyan-400" />
                    Attach Exhibits
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">{exhibitsDocument.title}</p>
                </div>
                <button
                  onClick={() => {
                    setIsExhibitsModalOpen(false);
                    setExhibitsDocument(null);
                    setSelectedExhibits([]);
                  }}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <p className="text-sm text-zinc-400 mb-4">
                  Select documents to attach as exhibits. When you download the PDF, these will be included as Exhibit A, B, C, etc.
                </p>

                {equityDocuments.filter(d => d.id !== exhibitsDocument.id && d.status === 'completed').length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No other documents available to attach as exhibits.</p>
                    <p className="text-sm mt-1">Generate more documents first.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {equityDocuments
                      .filter(d => d.id !== exhibitsDocument.id && d.status === 'completed')
                      .map((eqDoc, index) => {
                        const isSelected = selectedExhibits.includes(eqDoc.id);
                        const exhibitIndex = selectedExhibits.indexOf(eqDoc.id);
                        
                        return (
                          <button
                            key={eqDoc.id}
                            onClick={() => toggleExhibit(eqDoc.id)}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                              isSelected
                                ? 'bg-cyan-900/30 border-cyan-600'
                                : 'bg-zinc-900/50 border-zinc-700 hover:border-zinc-600'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                              isSelected
                                ? 'bg-cyan-600 text-white'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}>
                              {isSelected ? String.fromCharCode(65 + exhibitIndex) : (index + 1)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                                {eqDoc.title}
                              </p>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                {DOCUMENT_TYPES.find(t => t.id === eqDoc.documentType)?.label || eqDoc.documentType} • {formatDate(eqDoc.createdAt)}
                              </p>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-cyan-600 border-cyan-600'
                                : 'border-zinc-600'
                            }`}>
                              {isSelected && <Check className="w-4 h-4 text-white" />}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}

                {selectedExhibits.length > 0 && (
                  <div className="mt-6 p-4 bg-cyan-900/20 border border-cyan-800 rounded-xl">
                    <p className="text-cyan-400 text-sm flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      <span>
                        <strong>{selectedExhibits.length}</strong> exhibit{selectedExhibits.length !== 1 ? 's' : ''} will be attached to this document.
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
                <button
                  onClick={() => {
                    setIsExhibitsModalOpen(false);
                    setExhibitsDocument(null);
                    setSelectedExhibits([]);
                  }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveExhibits}
                  disabled={isSavingExhibits}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isSavingExhibits
                      ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                      : 'bg-cyan-600 text-white hover:bg-cyan-500'
                  }`}
                >
                  {isSavingExhibits ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Paperclip className="w-4 h-4" />
                      Save Exhibits
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toast */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-[80] w-[min(92vw,28rem)]"
          >
            <div
              className={`rounded-2xl border shadow-2xl backdrop-blur-xl px-4 py-4 flex items-start gap-3 ${
                message.type === 'success'
                  ? 'bg-green-950/90 border-green-700 text-green-200'
                  : message.type === 'error'
                  ? 'bg-red-950/90 border-red-700 text-red-200'
                  : 'bg-blue-950/90 border-blue-700 text-blue-200'
              }`}
            >
              <div className="mt-0.5">
                {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {message.type === 'success' ? 'Success' : message.type === 'error' ? 'Something went wrong' : 'Update'}
                </p>
                <p className="text-sm opacity-90 mt-1">{message.text}</p>
              </div>
              <button
                onClick={() => setMessage(null)}
                className="opacity-70 hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminRouteGuard>
  );
};

export default EquityAdminPage;
