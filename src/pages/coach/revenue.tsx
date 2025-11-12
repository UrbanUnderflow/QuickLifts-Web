import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../../hooks/useUser';
import PageHead from '../../components/PageHead';
import CoachLayout from '../../components/CoachLayout';
import { 
  FaDollarSign, 
  FaChartLine, 
  FaCalendarAlt,
  FaDownload,
  FaInfoCircle,
  FaArrowUp,
  FaArrowDown
} from 'react-icons/fa';
import { coachService } from '../../api/firebase/coach/service';
import subscriptionService from '../../api/firebase/subscription/service';
import { PRICING_INFO } from '../../utils/stripeConstants';
import { db } from '../../api/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
// html2pdf is browser-only; import dynamically inside handler

interface RevenueData {
  month: string;
  totalRevenue: number;
  athleteRevenue: number;
  referralRevenue: number;
}

interface PayoutHistory {
  id: string;
  date: string;
  amount: number;
  status: 'completed' | 'pending' | 'processing';
  method: string;
}

const CoachRevenue: React.FC = () => {
  const currentUser = useUser();
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
  const [loading, setLoading] = useState(true);
  const [subsOpen, setSubsOpen] = useState(true);
  const [referralOpen, setReferralOpen] = useState(false);

  // Real data containers (unified earnings + derived)
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistory[]>([]);

  const currentMonth = revenueData[0] || { month: '', totalRevenue: 0, athleteRevenue: 0, referralRevenue: 0 };
  const previousMonth = revenueData[1];
  const monthlyGrowth = previousMonth ? 
    ((currentMonth.totalRevenue - previousMonth.totalRevenue) / previousMonth.totalRevenue) * 100 : 0;

  const totalEarned = revenueData.reduce((sum, month) => sum + month.totalRevenue, 0);
  const nextPayout = currentMonth.totalRevenue; // placeholder: most recent month total

  useEffect(() => {
    // We mark loading done once sections below have attempted fetch/render
    setLoading(false);
  }, []);

  // Connected athletes subscriptions
  type AthleteSub = {
    athleteUserId: string;
    displayName?: string;
    username?: string;
    email?: string;
    planType: 'pulsecheck-monthly' | 'pulsecheck-annual' | null;
    expiration?: Date | null;
    isActive: boolean;
    monthlyCents: number;
  };
  const [athleteSubs, setAthleteSubs] = useState<AthleteSub[]>([]);
  const [athleteLoading, setAthleteLoading] = useState(false);

  // Referred coaches summary
  type ReferredCoach = {
    coachUserId: string;
    username?: string;
    email?: string;
    totalAthletes: number;
    activeAthletes: number;
    estimatedMRRCents: number; // gross from athletes (active * price)
    yourShareCents: number; // 20% of coach revenue; assume coach revenue is 40% of athlete price → 8% gross
    breakdown?: Array<{ plan: string; count: number; monthlyCents: number; subtotalCents: number }>;
  };
  const [referred, setReferred] = useState<ReferredCoach[]>([]);
  const [referredLoading, setReferredLoading] = useState(false);
  const [expandedCoach, setExpandedCoach] = useState<string | null>(null);
  const [downloadingMonth, setDownloadingMonth] = useState<string | null>(null);

  const reloadAthleteSubs = async () => {
    try {
      if (!currentUser?.id) return;
      setAthleteLoading(true);
      const connected = await coachService.getConnectedAthletes(currentUser.id);
      const ATHLETE_MONTHLY = PRICING_INFO.ATHLETE.MONTHLY.amount; // cents
      const ATHLETE_ANNUAL_EQ = Math.round(PRICING_INFO.ATHLETE.ANNUAL.amount / 12); // cents
      const rows: AthleteSub[] = await Promise.all(
        connected.map(async (a: any) => {
          let planType: any = null; // accept any string type to display accurately
          let expiration: Date | null | undefined = null;
          let isActive = false;
          try {
            const sref = doc(db, 'subscriptions', a.id);
            const sdoc = await getDoc(sref);
            if (sdoc.exists()) {
              const sd: any = sdoc.data();
              const plans: any[] = Array.isArray(sd?.plans) ? sd.plans : [];
              // take latest by expiration regardless of type
              plans.sort((x, y) => (y?.expiration || 0) - (x?.expiration || 0));
              const latest = plans[0];
              if (latest) {
                planType = latest.type || null;
                expiration = typeof latest.expiration === 'number' ? new Date(latest.expiration * 1000) : null;
                isActive = typeof latest.expiration === 'number' && latest.expiration > Math.floor(Date.now() / 1000);
              } else {
                const status = await subscriptionService.ensureActiveOrSync(a.id);
                isActive = !!status.isActive;
                expiration = status.latestExpiration || null;
              }
            }
          } catch (_) {
            try {
              const status = await subscriptionService.ensureActiveOrSync(a.id);
              isActive = !!status.isActive;
              expiration = status.latestExpiration || null;
            } catch (_) {}
          }

          // Determine price mapping based on plan type
          let monthlyCents = 0;
          const t = (planType || '').toString().toLowerCase();
          // Beta grant first: always $0
          if (t.includes('beta_grant')) {
            monthlyCents = 0;
          } else if (t.startsWith('pulsecheck-')) {
            monthlyCents = t.includes('annual') ? ATHLETE_ANNUAL_EQ : ATHLETE_MONTHLY;
          } else if (t.includes('pc_1y')) {
            monthlyCents = ATHLETE_ANNUAL_EQ;
          } else if (t.includes('pc_1m') || t.includes('pc_m') || t.includes('pc_month')) {
            monthlyCents = ATHLETE_MONTHLY;
          } else if (t) {
            // Unknown type: default to monthly estimate 0 (safe)
            monthlyCents = 0;
          }

          return {
            athleteUserId: a.id,
            displayName: a.displayName,
            username: a.username,
            email: a.email,
            planType,
            expiration,
            isActive,
            monthlyCents,
          } as AthleteSub;
        })
      );
      rows.sort((a, b) => (Number(b.isActive) - Number(a.isActive)) || (a.displayName || a.username || '').localeCompare(b.displayName || b.username || ''));
      setAthleteSubs(rows);
    } finally {
      setAthleteLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        await reloadAthleteSubs();
      } finally {
        // no-op
      }
    };
    load();
  }, [currentUser?.id]);

  // Auto-self-heal unknown athlete subscription states by syncing RevenueCat and Stripe
  const [autoResolving, setAutoResolving] = useState(false);
  const healedTriedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const heal = async () => {
      if (autoResolving) return;
      const unknowns = athleteSubs.filter(a => (!a.planType || a.planType === 'Unknown') && !a.expiration && !a.isActive);
      // Only attempt for users we haven't already tried during this session
      const candidates = unknowns.filter(a => !healedTriedRef.current.has(a.athleteUserId));
      if (candidates.length === 0) return;
      setAutoResolving(true);
      try {
        const batch = candidates.slice(0, 5);
        batch.forEach(a => healedTriedRef.current.add(a.athleteUserId));
        await Promise.all(batch.map(async (a) => {
          try {
            await fetch('/.netlify/functions/sync-revenuecat-subscription', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: a.athleteUserId })
            });
            await fetch('/.netlify/functions/migrate-expiration-history', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: a.athleteUserId })
            });
          } catch (_) {}
        }));
        await reloadAthleteSubs();
      } finally {
        setAutoResolving(false);
      }
    };
    heal();
  }, [athleteSubs, autoResolving]);

  // Unified earnings (for creator sales and payout-like info)
  type UnifiedEarnings = {
    totalEarned: number;
    totalBalance: number;
    recentSales: Array<{ id?: string; date?: string; amount?: number; roundTitle?: string; buyerId?: string; created?: number; source?: string }>
  } | null;
  const [earnings, setEarnings] = useState<UnifiedEarnings>(null);
  const [buyers, setBuyers] = useState<Record<string, { username?: string; email?: string }>>({});

  useEffect(() => {
    const fetchUnified = async () => {
      try {
        if (!currentUser?.id) return;
        const API_BASE_URL = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:8888/.netlify/functions'
          : 'https://fitwithpulse.ai/.netlify/functions';
        const res = await fetch(`${API_BASE_URL}/get-unified-earnings?userId=${currentUser.id}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json?.success && json?.earnings) {
          setEarnings({ totalEarned: json.earnings.totalEarned || 0, totalBalance: json.earnings.totalBalance || 0, recentSales: json.earnings.recentSales || [] });
        }
      } catch (_) {}
    };
    fetchUnified();
  }, [currentUser?.id]);

  // Resolve buyer names when we have recentSales
  useEffect(() => {
    const loadBuyers = async () => {
      const sales = earnings?.recentSales || [];
      if (!sales.length) return;
      const ids = Array.from(new Set(sales
        .map((s: any) => s.buyerId)
        .filter((id: string) => typeof id === 'string' && id !== 'anonymous' && id !== 'unknown')));
      const map: Record<string, { username?: string; email?: string }> = {};
      await Promise.all(ids.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, 'users', id));
          if (snap.exists()) {
            const u: any = snap.data();
            map[id] = { username: u.username || u.displayName, email: u.email };
          }
        } catch (_) {}
      }));
      setBuyers(prev => ({ ...prev, ...map }));
    };
    loadBuyers();
  }, [earnings?.recentSales]);

  // Apply dropdown filter to recent transactions
  const filteredRecentSales = React.useMemo(() => {
    const all = earnings?.recentSales || [];
    const now = Date.now();
    if (selectedPeriod === 'all') {
      return [...all].sort((a:any,b:any)=>{
        const ams = a?.date ? new Date(a.date).getTime() : (a?.created ? a.created * 1000 : 0);
        const bms = b?.date ? new Date(b.date).getTime() : (b?.created ? b.created * 1000 : 0);
        return bms - ams;
      });
    }
    const days = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : selectedPeriod === '90d' ? 90 : 365;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return all.filter((s:any) => {
      const ms = s?.date ? new Date(s.date).getTime() : (s?.created ? s.created * 1000 : NaN);
      if (isNaN(ms)) return false;
      return ms >= cutoff && ms <= now;
    }).sort((a:any,b:any)=>{
      const ams = a?.date ? new Date(a.date).getTime() : (a?.created ? a.created * 1000 : 0);
      const bms = b?.date ? new Date(b.date).getTime() : (b?.created ? b.created * 1000 : 0);
      return bms - ams;
    });
  }, [earnings?.recentSales, selectedPeriod]);

  // Build per-month totals from real transactions and render statements
  useEffect(() => {
    // Aggregate sales by month (YYYY-MM)
    const byMonth = new Map<string, number>();
    (earnings?.recentSales || []).forEach(s => {
      const ms = s.date ? new Date(s.date).getTime() : (s.created ? s.created * 1000 : NaN);
      if (!isNaN(ms)) {
        const d = new Date(ms);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        byMonth.set(key, (byMonth.get(key) || 0) + ((s.amount || 0)));
      }
    });

    // Build timeline from transactions only (cards use separate values)
    const months: RevenueData[] = [];
    const now = new Date();
    const monthsCount = selectedPeriod === 'all' ? 36 : selectedPeriod === '1y' ? 12 : selectedPeriod === '90d' ? 3 : selectedPeriod === '30d' ? 2 : 1;
    for (let i=0; i<monthsCount; i++) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      const total = byMonth.get(key) || 0;
      months.push({ month: label, totalRevenue: total, athleteRevenue: 0, referralRevenue: 0 });
    }
    setRevenueData(months);

    // Payout rows are month aggregates; available on the 1st of next month
    const payouts: PayoutHistory[] = months.map((m, idx) => ({
      id: `m${idx}`,
      date: new Date(now.getFullYear(), now.getMonth()-idx, 1).toISOString(),
      amount: m.totalRevenue,
      status: 'completed',
      method: 'Stripe'
    }));
    setPayoutHistory(payouts);
  }, [athleteSubs, referred, earnings, selectedPeriod]);

  // Derived summaries for cards
  const thisMonthTotal = React.useMemo(() => {
    if (!earnings?.recentSales) return 0;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return earnings.recentSales.reduce((sum, s) => {
      const ms = s.date ? new Date(s.date).getTime() : (s.created ? s.created * 1000 : NaN);
      if (isNaN(ms)) return sum;
      const d = new Date(ms);
      return (d.getFullYear() === y && d.getMonth() === m) ? sum + (s.amount || 0) : sum;
    }, 0);
  }, [earnings?.recentSales]);

  // Previous month total (for growth) - independent of filter
  const prevMonthTotal = React.useMemo(() => {
    if (!earnings?.recentSales) return 0;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    // previous month accounting for year change
    const prev = new Date(y, m - 1, 1);
    const py = prev.getFullYear();
    const pm = prev.getMonth();
    return earnings.recentSales.reduce((sum, s) => {
      const ms = s.date ? new Date(s.date).getTime() : (s.created ? s.created * 1000 : NaN);
      if (isNaN(ms)) return sum;
      const d = new Date(ms);
      return (d.getFullYear() === py && d.getMonth() === pm) ? sum + (s.amount || 0) : sum;
    }, 0);
  }, [earnings?.recentSales]);

  // All-time average monthly across distinct months of activity
  const avgMonthlyAllTime = React.useMemo(() => {
    const sales = earnings?.recentSales || [];
    if (sales.length === 0) return { avg: 0, months: 0 } as { avg: number; months: number };
    const byMonth = new Map<string, number>();
    let total = 0;
    sales.forEach(s => {
      const ms = s.date ? new Date(s.date).getTime() : (s.created ? s.created * 1000 : NaN);
      if (isNaN(ms)) return;
      const d = new Date(ms);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) || 0) + (s.amount || 0));
      total += s.amount || 0;
    });
    const months = byMonth.size;
    return { avg: months ? total / months : 0, months };
  }, [earnings?.recentSales]);

  const allTimeTotal = React.useMemo(() => {
    return (earnings?.recentSales || []).reduce((sum, t: any) => sum + (t.amount || 0), 0);
  }, [earnings?.recentSales]);

  const timePeriodTotal = React.useMemo(() => {
    return (filteredRecentSales || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  }, [filteredRecentSales]);

  const timePeriodCount = React.useMemo(() => {
    return (filteredRecentSales || []).length;
  }, [filteredRecentSales]);

  const timePeriodAvg = React.useMemo(() => {
    return timePeriodCount ? timePeriodTotal / timePeriodCount : 0;
  }, [timePeriodTotal, timePeriodCount]);

  // Download PDF statement (calls function then renders client PDF)
  const downloadStatement = async (monthKey: string) => {
    if (!currentUser?.id) return;
    try {
      setDownloadingMonth(monthKey);
      const API_BASE_URL = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:8888/.netlify/functions'
        : 'https://fitwithpulse.ai/.netlify/functions';
      const res = await fetch(`${API_BASE_URL}/get-monthly-statement?userId=${currentUser.id}&month=${monthKey}`);
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || 'Failed');

      // Create printable HTML
      const container = document.createElement('div');
      container.style.padding = '16px';
      container.innerHTML = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
          <h1 style="margin:0 0 8px 0">Pulse • Monthly Statement</h1>
          <div style="color:#666; margin-bottom:12px">${monthKey}</div>
          <div style="margin-bottom:12px">Total: <strong>$${(json.total || 0).toFixed(2)}</strong> · Transactions: ${json.count}</div>
          <table style="width:100%; border-collapse: collapse; font-size:12px">
            <thead>
              <tr>
                <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px">Date</th>
                <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px">Description</th>
                <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px">Buyer</th>
                <th style="text-align:right; border-bottom:1px solid #ddd; padding:6px">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${(json.transactions || []).map((t:any)=>
                `<tr>
                  <td style=\"padding:6px; border-bottom:1px solid #f0f0f0\">${t.date}</td>
                  <td style=\"padding:6px; border-bottom:1px solid #f0f0f0\">${t.description || 'Program'}</td>
                  <td style=\"padding:6px; border-bottom:1px solid #f0f0f0\">${t.buyerEmail || t.buyerId || ''}</td>
                  <td style=\"padding:6px; text-align:right; border-bottom:1px solid #f0f0f0\">$${(t.amount || 0).toFixed(2)}</td>
                </tr>`
              ).join('')}
            </tbody>
          </table>
        </div>
      `;
      const opt:any = { margin: 0.5, filename: `pulse-statement-${monthKey}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: {}, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
      const html2pdf = (await import('html2pdf.js')).default as any;
      html2pdf().from(container).set(opt).save();
    } catch (e) {
      console.error('Download failed', e);
    } finally {
      setDownloadingMonth(null);
    }
  };

  useEffect(() => {
    const loadReferred = async () => {
      try {
        if (!currentUser?.id) return;
        setReferredLoading(true);
        const coaches = await coachService.getConnectedCoachesForCoach(currentUser.id);
        const ATHLETE_MONTHLY = PRICING_INFO.ATHLETE.MONTHLY.amount;
        const rows: ReferredCoach[] = await Promise.all(
          coaches.map(async (c: any) => {
            const athletes = await coachService.getConnectedAthletes(c.userId);
            let active = 0;
            const byPlan: Map<string, { count: number; monthlyCents: number; subtotalCents: number }> = new Map();
            await Promise.all(
              athletes.map(async (a: any) => {
                try {
                  const sref = doc(db, 'subscriptions', a.id);
                  const sdoc = await getDoc(sref);
                  let isActive = false;
                  let planType: string | null = null;
                  if (sdoc.exists()) {
                    const sd: any = sdoc.data();
                    const plans: any[] = Array.isArray(sd?.plans) ? sd.plans : [];
                    plans.sort((x, y) => (y?.expiration || 0) - (x?.expiration || 0));
                    const latest = plans[0];
                    if (latest) {
                      planType = latest.type || null;
                      isActive = typeof latest.expiration === 'number' && latest.expiration > Math.floor(Date.now() / 1000);
                    }
                  }
                  if (!planType) {
                    const status = await subscriptionService.ensureActiveOrSync(a.id);
                    isActive = !!status.isActive;
                  }
                  if (isActive) {
                    active += 1;
                    const t = (planType || '').toString().toLowerCase();
                    let monthlyCents = 0;
                    if (t.includes('beta_grant')) monthlyCents = 0;
                    else if (t.startsWith('pulsecheck-')) monthlyCents = t.includes('annual') ? Math.round(PRICING_INFO.ATHLETE.ANNUAL.amount / 12) : PRICING_INFO.ATHLETE.MONTHLY.amount;
                    else if (t.includes('pc_1y')) monthlyCents = Math.round(PRICING_INFO.ATHLETE.ANNUAL.amount / 12);
                    else if (t.includes('pc_1m') || t.includes('pc_m') || t.includes('pc_month')) monthlyCents = PRICING_INFO.ATHLETE.MONTHLY.amount;
                    const label = planType || 'Unknown';
                    const prev = byPlan.get(label) || { count: 0, monthlyCents, subtotalCents: 0 };
                    prev.count += 1;
                    prev.monthlyCents = monthlyCents;
                    prev.subtotalCents += monthlyCents;
                    byPlan.set(label, prev);
                  }
                } catch (_) {}
              })
            );
            const mrr = Array.from(byPlan.values()).reduce((s, v) => s + v.subtotalCents, 0);
            const yourShare = Math.round(mrr * 0.08);
            return {
              coachUserId: c.userId,
              username: c.username,
              email: c.email,
              totalAthletes: athletes.length,
              activeAthletes: active,
              estimatedMRRCents: mrr,
              yourShareCents: yourShare,
              breakdown: Array.from(byPlan.entries()).map(([plan, v]) => ({ plan, count: v.count, monthlyCents: v.monthlyCents, subtotalCents: v.subtotalCents }))
            } as ReferredCoach;
          })
        );
        rows.sort((a, b) => b.activeAthletes - a.activeAthletes);
        setReferred(rows);
      } finally {
        setReferredLoading(false);
      }
    };
    loadReferred();
  }, [currentUser?.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-400';
      case 'pending': return 'bg-yellow-500/10 text-yellow-400';
      case 'processing': return 'bg-blue-500/10 text-blue-400';
      default: return 'bg-zinc-700 text-zinc-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading revenue data...</div>
      </div>
    );
  }

  return (
    <>
      <PageHead 
        metaData={{
          pageId: "coach-revenue",
          pageTitle: "Revenue & Earnings - Coach Dashboard",
          metaDescription: "Track your coaching revenue, view payout history, and analyze your earnings growth.",
          lastUpdated: new Date().toISOString()
        }}
        pageOgUrl="https://fitwithpulse.ai/coach/revenue"
      />
      
      <CoachLayout>
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            
            {/* Page Header (static) */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white">Revenue & Earnings</h1>
                  <p className="text-zinc-400 mt-2">Track your coaching revenue and manage payouts</p>
                </div>
              </div>
            </div>

            {/* Overview (not affected by filter) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-[#E0FE10]/10 rounded-lg">
                    <FaDollarSign className="h-6 w-6 text-[#E0FE10]" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${
                    monthlyGrowth >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {monthlyGrowth >= 0 ? <FaArrowUp className="h-3 w-3" /> : <FaArrowDown className="h-3 w-3" />}
                    {Math.abs(monthlyGrowth).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">This Month</p>
                  <p className="text-2xl font-bold text-white">${thisMonthTotal.toFixed(2)}</p>
                  <p className="text-zinc-500 text-xs mt-1">vs ${prevMonthTotal.toFixed(2)} last month</p>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <FaChartLine className="h-6 w-6 text-green-400" />
                  </div>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">All‑Time Earnings</p>
                  <p className="text-2xl font-bold text-white">${allTimeTotal.toFixed(2)}</p>
                  <p className="text-zinc-500 text-xs mt-1">Sum of all transactions</p>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <FaCalendarAlt className="h-6 w-6 text-blue-400" />
                  </div>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">Available Balance</p>
                  <p className="text-2xl font-bold text-white">${(earnings?.totalBalance || 0).toFixed(2)}</p>
                  <p className="text-zinc-500 text-xs mt-1">Withdraw anytime from Stripe dashboard</p>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <FaDollarSign className="h-6 w-6 text-purple-400" />
                  </div>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">Avg Monthly (All‑Time)</p>
                  <p className="text-2xl font-bold text-white">${avgMonthlyAllTime.avg.toFixed(2)}</p>
                  <p className="text-zinc-500 text-xs mt-1">Over {avgMonthlyAllTime.months} months</p>
                </div>
              </div>
            </div>

            {/* Filter toolbar (affects sections below) */}
            <div className="flex items-center justify-end gap-4 mb-6">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as any)}
                className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-[#E0FE10] transition-colors"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last 12 months</option>
                <option value="all">All time</option>
              </select>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-lg font-medium hover:bg-[#d0ee00] transition-colors">
                <FaDownload className="h-4 w-4" />
                Export Report
              </button>
            </div>

            {/* Filtered summary (sensitive to dropdown) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <FaDollarSign className="h-6 w-6 text-purple-400" />
                  </div>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">Time Period</p>
                  <p className="text-2xl font-bold text-white">${timePeriodTotal.toFixed(2)}</p>
                  <p className="text-zinc-500 text-xs mt-1">Based on selected filter</p>
                </div>
              </div>
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <FaDollarSign className="h-6 w-6 text-purple-400" />
                  </div>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">Transactions (Period)</p>
                  <p className="text-2xl font-bold text-white">{timePeriodCount}</p>
                  <p className="text-zinc-500 text-xs mt-1">Avg per transaction: ${timePeriodAvg.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              
              {/* Revenue Sources */}
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <h2 className="text-xl font-semibold text-white mb-6">Revenue Sources</h2>
                
                <div className="space-y-4">
                  {/* Athlete Subscriptions collapsible */}
                  <button onClick={() => setSubsOpen(!subsOpen)} className="w-full flex items-center justify-between p-4 bg-zinc-800 rounded-lg text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-[#E0FE10] rounded-full"></div>
                      <span className="text-white">Athlete Subscriptions</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`transition-transform ${subsOpen ? 'rotate-90' : ''}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18l6-6-6-6" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <div className="text-right">
                      <p className="text-white font-semibold">${currentMonth.athleteRevenue.toFixed(2)}</p>
                      <p className="text-zinc-400 text-sm">
                        {currentMonth.totalRevenue > 0 ? ((currentMonth.athleteRevenue / currentMonth.totalRevenue) * 100).toFixed(1) + '%' : '—'}
                      </p>
                      </div>
                    </div>
                  </button>

                  {subsOpen && (
                    <div className="bg-zinc-800/60 rounded-lg p-3 max-h-80 overflow-y-auto">
                      {athleteLoading ? (
                        <div className="text-zinc-400 text-sm p-3">Loading athletes…</div>
                      ) : athleteSubs.length === 0 ? (
                        <div className="text-zinc-400 text-sm p-3">No connected athletes yet.</div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-zinc-400">
                              <th className="text-left py-2 px-2">Athlete</th>
                              <th className="text-left py-2 px-2">Plan</th>
                              <th className="text-left py-2 px-2">Status</th>
                              <th className="text-left py-2 px-2">Expires</th>
                              <th className="text-right py-2 px-2">Amount</th>
                              <th className="text-right py-2 px-2">Coach 40%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {athleteSubs.map(a => {
                              const share = Math.round(a.monthlyCents * 0.4);
                              return (
                                <tr key={a.athleteUserId} className="border-t border-zinc-700/40">
                                  <td className="py-2 px-2 text-white">{a.displayName || a.username || a.athleteUserId.slice(0,6)}</td>
                                  <td className="py-2 px-2 text-zinc-300">{a.planType || '—'}</td>
                                  <td className="py-2 px-2">
                                    <span className={`px-2 py-1 rounded text-xs ${a.isActive ? 'bg-green-600/20 text-green-300 border border-green-700/40' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>{a.isActive ? 'Active' : 'Inactive'}</span>
                                  </td>
                                  <td className="py-2 px-2 text-zinc-300">{a.expiration ? a.expiration.toLocaleDateString() : '—'}</td>
                                  <td className="py-2 px-2 text-right text-white">{a.monthlyCents ? `$${(a.monthlyCents/100).toFixed(2)}` : '—'}</td>
                                  <td className="py-2 px-2 text-right text-white">{a.monthlyCents ? `$${(share/100).toFixed(2)}` : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  <button onClick={() => setReferralOpen(!referralOpen)} className="w-full flex items-center justify-between p-4 bg-zinc-800 rounded-lg text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                      <span className="text-white">Referral Bonuses</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`transition-transform ${referralOpen ? 'rotate-90' : ''}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18l6-6-6-6" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <div className="text-right">
                      <p className="text-white font-semibold">${currentMonth.referralRevenue.toFixed(2)}</p>
                      <p className="text-zinc-400 text-sm">
                        {currentMonth.totalRevenue > 0 ? ((currentMonth.referralRevenue / currentMonth.totalRevenue) * 100).toFixed(1) + '%' : '—'}
                      </p>
                      </div>
                    </div>
                  </button>

                  {referralOpen && (
                    <div className="bg-zinc-800/60 rounded-lg p-3 max-h-80 overflow-y-auto">
                      {referredLoading ? (
                        <div className="text-zinc-400 text-sm p-3">Loading referred coaches…</div>
                      ) : referred.length === 0 ? (
                        <div className="text-zinc-400 text-sm p-3">No connected coaches yet.</div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-zinc-400">
                              <th className="text-left py-2 px-2">Coach</th>
                              <th className="text-left py-2 px-2">Active Athletes</th>
                              <th className="text-left py-2 px-2">Total Athletes</th>
                              <th className="text-right py-2 px-2">Est. MRR</th>
                              <th className="text-right py-2 px-2">Your 20%</th>
                              <th className="text-right py-2 px-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {referred.map(rc => (
                              <>
                              <tr key={rc.coachUserId} className="border-t border-zinc-700/40">
                                <td className="py-2 px-2 text-white">{rc.username || rc.email || rc.coachUserId.slice(0,6)}</td>
                                <td className="py-2 px-2 text-zinc-300">{rc.activeAthletes}</td>
                                <td className="py-2 px-2 text-zinc-300">{rc.totalAthletes}</td>
                                <td className="py-2 px-2 text-right text-white">${(rc.estimatedMRRCents/100).toFixed(2)}</td>
                                <td className="py-2 px-2 text-right text-white">${(rc.yourShareCents/100).toFixed(2)}</td>
                                <td className="py-2 px-2 text-right">
                                  <button onClick={()=> setExpandedCoach(expandedCoach === rc.coachUserId ? null : rc.coachUserId)} className="px-2 py-1 rounded-md border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700/40 text-xs">{expandedCoach === rc.coachUserId ? 'Hide' : 'View details'}</button>
                                </td>
                              </tr>
                              {expandedCoach === rc.coachUserId && rc.breakdown && (
                                <tr className="bg-zinc-900/40">
                                  <td colSpan={6} className="p-2">
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="text-zinc-400">
                                            <th className="text-left py-2 px-2">Plan</th>
                                            <th className="text-left py-2 px-2">Athletes</th>
                                            <th className="text-right py-2 px-2">Price (mo)</th>
                                            <th className="text-right py-2 px-2">Subtotal</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rc.breakdown.map((b, i) => (
                                            <tr key={i} className="border-t border-zinc-800">
                                              <td className="py-2 px-2 text-white">{b.plan}</td>
                                              <td className="py-2 px-2 text-zinc-300">{b.count}</td>
                                              <td className="py-2 px-2 text-right text-zinc-300">${(b.monthlyCents/100).toFixed(2)}</td>
                                              <td className="py-2 px-2 text-right text-white">${(b.subtotalCents/100).toFixed(2)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                              </>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 p-4 bg-zinc-800/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <FaInfoCircle className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-white text-sm font-medium">Revenue Share Model</p>
                      <p className="text-zinc-400 text-xs mt-1">
                        You earn 40% from athlete subscriptions and 20% from referred coaches' <span className="underline decoration-dotted">subscription</span> revenue.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Transactions (from unified earnings - same as profile) */}
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <h2 className="text-xl font-semibold text-white mb-6">Recent Transactions</h2>
                {(!earnings || !earnings.recentSales) ? (
                  <div className="text-zinc-400">Loading transactions…</div>
                ) : filteredRecentSales.length === 0 ? (
                  <div className="text-zinc-400">No transactions yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-400">
                          <th className="text-left py-3 px-2">Buyer</th>
                          <th className="text-left py-3 px-2">Service</th>
                          <th className="text-left py-3 px-2">Date</th>
                          <th className="text-right py-3 px-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(filteredRecentSales as any[]).slice(0, 20).map((s: any, idx: number) => {
                          const buyer = buyers[s.buyerId] || {};
                          const buyerLabel = (buyer.username && buyer.username.length ? buyer.username : '')
                            || (buyer.email && buyer.email.length ? buyer.email : '')
                            || (s.buyerId && s.buyerId !== 'anonymous' && s.buyerId !== 'unknown' ? s.buyerId : '');
                          // Normalize date: prefer s.date; else convert Stripe/Unix timestamps
                          let displayDate = s.date;
                          if (!displayDate) {
                            const raw = s.created ?? s.createdAt ?? s.timestamp;
                            if (raw != null) {
                              const num = typeof raw === 'string' ? parseFloat(raw) : raw;
                              const ms = num < 10000000000 ? num * 1000 : num; // seconds -> ms
                              const d = new Date(ms);
                              if (!isNaN(d.valueOf())) displayDate = d.toISOString().split('T')[0];
                            }
                          }
                          return (
                            <tr key={idx} className="border-b border-zinc-800">
                              <td className="py-2 px-2 text-white">{buyerLabel}</td>
                              <td className="py-2 px-2 text-zinc-300">{s.roundTitle || 'Service'}</td>
                              <td className="py-2 px-2 text-zinc-400">{displayDate || '-'}</td>
                              <td className="py-2 px-2 text-right text-white">${(s.amount || 0).toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Payout History */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="p-6 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Payout History</h2>
                  <div className="text-xs text-zinc-500">Statements available on the 1st for the previous month</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="text-left py-4 px-6 text-zinc-300 font-medium">Date</th>
                      <th className="text-left py-4 px-6 text-zinc-300 font-medium">Amount</th>
                      <th className="text-left py-4 px-6 text-zinc-300 font-medium">Method</th>
                      <th className="text-left py-4 px-6 text-zinc-300 font-medium">Status</th>
                      <th className="text-right py-4 px-6 text-zinc-300 font-medium">Statement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutHistory.map((payout, index) => {
                      const d = new Date(payout.date);
                      const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                      const isPastMonth = new Date(d.getFullYear(), d.getMonth()+1, 1) <= new Date();
                      return (
                      <tr key={payout.id} className={index % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-800/50'}>
                        <td className="py-4 px-6">
                          <span className="text-white">
                            {new Date(payout.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-white font-semibold">${payout.amount.toFixed(2)}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-zinc-400">{payout.method}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payout.status)}`}>
                            {payout.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            disabled={!isPastMonth || downloadingMonth === monthKey}
                            onClick={() => downloadStatement(monthKey)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${isPastMonth ? 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700' : 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed'}`}
                          >
                            {downloadingMonth === monthKey ? 'Preparing…' : 'Download PDF'}
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {payoutHistory.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-zinc-400 text-lg">No payouts yet</p>
                  <p className="text-zinc-500 text-sm mt-2">
                    Your first payout will appear here once you start earning revenue
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CoachLayout>
    </>
  );
};

export default CoachRevenue;
