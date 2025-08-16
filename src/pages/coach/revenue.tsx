import React, { useState, useEffect } from 'react';
import { useUser } from '../../hooks/useUser';
import PageHead from '../../components/PageHead';
import CoachLayout from '../../components/CoachLayout';
import { 
  FaDollarSign, 
  FaChartLine, 
  FaCalendarAlt,
  FaDownload,
  FaInfoCircle,
  FaTrendUp,
  FaTrendDown
} from 'react-icons/fa';

interface RevenueData {
  month: string;
  totalRevenue: number;
  athleteRevenue: number;
  referralRevenue: number;
  payout: number;
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
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [loading, setLoading] = useState(true);

  // Mock data for initial implementation
  const [revenueData] = useState<RevenueData[]>([
    { month: 'Jan 2024', totalRevenue: 156.80, athleteRevenue: 104.00, referralRevenue: 52.80, payout: 156.80 },
    { month: 'Dec 2023', totalRevenue: 142.30, athleteRevenue: 89.50, referralRevenue: 52.80, payout: 142.30 },
    { month: 'Nov 2023', totalRevenue: 128.90, athleteRevenue: 76.10, referralRevenue: 52.80, payout: 128.90 },
    { month: 'Oct 2023', totalRevenue: 115.60, athleteRevenue: 62.80, referralRevenue: 52.80, payout: 115.60 },
    { month: 'Sep 2023', totalRevenue: 89.40, athleteRevenue: 36.60, referralRevenue: 52.80, payout: 89.40 },
    { month: 'Aug 2023', totalRevenue: 76.20, athleteRevenue: 23.40, referralRevenue: 52.80, payout: 76.20 },
  ]);

  const [payoutHistory] = useState<PayoutHistory[]>([
    { id: '1', date: '2024-01-01', amount: 156.80, status: 'completed', method: 'Bank Transfer' },
    { id: '2', date: '2023-12-01', amount: 142.30, status: 'completed', method: 'Bank Transfer' },
    { id: '3', date: '2023-11-01', amount: 128.90, status: 'completed', method: 'Bank Transfer' },
    { id: '4', date: '2023-10-01', amount: 115.60, status: 'completed', method: 'Bank Transfer' },
  ]);

  const currentMonth = revenueData[0];
  const previousMonth = revenueData[1];
  const monthlyGrowth = previousMonth ? 
    ((currentMonth.totalRevenue - previousMonth.totalRevenue) / previousMonth.totalRevenue) * 100 : 0;

  const totalEarned = revenueData.reduce((sum, month) => sum + month.totalRevenue, 0);
  const nextPayout = currentMonth.payout;

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 1000);
  }, []);

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
        title="Revenue & Earnings - Coach Dashboard"
        description="Track your coaching revenue, view payout history, and analyze your earnings growth."
        url="https://fitwithpulse.ai/coach/revenue"
      />
      
      <CoachLayout>
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white">Revenue & Earnings</h1>
                  <p className="text-zinc-400 mt-2">
                    Track your coaching revenue and manage payouts
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value as any)}
                    className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-[#E0FE10] transition-colors"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="1y">Last year</option>
                  </select>
                  <button className="flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-lg font-medium hover:bg-[#d0ee00] transition-colors">
                    <FaDownload className="h-4 w-4" />
                    Export Report
                  </button>
                </div>
              </div>
            </div>

            {/* Revenue Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-[#E0FE10]/10 rounded-lg">
                    <FaDollarSign className="h-6 w-6 text-[#E0FE10]" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${
                    monthlyGrowth >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {monthlyGrowth >= 0 ? <FaTrendUp className="h-3 w-3" /> : <FaTrendDown className="h-3 w-3" />}
                    {Math.abs(monthlyGrowth).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">This Month</p>
                  <p className="text-2xl font-bold text-white">${currentMonth.totalRevenue.toFixed(2)}</p>
                  <p className="text-zinc-500 text-xs mt-1">vs ${previousMonth.totalRevenue.toFixed(2)} last month</p>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <FaChartLine className="h-6 w-6 text-green-400" />
                  </div>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">Total Earned</p>
                  <p className="text-2xl font-bold text-white">${totalEarned.toFixed(2)}</p>
                  <p className="text-zinc-500 text-xs mt-1">All time earnings</p>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <FaCalendarAlt className="h-6 w-6 text-blue-400" />
                  </div>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">Next Payout</p>
                  <p className="text-2xl font-bold text-white">${nextPayout.toFixed(2)}</p>
                  <p className="text-zinc-500 text-xs mt-1">Expected: Feb 1, 2024</p>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <FaDollarSign className="h-6 w-6 text-purple-400" />
                  </div>
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">Avg Monthly</p>
                  <p className="text-2xl font-bold text-white">
                    ${(totalEarned / revenueData.length).toFixed(2)}
                  </p>
                  <p className="text-zinc-500 text-xs mt-1">Over {revenueData.length} months</p>
                </div>
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              
              {/* Revenue Sources */}
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <h2 className="text-xl font-semibold text-white mb-6">Revenue Sources</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-[#E0FE10] rounded-full"></div>
                      <span className="text-white">Athlete Subscriptions</span>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold">${currentMonth.athleteRevenue.toFixed(2)}</p>
                      <p className="text-zinc-400 text-sm">
                        {((currentMonth.athleteRevenue / currentMonth.totalRevenue) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                      <span className="text-white">Referral Bonuses</span>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold">${currentMonth.referralRevenue.toFixed(2)}</p>
                      <p className="text-zinc-400 text-sm">
                        {((currentMonth.referralRevenue / currentMonth.totalRevenue) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-zinc-800/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <FaInfoCircle className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-white text-sm font-medium">Revenue Share Model</p>
                      <p className="text-zinc-400 text-xs mt-1">
                        You earn 40% from athlete subscriptions and 20% from referred coaches' revenue.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Trend */}
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <h2 className="text-xl font-semibold text-white mb-6">Monthly Trend</h2>
                
                <div className="space-y-3">
                  {revenueData.slice(0, 6).map((month, index) => (
                    <div key={month.month} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{month.month}</p>
                        <p className="text-zinc-400 text-sm">
                          Athletes: ${month.athleteRevenue.toFixed(2)} • 
                          Referrals: ${month.referralRevenue.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">${month.totalRevenue.toFixed(2)}</p>
                        {index < revenueData.length - 1 && (
                          <p className={`text-xs ${
                            month.totalRevenue >= revenueData[index + 1].totalRevenue 
                              ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {month.totalRevenue >= revenueData[index + 1].totalRevenue ? '+' : ''}
                            {(month.totalRevenue - revenueData[index + 1].totalRevenue).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Payout History */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="p-6 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Payout History</h2>
                  <button className="text-[#E0FE10] hover:text-[#d0ee00] transition-colors">
                    View All
                  </button>
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
                    </tr>
                  </thead>
                  <tbody>
                    {payoutHistory.map((payout, index) => (
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
                      </tr>
                    ))}
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
