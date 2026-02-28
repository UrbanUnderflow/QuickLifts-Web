import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
    Users,
    Search,
    RefreshCw,
    Copy,
    FolderPlus,
    Play,
    Send,
    ArrowLeft,
    CheckCircle,
    XCircle,
    Clock,
    ExternalLink,
    Target,
    Trash2
} from 'lucide-react';
import { collection, getDocs, orderBy, query, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

export interface OutreachCampaign {
    id: string;
    title: string;
    totalLeads: number;
    verifiedLeads: number;
    failedLeads: number;
    pushedLeads: number;
    status: 'pending_verification' | 'verifying' | 'ready_to_push' | 'pushing' | 'completed';
    createdAt: string;
    updatedAt: string;
    instantlyCampaignId?: string;
    targetGoal?: string;
    targetGender?: string;
    targetLevel?: string;
    targetMinScore?: string | number;
    targetMinCalorieReq?: number;
}

const OutreachCampaignsPage: React.FC = () => {
    const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Refresh
    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'outreach_campaigns'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OutreachCampaign));
            setCampaigns(fetched);
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const handleVerify = async (campaignId: string) => {
        const confirmVerify = window.confirm("Are you sure you want to verify this campaign? (This process runs in the background and may take several minutes).");
        if (!confirmVerify) return;

        try {
            // Optimistically update the UI to Verifying state
            setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'verifying' } : c));

            // Trigger the background Netlify function
            const response = await fetch('/.netlify/functions/verify-outreach-campaign-background', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to start background verifier: ${response.status} ${errorText}`);
            }

            alert('Verification started! We will send an email via Brevo when it is complete. You can also occasionally refresh this page to see live updates.');
        } catch (err: any) {
            console.error(err);
            alert('Error triggering verify: ' + err.message);
            // Revert optimism
            fetchCampaigns();
        }
    };

    const handleDeleteCampaign = async (id: string) => {
        if (!confirm("Are you sure you want to delete this campaign? This cannot be undone.")) return;

        try {
            await deleteDoc(doc(db, 'outreach_campaigns', id));
            setCampaigns(prev => prev.filter(c => c.id !== id));
        } catch (error: any) {
            console.error('Failed to delete campaign:', error);
            alert('Failed to delete campaign: ' + error.message);
        }
    };

    const handlePushToInstantly = async (campaignId: string) => {
        const instantlyId = window.prompt("Enter the external Instantly Campaign ID to push to:");
        if (!instantlyId) return;

        try {
            // Optimistically update
            setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'pushing', instantlyCampaignId: instantlyId } : c));

            const response = await fetch('/.netlify/functions/push-outreach-campaign-background', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId, instantlyCampaignId: instantlyId })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to start pushing background worker: ${response.status} ${errorText}`);
            }

            alert('Push started! This runs in the background. Check back in a few minutes.');
        } catch (err: any) {
            console.error(err);
            alert('Error triggering push: ' + err.message);
            fetchCampaigns();
        }
    };

    const getStatusBadgeColor = (status: OutreachCampaign['status']) => {
        switch (status) {
            case 'pending_verification': return 'bg-zinc-800 text-zinc-400';
            case 'verifying': return 'bg-blue-500/10 text-blue-400';
            case 'ready_to_push': return 'bg-amber-500/10 text-amber-500';
            case 'pushing': return 'bg-purple-500/10 text-purple-400';
            case 'completed': return 'bg-emerald-500/10 text-emerald-400';
            default: return 'bg-zinc-800 text-zinc-400';
        }
    };

    const formatStatus = (status: OutreachCampaign['status']) => {
        return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    };

    return (
        <AdminRouteGuard>
            <Head>
                <title>Outreach Campaigns | Pulse Admin</title>
            </Head>
            <div className="min-h-screen bg-[#111417] text-white py-8 px-4">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.push('/admin')} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <span className="text-[#40c9ff]"><Target className="w-6 h-6" /></span>
                                    Outreach Campaigns
                                </h1>
                                <p className="text-zinc-500 text-sm mt-0.5">
                                    Manage lead verification and pushing stages to your external campaigns
                                </p>
                            </div>
                        </div>

                        <button onClick={fetchCampaigns} className="flex flex-shrink-0 items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1e24] border border-zinc-700 text-zinc-300 hover:text-white hover:bg-[#262a30] transition-colors text-sm" disabled={loading}>
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#1a1e24]">
                        <table className="min-w-full">
                            <thead>
                                <tr className="border-b border-zinc-800">
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Campaign Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Valid</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Dead</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Pushed</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Created</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {campaigns.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                                            {loading ? 'Loading...' : 'No outreach campaigns built yet. Go to Fitness Seeker Leads to start one.'}
                                        </td>
                                    </tr>
                                ) : (
                                    campaigns.map((camp) => (
                                        <tr key={camp.id} className="hover:bg-[#111417] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="text-white font-medium">{camp.title}</div>
                                                <div className="text-zinc-500 text-xs mt-1 font-mono">ID: {camp.id.substring(0, 8)}...</div>
                                                {(camp.targetGender || camp.targetLevel || camp.targetMinScore) && (
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                        {camp.targetGender && camp.targetGender !== 'all' && (
                                                            <span className="bg-zinc-800 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Gender: {camp.targetGender}</span>
                                                        )}
                                                        {camp.targetLevel && camp.targetLevel !== 'all' && (
                                                            <span className="bg-zinc-800 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Lvl: {camp.targetLevel}</span>
                                                        )}
                                                        {camp.targetMinScore && camp.targetMinScore !== '' ? (
                                                            <span className="bg-[#40c9ff]/10 text-[#40c9ff] text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Min Score: {camp.targetMinScore === 'top-500' ? 'Top 500' : camp.targetMinScore}</span>
                                                        ) : null}
                                                        {camp.targetMinCalorieReq ? (
                                                            <span className="bg-amber-500/10 text-amber-500 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Min Cal: {camp.targetMinCalorieReq}</span>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-current/20 whitespace-nowrap ${getStatusBadgeColor(camp.status)}`}>
                                                    {formatStatus(camp.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-white font-medium">{camp.totalLeads?.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-emerald-400">{camp.verifiedLeads?.toLocaleString() || 0}</td>
                                            <td className="px-6 py-4 text-rose-400">{camp.failedLeads?.toLocaleString() || 0}</td>
                                            <td className="px-6 py-4 text-purple-400 font-bold">{camp.pushedLeads?.toLocaleString() || 0}</td>
                                            <td className="px-6 py-4 text-zinc-400 text-sm whitespace-nowrap">{formatDate(camp.createdAt)}</td>
                                            <td className="px-6 py-4 text-center space-x-2">
                                                {camp.status === 'pending_verification' && (
                                                    <button
                                                        onClick={() => handleVerify(camp.id)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm font-medium"
                                                    >
                                                        <Play className="w-3.5 h-3.5" /> Verify
                                                    </button>
                                                )}
                                                {camp.status === 'verifying' && (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-zinc-400 text-sm font-medium">
                                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...
                                                    </span>
                                                )}
                                                {camp.status === 'ready_to_push' && (
                                                    <button
                                                        onClick={() => handlePushToInstantly(camp.id)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#40c9ff]/10 text-[#40c9ff] hover:bg-[#40c9ff]/20 transition-colors text-sm font-medium border border-[#40c9ff]/20"
                                                    >
                                                        <Send className="w-3.5 h-3.5" /> Push to Instantly
                                                    </button>
                                                )}
                                                {camp.status === 'pushing' && (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-purple-400 text-sm font-medium">
                                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Pushing...
                                                    </span>
                                                )}
                                                {camp.status === 'completed' && (
                                                    <>
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-sm font-medium rounded-lg">
                                                            <CheckCircle className="w-3.5 h-3.5" /> Published ({camp.instantlyCampaignId?.substring(0, 8) || 'No ID'})
                                                        </span>
                                                        {(camp.pushedLeads || 0) < (camp.verifiedLeads || 0) && (
                                                            <button
                                                                onClick={() => handlePushToInstantly(camp.id)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors text-sm font-medium border border-yellow-500/20"
                                                                title="Retry missing leads"
                                                            >
                                                                <RefreshCw className="w-3.5 h-3.5" /> Retry Push
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteCampaign(camp.id)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors text-sm font-medium"
                                                    title="Delete Campaign"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminRouteGuard>
    );
};

export default OutreachCampaignsPage;
