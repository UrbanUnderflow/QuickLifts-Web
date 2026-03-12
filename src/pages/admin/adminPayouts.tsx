import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { DollarSign, Search, Wallet, TrendingUp, History, ExternalLink, Activity, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';

type CreatorWallet = {
    userId: string;
    email: string;
    displayName: string;
    username: string;
    walletBalance: number;
    stripeAccountId?: string;
    historicEarnings: number;
};

type PayoutRecord = {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    strategy: string;
    createdAt: number;
    status: string;
};

const AdminPayouts: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [wallets, setWallets] = useState<CreatorWallet[]>([]);
    const [payoutLogs, setPayoutLogs] = useState<PayoutRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'balances' | 'history'>('balances');

    const fetchWalletsAndPayouts = async () => {
        setLoading(true);
        try {
            const usersRef = collection(db, 'users');
            // Fetch users who have videoCount > 0 or have a creator object (for now we fetch all and filter client side, or just fetching creators)
            const snapshot = await getDocs(query(usersRef, orderBy('createdAt', 'desc')));

            const creatorWallets: CreatorWallet[] = [];

            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                // Since we haven't built the wallet natively yet, we will safely parse it if it exists
                const creatorData = data.creator || {};

                // Only include if they have a balance or have a connected stripe account or historic earnings
                // We will display all users who are marked as creators (videoCount > 0)
                if (data.videoCount > 0 || creatorData.walletBalance > 0 || creatorData.stripeAccountId) {
                    creatorWallets.push({
                        userId: docSnap.id,
                        email: data.email || 'N/A',
                        displayName: data.displayName || 'Unknown',
                        username: data.username || 'unknown',
                        walletBalance: creatorData.walletBalance || 0.0,
                        historicEarnings: creatorData.historicEarnings || 0.0,
                        stripeAccountId: creatorData.stripeAccountId
                    });
                }
            });

            setWallets(creatorWallets);

            // Fetch payout records
            const payoutsRef = collection(db, 'payoutRecords');
            const payoutsSnapshot = await getDocs(query(payoutsRef, orderBy('createdAt', 'desc')));
            const logs: PayoutRecord[] = [];

            payoutsSnapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                logs.push({
                    id: docSnap.id,
                    userId: data.userId,
                    amount: data.amount || 0,
                    currency: data.currency || 'usd',
                    strategy: data.strategy || '',
                    createdAt: data.createdAt || 0,
                    status: data.results && data.results.length > 0 ? (data.results.some((r: any) => !r.success) ? 'Failed' : 'Success') : 'Pending',
                });
            });

            setPayoutLogs(logs);
        } catch (error) {
            console.error('Error fetching creator wallets:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWalletsAndPayouts();
    }, []);

    const filteredWallets = wallets.filter(w =>
        w.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPlatformBalance = wallets.reduce((acc, curr) => acc + curr.walletBalance, 0);

    return (
        <AdminRouteGuard>
            <Head>
                <title>Payout Dashboard | Pulse Admin</title>
            </Head>

            <div className="min-h-screen bg-[#111417] text-white p-6">
                <div className="max-w-7xl mx-auto space-y-6">

                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Wallet className="text-[#d7ff00] w-7 h-7" />
                                Creator Payout Dashboard
                            </h1>
                            <p className="text-zinc-400 mt-1">Monitor creator wallet balances and Stripe withdrawals.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <div className="bg-[#1a1e24] p-6 rounded-xl border border-zinc-800 shadow-sm relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-zinc-400 text-sm font-medium mb-1 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-[#d7ff00]" />
                                    Total Outstanding Platform Balance
                                </p>
                                <h3 className="text-3xl font-bold text-white">${totalPlatformBalance.toFixed(2)}</h3>
                                <p className="text-xs text-zinc-500 mt-2">Liquid funds waiting to be withdrawn by creators</p>
                            </div>
                        </div>

                        <div className="bg-[#1a1e24] p-6 rounded-xl border border-zinc-800 shadow-sm relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-zinc-400 text-sm font-medium mb-1 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                                    Creators Ready for Payout
                                </p>
                                <h3 className="text-3xl font-bold text-white">{wallets.filter(w => w.walletBalance > 0).length}</h3>
                                <p className="text-xs text-zinc-500 mt-2">Creators with a balance &gt; $0.00</p>
                            </div>
                        </div>

                        <div className="bg-[#1a1e24] p-6 rounded-xl border border-zinc-800 shadow-sm relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-zinc-400 text-sm font-medium mb-1 flex items-center gap-2">
                                    <ExternalLink className="w-4 h-4 text-blue-400" />
                                    Connected Stripe Accounts
                                </p>
                                <h3 className="text-3xl font-bold text-white">{wallets.filter(w => w.stripeAccountId).length}</h3>
                                <p className="text-xs text-zinc-500 mt-2">Creators who have finished Stripe Connect onboarding</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1a1e24] rounded-xl border border-zinc-800 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex bg-[#262a30] p-1 rounded-lg">
                                <button
                                    onClick={() => setActiveTab('balances')}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'balances'
                                        ? 'bg-[#1a1e24] text-[#d7ff00] shadow-sm border border-zinc-700'
                                        : 'text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    Creator Balances
                                </button>
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'history'
                                        ? 'bg-[#1a1e24] text-[#d7ff00] shadow-sm border border-zinc-700'
                                        : 'text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    Withdrawal History
                                </button>
                            </div>

                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder="Search creators..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-[#111417] border border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#d7ff00]"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto">
                            {activeTab === 'balances' ? (
                                <table className="w-full text-left text-sm text-zinc-300">
                                    <thead className="bg-[#161a1f] text-xs uppercase text-zinc-400 border-b border-zinc-800/80">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Creator</th>
                                            <th className="px-6 py-4 font-medium text-right">Available Wallet Balance</th>
                                            <th className="px-6 py-4 font-medium text-right">Historic Lifetime Earnings</th>
                                            <th className="px-6 py-4 font-medium">Stripe Status</th>
                                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                                                    <Activity className="w-6 h-6 animate-spin mx-auto mb-2 text-[#d7ff00]" />
                                                    Loading wallets...
                                                </td>
                                            </tr>
                                        ) : filteredWallets.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                                                    No creators found matching your search.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredWallets
                                                .sort((a, b) => b.walletBalance - a.walletBalance)
                                                .map((wallet) => (
                                                    <tr key={wallet.userId} className="hover:bg-zinc-800/30 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300">
                                                                    {wallet.username.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium text-white">{wallet.displayName}</div>
                                                                    <div className="text-xs text-zinc-500">@{wallet.username}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className="inline-flex items-center font-bold text-white text-base">
                                                                ${wallet.walletBalance.toFixed(2)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className="text-zinc-400">
                                                                ${wallet.historicEarnings.toFixed(2)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {wallet.stripeAccountId ? (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                    <CheckCircle className="w-3 h-3 mr-1" /> Connected
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                                                                    Pending Setup
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button className="text-blue-400 hover:text-blue-300 text-xs font-medium flex items-center justify-end gap-1 ml-auto">
                                                                Details <ArrowUpRight className="w-3 h-3" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full text-left text-sm text-zinc-300">
                                    <thead className="bg-[#161a1f] text-xs uppercase text-zinc-400 border-b border-zinc-800/80">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Date</th>
                                            <th className="px-6 py-4 font-medium">Creator</th>
                                            <th className="px-6 py-4 font-medium">Amount</th>
                                            <th className="px-6 py-4 font-medium">Strategy</th>
                                            <th className="px-6 py-4 font-medium text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                                                    <Activity className="w-6 h-6 animate-spin mx-auto mb-2 text-[#d7ff00]" />
                                                    Loading history...
                                                </td>
                                            </tr>
                                        ) : payoutLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                                                    <History className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                                                    No withdrawal history found.
                                                </td>
                                            </tr>
                                        ) : (
                                            payoutLogs.map((log) => {
                                                const creator = wallets.find(w => w.userId === log.userId);
                                                return (
                                                    <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            {log.createdAt ? format(new Date(log.createdAt * 1000), 'MMM d, yyyy h:mm a') : 'Unknown'}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {creator ? (
                                                                <div className="flex items-center gap-3">
                                                                    <div>
                                                                        <div className="font-medium text-white">{creator.displayName}</div>
                                                                        <div className="text-xs text-zinc-500">@{creator.username}</div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-zinc-500">Unknown Creator</div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="font-bold text-white text-base">
                                                                ${log.amount.toFixed(2)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded border border-zinc-700">
                                                                {log.strategy.replace('_', ' ')}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${log.status === 'Success'
                                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                                : log.status === 'Failed'
                                                                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                                }`}>
                                                                {log.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </AdminRouteGuard>
    );
};

// Simple stub for CheckCircle to avoid extending imports heavily
const CheckCircle = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

export default AdminPayouts;
