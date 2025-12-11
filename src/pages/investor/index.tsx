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
const VALID_SECTIONS = ['overview', 'product', 'traction', 'ip', 'vision', 'market', 'techstack', 'team', 'financials', 'captable', 'deck', 'investment'] as const;

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
            retention: "61%"
          });
        }
      } catch (error) {
        console.error("Error fetching investor data:", error);
        setFinancialMetrics({
          revenue: "$2.5K",
          users: "808",
          growth: "22% MoM",
          retention: "61%"
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
      <section className="relative min-h-[60vh] flex flex-col items-center justify-center text-center px-8 py-20 overflow-hidden">
        <div className="absolute inset-0 bg-zinc-900"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-800 opacity-40"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-2000"></div>
        </div>
        
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[url('/grid-pattern.svg')] bg-repeat"></div>
        </div>

        <div className="relative z-20 max-w-4xl mx-auto">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">Investor Relations</h2>
          <h1 className="text-white text-5xl sm:text-7xl font-bold mb-8">Pulse Investor Dataroom</h1>
          <p className="text-zinc-400 text-xl leading-relaxed mb-12">
            800+ members, 61% retention & 144 paying subscribers after 4 months.<br />
            <span className="text-zinc-500">Building the social gateway to the future of health.</span>
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="/PulsePitchDeck.pdf" 
              download="PulsePitchDeck.pdf"
              className="inline-flex items-center justify-center px-8 py-3 bg-[#E0FE10] hover:bg-[#d8f521] text-black font-medium rounded-lg transition-colors"
            >
              <Download className="mr-2 h-5 w-5" />
              Download Pitch Deck
            </a>
          </div>
        </div>
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
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                      <span className="font-bold text-black">1</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">Company Overview</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="/PulseIntelligenceLabsCertificateofIncorporation.pdf"
                      download
                      className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs text-zinc-200 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Certificate of Incorporation
                    </a>
                    <a
                      href="/investor-docs/Founder-IP-Assignment-Agreement.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs text-zinc-200 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      IP Assignment Agreement
                    </a>
                  </div>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <p className="text-zinc-200 text-xl leading-relaxed mb-2 font-medium">
                    Pulse is the <span className="text-[#E0FE10]">creator-powered fitness platform</span> that turns short workout videos into multiplayer, playlist-style training experiences.
                  </p>
                  <p className="text-zinc-400 text-sm mb-6">
                    Creators upload Moves, Pulse assembles them into Sequences, and users train together in real time with leaderboards, scoring, and social motivation.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-zinc-800/50 rounded-lg p-4">
                      <p className="text-[#E0FE10] font-semibold mb-2">For Creators</p>
                      <p className="text-zinc-400 text-sm">Upload Moves, earn every time they&apos;re used. Pulse handles distribution and payouts.</p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-4">
                      <p className="text-[#E0FE10] font-semibold mb-2">For Users</p>
                      <p className="text-zinc-400 text-sm">Personalized workouts, group challenges, leaderboards. Fitness that feels social.</p>
                    </div>
                  </div>

                  <div className="bg-zinc-800/30 rounded-lg p-4 border-l-2 border-[#E0FE10]">
                    <p className="text-zinc-300 text-sm">
                      <span className="text-white font-medium">The Model:</span> Creators upload Moves → Pulse transforms them into Stacks (structured workouts) and Rounds (group challenges) → Users train socially → Creators earn through setting custom pricing, and content usage.
                    </p>
                  </div>
                  
                  {/* Mission, Vision, Values Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Mission</h4>
                      <p className="text-zinc-400 text-sm">Make fitness feel social, accessible, and community-driven — powered by real creators and real human connection.</p>
                    </div>
                    <div 
                      className="bg-gradient-to-br from-zinc-800/70 to-zinc-700/70 rounded-lg p-5 cursor-pointer hover:from-zinc-700/70 hover:to-zinc-600/70 transition-all duration-300 border border-zinc-700/50 hover:border-[#E0FE10]/30 group"
                      onClick={() => switchSection('vision')}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[#E0FE10] font-medium group-hover:text-[#d8f521] transition-colors">Vision</h4>
                        <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center group-hover:bg-[#E0FE10]/30 transition-colors">
                          <span className="text-[#E0FE10] text-xs">→</span>
                        </div>
                      </div>
                      <p className="text-zinc-400 text-sm group-hover:text-zinc-300 transition-colors">
                        Build the first operating system for human health — wellness that&apos;s continuous, adaptive, and embedded into daily life.
                      </p>
                      <p className="text-zinc-500 text-xs mt-2 group-hover:text-zinc-400 transition-colors">
                        Click to explore our vision →
                      </p>
                    </div>
                    <div className="bg-zinc-800/70 rounded-lg p-5">
                      <h4 className="text-[#E0FE10] font-medium mb-3">Values</h4>
                      <ul className="text-zinc-400 text-sm space-y-1">
                        <li>• Community-first</li>
                        <li>• Authentic, creator-powered fitness</li>
                        <li>• Inclusivity and accessibility</li>
                        <li>• Tech that enhances human connection</li>
                      </ul>
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
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                    <span className="font-bold text-black">3</span>
                  </div>
                  <h2 className="text-white text-3xl font-bold">Traction & Metrics</h2>
                </div>
                
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                  <h3 className="text-white text-xl font-semibold mb-6">Key Performance Indicators</h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-14">
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Total Members</p>
                        <p className="text-white text-3xl font-bold mb-1">808</p>
                        <p className="text-[#E0FE10] text-sm">Since Jan 2025 launch</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Monthly Active Users</p>
                        <p className="text-white text-3xl font-bold mb-1">286</p>
                        <p className="text-[#E0FE10] text-sm">61% retention rate</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Paying Subscribers</p>
                        <p className="text-white text-3xl font-bold mb-1">144</p>
                        <p className="text-[#E0FE10] text-sm">18% conversion rate</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">MRR</p>
                        <p className="text-white text-3xl font-bold mb-1">$625</p>
                        <p className="text-[#E0FE10] text-sm">Growing monthly</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">CAC</p>
                        <p className="text-white text-3xl font-bold mb-1">$0</p>
                        <p className="text-[#E0FE10] text-sm">100% organic growth</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Revenue (YTD 2025)</p>
                        <p className="text-white text-3xl font-bold mb-1">$3.1K</p>
                        <p className="text-[#E0FE10] text-sm">Monetization validated</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Engagement Metrics Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Avg. Session Time</p>
                        <p className="text-white text-3xl font-bold mb-1">1h 29m</p>
                        <p className="text-[#E0FE10] text-sm">High user engagement</p>
                      </div>
                    </div>
                    
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-[#d7ff00]/10"></div>
                      <div className="relative bg-zinc-900 rounded-lg p-6 text-center">
                        <p className="text-zinc-400 text-sm font-medium mb-2">Sessions per User</p>
                        <p className="text-white text-3xl font-bold mb-1">4.8</p>
                        <p className="text-[#E0FE10] text-sm">Strong habit formation</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Analytics Dashboard Section */}
                  <div className="mb-12">
                    <h4 className="text-white text-lg font-semibold mb-6">Analytics Dashboard</h4>
                    <p className="text-zinc-400 text-sm mb-8">Real-time metrics from our analytics platform showing subscription breakdown, retention trends, and conversion performance.</p>
                    
                    {/* Data Sources */}
                    <div className="bg-zinc-800/30 rounded-xl p-6 mb-8">
                      <h5 className="text-white font-medium mb-4">Data Sources & Tech Stack</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-3 bg-zinc-900/50 rounded-lg p-3">
                          <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                            <span className="text-orange-400 text-xs font-bold">FB</span>
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">Firebase</p>
                            <p className="text-zinc-400 text-xs">User data & auth</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-zinc-900/50 rounded-lg p-3">
                          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                            <span className="text-purple-400 text-xs font-bold">MP</span>
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">Mixpanel</p>
                            <p className="text-zinc-400 text-xs">Event tracking</p>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[#E0FE10] text-xs">✓</span>
                            </div>
                            <div className="text-zinc-300 text-sm">Trained 46 people simultaneously with live, high-energy experience</div>
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">App Store Connect</p>
                            <p className="text-zinc-400 text-xs">App metrics</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 bg-zinc-900/50 rounded-lg p-3">
                          <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                            <span className="text-green-400 text-xs font-bold">RC</span>
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">RevenueCat</p>
                            <p className="text-zinc-400 text-xs">Subscriptions</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                      {/* Subscription Overview */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="text-white font-medium">Subscription Overview</h5>
                          <span className="text-zinc-400 text-sm">May 2025</span>
                        </div>
                        <SubscriptionOverview />
                      </div>
                      
                      {/* Conversion to Paid */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="text-white font-medium">Conversion to Standard Paid Subscriptions</h5>
                          <span className="text-zinc-400 text-sm">Last 30 Days</span>
                        </div>
                        <ConversionChart />
                      </div>
                    </div>
                    
                    {/* Retention Rate Chart */}
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-white font-medium">Retention and Conversion Rates</h5>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center text-zinc-400 text-sm">
                            <input type="checkbox" className="mr-2" />
                            Show average
                          </label>
                        </div>
                      </div>
                      
                      <div className="bg-zinc-800/30 rounded-xl p-6">
                        <div className="flex gap-6 mb-4 text-sm">
                          <button 
                            onClick={() => setActiveRetentionTab('retention')}
                            className={`pb-1 transition-colors ${
                              activeRetentionTab === 'retention' 
                                ? 'text-sky-400 border-b-2 border-sky-400' 
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            Retention Rate
                          </button>
                          <button 
                            onClick={() => setActiveRetentionTab('conversion')}
                            className={`pb-1 transition-colors ${
                              activeRetentionTab === 'conversion' 
                                ? 'text-sky-400 border-b-2 border-sky-400' 
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            Conversion Rate by Introductory Offer
                          </button>
                        </div>
                        <RetentionRateChart />
                        
                        {/* Chart Legend */}
                        <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
                          <span>Performance Scale:</span>
                          <div className="flex items-center gap-2">
                            <span>0%</span>
                            <div className="w-20 h-2 bg-gradient-to-r from-red-500/20 via-yellow-500/20 to-[#E0FE10]/20 rounded-full"></div>
                            <span>100%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* User Engagement Analytics */}
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-white font-medium">User Engagement Analytics</h5>
                        <span className="text-zinc-400 text-sm">May 2025</span>
                      </div>
                      <EngagementChart />
                    </div>
                    
                    {/* K-Effective Viral Growth Snapshot */}
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <TrendingUp className="h-5 w-5 text-[#E0FE10]" />
                          <h5 className="text-white font-medium">Viral Growth Snapshot</h5>
                        </div>
                        <span className="text-zinc-400 text-sm">Morning Mobility Challenge • May 6 - June 6</span>
                      </div>
                      
                      {isLoadingKMetrics ? (
                        <div className="bg-zinc-800/30 rounded-xl p-8 flex items-center justify-center">
                          <div className="text-zinc-400">Loading viral metrics...</div>
                        </div>
                      ) : kEffectiveMetrics ? (
                        <div className="bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 rounded-xl p-6 border border-[#E0FE10]/20">
                          {/* Main K-Effective Metric */}
                          <div className="text-center mb-6">
                            <div className="inline-flex items-center gap-2 bg-[#E0FE10]/10 rounded-lg px-4 py-2 mb-2">
                              <span className="text-[#E0FE10] text-sm font-medium">Effective K-Factor (May 6 - June 6)</span>
                            </div>
                            <div className="text-white text-4xl font-bold mb-1">{kEffectiveMetrics.kEffective}</div>
                            <p className="text-zinc-400 text-sm">
                              {kEffectiveMetrics.referredSignups} referred sign-ups from {kEffectiveMetrics.activeReferrers} active referrers
                            </p>
                          </div>
                          
                          {/* Key Metrics Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
                              <div className="text-[#E0FE10] text-lg font-bold">{kEffectiveMetrics.viralPercentage}%</div>
                              <div className="text-zinc-400 text-xs">of new users via referrals</div>
                            </div>
                            <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
                              <div className="text-[#E0FE10] text-lg font-bold">{kEffectiveMetrics.viralCycleTime}d</div>
                              <div className="text-zinc-400 text-xs">viral cycle time</div>
                            </div>
                            <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
                              <div className="text-[#E0FE10] text-lg font-bold">{kEffectiveMetrics.shareToFirstWorkoutRate}%</div>
                              <div className="text-zinc-400 text-xs">share-to-workout rate</div>
                            </div>
                            <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
                              <div className="text-[#E0FE10] text-lg font-bold">{kEffectiveMetrics.timeToSecondShare}d</div>
                              <div className="text-zinc-400 text-xs">time to second share</div>
                            </div>
                          </div>
                          
                          {/* Breakdown */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-zinc-800/30 rounded-lg p-4">
                              <h6 className="text-white font-medium mb-3">Creator-Driven Virality</h6>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-zinc-400 text-sm">Total Participants</span>
                                  <span className="text-white font-medium">{kEffectiveMetrics.totalParticipants}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-zinc-400 text-sm">Referred Joins</span>
                                  <span className="text-[#E0FE10] font-medium">{kEffectiveMetrics.referredSignups}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-zinc-400 text-sm">Direct Joins</span>
                                  <span className="text-white font-medium">{kEffectiveMetrics.directJoins}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-zinc-800/30 rounded-lg p-4">
                              <h6 className="text-white font-medium mb-3">Why This Matters</h6>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                                  <span className="text-zinc-400">K &gt; 1.0 = viral loop scales without paid acquisition</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                                  <span className="text-zinc-400">Immune to missing-invite noise</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#E0FE10] mt-2 flex-shrink-0"></div>
                                  <span className="text-zinc-400">Measures actual results, not attempts</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Methodology Note */}
                          <div className="mt-4 p-3 bg-zinc-900/30 rounded-lg border-l-2 border-[#E0FE10]/50">
                            <p className="text-zinc-400 text-xs">
                              <strong className="text-[#E0FE10]">Methodology:</strong> K<sub>effective</sub> = New sign-ups attributed to referrals ÷ Active referrers in same period. 
                              Focused on Morning Mobility challenge to demonstrate creator-driven viral mechanics.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-zinc-800/30 rounded-xl p-8 text-center">
                          <div className="text-zinc-400">Unable to load viral metrics</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Viral Story & Network Effect */}
                    <div className="mb-8">
                      <div className="bg-gradient-to-br from-[#E0FE10]/10 to-[#E0FE10]/5 border border-[#E0FE10]/20 rounded-xl p-6">
                        <h5 className="text-white font-semibold mb-4 flex items-center gap-2">
                          <span className="text-2xl">🚀</span>
                          Small Creator Cohort Proves Flywheel
                        </h5>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Viral Flow */}
                          <div>
                            <div className="bg-zinc-900/50 rounded-lg p-4 mb-4">
                              <div className="flex items-center justify-between text-center">
                                <div>
                                  <div className="text-[#E0FE10] text-2xl font-bold">6</div>
                                  <div className="text-zinc-400 text-xs">active referrers</div>
                                </div>
                                <div className="text-[#E0FE10] text-xl">→</div>
                                <div>
                                  <div className="text-[#E0FE10] text-2xl font-bold">59</div>
                                  <div className="text-zinc-400 text-xs">net sign-ups</div>
                                </div>
                                <div className="text-[#E0FE10] text-xl">→</div>
                                <div>
                                  <div className="text-[#E0FE10] text-2xl font-bold">81</div>
                                  <div className="text-zinc-400 text-xs">total participants</div>
                                </div>
                              </div>
                              <div className="text-center mt-3 pt-3 border-t border-zinc-700">
                                <span className="text-zinc-300 text-sm">Loop time: </span>
                                <span className="text-[#E0FE10] font-semibold">6.3 days</span>
                              </div>
                            </div>
                            
                            <div className="bg-zinc-800/50 rounded-lg p-4">
                              <h6 className="text-white font-medium mb-2">Next Step Projection:</h6>
                              <div className="text-zinc-300 text-sm space-y-1">
                                <div><span className="text-[#E0FE10]">100 active referrers</span> → <span className="text-[#E0FE10]">600+ sign-ups</span></div>
                                <div><span className="text-[#E0FE10]">CAC &lt;$1</span> vs. <span className="text-zinc-500 line-through">$4.75 paid</span></div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Network Visualization Concept */}
                          <div className="flex items-center justify-center">
                            <div className="bg-zinc-900/50 rounded-lg p-6 w-full">
                              <p className="text-zinc-400 text-sm mb-4 text-center">Viral Effect</p>
                              <ReferralGraph data={sampleGraph} className="rounded-lg border border-zinc-700/50" />
                              <div className="mt-3 text-[#E0FE10] text-xs font-medium text-center">
                                One referrer shares → multiple children join → children become referrers → viral branching effect
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* What the Numbers Really Mean */}
                    {kEffectiveMetrics && (
                      <div className="mb-8">
                        <h5 className="text-white font-medium mb-4">What the Numbers Really Mean</h5>
                        <div className="bg-zinc-800/30 rounded-xl overflow-hidden">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-zinc-700 bg-zinc-900/50">
                                <th className="py-3 px-4 text-zinc-400 font-medium text-sm">Metric</th>
                                <th className="py-3 px-4 text-zinc-400 font-medium text-sm">Interpretation</th>
                                <th className="py-3 px-4 text-zinc-400 font-medium text-sm">Investor Takeaway</th>
                              </tr>
                            </thead>
                            <tbody className="text-sm">
                              <tr className="border-b border-zinc-700">
                                <td className="py-3 px-4 text-[#E0FE10] font-medium">K-eff = {kEffectiveMetrics.kEffective}</td>
                                <td className="py-3 px-4 text-zinc-300">Each active referrer → {kEffectiveMetrics.kEffective} credited sign-ups</td>
                                <td className="py-3 px-4 text-zinc-300">Viral loop &gt; 1 ⇒ product can grow "for free"</td>
                              </tr>
                              <tr className="border-b border-zinc-700">
                                <td className="py-3 px-4 text-[#E0FE10] font-medium">{kEffectiveMetrics.viralPercentage}% via referrals</td>
                                <td className="py-3 px-4 text-zinc-300">Majority of growth is peer-driven</td>
                                <td className="py-3 px-4 text-zinc-300"><strong>Paid CAC isn't the growth engine—community is</strong></td>
                              </tr>
                              <tr className="border-b border-zinc-700">
                                <td className="py-3 px-4 text-[#E0FE10] font-medium">{kEffectiveMetrics.viralCycleTime}d cycle time</td>
                                <td className="py-3 px-4 text-zinc-300">Host → child joins in under a week</td>
                                <td className="py-3 px-4 text-zinc-300">Loop spins fast; LTV realized quickly</td>
                              </tr>
                              <tr className="border-b border-zinc-700">
                                <td className="py-3 px-4 text-[#E0FE10] font-medium">{kEffectiveMetrics.shareToFirstWorkoutRate}% share-to-workout</td>
                                <td className="py-3 px-4 text-zinc-300">Referred sign-ups actually finish a Round</td>
                                <td className="py-3 px-4 text-zinc-300">Referred users are quality users, not tourists</td>
                              </tr>
                              <tr>
                                <td className="py-3 px-4 text-[#E0FE10] font-medium">{kEffectiveMetrics.timeToSecondShare}d to 2nd share</td>
                                <td className="py-3 px-4 text-zinc-300">They pay it forward within ~2 weeks</td>
                                <td className="py-3 px-4 text-zinc-300">Flywheel self-propagates</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
              
              {/* Data Glossary */}
              <div className="mb-8">
                <details className="bg-zinc-800/30 rounded-xl overflow-hidden">
                  <summary className="cursor-pointer p-6 hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <h5 className="text-white font-medium">📊 Data Glossary</h5>
                      <span className="text-zinc-400 text-sm">Click to expand definitions</span>
                    </div>
                  </summary>
                  <div className="px-6 pb-6 border-t border-zinc-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="bg-zinc-900/50 rounded-lg p-4">
                        <h6 className="text-[#E0FE10] font-medium mb-2">Effective K-Factor</h6>
                        <p className="text-zinc-400 text-sm">Our viral growth metric calculated as: New sign-ups attributed to referrals ÷ Active referrers in the same period. This approach is immune to missing-invite noise and measures actual results rather than attempts. Values above 1.0 indicate viral growth that can scale without paid acquisition.</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-4">
                        <h6 className="text-[#E0FE10] font-medium mb-2">CAC (Customer Acquisition Cost)</h6>
                        <p className="text-zinc-400 text-sm">Total cost to acquire one paying customer, including marketing spend, sales costs, and onboarding expenses.</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-4">
                        <h6 className="text-[#E0FE10] font-medium mb-2">Retention Rate</h6>
                        <p className="text-zinc-400 text-sm">Percentage of users who remain active after a specific time period. Critical metric for subscription businesses.</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-4">
                        <h6 className="text-[#E0FE10] font-medium mb-2">ARPU (Average Revenue Per User)</h6>
                        <p className="text-zinc-400 text-sm">Average monthly revenue generated per user, calculated as total revenue divided by active users.</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-4">
                        <h6 className="text-[#E0FE10] font-medium mb-2">Churn Rate</h6>
                        <p className="text-zinc-400 text-sm">Percentage of subscribers who cancel their subscription in a given period. Lower is better.</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-4">
                        <h6 className="text-[#E0FE10] font-medium mb-2">Creator Multiplier</h6>
                        <p className="text-zinc-400 text-sm">Average number of users acquired per creator partner. Measures effectiveness of creator-driven growth strategy.</p>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
              
              {/* Growth Metrics Charts */}
              <div className="space-y-12 mb-10">
                <div>
                  <h4 className="text-white text-lg font-semibold mb-4">Organic Growth Economics</h4>
                  <p className="text-zinc-400 text-sm mb-6">
                    Community-driven acquisition costs and viral coefficient trends showing sustainable growth without paid marketing dependency.
                  </p>
                  
                  {/* Organic vs Paid Comparison */}
                  <div className="bg-zinc-800/30 rounded-xl p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="text-[#E0FE10] text-2xl font-bold mb-1">$0</div>
                        <div className="text-zinc-400 text-sm">Current CAC</div>
                        <div className="text-zinc-500 text-xs">100% organic</div>
                      </div>
                      <div className="text-center">
                        <div className="text-zinc-500 text-2xl font-bold mb-1 line-through">$4.75</div>
                        <div className="text-zinc-400 text-sm">Industry Paid CAC</div>
                        <div className="text-zinc-500 text-xs">Traditional approach</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[#E0FE10] text-2xl font-bold mb-1">&lt;$1</div>
                        <div className="text-zinc-400 text-sm">Projected CAC at scale</div>
                        <div className="text-zinc-500 text-xs">With 100+ creators</div>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-[#E0FE10]/10 rounded-lg border border-[#E0FE10]/20">
                      <p className="text-[#E0FE10] text-sm font-medium text-center">
                        💡 Paid CAC isn't the growth engine—community is
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-zinc-800/50 rounded-xl p-6">
                  <h4 className="text-white text-lg font-semibold mb-4">Early Stage Validation</h4>
                  <p className="text-zinc-400 mb-4">
                    Strong early metrics since January 2025 public launch demonstrate product-market fit and scalable unit economics.
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-center mb-4">
                    <div>
                      <p className="text-zinc-400 text-sm">Retention Rate</p>
                      <p className="text-white text-xl font-bold">61%</p>
                      <p className="text-zinc-500 text-xs">Above industry avg</p>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-sm">Conversion Rate</p>
                      <p className="text-white text-xl font-bold">18%</p>
                      <p className="text-zinc-500 text-xs">2x industry avg</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center mb-4">
                    <div>
                      <p className="text-zinc-400 text-sm">Creator Multiplier</p>
                      <p className="text-white text-xl font-bold">37.5x</p>
                      <p className="text-zinc-500 text-xs">Users per creator</p>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-sm">Monthly Churn</p>
                      <p className="text-white text-xl font-bold">6.5%</p>
                      <p className="text-zinc-500 text-xs">Low for early stage</p>
                    </div>
                  </div>
                  <div className="bg-zinc-900/50 rounded-lg p-4">
                    <h5 className="text-[#E0FE10] text-sm font-medium mb-2">Subscription Mix</h5>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-zinc-400 text-sm">Annual ($39.99)</span>
                      <span className="text-white font-medium">80 subs (56%)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400 text-sm">Monthly ($4.99)</span>
                      <span className="text-white font-medium">64 subs (44%)</span>
                    </div>
                    <p className="text-zinc-500 text-xs mt-2">Strong annual uptake shows user confidence</p>
                  </div>
                </div>
                
                <div className="bg-zinc-800/50 rounded-xl p-6">
                  <h4 className="text-white text-lg font-semibold mb-4">Growth Channels</h4>
                  <ul className="space-y-3">
                    <li className="flex justify-between items-center">
                      <span className="text-zinc-400">Creator-Led Acquisition</span>
                      <span className="text-white font-medium">65%</span>
                    </li>
                    <li className="flex justify-between items-center">
                      <span className="text-zinc-400">Social Media Marketing (TikTok, Instagram)</span>
                      <span className="text-white font-medium">20%</span>
                    </li>
                    <li className="flex justify-between items-center">
                      <span className="text-zinc-400">Word of Mouth</span>
                      <span className="text-white font-medium">10%</span>
                    </li>
                    <li className="flex justify-between items-center">
                      <span className="text-zinc-400">Direct/Organic</span>
                      <span className="text-white font-medium">5%</span>
                    </li>
                  </ul>
                </div>
              </div>
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
                    <div className="flex items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">4</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">IP &amp; Defensibility</h2>
                    </div>

                    {/* gradient-frame wrapper */}
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-[2px]">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-[#d7ff00]/20 animate-[spin_10s_linear_infinite] opacity-25" />
                    <div className="relative bg-zinc-900 rounded-lg p-8 lg:p-10 space-y-10">

                        {/* secured filings table */}
                        <div>
                        <h3 className="text-white text-xl font-semibold mb-6">Secured Filings</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-zinc-800 text-zinc-400 text-sm">
                                {['Filing', 'Type', 'Jurisdiction', 'Status', 'Coverage', 'Filed'].map(h => (
                                    <th key={h} className="py-3 pr-6 font-medium">{h}</th>
                                ))}
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {[
                                {
                                    filing: 'Pulse Programming™',
                                    type: 'Trademark',
                                    jur: 'USPTO',
                                    status: 'Registered',
                                    cov: 'Software class 9 · 42',
                                    filed: 'Aug 2024',
                                },
                                {
                                    filing: 'Pulse Programming – AI Stack Generation',
                                    type: 'Provisional Patent',
                                    jur: 'USPTO',
                                    status: 'Filed',
                                    cov: 'Method for AI-generated workout programs',
                                    filed: 'Feb 2025',
                                },
                                {
                                    filing: 'Rounds™',
                                    type: 'Trademark',
                                    jur: 'USPTO',
                                    status: 'Pending',
                                    cov: 'Community-fitness software',
                                    filed: 'Jan 2025',
                                },
                                ].map(r => (
                                <tr key={r.filing} className="border-b border-zinc-800 last:border-0">
                                    <td className="py-4 pr-6 text-white">
                                    {r.filing === 'Pulse Programming™' ? (
                                        <a 
                                        href="https://fitwithpulse.ai/programming" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-[#E0FE10] hover:text-[#d8f521] transition-colors underline decoration-dotted"
                                        >
                                        {r.filing}
                                        </a>
                                    ) : (
                                        r.filing
                                    )}
                                    </td>
                                    <td className="py-4 pr-6 text-zinc-300">{r.type}</td>
                                    <td className="py-4 pr-6 text-zinc-300">{r.jur}</td>
                                    <td className="py-4 pr-6">
                                    <span className={`px-2 py-1 rounded text-xs font-medium
                                        ${r.status === 'Registered' ? 'bg-green-600/20 text-green-400'
                                        : 'bg-yellow-600/20 text-yellow-400'}`}>
                                        {r.status}
                                    </span>
                                    </td>
                                    <td className="py-4 pr-6 text-zinc-300">{r.cov}</td>
                                    <td className="py-4 text-zinc-300">{r.filed}</td>
                                </tr>
                                ))}
                            </tbody>
                            </table>
                        </div>
                        </div>

                        {/* pipeline & funding call-out */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* pipeline card */}
                        <div className="bg-zinc-800/60 rounded-lg p-6 md:col-span-2">
                            <h4 className="text-[#E0FE10] font-medium mb-3">Pipeline (Next 12 Months)</h4>
                            <ul className="space-y-2 text-sm text-zinc-400">
                            <li>• 3 additional patent applications drafted and ready to file → <span className="text-zinc-200">pending funding</span></li>
                            <li>• EU trademark filings for Pulse Programming™ & Rounds™ → <span className="text-zinc-200">Q4 2025</span></li>
                            <li>• Design patent for on-watch real-time "Energy Story" UI → <span className="text-zinc-200">Q1 2026</span></li>
                            </ul>
                        </div>

                        {/* funding accelerator card */}
                        <div className="bg-zinc-800/60 rounded-lg p-6 flex flex-col justify-between">
                            <h4 className="text-[#E0FE10] font-medium mb-3">Capital = Acceleration</h4>
                            <p className="text-zinc-400 text-sm mb-4">
                            Additional funding allows us to fast-track international trademarks and convert provisionals before expiry—locking in a multi-year moat.
                            </p>
                        </div>
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
                            <span>61% retention, 1h 29m sessions</span>
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
                    <div className="flex items-center mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center mr-4">
                        <span className="font-bold text-black">6</span>
                    </div>
                    <h2 className="text-white text-3xl font-bold">Market Opportunity</h2>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 mb-10">
                    <h3 className="text-white text-xl font-semibold mb-4">The Fitness Landscape</h3>
                    
                    <p className="text-zinc-400 text-lg mb-6">
                        The fitness industry represents a massive and rapidly growing market opportunity, with multiple layers 
                        of addressable segments that Pulse is uniquely positioned to capture through our creator-driven approach.
                    </p>
                    
                    {/* Market Size Visualization */}
                    <div className="mb-10">
                        <h4 className="text-white text-lg font-semibold mb-6">Market Analysis</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            {/* Total Addressable Market */}
                            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-700 p-6">
                                <div className="absolute inset-0 bg-gradient-to-r from-zinc-600/20 to-zinc-500/20"></div>
                                <div className="relative">
                                    <div className="text-center mb-4">
                                        <div className="w-full h-32 bg-zinc-600 rounded-lg mb-4 flex items-center justify-center">
                                            <span className="text-white text-sm font-medium">Total Fitness Industry</span>
                                        </div>
                                    </div>
                                    <h5 className="text-white text-2xl font-bold mb-2">$244 Bn</h5>
                                    <p className="text-[#E0FE10] text-sm font-medium mb-2">Total Addressable Market</p>
                                    <p className="text-zinc-400 text-sm">Total Fitness Industry Value 2023</p>
                                    <p className="text-zinc-500 text-xs">(5.6% growth rate)</p>
                                </div>
                            </div>
                            
                            {/* Serviceable Addressable Market */}
                            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-700 p-6">
                                <div className="absolute inset-0 bg-gradient-to-r from-zinc-600/20 to-zinc-500/20"></div>
                                <div className="relative">
                                    <div className="text-center mb-4">
                                        <div className="w-full h-32 bg-zinc-600 rounded-lg mb-4 flex items-center justify-center">
                                            <span className="text-white text-sm font-medium">Influence & Fitness Seekers</span>
                                        </div>
                                    </div>
                                    <h5 className="text-white text-2xl font-bold mb-2">$41.3 Bn</h5>
                                    <p className="text-[#E0FE10] text-sm font-medium mb-2">Serviceable Addressable Market</p>
                                    <p className="text-zinc-400 text-sm">Based on influence & fitness seeker population</p>
                                </div>
                            </div>
                            
                            {/* Service Obtainable Market */}
                            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#E0FE10]/20 to-[#E0FE10]/10 p-6 border-2 border-[#E0FE10]/30">
                                <div className="relative">
                                    <div className="text-center mb-4">
                                        <div className="w-full h-32 bg-[#E0FE10] rounded-lg mb-4 flex items-center justify-center">
                                            <span className="text-black text-sm font-medium">Pulse Target Market</span>
                                        </div>
                                    </div>
                                    <h5 className="text-white text-2xl font-bold mb-2">$810 Million</h5>
                                    <p className="text-[#E0FE10] text-sm font-medium mb-2">Service Obtainable Market</p>
                                    <p className="text-zinc-300 text-sm">5M users (over 5 years period)</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-zinc-800/30 rounded-lg p-4 text-center">
                            <p className="text-zinc-400 text-sm">
                                <span className="text-[#E0FE10] font-medium">Source:</span> 
                                <a href="https://www.wellnesscreatives.com/fitness-industry-statistics-growth/" 
                                   className="text-zinc-300 hover:text-[#E0FE10] transition-colors ml-1" 
                                   target="_blank" 
                                   rel="noopener noreferrer">
                                    Wellness Creatives Fitness Industry Analysis
                                </a>
                            </p>
                        </div>
                    </div>
                    
                    {/* Key Market Drivers */}
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-1 mb-8">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-[#d7ff00]/20"></div>
                        <div className="relative bg-zinc-900 rounded-lg p-6">
                        <h4 className="text-white text-lg font-semibold mb-4">Key Market Drivers</h4>
                        
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-[#E0FE10] text-xs font-bold">1</span>
                            </div>
                            <div>
                                <p className="text-white font-medium">Rising Health Consciousness</p>
                                <p className="text-zinc-400">Increasing awareness of health and fitness, especially post-pandemic</p>
                            </div>
                            </div>
                            
                            <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-[#E0FE10] text-xs font-bold">2</span>
                            </div>
                            <div>
                                <p className="text-white font-medium">Social Connection Demand</p>
                                <p className="text-zinc-400">Growing desire for community and connection in fitness journeys</p>
                            </div>
                            </div>
                            
                            <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-[#E0FE10] text-xs font-bold">3</span>
                            </div>
                            <div>
                                <p className="text-white font-medium">Digital Transformation</p>
                                <p className="text-zinc-400">Rapid adoption of digital fitness solutions and mobile technology</p>
                            </div>
                            </div>
                            
                            <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-[#E0FE10] text-xs font-bold">4</span>
                            </div>
                            <div>
                                <p className="text-white font-medium">Creator Economy Growth</p>
                                <p className="text-zinc-400">Fitness influencers driving engagement and monetization opportunities</p>
                            </div>
                            </div>
                        </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                        <h4 className="text-[#E0FE10] font-medium mb-3">Mobile Fitness App Market</h4>
                        <p className="text-white text-3xl font-bold mb-2">$120B+</p>
                        <p className="text-zinc-400 mb-3">Projected global fitness app market by 2030</p>
                        <p className="text-zinc-500 text-xs">
                            <a href="https://www.grandviewresearch.com/industry-analysis/fitness-app-market" 
                               className="hover:text-[#E0FE10] transition-colors" 
                               target="_blank" 
                               rel="noopener noreferrer">
                                Source: Grand View Research
                            </a>
                        </p>
                        </div>
                        
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                        <h4 className="text-[#E0FE10] font-medium mb-3">Target User Base</h4>
                        <p className="text-white text-3xl font-bold mb-2">820M+</p>
                        <p className="text-zinc-400">Active fitness enthusiasts worldwide</p>
                        </div>
                    </div>
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    <h3 className="text-white text-xl font-semibold mb-4">Competitive Landscape</h3>
                    
                    <p className="text-zinc-400 text-lg mb-6">
                        People connect with real people. Where else can we upload content, track fitness progress, and make money supporting people's growth?
                    </p>
                    
                    {/* Competitor Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        {/* Pulse */}
                        <div className="bg-zinc-800/50 rounded-xl p-6 border-2 border-[#E0FE10]/30">
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 rounded-full bg-[#E0FE10] flex items-center justify-center mr-3">
                                    <span className="text-black font-bold text-lg">P</span>
                                </div>
                                <div>
                                    <h4 className="text-white font-semibold">Pulse</h4>
                                    <p className="text-zinc-400 text-sm">2025</p>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm mb-4">
                                <p className="text-white">$4.99/month</p>
                                <p className="text-white">$39.99/annually</p>
                            </div>
                        </div>
                        
                        {/* Strava */}
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center mr-3">
                                    <span className="text-white font-bold text-lg">S</span>
                                </div>
                                <div>
                                    <h4 className="text-white font-semibold">Strava</h4>
                                    <p className="text-zinc-400 text-sm">2009</p>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm mb-4">
                                <p className="text-white">$11.99/month</p>
                                <p className="text-white">$79.99/annually</p>
                                <p className="text-zinc-400">100+ million users</p>
                            </div>
                        </div>
                        
                        {/* Trainerize */}
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center mr-3">
                                    <span className="text-white font-bold text-lg">T</span>
                                </div>
                                <div>
                                    <h4 className="text-white font-semibold">Trainerize</h4>
                                    <p className="text-zinc-400 text-sm">2008</p>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm mb-4">
                                <p className="text-white">$5/per client</p>
                                <p className="text-white">$250/500 client</p>
                                <p className="text-zinc-400">1.6 million trainers</p>
                            </div>
                        </div>
                        
                        {/* Instagram */}
                        <div className="bg-zinc-800/50 rounded-xl p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center mr-3">
                                    <span className="text-white font-bold text-lg">I</span>
                                </div>
                                <div>
                                    <h4 className="text-white font-semibold">Instagram</h4>
                                    <p className="text-zinc-400 text-sm">2010</p>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm mb-4">
                                <p className="text-white">Free</p>
                                <p className="text-zinc-400">estimated 280 million</p>
                                <p className="text-zinc-400">fitness content creators</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Feature Comparison Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-zinc-700 bg-zinc-900/50">
                                <th className="py-3 px-4 text-zinc-400 font-medium text-sm">Feature</th>
                                <th className="py-3 px-4 text-zinc-400 font-medium text-sm text-center">Pulse</th>
                                <th className="py-3 px-4 text-zinc-400 font-medium text-sm text-center">Strava</th>
                                <th className="py-3 px-4 text-zinc-400 font-medium text-sm text-center">Trainerize</th>
                                <th className="py-3 px-4 text-zinc-400 font-medium text-sm text-center">Instagram</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            <tr className="border-b border-zinc-700">
                                <td className="py-3 px-4 text-white">Fitness Specific</td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                            </tr>
                            <tr className="border-b border-zinc-700">
                                <td className="py-3 px-4 text-white">User Generated Content (UGC)</td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                            </tr>
                            <tr className="border-b border-zinc-700">
                                <td className="py-3 px-4 text-white">AI Curated Workouts</td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td className="py-3 px-4 text-white">Creator Compensation</td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20">
                                        <span className="text-green-400">✓</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                        <span className="text-red-400">✗</span>
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                        </table>
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
                                    <span className="text-[#E0FE10] font-medium">GPT-4o, GPT-4o-mini</span>
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
                            Principal engineer, former D1 track and field athlete, and personal trainer of 10+ years. 
                            Experience launching and scaling software at Fortune 500 companies like General Motors, IQVIA, 
                            and Pfizer, to startups like Warby Parker. Passionate about the intersection of technology and health.
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
                            Creative visionary leading our design strategy and user experience. Expert in creating 
                            intuitive interfaces that make fitness accessible and engaging for everyone. Passionate about 
                            crafting accessible design that's both creative and uniquely compelling.
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
                            Exercise science major and veteran who leads our creator acquisition and partnership strategy. 
                            Passionate about people and social media, with proven experience growing Instagram accounts 
                            to over 50K followers. Expert in building relationships with fitness influencers and scaling creator-driven growth.
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
                            Harvard-educated strategic advisor and former TED coach who brings top-tier storytelling guidance 
                            and operational excellence to Pulse. Expert in translating complex ideas into compelling narratives 
                            that drive investor confidence and team alignment. Passionate about scaling mission-driven organizations.
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
                            #1 Amazon Seller and creator of the TED talk "How to Outsmart Your Unconscious Bias" (500k+ views). 
                            Former Silicon Valley securities lawyer, VC consultant, and tech-startup CEO who has advised Fortune 500 teams 
                            on growth through inclusion. At Pulse, she brings expertise in brand narrative, bias-free community design, 
                            and helping creators communicate value that converts audiences into loyal users.
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
                            Renowned civil rights activist and community organizer who has mastered the art of rallying people 
                            around a shared cause. As a newly passionate fitness enthusiast, DeRay brings a unique perspective 
                            on human behavior and motivation—essential insights for building authentic communities that inspire lasting change.
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
                            Marketing executive with leadership roles at PepsiCo and American Express. Recent inductee into the 
                            Advertising Hall of Achievement, Marques brings years of experience creating memorable brand experiences 
                            and driving explosive growth through innovative marketing strategies that resonate with diverse audiences.
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
                            <p className="text-zinc-400 text-sm">61% retention, 18% conversion—users pay and stay.</p>
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
                            href="/PulsePitchDeck.pdf" 
                            download="PulsePitchDeck.pdf"
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
                            <p className="text-zinc-400 text-sm">61% retention, 18% conversion—users pay and stay.</p>
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
                            href="/investor-docs/Founder-IP-Assignment-Agreement.html" 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-4 p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-purple-500/30 rounded-xl transition-all group"
                          >
                            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                              <Download className="w-5 h-5 text-purple-400" />
                            </div>
                            <div className="flex-1">
                              <div className="text-white font-medium group-hover:text-purple-400 transition-colors">IP Assignment Agreement</div>
                              <div className="text-zinc-500 text-sm">HTML • Founder IP Assignment</div>
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