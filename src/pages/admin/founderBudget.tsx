import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { auth, db, storage } from '../../api/firebase/config';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Calendar,
  DollarSign,
  ImagePlus,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';

type BudgetScope = 'personal' | 'business';

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

interface FounderBudgetDraft {
  scope: BudgetScope;
  year: number;
  month: number;
  monthlyIncome: string;
  debtPayments: string;
  notes: string;
  recurringExpenses: RecurringExpenseDraft[];
  miscExpenses: MiscExpenseDraft[];
}

interface FounderBudgetRecord extends FounderBudgetDraft {
  id: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface DraftSelectionResult {
  draft: FounderBudgetDraft;
  statusMessage: string;
  hasPersistedRecord: boolean;
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

const CURRENT_DATE = new Date();
const DEFAULT_MONTH = CURRENT_DATE.getMonth() + 1;
const DEFAULT_YEAR = CURRENT_DATE.getFullYear();
const FOUNDER_BUDGET_COLLECTION = 'founder-budgets';

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
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

const BUSINESS_RECURRING_TEMPLATE = [
  { label: 'Figma', amount: '40' },
  { label: 'ChatGPT', amount: '20' },
  { label: 'GSuite', amount: '52.8' },
  { label: 'Product Designer Contractor', amount: '100' },
  { label: 'SendInBlue', amount: '69' },
  { label: 'Cursor', amount: '200' },
  { label: 'Claude AI', amount: '20' },
  { label: 'SwitchYards', amount: '100' },
  { label: 'Google One', amount: '20' },
  { label: 'GymPass', amount: '289' },
  { label: 'ElevenLabs', amount: '5' },
  { label: 'Capcut', amount: '9.99' },
  { label: 'FITNESS YOUR WAY', amount: '29.99' },
];

const scopeMeta: Record<
  BudgetScope,
  {
    title: string;
    description: string;
    accent: string;
    button: string;
    activeChip: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  personal: {
    title: 'Personal Founder Expenses',
    description: 'Track personal monthly overhead, debt, and one-off cash outflows.',
    accent: 'from-amber-400/30 via-orange-500/10 to-transparent',
    button: 'bg-amber-400 text-black hover:bg-amber-300',
    activeChip: 'bg-amber-400/15 text-amber-100 border border-amber-400/30',
    icon: Wallet,
  },
  business: {
    title: 'Business Expenses',
    description: 'Track recurring software, contractors, and monthly business misc spend.',
    accent: 'from-sky-400/30 via-emerald-400/10 to-transparent',
    button: 'bg-[#E0FE10] text-black hover:bg-[#d2ef0e]',
    activeChip: 'bg-[#E0FE10]/12 text-[#F2FFC4] border border-[#E0FE10]/30',
    icon: Briefcase,
  },
};

const fieldClassName =
  'w-full rounded-xl border border-zinc-700 bg-[#111417] px-3 py-2 text-sm text-white outline-none transition focus:border-[#E0FE10]/70 focus:ring-2 focus:ring-[#E0FE10]/10';

const createLocalId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

const createEmptyDraft = (scope: BudgetScope, year: number, month: number): FounderBudgetDraft => ({
  scope,
  year,
  month,
  monthlyIncome: '',
  debtPayments: '',
  notes: '',
  recurringExpenses: [],
  miscExpenses: [],
});

const buildBusinessTemplateDraft = (year: number, month: number): FounderBudgetDraft => ({
  scope: 'business',
  year,
  month,
  monthlyIncome: '',
  debtPayments: '',
  notes: '',
  recurringExpenses: BUSINESS_RECURRING_TEMPLATE.map((entry, index) => ({
    id: `business-template-${index + 1}`,
    label: entry.label,
    amount: entry.amount,
  })),
  miscExpenses: [],
});

const cloneBudgetDraft = (draft: FounderBudgetDraft): FounderBudgetDraft => ({
  ...draft,
  recurringExpenses: draft.recurringExpenses.map((expense) => ({ ...expense })),
  miscExpenses: draft.miscExpenses.map((expense) => ({ ...expense })),
});

const sanitizeMoneyInput = (value: string) => value.replace(/[^0-9.-]/g, '');

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '-');

const moneyStringToNumber = (value: string) => {
  const parsed = Number.parseFloat(sanitizeMoneyInput(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const compactMoneyString = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(sanitizeMoneyInput(value));
    if (Number.isFinite(parsed)) {
      return parsed.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    }
  }

  return '';
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const monthLabel = (month: number) => MONTH_OPTIONS.find((option) => option.value === month)?.label || 'Month';

const monthYearLabel = (month: number, year: number) => `${monthLabel(month)} ${year}`;

const buildBudgetDocId = (scope: BudgetScope, year: number, month: number) =>
  `${scope}-${year}-${String(month).padStart(2, '0')}`;

const normalizePaymentMethod = (value?: string) =>
  PAYMENT_METHOD_OPTIONS.includes(value || '') ? (value as string) : 'Other';

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
  const leftAmount = moneyStringToNumber(String(left.amount || ''));
  const rightAmount = moneyStringToNumber(String(right.amount || ''));
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

    if (!candidate.label || moneyStringToNumber(candidate.amount) === 0) {
      return;
    }

    const isDuplicate = comparisonPool.some((existingExpense) => expensesLikelyMatch(existingExpense, candidate));
    if (isDuplicate) {
      duplicateCount += 1;
      return;
    }

    addedExpenses.push(candidate);
    comparisonPool.push(candidate);
  });

  return {
    addedExpenses,
    duplicateCount,
  };
};

const timestampToDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    const timestampLike = value as { toDate?: () => Date };
    if (typeof timestampLike.toDate === 'function') {
      return timestampLike.toDate();
    }
  }
  return null;
};

const formatTimestampLabel = (value: unknown) => {
  const date = timestampToDate(value);
  if (!date) return 'Not saved yet';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

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
      const paymentMethod =
        typeof expense.paymentMethod === 'string' && PAYMENT_METHOD_OPTIONS.includes(expense.paymentMethod)
          ? expense.paymentMethod
          : PAYMENT_METHOD_OPTIONS[0];

      return {
        id: typeof expense.id === 'string' && expense.id.trim() ? expense.id : `misc-${index + 1}`,
        date: typeof expense.date === 'string' ? expense.date : '',
        label: typeof expense.label === 'string' ? expense.label : '',
        amount: compactMoneyString(expense.amount),
        paymentMethod,
        notes: typeof expense.notes === 'string' ? expense.notes : '',
      };
    })
    .filter((expense) => expense.label.trim() || expense.amount || expense.notes.trim() || expense.date);
};

const normalizeBudgetRecord = (id: string, raw: Record<string, unknown>): FounderBudgetRecord => {
  const scope: BudgetScope = raw.scope === 'personal' ? 'personal' : 'business';
  const year = typeof raw.year === 'number' && Number.isFinite(raw.year) ? raw.year : DEFAULT_YEAR;
  const month = typeof raw.month === 'number' && Number.isFinite(raw.month) ? raw.month : DEFAULT_MONTH;

  return {
    id,
    scope,
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

const sortBudgetRecords = (records: FounderBudgetRecord[]) =>
  [...records].sort((left, right) => {
    if (left.year !== right.year) return right.year - left.year;
    if (left.month !== right.month) return right.month - left.month;
    return left.scope.localeCompare(right.scope);
  });

const buildComparableDraft = (draft: FounderBudgetDraft) => ({
  scope: draft.scope,
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
    .filter(
      (expense) =>
        expense.date ||
        expense.label ||
        expense.amount !== 0 ||
        expense.notes
    ),
});

const buildDraftForSelection = (
  records: FounderBudgetRecord[],
  scope: BudgetScope,
  year: number,
  month: number
): DraftSelectionResult => {
  const exactRecord = records.find(
    (record) => record.scope === scope && record.year === year && record.month === month
  );

  if (exactRecord) {
    return {
      draft: cloneBudgetDraft(exactRecord),
      hasPersistedRecord: true,
      statusMessage: `Loaded saved ${scope} budget for ${monthYearLabel(month, year)}.`,
    };
  }

  const previousRecord = [...records]
    .filter(
      (record) =>
        record.scope === scope &&
        (record.year < year || (record.year === year && record.month < month))
    )
    .sort((left, right) => {
      if (left.year !== right.year) return right.year - left.year;
      return right.month - left.month;
    })[0];

  if (previousRecord) {
    return {
      draft: {
        scope,
        year,
        month,
        monthlyIncome: previousRecord.monthlyIncome,
        debtPayments: previousRecord.debtPayments,
        notes: '',
        recurringExpenses: previousRecord.recurringExpenses.map((expense) => ({ ...expense })),
        miscExpenses: [],
      },
      hasPersistedRecord: false,
      statusMessage: `New ${scope} draft for ${monthYearLabel(month, year)} seeded from ${monthYearLabel(previousRecord.month, previousRecord.year)}.`,
    };
  }

  if (scope === 'business') {
    return {
      draft: buildBusinessTemplateDraft(year, month),
      hasPersistedRecord: false,
      statusMessage: 'New business draft started from your current recurring software + contractor stack.',
    };
  }

  return {
    draft: createEmptyDraft(scope, year, month),
    hasPersistedRecord: false,
    statusMessage: `New blank personal draft for ${monthYearLabel(month, year)}.`,
  };
};

const FounderBudgetAdminPage: React.FC = () => {
  const router = useRouter();
  const expenseScreenshotInputRef = useRef<HTMLInputElement | null>(null);
  const [records, setRecords] = useState<FounderBudgetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [parsingExpenseScreenshots, setParsingExpenseScreenshots] = useState(false);
  const [activeScope, setActiveScope] = useState<BudgetScope>('business');
  const [selectedMonth, setSelectedMonth] = useState(DEFAULT_MONTH);
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [draft, setDraft] = useState<FounderBudgetDraft>(createEmptyDraft('business', DEFAULT_YEAR, DEFAULT_MONTH));
  const [baselineDraft, setBaselineDraft] = useState<FounderBudgetDraft>(createEmptyDraft('business', DEFAULT_YEAR, DEFAULT_MONTH));
  const [selectionStatus, setSelectionStatus] = useState('Loading founder budget...');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [hasPersistedRecord, setHasPersistedRecord] = useState(false);
  const [expenseImportMessage, setExpenseImportMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [expenseScreenshotFiles, setExpenseScreenshotFiles] = useState<File[]>([]);
  const [expenseScreenshotPreviewUrls, setExpenseScreenshotPreviewUrls] = useState<string[]>([]);

  const comparableDraft = JSON.stringify(buildComparableDraft(draft));
  const comparableBaseline = JSON.stringify(buildComparableDraft(baselineDraft));
  const hasUnsavedChanges = comparableDraft !== comparableBaseline;

  const matchingRecord = records.find(
    (record) =>
      record.scope === activeScope &&
      record.year === selectedYear &&
      record.month === selectedMonth
  );

  const recurringTotal = draft.recurringExpenses.reduce(
    (sum, expense) => sum + moneyStringToNumber(expense.amount),
    0
  );
  const monthlyIncome = moneyStringToNumber(draft.monthlyIncome);
  const miscTotal = draft.miscExpenses.reduce((sum, expense) => sum + moneyStringToNumber(expense.amount), 0);
  const debtPayments = moneyStringToNumber(draft.debtPayments);
  const afterMonthly = monthlyIncome - recurringTotal;
  const afterMonthlyAndMisc = afterMonthly - miscTotal;
  const afterDebtMonthlyAndMisc = afterMonthlyAndMisc - debtPayments;

  const paymentMethodTotals = PAYMENT_METHOD_OPTIONS.map((paymentMethod) => ({
    paymentMethod,
    total: draft.miscExpenses
      .filter((expense) => expense.paymentMethod === paymentMethod)
      .reduce((sum, expense) => sum + moneyStringToNumber(expense.amount), 0),
  })).filter((entry) => entry.total > 0);

  const yearOptions = Array.from(
    new Set([
      DEFAULT_YEAR - 1,
      DEFAULT_YEAR,
      DEFAULT_YEAR + 1,
      ...records.map((record) => record.year),
    ])
  ).sort((left, right) => left - right);

  const activeScopeMeta = scopeMeta[activeScope];

  const loadBudgets = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const snapshot = await getDocs(collection(db, FOUNDER_BUDGET_COLLECTION));
      const loadedRecords = snapshot.docs.map((budgetDoc) =>
        normalizeBudgetRecord(budgetDoc.id, budgetDoc.data() as Record<string, unknown>)
      );
      setRecords(sortBudgetRecords(loadedRecords));
      setMessage(null);
    } catch (error) {
      console.error('Error loading founder budgets:', error);
      setMessage({
        type: 'error',
        text: 'Unable to load founder budgets right now. Please try again.',
      });
    } finally {
      if (mode === 'initial') {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  useEffect(() => {
    const nextSelection = buildDraftForSelection(records, activeScope, selectedYear, selectedMonth);
    setDraft(cloneBudgetDraft(nextSelection.draft));
    setBaselineDraft(cloneBudgetDraft(nextSelection.draft));
    setSelectionStatus(nextSelection.statusMessage);
    setHasPersistedRecord(nextSelection.hasPersistedRecord);
  }, [records, activeScope, selectedYear, selectedMonth]);

  useEffect(() => {
    if (!hasUnsavedChanges || typeof window === 'undefined') return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    return () => {
      expenseScreenshotPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [expenseScreenshotPreviewUrls]);

  const confirmNavigationWithUnsavedChanges = () => {
    if (!hasUnsavedChanges || typeof window === 'undefined') return true;
    return window.confirm('You have unsaved founder budget edits. Leave this month without saving?');
  };

  const handleScopeChange = (scope: BudgetScope) => {
    if (scope === activeScope) return;
    if (!confirmNavigationWithUnsavedChanges()) return;
    setActiveScope(scope);
  };

  const handleMonthChange = (month: number) => {
    if (month === selectedMonth) return;
    if (!confirmNavigationWithUnsavedChanges()) return;
    setSelectedMonth(month);
  };

  const handleYearChange = (year: number) => {
    if (year === selectedYear) return;
    if (!confirmNavigationWithUnsavedChanges()) return;
    setSelectedYear(year);
  };

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
          ? {
              ...expense,
              [field]: field === 'amount' ? sanitizeMoneyInput(value) : value,
            }
          : expense
      ),
    }));
  };

  const addRecurringExpenseRow = () => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      recurringExpenses: [...currentDraft.recurringExpenses, createRecurringExpense()],
    }));
  };

  const removeRecurringExpenseRow = (expenseId: string) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      recurringExpenses: currentDraft.recurringExpenses.filter((expense) => expense.id !== expenseId),
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
          ? {
              ...expense,
              [field]: field === 'amount' ? sanitizeMoneyInput(value) : value,
            }
          : expense
      ),
    }));
  };

  const addMiscExpenseRow = () => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      miscExpenses: [...currentDraft.miscExpenses, createMiscExpense()],
    }));
  };

  const removeMiscExpenseRow = (expenseId: string) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      miscExpenses: currentDraft.miscExpenses.filter((expense) => expense.id !== expenseId),
    }));
  };

  const clearExpenseScreenshotSelection = () => {
    setExpenseScreenshotPreviewUrls((currentUrls) => {
      currentUrls.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setExpenseScreenshotFiles([]);
  };

  const removeExpenseScreenshot = (index: number) => {
    setExpenseScreenshotFiles((currentFiles) => currentFiles.filter((_, fileIndex) => fileIndex !== index));
    setExpenseScreenshotPreviewUrls((currentUrls) => {
      const nextUrls = currentUrls.filter((_, urlIndex) => urlIndex !== index);
      if (currentUrls[index]) {
        URL.revokeObjectURL(currentUrls[index]);
      }
      return nextUrls;
    });
  };

  const uploadExpenseImportImageToStorage = async (file: File) => {
    const activeUserId = auth.currentUser?.uid || 'admin';
    const filePath = `founder-budget-imports/${activeUserId}/${selectedYear}-${String(selectedMonth).padStart(2, '0')}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const screenshotRef = storageRef(storage, filePath);

    await uploadBytes(screenshotRef, file, {
      contentType: file.type || 'image/png',
    });

    return getDownloadURL(screenshotRef);
  };

  const importExpenseScreenshots = async (filesToImport: File[]) => {
    if (!filesToImport.length) {
      setExpenseImportMessage({
        type: 'error',
        text: 'Choose at least one screenshot to import.',
      });
      return;
    }

    setParsingExpenseScreenshots(true);
    setExpenseImportMessage(null);

    try {
      const imageUrls = await Promise.all(filesToImport.map((file) => uploadExpenseImportImageToStorage(file)));

      const response = await fetch('/api/admin/founder-budget/parse-expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrls,
          targetMonth: selectedMonth,
          targetYear: selectedYear,
          existingExpenses: draft.miscExpenses.map((expense) => ({
            date: expense.date,
            label: expense.label,
            amount: moneyStringToNumber(expense.amount),
            paymentMethod: expense.paymentMethod,
            notes: expense.notes,
          })),
        }),
      });

      const result = (await response.json()) as ParseExpenseImportResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Unable to parse screenshot expenses.');
      }

      const parsedExpenses = Array.isArray(result.expenses) ? result.expenses : [];
      let mergeResult = { addedExpenses: [] as MiscExpenseDraft[], duplicateCount: 0 };

      setDraft((currentDraft) => {
        mergeResult = buildImportedMiscExpenses(currentDraft.miscExpenses, parsedExpenses);

        if (!mergeResult.addedExpenses.length) {
          return currentDraft;
        }

        return {
          ...currentDraft,
          miscExpenses: [...currentDraft.miscExpenses, ...mergeResult.addedExpenses],
        };
      });

      const apiDuplicateCount = result.summary?.duplicateCount || 0;
      const totalDuplicateCount = Math.max(apiDuplicateCount, mergeResult.duplicateCount);

      if (mergeResult.addedExpenses.length > 0) {
        setExpenseImportMessage({
          type: 'success',
          text:
            mergeResult.addedExpenses.length === 1
              ? `Imported 1 new misc expense. Skipped ${totalDuplicateCount} duplicate${totalDuplicateCount === 1 ? '' : 's'}.`
              : `Imported ${mergeResult.addedExpenses.length} new misc expenses. Skipped ${totalDuplicateCount} duplicate${totalDuplicateCount === 1 ? '' : 's'}.`,
        });
      } else {
        setExpenseImportMessage({
          type: 'info',
          text:
            totalDuplicateCount > 0
              ? 'Everything in that screenshot already exists in this month, so nothing new was added.'
              : 'No new expense rows were detected in that screenshot.',
        });
      }

      clearExpenseScreenshotSelection();
    } catch (error) {
      console.error('Error importing founder budget screenshot:', error);
      setExpenseImportMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to import screenshot expenses right now.',
      });
    } finally {
      setParsingExpenseScreenshots(false);
    }
  };

  const handleExpenseScreenshotUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length) return;

    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) {
      setExpenseImportMessage({
        type: 'error',
        text: 'Only image files can be imported into misc expenses.',
      });
      return;
    }

    const previewUrls = imageFiles.map((file) => URL.createObjectURL(file));
    clearExpenseScreenshotSelection();
    setExpenseScreenshotFiles(imageFiles);
    setExpenseScreenshotPreviewUrls(previewUrls);

    if (files.length !== imageFiles.length) {
      setExpenseImportMessage({
        type: 'info',
        text: 'Some selected files were skipped because they were not images.',
      });
    }

    await importExpenseScreenshots(imageFiles);
  };

  const handleResetDraft = () => {
    if (!hasUnsavedChanges) return;
    setDraft(cloneBudgetDraft(baselineDraft));
    setMessage({
      type: 'info',
      text: 'Unsaved edits cleared. You are back to the last loaded month state.',
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const budgetDocId = buildBudgetDocId(activeScope, selectedYear, selectedMonth);
    const payload = {
      scope: activeScope,
      year: selectedYear,
      month: selectedMonth,
      monthlyIncome,
      debtPayments,
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
          paymentMethod: expense.paymentMethod || PAYMENT_METHOD_OPTIONS[0],
          notes: expense.notes.trim(),
        }))
        .filter(
          (expense) =>
            expense.date ||
            expense.label ||
            expense.amount !== 0 ||
            expense.notes
        ),
      updatedAt: serverTimestamp(),
      createdAt: matchingRecord?.createdAt ?? serverTimestamp(),
    };

    try {
      await setDoc(doc(db, FOUNDER_BUDGET_COLLECTION, budgetDocId), payload, { merge: true });
      await loadBudgets('refresh');
      setMessage({
        type: 'success',
        text: `${scopeMeta[activeScope].title} saved for ${monthYearLabel(selectedMonth, selectedYear)}.`,
      });
    } catch (error) {
      console.error('Error saving founder budget:', error);
      setMessage({
        type: 'error',
        text: 'Unable to save this founder budget month right now.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMonth = async () => {
    if (!hasPersistedRecord || typeof window === 'undefined') return;

    const confirmed = window.confirm(
      `Delete the saved ${activeScope} budget for ${monthYearLabel(selectedMonth, selectedYear)}?`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage(null);

    try {
      await deleteDoc(doc(db, FOUNDER_BUDGET_COLLECTION, buildBudgetDocId(activeScope, selectedYear, selectedMonth)));
      await loadBudgets('refresh');
      setMessage({
        type: 'success',
        text: `Removed the saved ${activeScope} budget for ${monthYearLabel(selectedMonth, selectedYear)}.`,
      });
    } catch (error) {
      console.error('Error deleting founder budget:', error);
      setMessage({
        type: 'error',
        text: 'Unable to delete this saved month right now.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Founder Budget | Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#111417] text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <button
                onClick={() => {
                  if (!confirmNavigationWithUnsavedChanges()) return;
                  router.push('/admin');
                }}
                className="mt-1 rounded-xl border border-zinc-800 bg-[#1a1e24] p-3 text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                aria-label="Back to admin home"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#E0FE10]">
                  <Receipt className="h-3.5 w-3.5" />
                  Founder Budget
                </div>
                <h1 className="text-3xl font-semibold tracking-tight">Monthly founder budget surface</h1>
                <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                  Track recurring expenses up top, log month-specific line items below, and keep personal and
                  business budgets separate with auto-calculated cash position.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  if (!confirmNavigationWithUnsavedChanges()) return;
                  loadBudgets('refresh');
                }}
                disabled={loading || refreshing || saving}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-[#1a1e24] px-4 py-2.5 text-sm text-zinc-200 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
              <button
                onClick={handleResetDraft}
                disabled={!hasUnsavedChanges || loading || saving}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-[#1a1e24] px-4 py-2.5 text-sm text-zinc-200 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
              {hasPersistedRecord && (
                <button
                  onClick={handleDeleteMonth}
                  disabled={loading || saving}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Month
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={loading || saving}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${activeScopeMeta.button}`}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Budget
              </button>
            </div>
          </div>

          {message && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                message.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : message.type === 'error'
                    ? 'border-red-500/30 bg-red-500/10 text-red-100'
                    : 'border-sky-500/30 bg-sky-500/10 text-sky-100'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mb-6 overflow-hidden rounded-[28px] border border-zinc-800 bg-[#1a1e24]">
            <div className={`h-28 bg-gradient-to-r ${activeScopeMeta.accent}`} />
            <div className="-mt-16 px-5 pb-5 md:px-6 md:pb-6">
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-wrap gap-3">
                  {(['business', 'personal'] as BudgetScope[]).map((scope) => {
                    const Icon = scopeMeta[scope].icon;
                    const isActive = scope === activeScope;
                    return (
                      <button
                        key={scope}
                        onClick={() => handleScopeChange(scope)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          isActive
                            ? scopeMeta[scope].activeChip
                            : 'border-zinc-700 bg-[#111417]/90 text-zinc-300 hover:border-zinc-600 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`rounded-xl p-2 ${
                              isActive ? 'bg-black/25 text-current' : 'bg-zinc-900 text-zinc-400'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold">{scopeMeta[scope].title}</div>
                            <div className="mt-0.5 text-xs opacity-80">{scopeMeta[scope].description}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                      Month
                    </span>
                    <select
                      value={selectedMonth}
                      onChange={(event) => handleMonthChange(Number(event.target.value))}
                      className={fieldClassName}
                    >
                      {MONTH_OPTIONS.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                      Year
                    </span>
                    <select
                      value={selectedYear}
                      onChange={(event) => handleYearChange(Number(event.target.value))}
                      className={fieldClassName}
                    >
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-[#111417]/80 px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{selectionStatus}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {hasPersistedRecord
                      ? `Last saved ${formatTimestampLabel(matchingRecord?.updatedAt || matchingRecord?.createdAt)}`
                      : 'This month is a draft until you save it.'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-zinc-700 px-3 py-1.5 text-zinc-300">
                    {monthYearLabel(selectedMonth, selectedYear)}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1.5 ${
                      hasUnsavedChanges
                        ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                        : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                    }`}
                  >
                    {hasUnsavedChanges ? 'Unsaved edits' : 'All changes saved'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-zinc-800 bg-[#1a1e24]">
              <div className="flex items-center gap-3 text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading founder budget data...
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
                <section className="overflow-hidden rounded-[28px] border border-zinc-800 bg-[#1a1e24]">
                  <div className="flex flex-col gap-3 border-b border-zinc-800 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Calendar className="h-4 w-4 text-[#E0FE10]" />
                        Recurring Monthly Expenses
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        These are the every-month items that sit at the top of the sheet.
                      </p>
                    </div>
                    <button
                      onClick={addRecurringExpenseRow}
                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-[#111417] px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-600 hover:text-white"
                    >
                      <Plus className="h-4 w-4" />
                      Add recurring item
                    </button>
                  </div>

                  <div className="overflow-x-auto px-3 py-3 md:px-4 md:py-4">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-[0.18em] text-zinc-500">
                          <th className="px-3 py-3 font-medium">Expense</th>
                          <th className="w-44 px-3 py-3 font-medium">Amount</th>
                          <th className="w-16 px-3 py-3 font-medium text-right"> </th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.recurringExpenses.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-3 py-10 text-center text-zinc-500">
                              No recurring expenses yet for this month.
                            </td>
                          </tr>
                        ) : (
                          draft.recurringExpenses.map((expense) => (
                            <tr key={expense.id} className="border-t border-zinc-800">
                              <td className="px-3 py-3">
                                <input
                                  value={expense.label}
                                  onChange={(event) => updateRecurringExpense(expense.id, 'label', event.target.value)}
                                  placeholder="Expense name"
                                  className={fieldClassName}
                                />
                              </td>
                              <td className="px-3 py-3">
                                <div className="relative">
                                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                                    $
                                  </span>
                                  <input
                                    value={expense.amount}
                                    onChange={(event) => updateRecurringExpense(expense.id, 'amount', event.target.value)}
                                    placeholder="0.00"
                                    inputMode="decimal"
                                    className={`${fieldClassName} pl-8`}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right">
                                <button
                                  onClick={() => removeRecurringExpenseRow(expense.id)}
                                  className="rounded-xl border border-zinc-700 bg-[#111417] p-2 text-zinc-400 transition hover:border-red-500/30 hover:text-red-200"
                                  aria-label="Remove recurring expense"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-zinc-800 bg-[#111417]">
                          <td className="px-3 py-4 font-medium text-zinc-300">Monthly total</td>
                          <td className="px-3 py-4 font-semibold text-white">{formatCurrency(recurringTotal)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>

                <aside className="rounded-[28px] border border-zinc-800 bg-[#1a1e24] p-5 md:p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-2xl bg-[#E0FE10]/10 p-3 text-[#E0FE10]">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">Month Summary</h2>
                      <p className="text-sm text-zinc-500">Auto-calculated from the fields below.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                        Monthly income
                      </span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                          $
                        </span>
                        <input
                          value={draft.monthlyIncome}
                          onChange={(event) => updateDraftField('monthlyIncome', event.target.value)}
                          placeholder="0.00"
                          inputMode="decimal"
                          className={`${fieldClassName} pl-8`}
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                        Debt payments
                      </span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                          $
                        </span>
                        <input
                          value={draft.debtPayments}
                          onChange={(event) => updateDraftField('debtPayments', event.target.value)}
                          placeholder="0.00"
                          inputMode="decimal"
                          className={`${fieldClassName} pl-8`}
                        />
                      </div>
                    </label>

                    <div className="rounded-2xl border border-zinc-800 bg-[#111417] p-4">
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">Monthly income</span>
                          <span className="font-medium text-white">{formatCurrency(monthlyIncome)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">Monthly total</span>
                          <span className="font-medium text-white">{formatCurrency(recurringTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">After monthly</span>
                          <span className={`font-semibold ${afterMonthly < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                            {formatCurrency(afterMonthly)}
                          </span>
                        </div>
                        <div className="h-px bg-zinc-800" />
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">Total misc.</span>
                          <span className="font-medium text-white">{formatCurrency(miscTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">After monthly &amp; misc.</span>
                          <span
                            className={`font-semibold ${
                              afterMonthlyAndMisc < 0 ? 'text-red-300' : 'text-emerald-300'
                            }`}
                          >
                            {formatCurrency(afterMonthlyAndMisc)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">Debt payments</span>
                          <span className="font-medium text-white">{formatCurrency(debtPayments)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">After debt + monthly + misc.</span>
                          <span
                            className={`font-semibold ${
                              afterDebtMonthlyAndMisc < 0 ? 'text-red-300' : 'text-emerald-300'
                            }`}
                          >
                            {formatCurrency(afterDebtMonthlyAndMisc)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                        Notes
                      </span>
                      <textarea
                        value={draft.notes}
                        onChange={(event) => updateDraftField('notes', event.target.value)}
                        rows={5}
                        placeholder="Notes for this month..."
                        className={`${fieldClassName} resize-none`}
                      />
                    </label>

                    {paymentMethodTotals.length > 0 && (
                      <div className="rounded-2xl border border-zinc-800 bg-[#111417] p-4">
                        <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                          Payment Mix
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {paymentMethodTotals.map((entry) => (
                            <span
                              key={entry.paymentMethod}
                              className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
                            >
                              {entry.paymentMethod}: {formatCurrency(entry.total)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </aside>
              </div>

              <section className="mt-6 overflow-hidden rounded-[28px] border border-zinc-800 bg-[#1a1e24]">
                <div className="flex flex-col gap-3 border-b border-zinc-800 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Receipt className="h-4 w-4 text-sky-300" />
                      Misc / Line-Item Expenses
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      Month-specific spends that belong at the bottom of the sheet.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      ref={expenseScreenshotInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleExpenseScreenshotUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => expenseScreenshotInputRef.current?.click()}
                      disabled={parsingExpenseScreenshots}
                      className="inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm text-sky-100 transition hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {parsingExpenseScreenshots ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Upload screenshot
                    </button>
                    <button
                      onClick={addMiscExpenseRow}
                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-[#111417] px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-600 hover:text-white"
                    >
                      <Plus className="h-4 w-4" />
                      Add line item
                    </button>
                  </div>
                </div>

                <div className="border-b border-zinc-800 px-5 py-5 md:px-6">
                  <div className="rounded-[24px] border border-zinc-800 bg-[#111417] p-4 md:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-2xl">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          <ImagePlus className="h-4 w-4 text-[#E0FE10]" />
                          Screenshot Importer
                        </div>
                        <p className="mt-2 text-sm text-zinc-400">
                          Upload one or more screenshots of expenses and the importer will parse them into misc line
                          items for {monthYearLabel(selectedMonth, selectedYear)}. Duplicate rows already on this month
                          are skipped automatically, so re-uploading the full list only adds anything new.
                        </p>
                      </div>

                      {expenseScreenshotFiles.length > 0 && (
                        <button
                          onClick={() => importExpenseScreenshots(expenseScreenshotFiles)}
                          disabled={parsingExpenseScreenshots}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#E0FE10]/30 bg-[#E0FE10]/10 px-4 py-2 text-sm text-[#F1FFB6] transition hover:bg-[#E0FE10]/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {parsingExpenseScreenshots ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          Retry import
                        </button>
                      )}
                    </div>

                    {expenseImportMessage && (
                      <div
                        className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                          expenseImportMessage.type === 'success'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                            : expenseImportMessage.type === 'error'
                              ? 'border-red-500/30 bg-red-500/10 text-red-100'
                              : 'border-sky-500/30 bg-sky-500/10 text-sky-100'
                        }`}
                      >
                        {expenseImportMessage.text}
                      </div>
                    )}

                    {expenseScreenshotPreviewUrls.length > 0 && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {expenseScreenshotPreviewUrls.map((previewUrl, index) => (
                          <div key={previewUrl} className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#1a1e24]">
                            <img
                              src={previewUrl}
                              alt={`Expense screenshot ${index + 1}`}
                              className="h-36 w-full object-cover"
                            />
                            <button
                              onClick={() => removeExpenseScreenshot(index)}
                              className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white transition hover:bg-black"
                              aria-label={`Remove screenshot ${index + 1}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto px-3 py-3 md:px-4 md:py-4">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.18em] text-zinc-500">
                        <th className="w-40 px-3 py-3 font-medium">Date</th>
                        <th className="px-3 py-3 font-medium">Expense</th>
                        <th className="w-40 px-3 py-3 font-medium">Payment</th>
                        <th className="w-40 px-3 py-3 font-medium">Amount</th>
                        <th className="w-56 px-3 py-3 font-medium">Notes</th>
                        <th className="w-16 px-3 py-3 font-medium text-right"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.miscExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-10 text-center text-zinc-500">
                            No line-item misc expenses yet for this month.
                          </td>
                        </tr>
                      ) : (
                        draft.miscExpenses.map((expense) => (
                          <tr key={expense.id} className="border-t border-zinc-800 align-top">
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
                                placeholder="Line item"
                                className={fieldClassName}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={expense.paymentMethod}
                                onChange={(event) =>
                                  updateMiscExpense(expense.id, 'paymentMethod', event.target.value)
                                }
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
                              <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                                  $
                                </span>
                                <input
                                  value={expense.amount}
                                  onChange={(event) => updateMiscExpense(expense.id, 'amount', event.target.value)}
                                  placeholder="0.00"
                                  inputMode="decimal"
                                  className={`${fieldClassName} pl-8`}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <input
                                value={expense.notes}
                                onChange={(event) => updateMiscExpense(expense.id, 'notes', event.target.value)}
                                placeholder="Optional note"
                                className={fieldClassName}
                              />
                            </td>
                            <td className="px-3 py-3 text-right">
                              <button
                                onClick={() => removeMiscExpenseRow(expense.id)}
                                className="rounded-xl border border-zinc-700 bg-[#111417] p-2 text-zinc-400 transition hover:border-red-500/30 hover:text-red-200"
                                aria-label="Remove line item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-zinc-800 bg-[#111417]">
                        <td className="px-3 py-4 font-medium text-zinc-300" colSpan={3}>
                          Total misc.
                        </td>
                        <td className="px-3 py-4 font-semibold text-white">{formatCurrency(miscTotal)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              {!hasPersistedRecord && draft.recurringExpenses.length === 0 && draft.miscExpenses.length === 0 && (
                <div className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      This month is blank right now. Add recurring items or line items, then save to create the first
                      budget document for this month.
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default FounderBudgetAdminPage;
