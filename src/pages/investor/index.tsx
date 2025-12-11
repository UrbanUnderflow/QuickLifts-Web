import React, { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { GetServerSideProps } from 'next';
import { ArrowUpRight, Download, ChevronRight, ArrowLeft, TrendingUp, Lock, Loader2, Mail, AlertCircle } from 'lucide-react';

import Footer from '../../components/Footer/Footer';
import PageHead from '../../components/PageHead';
import { adminMethods } from '../../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../../api/firebase/admin/types';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { UserChallenge } from '../../api/firebase/workout/types';
import { convertFirestoreTimestamp } from '../../utils/formatDate';
import { workoutService } from '../../api/firebase/workout';
import { sampleGraph } from '../../components/ReferralGraph';

// Lazy load heavy components
const VideoDemo = dynamic(() => import('../../components/VideoDemo'), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-800 rounded-xl animate-pulse flex items-center justify-center"><span className="text-zinc-400">Loading video...</span></div>
});

const ReferralGraph = dynamic(() => import('../../components/ReferralGraph'), { ssr: false });

const ViralityChart = dynamic(() => import('../../components/MetricsCharts').then(mod => ({ default: mod.ViralityChart })), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-800 rounded-xl animate-pulse flex items-center justify-center"><span className="text-zinc-400">Loading chart...</span></div>
});

const UnitEconChart = dynamic(() => import('../../components/MetricsCharts').then(mod => ({ default: mod.UnitEconChart })), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-800 rounded-xl animate-pulse flex items-center justify-center"><span className="text-zinc-400">Loading chart...</span></div>
});

const SubscriptionOverview = dynamic(() => import('../../components/MetricsCharts').then(mod => ({ default: mod.SubscriptionOverview })), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-800 rounded-xl animate-pulse flex items-center justify-center"><span className="text-zinc-400">Loading chart...</span></div>
});

const RetentionRateChart = dynamic(() => import('../../components/MetricsCharts').then(mod => ({ default: mod.RetentionRateChart })), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-800 rounded-xl animate-pulse flex items-center justify-center"><span className="text-zinc-400">Loading chart...</span></div>
});

const ConversionChart = dynamic(() => import('../../components/MetricsCharts').then(mod => ({ default: mod.ConversionChart })), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-800 rounded-xl animate-pulse flex items-center justify-center"><span className="text-zinc-400">Loading chart...</span></div>
});

const EngagementChart = dynamic(() => import('../../components/MetricsCharts').then(mod => ({ default: mod.EngagementChart })), { 
  ssr: false,
  loading: () => <div className="w-full h-64 bg-zinc-800 rounded-xl animate-pulse flex items-center justify-center"><span className="text-zinc-400">Loading chart...</span></div>
});

// Define types for section refs
type SectionRefs = {
  [key: string]: HTMLElement | null;
};

// Section access interface
interface SectionAccess {
  overview: boolean;
  product: boolean;
  traction: boolean;
  ip: boolean;
  vision: boolean;
  market: boolean;
  techstack: boolean;
  team: boolean;
  financials: boolean;
  captable: boolean;
  deck: boolean;
  investment: boolean;
  documents: boolean;
}

const DEFAULT_SECTION_ACCESS: SectionAccess = {
  overview: true,
  product: true,
  traction: true,
  ip: true,
  vision: true,
  market: true,
  techstack: true,
  team: true,
  financials: true,
  captable: true,
  deck: true,
  investment: true,
  documents: true,
};

// Type for financial data
interface FinancialMetrics {
  revenue?: string;
  users?: string;
  growth?: string;
  retention?: string;
}

// Type for K-effective metrics
interface KEffectiveMetrics {
  kEffective: number;
  activeReferrers: number;
  referredSignups: number;
  viralCycleTime: number;
  shareToFirstWorkoutRate: number;
  timeToSecondShare: number;
  totalParticipants: number;
  directJoins: number;
  viralPercentage: number;
}

// Define serializable interface for meta data
interface SerializablePageMetaDataForInvestor extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface InvestorDataroomPageProps {
  metaData?: SerializablePageMetaDataForInvestor | null;
}

// Valid section IDs for URL navigation
const VALID_SECTIONS = ['overview', 'product', 'traction', 'ip', 'vision', 'market', 'techstack', 'team', 'financials', 'captable', 'deck', 'investment', 'documents'] as const;

const InvestorDataroom: React.FC<InvestorDataroomPageProps> = ({ metaData }) => {
  const router = useRouter();
  
  // Access control state
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [accessEmail, setAccessEmail] = useState('');
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sectionAccess, setSectionAccess] = useState<SectionAccess>(DEFAULT_SECTION_ACCESS);
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
  const [selectedRevenueMonths, setSelectedRevenueMonths] = useState<string[]>([]);
  const [isBank2025ModalOpen, setIsBank2025ModalOpen] = useState(false);
  const [selectedBank2025Months, setSelectedBank2025Months] = useState<string[]>([]);
  const [isBank2024ModalOpen, setIsBank2024ModalOpen] = useState(false);
  const [isMonthlyTableOpen, setIsMonthlyTableOpen] = useState(false);
  const [monthlyTableYear, setMonthlyTableYear] = useState<'2025' | '2024'>('2025');
  const [isPLModalOpen, setIsPLModalOpen] = useState(false);
  const [activePLYear, setActivePLYear] = useState<'2025' | '2024'>('2025');
  const [isBalanceSheetModalOpen, setIsBalanceSheetModalOpen] = useState(false);
  const [activeBalanceSheetYear, setActiveBalanceSheetYear] = useState<'2025' | '2024'>('2025');

  const [activeSection, setActiveSection] = useState<string>('overview');
  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics | null>(null);
  const [kEffectiveMetrics, setKEffectiveMetrics] = useState<KEffectiveMetrics | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingKMetrics, setIsLoadingKMetrics] = useState(true);
  const [activeRetentionTab, setActiveRetentionTab] = useState<string>('retention');
  const [activeRevenueYear, setActiveRevenueYear] = useState<'2025' | '2024'>('2025');

  const monthlyRevenue2025 = [
    { month: 'Jan', label: 'January', value: 246 },
    { month: 'Feb', label: 'February', value: 633 },
    { month: 'Mar', label: 'March', value: 268 },
    { month: 'Apr', label: 'April', value: 220 },
    { month: 'May', label: 'May', value: 373 },
    { month: 'Jun', label: 'June', value: 512 },
    { month: 'Jul', label: 'July', value: 346 },
    { month: 'Aug', label: 'August', value: 128 },
    { month: 'Sep', label: 'September', value: 115 },
    { month: 'Oct', label: 'October', value: 173 },
    { month: 'Nov', label: 'November', value: 134 },
    { month: 'Dec', label: 'December', value: 0 },
  ];

  const monthlyRevenue2024 = [
    { month: 'Jan', label: 'January', value: 137 },
    { month: 'Feb', label: 'February', value: 89 },
    { month: 'Mar', label: 'March', value: 135 },
    { month: 'Apr', label: 'April', value: 111 },
    { month: 'May', label: 'May', value: 107 },
    { month: 'Jun', label: 'June', value: 293 },
    { month: 'Jul', label: 'July', value: 397 },
    { month: 'Aug', label: 'August', value: 157 },
    { month: 'Sep', label: 'September', value: 96 },
    { month: 'Oct', label: 'October', value: 201 },
    { month: 'Nov', label: 'November', value: 168 },
    { month: 'Dec', label: 'December', value: 120 },
  ];

  const pnl2025 = [
    { month: 'January', revenue: 246, recurring: 635.79, oneOff: 200, total: 835.79, net: -589.79 },
    { month: 'February', revenue: 633, recurring: 635.79, oneOff: 39.99, total: 675.78, net: -42.78 },
    { month: 'March', revenue: 268, recurring: 635.79, oneOff: 0, total: 635.79, net: -367.79 },
    { month: 'April', revenue: 220, recurring: 635.79, oneOff: 198.24, total: 834.03, net: -614.03 },
    { month: 'May', revenue: 373, recurring: 635.79, oneOff: 947.24, total: 1583.03, net: -1210.03 },
    { month: 'June', revenue: 512, recurring: 635.79, oneOff: 41.25, total: 677.04, net: -165.04 },
    { month: 'July', revenue: 346, recurring: 635.79, oneOff: 83.61, total: 719.4, net: -373.4 },
    { month: 'August', revenue: 128, recurring: 635.79, oneOff: 50, total: 685.79, net: -557.79 },
    { month: 'September', revenue: 115, recurring: 635.79, oneOff: 404.86, total: 1040.65, net: -925.65 },
    { month: 'October', revenue: 173, recurring: 635.79, oneOff: 514.22, total: 1150.01, net: -977.01 },
    { month: 'November', revenue: 134, recurring: 635.79, oneOff: 0, total: 635.79, net: -501.79 },
  ];

  const pnl2024 = [
    { month: 'January', revenue: 137, recurring: 413.97, oneOff: 0, total: 413.97, net: -276.97 },
    { month: 'February', revenue: 89, recurring: 413.97, oneOff: 0, total: 413.97, net: -324.97 },
    { month: 'March', revenue: 135, recurring: 413.97, oneOff: 0, total: 413.97, net: -278.97 },
    { month: 'April', revenue: 111, recurring: 413.97, oneOff: 0, total: 413.97, net: -302.97 },
    { month: 'May', revenue: 107, recurring: 413.97, oneOff: 0, total: 413.97, net: -306.97 },
    { month: 'June', revenue: 293, recurring: 540.39, oneOff: 0, total: 540.39, net: -247.39 },
    { month: 'July', revenue: 397, recurring: 540.39, oneOff: 0, total: 540.39, net: -143.39 },
    { month: 'August', revenue: 157, recurring: 540.39, oneOff: 0, total: 540.39, net: -383.39 },
    { month: 'September', revenue: 96, recurring: 540.39, oneOff: 0, total: 540.39, net: -444.39 },
    { month: 'October', revenue: 201, recurring: 540.39, oneOff: 0, total: 540.39, net: -339.39 },
    { month: 'November', revenue: 168, recurring: 540.39, oneOff: 0, total: 540.39, net: -372.39 },
    { month: 'December', revenue: 120, recurring: 540.39, oneOff: 0, total: 540.39, net: -420.39 },
  ];

  const pnlTotals2025 = pnl2025.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      recurring: acc.recurring + row.recurring,
      oneOff: acc.oneOff + row.oneOff,
      total: acc.total + row.total,
      net: acc.net + row.net,
    }),
    { revenue: 0, recurring: 0, oneOff: 0, total: 0, net: 0 }
  );

  const pnlTotals2024 = pnl2024.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      recurring: acc.recurring + row.recurring,
      oneOff: acc.oneOff + row.oneOff,
      total: acc.total + row.total,
      net: acc.net + row.net,
    }),
    { revenue: 0, recurring: 0, oneOff: 0, total: 0, net: 0 }
  );

  const activePLData = activePLYear === '2025' ? pnl2025 : pnl2024;
  const activePLTotals = activePLYear === '2025' ? pnlTotals2025 : pnlTotals2024;

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Balance Sheet Data
  const balanceSheetData = {
    assets: {
      currentAssets: [
        { account: 'Cash', y2024: 0, y2025: 179 },
        { account: 'Accounts Receivable', y2024: 0, y2025: 0 },
        { account: 'Inventory', y2024: 0, y2025: 0 },
        { account: 'Prepaid Expenses', y2024: 0, y2025: 0 },
        { account: 'Short-term Investments', y2024: 0, y2025: 0 },
      ],
      totalCurrentAssets: { y2024: 0, y2025: 179 },
      fixedAssets: [
        { account: 'Long-term Investments', y2024: 0, y2025: 0 },
        { account: 'Property Plant & Equipment', y2024: 0, y2025: 0 },
        { account: 'Accumulated Depreciation', y2024: 0, y2025: 0 },
        { account: 'Intangible Assets', y2024: 0, y2025: 0 },
      ],
      totalFixedAssets: { y2024: 0, y2025: 0 },
      otherAssets: [
        { account: 'Deferred Income Tax', y2024: 0, y2025: 0 },
        { account: 'Other', y2024: 0, y2025: 0 },
      ],
      totalOtherAssets: { y2024: 0, y2025: 0 },
      totalAssets: { y2024: 0, y2025: 179 },
    },
    liabilities: {
      currentLiabilities: [
        { account: 'Accounts Payable', y2024: 0, y2025: 0 },
        { account: 'Short-term Loans', y2024: 0, y2025: 0 },
        { account: 'Income Taxes Payable', y2024: 0, y2025: 0 },
        { account: 'Accrued Salaries & Wages', y2024: 0, y2025: 0 },
        { account: 'Unearned Revenue', y2024: 0, y2025: 0 },
        { account: 'Current Portion of Long-term Debt', y2024: 0, y2025: 0 },
      ],
      totalCurrentLiabilities: { y2024: 0, y2025: 0 },
      longTermLiabilities: [
        { account: 'Long-term Debt', y2024: 0, y2025: 0 },
        { account: 'Deferred Income Tax', y2024: 0, y2025: 0 },
        { account: 'Other', y2024: 0, y2025: 0 },
      ],
      totalLongTermLiabilities: { y2024: 0, y2025: 0 },
      totalLiabilities: { y2024: 0, y2025: 0 },
    },
    ownersEquity: {
      items: [
        { account: 'Founder Capital Contribution', y2024: 0, y2025: 15325.68 },
        { account: 'Retained Earnings', y2024: -1193.60, y2025: -10166.68 },
      ],
      totalOwnersEquity: { y2024: -1193.60, y2025: 5159 },
    },
    totalLiabilitiesAndEquity: { y2024: -1193.60, y2025: 179 },
  };

  const getBalanceSheetValue = (item: { y2024: number; y2025: number }) =>
    activeBalanceSheetYear === '2025' ? item.y2025 : item.y2024;

  const revenueReports = [
    { id: 'jan', label: 'January', file: '/financial_report_Jan.csv' },
    { id: 'feb', label: 'February', file: '/financial_report_Feb.csv' },
    { id: 'mar', label: 'March', file: '/financial_report_March.csv' },
    { id: 'apr', label: 'April', file: '/financial_report_April.csv' },
    { id: 'may', label: 'May', file: '/financial_report_May.csv' },
    { id: 'jun', label: 'June', file: '/financial_report_June.csv' },
    { id: 'jul', label: 'July', file: '/financial_report_July.csv' },
    { id: 'aug', label: 'August', file: '/financial_report_Aug.csv' },
    { id: 'sep', label: 'September', file: '/financial_report_Sept.csv' },
    { id: 'oct', label: 'October', file: '/financial_report_Oct.csv' },
    { id: 'nov', label: 'November', file: '/financial_report_Nov.csv' },
    { id: 'dec', label: 'December', file: '/financial_report_Dec.csv' },
  ];

  // 2025 bank statements (files live in /public with these exact names)
  const bankStatements2025 = [
    { id: 'mar25', label: 'March 2025', file: '/BankStatements-March25.pdf' },
    { id: 'apr25', label: 'April 2025', file: '/BankStatements-April2025.pdf' },
    { id: 'may25', label: 'May 2025', file: '/BankStatements-May2025.pdf' },
    { id: 'jun25', label: 'June 2025', file: '/BankStatements-June.pdf' },
    { id: 'jul25', label: 'July 2025', file: '/BankStatements-July.pdf' },
    { id: 'aug25', label: 'August 2025', file: '/BankStatements-August.pdf' },
    { id: 'sep25', label: 'September 2025', file: '/BankStatements-Sept.pdf' },
    { id: 'oct25', label: 'October 2025', file: '/BankStatements-October.pdf' },
    { id: 'oct25_mercury', label: 'October 2025 (Mercury)', file: '/BankStatements-Oct-2.pdf' },
    { id: 'nov25', label: 'November 2025', file: '/BankStatements-Novemebr.pdf' },
  ];

  // Handle URL query parameter for section navigation (only on initial load)
  const initialLoadRef = useRef(true);
  useEffect(() => {
    if (!router.isReady) return;
    
    const sectionParam = router.query.section as string;
    if (sectionParam && VALID_SECTIONS.includes(sectionParam as any) && initialLoadRef.current) {
      // Only set pending section on initial page load, not on user navigation
      setPendingSection(sectionParam);
    }
    initialLoadRef.current = false;
  }, [router.isReady, router.query.section]);

  // Apply pending section after access is verified
  useEffect(() => {
    if (hasAccess && pendingSection) {
      setActiveSection(pendingSection);
      setPendingSection(null);
    }
  }, [hasAccess, pendingSection]);

  // Check for stored access on mount
  useEffect(() => {
    const storedEmail = localStorage.getItem('investorAccessEmail');
    const storedSectionAccess = localStorage.getItem('investorSectionAccess');
    
    if (storedEmail) {
      // Try to use cached section access first for faster load
      if (storedSectionAccess) {
        try {
          setSectionAccess(JSON.parse(storedSectionAccess));
        } catch (e) {
          // Ignore parse errors
        }
      }
      verifyAccess(storedEmail, true);
    } else {
      setIsInitializing(false);
    }
  }, []);

  const verifyAccess = async (email: string, isAutoCheck: boolean = false) => {
    if (!email.trim()) {
      setAccessError('Please enter your email address');
      return;
    }

    setIsCheckingAccess(true);
    setAccessError(null);

    try {
      const accessRef = collection(db, 'investorAccess');
      const q = query(accessRef, where('email', '==', email.toLowerCase().trim()));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const accessDoc = snapshot.docs[0].data();
        if (accessDoc.isApproved) {
          setHasAccess(true);
          // Store section access from Firestore, falling back to defaults
          const storedSectionAccess = accessDoc.sectionAccess || DEFAULT_SECTION_ACCESS;
          setSectionAccess(storedSectionAccess);
          localStorage.setItem('investorAccessEmail', email.toLowerCase().trim());
          localStorage.setItem('investorSectionAccess', JSON.stringify(storedSectionAccess));
        } else {
          setHasAccess(false);
          setAccessError('Your access has been revoked. Please contact invest@fitwithpulse.ai');
          localStorage.removeItem('investorAccessEmail');
          localStorage.removeItem('investorSectionAccess');
        }
      } else {
        setHasAccess(false);
        if (!isAutoCheck) {
          setAccessError('This email does not have access to the investor dataroom. Please contact invest@fitwithpulse.ai to request access.');
        }
        localStorage.removeItem('investorAccessEmail');
        localStorage.removeItem('investorSectionAccess');
      }
    } catch (error) {
      console.error('Error verifying access:', error);
      setAccessError('An error occurred. Please try again.');
    } finally {
      setIsCheckingAccess(false);
      setIsInitializing(false);
    }
  };

  const handleAccessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyAccess(accessEmail);
  };

  const handleLogout = () => {
    localStorage.removeItem('investorAccessEmail');
    localStorage.removeItem('investorSectionAccess');
    setHasAccess(null);
    setAccessEmail('');
    setSectionAccess(DEFAULT_SECTION_ACCESS);
  };

  const toggleRevenueMonth = (id: string) => {
    setSelectedRevenueMonths(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleDownloadSelectedRevenueReports = () => {
    if (typeof window === 'undefined') return;
    const selected = revenueReports.filter(r => selectedRevenueMonths.includes(r.id));
    if (!selected.length) return;

    selected.forEach(report => {
      const link = document.createElement('a');
      link.href = report.file;
      link.download = report.file.split('/').pop() || 'revenue_report.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    setIsRevenueModalOpen(false);
  };

  const toggleBank2025Month = (id: string) => {
    setSelectedBank2025Months(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleDownloadSelectedBankStatements2025 = () => {
    if (typeof window === 'undefined') return;
    const selected = bankStatements2025.filter(r => selectedBank2025Months.includes(r.id));
    if (!selected.length) return;

    selected.forEach(report => {
      const link = document.createElement('a');
      link.href = report.file;
      link.download = report.file.split('/').pop() || 'BankStatements-2025.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    setIsBank2025ModalOpen(false);
  };

  // Helper to check if a section is accessible
  const hasSectionAccess = (sectionId: keyof SectionAccess): boolean => {
    return sectionAccess[sectionId] ?? true;
  };

  // Locked section component
  const LockedSectionView: React.FC<{ sectionName: string }> = ({ sectionName }) => (
    <div className="flex flex-col items-center justify-center py-20 px-8">
      <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center mb-6">
        <Lock className="w-10 h-10 text-zinc-600" />
      </div>
      <h2 className="text-white text-2xl font-bold mb-2">Section Locked</h2>
      <p className="text-zinc-400 text-center max-w-md mb-6">
        You don't have access to the <span className="text-white font-medium">{sectionName}</span> section. 
        Contact us to request full dataroom access.
      </p>
      <a
        href="mailto:invest@fitwithpulse.ai?subject=Request%20Full%20Dataroom%20Access"
        className="px-6 py-3 bg-[#E0FE10] text-black font-semibold rounded-lg hover:bg-[#d8f521] transition-colors"
      >
        Request Access
      </a>
    </div>
  );
  
  // Refs for sections
  const sectionsRef = useRef<SectionRefs>({
    overview: null,
    vision: null,
    ip: null,
    market: null,
    product: null,
    techstack: null,
    team: null,
    traction: null,
    financials: null,
    captable: null,
    deck: null,
    investment: null,
    documents: null,
  });



  // Function to switch section (show/hide instead of scroll)
  const switchSection = (sectionId: string) => {
    setActiveSection(sectionId);
    // Update URL with section parameter (shallow update, no page reload)
    router.push(`/investor?section=${sectionId}`, undefined, { shallow: true });
    // Scroll to top of content area when switching sections
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fetch financial data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const docRef = doc(db, "investorData", "metrics");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setFinancialMetrics(docSnap.data() as FinancialMetrics);
        } else {
          setFinancialMetrics({
            revenue: "$2.5K",
            users: "808",
            growth: "22% MoM",
            retention: "78%"
          });
        }
      } catch (error) {
        console.error("Error fetching investor data:", error);
        setFinancialMetrics({
          revenue: "$2.5K",
          users: "808",
          growth: "22% MoM",
          retention: "78%"
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    const fetchKEffectiveMetrics = async () => {
      setIsLoadingKMetrics(true);
      try {
        console.log(`[K-Effective] Starting to fetch K-effective metrics`);
        
        // Use the same method as the inactivity check page to get properly mapped UserChallenge data
        const allUserChallenges = await workoutService.fetchAllUserChallenges();
        
        console.log(`[K-Effective] Found ${allUserChallenges.length} total UserChallenge documents`);
        console.log(`[K-Effective] Sample UserChallenge data:`, allUserChallenges.slice(0, 3));

        // Calculate K-effective metrics for Morning Mobility Challenge (May 6 - June 6)
        const challengeStartDate = new Date('2025-05-06');
        const challengeEndDate = new Date('2025-06-06');
        console.log(`[K-Effective] Filtering for participants between: ${challengeStartDate.toISOString()} and ${challengeEndDate.toISOString()}`);

        // Filter for first 30 days of challenge (May 6 - June 6)
        const recentParticipants = allUserChallenges.filter((uc: UserChallenge) => {
          const hasValidJoinDate = uc.joinDate && uc.joinDate >= challengeStartDate && uc.joinDate <= challengeEndDate;
          console.log(`[K-Effective] User ${uc.username} (${uc.userId}) - joinDate: ${uc.joinDate?.toISOString()}, isInChallengePeriod: ${hasValidJoinDate}`);
          return hasValidJoinDate;
        });

        console.log(`[K-Effective] Challenge participants (May 6 - June 6): ${recentParticipants.length}`);

        // Count active referrers (users who have sharedBy others in their referral chain)
        const activeReferrerIds = new Set<string>();
        const referredSignups = recentParticipants.filter((uc: UserChallenge) => {
          console.log(`[K-Effective] Checking referral chain for ${uc.username}:`, uc.referralChain);
          
          if (uc.referralChain?.sharedBy && uc.referralChain.sharedBy !== '') {
            console.log(`[K-Effective] ${uc.username} was referred by: ${uc.referralChain.sharedBy}`);
            activeReferrerIds.add(uc.referralChain.sharedBy);
            return true;
          } else {
            console.log(`[K-Effective] ${uc.username} has no referral chain or empty sharedBy`);
            return false;
          }
        });

        console.log(`[K-Effective] Active referrer IDs:`, Array.from(activeReferrerIds));
        console.log(`[K-Effective] Referred signups:`, referredSignups.map((uc: UserChallenge) => ({
          username: uc.username,
          userId: uc.userId,
          sharedBy: uc.referralChain?.sharedBy
        })));

        const activeReferrers = activeReferrerIds.size;
        const kEffective = activeReferrers > 0 ? referredSignups.length / activeReferrers : 0;

        console.log(`[K-Effective] Final calculation: ${referredSignups.length} referred signups / ${activeReferrers} active referrers = ${kEffective}`);

        // Calculate additional metrics
        const totalParticipants = recentParticipants.length;
        const directJoins = totalParticipants - referredSignups.length;
        const viralPercentage = totalParticipants > 0 ? (referredSignups.length / totalParticipants) * 100 : 0;

        // Calculate viral cycle time (average time from join to first share)
        // This would require tracking share events - using estimated value for now
        const viralCycleTime = 6.3; // days

        // Calculate share-to-first-workout rate
        // This would require workout completion data - using estimated value for now
        const shareToFirstWorkoutRate = 78; // percentage

        // Calculate time to second share
        // This would require multiple share tracking - using estimated value for now
        const timeToSecondShare = 12; // days

        const finalMetrics = {
          kEffective: Math.round(kEffective * 100) / 100,
          activeReferrers,
          referredSignups: referredSignups.length,
          viralCycleTime,
          shareToFirstWorkoutRate,
          timeToSecondShare,
          totalParticipants,
          directJoins,
          viralPercentage: Math.round(viralPercentage * 10) / 10
        };

        console.log(`[K-Effective] Final metrics:`, finalMetrics);
        setKEffectiveMetrics(finalMetrics);

      } catch (error) {
        console.error("Error fetching K-effective metrics:", error);
        // Fallback data based on your description
        setKEffectiveMetrics({
          kEffective: 1.27,
          activeReferrers: 231,
          referredSignups: 294,
          viralCycleTime: 6.3,
          shareToFirstWorkoutRate: 78,
          timeToSecondShare: 12,
          totalParticipants: 525,
          directJoins: 231,
          viralPercentage: 56.0
        });
      } finally {
        setIsLoadingKMetrics(false);
      }
    };

    fetchData();
    fetchKEffectiveMetrics();
  }, []);

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E0FE10] animate-spin" />
      </div>
    );
  }

  // Show access gate if not authenticated
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <Head>
          <title>Investor Dataroom | Pulse Intelligence Labs</title>
          <meta name="description" content="Access confidential investor materials for Pulse Intelligence Labs - the creator-powered fitness platform." />
          
          {/* Open Graph */}
          <meta property="og:title" content="Investor Dataroom | Pulse Intelligence Labs" />
          <meta property="og:description" content="Access confidential investor materials for Pulse - the creator-powered fitness platform turning short workout videos into multiplayer training experiences." />
          <meta property="og:image" content="https://fitwithpulse.ai/InvestPreviewImg.png" />
          <meta property="og:image:secure_url" content="https://fitwithpulse.ai/InvestPreviewImg.png" />
          <meta property="og:image:type" content="image/png" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:image:alt" content="Pulse Intelligence Labs - Investor Dataroom" />
          <meta property="og:url" content="https://fitwithpulse.ai/investor" />
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="Pulse Intelligence Labs" />
          
          {/* Twitter Card */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Investor Dataroom | Pulse Intelligence Labs" />
          <meta name="twitter:description" content="Access confidential investor materials for Pulse - the creator-powered fitness platform." />
          <meta name="twitter:image" content="https://fitwithpulse.ai/InvestPreviewImg.png" />
          <meta name="twitter:image:alt" content="Pulse Intelligence Labs - Investor Dataroom" />
          
          {/* Additional */}
          <link rel="canonical" href="https://fitwithpulse.ai/investor" />
        </Head>
        <PageHead 
          metaData={metaData} 
          pageOgUrl="https://fitwithpulse.ai/investor" 
        />
        <div className="max-w-md w-full">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[#E0FE10]/10 flex items-center justify-center">
                <Lock className="w-8 h-8 text-[#E0FE10]" />
              </div>
            </div>
            
            <h1 className="text-white text-2xl font-bold text-center mb-2">Investor Dataroom</h1>
            <p className="text-zinc-400 text-center mb-8">
              Enter your email to access confidential investor materials.
            </p>
            
            <form onSubmit={handleAccessSubmit} className="space-y-4">
              <div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="email"
                    value={accessEmail}
                    onChange={(e) => {
                      setAccessEmail(e.target.value);
                      setAccessError(null);
                    }}
                    placeholder="Enter your email address"
                    className="w-full pl-12 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#E0FE10] focus:border-transparent"
                    disabled={isCheckingAccess}
                  />
                </div>
              </div>
              
              {accessError && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{accessError}</p>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isCheckingAccess || !accessEmail.trim()}
                className="w-full py-3 bg-[#E0FE10] text-black font-semibold rounded-lg hover:bg-[#d8f521] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isCheckingAccess ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Access Dataroom'
                )}
              </button>
            </form>
            
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <p className="text-zinc-500 text-sm text-center">
                Don't have access?{' '}
                <a 
                  href="mailto:invest@fitwithpulse.ai?subject=Investor%20Dataroom%20Access%20Request" 
                  className="text-[#E0FE10] hover:underline"
                >
                  Request access
                </a>
              </p>
            </div>
          </div>
          
          <p className="text-zinc-600 text-xs text-center mt-4">
            This dataroom contains confidential information intended only for authorized investors.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Head>
        <title>Investor Dataroom | Pulse Intelligence Labs</title>
        <meta name="description" content="Access confidential investor materials for Pulse Intelligence Labs - the creator-powered fitness platform." />
        
        {/* Open Graph */}
        <meta property="og:title" content="Investor Dataroom | Pulse Intelligence Labs" />
        <meta property="og:description" content="Access confidential investor materials for Pulse - the creator-powered fitness platform turning short workout videos into multiplayer training experiences." />
        <meta property="og:image" content="https://fitwithpulse.ai/InvestPreviewImg.png" />
        <meta property="og:image:secure_url" content="https://fitwithpulse.ai/InvestPreviewImg.png" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Pulse Intelligence Labs - Investor Dataroom" />
        <meta property="og:url" content="https://fitwithpulse.ai/investor" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Pulse Intelligence Labs" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Investor Dataroom | Pulse Intelligence Labs" />
        <meta name="twitter:description" content="Access confidential investor materials for Pulse - the creator-powered fitness platform." />
        <meta name="twitter:image" content="https://fitwithpulse.ai/InvestPreviewImg.png" />
        <meta name="twitter:image:alt" content="Pulse Intelligence Labs - Investor Dataroom" />
        
        {/* Additional */}
        <link rel="canonical" href="https://fitwithpulse.ai/investor" />
      </Head>
      <PageHead 
        metaData={metaData} 
        pageOgUrl="https://fitwithpulse.ai/investor" 
      />

      {/* Logout button - fixed position */}
      <button
        onClick={handleLogout}
        className="fixed top-4 right-4 z-50 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 text-sm hover:text-white hover:border-zinc-600 transition-colors"
      >
        Sign Out
      </button>

      {/* Hero Section */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center text-center px-8 py-24 overflow-hidden">
        {/* Base background */}
        <div className="absolute inset-0 bg-[#0a0a0a]"></div>
        
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Large lime orb - slow float */}
          <div 
            className="absolute w-[600px] h-[600px] rounded-full opacity-20"
            style={{
              background: 'radial-gradient(circle, #E0FE10 0%, transparent 70%)',
              top: '-10%',
              right: '-10%',
              animation: 'float 20s ease-in-out infinite',
              filter: 'blur(80px)',
            }}
          />
          {/* Medium purple orb */}
          <div 
            className="absolute w-[400px] h-[400px] rounded-full opacity-15"
            style={{
              background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)',
              bottom: '10%',
              left: '-5%',
              animation: 'float 25s ease-in-out infinite reverse',
              filter: 'blur(60px)',
            }}
          />
          {/* Small blue orb */}
          <div 
            className="absolute w-[300px] h-[300px] rounded-full opacity-10"
            style={{
              background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)',
              top: '40%',
              left: '30%',
              animation: 'float 18s ease-in-out infinite',
              filter: 'blur(50px)',
            }}
          />
          {/* Accent lime orb */}
          <div 
            className="absolute w-[200px] h-[200px] rounded-full opacity-25"
            style={{
              background: 'radial-gradient(circle, #E0FE10 0%, transparent 70%)',
              bottom: '20%',
              right: '20%',
              animation: 'pulse 8s ease-in-out infinite',
              filter: 'blur(40px)',
            }}
          />
        </div>

        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div 
            className="h-full w-full"
            style={{
              backgroundImage: 'linear-gradient(rgba(224,254,16,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(224,254,16,0.3) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}></div>

        {/* Gradient overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0a]/80"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-[#0a0a0a]/50"></div>

        {/* Content */}
        <div className="relative z-20 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E0FE10]/10 border border-[#E0FE10]/20 mb-6">
            <div className="w-2 h-2 rounded-full bg-[#E0FE10] animate-pulse"></div>
            <span className="text-[#E0FE10] text-sm font-medium tracking-wide">INVESTOR RELATIONS</span>
          </div>
          
          {/* Main heading with gradient */}
          <h1 className="text-white text-5xl sm:text-7xl font-bold mb-6 leading-tight">
            Pulse Investor
            <br />
            <span className="bg-gradient-to-r from-[#E0FE10] via-[#c5e310] to-[#E0FE10] bg-clip-text text-transparent">
              Dataroom
            </span>
          </h1>
          
          {/* Tagline */}
          <p className="text-zinc-400 text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
            Building the social gateway to the future of health.
          </p>
          
          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="/PulseDeck12_9.pdf" 
              download="PulseDeck12_9.pdf"
              className="group inline-flex items-center justify-center px-8 py-4 bg-[#E0FE10] hover:bg-[#d8f521] text-black font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20 hover:-translate-y-0.5"
            >
              <Download className="mr-2 h-5 w-5 group-hover:animate-bounce" />
              Download Pitch Deck
            </a>
            <a 
              href="mailto:invest@fitwithpulse.ai" 
              className="inline-flex items-center justify-center px-8 py-4 bg-zinc-800/80 backdrop-blur-sm hover:bg-zinc-700 text-white font-semibold rounded-xl border border-zinc-700 transition-all duration-300 hover:-translate-y-0.5"
            >
              Contact Investors Team
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
          <div className="flex flex-col items-center gap-2 text-zinc-500">
            <span className="text-xs tracking-wider">SCROLL TO EXPLORE</span>
            <div className="w-6 h-10 rounded-full border-2 border-zinc-600 flex items-start justify-center p-2">
              <div className="w-1.5 h-3 bg-zinc-500 rounded-full animate-bounce"></div>
            </div>
          </div>
        </div>

        {/* CSS Animations */}
        <style jsx>{`
          @keyframes float {
            0%, 100% {
              transform: translate(0, 0) scale(1);
            }
            25% {
              transform: translate(30px, -30px) scale(1.05);
            }
            50% {
              transform: translate(-20px, 20px) scale(0.95);
            }
            75% {
              transform: translate(20px, 10px) scale(1.02);
            }
          }
          @keyframes pulse {
            0%, 100% {
              opacity: 0.25;
              transform: scale(1);
            }
            50% {
              opacity: 0.4;
              transform: scale(1.1);
            }
          }
        `}</style>
      </section>

      {/* Main Content with Navigation */}
      <section className="py-16 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex flex-col lg:flex-row gap-10">
            {/* Sticky Navigation */}
            <div className="lg:w-1/4">
              <div className="sticky top-24 bg-zinc-900/50 backdrop-blur-sm rounded-xl p-6 border border-zinc-800">
                <h3 className="text-white text-lg font-medium mb-6">Investor Information</h3>
                <nav className="space-y-1">
                  {[
                    { id: 'overview', label: 'Company Overview', number: 1 },
                    { id: 'product', label: 'Product & Technology', number: 2 },
                    { id: 'traction', label: 'Traction & Metrics', number: 3 },
                    { id: 'ip', label: 'IP & Defensibility', number: 4 },
                    { id: 'vision', label: 'Vision & Evolution', number: 5 },
                    { id: 'market', label: 'Market Opportunity', number: 6 },
                    { id: 'techstack', label: 'Technical Stack', number: 7 },
                    { id: 'team', label: 'Team', number: 8 },
                    { id: 'financials', label: 'Financial Information', number: 9 },
                    { id: 'captable', label: 'Cap Table', number: 10 },
                    { id: 'deck', label: 'Pitch Deck', number: 11 },
                    { id: 'investment', label: 'Investment Opportunity', number: 12 },
                    { id: 'documents', label: 'All Documents', number: 13 },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => switchSection(item.id)}
                      className={`flex items-center w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        activeSection === item.id
                          ? 'bg-[#E0FE10]/10 text-[#E0FE10]'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                      }`}
                    >
                      <span>{item.label}</span>
                      {activeSection === item.id && (
                        <ChevronRight className="ml-auto h-4 w-4" />
                      )}
                    </button>
                  ))}
                </nav>
                <div className="mt-8 p-4 bg-zinc-800/50 rounded-lg">
                  <p className="text-zinc-400 text-sm">
                    For additional information or to schedule a meeting, contact us at{' '}
                    <a href="mailto:invest@fitwithpulse.ai" className="text-[#E0FE10] hover:underline">
                      invest@fitwithpulse.ai
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:w-3/4">
              {/* Company Overview Section */}
              {activeSection === 'overview' && (
                hasSectionAccess('overview') ? (
              <section 
                id="overview" 
                ref={(el) => { sectionsRef.current.overview = el; }}
                className="mb-20"
              >
                {/* Header with gradient accent */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E0FE10] to-[#a8c40a] flex items-center justify-center mr-4 shadow-lg shadow-[#E0FE10]/20">
                      <span className="font-bold text-black text-lg">1</span>
                    </div>
                    <div>
                      <h2 className="text-white text-3xl font-bold">Company Overview</h2>
                      <p className="text-zinc-500 text-sm">The future of fitness is social</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href="/PulseIntelligenceLabsCertificateofIncorporation.pdf"
                      download
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-xl text-xs text-zinc-200 transition-all duration-300 backdrop-blur-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Certificate of Incorporation
                    </a>
                    <a
                      href="/Founder Intellectual Property Assignment Agreement - Pulse Intelligence Labs.pdf"
                      download="Founder-IP-Assignment-Agreement.pdf"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-xl text-xs text-zinc-200 transition-all duration-300 backdrop-blur-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      IP Assignment Agreement
                    </a>
                  </div>
                </div>
                
                {/* Main content card with animated background */}
                <div className="relative rounded-2xl overflow-hidden mb-10">
                  {/* Animated gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800">
                    <div 
                      className="absolute w-[400px] h-[400px] rounded-full opacity-10"
                      style={{
                        background: 'radial-gradient(circle, #E0FE10 0%, transparent 70%)',
                        top: '-20%',
                        right: '-10%',
                        filter: 'blur(60px)',
                      }}
                    />
                    <div 
                      className="absolute w-[300px] h-[300px] rounded-full opacity-10"
                      style={{
                        background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)',
                        bottom: '-15%',
                        left: '-5%',
                        filter: 'blur(60px)',
                      }}
                    />
                  </div>
                  
                  <div className="relative border border-zinc-800/50 rounded-2xl p-8 md:p-10 backdrop-blur-sm">
                    {/* Hero statement */}
                    <div className="max-w-3xl mb-10">
                      <h3 className="text-white text-2xl md:text-3xl font-bold leading-tight mb-4">
                        Pulse is the <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E0FE10] to-[#a8c40a]">creator-powered fitness platform</span> that turns short workout videos into multiplayer, playlist-style training experiences.
                      </h3>
                      <p className="text-zinc-400 text-base leading-relaxed">
                        Creators upload Moves, Pulse assembles them into Stacks, and users train together in real time with leaderboards, scoring, and social motivation.
                      </p>
                    </div>
                    
                    {/* For Creators / For Users cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                      <div className="group relative bg-gradient-to-br from-zinc-800/80 to-zinc-800/40 rounded-xl p-6 border border-zinc-700/50 hover:border-[#E0FE10]/30 transition-all duration-300">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#E0FE10] to-transparent rounded-t-xl opacity-60"></div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-[#E0FE10]/10 flex items-center justify-center">
                            <span className="text-[#E0FE10] text-lg">🎬</span>
                          </div>
                          <h4 className="text-[#E0FE10] font-semibold text-lg">For Creators</h4>
                        </div>
                        <p className="text-zinc-300 text-sm leading-relaxed">Upload Moves, earn every time they&apos;re used. Pulse handles distribution and payouts.</p>
                      </div>
                      <div className="group relative bg-gradient-to-br from-zinc-800/80 to-zinc-800/40 rounded-xl p-6 border border-zinc-700/50 hover:border-[#E0FE10]/30 transition-all duration-300">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#E0FE10] to-transparent rounded-t-xl opacity-60"></div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-[#E0FE10]/10 flex items-center justify-center">
                            <span className="text-[#E0FE10] text-lg">💪</span>
                          </div>
                          <h4 className="text-[#E0FE10] font-semibold text-lg">For Users</h4>
                        </div>
                        <p className="text-zinc-300 text-sm leading-relaxed">Personalized workouts, group challenges, leaderboards. Fitness that feels social.</p>
                      </div>
                    </div>

                    {/* The Model - highlighted callout */}
                    <div className="relative bg-gradient-to-r from-[#E0FE10]/10 via-[#E0FE10]/5 to-transparent rounded-xl p-5 border border-[#E0FE10]/20 mb-10">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#E0FE10] to-[#E0FE10]/30 rounded-l-xl"></div>
                      <p className="text-zinc-200 text-sm leading-relaxed pl-2">
                        <span className="text-[#E0FE10] font-semibold">The Model:</span> Creators upload Moves → Pulse transforms them into <span className="text-white font-medium">Stacks</span> (structured workouts) and <span className="text-white font-medium">Rounds</span> (group challenges) → Users train socially → Creators earn through custom pricing and content usage.
                      </p>
                    </div>
                    
                    {/* Mission, Vision, Values Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* Mission Card */}
                      <div className="group bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 hover:border-zinc-600/50 transition-all duration-300 hover:transform hover:scale-[1.02]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
                            <span className="text-blue-400 text-lg">🎯</span>
                          </div>
                          <h4 className="text-white font-semibold text-lg">Mission</h4>
                        </div>
                        <p className="text-zinc-400 text-sm leading-relaxed">Make fitness feel social, accessible, and community-driven — powered by real creators and real human connection.</p>
                      </div>
                      
                      {/* Vision Card - clickable */}
                      <div 
                        className="group relative bg-gradient-to-br from-[#E0FE10]/10 to-zinc-800/50 rounded-xl p-6 cursor-pointer border border-[#E0FE10]/20 hover:border-[#E0FE10]/40 transition-all duration-300 hover:transform hover:scale-[1.02] hover:shadow-lg hover:shadow-[#E0FE10]/10"
                        onClick={() => switchSection('vision')}
                      >
                        <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#E0FE10]/20 flex items-center justify-center group-hover:bg-[#E0FE10]/30 transition-all duration-300 group-hover:scale-110">
                          <span className="text-[#E0FE10] text-sm">→</span>
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E0FE10]/20 to-[#E0FE10]/10 flex items-center justify-center">
                            <span className="text-[#E0FE10] text-lg">🚀</span>
                          </div>
                          <h4 className="text-[#E0FE10] font-semibold text-lg">Vision</h4>
                        </div>
                        <p className="text-zinc-300 text-sm leading-relaxed mb-3">
                          Build the first operating system for human health — wellness that&apos;s continuous, adaptive, and embedded into daily life.
                        </p>
                        <p className="text-[#E0FE10]/70 text-xs font-medium group-hover:text-[#E0FE10] transition-colors">
                          Explore our vision →
                        </p>
                      </div>
                      
                      {/* Values Card */}
                      <div className="group bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 hover:border-zinc-600/50 transition-all duration-300 hover:transform hover:scale-[1.02]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
                            <span className="text-purple-400 text-lg">💎</span>
                          </div>
                          <h4 className="text-white font-semibold text-lg">Values</h4>
                        </div>
                        <ul className="text-zinc-400 text-sm space-y-2">
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E0FE10]"></span>
                            Community-first
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E0FE10]"></span>
                            Authentic, creator-powered fitness
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E0FE10]"></span>
                            Inclusivity and accessibility
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E0FE10]"></span>
                            Tech that enhances connection
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
                ) : (
                  <LockedSectionView sectionName="Company Overview" />
                )
              )}
              
              {/* Product & Technology Section */}
              {activeSection === 'product' && (
                hasSectionAccess('product') ? (
              <section 
                id="product" 
                ref={(el) => { sectionsRef.current.product = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">2</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Product & Technology</h2>
                </div>
                
                {/* Product Demo Video */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-8">
                  <VideoDemo />
                </div>

                {/* Content Hierarchy: Move → Stack → Round */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-8">
                  <h3 className="text-white text-xl font-semibold mb-6">How It Works</h3>
                  
                  <div className="flex flex-col md:flex-row items-stretch gap-4">
                    {/* Moves */}
                    <div className="flex-1 bg-zinc-800/50 rounded-xl p-5 border-l-4 border-[#E0FE10]">
                      <div className="flex items-center gap-3 mb-3">
                        <img src="/moveIcon.png" alt="Moves" className="w-10 h-10 object-contain" />
                        <h4 className="text-[#E0FE10] font-semibold">Moves</h4>
                      </div>
                      <p className="text-zinc-400 text-sm">Short exercise videos uploaded by creators. The atomic building blocks.</p>
                    </div>
                    
                    {/* Arrow */}
                    <div className="hidden md:flex items-center justify-center px-2">
                      <span className="text-[#E0FE10] text-2xl">→</span>
                    </div>
                    <div className="flex md:hidden justify-center py-2">
                      <span className="text-[#E0FE10] text-2xl">↓</span>
                    </div>
                    
                    {/* Stacks */}
                    <div className="flex-1 bg-zinc-800/50 rounded-xl p-5 border-l-4 border-blue-400">
                      <div className="flex items-center gap-3 mb-3">
                        <img src="/stacksIcon.png" alt="Stacks" className="w-10 h-10 object-contain" />
                        <h4 className="text-blue-400 font-semibold">Stacks</h4>
                      </div>
                      <p className="text-zinc-400 text-sm">Curated playlists of Moves. On-demand workout programs.</p>
                    </div>
                    
                    {/* Arrow */}
                    <div className="hidden md:flex items-center justify-center px-2">
                      <span className="text-[#E0FE10] text-2xl">→</span>
                    </div>
                    <div className="flex md:hidden justify-center py-2">
                      <span className="text-[#E0FE10] text-2xl">↓</span>
                    </div>
                    
                    {/* Rounds */}
                    <div className="flex-1 bg-zinc-800/50 rounded-xl p-5 border-l-4 border-purple-400">
                      <div className="flex items-center gap-3 mb-3">
                        <img src="/roundIcon.png" alt="Rounds" className="w-10 h-10 object-contain" />
                        <h4 className="text-purple-400 font-semibold">Rounds</h4>
                      </div>
                      <p className="text-zinc-400 text-sm">Live multiplayer challenges with leaderboards and scoring.</p>
                    </div>
                  </div>
                </div>

                {/* Standout Features */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-8">
                  <h3 className="text-white text-xl font-semibold mb-6">Standout Features</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-zinc-800/40 rounded-lg p-4">
                      <span className="text-2xl mb-2 block">🏆</span>
                      <p className="text-white font-medium text-sm">Real-time Leaderboards</p>
                      <p className="text-zinc-500 text-xs">Compete live during workouts</p>
                    </div>
                    <div className="bg-zinc-800/40 rounded-lg p-4">
                      <span className="text-2xl mb-2 block">🤖</span>
                      <p className="text-white font-medium text-sm">AI Programming</p>
                      <p className="text-zinc-500 text-xs">Auto-generate workout plans</p>
                    </div>
                    <div className="bg-zinc-800/40 rounded-lg p-4">
                      <span className="text-2xl mb-2 block">⌚</span>
                      <p className="text-white font-medium text-sm">Apple Watch Integration</p>
                      <p className="text-zinc-500 text-xs">Live HR, HRV, and calories</p>
                    </div>
                    <div className="bg-zinc-800/40 rounded-lg p-4">
                      <span className="text-2xl mb-2 block">💰</span>
                      <p className="text-white font-medium text-sm">Creator Payouts</p>
                      <p className="text-zinc-500 text-xs">Automatic revenue sharing</p>
                    </div>
                    <div className="bg-zinc-800/40 rounded-lg p-4">
                      <span className="text-2xl mb-2 block">🔗</span>
                      <p className="text-white font-medium text-sm">Referral System</p>
                      <p className="text-zinc-500 text-xs">Built-in viral loops</p>
                    </div>
                    <div className="bg-zinc-800/40 rounded-lg p-4">
                      <span className="text-2xl mb-2 block">📱</span>
                      <p className="text-white font-medium text-sm">Cross-Platform</p>
                      <p className="text-zinc-500 text-xs">iOS, Android, and Web</p>
                    </div>
                  </div>
                </div>

                {/* Demo Videos */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                  <h3 className="text-white text-xl font-semibold mb-6">Product Demos</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <div className="aspect-video rounded-lg overflow-hidden mb-3">
                        <iframe
                          src="https://www.youtube.com/embed/8Ous6Wqvn7o"
                          title="Pulse Product Walkthrough"
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                      <p className="text-white font-medium text-sm">Product Walkthrough</p>
                      <p className="text-zinc-500 text-xs">Full platform overview</p>
                    </div>
                    
                    <div>
                      <div className="aspect-video rounded-lg overflow-hidden mb-3">
                        <iframe
                          src="https://www.youtube.com/embed/FDqvrReKjyo"
                          title="How to Upload a Move"
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                      <p className="text-white font-medium text-sm">How to Upload a Move</p>
                      <p className="text-zinc-500 text-xs">Creator tutorial</p>
                    </div>
                    
                    <div>
                      <div className="aspect-video rounded-lg overflow-hidden mb-3">
                        <iframe
                          src="https://www.youtube.com/embed/MZ_CSr0Cyzs"
                          title="How to Create a Round"
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                      <p className="text-white font-medium text-sm">How to Create a Round</p>
                      <p className="text-zinc-500 text-xs">Build AI-powered workouts</p>
                    </div>
                  </div>
                </div>
              </section>
                ) : (
                  <LockedSectionView sectionName="Product & Technology" />
                )
              )}
              
              {/* Traction & Metrics Section */}
              {activeSection === 'traction' && (
                hasSectionAccess('traction') ? (
              <>
              <section 
                id="traction" 
                ref={(el) => { sectionsRef.current.traction = el; }}
                className="mb-20"
              >
                <div className="flex items-center mb-8">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">3</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Traction & Metrics</h2>
                </div>

                {/* Hero Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                  <div className="bg-gradient-to-br from-[#E0FE10]/20 to-[#E0FE10]/5 border border-[#E0FE10]/30 rounded-2xl p-6 text-center">
                    <div className="text-[#E0FE10] text-4xl font-bold mb-1">3</div>
                    <div className="text-zinc-300 text-sm font-medium">Rounds Launched</div>
                    <div className="text-zinc-500 text-xs mt-1">2025 YTD</div>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 text-center">
                    <div className="text-white text-4xl font-bold mb-1">150+</div>
                    <div className="text-zinc-300 text-sm font-medium">Total Participants</div>
                    <div className="text-zinc-500 text-xs mt-1">Across all Rounds</div>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 text-center">
                    <div className="text-white text-4xl font-bold mb-1">$0</div>
                    <div className="text-zinc-300 text-sm font-medium">Paid Marketing</div>
                    <div className="text-zinc-500 text-xs mt-1">100% organic growth</div>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 text-center">
                    <div className="text-white text-4xl font-bold mb-1">1</div>
                    <div className="text-zinc-300 text-sm font-medium">Brand Partner</div>
                    <div className="text-zinc-500 text-xs mt-1">SoulCycle</div>
                  </div>
                </div>

                {/* Creator Spotlight: Jaidus × SoulCycle */}
                <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl overflow-hidden mb-10">
                  {/* Header with SoulCycle partnership badge */}
                  <div className="bg-gradient-to-r from-[#E0FE10]/10 via-transparent to-transparent p-6 border-b border-zinc-800">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">🔥</span>
                          <h3 className="text-white text-2xl font-bold">Creator Spotlight: Jaidus × SoulCycle</h3>
                        </div>
                        <p className="text-zinc-400">From studio energy to digital movement — how one coach turned sweat into story.</p>
                      </div>
                      <div className="flex items-center gap-3 bg-zinc-800/80 rounded-xl px-4 py-3 border border-zinc-700">
                        <img 
                          src="/soulcycle.png" 
                          alt="SoulCycle" 
                          className="w-10 h-10 rounded-lg object-contain bg-white p-1"
                        />
                        <div>
                          <div className="text-white font-semibold text-sm">SoulCycle Partnership</div>
                          <div className="text-zinc-400 text-xs">First Pulse-branded Round</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 md:p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                      {/* Video */}
                      <div className="rounded-xl overflow-hidden border border-zinc-700 bg-black aspect-video">
                        <video
                          className="w-full h-full object-cover"
                          controls
                          playsInline
                          src="/JaidusNewYear.mov"
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>

                      {/* Stats & Info */}
                      <div className="space-y-6">
                        {/* Highlight stats */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-zinc-800/70 border border-zinc-700 rounded-xl p-4 text-center">
                            <div className="text-[#E0FE10] text-2xl font-bold">30</div>
                            <div className="text-zinc-400 text-xs mt-1">Day Challenge</div>
                          </div>
                          <div className="bg-zinc-800/70 border border-zinc-700 rounded-xl p-4 text-center">
                            <div className="text-[#E0FE10] text-2xl font-bold">46</div>
                            <div className="text-zinc-400 text-xs mt-1">Participants</div>
                          </div>
                        </div>

                        {/* Quote */}
                        <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/30 rounded-xl p-5">
                          <p className="text-[#e6ffc2]/90 text-lg italic">&ldquo;Pulse helped me turn my workouts into something people feel part of.&rdquo;</p>
                          <p className="text-[#e6ffc2]/70 text-sm mt-3">— Jaidus Mondesir, Creator & Coach</p>
                        </div>

                        {/* Key wins */}
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[#E0FE10] text-xs">✓</span>
                            </div>
                            <div className="text-zinc-300 text-sm">Built 30-Day Ab Challenge — first creator-led Round on Pulse</div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[#E0FE10] text-xs">✓</span>
                            </div>
                            <div className="text-zinc-300 text-sm">Trained 46 people simultaneously with live, high-energy experience</div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[#E0FE10] text-xs">✓</span>
                            </div>
                            <div className="text-zinc-300 text-sm">Partnered with SoulCycle to offer free 7-day rides to winners</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2025 Rounds Timeline */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8 mb-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-[#E0FE10]" />
                    </div>
                    <h3 className="text-white text-xl font-semibold">2025 Rounds</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Round 1 */}
                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 hover:border-[#E0FE10]/30 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-400">Completed</span>
                        <span className="text-zinc-500 text-xs">Jan - Feb</span>
                      </div>
                      <h4 className="text-white font-semibold mb-1">30 Day Abs Challenge</h4>
                      <p className="text-zinc-400 text-sm mb-3">Core focus with Jaidus</p>
                      <div className="flex items-center gap-4 text-sm">
                        <div><span className="text-[#E0FE10] font-bold">46</span> <span className="text-zinc-500">seekers</span></div>
                      </div>
                    </div>
                    
                    {/* Round 2 */}
                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 hover:border-[#E0FE10]/30 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-400">Completed</span>
                        <span className="text-zinc-500 text-xs">Mar - Apr</span>
                      </div>
                      <h4 className="text-white font-semibold mb-1">30 Day Squat Challenge</h4>
                      <p className="text-zinc-400 text-sm mb-3">Lower body focus</p>
                      <div className="flex items-center gap-4 text-sm">
                        <div><span className="text-[#E0FE10] font-bold">37</span> <span className="text-zinc-500">seekers</span></div>
                      </div>
                    </div>
                    
                    {/* Round 3 */}
                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 hover:border-[#E0FE10]/30 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-400">Completed</span>
                        <span className="text-zinc-500 text-xs">May - Jun</span>
                      </div>
                      <h4 className="text-white font-semibold mb-1">Morning Mobility</h4>
                      <p className="text-zinc-400 text-sm mb-3">30-day mobility challenge</p>
                      <div className="flex items-center gap-4 text-sm">
                        <div><span className="text-[#E0FE10] font-bold">83</span> <span className="text-zinc-500">seekers</span></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Growth Arrow */}
                  <div className="mt-6 pt-6 border-t border-zinc-800">
                    <div className="flex items-center justify-center gap-8">
                      <div className="text-center">
                        <div className="text-zinc-500 text-sm">Round 1</div>
                        <div className="text-white font-bold">46</div>
                      </div>
                      <div className="text-[#E0FE10]">→</div>
                      <div className="text-center">
                        <div className="text-zinc-500 text-sm">Round 2</div>
                        <div className="text-white font-bold">37</div>
                      </div>
                      <div className="text-[#E0FE10]">→</div>
                      <div className="text-center">
                        <div className="text-zinc-500 text-sm">Round 3</div>
                        <div className="text-[#E0FE10] font-bold">83</div>
                      </div>
                      <div className="bg-[#E0FE10]/10 rounded-lg px-3 py-1.5">
                        <span className="text-[#E0FE10] text-sm font-medium">+80% growth</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Two Column: Early Validation + Process Optimizations */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
                  {/* Early Stage Validation */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8">
                    <h3 className="text-white text-xl font-bold mb-2">Early Stage Validation</h3>
                    <p className="text-zinc-400 text-sm mb-6">
                      Strong early metrics since January 2025 public launch demonstrate product-market fit and scalable unit economics.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="text-center py-4 bg-zinc-800/50 rounded-xl">
                        <div className="text-zinc-400 text-sm mb-1">Retention Rate</div>
                        <div className="text-white text-3xl font-bold">78%</div>
                        <div className="text-zinc-500 text-xs mt-1">Above industry avg</div>
                      </div>
                      <div className="text-center py-4 bg-zinc-800/50 rounded-xl">
                        <div className="text-zinc-400 text-sm mb-1">Conversion Rate</div>
                        <div className="text-white text-3xl font-bold">18%</div>
                        <div className="text-zinc-500 text-xs mt-1">2x industry avg</div>
                      </div>
                      <div className="text-center py-4 bg-zinc-800/50 rounded-xl">
                        <div className="text-zinc-400 text-sm mb-1">Creator Multiplier</div>
                        <div className="text-white text-3xl font-bold">37.5x</div>
                        <div className="text-zinc-500 text-xs mt-1">Users per creator</div>
                      </div>
                      <div className="text-center py-4 bg-zinc-800/50 rounded-xl">
                        <div className="text-zinc-400 text-sm mb-1">Monthly Churn</div>
                        <div className="text-white text-3xl font-bold">6.5%</div>
                        <div className="text-zinc-500 text-xs mt-1">Low for early stage</div>
                      </div>
                    </div>
                    
                    <div className="bg-zinc-800/30 rounded-xl p-4">
                      <h4 className="text-[#E0FE10] text-sm font-medium mb-3">Subscription Mix</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400 text-sm">Annual ($39.99)</span>
                          <span className="text-white font-semibold">56%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400 text-sm">Monthly ($4.99)</span>
                          <span className="text-white font-semibold">44%</span>
                        </div>
                      </div>
                      <p className="text-zinc-500 text-xs mt-3">Strong annual uptake shows user confidence</p>
                    </div>
                  </div>

                  {/* Process Optimizations */}
                  <div className="bg-gradient-to-br from-[#E0FE10]/10 to-transparent border border-[#E0FE10]/20 rounded-2xl p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-[#E0FE10]/20 flex items-center justify-center">
                        <span className="text-lg">⚡</span>
                      </div>
                      <h3 className="text-white text-xl font-bold">2025 Optimizations</h3>
                    </div>
                    <p className="text-zinc-400 text-sm mb-6">
                      Key learnings from our first 3 Rounds, now baked into the platform.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-green-400 text-xs">✓</span>
                          </div>
                          <div>
                            <div className="text-white font-medium">7-Day Trial</div>
                            <div className="text-zinc-400 text-sm">Reduced from 30 days — prevents post-Round cancellations</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-green-400 text-xs">✓</span>
                          </div>
                          <div>
                            <div className="text-white font-medium">AI Round Builder</div>
                            <div className="text-zinc-400 text-sm">Creators can now launch Rounds in &lt;5 min vs. hours</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-green-400 text-xs">✓</span>
                          </div>
                          <div>
                            <div className="text-white font-medium">Referral System</div>
                            <div className="text-zinc-400 text-sm">Built-in viral loop with trackable K-factor metrics</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-green-400 text-xs">✓</span>
                          </div>
                          <div>
                            <div className="text-white font-medium">Round Frequency</div>
                            <div className="text-zinc-400 text-sm">Targeting bi-weekly Rounds in 2026 (was ~1/quarter)</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Program Support Networks */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8 mb-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <span className="text-lg">🤝</span>
                    </div>
                    <h3 className="text-white text-xl font-bold">Program Support Networks</h3>
                  </div>
                  <p className="text-zinc-400 text-sm mb-6">
                    Backed by top startup programs providing mentorship, resources, and network access.
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* AWS Startups */}
                    <a 
                      href="https://aws.amazon.com/startups" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 flex flex-col items-center text-center hover:border-orange-500/30 transition-colors group cursor-pointer"
                    >
                      <div className="w-full h-14 flex items-center justify-center mb-3">
                        <img 
                          src="/awsstartups.png" 
                          alt="AWS Startups" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <h4 className="text-white font-semibold text-sm mb-1 group-hover:text-orange-400 transition-colors">AWS Startups</h4>
                      <p className="text-zinc-500 text-xs">Cloud credits</p>
                    </a>

                    {/* Techstars */}
                    <a 
                      href="https://www.techstars.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 flex flex-col items-center text-center hover:border-green-500/30 transition-colors group cursor-pointer"
                    >
                      <div className="w-full h-14 flex items-center justify-center mb-3">
                        <img 
                          src="/techstars.png" 
                          alt="Techstars" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <h4 className="text-white font-semibold text-sm mb-1 group-hover:text-green-400 transition-colors">Techstars</h4>
                      <p className="text-zinc-500 text-xs">Accelerator network</p>
                    </a>

                    {/* FounderU */}
                    <a 
                      href="https://www.founder.university" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 flex flex-col items-center text-center hover:border-blue-500/30 transition-colors group cursor-pointer"
                    >
                      <div className="w-full h-14 flex items-center justify-center mb-3">
                        <img 
                          src="/founderu.png" 
                          alt="FounderU" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <h4 className="text-white font-semibold text-sm mb-1 group-hover:text-blue-400 transition-colors">FounderU</h4>
                      <p className="text-zinc-500 text-xs">Founder program</p>
                    </a>

                    {/* Launch */}
                    <a 
                      href="https://www.launchaccelerator.co" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 flex flex-col items-center text-center hover:border-purple-500/30 transition-colors group cursor-pointer"
                    >
                      <div className="w-full h-14 flex items-center justify-center mb-3">
                        <img 
                          src="/Launch.png" 
                          alt="Launch" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <h4 className="text-white font-semibold text-sm mb-1 group-hover:text-purple-400 transition-colors">Launch</h4>
                      <p className="text-zinc-500 text-xs">Accelerator</p>
                    </a>
                  </div>
                </div>

                {/* Bottom CTA */}
                <div className="bg-gradient-to-r from-[#E0FE10]/10 via-[#E0FE10]/5 to-transparent border border-[#E0FE10]/20 rounded-2xl p-6 text-center">
                  <p className="text-zinc-300 text-lg">
                    <span className="text-[#E0FE10] font-semibold">3 Rounds. 150+ participants. $0 paid marketing.</span>
                    <br />
                    <span className="text-zinc-400">The flywheel is spinning — now it&apos;s time to scale.</span>
                  </p>
                </div>
              </section>
              </>
                ) : (
                  <LockedSectionView sectionName="Traction & Metrics" />
                )
              )}

               {/* IP & Defensibility Section */}
                {activeSection === 'ip' && (
                  hasSectionAccess('ip') ? (
                <section
                    id="ip"
                    ref={(el) => { sectionsRef.current.ip = el; }}
                    className="mb-20"
                >
                    {/* header */}
                    <div className="flex items-center mb-8">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">4</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">IP &amp; Defensibility</h2>
                    </div>

                    {/* Provisional Patent Hero */}
                    <div className="bg-gradient-to-br from-[#E0FE10]/10 via-zinc-900 to-zinc-900 border border-[#E0FE10]/20 rounded-2xl p-6 md:p-8 mb-8">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-xl bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-2xl">📜</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">Provisional Patent</span>
                              <span className="text-zinc-500 text-xs">USPTO • Filed Feb 2025</span>
                            </div>
                            <h3 className="text-white text-xl font-bold mb-1">Pulse Programming – AI Stack Generation</h3>
                            <p className="text-zinc-400 text-sm">Method for AI-generated workout programs from atomic exercise content</p>
                          </div>
                        </div>
                        <div className="bg-zinc-800/60 rounded-xl px-5 py-4 text-center md:text-right">
                          <div className="text-[#E0FE10] text-sm font-medium mb-1">12-Month Window</div>
                          <div className="text-zinc-400 text-xs">To convert to full patent</div>
                        </div>
                      </div>
                    </div>

                    {/* Technical IP Grid */}
                    <div className="mb-8">
                      <h3 className="text-white text-xl font-semibold mb-6">Technical IP & Proprietary Systems</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* iOS App */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/30 transition-colors group">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                              <span className="text-xl">📱</span>
                            </div>
                            <div className="flex-1">
                              <h4 className="text-white font-semibold mb-1 group-hover:text-[#E0FE10] transition-colors">iOS App</h4>
                              <p className="text-zinc-400 text-sm mb-3">Native Swift application with Apple Watch integration</p>
                              <div className="flex flex-wrap gap-2">
                                <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-400">SwiftUI</span>
                                <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-400">HealthKit</span>
                                <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-400">WatchOS</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Web App */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/30 transition-colors group">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-teal-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
                              <span className="text-xl">🌐</span>
                            </div>
                            <div className="flex-1">
                              <h4 className="text-white font-semibold mb-1 group-hover:text-[#E0FE10] transition-colors">Web App</h4>
                              <p className="text-zinc-400 text-sm mb-3">Full-featured web platform for creators and users</p>
                              <div className="flex flex-wrap gap-2">
                                <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-400">Next.js</span>
                                <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-400">React</span>
                                <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-400">TypeScript</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* PulseCheck */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/30 transition-colors group">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                              <span className="text-xl">🧠</span>
                            </div>
                            <div className="flex-1">
                              <h4 className="text-white font-semibold mb-1 group-hover:text-[#E0FE10] transition-colors">PulseCheck</h4>
                              <p className="text-zinc-400 text-sm mb-3">AI-powered mindset chatbot for mental wellness check-ins</p>
                              <div className="flex flex-wrap gap-2">
                                <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-400">GPT-4</span>
                                <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-400">Conversational AI</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Athlete CRM */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/30 transition-colors group">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-yellow-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                              <span className="text-xl">📊</span>
                            </div>
                            <div className="flex-1">
                              <h4 className="text-white font-semibold mb-1 group-hover:text-[#E0FE10] transition-colors">Athlete CRM</h4>
                              <p className="text-zinc-400 text-sm mb-3">Client management system for coaches and creators</p>
                              <div className="flex flex-wrap gap-2">
                                <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-400">Analytics</span>
                                <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-400">Progress Tracking</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Moat Summary */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-[#E0FE10]/20 flex items-center justify-center">
                          <span className="text-lg">🛡️</span>
                        </div>
                        <h4 className="text-white font-semibold">Defensibility Summary</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                          <div className="text-[#E0FE10] text-2xl font-bold mb-1">1</div>
                          <div className="text-zinc-400 text-sm">Provisional Patent</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                          <div className="text-[#E0FE10] text-2xl font-bold mb-1">4</div>
                          <div className="text-zinc-400 text-sm">Proprietary Systems</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                          <div className="text-[#E0FE10] text-2xl font-bold mb-1">2+</div>
                          <div className="text-zinc-400 text-sm">Years of Dev</div>
                        </div>
                      </div>
                    </div>
                </section>
                  ) : (
                    <LockedSectionView sectionName="IP & Moats" />
                  )
                )}

                {/* Vision & Evolution Section */}
                {activeSection === 'vision' && (
                  hasSectionAccess('vision') ? (
                <>
                <section 
                    id="vision" 
                    ref={(el) => { sectionsRef.current.vision = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">5</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">Vision &amp; Evolution</h2>
                    </div>
                    
                    {/* Transition text */}
                    <div className="mb-8">
                    <p className="text-zinc-400 text-lg italic text-center">
                        After social proof comes systemic impact.
                    </p>
                    </div>
                    
                    {/* Main vision card */}
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1 mb-10">
                    {/* Animated border shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/15 via-purple-500/15 to-[#d7ff00]/15 animate-[spin_8s_linear_infinite] opacity-25"></div>
                    
                    {/* Inner content */}
                    <div className="relative bg-zinc-900 rounded-lg p-8 lg:p-12 space-y-8">
                        {/* Vision statement */}
                        <blockquote className="text-zinc-200 text-xl md:text-2xl leading-relaxed font-light border-l-4 border-[#E0FE10] pl-6">
                        At Pulse, our vision is to build more than a fitness platform—we&rsquo;re creating the <span className="text-white font-semibold">first operating system for human health</span>.
                        We believe wellness isn&rsquo;t siloed into workouts, doctors, or devices—it&rsquo;s continuous, adaptive, and embedded into daily life.
                        </blockquote>
                        
                        {/* Evolution pillars */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                            title: 'Behavior Pixel',
                            copy: 'Every real-world choice becomes a datapoint—movement, meals, sleep, even stress patterns.'
                            },
                            {
                            title: 'Adaptive AI Rounds',
                            copy: 'Programs auto-adjust to bio-feedback, recovery metrics and goals in real time.'
                            },
                            {
                            title: 'Gamified Longevity',
                            copy: 'Health turns into a shared game: scores, leagues, and community-powered rewards.'
                            }
                        ].map((item) => (
                            <div key={item.title} className="bg-zinc-800/60 rounded-lg p-6">
                            <h4 className="text-[#E0FE10] font-medium mb-2">{item.title}</h4>
                            <p className="text-zinc-400 text-sm">{item.copy}</p>
                            </div>
                        ))}
                        </div>
                        
                        {/* Closing statement */}
                        <p className="text-zinc-400 pt-4">
                        Pulse will be the layer that lets people <span className="text-white font-medium">see, shape, and strive</span> for better health—together.
                        </p>
                    </div>
                    </div>
                    
                    {/* Evolution timeline */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                        <div className="w-3 h-3 rounded-full bg-[#E0FE10] mr-3"></div>
                        <span className="text-[#E0FE10] font-medium text-sm">2023-24</span>
                        </div>
                        <h4 className="text-white font-semibold mb-2">Social Fitness Core</h4>
                        <p className="text-zinc-400 text-sm">
                        Building the foundation with community-driven workouts, challenges, and social engagement features.
                        </p>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                        <div className="w-3 h-3 rounded-full bg-zinc-500 mr-3"></div>
                        <span className="text-zinc-400 font-medium text-sm">2024-25</span>
                        </div>
                        <h4 className="text-white font-semibold mb-2">Whole-Body Health Intelligence</h4>
                        <p className="text-zinc-400 text-sm">
                        Expanding beyond fitness with Apple Watch integration, meal AI, sleep tracking, and comprehensive wellness insights.
                        </p>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                        <div className="w-3 h-3 rounded-full bg-zinc-600 mr-3"></div>
                        <span className="text-zinc-400 font-medium text-sm">2025+</span>
                        </div>
                        <h4 className="text-white font-semibold mb-2">Pulse Health OS</h4>
                        <p className="text-zinc-400 text-sm">
                        The complete health operating system with predictive AI, seamless device integration, and personalized health orchestration.
                        </p>
                    </div>
                    </div>
                </section>

                {/* Two-Up Framing Card */}
                <section className="mb-20">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                            <span className="text-2xl mr-3">🚀</span>
                            <h3 className="text-white text-xl font-semibold">Pulse Today</h3>
                        </div>
                        <ul className="space-y-3 text-zinc-300">
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>Social fitness feed live on iOS/Android</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>808 users, 18% paid conversion</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>Creator multiplier 37.5×</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>$0 CAC, 100% organic growth</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>78% retention, 1h 29m sessions</span>
                            </li>
                        </ul>
                        </div>
                        
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                        <div className="flex items-center mb-4">
                            <span className="text-2xl mr-3">🌌</span>
                            <h3 className="text-white text-xl font-semibold">Pulse Tomorrow</h3>
                        </div>
                        <ul className="space-y-3 text-zinc-300">
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>Health OS stitching workouts, wearables, recovery AI</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>Behavior Pixel® data model patent draft</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>Gamified longevity leaderboard</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>Predictive AI for health optimization</span>
                            </li>
                            <li className="flex items-start gap-2">
                            <span className="text-[#E0FE10] mt-1">•</span>
                            <span>Personal health operating system</span>
                            </li>
                        </ul>
                        </div>
                    </div>
                    </div>
                </section>
                </>
                  ) : (
                    <LockedSectionView sectionName="Vision & Evolution" />
                  )
                )}

                {/* Market Opportunity Section */}
                {activeSection === 'market' && (
                  hasSectionAccess('market') ? (
                <section 
                    id="market" 
                    ref={(el) => { sectionsRef.current.market = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-8">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">6</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">Market Opportunity</h2>
                    </div>

                    {/* Bottoms-Up TAM Approach */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8 mb-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-[#E0FE10]/20 flex items-center justify-center">
                          <span className="text-lg">📊</span>
                        </div>
                        <h3 className="text-white text-xl font-semibold">Bottoms-Up TAM</h3>
                      </div>
                      
                      {/* Visual Flow: ICP → Beachhead → GTM → TAM → Path to $100M */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center border border-zinc-700">
                          <div className="w-12 h-12 rounded-full bg-zinc-700/50 mx-auto mb-3 flex items-center justify-center">
                            <span className="text-xl">👤</span>
                          </div>
                          <div className="text-orange-400 text-xs font-bold mb-1">ICP</div>
                          <div className="text-zinc-400 text-xs">Who are our ideal customers</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center border border-zinc-700">
                          <div className="w-12 h-12 rounded-full bg-zinc-700/50 mx-auto mb-3 flex items-center justify-center">
                            <span className="text-xl">📍</span>
                          </div>
                          <div className="text-orange-400 text-xs font-bold mb-1">BEACHHEAD</div>
                          <div className="text-zinc-400 text-xs">Who we are starting with</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center border border-zinc-700">
                          <div className="w-12 h-12 rounded-full bg-zinc-700/50 mx-auto mb-3 flex items-center justify-center">
                            <span className="text-xl">🔍</span>
                          </div>
                          <div className="text-orange-400 text-xs font-bold mb-1">GTM</div>
                          <div className="text-zinc-400 text-xs">Where we find them & how we sell</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center border border-zinc-700">
                          <div className="w-12 h-12 rounded-full bg-zinc-700/50 mx-auto mb-3 flex items-center justify-center">
                            <span className="text-xl">👥</span>
                          </div>
                          <div className="text-orange-400 text-xs font-bold mb-1">TAM</div>
                          <div className="text-zinc-400 text-xs">How big can this get</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center border border-zinc-700">
                          <div className="w-12 h-12 rounded-full bg-zinc-700/50 mx-auto mb-3 flex items-center justify-center">
                            <span className="text-xl">📈</span>
                          </div>
                          <div className="text-orange-400 text-xs font-bold mb-1">PATH TO $100M</div>
                          <div className="text-zinc-400 text-xs">How we will scale</div>
                        </div>
                      </div>
                    </div>

                    {/* Beachhead Market - Hero Section */}
                    <div className="bg-gradient-to-br from-[#E0FE10]/10 via-zinc-900 to-zinc-900 border border-[#E0FE10]/20 rounded-2xl p-6 md:p-8 mb-8">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#E0FE10]/20 text-[#E0FE10]">Beachhead Market</span>
                      </div>
                      <h3 className="text-white text-2xl font-bold mb-2">Fitness Instructors & Studio Coaches</h3>
                      <p className="text-zinc-400 mb-6">We start here because they already have highly supportive audiences who trust their guidance and are primed to convert.</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-zinc-800/50 rounded-xl p-5 text-center">
                          <div className="text-white text-3xl font-bold mb-1">350,000</div>
                          <div className="text-zinc-400 text-sm">Personal trainers & fitness instructors</div>
                          <div className="text-[#E0FE10] text-xs mt-1">(12% growth rate)</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-xl p-5 text-center">
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="text-[#E0FE10] text-xl">×</span>
                          </div>
                          <div className="text-white text-3xl font-bold">$4,080</div>
                          <div className="text-zinc-400 text-sm">Annual LTV per creator</div>
                        </div>
                        <div className="bg-[#E0FE10] rounded-xl p-5 text-center">
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="text-black text-xl">=</span>
                          </div>
                          <div className="text-black text-3xl font-bold">$1.4 Billion</div>
                          <div className="text-black/70 text-sm">Beachhead TAM</div>
                        </div>
                      </div>

                      {/* Why Beachhead */}
                      <div className="bg-zinc-800/30 rounded-xl p-5 border border-zinc-700">
                        <h4 className="text-white font-semibold mb-3">Why Fitness Instructors First?</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[#E0FE10] text-xs">✓</span>
                            </div>
                            <div className="text-zinc-300 text-sm">Built-in audiences who trust their recommendations</div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[#E0FE10] text-xs">✓</span>
                            </div>
                            <div className="text-zinc-300 text-sm">Already creating content (Moves) in their daily work</div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[#E0FE10] text-xs">✓</span>
                            </div>
                            <div className="text-zinc-300 text-sm">Strong community dynamics = natural viral loops</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Our Take - Revenue Model */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8 mb-8">
                      <h3 className="text-white text-xl font-semibold mb-6">Our Take: How We Earn Per Round</h3>
                      
                      <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-8">
                        <div className="bg-zinc-800/50 rounded-xl p-6 text-center">
                          <div className="text-zinc-400 text-sm mb-1">Creator</div>
                          <div className="text-white text-2xl font-bold">$80</div>
                        </div>
                        <div className="text-[#E0FE10] text-3xl font-bold">+</div>
                        <div className="text-center">
                          <span className="text-zinc-400 text-lg">(</span>
                          <div className="inline-block bg-zinc-800/50 rounded-xl px-6 py-4 mx-2">
                            <div className="text-zinc-400 text-xs mb-1">subscription fee</div>
                            <div className="text-white text-2xl font-bold">$40</div>
                          </div>
                          <span className="text-[#E0FE10] text-3xl font-bold mx-2">×</span>
                          <div className="inline-block bg-zinc-800/50 rounded-xl px-6 py-4 mx-2">
                            <div className="text-zinc-400 text-xs mb-1">Subscribers</div>
                            <div className="text-white text-2xl font-bold">50</div>
                          </div>
                          <span className="text-zinc-400 text-lg">)</span>
                        </div>
                        <div className="text-[#E0FE10] text-3xl font-bold">=</div>
                        <div className="bg-[#E0FE10] rounded-xl p-6 text-center">
                          <div className="text-black/70 text-sm mb-1">Per Round</div>
                          <div className="text-black text-3xl font-bold">$2,080</div>
                        </div>
                      </div>

                      <div className="bg-zinc-800/30 rounded-xl p-5 text-center">
                        <p className="text-zinc-300 text-lg">
                          We encourage fitness creators to host at least <span className="text-[#E0FE10] font-bold">2 Standard Rounds</span> per year
                        </p>
                        <div className="mt-3 flex items-center justify-center gap-4">
                          <span className="text-white text-xl">2 Rounds</span>
                          <span className="text-[#E0FE10]">×</span>
                          <span className="text-white text-xl">$2,000 each</span>
                          <span className="text-[#E0FE10]">=</span>
                          <span className="text-[#E0FE10] text-2xl font-bold">$4,080</span>
                          <span className="text-zinc-400 text-sm">/year</span>
                        </div>
                      </div>
                    </div>

                    {/* ICP - Full Creator Population */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8 mb-8">
                      <h3 className="text-white text-xl font-semibold mb-6">Ideal Customer Profile (ICP)</h3>
                      
                      <div className="text-center mb-6">
                        <div className="text-[#E0FE10] text-5xl md:text-6xl font-bold mb-2">1,350,000</div>
                        <p className="text-zinc-400">Total addressable fitness creators</p>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                          <div className="text-white font-medium text-sm">Certified Instructors</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                          <div className="text-white font-medium text-sm">Group Fitness Instructors</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                          <div className="text-white font-medium text-sm">Online Trainers</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                          <div className="text-white font-medium text-sm">Fitness Creators &gt;10K followers</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                          <div className="text-white font-medium text-sm">Athlete-Adjacent Creators</div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                          <div className="text-white font-medium text-sm">Studio Instructors (Pilates, Cycle, HIIT)</div>
                        </div>
                      </div>
                    </div>

                    {/* Path to $100M */}
                    <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl p-6 md:p-8 mb-8 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#E0FE10]/5 to-transparent"></div>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-[#E0FE10] text-2xl font-bold">Path to $100M</h3>
                          <span className="text-zinc-400">25,000 Creators</span>
                        </div>
                        
                        {/* Growth Curve Visualization */}
                        <div className="relative mb-8">
                          <div className="flex items-end justify-between gap-2 md:gap-4 h-48">
                            <div className="flex-1 flex flex-col items-center justify-end">
                              <div className="text-[#E0FE10] text-lg md:text-xl font-bold mb-2">$1M</div>
                              <div className="w-full bg-zinc-700/50 rounded-t-lg" style={{ height: '20%' }}></div>
                              <div className="mt-2 text-center">
                                <div className="text-white text-sm font-medium">123</div>
                                <div className="text-zinc-500 text-xs">creators</div>
                              </div>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-end">
                              <div className="text-[#E0FE10] text-lg md:text-xl font-bold mb-2">$10M</div>
                              <div className="w-full bg-zinc-700/50 rounded-t-lg" style={{ height: '35%' }}></div>
                              <div className="mt-2 text-center">
                                <div className="text-white text-sm font-medium">2,450</div>
                                <div className="text-zinc-500 text-xs">creators</div>
                              </div>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-end">
                              <div className="text-[#E0FE10] text-lg md:text-xl font-bold mb-2">$50M</div>
                              <div className="w-full bg-zinc-700/50 rounded-t-lg" style={{ height: '60%' }}></div>
                              <div className="mt-2 text-center">
                                <div className="text-white text-sm font-medium">12,500</div>
                                <div className="text-zinc-500 text-xs">creators</div>
                                <div className="text-[#E0FE10] text-xs mt-1">625K seekers</div>
                              </div>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-end">
                              <div className="text-[#E0FE10] text-2xl md:text-3xl font-bold mb-2">$100M</div>
                              <div className="w-full bg-[#E0FE10]/30 rounded-t-lg border-2 border-[#E0FE10]" style={{ height: '100%' }}></div>
                              <div className="mt-2 text-center">
                                <div className="text-[#E0FE10] text-sm font-bold">25,000</div>
                                <div className="text-zinc-500 text-xs">creators</div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                          <p className="text-zinc-400 text-sm">
                            At <span className="text-[#E0FE10] font-medium">$4,080 annual LTV per creator</span>, 
                            we need only <span className="text-white font-medium">1.9%</span> of the ICP (1.35M creators) to reach $100M ARR
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Adjacent Markets - Creator Economy */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                          <span className="text-lg">🚀</span>
                        </div>
                        <div>
                          <h3 className="text-white text-xl font-semibold">Adjacent Markets</h3>
                          <p className="text-zinc-400 text-sm">The broader creator economy opportunity</p>
                        </div>
                      </div>

                      {/* Creator Economy Hero */}
                      <div className="bg-gradient-to-br from-purple-900/30 to-zinc-900 rounded-xl p-6 mb-6 border border-purple-500/20">
                        <div className="text-center mb-6">
                          <div className="text-white text-4xl md:text-5xl font-bold mb-2">$120B+</div>
                          <div className="text-zinc-400">Creator Economy</div>
                          <p className="text-zinc-500 text-sm mt-2">Transforming how creators monetize their content</p>
                        </div>
                        
                        {/* Platform Comparison */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-5">
                            <h4 className="text-purple-400 font-semibold mb-4">Twitch Streamers</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-zinc-400 text-sm">Streamers</span>
                                <span className="text-white font-medium">7M</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-zinc-400 text-sm">Influencer Marketing</span>
                                <span className="text-white font-medium">$1.9B</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-zinc-400 text-sm">Ad Revenue</span>
                                <span className="text-white font-medium">$667M</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-white text-4xl font-bold">50x</div>
                              <div className="text-zinc-500 text-sm">Difference</div>
                            </div>
                          </div>
                          
                          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-5">
                            <h4 className="text-red-400 font-semibold mb-4">YouTubers</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-zinc-400 text-sm">Active Channels</span>
                                <span className="text-white font-medium">114M</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-zinc-400 text-sm">Influencer Marketing</span>
                                <span className="text-white font-medium">$88.9B</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-zinc-400 text-sm">Ad Revenue</span>
                                <span className="text-white font-medium">$31.5B</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Why Start Fitness */}
                      <div className="bg-zinc-800/30 rounded-xl p-5">
                        <h4 className="text-white font-semibold mb-4">Why Fitness Creators Are Our Entry Point</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[#E0FE10] text-xs">1</span>
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm">Pre-built trust relationships</p>
                              <p className="text-zinc-400 text-xs">Audiences follow their instructors from studio to digital</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[#E0FE10] text-xs">2</span>
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm">Content creation is natural</p>
                              <p className="text-zinc-400 text-xs">They film workouts daily — Pulse just packages it</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[#E0FE10] text-xs">3</span>
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm">Community-first culture</p>
                              <p className="text-zinc-400 text-xs">Group fitness = built-in viral mechanics</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[#E0FE10] text-xs">4</span>
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm">Expandable model</p>
                              <p className="text-zinc-400 text-xs">Same playbook applies to yoga, dance, wellness, etc.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                </section>
                  ) : (
                    <LockedSectionView sectionName="Market Opportunity" />
                  )
                )}

                {/* Technical Stack Section */}
                {activeSection === 'techstack' && (
                  hasSectionAccess('techstack') ? (
                <section 
                    id="techstack" 
                    ref={(el) => { sectionsRef.current.techstack = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-6">
                        <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                            <span className="font-bold text-black">7</span>
                        </div>
                        <h2 className="text-white text-3xl font-bold">Technical Stack</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Frontend & Mobile */}
                        <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
                            <h3 className="text-white text-xl font-semibold mb-4 flex items-center">
                                <div className="w-8 h-8 rounded-lg bg-[#E0FE10]/20 flex items-center justify-center mr-3">
                                    <span className="text-[#E0FE10] text-sm">📱</span>
                                </div>
                                Frontend & Mobile
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">Web Framework</span>
                                    <span className="text-[#E0FE10] font-medium">Next.js + React</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">Mobile Platform</span>
                                    <span className="text-[#E0FE10] font-medium">Native iOS (Swift)</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">UI Framework</span>
                                    <span className="text-[#E0FE10] font-medium">SwiftUI + Tailwind CSS</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">Type Safety</span>
                                    <span className="text-[#E0FE10] font-medium">TypeScript</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">State Management</span>
                                    <span className="text-[#E0FE10] font-medium">Redux Toolkit</span>
                                </div>
                            </div>
                        </div>

                        {/* Backend & Infrastructure */}
                        <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
                            <h3 className="text-white text-xl font-semibold mb-4 flex items-center">
                                <div className="w-8 h-8 rounded-lg bg-[#E0FE10]/20 flex items-center justify-center mr-3">
                                    <span className="text-[#E0FE10] text-sm">⚡</span>
                                </div>
                                Backend & Infrastructure
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">Database</span>
                                    <span className="text-[#E0FE10] font-medium">Firebase Firestore</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">Authentication</span>
                                    <span className="text-[#E0FE10] font-medium">Firebase Auth</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">File Storage</span>
                                    <span className="text-[#E0FE10] font-medium">Firebase Storage</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">API Layer</span>
                                    <span className="text-[#E0FE10] font-medium">Next.js API Routes</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">Deployment</span>
                                    <span className="text-[#E0FE10] font-medium">Netlify + App Store</span>
                                </div>
                            </div>
                        </div>

                        {/* AI & Data Processing */}
                        <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
                            <h3 className="text-white text-xl font-semibold mb-4 flex items-center">
                                <div className="w-8 h-8 rounded-lg bg-[#E0FE10]/20 flex items-center justify-center mr-3">
                                    <span className="text-[#E0FE10] text-sm">🤖</span>
                                </div>
                                AI & Data Processing
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">AI Platform</span>
                                    <span className="text-[#E0FE10] font-medium">OpenAI API</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">Models</span>
                                    <span className="text-[#E0FE10] font-medium">Latest OpenAI models</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">Image Processing</span>
                                    <span className="text-[#E0FE10] font-medium">AI-powered extraction</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">Data Parsing</span>
                                    <span className="text-[#E0FE10] font-medium">Automated text analysis</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">Real-time Sync</span>
                                    <span className="text-[#E0FE10] font-medium">Firebase listeners</span>
                                </div>
                            </div>
                        </div>

                        {/* Development & Tools */}
                        <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
                            <h3 className="text-white text-xl font-semibold mb-4 flex items-center">
                                <div className="w-8 h-8 rounded-lg bg-[#E0FE10]/20 flex items-center justify-center mr-3">
                                    <span className="text-[#E0FE10] text-sm">🛠️</span>
                                </div>
                                Development & Tools
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">Package Manager</span>
                                    <span className="text-[#E0FE10] font-medium">Yarn</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">Version Control</span>
                                    <span className="text-[#E0FE10] font-medium">Git</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">Code Quality</span>
                                    <span className="text-[#E0FE10] font-medium">ESLint + Prettier</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">Health Integration</span>
                                    <span className="text-[#E0FE10] font-medium">iOS HealthKit</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-300">CDN</span>
                                    <span className="text-[#E0FE10] font-medium">Netlify Edge</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Architecture Overview */}
                    <div className="mt-8 bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
                        <h3 className="text-white text-xl font-semibold mb-4">Architecture Overview</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mx-auto mb-3">
                                    <span className="text-[#E0FE10] text-2xl">📱</span>
                                </div>
                                <h4 className="text-white font-semibold mb-2">Cross-Platform</h4>
                                <p className="text-zinc-400 text-sm">Native iOS app for optimal mobile experience, responsive web app for broader accessibility</p>
                            </div>
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mx-auto mb-3">
                                    <span className="text-[#E0FE10] text-2xl">🔄</span>
                                </div>
                                <h4 className="text-white font-semibold mb-2">Real-time Sync</h4>
                                <p className="text-zinc-400 text-sm">Unified Firebase backend ensures data consistency across all platforms and devices</p>
                            </div>
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-full bg-[#E0FE10]/20 flex items-center justify-center mx-auto mb-3">
                                    <span className="text-[#E0FE10] text-2xl">🚀</span>
                                </div>
                                <h4 className="text-white font-semibold mb-2">Scalable</h4>
                                <p className="text-zinc-400 text-sm">Modern tech stack built for rapid scaling with AI-enhanced admin tools and automation</p>
                            </div>
                        </div>
                    </div>

                    {/* Key Technical Advantages */}
                    <div className="mt-8 bg-gradient-to-r from-[#E0FE10]/10 to-transparent rounded-xl p-6 border border-[#E0FE10]/20">
                        <h3 className="text-white text-xl font-semibold mb-4">Key Technical Advantages</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-start space-x-3">
                                <div className="w-6 h-6 rounded-full bg-[#E0FE10] flex items-center justify-center mt-0.5">
                                    <span className="text-black text-xs font-bold">✓</span>
                                </div>
                                <div>
                                    <h4 className="text-white font-medium">Type-Safe Development</h4>
                                    <p className="text-zinc-400 text-sm">TypeScript ensures code reliability and faster development cycles</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <div className="w-6 h-6 rounded-full bg-[#E0FE10] flex items-center justify-center mt-0.5">
                                    <span className="text-black text-xs font-bold">✓</span>
                                </div>
                                <div>
                                    <h4 className="text-white font-medium">AI-Enhanced Operations</h4>
                                    <p className="text-zinc-400 text-sm">Automated data processing reduces manual work and improves accuracy</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <div className="w-6 h-6 rounded-full bg-[#E0FE10] flex items-center justify-center mt-0.5">
                                    <span className="text-black text-xs font-bold">✓</span>
                                </div>
                                <div>
                                    <h4 className="text-white font-medium">Firebase Ecosystem</h4>
                                    <p className="text-zinc-400 text-sm">Integrated auth, database, and storage with built-in scaling</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <div className="w-6 h-6 rounded-full bg-[#E0FE10] flex items-center justify-center mt-0.5">
                                    <span className="text-black text-xs font-bold">✓</span>
                                </div>
                                <div>
                                    <h4 className="text-white font-medium">Modern Deployment</h4>
                                    <p className="text-zinc-400 text-sm">Automated CI/CD with Netlify and App Store distribution</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                  ) : (
                    <LockedSectionView sectionName="Tech Stack" />
                  )
                )}

                {/* Team Section */}
                {activeSection === 'team' && (
                  hasSectionAccess('team') ? (
                <section 
                    id="team" 
                    ref={(el) => { sectionsRef.current.team = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">8</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">Team</h2>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                    <h3 className="text-white text-xl font-semibold mb-6">The Folks Building Pulse</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {/* CEO */}
                        <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
                        <div className="aspect-square overflow-hidden">
                            <img 
                            src="TremaineFounder.jpg"
                            alt="Tremaine Grant - CEO & Founder" 
                            className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="p-6">
                            <h4 className="text-white font-semibold mb-1">Tremaine</h4>
                            <p className="text-[#E0FE10] text-sm font-medium mb-3">CEO & Founder</p>
                            <p className="text-zinc-400 text-sm">
                            Former D1 athlete, 10+ year personal trainer, principal engineer. Built software at GM, Pfizer, and Warby Parker.
                            </p>
                        </div>
                        </div>
                        
                        {/* Design Lead */}
                        <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
                        <div className="aspect-square overflow-hidden">
                            <img 
                            src="lola.jpg"
                            alt="Lola - Design Lead" 
                            className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="p-6">
                            <h4 className="text-white font-semibold mb-1">Lola</h4>
                            <p className="text-[#E0FE10] text-sm font-medium mb-3">Design Lead</p>
                            <p className="text-zinc-400 text-sm">
                            UX visionary crafting intuitive, accessible fitness experiences. Expert in design systems and user-centered product strategy.
                            </p>
                        </div>
                        </div>
                        
                        {/* Digital Creators Lead */}
                        <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
                        <div className="aspect-square overflow-hidden">
                            <img 
                            src="ricardo.jpg"
                            alt="Ricardo - Digital Creators Lead" 
                            className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="p-6">
                            <h4 className="text-white font-semibold mb-1">Ricardo</h4>
                            <p className="text-[#E0FE10] text-sm font-medium mb-3">Digital Creators Lead</p>
                            <p className="text-zinc-400 text-sm">
                            Exercise science major and veteran. Grew Instagram to 50K+. Leads creator acquisition and influencer partnerships.
                            </p>
                        </div>
                        </div>

                        {/* Chief of Staff */}
                        <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
                        <div className="aspect-square overflow-hidden">
                            <img 
                            src="bobbyAdvisor.jpg"
                            alt="Bobby Nweke - Chief of Staff" 
                            className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="p-6">
                            <h4 className="text-white font-semibold mb-1">Bobby</h4>
                            <p className="text-[#E0FE10] text-sm font-medium mb-3">Chief of Staff</p>
                            <p className="text-zinc-400 text-sm">
                            Harvard-educated, former TED coach. Brings storytelling, operational excellence, and investor communications.
                            </p>
                        </div>
                        </div>
                    </div>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    <h3 className="text-white text-xl font-semibold mb-6">Who Advises Us</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                            <img 
                            src="/Val.jpg"
                            alt="Advisor 1" 
                            className="w-full h-full object-cover"
                            />
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-1">
                              <a href="https://www.speakhappiness.com/about-valerie/" 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="hover:text-[#E0FE10] transition-colors underline decoration-dotted flex items-center gap-1">
                                Valerie Alexander
                                <ArrowUpRight className="h-3 w-3" />
                              </a>
                            </h4>
                            <p className="text-[#E0FE10] text-sm font-medium mb-2">Happiness, Inclusion & Bias</p>
                            <p className="text-zinc-400 text-sm">
                            TED speaker (500k+ views), #1 Amazon Seller. Former VC consultant and tech CEO. Advises on brand narrative and inclusive community design.
                            </p>
                        </div>
                        </div>
                        
                        <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                            <img 
                            src="/Deray.png"
                            alt="Advisor 2" 
                            className="w-full h-full object-cover"
                            />
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-1">
                              <a href="https://deray.com/" 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="hover:text-[#E0FE10] transition-colors underline decoration-dotted flex items-center gap-1">
                                DeRay Mckesson
                                <ArrowUpRight className="h-3 w-3" />
                              </a>
                            </h4>
                            <p className="text-[#E0FE10] text-sm font-medium mb-2">Community Building and Organizing</p>
                            <p className="text-zinc-400 text-sm">
                            Civil rights activist and community organizer. Expert in rallying people around shared causes. Advises on authentic community building.
                            </p>
                        </div>
                        </div>
                        
                        <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                            <img 
                            src="zak.jpg"
                            alt="Advisor 3" 
                            className="w-full h-full object-cover"
                            />
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-1">
                              <a href="https://www.linkedin.com/in/marqueszak/" 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="hover:text-[#E0FE10] transition-colors underline decoration-dotted flex items-center gap-1">
                                Marques Zak
                                <ArrowUpRight className="h-3 w-3" />
                              </a>
                            </h4>
                            <p className="text-[#E0FE10] text-sm font-medium mb-2">Marketing and Growth</p>
                            <p className="text-zinc-400 text-sm">
                            Advertising Hall of Achievement inductee. Marketing exec at PepsiCo and American Express. Advises on brand strategy and growth.
                            </p>
                        </div>
                        </div>
                    </div>
                    </div>
                </section>
                  ) : (
                    <LockedSectionView sectionName="Team" />
                  )
                )}

                {/* Financial Information Section */}
                {activeSection === 'financials' && (
                  hasSectionAccess('financials') ? (
                <section 
                    id="financials" 
                    ref={(el) => { sectionsRef.current.financials = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">9</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">Financial Information</h2>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                    <h3 className="text-white text-xl font-semibold mb-6">Revenue Streams</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Monthly Subscription */}
                        <div className="bg-zinc-800/70 rounded-lg p-6 relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 bg-[#E0FE10] text-black text-xs font-bold py-1 px-3 rounded-bl-lg">
                                MOST POPULAR
                            </div>
                            <h4 className="text-[#E0FE10] font-medium mb-2">Monthly Premium</h4>
                            <p className="text-white text-2xl font-bold mb-2">$4.99<span className="text-zinc-400 text-sm font-normal">/month</span></p>
                            <p className="text-zinc-400 text-sm">Full platform access</p>
                        </div>
                        
                        {/* Annual Subscription */}
                        <div className="bg-zinc-800/70 rounded-lg p-6">
                            <h4 className="text-[#E0FE10] font-medium mb-2">Annual Premium</h4>
                            <p className="text-white text-2xl font-bold mb-2">$39.99<span className="text-zinc-400 text-sm font-normal">/year</span></p>
                            <p className="text-zinc-400 text-sm">Save 33% vs monthly</p>
                        </div>
                        
                        {/* Platform Fee */}
                        <div className="bg-zinc-800/70 rounded-lg p-6 border border-[#E0FE10]/30">
                            <h4 className="text-[#E0FE10] font-medium mb-2">Platform Fee</h4>
                            <p className="text-white text-2xl font-bold mb-2">3%<span className="text-zinc-400 text-sm font-normal"> of transaction</span></p>
                            <p className="text-zinc-400 text-sm">On premium-priced Rounds</p>
                        </div>
                    </div>
                    </div>
                    
                    {/* Monthly Revenue Chart */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
                        <div>
                            <h3 className="text-white text-xl font-semibold mb-1">Monthly Revenue</h3>
                            <p className="text-zinc-400 text-sm">
                                {activeRevenueYear === '2025' 
                                    ? 'Actual revenue performance January - November 2025' 
                                    : 'Stealth mode organic App Store revenue 2024'}
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-3 mt-4 sm:mt-0">
                            {/* Year Toggle */}
                            <div className="flex items-center bg-zinc-800 rounded-lg overflow-hidden text-sm">
                                <button 
                                    onClick={() => setActiveRevenueYear('2025')}
                                    className={`px-4 py-2 font-medium transition-colors ${activeRevenueYear === '2025' ? 'bg-[#E0FE10] text-black' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    2025
                                </button>
                                <button 
                                    onClick={() => setActiveRevenueYear('2024')}
                                    className={`px-4 py-2 font-medium transition-colors ${activeRevenueYear === '2024' ? 'bg-[#E0FE10] text-black' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    2024
                                </button>
                            </div>
                            
                            <button
                                type="button"
                                onClick={() => {
                                    setMonthlyTableYear(activeRevenueYear);
                                    setIsMonthlyTableOpen(true);
                                }}
                                className="inline-flex items-center px-3 py-2 rounded-lg border border-zinc-700 text-xs font-medium text-zinc-200 hover:border-[#E0FE10] hover:text-[#E0FE10] transition-colors whitespace-nowrap"
                            >
                                <Download className="w-3 h-3 mr-1" />
                                Month-by-month view
                            </button>
                        </div>
                    </div>
                    
                    {/* Revenue Narrative */}
                    <div className="bg-zinc-800/30 rounded-lg p-4 mb-6">
                        {activeRevenueYear === '2025' ? (
                            <div className="space-y-3">
                                <p className="text-zinc-300 text-sm leading-relaxed">
                                    <span className="text-[#E0FE10] font-medium">2025 was intentionally small.</span> We launched lean, tested with creators one-on-one, and optimized based on real conversations. The revenue spikes (Feb, May-Jun) directly correlate with Round launches—validating our core thesis: <span className="text-white font-medium">Rounds = Subscriptions.</span>
                                </p>
                                <div className="bg-zinc-900/50 rounded-lg p-3 border-l-2 border-[#E0FE10]/50">
                                    <p className="text-zinc-400 text-xs font-medium mb-2">Problems we identified:</p>
                                    <ul className="text-zinc-400 text-xs space-y-1">
                                        <li>• Round creation was too long—creators dropped off mid-flow</li>
                                        <li>• No retargeting for participants after a Round ended</li>
                                    </ul>
                                </div>
                                <p className="text-zinc-400 text-sm leading-relaxed">
                                    We spent H2 building <span className="text-[#E0FE10]">AI templating</span> and <span className="text-[#E0FE10]">automated Round generation</span> to solve these friction points. The path forward is clear: optimize the funnel from signup → Round launch.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-zinc-300 text-sm leading-relaxed">
                                    <span className="text-blue-400 font-medium">2024 was our stealth year.</span> With zero marketing spend, we generated $2,011 in <span className="text-white">subscription revenue</span> through organic App Store discovery, private invitations to fitness seekers, and one-on-one training sessions using the app.
                                </p>
                                <p className="text-zinc-400 text-sm leading-relaxed">
                                    This validated our core product before the public launch—and revealed a pattern: users who trained <span className="text-white">together</span> retained longer and paid more. That insight became the foundation for Rounds, our main subscription driver.
                                </p>
                                <div className="bg-zinc-900/50 rounded-lg p-3 border-l-2 border-blue-400/50">
                                    <p className="text-zinc-500 text-xs italic">
                                        Note: We focused on subscription revenue. Additional revenue from one-off personal training sessions is not included in these figures.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Bar Chart */}
                    <div className="relative">
                        {/* Y-axis labels */}
                        <div className="absolute left-0 top-0 h-64 w-12 flex flex-col justify-between text-right pr-2">
                            {activeRevenueYear === '2025' ? (
                                <>
                                    <span className="text-zinc-500 text-xs">$700</span>
                                    <span className="text-zinc-500 text-xs">$525</span>
                                    <span className="text-zinc-500 text-xs">$350</span>
                                    <span className="text-zinc-500 text-xs">$175</span>
                                    <span className="text-zinc-500 text-xs">$0</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-zinc-500 text-xs">$500</span>
                                    <span className="text-zinc-500 text-xs">$375</span>
                                    <span className="text-zinc-500 text-xs">$250</span>
                                    <span className="text-zinc-500 text-xs">$125</span>
                                    <span className="text-zinc-500 text-xs">$0</span>
                                </>
                            )}
                        </div>
                        
                        {/* Chart area */}
                        <div className="ml-14">
                            {/* Grid lines */}
                            <div className="absolute left-14 right-0 top-0 h-64 flex flex-col justify-between pointer-events-none">
                                <div className="border-t border-zinc-800 w-full"></div>
                                <div className="border-t border-zinc-800 w-full"></div>
                                <div className="border-t border-zinc-800 w-full"></div>
                                <div className="border-t border-zinc-800 w-full"></div>
                                <div className="border-t border-zinc-800 w-full"></div>
                            </div>
                            
                            {/* Bars Container */}
                            <div className="flex items-end gap-2 h-64 relative z-10">
                                {activeRevenueYear === '2025' ? (
                                    // 2025 Data
                                    [
                                        { month: 'Jan', value: 246 },
                                        { month: 'Feb', value: 633 },
                                        { month: 'Mar', value: 268 },
                                        { month: 'Apr', value: 220 },
                                        { month: 'May', value: 373 },
                                        { month: 'Jun', value: 512 },
                                        { month: 'Jul', value: 346 },
                                        { month: 'Aug', value: 128 },
                                        { month: 'Sep', value: 115 },
                                        { month: 'Oct', value: 173 },
                                        { month: 'Nov', value: 134 },
                                        { month: 'Dec', value: null },
                                    ].map((item, index) => (
                                        <div key={index} className="flex-1 flex flex-col items-center justify-end h-full group">
                                            {item.value !== null ? (
                                                <div 
                                                    className="w-full bg-gradient-to-t from-[#E0FE10] to-[#E0FE10]/70 rounded-t-sm hover:from-[#E0FE10] hover:to-[#E0FE10] transition-all cursor-pointer relative"
                                                    style={{ height: `${(item.value / 700) * 256}px` }}
                                                >
                                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-700 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                                                        ${item.value}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div 
                                                    className="w-full bg-zinc-700/50 rounded-t-sm border-2 border-dashed border-zinc-500 cursor-pointer relative"
                                                    style={{ height: '40px' }}
                                                >
                                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-700 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                                                        In Progress
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    // 2024 Data
                                    [
                                        { month: 'Jan', value: 137 },
                                        { month: 'Feb', value: 89 },
                                        { month: 'Mar', value: 135 },
                                        { month: 'Apr', value: 111 },
                                        { month: 'May', value: 107 },
                                        { month: 'Jun', value: 293 },
                                        { month: 'Jul', value: 397 },
                                        { month: 'Aug', value: 157 },
                                        { month: 'Sep', value: 96 },
                                        { month: 'Oct', value: 201 },
                                        { month: 'Nov', value: 168 },
                                        { month: 'Dec', value: 120 },
                                    ].map((item, index) => (
                                        <div key={index} className="flex-1 flex flex-col items-center justify-end h-full group">
                                            <div 
                                                className="w-full bg-gradient-to-t from-blue-500 to-blue-400/70 rounded-t-sm hover:from-blue-400 hover:to-blue-400 transition-all cursor-pointer relative"
                                                style={{ height: `${(item.value / 500) * 256}px` }}
                                            >
                                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-700 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                                                    ${item.value}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            {/* X-axis labels */}
                            <div className="flex gap-2 mt-3 text-xs text-zinc-500">
                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => (
                                    <span key={month} className="flex-1 text-center">{month}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                        {activeRevenueYear === '2025' ? (
                            <>
                                <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                                    <p className="text-zinc-400 text-sm">YTD Revenue</p>
                                    <p className="text-[#E0FE10] text-2xl font-bold">$3,148</p>
                                    <p className="text-zinc-500 text-xs">Jan - Nov 2025</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                                    <p className="text-zinc-400 text-sm">Peak Month</p>
                                    <p className="text-white text-2xl font-bold">$633</p>
                                    <p className="text-zinc-500 text-xs">February 2025</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                                    <p className="text-zinc-400 text-sm">Monthly Avg</p>
                                    <p className="text-white text-2xl font-bold">$286</p>
                                    <p className="text-zinc-500 text-xs">11-month average</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                                    <p className="text-zinc-400 text-sm">Best Quarter</p>
                                    <p className="text-white text-2xl font-bold">Q2</p>
                                    <p className="text-zinc-500 text-xs">$1,105 total</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                                    <p className="text-zinc-400 text-sm">Annual Revenue</p>
                                    <p className="text-blue-400 text-2xl font-bold">$2,011</p>
                                    <p className="text-zinc-500 text-xs">Full Year 2024</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                                    <p className="text-zinc-400 text-sm">Peak Month</p>
                                    <p className="text-white text-2xl font-bold">$397</p>
                                    <p className="text-zinc-500 text-xs">July 2024</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                                    <p className="text-zinc-400 text-sm">Monthly Avg</p>
                                    <p className="text-white text-2xl font-bold">$168</p>
                                    <p className="text-zinc-500 text-xs">12-month average</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                                    <p className="text-zinc-400 text-sm">Best Quarter</p>
                                    <p className="text-white text-2xl font-bold">Q3</p>
                                    <p className="text-zinc-500 text-xs">$650 total</p>
                                </div>
                            </>
                        )}
                    </div>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    <h3 className="text-white text-xl font-semibold mb-6">Revenue Model & Projections</h3>
                    
                    {/* Current vs Target Economics */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Where We Are (2025) */}
                        <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                <h4 className="text-blue-400 font-medium">Where We Are (2025)</h4>
                            </div>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-zinc-400">Retention</span>
                                    <span className="text-white font-medium">78% — strong</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-400">Trial Conversion</span>
                                    <span className="text-white font-medium">18% — will improve(7 day)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-400">Avg Seekers/Round</span>
                                    <span className="text-white font-medium">≈55</span>
                                </div>
                            </div>
                            <div className="mt-4 p-3 bg-zinc-900/60 rounded-lg space-y-2">
                                <p className="text-zinc-300 text-xs font-semibold uppercase tracking-wide">Funnel optimizations</p>
                                <ul className="text-zinc-400 text-xs space-y-1 list-disc list-inside">
                                    <li>Shortening trials from 30 days to 7 days aligns payment with Round completion and reduces free-only usage.</li>
                                    <li>Strong retention (78% stay once they pay) gives us confidence that improving trial conversion directly compounds revenue.</li>
                                    <li>Increasing Round launch cadence in 2026 lets us repeat and scale high-performing Rounds instead of one-off spikes.</li>
                                </ul>
                            </div>
                        </div>
                        
                        {/* Target Model */}
                        <div className="bg-zinc-800/50 rounded-xl p-6 border border-[#E0FE10]/30">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                                <h4 className="text-[#E0FE10] font-medium">Target Model (Post-Optimization)</h4>
                            </div>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-zinc-400">Revenue/Round</span>
                                    <span className="text-white font-medium">$2,080</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-400">Target Seekers/Round</span>
                                    <span className="text-white font-medium">50</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-400">LTV/Creator (2 Rounds)</span>
                                    <span className="text-[#E0FE10] font-medium">$4,080</span>
                                </div>
                            </div>
                            <div className="mt-4 p-3 bg-zinc-900/50 rounded-lg">
                                <p className="text-zinc-500 text-xs">
                                    Requires: AI-powered Round creation (built), retargeting system (in development), optimized trial-to-paid conversion, creator audience building tools.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* LTV Math Callout */}
                    <div className="bg-zinc-900/60 rounded-xl p-5 mb-8 border border-zinc-800">
                        <h4 className="text-white font-medium mb-3">How we get to ≈$2K LTV per creator</h4>
                        <ol className="text-zinc-400 text-xs space-y-1 list-decimal list-inside">
                            <li>
                                ≈55 seekers per Round × 18% trial → paid ≈{' '}
                                <span className="text-white font-medium">10 long-term subscribers</span>.
                            </li>
                            <li>
                                Paying user LTV, with 78% retention over time, is modeled at about{' '}
                                <span className="text-white font-medium">$200 per subscriber</span>.
                            </li>
                            <li>
                                10 subscribers × $200 LTV ≈{' '}
                                <span className="text-[#E0FE10] font-semibold">$2,000+ annual LTV per creator</span>.
                            </li>
                        </ol>
                    </div>
                    
                    {/* The Gap Explanation */}
                    <div className="bg-gradient-to-r from-blue-500/10 to-[#E0FE10]/10 rounded-xl p-6 mb-8 border border-zinc-700">
                        <h4 className="text-white font-medium mb-3">Bridging the Gap: Current → Target</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="bg-zinc-900/50 rounded-lg p-4">
                                <p className="text-[#E0FE10] font-medium mb-1">1. Round Creation Speed</p>
                                <p className="text-zinc-400 text-xs">AI templating reduces creation from 45min → 5min. More Rounds = more revenue events.</p>
                            </div>
                            <div className="bg-zinc-900/50 rounded-lg p-4">
                                <p className="text-[#E0FE10] font-medium mb-1">2. Seeker Retargeting</p>
                                <p className="text-zinc-400 text-xs">Post-Round re-engagement to drive annual subscriptions. Currently no system exists.</p>
                            </div>
                            <div className="bg-zinc-900/50 rounded-lg p-4">
                                <p className="text-[#E0FE10] font-medium mb-1">3. Trial Optimization ✓</p>
                                <p className="text-zinc-400 text-xs">Already shifted from 30-day → 7-day trial. Previously, users would complete a Round then cancel before paying.</p>
                            </div>
                        </div>
                    </div>

                    {/* 2026 Focus Card */}
                    <div className="bg-zinc-900/60 rounded-xl border border-zinc-800 p-6 mb-8">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-yellow-300 text-xl">⚡</span>
                            <h4 className="text-white font-medium">2026: Turning Rounds into Predictable Revenue</h4>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-zinc-100 text-sm italic border-l-2 border-zinc-700 pl-3">
                                    “2026 will be our first year of consistent Round cadence, which should smooth revenue from spikes into predictable monthly growth.”
                                </p>
                                <p className="text-zinc-400 text-sm mt-1">
                                    This makes clear our path to a <span className="italic">stable subscription business</span> instead of one-off spikes.
                                </p>
                            </div>
                            <div>
                                <p className="text-zinc-100 text-sm italic border-l-2 border-zinc-700 pl-3">
                                    “While revenue paused, engagement, retention, and sharability increased — signaling that the engine improves as we refine it.”
                                </p>
                                <p className="text-zinc-400 text-sm mt-1">
                                    We’re explicitly orienting 2026 around <span className="italic">leading indicators</span> (Rounds, engagement, retention) that compound into revenue as optimization lands.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Conservative Projections */}
                    <h4 className="text-white font-medium mb-4">Conservative Growth Projections</h4>
                    <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
                        <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-zinc-700">
                            <th className="py-4 px-6 text-zinc-400 font-medium">Metric</th>
                            <th className="py-4 px-6 text-zinc-400 font-medium">2026</th>
                            <th className="py-4 px-6 text-zinc-400 font-medium">2027</th>
                            <th className="py-4 px-6 text-zinc-400 font-medium">2028</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-zinc-700">
                            <td className="py-4 px-6 text-white">Active Creators</td>
                            <td className="py-4 px-6 text-white">50</td>
                            <td className="py-4 px-6 text-white">200</td>
                            <td className="py-4 px-6 text-white">750</td>
                            </tr>
                            <tr className="border-b border-zinc-700">
                            <td className="py-4 px-6 text-white">Avg Seekers/Round</td>
                            <td className="py-4 px-6 text-white">25</td>
                            <td className="py-4 px-6 text-white">35</td>
                            <td className="py-4 px-6 text-white">50</td>
                            </tr>
                            <tr className="border-b border-zinc-700">
                            <td className="py-4 px-6 text-white">Revenue/Creator</td>
                            <td className="py-4 px-6 text-white">$1,080</td>
                            <td className="py-4 px-6 text-white">$1,480</td>
                            <td className="py-4 px-6 text-white">$2,080</td>
                            </tr>
                            <tr className="border-b border-zinc-700 bg-zinc-800/30">
                            <td className="py-4 px-6 text-[#E0FE10] font-medium">Annual Revenue</td>
                            <td className="py-4 px-6 text-[#E0FE10] font-bold">$108K</td>
                            <td className="py-4 px-6 text-[#E0FE10] font-bold">$592K</td>
                            <td className="py-4 px-6 text-[#E0FE10] font-bold">$3.1M</td>
                            </tr>
                        </tbody>
                        </table>
                    </div>
                    
                    <p className="text-zinc-500 text-sm mt-4 italic">
                        Conservative model assumes gradual improvement in seekers/Round as optimization work ships. Revenue/Creator calculated at $80 creator + (seekers × $40 × 50% annual conversion).
                    </p>
                    </div>
                    
                    {/* Key Revenue Insights */}
                    <div className="bg-gradient-to-r from-[#E0FE10]/10 to-[#E0FE10]/5 border border-[#E0FE10]/20 rounded-xl p-6 mt-10 mb-10">
                        <h4 className="text-[#E0FE10] font-semibold mb-4">💡 Key Revenue Insights</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h5 className="text-white font-medium mb-2">Strong Annual Preference</h5>
                            <p className="text-zinc-300 text-sm">
                            56% of subscribers choose annual plans, indicating high confidence in the platform 
                            and providing better cash flow predictability.
                            </p>
                        </div>
                        <div>
                            <h5 className="text-white font-medium mb-2">Creator-Driven Growth</h5>
                            <p className="text-zinc-300 text-sm">
                            Each creator brings an average of 37.5 users, with 18% converting to paid subscriptions—
                            creating a scalable, low-CAC growth engine.
                            </p>
                        </div>
                        </div>
                    </div>

                    {/* Financial Documents */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                        <h3 className="text-white text-xl font-semibold mb-1">Financial Documents</h3>
                        <p className="text-zinc-400 text-sm mb-6">
                            Download verified bank statements, financial summaries, and revenue reports.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* 2025 Statements */}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsBank2025ModalOpen(true);
                                    setSelectedBank2025Months(bankStatements2025.map(r => r.id));
                                }}
                                className="flex items-center gap-4 p-4 bg-zinc-800/70 rounded-lg hover:bg-zinc-800 transition-colors group text-left"
                            >
                                <div className="w-12 h-12 rounded-lg bg-[#E0FE10]/10 flex items-center justify-center group-hover:bg-[#E0FE10]/20 transition-colors">
                                    <Download className="w-6 h-6 text-[#E0FE10]" />
                                </div>
                                <div>
                                    <p className="text-white font-medium">2025 Bank Statements</p>
                                    <p className="text-zinc-500 text-sm">Select months to download</p>
                                </div>
                            </button>
                            
                            {/* 2024 Statements */}
                            <button
                                type="button"
                                onClick={() => setIsBank2024ModalOpen(true)}
                                className="flex items-center gap-4 p-4 bg-zinc-800/70 rounded-lg hover:bg-zinc-800 transition-colors group text-left"
                            >
                                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                    <Download className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-white font-medium">2024 Bank Statements</p>
                                    <p className="text-zinc-500 text-sm">Available by request</p>
                                </div>
                            </button>
                            
                            {/* Revenue Reports (CSV) */}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsRevenueModalOpen(true);
                                    setSelectedRevenueMonths(revenueReports.map(r => r.id));
                                }}
                                className="flex items-center gap-4 p-4 bg-zinc-800/70 rounded-lg hover:bg-zinc-800 transition-colors group text-left"
                            >
                                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                                    <Download className="w-6 h-6 text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-white font-medium">Revenue Reports (CSV)</p>
                                    <p className="text-zinc-500 text-sm">Monthly subscription revenue</p>
                                </div>
                            </button>
                            
                            {/* Profit & Loss */}
                            <button
                                type="button"
                                onClick={() => setIsPLModalOpen(true)}
                                className="flex items-center gap-4 p-4 bg-zinc-800/70 rounded-lg hover:bg-zinc-800 transition-colors group text-left"
                            >
                                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                                    <Download className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-white font-medium">Profit & Loss Statement</p>
                                    <p className="text-zinc-500 text-sm">Income statement</p>
                                </div>
                            </button>
                            
                            {/* Balance Sheet */}
                            <button
                                type="button"
                                onClick={() => setIsBalanceSheetModalOpen(true)}
                                className="flex items-center gap-4 p-4 bg-zinc-800/70 rounded-lg hover:bg-zinc-800 transition-colors group text-left"
                            >
                                <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                                    <Download className="w-6 h-6 text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-white font-medium">Balance Sheet</p>
                                    <p className="text-zinc-500 text-sm">Assets & liabilities</p>
                                </div>
                            </button>
                        </div>
                        
                        <p className="text-zinc-500 text-xs mt-4">
                            📋 These documents contain sensitive financial information. By downloading, you agree to maintain confidentiality.
                        </p>
                    </div>

                    {/* Revenue Reports Modal */}
                    {isRevenueModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="text-white text-lg font-semibold">Revenue Reports (CSV)</h4>
                                        <p className="text-zinc-400 text-xs mt-1">
                                            Select the months you’d like to download. Each file shows subscription revenue for that month.
                                        </p>
                                    </div>
                                </div>

                                <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 mb-4">
                                    <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 text-xs text-zinc-400">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedRevenueMonths(revenueReports.map(r => r.id))}
                                            className="hover:text-[#E0FE10] transition-colors"
                                        >
                                            Select all
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedRevenueMonths([])}
                                            className="hover:text-[#E0FE10] transition-colors"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                    <ul className="divide-y divide-zinc-800 text-sm">
                                        {revenueReports.map(report => {
                                            const checked = selectedRevenueMonths.includes(report.id);
                                            return (
                                                <li
                                                    key={report.id}
                                                    className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-zinc-900/70"
                                                    onClick={() => toggleRevenueMonth(report.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                                                                checked
                                                                    ? 'border-[#E0FE10] bg-[#E0FE10]/20 text-[#E0FE10]'
                                                                    : 'border-zinc-600 text-transparent'
                                                            }`}
                                                        >
                                                            ✓
                                                        </div>
                                                        <span className="text-white">{report.label}</span>
                                                    </div>
                                                    <span className="text-zinc-500 text-xs">Subscription revenue</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsRevenueModalOpen(false)}
                                        className="px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDownloadSelectedRevenueReports}
                                        disabled={!selectedRevenueMonths.length}
                                        className="px-4 py-2 rounded-lg bg-[#E0FE10] text-sm font-semibold text-black hover:bg-[#d8f521] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download selected
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2025 Bank Statements Modal */}
                    {isBank2025ModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="text-white text-lg font-semibold">2025 Bank Statements</h4>
                                        <p className="text-zinc-400 text-xs mt-1">
                                            Select the 2025 statement months you’d like to download. Each file is a full bank PDF export.
                                        </p>
                                    </div>
                                </div>

                                <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 mb-4">
                                    <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 text-xs text-zinc-400">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedBank2025Months(bankStatements2025.map(r => r.id))}
                                            className="hover:text-[#E0FE10] transition-colors"
                                        >
                                            Select all
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedBank2025Months([])}
                                            className="hover:text-[#E0FE10] transition-colors"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                    <ul className="divide-y divide-zinc-800 text-sm">
                                        {bankStatements2025.map(report => {
                                            const checked = selectedBank2025Months.includes(report.id);
                                            return (
                                                <li
                                                    key={report.id}
                                                    className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-zinc-900/70"
                                                    onClick={() => toggleBank2025Month(report.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                                                                checked
                                                                    ? 'border-[#E0FE10] bg-[#E0FE10]/20 text-[#E0FE10]'
                                                                    : 'border-zinc-600 text-transparent'
                                                            }`}
                                                        >
                                                            ✓
                                                        </div>
                                                        <span className="text-white">{report.label}</span>
                                                    </div>
                                                    <span className="text-zinc-500 text-xs">Bank statement PDF</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsBank2025ModalOpen(false)}
                                        className="px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDownloadSelectedBankStatements2025}
                                        disabled={!selectedBank2025Months.length}
                                        className="px-4 py-2 rounded-lg bg-[#E0FE10] text-sm font-semibold text-black hover:bg-[#d8f521] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download selected
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2024 Bank Statements Info Modal */}
                    {isBank2024ModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6">
                                <h4 className="text-white text-lg font-semibold mb-2">2024 Bank Statements</h4>
                                <p className="text-zinc-300 text-sm mb-3">
                                    Our 2024 bank statements are available on request to active investors and diligence partners.
                                </p>
                                <p className="text-zinc-400 text-xs mb-5">
                                    To receive copies of the 2024 PDFs, email us and we’ll share a secure link with you.
                                </p>

                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsBank2024ModalOpen(false)}
                                        className="px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
                                    >
                                        Close
                                    </button>
                                    <a
                                        href="mailto:invest@fitwithpulse.ai?subject=2024%20Bank%20Statements%20Request&body=Hi%20Pulse%20team%2C%0A%0AI%27d%20like%20to%20review%20the%202024%20bank%20statements%20for%20my%20diligence.%0A%0AThank%20you%2C%0A[Your%20Name]"
                                        className="px-4 py-2 rounded-lg bg-[#E0FE10] text-sm font-semibold text-black hover:bg-[#d8f521] transition-colors flex items-center"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Request via email
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Month-by-month revenue table modal */}
                    {isMonthlyTableOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="text-white text-lg font-semibold">Monthly Revenue — {monthlyTableYear}</h4>
                                        <p className="text-zinc-400 text-xs mt-1">
                                            Quick month-by-month view of subscription revenue. All numbers are in USD.
                                        </p>
                                    </div>
                                    <div className="flex items-center bg-zinc-800 rounded-lg overflow-hidden text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setMonthlyTableYear('2025')}
                                            className={`px-3 py-1.5 font-medium transition-colors ${
                                                monthlyTableYear === '2025' ? 'bg-[#E0FE10] text-black' : 'text-zinc-400 hover:text-white'
                                            }`}
                                        >
                                            2025
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMonthlyTableYear('2024')}
                                            className={`px-3 py-1.5 font-medium transition-colors ${
                                                monthlyTableYear === '2024' ? 'bg-[#E0FE10] text-black' : 'text-zinc-400 hover:text-white'
                                            }`}
                                        >
                                            2024
                                        </button>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-zinc-800 overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-zinc-900/80 border-b border-zinc-800">
                                            <tr>
                                                <th className="text-left px-4 py-2 text-zinc-400 font-medium">Month</th>
                                                <th className="text-right px-4 py-2 text-zinc-400 font-medium">Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(monthlyTableYear === '2025' ? monthlyRevenue2025 : monthlyRevenue2024).map(row => (
                                                <tr key={`${monthlyTableYear}-${row.month}`} className="border-b border-zinc-800/70">
                                                    <td className="px-4 py-2 text-white">{row.label}</td>
                                                    <td className="px-4 py-2 text-right text-zinc-100">
                                                        {row.value === 0 ? (
                                                            <span className="text-zinc-500 italic">In progress</span>
                                                        ) : (
                                                            `$${row.value.toLocaleString()}`
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex justify-end mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsMonthlyTableOpen(false)}
                                        className="px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Profit & Loss modal */}
                    {isPLModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-3xl w-full p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="text-white text-lg font-semibold">
                                            {activePLYear} Profit &amp; Loss {activePLYear === '2025' ? '(Jan–Nov)' : '(Full Year)'}
                                        </h4>
                                        <p className="text-zinc-400 text-xs mt-1">
                                            High-level P&amp;L for {activePLYear} subscription revenue. All amounts in USD.
                                        </p>
                                    </div>
                                    <a
                                        href="/investor-docs/profit-loss-statement.pdf"
                                        download
                                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#E0FE10] text-xs font-semibold text-black hover:bg-[#d8f521] transition-colors"
                                    >
                                        <Download className="w-3 h-3 mr-1" />
                                        Download PDF
                                    </a>
                                </div>

                                {/* Year tabs */}
                                <div className="flex gap-2 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setActivePLYear('2025')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            activePLYear === '2025'
                                                ? 'bg-[#E0FE10] text-black'
                                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                        }`}
                                    >
                                        2025
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActivePLYear('2024')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            activePLYear === '2024'
                                                ? 'bg-[#E0FE10] text-black'
                                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                        }`}
                                    >
                                        2024
                                    </button>
                                </div>

                                {/* Summary cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-xs">
                                    <div className="bg-zinc-800/60 rounded-lg p-3">
                                        <p className="text-zinc-400 mb-1">
                                            Total Revenue {activePLYear === '2025' ? '(Jan–Nov)' : '(Full Year)'}
                                        </p>
                                        <p className="text-[#E0FE10] text-lg font-bold">{formatCurrency(activePLTotals.revenue)}</p>
                                    </div>
                                    <div className="bg-zinc-800/60 rounded-lg p-3">
                                        <p className="text-zinc-400 mb-1">Total Expenses</p>
                                        <p className="text-zinc-100 text-lg font-bold">{formatCurrency(activePLTotals.total)}</p>
                                    </div>
                                    <div className="bg-zinc-800/60 rounded-lg p-3">
                                        <p className="text-zinc-400 mb-1">Net Income</p>
                                        <p
                                            className={`text-lg font-bold ${
                                                activePLTotals.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                                            }`}
                                        >
                                            {formatCurrency(activePLTotals.net)}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-zinc-800 overflow-hidden max-h-80 overflow-y-auto text-xs">
                                    <table className="w-full">
                                        <thead className="bg-zinc-900/80 border-b border-zinc-800">
                                            <tr>
                                                <th className="text-left px-3 py-2 text-zinc-400 font-medium">Month</th>
                                                <th className="text-right px-3 py-2 text-zinc-400 font-medium">Revenue</th>
                                                <th className="text-right px-3 py-2 text-zinc-400 font-medium">
                                                    Recurring&nbsp;Expenses
                                                </th>
                                                <th className="text-right px-3 py-2 text-zinc-400 font-medium">
                                                    One-off&nbsp;Expenses
                                                </th>
                                                <th className="text-right px-3 py-2 text-zinc-400 font-medium">Total Expenses</th>
                                                <th className="text-right px-3 py-2 text-zinc-400 font-medium">Net Income</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activePLData.map(row => (
                                                <tr key={row.month} className="border-b border-zinc-800/70">
                                                    <td className="px-3 py-2 text-white">{row.month}</td>
                                                    <td className="px-3 py-2 text-right text-zinc-100">
                                                        {formatCurrency(row.revenue)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-zinc-100">
                                                        {formatCurrency(row.recurring)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-zinc-100">
                                                        {formatCurrency(row.oneOff)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-zinc-100">
                                                        {formatCurrency(row.total)}
                                                    </td>
                                                    <td
                                                        className={`px-3 py-2 text-right font-semibold ${
                                                            row.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                                                        }`}
                                                    >
                                                        {formatCurrency(row.net)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex justify-end mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsPLModalOpen(false)}
                                        className="px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Balance Sheet Modal */}
                    {isBalanceSheetModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="text-white text-lg font-semibold">
                                            {activeBalanceSheetYear} Balance Sheet
                                        </h4>
                                        <p className="text-zinc-400 text-xs mt-1">
                                            Assets, liabilities, and owner&apos;s equity as of {activeBalanceSheetYear}. All amounts in USD.
                                        </p>
                                    </div>
                                    <a
                                        href="/investor-docs/balance-sheet.pdf"
                                        download
                                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#E0FE10] text-xs font-semibold text-black hover:bg-[#d8f521] transition-colors"
                                    >
                                        <Download className="w-3 h-3 mr-1" />
                                        Download PDF
                                    </a>
                                </div>

                                {/* Year tabs */}
                                <div className="flex gap-2 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setActiveBalanceSheetYear('2025')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            activeBalanceSheetYear === '2025'
                                                ? 'bg-[#E0FE10] text-black'
                                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                        }`}
                                    >
                                        2025
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveBalanceSheetYear('2024')}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            activeBalanceSheetYear === '2024'
                                                ? 'bg-[#E0FE10] text-black'
                                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                        }`}
                                    >
                                        2024
                                    </button>
                                </div>

                                {/* Summary cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-xs">
                                    <div className="bg-zinc-800/60 rounded-lg p-3">
                                        <p className="text-zinc-400 mb-1">Total Assets</p>
                                        <p className="text-[#E0FE10] text-lg font-bold">
                                            {formatCurrency(getBalanceSheetValue(balanceSheetData.assets.totalAssets))}
                                        </p>
                                    </div>
                                    <div className="bg-zinc-800/60 rounded-lg p-3">
                                        <p className="text-zinc-400 mb-1">Total Liabilities</p>
                                        <p className="text-zinc-100 text-lg font-bold">
                                            {formatCurrency(
                                                getBalanceSheetValue(balanceSheetData.liabilities.totalCurrentLiabilities) +
                                                getBalanceSheetValue(balanceSheetData.liabilities.totalLongTermLiabilities)
                                            )}
                                        </p>
                                    </div>
                                    <div className="bg-zinc-800/60 rounded-lg p-3">
                                        <p className="text-zinc-400 mb-1">Owner&apos;s Equity</p>
                                        <p
                                            className={`text-lg font-bold ${
                                                getBalanceSheetValue(balanceSheetData.ownersEquity.totalOwnersEquity) >= 0
                                                    ? 'text-emerald-400'
                                                    : 'text-red-400'
                                            }`}
                                        >
                                            {formatCurrency(getBalanceSheetValue(balanceSheetData.ownersEquity.totalOwnersEquity))}
                                        </p>
                                    </div>
                                </div>

                                {/* Balance Sheet Table */}
                                <div className="rounded-lg border border-zinc-800 overflow-hidden text-xs">
                                    <table className="w-full">
                                        <thead className="bg-zinc-900/80 border-b border-zinc-800">
                                            <tr>
                                                <th className="text-left px-3 py-2 text-zinc-400 font-medium">Account</th>
                                                <th className="text-right px-3 py-2 text-zinc-400 font-medium">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Assets Section */}
                                            <tr className="bg-zinc-800/40">
                                                <td colSpan={2} className="px-3 py-2 text-white font-semibold">Assets</td>
                                            </tr>
                                            <tr className="bg-zinc-800/20">
                                                <td colSpan={2} className="px-3 py-1.5 text-zinc-300 font-medium text-[11px]">Current Assets</td>
                                            </tr>
                                            {balanceSheetData.assets.currentAssets.map(item => (
                                                <tr key={item.account} className="border-b border-zinc-800/50">
                                                    <td className="px-3 py-1.5 text-zinc-400 pl-6">{item.account}</td>
                                                    <td className="px-3 py-1.5 text-right text-zinc-100">
                                                        {formatCurrency(getBalanceSheetValue(item))}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="border-b border-zinc-800 bg-zinc-800/30">
                                                <td className="px-3 py-1.5 text-zinc-200 font-medium pl-4">Total Current Assets</td>
                                                <td className="px-3 py-1.5 text-right text-zinc-100 font-medium">
                                                    {formatCurrency(getBalanceSheetValue(balanceSheetData.assets.totalCurrentAssets))}
                                                </td>
                                            </tr>

                                            <tr className="bg-zinc-800/20">
                                                <td colSpan={2} className="px-3 py-1.5 text-zinc-300 font-medium text-[11px]">Fixed Assets</td>
                                            </tr>
                                            {balanceSheetData.assets.fixedAssets.map(item => (
                                                <tr key={item.account} className="border-b border-zinc-800/50">
                                                    <td className="px-3 py-1.5 text-zinc-400 pl-6">{item.account}</td>
                                                    <td className="px-3 py-1.5 text-right text-zinc-100">
                                                        {formatCurrency(getBalanceSheetValue(item))}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="border-b border-zinc-800 bg-zinc-800/30">
                                                <td className="px-3 py-1.5 text-zinc-200 font-medium pl-4">Total Fixed Assets</td>
                                                <td className="px-3 py-1.5 text-right text-zinc-100 font-medium">
                                                    {formatCurrency(getBalanceSheetValue(balanceSheetData.assets.totalFixedAssets))}
                                                </td>
                                            </tr>

                                            <tr className="bg-zinc-800/20">
                                                <td colSpan={2} className="px-3 py-1.5 text-zinc-300 font-medium text-[11px]">Other Assets</td>
                                            </tr>
                                            {balanceSheetData.assets.otherAssets.map(item => (
                                                <tr key={item.account} className="border-b border-zinc-800/50">
                                                    <td className="px-3 py-1.5 text-zinc-400 pl-6">{item.account}</td>
                                                    <td className="px-3 py-1.5 text-right text-zinc-100">
                                                        {formatCurrency(getBalanceSheetValue(item))}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="border-b border-zinc-800 bg-zinc-800/30">
                                                <td className="px-3 py-1.5 text-zinc-200 font-medium pl-4">Total Other Assets</td>
                                                <td className="px-3 py-1.5 text-right text-zinc-100 font-medium">
                                                    {formatCurrency(getBalanceSheetValue(balanceSheetData.assets.totalOtherAssets))}
                                                </td>
                                            </tr>

                                            <tr className="border-b border-zinc-700 bg-emerald-500/10">
                                                <td className="px-3 py-2 text-white font-semibold">Total Assets</td>
                                                <td className="px-3 py-2 text-right text-[#E0FE10] font-bold">
                                                    {formatCurrency(getBalanceSheetValue(balanceSheetData.assets.totalAssets))}
                                                </td>
                                            </tr>

                                            {/* Liabilities Section */}
                                            <tr className="bg-zinc-800/40">
                                                <td colSpan={2} className="px-3 py-2 text-white font-semibold">Liabilities</td>
                                            </tr>
                                            <tr className="bg-zinc-800/20">
                                                <td colSpan={2} className="px-3 py-1.5 text-zinc-300 font-medium text-[11px]">Current Liabilities</td>
                                            </tr>
                                            {balanceSheetData.liabilities.currentLiabilities.map(item => (
                                                <tr key={item.account} className="border-b border-zinc-800/50">
                                                    <td className="px-3 py-1.5 text-zinc-400 pl-6">{item.account}</td>
                                                    <td className="px-3 py-1.5 text-right text-zinc-100">
                                                        {formatCurrency(getBalanceSheetValue(item))}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="border-b border-zinc-800 bg-zinc-800/30">
                                                <td className="px-3 py-1.5 text-zinc-200 font-medium pl-4">Total Current Liabilities</td>
                                                <td className="px-3 py-1.5 text-right text-zinc-100 font-medium">
                                                    {formatCurrency(getBalanceSheetValue(balanceSheetData.liabilities.totalCurrentLiabilities))}
                                                </td>
                                            </tr>

                                            <tr className="bg-zinc-800/20">
                                                <td colSpan={2} className="px-3 py-1.5 text-zinc-300 font-medium text-[11px]">Long-Term Liabilities</td>
                                            </tr>
                                            {balanceSheetData.liabilities.longTermLiabilities.map(item => (
                                                <tr key={item.account} className="border-b border-zinc-800/50">
                                                    <td className="px-3 py-1.5 text-zinc-400 pl-6">{item.account}</td>
                                                    <td className="px-3 py-1.5 text-right text-zinc-100">
                                                        {formatCurrency(getBalanceSheetValue(item))}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="border-b border-zinc-800 bg-zinc-800/30">
                                                <td className="px-3 py-1.5 text-zinc-200 font-medium pl-4">Total Long-Term Liabilities</td>
                                                <td className="px-3 py-1.5 text-right text-zinc-100 font-medium">
                                                    {formatCurrency(getBalanceSheetValue(balanceSheetData.liabilities.totalLongTermLiabilities))}
                                                </td>
                                            </tr>

                                            {/* Owner's Equity Section */}
                                            <tr className="bg-zinc-800/40">
                                                <td colSpan={2} className="px-3 py-2 text-white font-semibold">Owner&apos;s Equity</td>
                                            </tr>
                                            {balanceSheetData.ownersEquity.items.map(item => (
                                                <tr key={item.account} className="border-b border-zinc-800/50">
                                                    <td className="px-3 py-1.5 text-zinc-400 pl-6">{item.account}</td>
                                                    <td className={`px-3 py-1.5 text-right ${
                                                        getBalanceSheetValue(item) < 0 ? 'text-red-400' : 'text-zinc-100'
                                                    }`}>
                                                        {formatCurrency(getBalanceSheetValue(item))}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="border-b border-zinc-800 bg-zinc-800/30">
                                                <td className="px-3 py-1.5 text-zinc-200 font-medium pl-4">Total Owner&apos;s Equity</td>
                                                <td className={`px-3 py-1.5 text-right font-medium ${
                                                    getBalanceSheetValue(balanceSheetData.ownersEquity.totalOwnersEquity) < 0
                                                        ? 'text-red-400'
                                                        : 'text-zinc-100'
                                                }`}>
                                                    {formatCurrency(getBalanceSheetValue(balanceSheetData.ownersEquity.totalOwnersEquity))}
                                                </td>
                                            </tr>

                                            {/* Total Liabilities and Equity */}
                                            <tr className="bg-amber-500/10">
                                                <td className="px-3 py-2 text-white font-semibold">Total Liabilities &amp; Owner&apos;s Equity</td>
                                                <td className={`px-3 py-2 text-right font-bold ${
                                                    getBalanceSheetValue(balanceSheetData.totalLiabilitiesAndEquity) >= 0
                                                        ? 'text-[#E0FE10]'
                                                        : 'text-red-400'
                                                }`}>
                                                    {formatCurrency(getBalanceSheetValue(balanceSheetData.totalLiabilitiesAndEquity))}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex justify-end mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsBalanceSheetModalOpen(false)}
                                        className="px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    <h3 className="text-white text-xl font-semibold mb-6">Why Invest in Pulse?</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                        <div className="relative bg-zinc-900 rounded-lg p-5 h-full">
                            <h4 className="text-[#E0FE10] font-medium mb-2">Validated Product-Market Fit</h4>
                            <p className="text-zinc-400 text-sm">78% retention, 18% conversion—users pay and stay.</p>
                        </div>
                        </div>
                        
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                        <div className="relative bg-zinc-900 rounded-lg p-5 h-full">
                            <h4 className="text-[#E0FE10] font-medium mb-2">Creator Flywheel</h4>
                            <p className="text-zinc-400 text-sm">Each creator brings 37.5x users. Zero paid acquisition.</p>
                        </div>
                        </div>
                        
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                        <div className="relative bg-zinc-900 rounded-lg p-5 h-full">
                            <h4 className="text-[#E0FE10] font-medium mb-2">Technical Founder</h4>
                            <p className="text-zinc-400 text-sm">Solo-built iOS + web platform. Capital efficient.</p>
                        </div>
                        </div>
                        
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                        <div className="relative bg-zinc-900 rounded-lg p-5 h-full">
                            <h4 className="text-[#E0FE10] font-medium mb-2">$120B+ Market</h4>
                            <p className="text-zinc-400 text-sm">Social-first approach in a fragmented fitness market.</p>
                        </div>
                        </div>
                    </div>
                    
                    <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                        <a href="https://calendly.com/tre-aqo7/30min" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center px-8 py-4 bg-[#E0FE10] hover:bg-[#d8f521] text-black font-bold rounded-lg transition-colors text-center">
                        Schedule Investor Meeting
                        </a>
                        <a href="mailto:invest@fitwithpulse.ai?subject=Request%20for%20Due%20Diligence%20Access&body=Hi%2C%20Pulse%20investment%20Team%2C%0A%0AI%20am%20interested%20in%20learning%20more%20about%20Pulse%20and%20would%20like%20to%20request%20access%20to%20your%20due%20diligence%20materials.%0A%0APlease%20provide%20me%20with%20access%20to%3A%0A-%20Detailed%20financial%20statements%0A-%20Legal%20documents%20and%20cap%20table%0A-%20Product%20roadmap%20and%20technical%20documentation%0A-%20Customer%20references%20and%20case%20studies%0A-%20Any%20additional%20materials%20relevant%20for%20investment%20evaluation%0A%0AThank%20you%20for%20your%20time%20and%20consideration.%0A%0ABest%20regards%2C%0A[Your%20Name]" className="inline-flex items-center justify-center px-8 py-4 border border-zinc-700 hover:border-[#E0FE10] text-white font-medium rounded-lg transition-colors text-center">
                        Request Due Diligence Access
                        </a>
                    </div>
                    </div>
                </section>
                  ) : (
                    <LockedSectionView sectionName="Financials" />
                  )
                )}

                {/* Cap Table Section */}
                {activeSection === 'captable' && (
                  hasSectionAccess('captable') ? (
                <section 
                    id="captable" 
                    ref={(el) => { sectionsRef.current.captable = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-6">
                        <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                            <span className="font-bold text-black">10</span>
                        </div>
                        <h2 className="text-white text-3xl font-bold">Cap Table</h2>
                    </div>

                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-6">
                        <h3 className="text-white text-xl font-semibold mb-2">Pulse Intelligence Labs, Inc.</h3>
                        <p className="text-zinc-400 text-sm mb-6">Capitalization table as of incorporation</p>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                            <div className="bg-zinc-800/60 rounded-lg p-4">
                                <p className="text-zinc-400 text-xs mb-1">Authorized Shares</p>
                                <p className="text-white text-2xl font-bold">10,000,000</p>
                            </div>
                            <div className="bg-zinc-800/60 rounded-lg p-4">
                                <p className="text-zinc-400 text-xs mb-1">Issued & Outstanding</p>
                                <p className="text-[#E0FE10] text-2xl font-bold">9,000,000</p>
                            </div>
                            <div className="bg-zinc-800/60 rounded-lg p-4">
                                <p className="text-zinc-400 text-xs mb-1">Unissued (Equity Pool)</p>
                                <p className="text-zinc-300 text-2xl font-bold">1,000,000</p>
                            </div>
                        </div>

                        {/* Cap Table */}
                        <div className="rounded-lg border border-zinc-800 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-zinc-800/80">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-zinc-400 font-medium">Shareholder</th>
                                        <th className="text-right px-4 py-3 text-zinc-400 font-medium">Shares</th>
                                        <th className="text-right px-4 py-3 text-zinc-400 font-medium">Ownership</th>
                                        <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden sm:table-cell">Vesting</th>
                                        <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden md:table-cell">Cliff</th>
                                        <th className="text-left px-4 py-3 text-zinc-400 font-medium hidden lg:table-cell">Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-t border-zinc-800">
                                        <td className="px-4 py-3">
                                            <p className="text-white font-medium">Tremaine Grant</p>
                                            <p className="text-zinc-500 text-xs">Founder</p>
                                        </td>
                                        <td className="px-4 py-3 text-right text-zinc-100">9,000,000</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-[#E0FE10] font-semibold">90%</span>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-300 hidden sm:table-cell">4 years</td>
                                        <td className="px-4 py-3 text-zinc-300 hidden md:table-cell">1 year</td>
                                        <td className="px-4 py-3 text-zinc-400 text-xs hidden lg:table-cell">Double-trigger acceleration</td>
                                    </tr>
                                    <tr className="border-t border-zinc-800 bg-zinc-800/30">
                                        <td className="px-4 py-3">
                                            <p className="text-zinc-300 font-medium">Employee Equity Pool</p>
                                            <p className="text-zinc-500 text-xs">Unissued / Reserved</p>
                                        </td>
                                        <td className="px-4 py-3 text-right text-zinc-400">1,000,000</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-zinc-400 font-semibold">10%</span>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">—</td>
                                        <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">—</td>
                                        <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">Reserved for future hires (ESOP)</td>
                                    </tr>
                                    <tr className="border-t-2 border-zinc-700 bg-zinc-800/50">
                                        <td className="px-4 py-3 text-white font-semibold">Total</td>
                                        <td className="px-4 py-3 text-right text-white font-semibold">10,000,000</td>
                                        <td className="px-4 py-3 text-right text-white font-semibold">100%</td>
                                        <td className="px-4 py-3 hidden sm:table-cell"></td>
                                        <td className="px-4 py-3 hidden md:table-cell"></td>
                                        <td className="px-4 py-3 hidden lg:table-cell"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile-only details */}
                        <div className="mt-4 sm:hidden bg-zinc-800/40 rounded-lg p-4">
                            <p className="text-zinc-400 text-xs mb-2">Founder Vesting Details:</p>
                            <p className="text-zinc-300 text-sm">4-year vesting • 1-year cliff • Double-trigger acceleration</p>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <h4 className="text-white font-semibold mb-4">Notes</h4>
                        <ul className="space-y-2 text-sm text-zinc-400">
                            <li className="flex items-start gap-2">
                                <span className="text-[#E0FE10] mt-1">•</span>
                                <span>Only the founder has issued shares at this time.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#E0FE10] mt-1">•</span>
                                <span>The 10% employee equity pool is authorized but unissued (ESOP not yet formally created).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#E0FE10] mt-1">•</span>
                                <span>Founder vesting follows standard 4-year schedule with 1-year cliff per Atlas defaults.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#E0FE10] mt-1">•</span>
                                <span>Double-trigger acceleration applies on change of control + termination.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[#E0FE10] mt-1">•</span>
                                <span>Vesting start date: Date of incorporation.</span>
                            </li>
                        </ul>
                    </div>
                </section>
                  ) : (
                    <LockedSectionView sectionName="Cap Table" />
                  )
                )}

                {/* Pitch Deck Section */}
                {activeSection === 'deck' && (
                  hasSectionAccess('deck') ? (
                <section 
                    id="deck" 
                    ref={(el) => { sectionsRef.current.deck = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">10</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">Pitch Deck</h2>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    <div className="bg-zinc-800 rounded-xl p-10 flex flex-col items-center justify-center text-center">
                        <img 
                        src="PitchDeckPreview.png" 
                        alt="Pitch Deck Preview" 
                        className="w-48 h-64 object-cover rounded-lg shadow-lg mb-6"
                        />
                        <h3 className="text-white text-xl font-semibold mb-3">Pulse Investor Presentation</h3>
                        <p className="text-zinc-400 mb-6 max-w-lg">
                        Our comprehensive investor deck includes detailed information about our market opportunity, 
                        business model, growth strategy, and financial projections.
                        </p>
                        <div className="flex flex-wrap gap-4 justify-center">
                        <a 
                            href="/PulseDeck12_9.pdf" 
                            download="PulseDeck12_9.pdf"
                            className="inline-flex items-center justify-center px-6 py-3 bg-[#E0FE10] hover:bg-[#d8f521] text-black font-medium rounded-lg transition-colors"
                        >
                            <Download className="mr-2 h-5 w-5" />
                            Download Pitch Deck (PDF)
                        </a>
                      
                        </div>
                    </div>
                    </div>
                </section>
                  ) : (
                    <LockedSectionView sectionName="Pitch Deck" />
                  )
                )}

                {/* Investment Opportunity Section */}
                {activeSection === 'investment' && (
                  hasSectionAccess('investment') ? (
                <section 
                    id="investment" 
                    ref={(el) => { sectionsRef.current.investment = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">11</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">Investment Opportunity</h2>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">                    
                    
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="md:w-1/2">
                        <h3 className="text-white text-xl font-semibold mb-4">Seed Funding Round</h3>
                        
                        <div className="space-y-6">
                            <div>
                            <p className="text-zinc-400 mb-1">Target Raise</p>
                            <p className="text-white text-3xl font-bold">$750K</p>
                            </div>
                            
                            <div>
                            <p className="text-zinc-400 mb-1">Pre-Money Valuation</p>
                            <p className="text-white text-3xl font-bold">$3.5 Million</p>
                            </div>
                            
                            <div>
                            <p className="text-zinc-400 mb-1">Minimum Investment</p>
                            <p className="text-white text-xl font-medium">$25,000</p>
                            </div>
                            
                            <div>
                            <p className="text-zinc-400 mb-1">Funding Use</p>
                            <ul className="text-white space-y-1 mt-2">
                                <li>• Creator acquisition (60%)</li>
                                <li>• Product development (25%)</li>
                                <li>• Team expansion (10%)</li>
                                <li>• Operations (5%)</li>
                            </ul>
                            </div>
                        </div>
                        </div>
                        
                        <div className="md:w-1/2">
                        <h3 className="text-white text-xl font-semibold mb-4">Fundraising Timeline</h3>
                        
                        <div className="relative pl-8 pb-8 border-l border-zinc-700">
                            <div className="absolute left-0 top-0 w-3 h-3 -ml-1.5 rounded-full bg-[#E0FE10]"></div>
                            <h4 className="text-white font-medium mb-1">Bootstrap Phase - Completed</h4>
                            <p className="text-zinc-400 text-sm mb-1">2023-2024</p>
                            <p className="text-zinc-400">$7K self-funded to build MVP and validate product-market fit</p>
                        </div>
                        
                        <div className="relative pl-8 pb-8 border-l border-zinc-700">
                            <div className="absolute left-0 top-0 w-3 h-3 -ml-1.5 rounded-full bg-[#E0FE10]"></div>
                            <h4 className="text-white font-medium mb-1">Seed Round - Current</h4>
                            <p className="text-zinc-400 text-sm mb-1">Q2 2025</p>
                            <p className="text-zinc-400">$750K to accelerate creator acquisition and scale platform</p>
                        </div>
                        
                        <div className="relative pl-8 border-l border-zinc-700">
                            <div className="absolute left-0 top-0 w-3 h-3 -ml-1.5 rounded-full bg-zinc-700"></div>
                            <h4 className="text-white font-medium mb-1">Series A - Projected</h4>
                            <p className="text-zinc-400 text-sm mb-1">Q4 2026</p>
                            <p className="text-zinc-400">Targeting $5M+ for market expansion and feature development</p>
                        </div>
                        </div>
                    </div>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    <h3 className="text-white text-xl font-semibold mb-6">Why Invest in Pulse?</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                        <div className="relative bg-zinc-900 rounded-lg p-5 h-full">
                            <h4 className="text-[#E0FE10] font-medium mb-2">Validated Product-Market Fit</h4>
                            <p className="text-zinc-400 text-sm">78% retention, 18% conversion—users pay and stay.</p>
                        </div>
                        </div>
                        
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                        <div className="relative bg-zinc-900 rounded-lg p-5 h-full">
                            <h4 className="text-[#E0FE10] font-medium mb-2">Creator Flywheel</h4>
                            <p className="text-zinc-400 text-sm">Each creator brings 37.5x users. Zero paid acquisition.</p>
                        </div>
                        </div>
                        
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                        <div className="relative bg-zinc-900 rounded-lg p-5 h-full">
                            <h4 className="text-[#E0FE10] font-medium mb-2">Technical Founder</h4>
                            <p className="text-zinc-400 text-sm">Solo-built iOS + web platform. Capital efficient.</p>
                        </div>
                        </div>
                        
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-[#d7ff00]/10"></div>
                        <div className="relative bg-zinc-900 rounded-lg p-5 h-full">
                            <h4 className="text-[#E0FE10] font-medium mb-2">$120B+ Market</h4>
                            <p className="text-zinc-400 text-sm">Social-first approach in a fragmented fitness market.</p>
                        </div>
                        </div>
                    </div>
                    
                    <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                        <a href="https://calendly.com/tre-aqo7/30min" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center px-8 py-4 bg-[#E0FE10] hover:bg-[#d8f521] text-black font-bold rounded-lg transition-colors text-center">
                        Schedule Investor Meeting
                        </a>
                        <a href="mailto:invest@fitwithpulse.ai?subject=Request%20for%20Due%20Diligence%20Access&body=Hello%20Pulse%20Team%2C%0A%0AI%20am%20interested%20in%20learning%20more%20about%20Pulse%20and%20would%20like%20to%20request%20access%20to%20your%20due%20diligence%20materials.%0A%0APlease%20provide%20me%20with%20access%20to%3A%0A-%20Detailed%20financial%20statements%0A-%20Legal%20documents%20and%20cap%20table%0A-%20Product%20roadmap%20and%20technical%20documentation%0A-%20Customer%20references%20and%20case%20studies%0A-%20Any%20additional%20materials%20relevant%20for%20investment%20evaluation%0A%0AThank%20you%20for%20your%20time%20and%20consideration.%0A%0ABest%20regards%2C%0A[Your%20Name]" className="inline-flex items-center justify-center px-8 py-4 border border-zinc-700 hover:border-[#E0FE10] text-white font-medium rounded-lg transition-colors text-center">
                        Request Due Diligence Access
                        </a>
                    </div>
                    </div>
                </section>
                  ) : (
                    <LockedSectionView sectionName="Investment Opportunity" />
                  )
                )}

                {/* All Documents Section */}
                {activeSection === 'documents' && (
                  hasSectionAccess('documents') ? (
                <section 
                    id="documents" 
                    ref={(el) => { sectionsRef.current.documents = el; }}
                    className="mb-20"
                >
                    <div className="flex items-center mb-8">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">13</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">All Documents</h2>
                    </div>
                    
                    <p className="text-zinc-400 text-lg mb-8">
                      All downloadable documents from our investor dataroom in one place.
                    </p>

                    {/* Document Categories */}
                    <div className="space-y-8">
                      {/* Pitch Materials */}
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-10 h-10 rounded-xl bg-[#E0FE10]/20 flex items-center justify-center">
                            <span className="text-xl">📊</span>
                          </div>
                          <h3 className="text-white text-xl font-semibold">Pitch Materials</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <a 
                            href="/PulseDeck12_9.pdf" 
                            download="PulseDeck12_9.pdf"
                            className="flex items-center gap-4 p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-[#E0FE10]/30 rounded-xl transition-all group"
                          >
                            <div className="w-12 h-12 rounded-lg bg-[#E0FE10]/10 flex items-center justify-center flex-shrink-0">
                              <Download className="w-5 h-5 text-[#E0FE10]" />
                            </div>
                            <div className="flex-1">
                              <div className="text-white font-medium group-hover:text-[#E0FE10] transition-colors">Pitch Deck</div>
                              <div className="text-zinc-500 text-sm">PDF • Latest Version</div>
                            </div>
                          </a>
                        </div>
                      </div>

                      {/* Legal Documents */}
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <span className="text-xl">📜</span>
                          </div>
                          <h3 className="text-white text-xl font-semibold">Legal Documents</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <a 
                            href="/PulseIntelligenceLabsCertificateofIncorporation.pdf" 
                            download
                            className="flex items-center gap-4 p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-purple-500/30 rounded-xl transition-all group"
                          >
                            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                              <Download className="w-5 h-5 text-purple-400" />
                            </div>
                            <div className="flex-1">
                              <div className="text-white font-medium group-hover:text-purple-400 transition-colors">Certificate of Incorporation</div>
                              <div className="text-zinc-500 text-sm">PDF • Delaware C-Corp</div>
                            </div>
                          </a>
                          <a 
                            href="/Founder Intellectual Property Assignment Agreement - Pulse Intelligence Labs.pdf" 
                            download="Founder-IP-Assignment-Agreement.pdf"
                            className="flex items-center gap-4 p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-purple-500/30 rounded-xl transition-all group"
                          >
                            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                              <Download className="w-5 h-5 text-purple-400" />
                            </div>
                            <div className="flex-1">
                              <div className="text-white font-medium group-hover:text-purple-400 transition-colors">IP Assignment Agreement</div>
                              <div className="text-zinc-500 text-sm">PDF • Signed Founder IP Assignment</div>
                            </div>
                          </a>
                        </div>
                      </div>

                      {/* Financial Documents */}
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <span className="text-xl">💰</span>
                          </div>
                          <h3 className="text-white text-xl font-semibold">Financial Documents</h3>
                        </div>
                        <p className="text-zinc-400 text-sm mb-4">Bank statements, P&L statements, and revenue reports are available in the <button onClick={() => switchSection('financials')} className="text-[#E0FE10] hover:underline">Financial Information</button> section with interactive viewers.</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-zinc-800/30 border border-zinc-700 rounded-xl">
                            <div className="text-white font-medium mb-1">Bank Statements</div>
                            <div className="text-zinc-500 text-sm">2024 & 2025 available</div>
                          </div>
                          <div className="p-4 bg-zinc-800/30 border border-zinc-700 rounded-xl">
                            <div className="text-white font-medium mb-1">Profit & Loss</div>
                            <div className="text-zinc-500 text-sm">2024 & 2025 data</div>
                          </div>
                          <div className="p-4 bg-zinc-800/30 border border-zinc-700 rounded-xl">
                            <div className="text-white font-medium mb-1">Balance Sheet</div>
                            <div className="text-zinc-500 text-sm">Current period</div>
                          </div>
                        </div>
                      </div>

                      {/* Revenue Reports */}
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <span className="text-xl">📈</span>
                          </div>
                          <h3 className="text-white text-xl font-semibold">Revenue Reports (CSV)</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => (
                            <a 
                              key={month}
                              href={`/financial_report_${month.slice(0, 3)}.csv`}
                              download
                              className="flex items-center gap-2 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-blue-500/30 rounded-lg transition-all group text-sm"
                            >
                              <Download className="w-4 h-4 text-blue-400 flex-shrink-0" />
                              <span className="text-zinc-300 group-hover:text-blue-400 transition-colors">{month.slice(0, 3)} 2025</span>
                            </a>
                          ))}
                        </div>
                      </div>

                      {/* Bank Statements */}
                      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                            <span className="text-xl">🏦</span>
                          </div>
                          <h3 className="text-white text-xl font-semibold">Bank Statements 2025</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <a href="/BankStatements-March25.pdf" download className="flex items-center gap-2 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-orange-500/30 rounded-lg transition-all group text-sm">
                            <Download className="w-4 h-4 text-orange-400 flex-shrink-0" />
                            <span className="text-zinc-300 group-hover:text-orange-400 transition-colors">March</span>
                          </a>
                          <a href="/BankStatements-April25.pdf" download className="flex items-center gap-2 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-orange-500/30 rounded-lg transition-all group text-sm">
                            <Download className="w-4 h-4 text-orange-400 flex-shrink-0" />
                            <span className="text-zinc-300 group-hover:text-orange-400 transition-colors">April</span>
                          </a>
                          <a href="/BankStatements-May2025.pdf" download className="flex items-center gap-2 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-orange-500/30 rounded-lg transition-all group text-sm">
                            <Download className="w-4 h-4 text-orange-400 flex-shrink-0" />
                            <span className="text-zinc-300 group-hover:text-orange-400 transition-colors">May</span>
                          </a>
                          <a href="/BankStatements-June.pdf" download className="flex items-center gap-2 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-orange-500/30 rounded-lg transition-all group text-sm">
                            <Download className="w-4 h-4 text-orange-400 flex-shrink-0" />
                            <span className="text-zinc-300 group-hover:text-orange-400 transition-colors">June</span>
                          </a>
                          <a href="/BankStatements-July.pdf" download className="flex items-center gap-2 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-orange-500/30 rounded-lg transition-all group text-sm">
                            <Download className="w-4 h-4 text-orange-400 flex-shrink-0" />
                            <span className="text-zinc-300 group-hover:text-orange-400 transition-colors">July</span>
                          </a>
                          <a href="/BankStatements-August.pdf" download className="flex items-center gap-2 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-orange-500/30 rounded-lg transition-all group text-sm">
                            <Download className="w-4 h-4 text-orange-400 flex-shrink-0" />
                            <span className="text-zinc-300 group-hover:text-orange-400 transition-colors">August</span>
                          </a>
                          <a href="/BankStatements-Sept.pdf" download className="flex items-center gap-2 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-orange-500/30 rounded-lg transition-all group text-sm">
                            <Download className="w-4 h-4 text-orange-400 flex-shrink-0" />
                            <span className="text-zinc-300 group-hover:text-orange-400 transition-colors">September</span>
                          </a>
                          <a href="/BankStatements-October.pdf" download className="flex items-center gap-2 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-orange-500/30 rounded-lg transition-all group text-sm">
                            <Download className="w-4 h-4 text-orange-400 flex-shrink-0" />
                            <span className="text-zinc-300 group-hover:text-orange-400 transition-colors">October</span>
                          </a>
                          <a href="/BankStatements-Oct-2.pdf" download className="flex items-center gap-2 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-orange-500/30 rounded-lg transition-all group text-sm">
                            <Download className="w-4 h-4 text-orange-400 flex-shrink-0" />
                            <span className="text-zinc-300 group-hover:text-orange-400 transition-colors">Oct (Mercury)</span>
                          </a>
                          <a href="/BankStatements-Novemebr.pdf" download className="flex items-center gap-2 p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-orange-500/30 rounded-lg transition-all group text-sm">
                            <Download className="w-4 h-4 text-orange-400 flex-shrink-0" />
                            <span className="text-zinc-300 group-hover:text-orange-400 transition-colors">November</span>
                          </a>
                        </div>
                      </div>

                      {/* Quick Access Note */}
                      <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/20 rounded-xl p-5 text-center">
                        <p className="text-zinc-300">
                          Need additional documents or have questions? <a href="mailto:invest@fitwithpulse.ai" className="text-[#E0FE10] hover:underline">Contact us</a>
                        </p>
                      </div>
                    </div>
                </section>
                  ) : (
                    <LockedSectionView sectionName="All Documents" />
                  )
                )}

                {/* Security & Compliance Footer */}
                <section className="py-8 bg-zinc-950 border-t border-zinc-800">
                    <div className="max-w-7xl mx-auto px-4 sm:px-8">
                    <div className="flex items-center justify-center gap-6 text-zinc-500 text-sm">
                        <span>🔒 End-to-end encryption</span>
                        <span>🛡️ Privacy by design</span>
                        <span>🔐 Data minimization</span>
                        <span>📋 Regular security audits</span>
                    </div>
                    </div>
                </section>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<InvestorDataroomPageProps> = async (context) => {
  // Determine which page ID to use based on the URL
  const isInvestRoute = context.resolvedUrl?.startsWith('/invest');
  const primaryPageId = isInvestRoute ? 'invest' : 'investor';
  const fallbackPageId = 'investor';
  
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    // Try the primary page ID first
    rawMetaData = await adminMethods.getPageMetaData(primaryPageId);
    
    // If no meta data found for 'invest', fall back to 'investor'
    if (!rawMetaData && primaryPageId !== fallbackPageId) {
      rawMetaData = await adminMethods.getPageMetaData(fallbackPageId);
    }
  } catch (error) {
    console.error(`Error fetching metaData for ${primaryPageId} page in getServerSideProps:`, error);
    
    // Try fallback if primary failed and they're different
    if (primaryPageId !== fallbackPageId) {
      try {
        rawMetaData = await adminMethods.getPageMetaData(fallbackPageId);
      } catch (fallbackError) {
        console.error(`Error fetching fallback metaData for ${fallbackPageId} page:`, fallbackError);
      }
    }
    // Fallthrough to return props with metaData: null
  }

  let serializableMetaData: SerializablePageMetaDataForInvestor | null = null;
  if (rawMetaData) {
    serializableMetaData = {
      ...rawMetaData,
      // Ensure lastUpdated is serializable, converting Timestamp to ISO string
      lastUpdated: rawMetaData.lastUpdated.toDate().toISOString(),
    };
  }
    
  return {
    props: {
      metaData: serializableMetaData,
    },
  };
};

export default InvestorDataroom;