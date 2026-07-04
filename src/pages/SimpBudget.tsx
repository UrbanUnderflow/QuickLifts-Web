import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import {
  GoogleAuthProvider,
  OAuthProvider,
  User,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  ArrowDownToLine,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileImage,
  Grid2X2,
  Loader2,
  LogOut,
  Mail,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { auth as quickLiftsAuth, db as quickLiftsDb } from '../api/firebase/config';
import {
  simpBudgetAuth,
  simpBudgetDb,
  simpBudgetStorage,
} from '../api/firebase/simpBudgetConfig';

type MessageTone = 'success' | 'error' | 'info';
type SpaceStatus = 'active' | 'archived';
type BudgetView = 'all' | string;

interface RecurringExpenseDraft {
  id: string;
  label: string;
  amount: string;
}

interface MiscExpenseDraft {
  id: string;
  date: string;
  label: string;
  amount: string;
  paymentMethod: string;
  notes: string;
}

interface BudgetSpace {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: SpaceStatus;
  sortOrder: number;
  sourceScope?: 'business' | 'personal';
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface BudgetDraft {
  budgetSpaceId: string;
  year: number;
  month: number;
  monthlyIncome: string;
  debtPayments: string;
  notes: string;
  recurringExpenses: RecurringExpenseDraft[];
  miscExpenses: MiscExpenseDraft[];
}

interface BudgetRecord extends BudgetDraft {
  id: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  sourceRecordId?: string;
}

interface ParsedExpenseImport {
  date?: string;
  label?: string;
  amount?: number | string;
  paymentMethod?: string;
  notes?: string;
}

interface ParseExpenseImportResponse {
  success?: boolean;
  error?: string;
  expenses?: ParsedExpenseImport[];
  summary?: {
    parsedCount?: number;
    newCount?: number;
    duplicateCount?: number;
  };
}

interface FounderBudgetSourceRecord {
  id: string;
  scope: 'business' | 'personal';
  year: number;
  month: number;
  monthlyIncome: string;
  debtPayments: string;
  notes: string;
  recurringExpenses: RecurringExpenseDraft[];
  miscExpenses: MiscExpenseDraft[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

const SIMPBUDGET_USERS_COLLECTION = 'simpbudget-users';
const BUDGET_SPACES_SUBCOLLECTION = 'budgetSpaces';
const BUDGETS_SUBCOLLECTION = 'budgets';
const QUICKLIFTS_FOUNDER_BUDGET_COLLECTION = 'founder-budgets';
const TREMAINE_OWNER_EMAIL = 'tremaine.grant@gmail.com';
const MAGIC_LINK_EMAIL_STORAGE_KEY = 'simpbudget.web.pendingMagicEmail';
const EXPENSE_IMPORT_FUNCTION_ENDPOINT = '/.netlify/functions/founder-budget-parse-expenses';
const EXPENSE_IMPORT_API_ENDPOINT = '/api/admin/founder-budget/parse-expenses';
const EXPENSE_IMPORT_IMAGES_PER_REQUEST = 1;

const CURRENT_DATE = new Date();
const DEFAULT_MONTH = CURRENT_DATE.getMonth() + 1;
const DEFAULT_YEAR = CURRENT_DATE.getFullYear();

const MONTH_OPTIONS = [
  { value: 1, label: 'January', shortLabel: 'Jan' },
  { value: 2, label: 'February', shortLabel: 'Feb' },
  { value: 3, label: 'March', shortLabel: 'Mar' },
  { value: 4, label: 'April', shortLabel: 'Apr' },
  { value: 5, label: 'May', shortLabel: 'May' },
  { value: 6, label: 'June', shortLabel: 'Jun' },
  { value: 7, label: 'July', shortLabel: 'Jul' },
  { value: 8, label: 'August', shortLabel: 'Aug' },
  { value: 9, label: 'September', shortLabel: 'Sep' },
  { value: 10, label: 'October', shortLabel: 'Oct' },
  { value: 11, label: 'November', shortLabel: 'Nov' },
  { value: 12, label: 'December', shortLabel: 'Dec' },
];

const PAYMENT_METHOD_OPTIONS = [
  'Discover',
  'Amex',
  'Apple Card',
  'Chase',
  'Checking',
  'Cash',
  'Debit',
  'Other',
];

const SPACE_COLOR_OPTIONS = [
  { name: 'Electric Blue', value: '#2563eb' },
  { name: 'Fresh Green', value: '#16a34a' },
  { name: 'Warm Gold', value: '#f59e0b' },
  { name: 'Hot Pink', value: '#db2777' },
  { name: 'Deep Teal', value: '#0f766e' },
  { name: 'Violet', value: '#7c3aed' },
];

const SPACE_ICON_OPTIONS = [
  { label: 'Briefcase', value: 'briefcase' },
  { label: 'Wallet', value: 'wallet' },
  { label: 'Receipt', value: 'receipt' },
  { label: 'Grid', value: 'grid' },
];

const fieldClassName =
  'w-full rounded-md border border-stone-200 bg-[#FAFAF7] px-3 py-2 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white focus:ring-2 focus:ring-stone-200/50';

const pillButtonClassName =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';

const createLocalId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const sanitizeMoneyInput = (value: string) => value.replace(/[^0-9.-]/g, '');

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '-');

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

const moneyStringToNumber = (value: string | number | undefined | null) => {
  const asString = typeof value === 'number' ? String(value) : value || '';
  const parsed = Number.parseFloat(asString.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const compactMoneyString = (value: unknown) => {
  const parsed = moneyStringToNumber(typeof value === 'number' ? value : String(value ?? ''));
  if (!Number.isFinite(parsed) || parsed === 0) return '';

  return parsed.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const monthLabel = (month: number) =>
  MONTH_OPTIONS.find((option) => option.value === month)?.label || 'Month';

const monthYearLabel = (month: number, year: number) => `${monthLabel(month)} ${year}`;

const buildBudgetDocId = (spaceId: string, year: number, month: number) =>
  `${spaceId}-${year}-${String(month).padStart(2, '0')}`;

const createRecurringExpense = (label = '', amount = ''): RecurringExpenseDraft => ({
  id: createLocalId('recurring'),
  label,
  amount,
});

const createMiscExpense = (): MiscExpenseDraft => ({
  id: createLocalId('misc'),
  date: '',
  label: '',
  amount: '',
  paymentMethod: PAYMENT_METHOD_OPTIONS[0],
  notes: '',
});

const createEmptyDraft = (budgetSpaceId: string, year: number, month: number): BudgetDraft => ({
  budgetSpaceId,
  year,
  month,
  monthlyIncome: '',
  debtPayments: '',
  notes: '',
  recurringExpenses: [],
  miscExpenses: [],
});

const cloneDraft = (draft: BudgetDraft): BudgetDraft => ({
  ...draft,
  recurringExpenses: draft.recurringExpenses.map((expense) => ({ ...expense })),
  miscExpenses: draft.miscExpenses.map((expense) => ({ ...expense })),
});

const normalizePaymentMethod = (value?: string) =>
  PAYMENT_METHOD_OPTIONS.includes(value || '') ? (value as string) : 'Other';

const normalizeRecurringExpenses = (value: unknown): RecurringExpenseDraft[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const expense = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      return {
        id:
          typeof expense.id === 'string' && expense.id.trim()
            ? expense.id
            : `recurring-${index + 1}`,
        label: typeof expense.label === 'string' ? expense.label : '',
        amount: compactMoneyString(expense.amount),
      };
    })
    .filter((expense) => expense.label.trim() || expense.amount);
};

const normalizeMiscExpenses = (value: unknown): MiscExpenseDraft[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const expense = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      return {
        id: typeof expense.id === 'string' && expense.id.trim() ? expense.id : `misc-${index + 1}`,
        date: typeof expense.date === 'string' ? expense.date : '',
        label: typeof expense.label === 'string' ? expense.label : '',
        amount: compactMoneyString(expense.amount),
        paymentMethod: normalizePaymentMethod(typeof expense.paymentMethod === 'string' ? expense.paymentMethod : undefined),
        notes: typeof expense.notes === 'string' ? expense.notes : '',
      };
    })
    .filter((expense) => expense.label.trim() || expense.amount || expense.notes.trim() || expense.date);
};

const normalizeBudgetSpace = (id: string, raw: Record<string, unknown>): BudgetSpace => ({
  id,
  name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Budget Space',
  description: typeof raw.description === 'string' ? raw.description : '',
  icon: typeof raw.icon === 'string' ? raw.icon : 'wallet',
  color: typeof raw.color === 'string' ? raw.color : SPACE_COLOR_OPTIONS[0].value,
  status: raw.status === 'archived' ? 'archived' : 'active',
  sortOrder: typeof raw.sortOrder === 'number' && Number.isFinite(raw.sortOrder) ? raw.sortOrder : 999,
  sourceScope: raw.sourceScope === 'business' || raw.sourceScope === 'personal' ? raw.sourceScope : undefined,
  createdAt: raw.createdAt,
  updatedAt: raw.updatedAt,
});

const normalizeBudgetRecord = (id: string, raw: Record<string, unknown>): BudgetRecord => {
  const budgetSpaceId = typeof raw.budgetSpaceId === 'string' ? raw.budgetSpaceId : '';
  const year = typeof raw.year === 'number' && Number.isFinite(raw.year) ? raw.year : DEFAULT_YEAR;
  const month = typeof raw.month === 'number' && Number.isFinite(raw.month) ? raw.month : DEFAULT_MONTH;

  return {
    id,
    budgetSpaceId,
    year,
    month,
    monthlyIncome: compactMoneyString(raw.monthlyIncome),
    debtPayments: compactMoneyString(raw.debtPayments),
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    recurringExpenses: normalizeRecurringExpenses(raw.recurringExpenses),
    miscExpenses: normalizeMiscExpenses(raw.miscExpenses),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    sourceRecordId: typeof raw.sourceRecordId === 'string' ? raw.sourceRecordId : undefined,
  };
};

const normalizeFounderBudgetSourceRecord = (
  id: string,
  raw: Record<string, unknown>
): FounderBudgetSourceRecord | null => {
  if (raw.scope !== 'business' && raw.scope !== 'personal') return null;

  const year = typeof raw.year === 'number' && Number.isFinite(raw.year) ? raw.year : DEFAULT_YEAR;
  const month = typeof raw.month === 'number' && Number.isFinite(raw.month) ? raw.month : DEFAULT_MONTH;

  return {
    id,
    scope: raw.scope,
    year,
    month,
    monthlyIncome: compactMoneyString(raw.monthlyIncome),
    debtPayments: compactMoneyString(raw.debtPayments),
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    recurringExpenses: normalizeRecurringExpenses(raw.recurringExpenses),
    miscExpenses: normalizeMiscExpenses(raw.miscExpenses),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

const buildComparableDraft = (draft: BudgetDraft) => ({
  budgetSpaceId: draft.budgetSpaceId,
  year: draft.year,
  month: draft.month,
  monthlyIncome: moneyStringToNumber(draft.monthlyIncome),
  debtPayments: moneyStringToNumber(draft.debtPayments),
  notes: draft.notes.trim(),
  recurringExpenses: draft.recurringExpenses
    .map((expense) => ({
      label: expense.label.trim(),
      amount: moneyStringToNumber(expense.amount),
    }))
    .filter((expense) => expense.label || expense.amount !== 0),
  miscExpenses: draft.miscExpenses
    .map((expense) => ({
      date: expense.date,
      label: expense.label.trim(),
      amount: moneyStringToNumber(expense.amount),
      paymentMethod: expense.paymentMethod,
      notes: expense.notes.trim(),
    }))
    .filter((expense) => expense.date || expense.label || expense.amount !== 0 || expense.notes),
});

const selectDraftForSpaceMonth = (
  records: BudgetRecord[],
  budgetSpaceId: string,
  year: number,
  month: number
) => {
  const exactRecord = records.find(
    (record) =>
      record.budgetSpaceId === budgetSpaceId &&
      record.year === year &&
      record.month === month
  );

  if (exactRecord) {
    return {
      draft: cloneDraft(exactRecord),
      hasPersistedRecord: true,
      statusMessage: `Loaded ${monthYearLabel(month, year)}.`,
    };
  }

  const previousRecord = records
    .filter(
      (record) =>
        record.budgetSpaceId === budgetSpaceId &&
        (record.year < year || (record.year === year && record.month < month))
    )
    .sort((left, right) => {
      if (left.year !== right.year) return right.year - left.year;
      return right.month - left.month;
    })[0];

  if (previousRecord) {
    return {
      draft: {
        budgetSpaceId,
        year,
        month,
        monthlyIncome: previousRecord.monthlyIncome,
        debtPayments: previousRecord.debtPayments,
        notes: '',
        recurringExpenses: previousRecord.recurringExpenses.map((expense) => ({ ...expense })),
        miscExpenses: [],
      },
      hasPersistedRecord: false,
      statusMessage: `New month seeded from ${monthYearLabel(previousRecord.month, previousRecord.year)}.`,
    };
  }

  return {
    draft: createEmptyDraft(budgetSpaceId, year, month),
    hasPersistedRecord: false,
    statusMessage: `New blank sheet for ${monthYearLabel(month, year)}.`,
  };
};

const findPreviousBudgetRecord = (
  records: BudgetRecord[],
  budgetSpaceId: string,
  year: number,
  month: number
) =>
  records
    .filter(
      (record) =>
        record.budgetSpaceId === budgetSpaceId &&
        (record.year < year || (record.year === year && record.month < month))
    )
    .sort((left, right) => {
      if (left.year !== right.year) return right.year - left.year;
      return right.month - left.month;
    })[0] || null;

const cloneRecurringExpenses = (expenses: RecurringExpenseDraft[]) =>
  expenses.map((expense, index) => ({
    ...expense,
    id: expense.id || `restored-recurring-${index + 1}`,
  }));

const normalizeExpenseLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/https?:\/\//g, ' ')
    .replace(/www\./g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const labelsLikelyMatch = (left: string, right: string) => {
  const normalizedLeft = normalizeExpenseLabel(left);
  const normalizedRight = normalizeExpenseLabel(right);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;

  const leftTokens = normalizedLeft.split(' ').filter((token) => token.length > 2);
  const rightTokens = normalizedRight.split(' ').filter((token) => token.length > 2);
  if (!leftTokens.length || !rightTokens.length) return false;

  const overlapCount = leftTokens.filter((token) => rightTokens.includes(token)).length;
  return overlapCount >= Math.max(1, Math.min(leftTokens.length, rightTokens.length) - 1);
};

const expensesLikelyMatch = (
  left: Pick<MiscExpenseDraft, 'date' | 'label' | 'amount'>,
  right: Pick<MiscExpenseDraft, 'date' | 'label' | 'amount'>
) => {
  const leftAmount = moneyStringToNumber(left.amount);
  const rightAmount = moneyStringToNumber(right.amount);
  if (Math.abs(leftAmount - rightAmount) > 0.009) return false;
  if (!labelsLikelyMatch(left.label || '', right.label || '')) return false;

  if (left.date && right.date) {
    return left.date === right.date;
  }

  return true;
};

const buildImportedMiscExpenses = (
  existingExpenses: MiscExpenseDraft[],
  parsedExpenses: ParsedExpenseImport[]
) => {
  const comparisonPool = existingExpenses.map((expense) => ({ ...expense }));
  const addedExpenses: MiscExpenseDraft[] = [];
  let duplicateCount = 0;

  parsedExpenses.forEach((expense) => {
    const label = typeof expense.label === 'string' ? expense.label.trim() : '';
    const amount = compactMoneyString(expense.amount);
    const candidate: MiscExpenseDraft = {
      id: createMiscExpense().id,
      date: typeof expense.date === 'string' ? expense.date : '',
      label,
      amount,
      paymentMethod: normalizePaymentMethod(expense.paymentMethod),
      notes: typeof expense.notes === 'string' ? expense.notes.trim() : '',
    };

    if (!candidate.label || moneyStringToNumber(candidate.amount) === 0) return;

    const isDuplicate = comparisonPool.some((existingExpense) =>
      expensesLikelyMatch(existingExpense, candidate)
    );
    if (isDuplicate) {
      duplicateCount += 1;
      return;
    }

    addedExpenses.push(candidate);
    comparisonPool.push(candidate);
  });

  return { addedExpenses, duplicateCount };
};

const readResponseError = (payload: unknown, fallbackMessage: string) => {
  if (payload && typeof payload === 'object') {
    const candidate = payload as Record<string, unknown>;
    if (typeof candidate.error === 'string' && candidate.error.trim()) return candidate.error;
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;
  }

  return fallbackMessage;
};

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
    return 'SimpBudget signed you in, but the standalone Firebase project is rejecting Firestore access. Deploy the SimpBudget Firestore rules that allow each signed-in user to read/write their own simpbudget-users/{uid} tree.';
  }

  return error instanceof Error ? error.message : fallbackMessage;
};

const buildDraftPayload = (draft: BudgetDraft) => ({
  budgetSpaceId: draft.budgetSpaceId,
  year: draft.year,
  month: draft.month,
  monthlyIncome: moneyStringToNumber(draft.monthlyIncome),
  debtPayments: moneyStringToNumber(draft.debtPayments),
  notes: draft.notes.trim(),
  recurringExpenses: draft.recurringExpenses
    .map((expense) => ({
      id: expense.id || createLocalId('recurring'),
      label: expense.label.trim(),
      amount: moneyStringToNumber(expense.amount),
    }))
    .filter((expense) => expense.label || expense.amount !== 0),
  miscExpenses: draft.miscExpenses
    .map((expense) => ({
      id: expense.id || createLocalId('misc'),
      date: expense.date,
      label: expense.label.trim(),
      amount: moneyStringToNumber(expense.amount),
      paymentMethod: normalizePaymentMethod(expense.paymentMethod),
      notes: expense.notes.trim(),
    }))
    .filter((expense) => expense.date || expense.label || expense.amount !== 0 || expense.notes),
});

const calculateDraftTotals = (draft: BudgetDraft) => {
  const monthlyIncome = moneyStringToNumber(draft.monthlyIncome);
  const recurringTotal = draft.recurringExpenses.reduce(
    (sum, expense) => sum + moneyStringToNumber(expense.amount),
    0
  );
  const miscTotal = draft.miscExpenses.reduce(
    (sum, expense) => sum + moneyStringToNumber(expense.amount),
    0
  );
  const debtPayments = moneyStringToNumber(draft.debtPayments);

  return {
    monthlyIncome,
    recurringTotal,
    miscTotal,
    debtPayments,
    afterRecurring: monthlyIncome - recurringTotal,
    afterMisc: monthlyIncome - recurringTotal - miscTotal,
    remaining: monthlyIncome - recurringTotal - miscTotal - debtPayments,
  };
};

const getSpaceIcon = (icon: string) => {
  if (icon === 'briefcase') return Building2;
  if (icon === 'receipt') return Receipt;
  if (icon === 'grid') return Grid2X2;
  return WalletCards;
};

const MessageBanner: React.FC<{ message: { type: MessageTone; text: string } | null }> = ({ message }) => {
  if (!message) return null;

  const className =
    message.type === 'success'
      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
      : message.type === 'error'
        ? 'border-rose-100 bg-rose-50 text-rose-700'
        : 'border-sky-100 bg-sky-50 text-sky-700';

  return <div className={`rounded-lg border px-4 py-3 text-sm ${className}`}>{message.text}</div>;
};

const SimpBudgetPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authMessage, setAuthMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [magicEmail, setMagicEmail] = useState('');
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [spaces, setSpaces] = useState<BudgetSpace[]>([]);
  const [records, setRecords] = useState<BudgetRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedView, setSelectedView] = useState<BudgetView>('all');
  const [selectedMonth, setSelectedMonth] = useState(DEFAULT_MONTH);
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [showArchivedSpaces, setShowArchivedSpaces] = useState(false);
  const [draft, setDraft] = useState<BudgetDraft>(createEmptyDraft('', DEFAULT_YEAR, DEFAULT_MONTH));
  const [baselineDraft, setBaselineDraft] = useState<BudgetDraft>(createEmptyDraft('', DEFAULT_YEAR, DEFAULT_MONTH));
  const [hasPersistedRecord, setHasPersistedRecord] = useState(false);
  const [selectionStatus, setSelectionStatus] = useState('Choose a Budget Space.');
  const [appMessage, setAppMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [importMessage, setImportMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [parsingImport, setParsingImport] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<{ type: MessageTone; text: string } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [sourceConnected, setSourceConnected] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDescription, setNewSpaceDescription] = useState('');
  const [newSpaceColor, setNewSpaceColor] = useState(SPACE_COLOR_OPTIONS[0].value);
  const [newSpaceIcon, setNewSpaceIcon] = useState(SPACE_ICON_OPTIONS[0].value);
  const [starterIncome, setStarterIncome] = useState('');
  const [starterRecurring, setStarterRecurring] = useState<RecurringExpenseDraft[]>([
    createRecurringExpense('', ''),
  ]);
  const [lastDeletedRecurringExpense, setLastDeletedRecurringExpense] =
    useState<RecurringExpenseDraft | null>(null);
  const autoMigrationAttemptedRef = useRef(false);

  const normalizedUserEmail = user?.email?.toLowerCase() || '';
  const isMigrationOwner = normalizedUserEmail === TREMAINE_OWNER_EMAIL;
  const visibleSpaces = useMemo(
    () => spaces.filter((space) => showArchivedSpaces || space.status !== 'archived'),
    [showArchivedSpaces, spaces]
  );
  const activeSpaces = useMemo(
    () => spaces.filter((space) => space.status !== 'archived'),
    [spaces]
  );
  const activeSpace = selectedView === 'all' ? null : spaces.find((space) => space.id === selectedView) || null;
  const comparableDraft = JSON.stringify(buildComparableDraft(draft));
  const comparableBaseline = JSON.stringify(buildComparableDraft(baselineDraft));
  const hasUnsavedChanges = selectedView !== 'all' && comparableDraft !== comparableBaseline;

  const selectedMonthRecords = records.filter(
    (record) => record.year === selectedYear && record.month === selectedMonth
  );

  const draftTotals = calculateDraftTotals(draft);
  const allTotals = activeSpaces.reduce(
    (accumulator, space) => {
      const record = selectedMonthRecords.find((candidate) => candidate.budgetSpaceId === space.id);
      const totals = calculateDraftTotals(
        record ? cloneDraft(record) : createEmptyDraft(space.id, selectedYear, selectedMonth)
      );

      accumulator.monthlyIncome += totals.monthlyIncome;
      accumulator.recurringTotal += totals.recurringTotal;
      accumulator.miscTotal += totals.miscTotal;
      accumulator.debtPayments += totals.debtPayments;
      accumulator.remaining += totals.remaining;
      return accumulator;
    },
    {
      monthlyIncome: 0,
      recurringTotal: 0,
      miscTotal: 0,
      debtPayments: 0,
      remaining: 0,
    }
  );

  const yearOptions = useMemo(
    () =>
      Array.from(new Set([DEFAULT_YEAR - 1, DEFAULT_YEAR, DEFAULT_YEAR + 1, ...records.map((record) => record.year)])).sort(
        (left, right) => left - right
      ),
    [records]
  );

  const userDocRef = (uid: string) => doc(simpBudgetDb, SIMPBUDGET_USERS_COLLECTION, uid);
  const budgetSpacesCollectionRef = (uid: string) =>
    collection(simpBudgetDb, SIMPBUDGET_USERS_COLLECTION, uid, BUDGET_SPACES_SUBCOLLECTION);
  const budgetsCollectionRef = (uid: string) =>
    collection(simpBudgetDb, SIMPBUDGET_USERS_COLLECTION, uid, BUDGETS_SUBCOLLECTION);

  const loadSimpBudgetData = async (uid: string, mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoadingData(true);

    try {
      const [spaceSnapshot, budgetSnapshot] = await Promise.all([
        getDocs(budgetSpacesCollectionRef(uid)),
        getDocs(budgetsCollectionRef(uid)),
      ]);

      const loadedSpaces = spaceSnapshot.docs
        .map((spaceDoc) => normalizeBudgetSpace(spaceDoc.id, spaceDoc.data() as Record<string, unknown>))
        .sort((left, right) => {
          if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
          return left.name.localeCompare(right.name);
        });
      const loadedRecords = budgetSnapshot.docs
        .map((budgetDoc) => normalizeBudgetRecord(budgetDoc.id, budgetDoc.data() as Record<string, unknown>))
        .filter((record) => record.budgetSpaceId)
        .sort((left, right) => {
          if (left.year !== right.year) return right.year - left.year;
          if (left.month !== right.month) return right.month - left.month;
          return left.budgetSpaceId.localeCompare(right.budgetSpaceId);
        });

      setSpaces(loadedSpaces);
      setRecords(loadedRecords);
      setAppMessage(null);

      setSelectedView((currentView) => {
        if (currentView === 'all') return currentView;
        return loadedSpaces.some((space) => space.id === currentView) ? currentView : 'all';
      });
    } catch (error) {
      console.error('Unable to load SimpBudget data:', error);
      setAppMessage({
        type: 'error',
        text: 'Unable to load SimpBudget data. Check Firebase rules and try again.',
      });
    } finally {
      if (mode === 'initial') setLoadingData(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(simpBudgetAuth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);

      if (currentUser) {
        try {
          await setDoc(
            userDocRef(currentUser.uid),
            {
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
              lastSeenAt: serverTimestamp(),
            },
            { merge: true }
          );
          await loadSimpBudgetData(currentUser.uid);
        } catch (error) {
          console.error('Unable to initialize SimpBudget user:', error);
          setSpaces([]);
          setRecords([]);
          setSelectedView('all');
          setAppMessage({
            type: 'error',
            text: readFirestoreError(error, 'Unable to initialize your SimpBudget account.'),
          });
        }
      } else {
        setSpaces([]);
        setRecords([]);
        setSelectedView('all');
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isSignInWithEmailLink(simpBudgetAuth, window.location.href)) return;

    const completeEmailLinkSignIn = async () => {
      const storedEmail = window.localStorage.getItem(MAGIC_LINK_EMAIL_STORAGE_KEY);
      const email = storedEmail || window.prompt('Confirm your email for SimpBudget sign-in') || '';
      if (!email) return;

      try {
        await signInWithEmailLink(simpBudgetAuth, email, window.location.href);
        window.localStorage.removeItem(MAGIC_LINK_EMAIL_STORAGE_KEY);
        setAuthMessage({ type: 'success', text: 'Signed in with magic link.' });
      } catch (error) {
        console.error('Magic link sign-in failed:', error);
        setAuthMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Unable to finish magic link sign-in.',
        });
      }
    };

    completeEmailLinkSignIn();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(quickLiftsAuth, (sourceUser) => {
      setSourceConnected(!!sourceUser);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (selectedView === 'all' || !selectedView) {
      setDraft(createEmptyDraft('', selectedYear, selectedMonth));
      setBaselineDraft(createEmptyDraft('', selectedYear, selectedMonth));
      setSelectionStatus('Viewing all Budget Spaces together.');
      setHasPersistedRecord(false);
      return;
    }

    const nextSelection = selectDraftForSpaceMonth(records, selectedView, selectedYear, selectedMonth);
    setDraft(cloneDraft(nextSelection.draft));
    setBaselineDraft(cloneDraft(nextSelection.draft));
    setSelectionStatus(nextSelection.statusMessage);
    setHasPersistedRecord(nextSelection.hasPersistedRecord);
  }, [records, selectedView, selectedYear, selectedMonth]);

  useEffect(() => {
    if (!hasUnsavedChanges || typeof window === 'undefined') return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const confirmUnsavedNavigation = () => {
    if (!hasUnsavedChanges || typeof window === 'undefined') return true;
    return window.confirm('You have unsaved SimpBudget edits. Leave this sheet without saving?');
  };

  const previousBudgetRecord =
    selectedView !== 'all'
      ? findPreviousBudgetRecord(records, selectedView, selectedYear, selectedMonth)
      : null;
  const previousRecurringRestoreLabel = previousBudgetRecord
    ? `Reset from ${monthYearLabel(previousBudgetRecord.month, previousBudgetRecord.year)}`
    : 'No previous month';

  const restoreRecurringFromPreviousMonth = () => {
    if (!previousBudgetRecord) return;

    const confirmed =
      typeof window === 'undefined' ||
      window.confirm(
        `Replace this month’s recurring expenses with ${monthYearLabel(previousBudgetRecord.month, previousBudgetRecord.year)}? This will only change the current draft until you save.`
      );
    if (!confirmed) return;

    setDraft((currentDraft) => ({
      ...currentDraft,
      recurringExpenses: cloneRecurringExpenses(previousBudgetRecord.recurringExpenses),
    }));
    setAppMessage({
      type: 'info',
      text: `Recurring expenses reset from ${monthYearLabel(previousBudgetRecord.month, previousBudgetRecord.year)}. Click Save Budget to keep this month’s change.`,
    });
  };

  const undoLastRecurringDelete = () => {
    if (!lastDeletedRecurringExpense) return;

    setDraft((currentDraft) => ({
      ...currentDraft,
      recurringExpenses: [
        ...currentDraft.recurringExpenses,
        {
          ...lastDeletedRecurringExpense,
          id: lastDeletedRecurringExpense.id || createLocalId('recurring'),
        },
      ],
    }));
    setAppMessage({
      type: 'info',
      text: `${lastDeletedRecurringExpense.label || 'Recurring expense'} restored. Click Save Budget to keep this month’s change.`,
    });
    setLastDeletedRecurringExpense(null);
  };

  const removeRecurringExpense = (expense: RecurringExpenseDraft) => {
    setLastDeletedRecurringExpense({ ...expense });
    setDraft((currentDraft) => ({
      ...currentDraft,
      recurringExpenses: currentDraft.recurringExpenses.filter((candidate) => candidate.id !== expense.id),
    }));
  };

  const handleGoogleSignIn = async () => {
    setAuthMessage(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await signInWithPopup(simpBudgetAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential) {
        try {
          await signInWithCredential(quickLiftsAuth, credential);
          setSourceConnected(true);
        } catch (error) {
          console.warn('Unable to connect QuickLifts source with Google credential:', error);
        }
      }
    } catch (error) {
      console.error('Google sign-in failed:', error);
      setAuthMessage({
        type: 'error',
        text: readAuthError(error, 'Unable to sign in with Google.'),
      });
    }
  };

  const handleAppleSignIn = async () => {
    setAuthMessage(null);
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');

    try {
      await signInWithPopup(simpBudgetAuth, provider);
    } catch (error) {
      console.error('Apple sign-in failed:', error);
      setAuthMessage({
        type: 'error',
        text: readAuthError(error, 'Unable to sign in with Apple.'),
      });
    }
  };

  const sendMagicLink = async () => {
    const email = magicEmail.trim();
    if (!email) {
      setAuthMessage({ type: 'error', text: 'Enter an email address first.' });
      return;
    }

    setSendingMagicLink(true);
    setAuthMessage(null);

    try {
      const actionCodeSettings = {
        url: typeof window !== 'undefined' ? window.location.origin + '/SimpBudget' : 'https://fitwithpulse.ai/SimpBudget',
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(simpBudgetAuth, email, actionCodeSettings);
      window.localStorage.setItem(MAGIC_LINK_EMAIL_STORAGE_KEY, email);
      setAuthMessage({ type: 'success', text: 'Magic link sent. Open it on this device to finish sign-in.' });
    } catch (error) {
      console.error('Unable to send magic link:', error);
      setAuthMessage({
        type: 'error',
        text: readAuthError(error, 'Unable to send magic link.'),
      });
    } finally {
      setSendingMagicLink(false);
    }
  };

  const connectQuickLiftsSource = async () => {
    setMigrationMessage(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      await signInWithPopup(quickLiftsAuth, provider);
      setSourceConnected(true);
      setMigrationMessage({ type: 'success', text: 'QuickLifts admin source connected.' });
    } catch (error) {
      console.error('Unable to connect QuickLifts source:', error);
      setMigrationMessage({
        type: 'error',
        text: readAuthError(error, 'Unable to connect the QuickLifts admin source.'),
      });
    }
  };

  const handleSignOut = async () => {
    await signOut(simpBudgetAuth);
  };

  const createBudgetSpace = async () => {
    if (!user) return;

    const trimmedName = newSpaceName.trim();
    if (!trimmedName) {
      setAppMessage({ type: 'error', text: 'Name the Budget Space first.' });
      return;
    }

    setSaving(true);
    setAppMessage(null);

    try {
      const baseSlug = slugify(trimmedName) || 'space';
      const spaceId = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
      const cleanRecurring = starterRecurring
        .map((expense) => ({
          id: expense.id || createLocalId('recurring'),
          label: expense.label.trim(),
          amount: moneyStringToNumber(expense.amount),
        }))
        .filter((expense) => expense.label || expense.amount !== 0);

      await setDoc(doc(budgetSpacesCollectionRef(user.uid), spaceId), {
        name: trimmedName,
        description: newSpaceDescription.trim(),
        icon: newSpaceIcon,
        color: newSpaceColor,
        status: 'active',
        sortOrder: spaces.length * 10 + 10,
        ownerEmail: user.email || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (starterIncome || cleanRecurring.length > 0) {
        await setDoc(doc(budgetsCollectionRef(user.uid), buildBudgetDocId(spaceId, selectedYear, selectedMonth)), {
          budgetSpaceId: spaceId,
          year: selectedYear,
          month: selectedMonth,
          monthlyIncome: moneyStringToNumber(starterIncome),
          debtPayments: 0,
          notes: '',
          recurringExpenses: cleanRecurring,
          miscExpenses: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setNewSpaceName('');
      setNewSpaceDescription('');
      setNewSpaceColor(SPACE_COLOR_OPTIONS[0].value);
      setNewSpaceIcon(SPACE_ICON_OPTIONS[0].value);
      setStarterIncome('');
      setStarterRecurring([createRecurringExpense('', '')]);
      setSelectedView(spaceId);
      await loadSimpBudgetData(user.uid, 'refresh');
      setAppMessage({ type: 'success', text: `${trimmedName} is ready.` });
    } catch (error) {
      console.error('Unable to create Budget Space:', error);
      setAppMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to create this Budget Space.',
      });
    } finally {
      setSaving(false);
    }
  };

  const migrateFounderBudgetData = async () => {
    if (!user || !isMigrationOwner) return;
    if (!quickLiftsAuth.currentUser) {
      setMigrationMessage({
        type: 'error',
        text: 'Connect the QuickLifts admin source before importing existing founder budget data.',
      });
      return;
    }

    setMigrating(true);
    setMigrationMessage(null);

    try {
      const sourceSnapshot = await getDocs(collection(quickLiftsDb, QUICKLIFTS_FOUNDER_BUDGET_COLLECTION));
      const sourceRecords = sourceSnapshot.docs
        .map((sourceDoc) => normalizeFounderBudgetSourceRecord(sourceDoc.id, sourceDoc.data() as Record<string, unknown>))
        .filter((record): record is FounderBudgetSourceRecord => !!record);

      if (!sourceRecords.length) {
        setMigrationMessage({ type: 'info', text: 'No business or personal founder budget records were found.' });
        return;
      }

      const scopes = Array.from(new Set(sourceRecords.map((record) => record.scope)));
      await Promise.all(
        scopes.map((scope, index) =>
          setDoc(
            doc(budgetSpacesCollectionRef(user.uid), scope),
            {
              name: scope === 'business' ? 'Business' : 'Personal',
              description:
                scope === 'business'
                  ? 'Migrated business founder budget expenses.'
                  : 'Migrated personal founder budget expenses.',
              icon: scope === 'business' ? 'briefcase' : 'wallet',
              color: scope === 'business' ? '#2563eb' : '#16a34a',
              status: 'active',
              sortOrder: (index + 1) * 10,
              source: 'quicklifts-founder-budget',
              sourceScope: scope,
              ownerEmail: user.email || '',
              migratedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            },
            { merge: true }
          )
        )
      );

      await Promise.all(
        sourceRecords.map((record) =>
          setDoc(
            doc(budgetsCollectionRef(user.uid), buildBudgetDocId(record.scope, record.year, record.month)),
            {
              budgetSpaceId: record.scope,
              year: record.year,
              month: record.month,
              monthlyIncome: moneyStringToNumber(record.monthlyIncome),
              debtPayments: moneyStringToNumber(record.debtPayments),
              notes: record.notes,
              recurringExpenses: record.recurringExpenses.map((expense) => ({
                id: expense.id,
                label: expense.label.trim(),
                amount: moneyStringToNumber(expense.amount),
              })),
              miscExpenses: record.miscExpenses.map((expense) => ({
                id: expense.id,
                date: expense.date,
                label: expense.label.trim(),
                amount: moneyStringToNumber(expense.amount),
                paymentMethod: normalizePaymentMethod(expense.paymentMethod),
                notes: expense.notes.trim(),
              })),
              source: 'quicklifts-founder-budget',
              sourceRecordId: record.id,
              sourceScope: record.scope,
              migratedAt: serverTimestamp(),
              createdAt: record.createdAt || serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          )
        )
      );

      await loadSimpBudgetData(user.uid, 'refresh');
      setSelectedView('all');
      setMigrationMessage({
        type: 'success',
        text: `Imported ${sourceRecords.length} saved founder budget month${sourceRecords.length === 1 ? '' : 's'} into SimpBudget.`,
      });
    } catch (error) {
      console.error('Unable to migrate founder budget data:', error);
      setMigrationMessage({
        type: 'error',
        text: readFirestoreError(error, 'Unable to import existing founder budget data.'),
      });
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    if (!user || !isMigrationOwner || !sourceConnected || loadingData || migrating) return;
    if (spaces.length > 0 || records.length > 0) return;
    if (autoMigrationAttemptedRef.current) return;

    autoMigrationAttemptedRef.current = true;
    migrateFounderBudgetData();
  }, [isMigrationOwner, loadingData, migrating, records.length, sourceConnected, spaces.length, user]);

  const updateDraftField = (field: 'monthlyIncome' | 'debtPayments' | 'notes', value: string) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: field === 'notes' ? value : sanitizeMoneyInput(value),
    }));
  };

  const updateRecurringExpense = (
    expenseId: string,
    field: keyof Omit<RecurringExpenseDraft, 'id'>,
    value: string
  ) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      recurringExpenses: currentDraft.recurringExpenses.map((expense) =>
        expense.id === expenseId
          ? { ...expense, [field]: field === 'amount' ? sanitizeMoneyInput(value) : value }
          : expense
      ),
    }));
  };

  const updateMiscExpense = (
    expenseId: string,
    field: keyof Omit<MiscExpenseDraft, 'id'>,
    value: string
  ) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      miscExpenses: currentDraft.miscExpenses.map((expense) =>
        expense.id === expenseId
          ? { ...expense, [field]: field === 'amount' ? sanitizeMoneyInput(value) : value }
          : expense
      ),
    }));
  };

  const saveDraft = async () => {
    if (!user || selectedView === 'all' || !activeSpace) return;

    setSaving(true);
    setAppMessage(null);

    try {
      const matchingRecord = records.find(
        (record) =>
          record.budgetSpaceId === draft.budgetSpaceId &&
          record.year === draft.year &&
          record.month === draft.month
      );
      const payload = {
        ...buildDraftPayload(draft),
        ownerEmail: user.email || '',
        createdAt: matchingRecord?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(budgetsCollectionRef(user.uid), buildBudgetDocId(draft.budgetSpaceId, draft.year, draft.month)), payload, {
        merge: true,
      });
      await loadSimpBudgetData(user.uid, 'refresh');
      setAppMessage({ type: 'success', text: `${activeSpace.name} saved for ${monthYearLabel(selectedMonth, selectedYear)}.` });
    } catch (error) {
      console.error('Unable to save budget:', error);
      setAppMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to save this budget.',
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadExpenseImportImageToStorage = async (file: File) => {
    if (!user || selectedView === 'all') throw new Error('Choose a Budget Space before importing.');

    const filePath = `simpbudget-imports/${user.uid}/${selectedView}/${selectedYear}-${String(selectedMonth).padStart(2, '0')}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const screenshotRef = storageRef(simpBudgetStorage, filePath);

    await uploadBytes(screenshotRef, file, {
      contentType: file.type || 'image/png',
    });

    return getDownloadURL(screenshotRef);
  };

  const requestExpenseImport = async (
    imageUrls: string[],
    additionalExistingExpenses: ParsedExpenseImport[] = []
  ) => {
    const requestPayload = {
      imageUrls,
      targetMonth: selectedMonth,
      targetYear: selectedYear,
      existingExpenses: [
        ...draft.miscExpenses.map((expense) => ({
          date: expense.date,
          label: expense.label,
          amount: moneyStringToNumber(expense.amount),
          paymentMethod: expense.paymentMethod,
          notes: expense.notes,
        })),
        ...additionalExistingExpenses,
      ],
    };

    let lastError: Error | null = null;

    for (const endpoint of [EXPENSE_IMPORT_FUNCTION_ENDPOINT, EXPENSE_IMPORT_API_ENDPOINT]) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload),
        });

        let parsedResponse: ParseExpenseImportResponse;
        try {
          parsedResponse = (await response.json()) as ParseExpenseImportResponse;
        } catch (_error) {
          parsedResponse = { error: 'Expense import endpoint returned an unreadable response.' };
        }

        if (response.status === 404) continue;
        if (!response.ok || !parsedResponse.success) {
          throw new Error(readResponseError(parsedResponse, 'Unable to parse screenshot expenses.'));
        }

        return parsedResponse;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unable to parse screenshot expenses.');
      }
    }

    throw lastError || new Error('Unable to parse screenshot expenses.');
  };

  const importExpenseScreenshots = async (files: File[]) => {
    if (!files.length) return;
    if (selectedView === 'all') {
      setImportMessage({ type: 'error', text: 'Choose one Budget Space before importing screenshots.' });
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) {
      setImportMessage({ type: 'error', text: 'Upload image screenshots for web import.' });
      return;
    }

    setParsingImport(true);
    setImportMessage(null);

    try {
      const imageUrls = await Promise.all(imageFiles.map((file) => uploadExpenseImportImageToStorage(file)));
      const parsedExpenses: ParsedExpenseImport[] = [];
      let apiDuplicateCount = 0;

      for (let index = 0; index < imageUrls.length; index += EXPENSE_IMPORT_IMAGES_PER_REQUEST) {
        const result = await requestExpenseImport(
          imageUrls.slice(index, index + EXPENSE_IMPORT_IMAGES_PER_REQUEST),
          parsedExpenses
        );
        const resultExpenses = Array.isArray(result.expenses) ? result.expenses : [];
        parsedExpenses.push(...resultExpenses);
        apiDuplicateCount += result.summary?.duplicateCount || 0;
      }

      let mergeResult = { addedExpenses: [] as MiscExpenseDraft[], duplicateCount: 0 };
      setDraft((currentDraft) => {
        mergeResult = buildImportedMiscExpenses(currentDraft.miscExpenses, parsedExpenses);
        if (!mergeResult.addedExpenses.length) return currentDraft;
        return {
          ...currentDraft,
          miscExpenses: [...currentDraft.miscExpenses, ...mergeResult.addedExpenses],
        };
      });

      const totalDuplicateCount = Math.max(apiDuplicateCount, mergeResult.duplicateCount);
      if (mergeResult.addedExpenses.length > 0) {
        setImportMessage({
          type: 'success',
          text: `Imported ${mergeResult.addedExpenses.length} misc expense${mergeResult.addedExpenses.length === 1 ? '' : 's'}. Skipped ${totalDuplicateCount} duplicate${totalDuplicateCount === 1 ? '' : 's'}.`,
        });
      } else {
        setImportMessage({
          type: 'info',
          text:
            totalDuplicateCount > 0
              ? 'Everything in that screenshot already exists for this month.'
              : 'No new expense rows were detected.',
        });
      }
    } catch (error) {
      console.error('Unable to import expenses:', error);
      setImportMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to import screenshot expenses.',
      });
    } finally {
      setParsingImport(false);
    }
  };

  const renderSpaceCreatePanel = (isFirstSpace: boolean) => (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
            <Sparkles className="h-3.5 w-3.5" />
            {isFirstSpace ? 'Start here' : 'New space'}
          </div>
          <h2 className="text-xl font-semibold text-stone-950">
            {isFirstSpace ? 'Create your first Budget Space' : 'Add another Budget Space'}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">
            Budget Spaces are separate projects like Business, Personal, a trip, a launch, or a household budget.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                Space name
              </span>
              <input
                value={newSpaceName}
                onChange={(event) => setNewSpaceName(event.target.value)}
                placeholder="Business, Personal, Launch..."
                className={fieldClassName}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                Monthly income
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">$</span>
                <input
                  value={starterIncome}
                  onChange={(event) => setStarterIncome(sanitizeMoneyInput(event.target.value))}
                  placeholder="0.00"
                  inputMode="decimal"
                  className={`${fieldClassName} pl-8`}
                />
              </div>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
              Description
            </span>
            <input
              value={newSpaceDescription}
              onChange={(event) => setNewSpaceDescription(event.target.value)}
              placeholder="What this budget is for"
              className={fieldClassName}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                Icon
              </span>
              <select
                value={newSpaceIcon}
                onChange={(event) => setNewSpaceIcon(event.target.value)}
                className={fieldClassName}
              >
                {SPACE_ICON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                Color
              </span>
              <div className="flex flex-wrap gap-2">
                {SPACE_COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setNewSpaceColor(option.value)}
                    className={`h-10 w-10 rounded-lg border-2 transition ${
                      newSpaceColor === option.value ? 'border-stone-900' : 'border-white'
                    }`}
                    style={{ backgroundColor: option.value }}
                    aria-label={option.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-stone-200 bg-[#FAFAF7] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-stone-950">Recurring expenses</div>
            <button
              type="button"
              onClick={() => setStarterRecurring((current) => [...current, createRecurringExpense()])}
              className="rounded-lg border border-stone-200 bg-white p-2 text-stone-600 transition hover:border-stone-300 hover:text-stone-950"
              aria-label="Add starter recurring expense"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            {starterRecurring.map((expense) => (
              <div key={expense.id} className="grid grid-cols-[minmax(0,1fr)_110px_36px] gap-2">
                <input
                  value={expense.label}
                  onChange={(event) =>
                    setStarterRecurring((current) =>
                      current.map((candidate) =>
                        candidate.id === expense.id ? { ...candidate, label: event.target.value } : candidate
                      )
                    )
                  }
                  placeholder="Expense"
                  className={fieldClassName}
                />
                <input
                  value={expense.amount}
                  onChange={(event) =>
                    setStarterRecurring((current) =>
                      current.map((candidate) =>
                        candidate.id === expense.id
                          ? { ...candidate, amount: sanitizeMoneyInput(event.target.value) }
                          : candidate
                      )
                    )
                  }
                  placeholder="0.00"
                  inputMode="decimal"
                  className={fieldClassName}
                />
                <button
                  type="button"
                  onClick={() =>
                    setStarterRecurring((current) =>
                      current.length === 1
                        ? [createRecurringExpense('', '')]
                        : current.filter((candidate) => candidate.id !== expense.id)
                    )
                  }
                  className="rounded-lg border border-stone-200 bg-white p-2 text-stone-500 transition hover:border-rose-200 hover:text-rose-600"
                  aria-label="Remove starter recurring expense"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={createBudgetSpace}
            disabled={saving}
            className={`${pillButtonClassName} mt-4 w-full bg-stone-900 text-white hover:bg-stone-800`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Budget Space
          </button>
        </div>
      </div>
    </section>
  );

  const renderLanding = () => (
    <div className="min-h-screen bg-[#FAFAF7] text-stone-900">
      <Head>
        <title>SimpBudget | Budget Spaces</title>
      </Head>

      <main className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-6 py-7 lg:px-10 xl:px-14">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-900 text-white">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold">SimpBudget</div>
              <div className="text-xs text-stone-500">Budget Spaces for real monthly spend</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-stone-500 sm:flex">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Firebase auth + Firestore
          </div>
        </header>

        <section className="grid flex-1 items-stretch gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)] xl:gap-12">
          <div className="flex min-h-[calc(100vh-7rem)] flex-col justify-between rounded-lg border border-stone-200 bg-white p-6 lg:p-8">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Web app
              </div>
              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-stone-950 md:text-7xl xl:text-8xl">
                One budget, every space.
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-600 xl:text-xl xl:leading-9">
                Create Budget Spaces for business, personal, or any project, then view each one alone or rolled up into one monthly picture.
              </p>
            </div>

            <div className="mt-10 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-lg border border-stone-200 bg-white p-5">
                <div className="flex items-center justify-between border-b border-stone-200 pb-4">
                  <div>
                    <div className="text-sm font-semibold text-stone-950">July Overview</div>
                    <div className="mt-1 text-xs text-stone-500">All Budget Spaces</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-emerald-700">$4,280</div>
                    <div className="text-xs text-stone-500">remaining</div>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Recurring', value: '$2,140' },
                    { label: 'Misc', value: '$680' },
                    { label: 'Debt', value: '$320' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-stone-200 bg-[#FAFAF7] p-4">
                      <div className="text-xs text-stone-500">{item.label}</div>
                      <div className="mt-2 text-lg font-semibold text-stone-950">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                {[
                  { label: 'Business', value: 'Launch spend' },
                  { label: 'Personal', value: 'Household cashflow' },
                  { label: 'AI Import', value: 'Screenshots to rows' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-stone-200 bg-white p-4">
                    <div className="text-sm font-semibold text-stone-950">{item.label}</div>
                    <div className="mt-1 text-sm text-stone-500">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="flex min-h-[calc(100vh-7rem)] flex-col justify-center rounded-lg border border-stone-200 bg-white p-6 shadow-sm lg:p-8">
            <div className="mb-7">
              <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Sign in</h2>
              <p className="mt-3 text-base leading-7 text-stone-500">
                Use the same Tremaine Google account to import the existing admin budget data.
              </p>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className={`${pillButtonClassName} min-h-12 w-full bg-stone-900 text-base text-white hover:bg-stone-800`}
              >
                <ShieldCheck className="h-4 w-4" />
                Continue with Google
              </button>
              <button
                type="button"
                onClick={handleAppleSignIn}
                className={`${pillButtonClassName} min-h-12 w-full border border-stone-200 bg-white text-base text-stone-700 hover:border-stone-300 hover:text-stone-950`}
              >
                <ShieldCheck className="h-4 w-4" />
                Continue with Apple
              </button>

              <div className="h-px bg-stone-100" />

              <div className="flex gap-2">
                <input
                  value={magicEmail}
                  onChange={(event) => setMagicEmail(event.target.value)}
                  placeholder="Email magic link"
                  inputMode="email"
                  className={fieldClassName}
                />
                <button
                  type="button"
                  onClick={sendMagicLink}
                  disabled={sendingMagicLink}
                  className={`${pillButtonClassName} border border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:text-stone-950`}
                  aria-label="Send magic link"
                >
                  {sendingMagicLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <MessageBanner message={authMessage} />
            </div>
          </aside>
        </section>
      </main>
    </div>
  );

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF7] text-stone-500">
        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
        Loading SimpBudget...
      </div>
    );
  }

  if (!user) return renderLanding();

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-stone-900">
      <Head>
        <title>SimpBudget | Budget Spaces</title>
      </Head>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-stone-900 text-white">
                <CircleDollarSign className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">SimpBudget</h1>
                <p className="text-sm text-stone-500">{user.email || 'Signed in'}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!confirmUnsavedNavigation()) return;
                const previousMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
                setSelectedYear((currentYear) => (selectedMonth === 1 ? currentYear - 1 : currentYear));
                setSelectedMonth(previousMonth);
              }}
              className={`${pillButtonClassName} border border-stone-200 bg-white text-stone-600 hover:border-stone-200`}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="grid grid-cols-[150px_100px] gap-2">
              <select
                value={selectedMonth}
                onChange={(event) => {
                  if (!confirmUnsavedNavigation()) return;
                  setSelectedMonth(Number(event.target.value));
                }}
                className={fieldClassName}
              >
                {MONTH_OPTIONS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(event) => {
                  if (!confirmUnsavedNavigation()) return;
                  setSelectedYear(Number(event.target.value));
                }}
                className={fieldClassName}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!confirmUnsavedNavigation()) return;
                const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
                setSelectedYear((currentYear) => (selectedMonth === 12 ? currentYear + 1 : currentYear));
                setSelectedMonth(nextMonth);
              }}
              className={`${pillButtonClassName} border border-stone-200 bg-white text-stone-600 hover:border-stone-200`}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className={`${pillButtonClassName} border border-stone-200 bg-white text-stone-600 hover:border-stone-200`}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </header>

        <div className="mb-5 flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (!confirmUnsavedNavigation()) return;
                setSelectedView('all');
              }}
              className={`${pillButtonClassName} ${
                selectedView === 'all'
                  ? 'bg-stone-900 text-white'
                  : 'border border-stone-200 bg-[#FAFAF7] text-stone-600 hover:border-stone-200'
              }`}
            >
              <Grid2X2 className="h-4 w-4" />
              All Budgets
            </button>

            {visibleSpaces.map((space) => {
              const Icon = getSpaceIcon(space.icon);
              const isSelected = selectedView === space.id;
              return (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => {
                    if (!confirmUnsavedNavigation()) return;
                    setSelectedView(space.id);
                  }}
                  className={`${pillButtonClassName} ${
                    isSelected
                      ? 'bg-stone-900 text-white'
                      : 'border border-stone-200 bg-[#FAFAF7] text-stone-600 hover:border-stone-200'
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md text-white" style={{ backgroundColor: space.color }}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {space.name}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 text-sm text-stone-500">
            <input
              type="checkbox"
              checked={showArchivedSpaces}
              onChange={(event) => setShowArchivedSpaces(event.target.checked)}
              className="h-4 w-4 rounded border-stone-200 bg-[#FAFAF7]"
            />
            Show archived spaces
          </label>
        </div>

        <div className="space-y-5">
          <MessageBanner message={appMessage} />

          {loadingData ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              Loading budget spaces...
            </div>
          ) : spaces.length === 0 ? (
            <>
              {renderSpaceCreatePanel(true)}
              {isMigrationOwner && (
                <section className="rounded-lg border border-stone-200 bg-white p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-stone-950">Import existing admin budget data</h2>
                      <p className="mt-1 text-sm text-stone-500">
                        This copies the QuickLifts admin founder budget records into this SimpBudget Firebase account.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={connectQuickLiftsSource}
                      className={`${pillButtonClassName} border border-stone-200 bg-[#FAFAF7] text-stone-600 hover:border-stone-300`}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {sourceConnected ? 'Source connected' : 'Connect QuickLifts source'}
                    </button>
                    <button
                      type="button"
                      onClick={migrateFounderBudgetData}
                      disabled={migrating || !sourceConnected}
                      className={`${pillButtonClassName} bg-stone-900 text-white hover:bg-stone-800`}
                    >
                      {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                      Import founder budget
                    </button>
                  </div>
                  <div className="mt-4">
                    <MessageBanner message={migrationMessage} />
                  </div>
                </section>
              )}
            </>
          ) : (
            <>
              {isMigrationOwner && (
                <section className="rounded-lg border border-stone-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-stone-950">QuickLifts admin data migration</div>
                      <div className="mt-1 text-sm text-stone-500">
                        Re-run this after admin edits if you need to refresh migrated Business and Personal months.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={connectQuickLiftsSource}
                        className={`${pillButtonClassName} border border-stone-200 bg-[#FAFAF7] text-stone-600 hover:border-stone-300`}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {sourceConnected ? 'Source connected' : 'Connect source'}
                      </button>
                      <button
                        type="button"
                        onClick={migrateFounderBudgetData}
                        disabled={migrating || !sourceConnected}
                        className={`${pillButtonClassName} bg-stone-900 text-white hover:bg-stone-800`}
                      >
                        {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                        Import data
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <MessageBanner message={migrationMessage} />
                  </div>
                </section>
              )}

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Income', value: selectedView === 'all' ? allTotals.monthlyIncome : draftTotals.monthlyIncome, color: 'text-emerald-600' },
                  { label: 'Recurring', value: selectedView === 'all' ? allTotals.recurringTotal : draftTotals.recurringTotal, color: 'text-sky-600' },
                  { label: 'Misc', value: selectedView === 'all' ? allTotals.miscTotal : draftTotals.miscTotal, color: 'text-pink-600' },
                  { label: 'Remaining', value: selectedView === 'all' ? allTotals.remaining : draftTotals.remaining, color: 'text-amber-600' },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-lg border border-stone-200 bg-white p-4">
                    <div className={`mb-3 ${metric.color}`}>
                      <CircleDollarSign className="h-5 w-5" />
                    </div>
                    <div className="text-sm text-stone-500">{metric.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-stone-950">{formatCurrency(metric.value)}</div>
                  </div>
                ))}
              </section>

              {selectedView === 'all' ? (
                <section className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    {activeSpaces.map((space) => {
                      const Icon = getSpaceIcon(space.icon);
                      const record = selectedMonthRecords.find((candidate) => candidate.budgetSpaceId === space.id);
                      const totals = calculateDraftTotals(
                        record ? cloneDraft(record) : createEmptyDraft(space.id, selectedYear, selectedMonth)
                      );

                      return (
                        <button
                          key={space.id}
                          type="button"
                          onClick={() => setSelectedView(space.id)}
                          className="rounded-lg border border-stone-200 bg-white p-5 text-left transition hover:border-stone-200"
                        >
                          <div className="mb-4 flex items-start gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-lg text-white" style={{ backgroundColor: space.color }}>
                              <Icon className="h-5 w-5" />
                            </span>
                            <div>
                              <div className="text-lg font-semibold text-stone-950">{space.name}</div>
                              <div className="text-sm text-stone-500">Remaining {formatCurrency(totals.remaining)}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-3 text-sm">
                            <div>
                              <div className="text-stone-500">Income</div>
                              <div className="font-semibold text-stone-950">{formatCurrency(totals.monthlyIncome)}</div>
                            </div>
                            <div>
                              <div className="text-stone-500">Recurring</div>
                              <div className="font-semibold text-stone-950">{formatCurrency(totals.recurringTotal)}</div>
                            </div>
                            <div>
                              <div className="text-stone-500">Misc</div>
                              <div className="font-semibold text-stone-950">{formatCurrency(totals.miscTotal)}</div>
                            </div>
                            <div>
                              <div className="text-stone-500">Debt</div>
                              <div className="font-semibold text-stone-950">{formatCurrency(totals.debtPayments)}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {renderSpaceCreatePanel(false)}
                </section>
              ) : activeSpace ? (
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_360px]">
                  <div className="space-y-5">
                    <section className="rounded-lg border border-stone-200 bg-white">
                      <div className="flex flex-col gap-3 border-b border-stone-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                            <Calendar className="h-4 w-4 text-sky-600" />
                            Recurring Monthly Expenses
                          </div>
                          <div className="mt-1 text-sm text-stone-500">{selectionStatus}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {lastDeletedRecurringExpense && (
                            <button
                              type="button"
                              onClick={undoLastRecurringDelete}
                              className={`${pillButtonClassName} border border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-200`}
                            >
                              <RotateCcw className="h-4 w-4" />
                              Undo deleted item
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={restoreRecurringFromPreviousMonth}
                            disabled={!previousBudgetRecord}
                            className={`${pillButtonClassName} border border-stone-200 bg-[#FAFAF7] text-stone-600 hover:border-stone-300`}
                            title={previousBudgetRecord ? previousRecurringRestoreLabel : 'No earlier saved month for this Budget Space'}
                          >
                            <RotateCcw className="h-4 w-4" />
                            {previousRecurringRestoreLabel}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((currentDraft) => ({
                                ...currentDraft,
                                recurringExpenses: [...currentDraft.recurringExpenses, createRecurringExpense()],
                              }))
                            }
                            className={`${pillButtonClassName} border border-stone-200 bg-[#FAFAF7] text-stone-600 hover:border-stone-300`}
                          >
                            <Plus className="h-4 w-4" />
                            Add recurring
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto p-3">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs uppercase tracking-[0.14em] text-stone-500">
                              <th className="px-3 py-3 font-semibold">Expense</th>
                              <th className="w-44 px-3 py-3 font-semibold">Amount</th>
                              <th className="w-16 px-3 py-3" />
                            </tr>
                          </thead>
                          <tbody>
                            {draft.recurringExpenses.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="px-3 py-8 text-center text-stone-500">
                                  No recurring expenses yet.
                                </td>
                              </tr>
                            ) : (
                              draft.recurringExpenses.map((expense) => (
                                <tr key={expense.id} className="border-t border-stone-200">
                                  <td className="px-3 py-3">
                                    <input
                                      value={expense.label}
                                      onChange={(event) => updateRecurringExpense(expense.id, 'label', event.target.value)}
                                      placeholder="Expense name"
                                      className={fieldClassName}
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <input
                                      value={expense.amount}
                                      onChange={(event) => updateRecurringExpense(expense.id, 'amount', event.target.value)}
                                      placeholder="0.00"
                                      inputMode="decimal"
                                      className={fieldClassName}
                                    />
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => removeRecurringExpense(expense)}
                                      className="rounded-lg border border-stone-200 bg-white p-2 text-stone-500 transition hover:border-rose-200 hover:text-rose-600"
                                      aria-label="Remove recurring expense"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section className="rounded-lg border border-stone-200 bg-white">
                      <div className="flex flex-col gap-3 border-b border-stone-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-stone-950">
                            <Receipt className="h-4 w-4 text-pink-600" />
                            Misc Expenses
                          </div>
                          <div className="mt-1 text-sm text-stone-500">Month-specific expenses for {monthYearLabel(selectedMonth, selectedYear)}.</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              const files = Array.from(event.target.files || []);
                              event.target.value = '';
                              importExpenseScreenshots(files);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={parsingImport}
                            className={`${pillButtonClassName} border border-stone-200 bg-[#FAFAF7] text-stone-600 hover:border-stone-300`}
                          >
                            {parsingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileImage className="h-4 w-4" />}
                            AI import
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((currentDraft) => ({
                                ...currentDraft,
                                miscExpenses: [...currentDraft.miscExpenses, createMiscExpense()],
                              }))
                            }
                            className={`${pillButtonClassName} border border-stone-200 bg-[#FAFAF7] text-stone-600 hover:border-stone-300`}
                          >
                            <Plus className="h-4 w-4" />
                            Add misc
                          </button>
                        </div>
                      </div>

                      <div className="p-4">
                        <MessageBanner message={importMessage} />
                      </div>

                      <div className="overflow-x-auto p-3 pt-0">
                        <table className="min-w-[920px] text-sm">
                          <thead>
                            <tr className="text-left text-xs uppercase tracking-[0.14em] text-stone-500">
                              <th className="w-36 px-3 py-3 font-semibold">Date</th>
                              <th className="px-3 py-3 font-semibold">Expense</th>
                              <th className="w-36 px-3 py-3 font-semibold">Amount</th>
                              <th className="w-40 px-3 py-3 font-semibold">Payment</th>
                              <th className="w-56 px-3 py-3 font-semibold">Notes</th>
                              <th className="w-16 px-3 py-3" />
                            </tr>
                          </thead>
                          <tbody>
                            {draft.miscExpenses.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-3 py-8 text-center text-stone-500">
                                  No misc expenses yet.
                                </td>
                              </tr>
                            ) : (
                              draft.miscExpenses.map((expense) => (
                                <tr key={expense.id} className="border-t border-stone-200">
                                  <td className="px-3 py-3">
                                    <input
                                      value={expense.date}
                                      onChange={(event) => updateMiscExpense(expense.id, 'date', event.target.value)}
                                      type="date"
                                      className={fieldClassName}
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <input
                                      value={expense.label}
                                      onChange={(event) => updateMiscExpense(expense.id, 'label', event.target.value)}
                                      placeholder="Expense name"
                                      className={fieldClassName}
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <input
                                      value={expense.amount}
                                      onChange={(event) => updateMiscExpense(expense.id, 'amount', event.target.value)}
                                      placeholder="0.00"
                                      inputMode="decimal"
                                      className={fieldClassName}
                                    />
                                  </td>
                                  <td className="px-3 py-3">
                                    <select
                                      value={expense.paymentMethod}
                                      onChange={(event) => updateMiscExpense(expense.id, 'paymentMethod', event.target.value)}
                                      className={fieldClassName}
                                    >
                                      {PAYMENT_METHOD_OPTIONS.map((paymentMethod) => (
                                        <option key={paymentMethod} value={paymentMethod}>
                                          {paymentMethod}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-3 py-3">
                                    <input
                                      value={expense.notes}
                                      onChange={(event) => updateMiscExpense(expense.id, 'notes', event.target.value)}
                                      placeholder="Optional"
                                      className={fieldClassName}
                                    />
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDraft((currentDraft) => ({
                                          ...currentDraft,
                                          miscExpenses: currentDraft.miscExpenses.filter((candidate) => candidate.id !== expense.id),
                                        }))
                                      }
                                      className="rounded-lg border border-stone-200 bg-white p-2 text-stone-500 transition hover:border-rose-200 hover:text-rose-600"
                                      aria-label="Remove misc expense"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>

                  <aside className="space-y-5">
                    <section className="rounded-lg border border-stone-200 bg-white p-5">
                      <div className="mb-5 flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-lg text-white" style={{ backgroundColor: activeSpace.color }}>
                          {React.createElement(getSpaceIcon(activeSpace.icon), { className: 'h-5 w-5' })}
                        </span>
                        <div>
                          <h2 className="text-lg font-semibold text-stone-950">{activeSpace.name}</h2>
                          <p className="text-sm text-stone-500">
                            {hasPersistedRecord ? 'Saved month' : 'Draft month'} · {hasUnsavedChanges ? 'Unsaved' : 'Saved'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block">
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                            Monthly income
                          </span>
                          <input
                            value={draft.monthlyIncome}
                            onChange={(event) => updateDraftField('monthlyIncome', event.target.value)}
                            placeholder="0.00"
                            inputMode="decimal"
                            className={fieldClassName}
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                            Debt payments
                          </span>
                          <input
                            value={draft.debtPayments}
                            onChange={(event) => updateDraftField('debtPayments', event.target.value)}
                            placeholder="0.00"
                            inputMode="decimal"
                            className={fieldClassName}
                          />
                        </label>

                        <div className="rounded-lg border border-stone-200 bg-[#FAFAF7] p-4">
                          <div className="space-y-3 text-sm">
                            {[
                              ['Income', draftTotals.monthlyIncome],
                              ['Recurring', draftTotals.recurringTotal],
                              ['After recurring', draftTotals.afterRecurring],
                              ['Misc', draftTotals.miscTotal],
                              ['After misc', draftTotals.afterMisc],
                              ['Debt', draftTotals.debtPayments],
                              ['Remaining', draftTotals.remaining],
                            ].map(([label, value]) => (
                              <div key={label} className="flex items-center justify-between gap-4">
                                <span className="text-stone-500">{label}</span>
                                <span className="font-semibold text-stone-950">{formatCurrency(value as number)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <label className="block">
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                            Notes
                          </span>
                          <textarea
                            value={draft.notes}
                            onChange={(event) => updateDraftField('notes', event.target.value)}
                            rows={5}
                            placeholder="Notes for this month"
                            className={`${fieldClassName} resize-none`}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={saveDraft}
                          disabled={saving}
                          className={`${pillButtonClassName} w-full bg-stone-900 text-white hover:bg-stone-800`}
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save Budget
                        </button>
                      </div>
                    </section>
                  </aside>
                </section>
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default SimpBudgetPage;
