import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
    Users,
    Search,
    RefreshCw,
    Copy,
    ChevronLeft,
    ChevronRight,
    Download,
    Filter,
    Info,
    XCircle as XCircleIcon,
    Upload,
    CheckCircle,
    Loader2,
    Send,
    CheckSquare,
    Square,
    Activity,
    Target,
    Utensils,
    Dumbbell,
    Calendar,
    X,
    ArrowLeft
} from 'lucide-react';
import {
    collection,
    getDocs,
    doc,
    writeBatch,
    serverTimestamp,
    query,
    orderBy,
    limit,
    startAfter,
    getCountFromServer,
    QueryDocumentSnapshot,
    DocumentData,
    where,
    QueryConstraint
} from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FitnessSeekerLead {
    id: string;
    name: string | null;
    email: string | null;
    username: string | null;
    uid: string | null;
    gender: string | null;
    birthdate: number | null;
    height: number | null;
    weight: number | null;
    bodyFat: number | null;
    goal: string | null;
    focusArea: string | null;
    level: string | null;
    idlWeight: number | null;
    gainPerWeek: number | null;
    calorieReq: number | null;
    proteinReq: number | null;
    fatReq: number | null;
    dairyReq: number | null;
    fruitReq: number | null;
    grainReq: number | null;
    vegReq: number | null;
    LBM: number | null;
    lifestyleMultiplier: number | null;
    max: string | null;
    score: number | null;
    unit: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    migratedAt: any;
    sourceProject: string;
    [key: string]: any;
}

const PAGE_SIZE = 50;

// ─── Component ────────────────────────────────────────────────────────────────

const FitnessSeekerLeadsPage: React.FC = () => {
    const [leads, setLeads] = useState<FitnessSeekerLead[]>([]);
    const [loading, setLoading] = useState(true);

    // Server-side Pagination & Filtering State
    const [totalCount, setTotalCount] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageCursors, setPageCursors] = useState<QueryDocumentSnapshot<DocumentData>[]>([]);
    const [hasNextPage, setHasNextPage] = useState(true);

    // Filters
    const [goalFilter, setGoalFilter] = useState<string>('all');
    const [genderFilter, setGenderFilter] = useState<string>('all');
    const [showFilters, setShowFilters] = useState(false);

    // Modal States
    const [selectedLead, setSelectedLead] = useState<FitnessSeekerLead | null>(null);

    // Migration state
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationProgress, setMigrationProgress] = useState({ current: 0, total: 0 });
    const [migrationLog, setMigrationLog] = useState<string[]>([]);
    const [showMigrationModal, setShowMigrationModal] = useState(false);

    // Lead Selection
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [isAllSelected, setIsAllSelected] = useState(false);

    // Instantly Push State
    const [showInstantlyModal, setShowInstantlyModal] = useState(false);
    const [instantlyCampaignId, setInstantlyCampaignId] = useState('');
    const [isPushing, setIsPushing] = useState(false);
    const [pushResult, setPushResult] = useState<{ success: number; failed: number } | null>(null);

    const router = useRouter();

    // ─── Fetch Data (Server-Side Paginated) ──────────────────────────────────

    // Get total count once
    useEffect(() => {
        const fetchTotalCount = async () => {
            try {
                const snapshot = await getCountFromServer(collection(db, 'fitnessSeeker_leads'));
                setTotalCount(snapshot.data().count);
            } catch (err) {
                console.error("Failed to get total count", err);
            }
        };
        fetchTotalCount();
    }, []);

    const fetchLeads = async (pageIndex: number, clearCursors = false) => {
        setLoading(true);
        try {
            let constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

            // Note: Combining orderBy('createdAt') and where('goal') requires a composite index in Firestore.
            // If you haven't created one, standard server-side filtering with order might throw an error and provide a link to create it.
            if (goalFilter !== 'all') constraints.push(where('goal', '==', goalFilter));
            if (genderFilter !== 'all') constraints.push(where('gender', '==', genderFilter));

            // Handling pagination cursor
            if (pageIndex > 0 && !clearCursors && pageCursors[pageIndex - 1]) {
                constraints.push(startAfter(pageCursors[pageIndex - 1]));
            }

            // We fetch PAGE_SIZE + 1 to know if there's a next page
            constraints.push(limit(PAGE_SIZE + 1));

            const q = query(collection(db, 'fitnessSeeker_leads'), ...constraints);
            const snapshot = await getDocs(q);

            const docs = snapshot.docs;
            const hasMore = docs.length > PAGE_SIZE;

            // If we have more, we slice off the extra one used for the check
            const displayDocs = hasMore ? docs.slice(0, PAGE_SIZE) : docs;

            const fetchedLeads: FitnessSeekerLead[] = displayDocs.map((d) => ({
                id: d.id,
                ...d.data(),
            } as FitnessSeekerLead));

            setLeads(fetchedLeads);
            setHasNextPage(hasMore);

            // Save cursor for the *current* page so we can go to the *next* page
            if (displayDocs.length > 0) {
                const lastDoc = displayDocs[displayDocs.length - 1];
                setPageCursors(prev => {
                    const newCursors = clearCursors ? [] : [...prev];
                    newCursors[pageIndex] = lastDoc;
                    return newCursors;
                });
            }

            setCurrentPage(pageIndex);

            // Reset selection when changing pages
            setSelectedLeads(new Set());
            setIsAllSelected(false);

        } catch (error: any) {
            console.error('[Fitness Seeker Leads] Error fetching:', error);
            if (error.message && error.message.includes('requires an index')) {
                alert("Firestore requires an index to filter and sort at the same time. Check console for the creation link.");
            }
        } finally {
            setLoading(false);
        }
    };

    // Run fetch when filters change or initially
    useEffect(() => {
        fetchLeads(0, true);
    }, [goalFilter, genderFilter]);

    const handleNextPage = () => {
        if (hasNextPage) fetchLeads(currentPage + 1);
    };

    const handlePrevPage = () => {
        if (currentPage > 0) fetchLeads(currentPage - 1);
    };

    // ─── Migration ─────────────────────────────────────────────────────────────

    const runMigration = async () => {
        setIsMigrating(true);
        setMigrationLog([]);
        setMigrationProgress({ current: 0, total: 0 });

        const log = (msg: string) => {
            console.log(`[Migration] ${msg}`);
            setMigrationLog((prev) => [...prev, msg]);
        };

        try {
            log('Fetching users from bulk-dev-26ba8 Realtime Database...');
            const response = await fetch('https://bulk-dev-26ba8.firebaseio.com/User.json');
            if (!response.ok) throw new Error(`RTDB fetch failed: ${response.status}`);
            const data = await response.json();
            if (!data) {
                log('No data found in RTDB.');
                setIsMigrating(false);
                return;
            }

            const entries = Object.entries(data);
            const total = entries.length;
            log(`Fetched ${total.toLocaleString()} users from RTDB`);
            setMigrationProgress({ current: 0, total });

            const batchSize = 500;
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < entries.length; i += batchSize) {
                const batchEntries = entries.slice(i, i + batchSize);
                const batch = writeBatch(db);

                for (const [rtdbKey, userData] of batchEntries) {
                    const docRef = doc(db, 'fitnessSeeker_leads', rtdbKey);
                    const ud = userData as any;
                    const docData: Record<string, any> = {
                        rtdbKey,
                        name: ud.name || null,
                        email: ud.email || null,
                        uid: ud.uid || ud.objectId || null,
                        gender: ud.gender || null,
                        goal: ud.goal || null,
                        weight: ud.weight || null,
                        calorieReq: ud.calorieReq || null,
                        createdAt: ud.createdAt || null,
                        migratedAt: serverTimestamp(),
                        sourceProject: 'bulk-dev-26ba8',
                    };
                    batch.set(docRef, docData, { merge: true });
                }

                try {
                    await batch.commit();
                    successCount += batchEntries.length;
                    setMigrationProgress({ current: successCount, total });
                } catch (err: any) {
                    errorCount += batchEntries.length;
                    log(`⚠️ Batch error at offset ${i}: ${err.message}`);
                }
            }

            log(`✅ Migration complete! Success: ${successCount.toLocaleString()}, Errors: ${errorCount.toLocaleString()}`);
            fetchLeads(0, true);
        } catch (err: any) {
            log(`❌ Fatal error: ${err.message}`);
        } finally {
            setIsMigrating(false);
        }
    };

    // ─── Selection Helpers ─────────────────────────────────────────────────────

    const handleSelectAll = () => {
        if (isAllSelected) {
            setSelectedLeads(new Set());
            setIsAllSelected(false);
        } else {
            const newSelection = new Set<string>();
            leads.forEach(lead => {
                if (lead.email) newSelection.add(lead.id);
            });
            setSelectedLeads(newSelection);
            setIsAllSelected(true);
        }
    };

    const toggleSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(selectedLeads);
        if (next.has(id)) {
            next.delete(id);
            setIsAllSelected(false);
        } else {
            next.add(id);
        }
        setSelectedLeads(next);
    };

    const handlePushToInstantly = async () => {
        if (!instantlyCampaignId || selectedLeads.size === 0) return;

        setIsPushing(true);
        setPushResult(null);

        const leadsToPush = leads.filter(l => selectedLeads.has(l.id));

        try {
            const response = await fetch('/api/instantly/push-fitness-leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaignId: instantlyCampaignId,
                    leads: leadsToPush,
                }),
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to push leads');

            setPushResult({
                success: data.pushedCount,
                failed: data.failedCount,
            });

        } catch (error: any) {
            console.error(error);
            alert(error.message);
        } finally {
            setIsPushing(false);
        }
    };

    // ─── Formatting Helpers ────────────────────────────────────────────────────

    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // ─── Modals ────────────────────────────────────────────────────────────────

    const renderMigrationModal = () => {
        if (!showMigrationModal) return null;
        const pct = migrationProgress.total > 0 ? Math.round((migrationProgress.current / migrationProgress.total) * 100) : 0;

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                {/* Simple markup for migration modal to keep file size small */}
                <div className="bg-[#1a1e24] p-6 rounded-2xl border border-zinc-700 max-w-lg w-full">
                    <h2 className="text-white text-xl font-bold mb-4">Migrate Data</h2>
                    <div className="text-zinc-400 text-sm mb-4">Percentage: {pct}%</div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                        <button onClick={() => setShowMigrationModal(false)} className="px-4 py-2 bg-zinc-800 text-white rounded-lg">Close</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderInstantlyModal = () => {
        if (!showInstantlyModal) return null;

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-[#1a1e24] rounded-2xl max-w-lg w-full border border-zinc-700">
                    <div className="p-6 border-b border-zinc-800">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Send className="w-5 h-5 text-[#40c9ff]" />
                            Push to Instantly Campaign
                        </h2>
                        <p className="text-zinc-400 text-sm mt-1">
                            You are about to push <strong className="text-white">{selectedLeads.size}</strong> leads from this page.
                        </p>
                    </div>

                    <div className="p-6 space-y-4">
                        {pushResult ? (
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                                <h3 className="text-green-400 font-bold text-lg">Push Complete!</h3>
                                <p className="text-zinc-300 text-sm mt-1">
                                    Successfully pushed {pushResult.success} leads.<br />
                                    {pushResult.failed > 0 && <span className="text-red-400">Failed to push {pushResult.failed} leads.</span>}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Instantly Campaign ID</label>
                                <input
                                    type="text"
                                    value={instantlyCampaignId}
                                    onChange={e => setInstantlyCampaignId(e.target.value)}
                                    placeholder="e.g. 1a2b3c4d-5e6f-7g8h-9i0j..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-700 bg-[#111417] text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#40c9ff]/30 focus:border-[#40c9ff]/50 font-mono text-sm"
                                />
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-zinc-800 flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setShowInstantlyModal(false);
                                setPushResult(null);
                                if (pushResult && pushResult.success > 0) {
                                    setSelectedLeads(new Set());
                                    setIsAllSelected(false);
                                }
                            }}
                            className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors text-sm"
                            disabled={isPushing}
                        >
                            {pushResult ? 'Close' : 'Cancel'}
                        </button>
                        {!pushResult && (
                            <button
                                onClick={handlePushToInstantly}
                                disabled={!instantlyCampaignId || isPushing}
                                className="px-4 py-2 rounded-lg bg-[#40c9ff] text-black font-medium hover:bg-[#3bbaf0] transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPushing ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Pushing...</>
                                ) : (
                                    <><Send className="w-4 h-4" /> Push {selectedLeads.size} Leads</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderDetailModal = () => {
        if (!selectedLead) return null;
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-[#1a1e24] p-6 rounded-2xl border border-zinc-700 max-w-lg w-full">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-white text-xl font-bold">{selectedLead.name || 'Unknown User'}</h2>
                            <div className="text-zinc-400 text-sm">{selectedLead.email}</div>
                        </div>
                        <button onClick={() => setSelectedLead(null)} className="text-zinc-400 hover:text-white">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-3 mt-6">
                        <div className="flex justify-between border-b border-zinc-800 pb-2">
                            <span className="text-zinc-500 text-sm">Goal</span>
                            <span className="text-white text-sm">{selectedLead.goal || '—'}</span>
                        </div>
                        <div className="flex justify-between border-b border-zinc-800 pb-2">
                            <span className="text-zinc-500 text-sm">Weight</span>
                            <span className="text-white text-sm">{selectedLead.weight || '—'} lbs</span>
                        </div>
                        <div className="flex justify-between pb-2">
                            <span className="text-zinc-500 text-sm">Calories</span>
                            <span className="text-white text-sm">{selectedLead.calorieReq || '—'}</span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-zinc-800 mt-4">
                        {selectedLead.email && (
                            <button onClick={() => copyToClipboard(selectedLead.email!)} className="px-4 py-2 bg-zinc-800 text-white rounded-lg flex gap-2 text-sm items-center">
                                <Copy className="w-4 h-4" /> Copy Email
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )
    };

    // ─── Main Render ───────────────────────────────────────────────────────────

    return (
        <AdminRouteGuard>
            <Head>
                <title>Fitness Seeker Leads | Pulse Admin</title>
            </Head>
            <div className="min-h-screen bg-[#111417] text-white py-8 px-4">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.push('/admin')} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <span className="text-[#d7ff00]"><Users className="w-6 h-6" /></span>
                                    Fitness Seeker Leads
                                </h1>
                                <p className="text-zinc-500 text-sm mt-0.5">
                                    Firestore Database · {totalCount > 0 ? totalCount.toLocaleString() : '...'} total leads
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowMigrationModal(true)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1e24] border border-zinc-700 text-zinc-300 hover:text-white hover:bg-[#262a30] transition-colors text-sm"
                            >
                                <Upload className="w-4 h-4" /> Migrate Data
                            </button>
                            <button onClick={() => fetchLeads(currentPage, true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1e24] border border-zinc-700 text-zinc-300 hover:text-white hover:bg-[#262a30] transition-colors text-sm" disabled={loading}>
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                            </button>
                        </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm px-4 py-3 rounded-lg flex items-start gap-3 mb-6">
                        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <p>
                            <strong>Server-Side Pagination Active.</strong> To prevent your browser from crashing while rendering {totalCount > 0 ? totalCount.toLocaleString() : '100,000+'} leads and to save Firestore costs, we are only loading <strong>{PAGE_SIZE} rows at a time</strong>. <br className="hidden md:block" />
                            This means local search and analytics are limited to the current page. To mass-push entire goals (e.g., all 30k "Lose Weight" users) at once, we recommend requesting a dedicated Backend Bulk Push feature.
                        </p>
                    </div>

                    {/* Search & Filters */}
                    <div className="mb-6 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors ${showFilters || goalFilter !== 'all' || genderFilter !== 'all' ? 'border-[#d7ff00]/40 bg-[#d7ff00]/5 text-[#d7ff00]' : 'border-zinc-700 bg-[#1a1e24] text-zinc-400 hover:text-white'}`}
                            >
                                <Filter className="w-4 h-4" /> Filters
                                {(goalFilter !== 'all' || genderFilter !== 'all') && <span className="w-2 h-2 rounded-full bg-[#d7ff00]" />}
                            </button>
                        </div>

                        {showFilters && (
                            <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-[#1a1e24] border border-zinc-800">
                                <div>
                                    <label className="text-xs text-zinc-500 block mb-1">Goal (Case Sensitive)</label>
                                    <select value={goalFilter} onChange={(e) => setGoalFilter(e.target.value)} className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#d7ff00]">
                                        <option value="all">All Goals</option>
                                        <option value="Lose Weight">Lose Weight</option>
                                        <option value="Build Muscle">Build Muscle</option>
                                        <option value="Get Toned">Get Toned</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 block mb-1">Gender</label>
                                    <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#d7ff00]">
                                        <option value="all">All Genders</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                {(goalFilter !== 'all' || genderFilter !== 'all') && (
                                    <button onClick={() => { setGoalFilter('all'); setGenderFilter('all'); }} className="self-end px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white text-sm transition-colors">
                                        Clear filters
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-zinc-800 mb-6">
                        <div className="bg-[#1a1e24] p-3 border-b border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleSelectAll}
                                    className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded"
                                >
                                    {isAllSelected ? <CheckSquare className="w-5 h-5 text-[#d7ff00]" /> : <Square className="w-5 h-5" />}
                                    Select Page ({leads.filter(l => l.email).length})
                                </button>

                                {selectedLeads.size > 0 && (
                                    <span className="text-[#d7ff00] text-sm font-medium bg-[#d7ff00]/10 px-2.5 py-1 rounded-md">
                                        {selectedLeads.size} Selected
                                    </span>
                                )}
                            </div>

                            {selectedLeads.size > 0 && (
                                <button
                                    onClick={() => setShowInstantlyModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#40c9ff]/10 text-[#40c9ff] hover:bg-[#40c9ff]/20 transition-colors text-sm font-medium border border-[#40c9ff]/20"
                                >
                                    <Send className="w-4 h-4" /> Push ({selectedLeads.size}) to Instantly
                                </button>
                            )}
                        </div>

                        <table className="min-w-full">
                            <thead>
                                <tr className="bg-[#1a1e24] border-b border-zinc-800">
                                    <th className="px-4 py-3 w-10"></th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Email</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Gender</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Goal</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Weight</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Calories</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Created At</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {leads.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                                            {loading ? (
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                                                    <span>Loading leads...</span>
                                                </div>
                                            ) : "No leads found."}
                                        </td>
                                    </tr>
                                ) : (
                                    leads.map((lead) => (
                                        <tr
                                            key={lead.id}
                                            className={`hover:bg-[#1a1e24] transition-colors cursor-pointer ${selectedLeads.has(lead.id) ? 'bg-[#40c9ff]/5' : 'bg-[#111417]'}`}
                                            onClick={() => setSelectedLead(lead)}
                                        >
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => toggleSelection(lead.id, e)}
                                                    disabled={!lead.email}
                                                    className={`p-1 rounded transition-colors ${!lead.email ? 'opacity-30 cursor-not-allowed text-zinc-700' : selectedLeads.has(lead.id) ? 'text-[#d7ff00]' : 'text-zinc-600 hover:text-zinc-400'}`}
                                                >
                                                    {selectedLeads.has(lead.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#d7ff00]/20 to-[#40c9ff]/20 flex items-center justify-center text-xs font-bold text-[#d7ff00] flex-shrink-0">
                                                        {(lead.name || '?')[0]?.toUpperCase()}
                                                    </div>
                                                    <span className="text-white text-sm font-medium truncate max-w-[120px]">
                                                        {lead.name || '—'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-zinc-300 text-sm truncate max-w-[180px] block">{lead.email || '—'}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-zinc-400 text-sm capitalize">{lead.gender || '—'}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {lead.goal ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-[#d7ff00]/10 text-[#d7ff00] text-xs font-medium">
                                                        {lead.goal}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-500 text-sm">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-zinc-300 text-sm">{lead.weight != null ? `${lead.weight} lbs` : '—'}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-zinc-300 text-sm">{lead.calorieReq != null ? `${lead.calorieReq} kcal` : '—'}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-zinc-500 text-sm">{formatDate(lead.createdAt)}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}
                                                    className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors inline-block"
                                                >
                                                    <Info className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {leads.length > 0 && (
                        <div className="flex items-center justify-between bg-[#1a1e24] p-4 rounded-xl border border-zinc-800">
                            <span className="text-zinc-400 text-sm">
                                Showing Page {currentPage + 1}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={handlePrevPage}
                                    disabled={currentPage === 0 || loading}
                                    className="p-2 rounded-lg bg-[#111417] border border-zinc-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleNextPage}
                                    disabled={!hasNextPage || loading}
                                    className="p-2 rounded-lg bg-[#111417] border border-zinc-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {renderDetailModal()}
            {renderMigrationModal()}
            {renderInstantlyModal()}
        </AdminRouteGuard>
    );
};

export default FitnessSeekerLeadsPage;
