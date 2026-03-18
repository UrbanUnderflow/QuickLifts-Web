import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
    Users,
    Search,
    RefreshCw,
    Copy,
    ChevronLeft,
    ChevronRight,
    Filter,
    FolderPlus,
    Info,
    XCircle as XCircleIcon,
    Upload,
    CheckCircle,
    Loader2,
    CheckSquare,
    Square,
    Target,
    X,
    ArrowLeft,
    Trash2,
    Rocket
} from 'lucide-react';
import {
    collection,
    getDocs,
    doc,
    deleteDoc,
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

interface OutreachCampaign {
    id: string;
    title: string;
    targetGoal: string;
    targetGender: string;
    targetLevel?: string;
    targetMinScore?: string | number;
    targetMinCalorieReq?: number;
    totalLeads: number;
    status: string;
}

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
    const [searchQuery, setSearchQuery] = useState('');
    const [genderFilter, setGenderFilter] = useState<string>('all');
    const [levelFilter, setLevelFilter] = useState<string>('all');
    const [minScoreFilter, setMinScoreFilter] = useState<string>('');
    const [minCalorieReqFilter, setMinCalorieReqFilter] = useState<string>('');
    const [pageSize, setPageSize] = useState<number>(50);
    const [showFilters, setShowFilters] = useState(false);

    // Table Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: keyof FitnessSeekerLead; direction: 'asc' | 'desc' } | null>({ key: 'createdAt', direction: 'desc' });

    // Modal States
    const [selectedLead, setSelectedLead] = useState<FitnessSeekerLead | null>(null);

    // Migration state
    const [_isMigrating, setIsMigrating] = useState(false);
    const [migrationProgress, setMigrationProgress] = useState({ current: 0, total: 0 });
    const [_migrationLog, setMigrationLog] = useState<string[]>([]);
    const [showMigrationModal, setShowMigrationModal] = useState(false);

    // Lead Selection
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [isAllSelected, setIsAllSelected] = useState(false);

    // Campaign states
    const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
    const [activeCampaign, setActiveCampaign] = useState<OutreachCampaign | null>(null);

    // Create Campaign Wizard State
    const [showCreateWizard, setShowCreateWizard] = useState(false);
    const [wizardName, setWizardName] = useState('');
    const [wizardGender, setWizardGender] = useState('all');
    const [wizardLevel, setWizardLevel] = useState('all');
    const [wizardMinScore, setWizardMinScore] = useState('');
    const [wizardMinCalorieReq, setWizardMinCalorieReq] = useState('');
    const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

    // Add Leads to active campaign state
    const [isAddingLeads, setIsAddingLeads] = useState(false);
    const [addResult, setAddResult] = useState<{ success: number; failed: number } | null>(null);

    const router = useRouter();

    // ─── Fetch Data (Server-Side Paginated) ──────────────────────────────────

    // Get total count & outreach campaigns once
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Total count
                const snapshot = await getCountFromServer(collection(db, 'fitnessSeeker_leads'));
                setTotalCount(snapshot.data().count);

                // Campaigns
                const q = query(collection(db, 'outreach_campaigns'), orderBy('createdAt', 'desc'), limit(10));
                const campsSnap = await getDocs(q);
                const camps = campsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as OutreachCampaign));
                setCampaigns(camps);
            } catch (err) {
                console.error("Failed to fetch initial data", err);
            }
        };
        fetchInitialData();
    }, []);

    const handleSelectCampaign = (camp: OutreachCampaign | null) => {
        setActiveCampaign(camp);
        if (camp) {
            setGenderFilter(camp.targetGender);
            setLevelFilter(camp.targetLevel || 'all');
            setMinScoreFilter(camp.targetMinScore ? camp.targetMinScore.toString() : '');
            setMinCalorieReqFilter(camp.targetMinCalorieReq ? camp.targetMinCalorieReq.toString() : '');
            setShowFilters(true);
        } else {
            setGenderFilter('all');
            setLevelFilter('all');
            setMinScoreFilter('');
            setMinCalorieReqFilter('');
        }
    };

    const handleDeleteCampaign = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this campaign? This will not remove the leads, only the campaign filter itself.")) return;

        try {
            await deleteDoc(doc(db, 'outreach_campaigns', id));
            setCampaigns(prev => prev.filter(c => c.id !== id));
            if (activeCampaign?.id === id) {
                handleSelectCampaign(null);
            }
        } catch (error: any) {
            console.error('Failed to delete campaign:', error);
            alert('Failed to delete campaign: ' + error.message);
        }
    };

    const fetchLeads = async (pageIndex: number, clearCursors = false) => {
        setLoading(true);
        try {
            let constraints: QueryConstraint[] = [];

            // In Firestore, if we do an inequality filter like >=, we MUST sort by that field first.
            // Firestore ONLY allows ONE inequality field per query. We prioritize minScore over minCalorieReq if both are somehow set.
            const minCalorieReqNum = Number(minCalorieReqFilter);
            const qStr = searchQuery.trim();

            if (qStr !== '') {
                if (qStr.includes('@')) {
                    constraints.push(where('email', '==', qStr.toLowerCase()));
                    constraints.push(orderBy('createdAt', 'desc'));
                } else {
                    // Capitalize first letter (e.g., 'tremaine' -> 'Tremaine') to map matching Firestore names natively
                    const capitalizedStr = qStr.charAt(0).toUpperCase() + qStr.slice(1);
                    constraints.push(where('name', '>=', capitalizedStr));
                    constraints.push(where('name', '<=', capitalizedStr + '\uf8ff'));
                    constraints.push(orderBy('name', 'asc'));
                }
            } else if (minScoreFilter !== '') {
                if (minScoreFilter === 'top-500') {
                    constraints.push(orderBy('score', 'desc'));
                } else if (minScoreFilter.includes('-')) {
                    const [min, max] = minScoreFilter.split('-').map(Number);
                    if (!isNaN(min) && !isNaN(max)) {
                        constraints.push(where('score', '>=', min));
                        constraints.push(where('score', '<=', max));
                        constraints.push(orderBy('score', 'desc'));
                    }
                } else {
                    // Fallback to legacy strict numbers if loading old integer-based campaign configurations
                    const minScoreNum = Number(minScoreFilter);
                    if (!isNaN(minScoreNum) && minScoreNum > 0) {
                        constraints.push(where('score', '>=', minScoreNum));
                        constraints.push(orderBy('score', 'desc'));
                    } else {
                        constraints.push(orderBy('createdAt', 'desc'));
                    }
                }
            } else if (minCalorieReqFilter !== '' && !isNaN(minCalorieReqNum) && minCalorieReqNum > 0) {
                constraints.push(where('calorieReq', '>=', minCalorieReqNum));
                constraints.push(orderBy('calorieReq', 'desc'));
            } else {
                constraints.push(orderBy('createdAt', 'desc'));
            }

            if (genderFilter !== 'all') constraints.push(where('gender', '==', genderFilter));
            if (levelFilter !== 'all') constraints.push(where('level', '==', levelFilter));

            // Handling pagination cursor
            if (pageIndex > 0 && !clearCursors && pageCursors[pageIndex - 1]) {
                constraints.push(startAfter(pageCursors[pageIndex - 1]));
            }

            // We fetch pageSize + 1 to know if there's a next page
            constraints.push(limit(pageSize + 1));

            const q = query(collection(db, 'fitnessSeeker_leads'), ...constraints);
            const snapshot = await getDocs(q);

            const docs = snapshot.docs;
            const hasMore = docs.length > pageSize;

            // If we have more, we slice off the extra one used for the check
            const displayDocs = hasMore ? docs.slice(0, pageSize) : docs;

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

    const handleSort = (key: keyof FitnessSeekerLead) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedLeads = React.useMemo(() => {
        let sortableItems = [...leads];

        if (searchQuery.trim() !== '') {
            const lowerQuery = searchQuery.toLowerCase();
            sortableItems = sortableItems.filter(lead =>
                (lead.name && lead.name.toLowerCase().includes(lowerQuery)) ||
                (lead.email && lead.email.toLowerCase().includes(lowerQuery))
            );
        }

        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (aValue === undefined || aValue === null) aValue = '';
                if (bValue === undefined || bValue === null) bValue = '';

                if (sortConfig.key === 'createdAt') {
                    let aDate = new Date(aValue).getTime() || 0;
                    let bDate = new Date(bValue).getTime() || 0;
                    return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
                }

                // Handle numbers correctly instead of generic string comparisons
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [leads, sortConfig, searchQuery]);

    // Run fetch when filters change or initially
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchLeads(0, true);
        }, 500); // 500ms debounce to prevent database spam while typing search queries

        return () => clearTimeout(timeoutId);
    }, [genderFilter, levelFilter, minScoreFilter, minCalorieReqFilter, pageSize, searchQuery]);

    const handleNextPage = () => {
        if (hasNextPage) fetchLeads(currentPage + 1);
    };

    const handlePrevPage = () => {
        if (currentPage > 0) fetchLeads(currentPage - 1);
    };

    // ─── Migration ─────────────────────────────────────────────────────────────

    const _runMigration = async () => {
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
                if (lead.email && !lead.outreachCampaignId) newSelection.add(lead.id);
            });
            setSelectedLeads(newSelection);
            setIsAllSelected(true);
        }
    };

    const toggleSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const lead = leads.find(l => l.id === id);
        if (lead && lead.outreachCampaignId) return;

        const next = new Set(selectedLeads);
        if (next.has(id)) {
            next.delete(id);
            setIsAllSelected(false);
        } else {
            next.add(id);
        }
        setSelectedLeads(next);
    };

    const handleCreateCampaign = async () => {
        if (!wizardName) return;
        setIsCreatingCampaign(true);

        try {
            const response = await fetch('/api/outreach/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaignName: wizardName,
                    targetGender: wizardGender,
                    targetLevel: wizardLevel,
                    targetMinScore: wizardMinScore || '',
                    targetMinCalorieReq: parseInt(wizardMinCalorieReq) || 0
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to create campaign');

            setCampaigns([data.campaign, ...campaigns]);
            setActiveCampaign(data.campaign);
            setGenderFilter(data.campaign.targetGender);
            setLevelFilter(data.campaign.targetLevel || 'all');
            setMinScoreFilter(data.campaign.targetMinScore ? data.campaign.targetMinScore.toString() : '');
            setMinCalorieReqFilter(data.campaign.targetMinCalorieReq ? data.campaign.targetMinCalorieReq.toString() : '');

            setShowCreateWizard(false);
            setWizardName('');
            setWizardGender('all');
            setWizardLevel('all');
            setWizardMinScore('');
            setWizardMinCalorieReq('');

        } catch (error: any) {
            console.error(error);
            alert(error.message);
        } finally {
            setIsCreatingCampaign(false);
        }
    };

    const handleAddLeadsToCampaign = async () => {
        if (!activeCampaign || selectedLeads.size === 0) return;

        setIsAddingLeads(true);
        setAddResult(null);

        const leadsToAssign = leads.filter(l => selectedLeads.has(l.id)).map(l => ({ id: l.id, email: l.email }));

        try {
            const response = await fetch('/api/outreach/add-leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaignId: activeCampaign.id,
                    leads: leadsToAssign,
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to add leads');

            setAddResult({
                success: data.assignedCount,
                failed: data.failedCount || 0,
            });

            // Update local campaign count
            setCampaigns(prev => prev.map(c =>
                c.id === activeCampaign.id ? { ...c, totalLeads: c.totalLeads + data.assignedCount } : c
            ));
            setActiveCampaign(prev => prev ? { ...prev, totalLeads: prev.totalLeads + data.assignedCount } : null);

        } catch (error: any) {
            console.error(error);
            alert(error.message);
        } finally {
            setIsAddingLeads(false);
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

    const renderCreateWizardModal = () => {
        if (!showCreateWizard) return null;

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-[#1a1e24] rounded-2xl max-w-lg w-full border border-zinc-700 shadow-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-[#40c9ff]/20 to-[#40c9ff]/5 border-b border-zinc-800 p-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <FolderPlus className="w-6 h-6 text-[#40c9ff]" />
                            Create Outreach Campaign
                        </h2>
                        <p className="text-zinc-400 text-sm mt-2">
                            Set up filters to build a highly targeted outreach list. Your campaign will sit at the top for easy data gathering.
                        </p>
                    </div>

                    <div className="p-6 space-y-5">
                        <div>
                            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Campaign Name</label>
                            <input
                                type="text"
                                value={wizardName}
                                onChange={e => setWizardName(e.target.value)}
                                placeholder="e.g. Fit Women Bulk Leads"
                                className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-[#111417] text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#40c9ff]/40 focus:border-[#40c9ff]"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Target Gender</label>
                                <select
                                    value={wizardGender}
                                    onChange={e => setWizardGender(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-[#111417] text-white focus:outline-none focus:ring-2 focus:ring-[#40c9ff]/40 focus:border-[#40c9ff] appearance-none"
                                >
                                    <option value="all">Any</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Fitness Level</label>
                                <select
                                    value={wizardLevel}
                                    onChange={e => setWizardLevel(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-[#111417] text-white focus:outline-none focus:ring-2 focus:ring-[#40c9ff]/40 focus:border-[#40c9ff] appearance-none"
                                >
                                    <option value="all">Any</option>
                                    <option value="1">Beginner (1)</option>
                                    <option value="2">Intermediate (2)</option>
                                    <option value="3">Advanced (3)</option>
                                </select>
                            </div>
                            <div>
                                <label className={`text-sm font-medium mb-1.5 block ${wizardMinCalorieReq ? 'text-zinc-600' : 'text-zinc-300'}`}>Min Activity Score</label>
                                <select
                                    value={wizardMinScore}
                                    onChange={e => setWizardMinScore(e.target.value)}
                                    disabled={wizardMinCalorieReq !== ''}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-[#111417] text-white focus:outline-none focus:ring-2 focus:ring-[#40c9ff]/40 focus:border-[#40c9ff] appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">Any Score</option>
                                    <option value="0-500">0 - 500</option>
                                    <option value="500-1000">500 - 1000</option>
                                    <option value="1000-3000">1000 - 3000</option>
                                    <option value="3000-6000">3000 - 6000</option>
                                    <option value="6000-10000">6000 - 10000</option>
                                    <option value="top-500">Top 500</option>
                                </select>
                            </div>
                            <div>
                                <label className={`text-sm font-medium mb-1.5 block ${wizardMinScore ? 'text-zinc-600' : 'text-zinc-300'}`}>Min Calorie Req</label>
                                <select
                                    value={wizardMinCalorieReq}
                                    onChange={e => setWizardMinCalorieReq(e.target.value)}
                                    disabled={wizardMinScore !== ''}
                                    className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-[#111417] text-white focus:outline-none focus:ring-2 focus:ring-[#40c9ff]/40 focus:border-[#40c9ff] appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">Any Calories</option>
                                    <option value="1000">&gt; 1000</option>
                                    <option value="2000">&gt; 2000</option>
                                    <option value="3000">&gt; 3000</option>
                                    <option value="4000">&gt; 4000</option>
                                    <option value="5000">&gt; 5000</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 bg-[#161a1f]">
                        <button
                            onClick={() => setShowCreateWizard(false)}
                            className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors text-sm font-medium"
                            disabled={isCreatingCampaign}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateCampaign}
                            disabled={!wizardName || isCreatingCampaign}
                            className="px-5 py-2.5 rounded-xl bg-[#40c9ff] text-black font-bold hover:bg-[#3bbaf0] transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isCreatingCampaign ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                            ) : (
                                <><FolderPlus className="w-4 h-4" /> Create Campaign</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderAddLeadsModal = () => {
        if (!addResult && !isAddingLeads) return null;
        if (!addResult) return null; // We only really need to show completion, but let's just do a toast replacement technically or a simple modal.

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-[#1a1e24] p-6 rounded-2xl border border-emerald-500/30 max-w-sm w-full text-center shadow-2xl shadow-emerald-500/10">
                    <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                    <h3 className="text-white font-bold text-xl mb-2">Leads Added!</h3>
                    <p className="text-zinc-400 text-sm mb-6">
                        Successfully added {addResult.success} leads to <strong className="text-white">{activeCampaign?.title}</strong>.<br />
                    </p>
                    <button
                        onClick={() => {
                            setAddResult(null);
                            setSelectedLeads(new Set());
                            setIsAllSelected(false);
                        }}
                        className="w-full px-4 py-2 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors"
                    >
                        Awesome
                    </button>
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

                    {/* Active Campaigns Strip */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Target className="w-5 h-5 text-[#40c9ff]" /> Outreach Staging Campaigns
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => router.push('/admin/outreach-campaigns')}
                                    className="text-sm font-medium text-[#d7ff00] bg-[#d7ff00]/10 hover:bg-[#d7ff00]/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-[#d7ff00]/20"
                                >
                                    <Rocket className="w-4 h-4" /> Open Autopilot
                                </button>
                                <button
                                    onClick={() => setShowCreateWizard(true)}
                                    className="text-sm font-medium text-[#40c9ff] bg-[#40c9ff]/10 hover:bg-[#40c9ff]/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-[#40c9ff]/20"
                                >
                                    <FolderPlus className="w-4 h-4" /> New Campaign
                                </button>
                            </div>
                        </div>

                        {campaigns.length === 0 ? (
                            <div className="bg-[#1a1e24] border border-zinc-800 rounded-xl p-4 text-center text-zinc-500 text-sm">
                                No active campaigns yet. Create one to start gathering targeted leads.
                            </div>
                        ) : (
                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                                {campaigns.map(camp => (
                                    <button
                                        key={camp.id}
                                        onClick={() => handleSelectCampaign(activeCampaign?.id === camp.id ? null : camp)}
                                        className={`flex-shrink-0 flex flex-col items-start p-3.5 rounded-xl border text-left min-w-[200px] transition-all duration-200 ${activeCampaign?.id === camp.id ? 'bg-[#40c9ff]/10 border-[#40c9ff] shadow-[0_0_15px_rgba(64,201,255,0.15)] scale-[1.02]' : 'bg-[#1a1e24] border-zinc-800 hover:border-zinc-700 hover:bg-[#20252b]'}`}
                                    >
                                        <div className="flex justify-between w-full items-start mb-1.5">
                                            <span className={`font-bold text-sm leading-tight pr-2 ${activeCampaign?.id === camp.id ? 'text-[#40c9ff]' : 'text-white'}`}>{camp.title}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">{camp.totalLeads.toLocaleString()}</span>
                                                <button
                                                    onClick={(e) => handleDeleteCampaign(camp.id, e)}
                                                    className="text-zinc-500 hover:text-red-400 transition-colors p-0.5"
                                                    title="Delete Campaign"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-[4px_6px]">
                                            <span className={camp.targetGender !== 'all' ? 'text-zinc-300' : ''}>{camp.targetGender !== 'all' ? camp.targetGender : 'Any Gender'}</span>
                                            {camp.targetLevel && camp.targetLevel !== 'all' && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-zinc-300">Lvl {camp.targetLevel}</span>
                                                </>
                                            )}
                                            {camp.targetMinScore && camp.targetMinScore !== '' && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-zinc-300">Score: {camp.targetMinScore === 'top-500' ? 'Top 500' : camp.targetMinScore}</span>
                                                </>
                                            )}
                                            {camp.targetMinCalorieReq && camp.targetMinCalorieReq > 0 && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-zinc-300">Cal ≥{camp.targetMinCalorieReq}</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="mt-2 w-full">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-zinc-800 text-zinc-400">
                                                Plan in Autopilot
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Server Pagination Warning */}
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm px-4 py-3 rounded-lg flex items-start gap-3 mb-6">
                        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <p>
                            <strong>Server-Side Pagination Active.</strong> To prevent your browser from crashing while rendering {totalCount > 0 ? totalCount.toLocaleString() : '100,000+'} leads and to save Firestore costs, we are only loading <strong>{pageSize} rows at a time</strong>. <br className="hidden md:block" />
                            This means local search and analytics are limited to the current page. To mass-push entire goals (e.g., all 30k "Lose Weight" users) at once, we recommend requesting a dedicated Backend Bulk Push feature.
                        </p>
                    </div>

                    <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors ${showFilters || genderFilter !== 'all' ? 'border-[#d7ff00]/40 bg-[#d7ff00]/5 text-[#d7ff00]' : 'border-zinc-700 bg-[#1a1e24] text-zinc-400 hover:text-white'}`}
                            >
                                <Filter className="w-4 h-4" /> Filters
                                {(genderFilter !== 'all') && <span className="w-2 h-2 rounded-full bg-[#d7ff00]" />}
                            </button>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-zinc-500" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 pr-4 py-2 bg-[#1a1e24] border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#d7ff00] w-full sm:w-64 transition-all"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-white"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-xs text-zinc-500 font-medium tracking-wide">ROWS PER PAGE:</label>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                }}
                                className="bg-[#1a1e24] border border-zinc-700 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#d7ff00]"
                            >
                                <option value="50">50</option>
                                <option value="100">100</option>
                                <option value="250">250</option>
                                <option value="500">500</option>
                            </select>
                        </div>
                    </div>

                    {showFilters && (
                        <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-[#1a1e24] border border-zinc-800">
                            <div className="min-w-[120px]">
                                <label className="text-xs text-zinc-500 block mb-1">Gender</label>
                                <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#d7ff00]">
                                    <option value="all">All Genders</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                            <div className="min-w-[120px]">
                                <label className="text-xs text-zinc-500 block mb-1">Level</label>
                                <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#d7ff00]">
                                    <option value="all">All Levels</option>
                                    <option value="1">Beginner (1)</option>
                                    <option value="2">Intermediate (2)</option>
                                    <option value="3">Advanced (3)</option>
                                </select>
                            </div>
                            <div className="min-w-[140px]">
                                <label className={`text-xs block mb-1 ${minCalorieReqFilter ? 'text-zinc-600' : 'text-zinc-500'}`}>Min. Activity Score</label>
                                <select
                                    value={minScoreFilter}
                                    onChange={(e) => setMinScoreFilter(e.target.value)}
                                    disabled={minCalorieReqFilter !== ''}
                                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#d7ff00] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">Any Score</option>
                                    <option value="0-500">0 - 500</option>
                                    <option value="500-1000">500 - 1000</option>
                                    <option value="1000-3000">1000 - 3000</option>
                                    <option value="3000-6000">3000 - 6000</option>
                                    <option value="6000-10000">6000 - 10000</option>
                                    <option value="top-500">Top 500</option>
                                </select>
                            </div>
                            <div className="min-w-[140px]">
                                <label className={`text-xs block mb-1 ${minScoreFilter ? 'text-zinc-600' : 'text-zinc-500'}`}>Min. Calorie Req</label>
                                <select
                                    value={minCalorieReqFilter}
                                    onChange={(e) => setMinCalorieReqFilter(e.target.value)}
                                    disabled={minScoreFilter !== ''}
                                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#d7ff00] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">Any Calories</option>
                                    <option value="1000">&gt; 1000</option>
                                    <option value="2000">&gt; 2000</option>
                                    <option value="3000">&gt; 3000</option>
                                    <option value="4000">&gt; 4000</option>
                                    <option value="5000">&gt; 5000</option>
                                </select>
                            </div>
                            {(genderFilter !== 'all' || levelFilter !== 'all' || minScoreFilter !== '' || minCalorieReqFilter !== '') && (
                                <button onClick={() => { setGenderFilter('all'); setLevelFilter('all'); setMinScoreFilter(''); setMinCalorieReqFilter(''); }} className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white text-sm transition-colors mb-0.5">
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
                                Select Page ({sortedLeads.filter(l => l.email && !l.outreachCampaignId).length})
                            </button>

                            {selectedLeads.size > 0 && (
                                <span className="text-[#d7ff00] text-sm font-medium bg-[#d7ff00]/10 px-2.5 py-1 rounded-md">
                                    {selectedLeads.size} Selected
                                </span>
                            )}
                        </div>

                        {selectedLeads.size > 0 && activeCampaign && (
                            <button
                                onClick={handleAddLeadsToCampaign}
                                disabled={isAddingLeads}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#40c9ff] text-black hover:bg-[#3bbaf0] transition-all text-sm font-bold shadow-lg shadow-[#40c9ff]/20"
                            >
                                {isAddingLeads ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</>
                                ) : (
                                    <><FolderPlus className="w-4 h-4" /> Add {selectedLeads.size} leads to "{activeCampaign.title}"</>
                                )}
                            </button>
                        )}
                    </div>

                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-[#1a1e24] border-b border-zinc-800">
                                <th className="px-4 py-3 w-10"></th>
                                {[
                                    { label: 'Name', key: 'name' },
                                    { label: 'Email', key: 'email' },
                                    { label: 'Gender', key: 'gender' },
                                    { label: 'Level', key: 'level' },
                                    { label: 'Score', key: 'score' },
                                    { label: 'Weight', key: 'weight' },
                                    { label: 'Calories', key: 'calorieReq' },
                                    { label: 'Created At', key: 'createdAt' }
                                ].map((col) => (
                                    <th
                                        key={col.key}
                                        onClick={() => handleSort(col.key as keyof FitnessSeekerLead)}
                                        className="px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none group"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            {col.label}
                                            <span className={`text-[10px] ${sortConfig?.key === col.key ? 'text-[#40c9ff]' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                                                {sortConfig?.key === col.key ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {sortedLeads.length === 0 ? (
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
                                sortedLeads.map((lead) => (
                                    <tr
                                        key={lead.id}
                                        className={`hover:bg-[#1a1e24] transition-colors cursor-pointer ${selectedLeads.has(lead.id) ? 'bg-[#40c9ff]/5' : 'bg-[#111417]'}`}
                                        onClick={() => setSelectedLead(lead)}
                                    >
                                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={(e) => toggleSelection(lead.id, e)}
                                                disabled={!lead.email || !!lead.outreachCampaignId}
                                                className={`p-1 rounded transition-colors ${(!lead.email || lead.outreachCampaignId) ? 'opacity-30 cursor-not-allowed text-zinc-700' : selectedLeads.has(lead.id) ? 'text-[#d7ff00]' : 'text-zinc-600 hover:text-zinc-400'}`}
                                            >
                                                {lead.outreachCampaignId ? <CheckCircle className="w-5 h-5" /> : selectedLeads.has(lead.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${lead.outreachCampaignId ? 'bg-zinc-800 text-zinc-500' : 'bg-gradient-to-br from-[#d7ff00]/20 to-[#40c9ff]/20 text-[#d7ff00]'}`}>
                                                    {(lead.name || '?')[0]?.toUpperCase()}
                                                </div>
                                                <span className={`text-sm font-medium truncate max-w-[120px] ${lead.outreachCampaignId ? 'text-zinc-500' : 'text-white'}`}>
                                                    {lead.name || '—'}
                                                </span>
                                                {lead.outreachCampaignId && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-500 uppercase tracking-widest border border-zinc-700">
                                                        Assigned
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-zinc-300 text-sm truncate max-w-[180px] block">{lead.email || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-zinc-400 text-sm capitalize">{lead.gender || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-zinc-300 text-sm">{lead.level ? `Level ${lead.level}` : '—'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-zinc-300 text-sm">{lead.score != null ? lead.score : '—'}</span>
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
            {renderDetailModal()}
            {renderMigrationModal()}
            {renderCreateWizardModal()}
            {renderAddLeadsModal()}
        </AdminRouteGuard>
    );
};

export default FitnessSeekerLeadsPage;
