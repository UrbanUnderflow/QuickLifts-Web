import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
    RefreshCw,
    Play,
    Pause,
    Send,
    ArrowLeft,
    CheckCircle,
    XCircle,
    Target,
    Trash2,
    Terminal,
    Copy as CopyIcon,
    Settings,
    Rocket,
    BarChart3,
    Plus,
    AlertTriangle,
    Mail,
    Eye,
    MessageSquare,
    HelpCircle,
    Upload,
    Zap,
    FileText,
    Wand2,
    SendHorizonal,
    Shield
} from 'lucide-react';
import { collection, getDocs, orderBy, query, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

// ─── Interfaces ────────────────────────────────────────────

interface EmailSequence {
    subject: string;
    body: string;
    delayDays: number;
}

interface CampaignSettings {
    dailyLimit: number;
    scheduleFrom: string;
    scheduleTo: string;
    scheduleDays: number[];
    timezone: string;
    stopOnReply: boolean;
    stopOnAutoReply: boolean;
    linkTracking: boolean;
    openTracking: boolean;
    textOnly: boolean;
    slowRampUp?: boolean;
    slowRampUpIncrement?: number;
}

interface CampaignAnalytics {
    openRate: number;
    replyRate: number;
    totalOpens: number;
    totalReplies: number;
    totalBounces: number;
    lastSynced: string;
}

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
    pushLogs?: string[];

    // Campaign Autopilot fields
    deployStatus?: 'planned' | 'deploying' | 'campaign_created' | 'pushing_leads' | 'deployed' | 'deploy_failed';
    deployError?: string;
    emailSequences?: EmailSequence[];
    campaignSettings?: CampaignSettings;
    sendingEmail?: string;
    analytics?: CampaignAnalytics;
    campaignActive?: boolean;
    settingsLastSynced?: string;
    activatedAt?: string;
    pausedAt?: string;
    strategyArtifact?: string;
}

const DEFAULT_SETTINGS: CampaignSettings = {
    dailyLimit: 30,
    scheduleFrom: '08:00',
    scheduleTo: '13:00',
    scheduleDays: [1, 2, 3, 4, 5],
    timezone: 'America/Detroit',
    stopOnReply: true,
    stopOnAutoReply: false,
    linkTracking: false,
    openTracking: true,
    textOnly: true,
    slowRampUp: true,
    slowRampUpIncrement: 2
};

const DEFAULT_SEQUENCE: EmailSequence = {
    subject: '',
    body: '',
    delayDays: 3
};

const TUTORIAL_STORAGE_KEY = 'outreachCampaignsTutorialSeen_v1';

const TUTORIAL_STEPS = [
    {
        title: '1. Start With A Campaign',
        description: 'Create or add leads to a staging campaign in Fitness Seeker Leads, then open this page to run automation.',
        tip: 'Use the "Open Autopilot" button in the Fitness Seeker Leads screen.'
    },
    {
        title: '2. Upload Or Build Strategy',
        description: 'Click "Plan" on a campaign row. Upload a strategy file (any format) or manually create email sequences and settings.',
        tip: 'The app sends the uploaded strategy into the OpenAI parser endpoint, then auto-fills sequences/settings/email.'
    },
    {
        title: '3. Deploy To Instantly',
        description: 'When verification is complete and plan is saved, click "Deploy to Instantly". The system creates the campaign and pushes valid leads.',
        tip: 'If it fails mid-flow, use "Retry Deploy" and it resumes from the failed step.'
    },
    {
        title: '4. Monitor Performance',
        description: 'After deploy, monitor open/reply metrics inline. Use "Sync Stats" anytime, and scheduled sync keeps analytics fresh.',
        tip: 'Analytics also auto-sync every 4 hours in production.'
    }
] as const;

// ─── Main Component ────────────────────────────────────────

const OutreachCampaignsPage: React.FC = () => {
    const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewingLogsFor, setViewingLogsFor] = useState<OutreachCampaign | null>(null);
    const [editingPlanFor, setEditingPlanFor] = useState<OutreachCampaign | null>(null);
    const [deploying, setDeploying] = useState<string | null>(null);
    const [syncingAnalytics, setSyncingAnalytics] = useState<string | null>(null);
    const [syncingSettings, setSyncingSettings] = useState(false);
    const [activatingCampaign, setActivatingCampaign] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);
    const router = useRouter();

    // Plan editor state
    const [planSequences, setPlanSequences] = useState<EmailSequence[]>([]);
    const [planSettings, setPlanSettings] = useState<CampaignSettings>(DEFAULT_SETTINGS);
    const [planSendingEmail, setPlanSendingEmail] = useState('');
    const [planActiveTab, setPlanActiveTab] = useState<'sequences' | 'settings' | 'strategy'>('sequences');
    const [savingPlan, setSavingPlan] = useState(false);
    const [parsingStrategy, setParsingStrategy] = useState(false);
    const [planInstantlyId, setPlanInstantlyId] = useState('');
    const [planArtifact, setPlanArtifact] = useState('');
    const [artifactPrompt, setArtifactPrompt] = useState('');
    const [refiningArtifact, setRefiningArtifact] = useState(false);
    const [applyingArtifact, setApplyingArtifact] = useState(false);
    const [refineResponse, setRefineResponse] = useState('');
    const [checkingSpam, setCheckingSpam] = useState(false);
    const [spamReport, setSpamReport] = useState<any>(null);
    const [toastMessage, setToastMessage] = useState('');
    const [appliedAt, setAppliedAt] = useState<number | null>(null);
    const strategyFileInputRef = useRef<HTMLInputElement | null>(null);
    const spamReportRef = useRef<HTMLDivElement | null>(null);

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'outreach_campaigns'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const fetched = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as OutreachCampaign));
            setCampaigns(fetched);
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCampaigns(); }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const seen = window.localStorage.getItem(TUTORIAL_STORAGE_KEY);
            if (seen !== 'true') {
                setTutorialStep(0);
                setShowTutorial(true);
            }
        } catch {
            setTutorialStep(0);
            setShowTutorial(true);
        }
    }, []);

    // ─── Legacy Handlers (kept for backwards compat) ────────

    const handleVerify = async (campaignId: string) => {
        const confirmVerify = window.confirm("Are you sure you want to verify this campaign? (This process runs in the background and may take several minutes).");
        if (!confirmVerify) return;

        try {
            setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'verifying' } : c));

            const response = await fetch('/.netlify/functions/verify-outreach-campaign-background', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to start background verifier: ${response.status} ${errorText}`);
            }

            alert('Verification started! Refresh periodically to see progress.');
        } catch (err: any) {
            console.error(err);
            alert('Error triggering verify: ' + err.message);
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
            setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: 'pushing', instantlyCampaignId: instantlyId } : c));
            const response = await fetch('/.netlify/functions/push-outreach-campaign-background', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId, instantlyCampaignId: instantlyId })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to start pushing: ${response.status} ${errorText}`);
            }
            alert('Push started! Check back in a few minutes.');
        } catch (err: any) {
            console.error(err);
            alert('Error triggering push: ' + err.message);
            fetchCampaigns();
        }
    };

    // ─── New Autopilot Handlers ─────────────────────────────

    const openPlanEditor = (camp: OutreachCampaign) => {
        setPlanSequences(camp.emailSequences && camp.emailSequences.length > 0 ? [...camp.emailSequences] : [{ ...DEFAULT_SEQUENCE }]);
        setPlanSettings(camp.campaignSettings || { ...DEFAULT_SETTINGS });
        setPlanSendingEmail(camp.sendingEmail || 'tre@teamfitwithpulse.com');
        setPlanInstantlyId(camp.instantlyCampaignId || '');
        setPlanArtifact(camp.strategyArtifact || '');
        setArtifactPrompt('');
        setPlanActiveTab('sequences');
        setEditingPlanFor(camp);
    };

    const savePlan = async () => {
        if (!editingPlanFor) return;

        const validSequences = planSequences.filter(s => s.body.trim());
        if (validSequences.length === 0) {
            setToastMessage('✗ Add at least one email sequence with a body.');
            setTimeout(() => setToastMessage(''), 5000);
            return;
        }
        if (!planSendingEmail.trim()) {
            setToastMessage('✗ Enter a sending email address.');
            setTimeout(() => setToastMessage(''), 5000);
            return;
        }

        setSavingPlan(true);
        try {
            const updatePayload: any = {
                emailSequences: validSequences,
                campaignSettings: planSettings,
                sendingEmail: planSendingEmail.trim(),
                deployStatus: editingPlanFor.deployStatus || 'planned',
                updatedAt: new Date().toISOString()
            };

            // Save Instantly Campaign ID if provided
            if (planInstantlyId.trim()) {
                updatePayload.instantlyCampaignId = planInstantlyId.trim();
            }

            // Save strategy artifact if present
            if (planArtifact.trim()) {
                updatePayload.strategyArtifact = planArtifact.trim();
            }

            await updateDoc(doc(db, 'outreach_campaigns', editingPlanFor.id), updatePayload);

            setCampaigns(prev => prev.map(c => c.id === editingPlanFor.id ? {
                ...c,
                emailSequences: validSequences,
                campaignSettings: planSettings,
                sendingEmail: planSendingEmail.trim(),
                instantlyCampaignId: planInstantlyId.trim() || c.instantlyCampaignId,
                strategyArtifact: planArtifact.trim() || c.strategyArtifact,
                deployStatus: c.deployStatus || 'planned'
            } : c));

            setEditingPlanFor(null);
        } catch (error: any) {
            console.error('Failed to save plan:', error);
            setToastMessage('✗ Failed to save plan: ' + error.message);
            setTimeout(() => setToastMessage(''), 6000);
        } finally {
            setSavingPlan(false);
        }
    };

    const _readFileAsBase64 = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        const chunkSize = 8192;

        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
        }

        return btoa(binary);
    };

    const _isLikelyReadableText = (raw: string): boolean => {
        if (!raw || raw.trim().length < 20) return false;
        const sample = raw.slice(0, 4000);
        let printable = 0;

        for (let i = 0; i < sample.length; i++) {
            const code = sample.charCodeAt(i);
            const isCommonControl = code === 9 || code === 10 || code === 13;
            const isAsciiPrintable = code >= 32 && code <= 126;
            const isExtended = code >= 160;
            if (isCommonControl || isAsciiPrintable || isExtended) printable++;
        }

        return printable / sample.length > 0.7;
    };

    const handleStrategyFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setParsingStrategy(true);
        try {
            if (file.size > 8 * 1024 * 1024) {
                throw new Error('File is too large. Please upload a file smaller than 8MB.');
            }

            const rawText = await file.text();
            const strategyText = rawText.slice(0, 180000);

            if (!strategyText || strategyText.trim().length < 20) {
                throw new Error('File appears to be empty or too short to be a strategy document.');
            }

            // Save the raw text as the artifact — do NOT auto-parse
            setPlanArtifact(strategyText);

            // Switch to Strategy tab so user can review + manually apply
            setPlanActiveTab('strategy');
        } catch (error: any) {
            setToastMessage(`✗ Could not import strategy: ${error.message}`);
            setTimeout(() => setToastMessage(''), 6000);
        } finally {
            setParsingStrategy(false);
            if (strategyFileInputRef.current) {
                strategyFileInputRef.current.value = '';
            }
        }
    };

    const handleDeploy = async (campaignId: string) => {
        const camp = campaigns.find(c => c.id === campaignId);
        if (!camp?.emailSequences || camp.emailSequences.length === 0) {
            alert('Configure the campaign plan first before deploying.');
            return;
        }
        if (!confirm('Deploy this campaign to Instantly? This will create the campaign, configure sequences, and push all verified leads.')) return;

        setDeploying(campaignId);
        setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, deployStatus: 'deploying' } : c));

        try {
            const response = await fetch('/api/outreach/deploy-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Deploy failed');
            }

            alert(`Campaign deployed successfully! Instantly ID: ${result.instantlyCampaignId}`);
            fetchCampaigns();
        } catch (err: any) {
            console.error('Deploy error:', err);
            alert('Deploy error: ' + err.message);
            fetchCampaigns();
        } finally {
            setDeploying(null);
        }
    };

    const handleSyncAnalytics = async (campaignId: string) => {
        const camp = campaigns.find(c => c.id === campaignId);
        if (!camp?.instantlyCampaignId) return;

        setSyncingAnalytics(campaignId);
        try {
            const response = await fetch('/.netlify/functions/sync-campaign-analytics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId })
            });

            if (response.ok) {
                fetchCampaigns();
            }
        } catch (error: any) {
            console.error('Analytics sync error:', error);
        } finally {
            setSyncingAnalytics(null);
        }
    };

    const handleSyncSettings = async () => {
        if (!editingPlanFor?.instantlyCampaignId) return;

        // Save the plan first, then sync to Instantly
        const validSequences = planSequences.filter(s => s.body.trim());
        if (validSequences.length === 0) {
            setToastMessage('✗ Add at least one email sequence with a body before deploying settings.');
            setTimeout(() => setToastMessage(''), 5000);
            return;
        }
        if (!planSendingEmail.trim()) {
            setToastMessage('✗ Enter a sending email address.');
            setTimeout(() => setToastMessage(''), 5000);
            return;
        }

        setSyncingSettings(true);
        try {
            // Save plan to Firestore first
            await updateDoc(doc(db, 'outreach_campaigns', editingPlanFor.id), {
                emailSequences: validSequences,
                campaignSettings: planSettings,
                sendingEmail: planSendingEmail.trim(),
                updatedAt: new Date().toISOString()
            });

            // Now sync to Instantly
            const response = await fetch('/api/outreach/sync-campaign-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId: editingPlanFor.id })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to sync settings');
            }

            // Update local campaign state
            const now = new Date().toISOString();
            setCampaigns(prev => prev.map(c => c.id === editingPlanFor.id ? {
                ...c,
                emailSequences: validSequences,
                campaignSettings: planSettings,
                sendingEmail: planSendingEmail.trim(),
                settingsLastSynced: now
            } : c));
            setEditingPlanFor(prev => prev ? { ...prev, settingsLastSynced: now } : null);

            setToastMessage(`✓ Settings deployed to Instantly! ${validSequences.length} email sequences synced.`);
            setTimeout(() => setToastMessage(''), 6000);
        } catch (error: any) {
            console.error('Sync settings error:', error);
            setToastMessage('✗ Failed to deploy settings: ' + error.message);
            setTimeout(() => setToastMessage(''), 8000);
        } finally {
            setSyncingSettings(false);
        }
    };

    const handleActivateCampaign = async (action: 'activate' | 'pause') => {
        if (!editingPlanFor?.instantlyCampaignId) return;

        const actionLabel = action === 'activate' ? 'activate' : 'pause';

        setActivatingCampaign(true);
        try {
            const response = await fetch('/api/outreach/activate-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId: editingPlanFor.id, action })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Failed to ${actionLabel} campaign`);
            }

            const isActive = action === 'activate';
            setCampaigns(prev => prev.map(c => c.id === editingPlanFor.id ? {
                ...c,
                campaignActive: isActive
            } : c));
            setEditingPlanFor(prev => prev ? { ...prev, campaignActive: isActive } : null);

            setToastMessage(`✓ Campaign ${action === 'activate' ? 'activated' : 'paused'} successfully!${action === 'activate' ? ' Emails will begin sending on schedule.' : ''}`);
            setTimeout(() => setToastMessage(''), 6000);
        } catch (error: any) {
            console.error(`${actionLabel} campaign error:`, error);
            setToastMessage(`✗ Failed to ${actionLabel} campaign: ${error.message}`);
            setTimeout(() => setToastMessage(''), 8000);
        } finally {
            setActivatingCampaign(false);
        }
    };

    const handleRefineArtifact = async () => {
        if (!planArtifact || !artifactPrompt.trim() || !editingPlanFor) return;

        setRefiningArtifact(true);
        try {
            const response = await fetch('/api/outreach/refine-campaign-strategy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    artifact: planArtifact,
                    prompt: artifactPrompt.trim(),
                    campaignTitle: editingPlanFor.title
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to refine strategy');
            }

            setPlanArtifact(result.artifact);
            setArtifactPrompt('');
            setRefineResponse(result.summary || 'Changes applied to the strategy document.');
        } catch (error: any) {
            console.error('Refine artifact error:', error);
            setToastMessage('✗ Failed to refine strategy: ' + error.message);
            setTimeout(() => setToastMessage(''), 8000);
        } finally {
            setRefiningArtifact(false);
        }
    };

    const handleApplyArtifact = async () => {
        if (!planArtifact || !editingPlanFor) return;

        setApplyingArtifact(true);
        setToastMessage('');
        try {
            console.log('[Apply Artifact] Sending artifact to parser, length:', planArtifact.length);
            const response = await fetch('/api/outreach/parse-campaign-strategy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaignTitle: editingPlanFor.title,
                    fileName: 'strategy-artifact.md',
                    mimeType: 'text/markdown',
                    strategyText: planArtifact,
                    fileDataBase64: ''
                })
            });

            const result = await response.json();
            console.log('[Apply Artifact] Parse result:', result);

            if (!response.ok) {
                throw new Error(result.error || 'Failed to parse strategy');
            }

            const parsed = result.parsed || {};
            const importedSequences: EmailSequence[] = Array.isArray(parsed.emailSequences)
                ? parsed.emailSequences
                : [];

            if (importedSequences.length === 0) {
                throw new Error('No email sequences found after re-parsing.');
            }

            const importedSettings = parsed.campaignSettings || DEFAULT_SETTINGS;
            const importedEmail = typeof parsed.sendingEmail === 'string' ? parsed.sendingEmail.trim() : '';

            setPlanSequences(importedSequences);
            setPlanSettings(importedSettings);
            if (importedEmail) {
                setPlanSendingEmail(importedEmail);
            }

            // Mark as recently applied for blue dot indicators
            setAppliedAt(Date.now());
            // Auto-clear the dots after 30 seconds
            setTimeout(() => setAppliedAt(null), 30000);

            // Switch to sequences tab and show toast
            setPlanActiveTab('sequences');
            setToastMessage(`✓ Applied ${importedSequences.length} email sequence(s). Review and Save Plan when ready.`);
            setTimeout(() => setToastMessage(''), 6000);
        } catch (error: any) {
            console.error('[Apply Artifact] Error:', error);
            setToastMessage(`✗ Failed to apply: ${error.message}`);
            setTimeout(() => setToastMessage(''), 8000);
        } finally {
            setApplyingArtifact(false);
        }
    };

    const handleCheckSpam = async () => {
        if (!planArtifact) return;

        setCheckingSpam(true);
        setSpamReport(null);
        try {
            const response = await fetch('/api/outreach/check-spam-triggers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artifact: planArtifact })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to check for spam triggers');
            }

            setSpamReport(result);

            // Auto-scroll to the report after state updates
            setTimeout(() => {
                spamReportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } catch (error: any) {
            console.error('Spam check error:', error);
            setToastMessage('✗ Failed to check for spam triggers: ' + error.message);
            setTimeout(() => setToastMessage(''), 8000);
        } finally {
            setCheckingSpam(false);
        }
    };

    const handleFixSpamIssues = async () => {
        if (!planArtifact || !spamReport?.issues?.length || !editingPlanFor) return;

        // Build a focused prompt from all the flagged issues
        const issueLines = spamReport.issues.map((issue: any, idx: number) => {
            const location = issue.email ? ` (${issue.email})` : '';
            const text = issue.text ? `"${issue.text}"` : issue.type;
            return `${idx + 1}. ${text}${location}: ${issue.suggestion}`;
        }).join('\n');

        const fixPrompt = `Fix the following deliverability issues found in the email copy. Apply each suggestion while keeping the overall message and tone intact:\n\n${issueLines}`;

        setRefiningArtifact(true);
        try {
            const response = await fetch('/api/outreach/refine-campaign-strategy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    artifact: planArtifact,
                    prompt: fixPrompt,
                    campaignTitle: editingPlanFor.title
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to fix spam issues');
            }

            setPlanArtifact(result.artifact);
            setRefineResponse(result.summary || 'Spam trigger fixes applied to the strategy.');
            setSpamReport(null); // Clear the report since we've fixed the issues
        } catch (error: any) {
            console.error('Fix spam issues error:', error);
            setToastMessage('✗ Failed to fix spam issues: ' + error.message);
            setTimeout(() => setToastMessage(''), 8000);
        } finally {
            setRefiningArtifact(false);
        }
    };

    const openTutorial = () => {
        setTutorialStep(0);
        setShowTutorial(true);
    };

    const closeTutorial = (markSeen = false) => {
        if (markSeen && typeof window !== 'undefined') {
            try {
                window.localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
            } catch {
                // no-op; UI still closes
            }
        }
        setShowTutorial(false);
    };

    // ─── Helpers ────────────────────────────────────────────

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

    const getDeployBadge = (camp: OutreachCampaign) => {
        if (!camp.deployStatus) return null;
        switch (camp.deployStatus) {
            case 'planned': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 uppercase">Plan Ready</span>;
            case 'deploying': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 uppercase"><RefreshCw className="w-3 h-3 animate-spin" />Deploying</span>;
            case 'campaign_created': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 uppercase">Created</span>;
            case 'pushing_leads': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 uppercase"><RefreshCw className="w-3 h-3 animate-spin" />Pushing</span>;
            case 'deployed': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 uppercase"><Rocket className="w-3 h-3" />Live</span>;
            case 'deploy_failed': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 uppercase"><AlertTriangle className="w-3 h-3" />Failed</span>;
            default: return null;
        }
    };

    const formatStatus = (status: OutreachCampaign['status']) => {
        return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    };

    const copyLogsToClipboard = () => {
        if (!viewingLogsFor?.pushLogs) return;
        navigator.clipboard.writeText(viewingLogsFor.pushLogs.join('\n'));
        alert('Logs copied to clipboard!');
    };

    // ─── Plan Editor Modal ──────────────────────────────────

    const renderPlanEditor = () => {
        if (!editingPlanFor) return null;

        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                <div className="bg-[#111417] border border-zinc-800 rounded-3xl w-full max-w-4xl flex flex-col max-h-[90vh] shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Settings className="w-5 h-5 text-[#40c9ff]" />
                                Campaign Plan
                            </h3>
                            <p className="text-zinc-500 text-sm mt-0.5">{editingPlanFor.title}</p>
                        </div>
                        <button onClick={() => setEditingPlanFor(null)} className="text-zinc-500 hover:text-white">
                            <XCircle className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-zinc-800">
                        <button
                            onClick={() => setPlanActiveTab('sequences')}
                            className={`px-6 py-3 text-sm font-medium transition-colors ${planActiveTab === 'sequences'
                                ? 'text-[#40c9ff] border-b-2 border-[#40c9ff]'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            <Mail className="w-4 h-4 inline mr-2" />
                            Email Sequences ({planSequences.length})
                        </button>
                        <button
                            onClick={() => setPlanActiveTab('settings')}
                            className={`px-6 py-3 text-sm font-medium transition-colors ${planActiveTab === 'settings'
                                ? 'text-[#40c9ff] border-b-2 border-[#40c9ff]'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            <Settings className="w-4 h-4 inline mr-2" />
                            Campaign Settings
                        </button>
                        <button
                            onClick={() => setPlanActiveTab('strategy')}
                            className={`px-6 py-3 text-sm font-medium transition-colors ${planActiveTab === 'strategy'
                                ? 'text-[#40c9ff] border-b-2 border-[#40c9ff]'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            <FileText className="w-4 h-4 inline mr-2" />
                            Strategy {planArtifact ? '●' : ''}
                        </button>
                    </div>

                    {/* Toast Notification — always visible above scroll area */}
                    {toastMessage && (
                        <div className={`mx-6 mt-2 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${toastMessage.startsWith('✓')
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                            {toastMessage}
                        </div>
                    )}

                    {/* Body */}
                    <div className="flex-grow overflow-y-auto p-6">

                        {planActiveTab === 'sequences' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between bg-[#1a1e24] border border-zinc-800 rounded-xl p-3">
                                    <div>
                                        <div className="text-white text-sm font-semibold">Import Campaign Strategy</div>
                                        <div className="text-zinc-500 text-xs">Upload any strategy file. We parse it through OpenAI and auto-fill sequences, settings, and sending email.</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={strategyFileInputRef}
                                            type="file"
                                            accept="*/*"
                                            onChange={handleStrategyFileUpload}
                                            className="hidden"
                                        />
                                        <button
                                            disabled={parsingStrategy}
                                            onClick={() => strategyFileInputRef.current?.click()}
                                            className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700 transition-colors text-xs font-medium disabled:opacity-50"
                                        >
                                            {parsingStrategy ? 'Parsing...' : 'Upload File'}
                                        </button>
                                    </div>
                                </div>


                                {planSequences.map((seq, idx) => (
                                    <div key={idx} className={`bg-[#1a1e24] border rounded-xl p-4 ${appliedAt ? 'border-[#40c9ff]/40' : 'border-zinc-800'
                                        }`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-[#40c9ff]/10 text-[#40c9ff] text-xs font-bold px-2 py-0.5 rounded-full">
                                                    Email {idx + 1}
                                                </span>
                                                {appliedAt && (
                                                    <span className="w-2 h-2 rounded-full bg-[#40c9ff] animate-pulse" title="Updated from strategy" />
                                                )}
                                                <span className="text-zinc-500 text-xs">
                                                    {idx === 0 ? 'Day 0' : `+${seq.delayDays} days`}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {idx > 0 && (
                                                    <div className="flex items-center gap-1">
                                                        <label className="text-zinc-500 text-xs">Delay:</label>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={30}
                                                            value={seq.delayDays}
                                                            onChange={(e) => {
                                                                const updated = [...planSequences];
                                                                updated[idx] = { ...updated[idx], delayDays: parseInt(e.target.value) || 3 };
                                                                setPlanSequences(updated);
                                                            }}
                                                            className="w-14 bg-[#111417] border border-zinc-700 rounded-lg px-2 py-1 text-white text-xs text-center"
                                                        />
                                                        <span className="text-zinc-500 text-xs">days</span>
                                                    </div>
                                                )}
                                                {planSequences.length > 1 && (
                                                    <button
                                                        onClick={() => setPlanSequences(prev => prev.filter((_, i) => i !== idx))}
                                                        className="text-red-400 hover:text-red-300 p-1"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <input
                                            type="text"
                                            placeholder={idx === 0 ? "Subject line (e.g. Remember Bulk?)" : "Leave blank for reply-thread (recommended)"}
                                            value={seq.subject}
                                            onChange={(e) => {
                                                const updated = [...planSequences];
                                                updated[idx] = { ...updated[idx], subject: e.target.value };
                                                setPlanSequences(updated);
                                            }}
                                            className="w-full bg-[#111417] border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm mb-2 placeholder:text-zinc-600 focus:border-[#40c9ff] focus:outline-none transition-colors"
                                        />

                                        <textarea
                                            placeholder="Email body... Use {{firstName}}, {{goal}}, {{level}} for personalization"
                                            value={seq.body}
                                            onChange={(e) => {
                                                const updated = [...planSequences];
                                                updated[idx] = { ...updated[idx], body: e.target.value };
                                                setPlanSequences(updated);
                                            }}
                                            rows={6}
                                            className="w-full bg-[#111417] border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-600 resize-y focus:border-[#40c9ff] focus:outline-none transition-colors font-mono"
                                        />

                                        {/* Variable chips */}
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {['{{firstName}}', '{{goal}}', '{{level}}', '{{focusArea}}'].map(v => (
                                                <button
                                                    key={v}
                                                    onClick={() => {
                                                        const updated = [...planSequences];
                                                        updated[idx] = { ...updated[idx], body: updated[idx].body + v };
                                                        setPlanSequences(updated);
                                                    }}
                                                    className="px-2 py-0.5 bg-zinc-800 text-zinc-400 hover:text-[#40c9ff] hover:bg-zinc-700 rounded text-[10px] font-mono transition-colors"
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                <button
                                    onClick={() => setPlanSequences(prev => [...prev, { ...DEFAULT_SEQUENCE }])}
                                    className="w-full py-3 border-2 border-dashed border-zinc-700 rounded-xl text-zinc-500 hover:text-[#40c9ff] hover:border-[#40c9ff]/30 transition-colors text-sm flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Add Email Step
                                </button>
                            </div>
                        )}

                        {planActiveTab === 'settings' && (
                            <div className="space-y-6">
                                {/* Instantly Campaign ID */}
                                <div>
                                    <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">Instantly Campaign ID</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={planInstantlyId}
                                            onChange={(e) => setPlanInstantlyId(e.target.value)}
                                            placeholder="Auto-populated on deploy, or paste manually"
                                            className="flex-1 bg-[#1a1e24] border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:border-[#40c9ff] focus:outline-none font-mono"
                                        />
                                        {planInstantlyId && (
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(planInstantlyId);
                                                    alert('Instantly ID copied!');
                                                }}
                                                className="px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors text-xs font-medium"
                                                title="Copy to clipboard"
                                            >
                                                <CopyIcon className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    {planInstantlyId && (
                                        <a
                                            href={`https://app.instantly.ai/app/campaign/${planInstantlyId}/sequences`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[#40c9ff] text-[10px] mt-1.5 inline-flex items-center gap-1 hover:underline"
                                        >
                                            Open in Instantly →
                                        </a>
                                    )}
                                </div>

                                {/* Sending Email */}
                                <div>
                                    <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">Sending Email</label>
                                    <input
                                        type="email"
                                        value={planSendingEmail}
                                        onChange={(e) => setPlanSendingEmail(e.target.value)}
                                        placeholder="tre@teamfitwithpulse.com"
                                        className="w-full bg-[#1a1e24] border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:border-[#40c9ff] focus:outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Daily Limit */}
                                    <div>
                                        <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">Daily Send Limit</label>
                                        <input
                                            type="number"
                                            value={planSettings.dailyLimit}
                                            onChange={(e) => setPlanSettings(prev => ({ ...prev, dailyLimit: parseInt(e.target.value) || 30 }))}
                                            className="w-full bg-[#1a1e24] border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-[#40c9ff] focus:outline-none"
                                        />
                                    </div>

                                    {/* Timezone */}
                                    <div>
                                        <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">Timezone</label>
                                        <select
                                            value={planSettings.timezone}
                                            onChange={(e) => setPlanSettings(prev => ({ ...prev, timezone: e.target.value }))}
                                            className="w-full bg-[#1a1e24] border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-[#40c9ff] focus:outline-none"
                                        >
                                            <option value="America/Detroit">Eastern (America/Detroit)</option>
                                            <option value="America/Chicago">Central (America/Chicago)</option>
                                            <option value="America/Denver">Mountain (America/Denver)</option>
                                            <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Schedule */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">Send From</label>
                                        <input
                                            type="time"
                                            value={planSettings.scheduleFrom}
                                            onChange={(e) => setPlanSettings(prev => ({ ...prev, scheduleFrom: e.target.value }))}
                                            className="w-full bg-[#1a1e24] border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-[#40c9ff] focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">Send Until</label>
                                        <input
                                            type="time"
                                            value={planSettings.scheduleTo}
                                            onChange={(e) => setPlanSettings(prev => ({ ...prev, scheduleTo: e.target.value }))}
                                            className="w-full bg-[#1a1e24] border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:border-[#40c9ff] focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Days */}
                                <div>
                                    <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">Send Days</label>
                                    <div className="flex gap-2">
                                        {[
                                            { label: 'Mon', value: 1 },
                                            { label: 'Tue', value: 2 },
                                            { label: 'Wed', value: 3 },
                                            { label: 'Thu', value: 4 },
                                            { label: 'Fri', value: 5 },
                                            { label: 'Sat', value: 6 },
                                            { label: 'Sun', value: 0 }
                                        ].map(day => (
                                            <button
                                                key={day.value}
                                                onClick={() => {
                                                    setPlanSettings(prev => ({
                                                        ...prev,
                                                        scheduleDays: prev.scheduleDays.includes(day.value)
                                                            ? prev.scheduleDays.filter(d => d !== day.value)
                                                            : [...prev.scheduleDays, day.value].sort()
                                                    }));
                                                }}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${planSettings.scheduleDays.includes(day.value)
                                                    ? 'bg-[#40c9ff]/20 text-[#40c9ff] border border-[#40c9ff]/30'
                                                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300'
                                                    }`}
                                            >
                                                {day.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Toggle settings */}
                                <div className="space-y-3">
                                    {[
                                        { key: 'stopOnReply' as const, label: 'Stop on Reply', desc: 'Stop sending to leads who reply' },
                                        { key: 'stopOnAutoReply' as const, label: 'Stop on Auto-Reply', desc: 'Stop on out-of-office replies' },
                                        { key: 'openTracking' as const, label: 'Open Tracking', desc: 'Track email opens' },
                                        { key: 'linkTracking' as const, label: 'Link Tracking', desc: 'Track link clicks (reduces deliverability)' },
                                        { key: 'textOnly' as const, label: 'Text Only', desc: 'Send plain text (better inbox placement)' },
                                        { key: 'slowRampUp' as const, label: 'Slow Ramp Up', desc: 'Gradually increase daily sends to build reputation' }
                                    ].map(toggle => (
                                        <div key={toggle.key} className="flex items-center justify-between p-3 bg-[#1a1e24] rounded-lg border border-zinc-800">
                                            <div>
                                                <div className="text-white text-sm font-medium">{toggle.label}</div>
                                                <div className="text-zinc-500 text-xs">{toggle.desc}</div>
                                            </div>
                                            <button
                                                onClick={() => setPlanSettings(prev => ({ ...prev, [toggle.key]: !prev[toggle.key] }))}
                                                className={`w-10 h-6 rounded-full transition-colors relative ${planSettings[toggle.key] ? 'bg-[#40c9ff]' : 'bg-zinc-700'
                                                    }`}
                                            >
                                                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${planSettings[toggle.key] ? 'translate-x-5' : 'translate-x-1'
                                                    }`} />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Slow Ramp Up Increment — only show when ramp up is on */}
                                    {planSettings.slowRampUp && (
                                        <div className="flex items-center justify-between p-3 bg-[#1a1e24] rounded-lg border border-zinc-800">
                                            <div>
                                                <div className="text-white text-sm font-medium">Ramp Up Increment</div>
                                                <div className="text-zinc-500 text-xs">Emails added per day (e.g. +2/day until limit)</div>
                                            </div>
                                            <input
                                                type="number"
                                                value={planSettings.slowRampUpIncrement || 2}
                                                onChange={(e) => setPlanSettings(prev => ({ ...prev, slowRampUpIncrement: Math.max(1, Math.min(10, parseInt(e.target.value) || 2)) }))}
                                                min={1}
                                                max={10}
                                                className="w-16 bg-[#111417] border border-zinc-700 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:border-[#40c9ff] focus:outline-none"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {planActiveTab === 'strategy' && (
                            <div className="flex flex-col h-full gap-4">
                                {planArtifact ? (
                                    <>
                                        {/* Artifact Display */}
                                        <div className="flex-grow">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Strategy Document</label>
                                                <span className="text-zinc-600 text-[10px]">{planArtifact.length.toLocaleString()} chars</span>
                                            </div>
                                            <textarea
                                                value={planArtifact}
                                                onChange={(e) => setPlanArtifact(e.target.value)}
                                                rows={14}
                                                className="w-full bg-[#1a1e24] border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm font-mono resize-y focus:border-[#40c9ff] focus:outline-none transition-colors leading-relaxed"
                                                placeholder="Strategy artifact will appear here after uploading a file..."
                                            />
                                        </div>

                                        {/* AI Refine Prompt */}
                                        <div className="bg-[#1a1e24] border border-zinc-800 rounded-xl p-4">
                                            <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block mb-2">
                                                <Wand2 className="w-3.5 h-3.5 inline mr-1.5" />
                                                Refine with AI
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={artifactPrompt}
                                                    onChange={(e) => setArtifactPrompt(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey && artifactPrompt.trim() && !refiningArtifact) {
                                                            e.preventDefault();
                                                            handleRefineArtifact();
                                                        }
                                                    }}
                                                    placeholder="e.g. Make email 2 shorter and more casual..."
                                                    className="flex-1 bg-[#111417] border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:border-[#40c9ff] focus:outline-none"
                                                    disabled={refiningArtifact}
                                                />
                                                <button
                                                    onClick={handleRefineArtifact}
                                                    disabled={refiningArtifact || !artifactPrompt.trim()}
                                                    className="px-4 py-2.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors text-sm font-bold border border-purple-500/20 disabled:opacity-50 inline-flex items-center gap-2"
                                                >
                                                    {refiningArtifact ? (
                                                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Refining...</>
                                                    ) : (
                                                        <><SendHorizonal className="w-3.5 h-3.5" /> Refine</>
                                                    )}
                                                </button>
                                            </div>
                                            <p className="text-zinc-600 text-[10px] mt-2">
                                                Changes update the strategy document only. Click &quot;Apply to Campaign&quot; below to repopulate sequences &amp; settings.
                                            </p>
                                        </div>

                                        {/* AI Response */}
                                        {refineResponse && (
                                            <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-4 flex gap-3">
                                                <div className="flex-shrink-0 w-7 h-7 bg-purple-500/20 rounded-full flex items-center justify-center">
                                                    <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-white text-sm leading-relaxed">{refineResponse}</p>
                                                    <button
                                                        onClick={() => setRefineResponse('')}
                                                        className="text-zinc-600 text-[10px] mt-1.5 hover:text-zinc-400 transition-colors"
                                                    >
                                                        Dismiss
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Action Buttons Row */}
                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleApplyArtifact}
                                                disabled={applyingArtifact}
                                                className="flex-1 py-3 rounded-xl bg-[#40c9ff]/10 text-[#40c9ff] font-bold hover:bg-[#40c9ff]/20 transition-colors text-sm border border-[#40c9ff]/20 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                                            >
                                                {applyingArtifact ? (
                                                    <><RefreshCw className="w-4 h-4 animate-spin" /> Applying...</>
                                                ) : (
                                                    <><Wand2 className="w-4 h-4" /> Apply to Campaign</>
                                                )}
                                            </button>
                                            <button
                                                onClick={handleCheckSpam}
                                                disabled={checkingSpam}
                                                className="py-3 px-5 rounded-xl bg-amber-500/10 text-amber-400 font-bold hover:bg-amber-500/20 transition-colors text-sm border border-amber-500/20 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                                            >
                                                {checkingSpam ? (
                                                    <><RefreshCw className="w-4 h-4 animate-spin" /> Checking...</>
                                                ) : (
                                                    <><Shield className="w-4 h-4" /> Check Spam Triggers</>
                                                )}
                                            </button>
                                        </div>

                                        {/* Spam Report */}
                                        {spamReport && (
                                            <div ref={spamReportRef} className="bg-[#1a1e24] border border-zinc-800 rounded-xl overflow-hidden">
                                                {/* Score Header */}
                                                <div className={`px-4 py-3 flex items-center justify-between ${spamReport.score >= 80 ? 'bg-emerald-500/10 border-b border-emerald-500/20' :
                                                    spamReport.score >= 60 ? 'bg-yellow-500/10 border-b border-yellow-500/20' :
                                                        'bg-red-500/10 border-b border-red-500/20'
                                                    }`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`text-2xl font-black ${spamReport.score >= 80 ? 'text-emerald-400' :
                                                            spamReport.score >= 60 ? 'text-yellow-400' :
                                                                'text-red-400'
                                                            }`}>
                                                            {spamReport.score}/100
                                                        </div>
                                                        <div>
                                                            <div className={`text-sm font-bold uppercase ${spamReport.score >= 80 ? 'text-emerald-400' :
                                                                spamReport.score >= 60 ? 'text-yellow-400' :
                                                                    'text-red-400'
                                                                }`}>
                                                                {spamReport.verdict === 'clean' ? 'Clean' :
                                                                    spamReport.verdict === 'minor_issues' ? 'Minor Issues' :
                                                                        spamReport.verdict === 'needs_attention' ? 'Needs Attention' :
                                                                            'High Risk'}
                                                            </div>
                                                            <div className="text-zinc-400 text-xs">{spamReport.summary}</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setSpamReport(null)}
                                                        className="text-zinc-600 hover:text-zinc-400 text-xs"
                                                    >
                                                        Dismiss
                                                    </button>
                                                </div>

                                                {/* Issues List */}
                                                {spamReport.issues && spamReport.issues.length > 0 && (
                                                    <div className="divide-y divide-zinc-800/50">
                                                        {spamReport.issues.map((issue: any, idx: number) => (
                                                            <div key={idx} className="px-4 py-3 flex gap-3">
                                                                <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${issue.severity === 'high' ? 'bg-red-400' :
                                                                    issue.severity === 'medium' ? 'bg-yellow-400' :
                                                                        'bg-blue-400'
                                                                    }`} />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-white text-sm font-medium">
                                                                            {issue.text ? `"${issue.text}"` : issue.type}
                                                                        </span>
                                                                        {issue.email && (
                                                                            <span className="text-zinc-600 text-[10px] uppercase">{issue.email}</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-zinc-500 text-xs mt-0.5">{issue.suggestion}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Fix All Issues Button */}
                                                {spamReport.issues && spamReport.issues.length > 0 && (
                                                    <div className="px-4 py-3 border-t border-zinc-800">
                                                        <button
                                                            onClick={handleFixSpamIssues}
                                                            disabled={refiningArtifact}
                                                            className="w-full py-2.5 rounded-lg bg-amber-500/10 text-amber-400 font-bold hover:bg-amber-500/20 transition-colors text-sm border border-amber-500/20 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                                                        >
                                                            {refiningArtifact ? (
                                                                <><RefreshCw className="w-4 h-4 animate-spin" /> Fixing Issues...</>
                                                            ) : (
                                                                <><Wand2 className="w-4 h-4" /> Fix All Issues</>
                                                            )}
                                                        </button>
                                                        <p className="text-zinc-600 text-[10px] mt-1.5 text-center">
                                                            AI will rewrite the strategy to fix all flagged issues
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <FileText className="w-12 h-12 text-zinc-700 mb-4" />
                                        <h4 className="text-white font-semibold mb-2">No Strategy Artifact</h4>
                                        <p className="text-zinc-500 text-sm max-w-sm">
                                            Upload a strategy file in the Email Sequences tab to create your strategy artifact. Once uploaded, you can view, edit, and refine it here with AI.
                                        </p>
                                        <button
                                            onClick={() => setPlanActiveTab('sequences')}
                                            className="mt-4 px-4 py-2 rounded-lg bg-[#40c9ff]/10 text-[#40c9ff] text-sm font-medium hover:bg-[#40c9ff]/20 transition-colors"
                                        >
                                            Go to Email Sequences
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col gap-3 p-6 border-t border-zinc-800">
                        {/* Instantly Actions — only visible when campaign has been deployed */}
                        {editingPlanFor.instantlyCampaignId && (
                            <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-zinc-800/50">
                                {/* Deploy Settings to Instantly */}
                                <button
                                    onClick={handleSyncSettings}
                                    disabled={syncingSettings}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#d7ff00]/10 text-[#d7ff00] font-bold hover:bg-[#d7ff00]/20 transition-colors text-sm border border-[#d7ff00]/20 disabled:opacity-50"
                                >
                                    {syncingSettings ? (
                                        <><RefreshCw className="w-4 h-4 animate-spin" /> Deploying...</>
                                    ) : (
                                        <><Upload className="w-4 h-4" /> Deploy Settings to Instantly</>
                                    )}
                                </button>

                                {/* Activate / Pause Campaign */}
                                {editingPlanFor.campaignActive ? (
                                    <button
                                        onClick={() => handleActivateCampaign('pause')}
                                        disabled={activatingCampaign}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 text-amber-400 font-bold hover:bg-amber-500/20 transition-colors text-sm border border-amber-500/20 disabled:opacity-50"
                                    >
                                        {activatingCampaign ? (
                                            <><RefreshCw className="w-4 h-4 animate-spin" /> Pausing...</>
                                        ) : (
                                            <><Pause className="w-4 h-4" /> Pause Campaign</>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleActivateCampaign('activate')}
                                        disabled={activatingCampaign}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold hover:bg-emerald-500/20 transition-colors text-sm border border-emerald-500/20 disabled:opacity-50"
                                    >
                                        {activatingCampaign ? (
                                            <><RefreshCw className="w-4 h-4 animate-spin" /> Activating...</>
                                        ) : (
                                            <><Zap className="w-4 h-4" /> Activate Campaign</>
                                        )}
                                    </button>
                                )}

                                {/* Status indicators */}
                                <div className="ml-auto flex items-center gap-2">
                                    {editingPlanFor.campaignActive && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 uppercase">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                                        </span>
                                    )}
                                    {editingPlanFor.settingsLastSynced && (
                                        <span className="text-zinc-600 text-[10px]">
                                            Settings synced {new Date(editingPlanFor.settingsLastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Primary actions row */}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setEditingPlanFor(null)}
                                className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-[#1a1e24] text-white hover:bg-zinc-800 transition-colors text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={savePlan}
                                disabled={savingPlan}
                                className="px-6 py-2.5 rounded-xl bg-[#40c9ff] text-black font-bold hover:bg-[#33b4e6] transition-colors text-sm disabled:opacity-50"
                            >
                                {savingPlan ? 'Saving...' : 'Save Plan'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ─── Logs Modal ─────────────────────────────────────────

    const renderLogsModal = () => {
        if (!viewingLogsFor) return null;

        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                <div className="bg-[#111417] border border-zinc-800 rounded-3xl p-6 w-full max-w-3xl flex flex-col max-h-[85vh] shadow-2xl relative">
                    <button onClick={() => setViewingLogsFor(null)} className="absolute right-6 top-6 text-zinc-500 hover:text-white transition-colors">
                        <XCircle className="w-6 h-6" />
                    </button>
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <Terminal className="w-5 h-5 text-zinc-400" /> Campaign Debug Logs
                    </h3>
                    <p className="text-zinc-500 text-sm mb-6">
                        System traces for <strong>{viewingLogsFor.title}</strong> directly from background workers.
                    </p>
                    <div className="bg-[#0b0d10] border border-zinc-800 rounded-xl flex-grow overflow-y-auto p-4 mb-6 font-mono text-sm">
                        {!viewingLogsFor.pushLogs || viewingLogsFor.pushLogs.length === 0 ? (
                            <div className="text-zinc-600 text-center py-12">No logs recorded yet.</div>
                        ) : (
                            viewingLogsFor.pushLogs.map((log, i) => (
                                <div key={i} className={`py-1 ${log.includes('FATAL ERROR') || log.includes('failed') ? 'text-rose-400' : 'text-zinc-300'} border-b border-zinc-800/50 last:border-0`}>
                                    {log}
                                </div>
                            ))
                        )}
                    </div>
                    <div className="flex justify-end gap-3 mt-auto">
                        <button onClick={copyLogsToClipboard} className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-[#1a1e24] text-white hover:bg-zinc-800 transition-colors flex items-center gap-2 text-sm font-medium">
                            <CopyIcon className="w-4 h-4" /> Copy Log
                        </button>
                        <button onClick={() => setViewingLogsFor(null)} className="px-4 py-2.5 rounded-xl bg-[#d7ff00] text-black font-bold hover:bg-[#bce600] transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderTutorialModal = () => {
        if (!showTutorial) return null;

        const step = TUTORIAL_STEPS[tutorialStep];
        const isFirst = tutorialStep === 0;
        const isLast = tutorialStep === TUTORIAL_STEPS.length - 1;

        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                <div className="bg-[#111417] border border-zinc-800 rounded-3xl w-full max-w-2xl shadow-2xl">
                    <div className="p-6 border-b border-zinc-800 flex items-start justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <HelpCircle className="w-5 h-5 text-[#40c9ff]" />
                                Campaign Autopilot Tutorial
                            </h3>
                            <p className="text-zinc-500 text-sm mt-1">
                                Step {tutorialStep + 1} of {TUTORIAL_STEPS.length}
                            </p>
                        </div>
                        <button onClick={() => closeTutorial(true)} className="text-zinc-500 hover:text-white">
                            <XCircle className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-6">
                        <h4 className="text-white font-semibold text-lg mb-2">{step.title}</h4>
                        <p className="text-zinc-300 text-sm leading-relaxed mb-4">{step.description}</p>
                        <div className="bg-[#1a1e24] border border-zinc-800 rounded-xl p-3">
                            <p className="text-zinc-400 text-xs uppercase tracking-wider font-semibold mb-1">Tip</p>
                            <p className="text-zinc-300 text-sm">{step.tip}</p>
                        </div>
                    </div>

                    <div className="p-6 border-t border-zinc-800 flex items-center justify-between">
                        <button
                            onClick={() => closeTutorial(true)}
                            className="px-4 py-2 rounded-xl border border-zinc-700 bg-[#1a1e24] text-white hover:bg-zinc-800 transition-colors text-sm font-medium"
                        >
                            Skip
                        </button>

                        <div className="flex items-center gap-2">
                            {!isFirst && (
                                <button
                                    onClick={() => setTutorialStep(prev => Math.max(0, prev - 1))}
                                    className="px-4 py-2 rounded-xl border border-zinc-700 bg-[#1a1e24] text-white hover:bg-zinc-800 transition-colors text-sm font-medium"
                                >
                                    Back
                                </button>
                            )}
                            {isLast ? (
                                <button
                                    onClick={() => closeTutorial(true)}
                                    className="px-5 py-2 rounded-xl bg-[#40c9ff] text-black font-bold hover:bg-[#33b4e6] transition-colors text-sm"
                                >
                                    Got It
                                </button>
                            ) : (
                                <button
                                    onClick={() => setTutorialStep(prev => Math.min(TUTORIAL_STEPS.length - 1, prev + 1))}
                                    className="px-5 py-2 rounded-xl bg-[#40c9ff] text-black font-bold hover:bg-[#33b4e6] transition-colors text-sm"
                                >
                                    Next
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ─── Analytics Inline ───────────────────────────────────

    const renderAnalytics = (camp: OutreachCampaign) => {
        if (camp.deployStatus !== 'deployed' || !camp.analytics) return null;

        return (
            <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1 text-xs">
                    <Eye className="w-3 h-3 text-blue-400" />
                    <span className="text-blue-400 font-bold">{camp.analytics.openRate}%</span>
                    <span className="text-zinc-600">opens</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                    <MessageSquare className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">{camp.analytics.replyRate}%</span>
                    <span className="text-zinc-600">replies</span>
                </div>
                {camp.analytics.lastSynced && (
                    <span className="text-zinc-600 text-[10px]">
                        synced {new Date(camp.analytics.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>
        );
    };

    // ─── Main Render ────────────────────────────────────────

    return (
        <AdminRouteGuard>
            <Head>
                <title>Outreach Campaigns | Pulse Admin</title>
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
                                    <span className="text-[#40c9ff]"><Target className="w-6 h-6" /></span>
                                    Outreach Campaigns
                                </h1>
                                <p className="text-zinc-500 text-sm mt-0.5">
                                    Plan, deploy, and monitor your email campaigns
                                </p>
                            </div>
                        </div>
                        <button onClick={fetchCampaigns} className="flex flex-shrink-0 items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1e24] border border-zinc-700 text-zinc-300 hover:text-white hover:bg-[#262a30] transition-colors text-sm" disabled={loading}>
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                        <button
                            onClick={openTutorial}
                            className="flex flex-shrink-0 items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1e24] border border-zinc-700 text-zinc-300 hover:text-white hover:bg-[#262a30] transition-colors text-sm"
                        >
                            <HelpCircle className="w-4 h-4" /> Tutorial
                        </button>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#1a1e24]">
                        <table className="min-w-full">
                            <thead>
                                <tr className="border-b border-zinc-800">
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Campaign</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Leads</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Created</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {campaigns.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                                            {loading ? 'Loading...' : 'No outreach campaigns built yet. Go to Fitness Seeker Leads to start one.'}
                                        </td>
                                    </tr>
                                ) : (
                                    campaigns.map((camp) => (
                                        <tr key={camp.id} className="hover:bg-[#111417] transition-colors">
                                            {/* Campaign Name + Deploy Status + Analytics */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-medium">{camp.title}</span>
                                                    {getDeployBadge(camp)}
                                                </div>
                                                <div className="text-zinc-500 text-xs mt-1 font-mono">ID: {camp.id.substring(0, 8)}...</div>
                                                {camp.emailSequences && camp.emailSequences.length > 0 && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <Mail className="w-3 h-3 text-zinc-600" />
                                                        <span className="text-zinc-600 text-[10px]">{camp.emailSequences.length} emails configured</span>
                                                    </div>
                                                )}
                                                {/* Deploy error */}
                                                {camp.deployStatus === 'deploy_failed' && camp.deployError && (
                                                    <div className="mt-1.5 text-red-400 text-[10px] bg-red-500/5 border border-red-500/10 rounded px-2 py-1 font-mono max-w-xs truncate">
                                                        {camp.deployError}
                                                    </div>
                                                )}
                                                {renderAnalytics(camp)}
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

                                            {/* Status */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-current/20 whitespace-nowrap ${getStatusBadgeColor(camp.status)}`}>
                                                        {formatStatus(camp.status)}
                                                    </span>
                                                    {camp.campaignActive && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 uppercase">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Leads breakdown */}
                                                <div className="flex items-center gap-2 mt-2 text-[10px]">
                                                    <span className="text-white">{camp.totalLeads?.toLocaleString()} total</span>
                                                    <span className="text-emerald-400">{camp.verifiedLeads?.toLocaleString() || 0} valid</span>
                                                    <span className="text-purple-400 font-bold">{camp.pushedLeads?.toLocaleString() || 0} pushed</span>
                                                </div>
                                            </td>

                                            {/* Leads Column (compact) */}
                                            <td className="px-6 py-4">
                                                <div className="text-white font-medium">{camp.totalLeads?.toLocaleString()}</div>
                                                <div className="text-zinc-500 text-xs">{camp.verifiedLeads?.toLocaleString() || 0} verified</div>
                                            </td>

                                            {/* Created */}
                                            <td className="px-6 py-4 text-zinc-400 text-sm whitespace-nowrap">{formatDate(camp.createdAt)}</td>

                                            {/* Actions */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap items-center justify-center gap-2">
                                                    {/* Plan Editor Button — always available */}
                                                    <button
                                                        onClick={() => openPlanEditor(camp)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors text-sm font-medium"
                                                    >
                                                        <Settings className="w-3.5 h-3.5" /> Plan
                                                    </button>

                                                    {/* Verify */}
                                                    {camp.status === 'pending_verification' && (
                                                        <button
                                                            onClick={() => handleVerify(camp.id)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm font-medium"
                                                        >
                                                            <Play className="w-3.5 h-3.5" /> Verify
                                                        </button>
                                                    )}

                                                    {/* Verifying */}
                                                    {camp.status === 'verifying' && (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-zinc-400 text-sm font-medium">
                                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...
                                                        </span>
                                                    )}

                                                    {/* Deploy / Push — for ready_to_push campaigns */}
                                                    {camp.status === 'ready_to_push' &&
                                                        camp.deployStatus !== 'deploy_failed' &&
                                                        camp.deployStatus !== 'deploying' &&
                                                        camp.deployStatus !== 'campaign_created' &&
                                                        camp.deployStatus !== 'pushing_leads' && (
                                                            <>
                                                                {camp.emailSequences && camp.emailSequences.length > 0 ? (
                                                                    <button
                                                                        onClick={() => handleDeploy(camp.id)}
                                                                        disabled={deploying === camp.id}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d7ff00]/10 text-[#d7ff00] hover:bg-[#d7ff00]/20 transition-colors text-sm font-bold border border-[#d7ff00]/20 disabled:opacity-50"
                                                                    >
                                                                        {deploying === camp.id ? (
                                                                            <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Deploying...</>
                                                                        ) : (
                                                                            <><Rocket className="w-3.5 h-3.5" /> Deploy to Instantly</>
                                                                        )}
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handlePushToInstantly(camp.id)}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#40c9ff]/10 text-[#40c9ff] hover:bg-[#40c9ff]/20 transition-colors text-sm font-medium border border-[#40c9ff]/20"
                                                                    >
                                                                        <Send className="w-3.5 h-3.5" /> Manual Push
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}

                                                    {/* Deploying state */}
                                                    {(camp.deployStatus === 'deploying' || camp.deployStatus === 'campaign_created' || camp.deployStatus === 'pushing_leads') && (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-purple-400 text-sm font-medium">
                                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Deploying...
                                                        </span>
                                                    )}

                                                    {/* Pushing */}
                                                    {camp.status === 'pushing' && !camp.deployStatus && (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-purple-400 text-sm font-medium">
                                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Pushing...
                                                        </span>
                                                    )}

                                                    {/* Deploy Failed — Retry */}
                                                    {camp.deployStatus === 'deploy_failed' && (
                                                        <button
                                                            onClick={() => handleDeploy(camp.id)}
                                                            disabled={deploying === camp.id}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium border border-red-500/20"
                                                        >
                                                            <RefreshCw className="w-3.5 h-3.5" /> Retry Deploy
                                                        </button>
                                                    )}

                                                    {/* Deployed — Analytics Sync */}
                                                    {camp.deployStatus === 'deployed' && (
                                                        <button
                                                            onClick={() => handleSyncAnalytics(camp.id)}
                                                            disabled={syncingAnalytics === camp.id}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm font-medium"
                                                        >
                                                            {syncingAnalytics === camp.id ? (
                                                                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Syncing...</>
                                                            ) : (
                                                                <><BarChart3 className="w-3.5 h-3.5" /> Sync Stats</>
                                                            )}
                                                        </button>
                                                    )}

                                                    {/* Completed without autopilot — legacy buttons */}
                                                    {camp.status === 'completed' && !camp.deployStatus && (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-sm font-medium rounded-lg">
                                                            <CheckCircle className="w-3.5 h-3.5" /> Published
                                                        </span>
                                                    )}

                                                    {/* Logs */}
                                                    {(camp.pushLogs && camp.pushLogs.length > 0) && (
                                                        <button
                                                            onClick={() => setViewingLogsFor(camp)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 transition-colors text-sm font-medium"
                                                        >
                                                            <Terminal className="w-4 h-4" /> Logs
                                                        </button>
                                                    )}

                                                    {/* Delete */}
                                                    <button
                                                        onClick={() => handleDeleteCampaign(camp.id)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors text-sm font-medium"
                                                    >
                                                        <Trash2 className="w-4 h-4" /> Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {renderPlanEditor()}
            {renderLogsModal()}
            {renderTutorialModal()}
        </AdminRouteGuard>
    );
};

export default OutreachCampaignsPage;
