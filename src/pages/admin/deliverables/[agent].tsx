import React, { useState, useCallback, useRef, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { MarkdownRenderer } from '../../../components/MarkdownRenderer';

/* ─────────────────────── types ─────────────────────── */

interface Artifact {
    id: string;
    title: string;
    category: ArtifactCategory;
    path: string;
    description: string;
    tags: string[];
    emoji: string;
    status?: 'complete' | 'pending-recovery';
    completedAt?: string;
    taskRef?: string;
}

type ArtifactCategory =
    | 'deliverable'
    | 'persona'
    | 'research'
    | 'profile'
    | 'integration'
    | 'analysis'
    | 'config';

/* ─────────────────── category meta ─────────────────── */

const CATEGORIES: Record<ArtifactCategory, { label: string; icon: string; color: string; gradient: string }> = {
    deliverable: {
        label: 'Research Output',
        icon: '📡',
        color: '#f59e0b',
        gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)',
    },
    persona: {
        label: 'Persona & Identity',
        icon: '🧬',
        color: '#a78bfa',
        gradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    },
    research: {
        label: 'Field Research',
        icon: '🔬',
        color: '#34d399',
        gradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
    },
    profile: {
        label: 'Profile & Presence',
        icon: '🪪',
        color: '#60a5fa',
        gradient: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
    },
    integration: {
        label: 'Integration & Testing',
        icon: '🧪',
        color: '#fbbf24',
        gradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
    },
    analysis: {
        label: 'Analysis & Decisions',
        icon: '📊',
        color: '#f472b6',
        gradient: 'linear-gradient(135deg, #db2777 0%, #f472b6 100%)',
    },
    config: {
        label: 'Configuration',
        icon: '⚙️',
        color: '#38bdf8',
        gradient: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
    },
};

/* ─────────────────── agent registry ─────────────────── */

interface AgentMeta {
    displayName: string;
    emoji: string;
    role: string;
    tagline: string;
    color: string;
    gradient: string;
    docsDir: string;          // where static docs live, e.g. 'docs/sage'
    deliverableDir: string;   // where manifest.json lives
    creed?: string[];
}

const AGENT_REGISTRY: Record<string, AgentMeta> = {
    sage: {
        displayName: 'Sage',
        emoji: '🧬',
        role: 'Research Intelligence Envoy',
        tagline: 'Field Notes → Patterns → Feed Drops',
        color: '#34d399',
        gradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
        docsDir: 'docs/sage',
        deliverableDir: 'docs/sage/deliverables',
        creed: [
            'Illuminate, never interrogate. Carry a lantern, not a spotlight.',
            'Return with receipts. Every insight pairs a heartbeat with verifiable context.',
            "Stay on our side of the line. Internal-facing only.",
            'Name the signal, honor the story. Data → patterns, but people stay visible.',
            "Move with compass discipline. Every dispatch ties back to Pulse's values.",
        ],
    },
    nora: {
        displayName: 'Nora',
        emoji: '⚡',
        role: 'Director of System Ops',
        tagline: 'Orchestrate → Delegate → Deliver',
        color: '#22c55e',
        gradient: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
        docsDir: 'docs/agents/nora',
        deliverableDir: 'docs/agents/nora/deliverables',
    },
    scout: {
        displayName: 'Scout',
        emoji: '🕵️',
        role: 'Influencer Research Analyst',
        tagline: 'Discover → Qualify → Shortlist',
        color: '#f59e0b',
        gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
        docsDir: 'docs/agents/scout',
        deliverableDir: 'docs/agents/scout/deliverables',
    },
    solara: {
        displayName: 'Solara',
        emoji: '❤️‍🔥',
        role: 'Brand Voice Steward',
        tagline: 'Calibrate → Narrate → Inspire',
        color: '#f43f5e',
        gradient: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
        docsDir: 'docs/agents/solara',
        deliverableDir: 'docs/agents/solara/deliverables',
    },
    antigravity: {
        displayName: 'Antigravity',
        emoji: '🌌',
        role: 'Co-CEO · Strategy & Architecture',
        tagline: 'Pair Programming → Architecture → Execution',
        color: '#8b5cf6',
        gradient: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
        docsDir: 'docs/agents/antigravity',
        deliverableDir: 'docs/agents/antigravity/deliverables',
    },
};

/* ────────────────── static artifacts per agent ────────────────── */

const AGENT_ARTIFACTS: Record<string, Artifact[]> = {
    sage: [
        { id: 'brainstorm-extract', title: 'Brainstorm — Source Extraction', category: 'persona', path: 'docs/sage/brainstorm-extract.md', description: "Every description of Sage's role, tone, duties, and narrative cues.", tags: ['brainstorm', 'identity'], emoji: '💡' },
        { id: 'persona-narrative', title: 'Persona Narrative & Creed', category: 'persona', path: 'docs/sage/persona.md', description: "Sage's lantern-carrying field correspondent narrative plus the five living vows.", tags: ['creed', 'narrative'], emoji: '📜' },
        { id: 'responsibilities', title: 'Core Responsibilities', category: 'persona', path: 'docs/sage/responsibilities.md', description: 'Three operating stages: Field Research, Pattern Synthesis, Feed + Report Delivery.', tags: ['duties', 'field-research'], emoji: '📋' },
        { id: 'sage-persona-agent', title: 'Research Intelligence Envoy Persona', category: 'persona', path: 'docs/agents/sage-persona.md', description: 'Voice & creed guidelines, primary duties, operating constraints, and OpenClaw config.', tags: ['voice', 'constraints'], emoji: '🎙️' },
        { id: 'sage-profile', title: 'Full Agent Profile', category: 'profile', path: 'docs/agents/sage-profile.md', description: 'Complete profile — identity, creed, responsibilities, and presence configuration.', tags: ['profile', 'virtual-office'], emoji: '🧬' },
        { id: 'sage-profile-vo', title: 'Virtual Office Profile Notes', category: 'profile', path: 'docs/sage/profile.md', description: 'How Sage renders in the Virtual Office — presence card, SAGE_PRESENCE fallback.', tags: ['virtual-office', 'ui'], emoji: '🖥️' },
        { id: 'presence-card-structure', title: 'Presence Card Structure', category: 'profile', path: 'docs/sage/presence-card-structure.md', description: "Layout sections, styling, and Firestore data requirements for Sage's hover panel.", tags: ['presence-card', 'layout'], emoji: '🃏' },
        { id: 'intel-feed', title: 'Intel Feed Integration', category: 'research', path: 'docs/agents/sage-intel-feed.md', description: 'How Sage publishes research drops to the intel-feed Firestore collection.', tags: ['intel-feed', 'firestore', 'api'], emoji: '📡' },
        // ─── Research Deliverables (peptides) ───
        { id: 'peptide-research-brief', title: 'Peptide Research Brief', category: 'deliverable', path: 'docs/sage/deliverables/peptide-research-brief.md', description: "Research brief synthesizing peptide findings into Pulse's brand voice — FDA status, WADA classifications, market analysis, and consumer safety considerations.", tags: ['peptides', 'research', 'FDA', 'WADA', 'brand-voice'], emoji: '🧬' },
        { id: 'peptide-whitepaper-outline', title: 'Peptide Whitepaper Outline', category: 'deliverable', path: 'docs/sage/deliverables/peptide-whitepaper-outline.md', description: "Proposed outline segment for the peptide whitepaper — structured sections covering science, regulation, market landscape, and Pulse's positioning.", tags: ['peptides', 'whitepaper', 'outline', 'content-strategy'], emoji: '📄' },
        { id: 'integration-checklist', title: 'Integration Verification Checklist', category: 'integration', path: 'docs/testing/sage-integration-checklist.md', description: 'UI presence, OpenClaw runner, and intel feed verification steps.', tags: ['testing', 'checklist'], emoji: '✅' },
        { id: 'virtual-office-verification', title: 'Virtual Office Verification Report', category: 'integration', path: 'docs/testing/sage-virtual-office-verification.md', description: 'Full rendering pass, intel feed confirmation, and Firestore presence check.', tags: ['verification', 'debugging'], emoji: '🔍' },
        { id: 'config-status', title: 'Configuration Status Report', category: 'analysis', path: '.agent/analysis/sage-configuration-status.md', description: 'Comprehensive comparison of requested vs. actual Sage configuration.', tags: ['status', 'comparison'], emoji: '📊' },
        { id: 'presence-verification', title: 'Presence Card Verification Report', category: 'analysis', path: '.agent/analysis/sage-presence-verification.md', description: 'Step-by-step verification of all seven required data structures.', tags: ['verification', 'data-structures'], emoji: '🔎' },
        { id: 'role-title-decision', title: 'Role Title Decision Record', category: 'analysis', path: '.agent/decisions/sage-role-title-decision.md', description: 'ADR: why "Research Intelligence Envoy" was kept.', tags: ['adr', 'decision'], emoji: '⚖️' },
        { id: 'openclaw-config', title: 'OpenClaw Runner Config', category: 'config', path: '.agent/workflows/sage-openclaw-config.json', description: 'JSON configuration for the Sage OpenClaw agent.', tags: ['openclaw', 'json'], emoji: '🔧' },
    ],
    nora: [
        // Persona & Identity
        { id: 'nora-manifesto', title: 'Agent Manifesto', category: 'persona', path: 'docs/AGENT_MANIFESTO.md', description: 'Core principles, problem-solving playbook, environment knowledge, and lessons learned shared across all agents.', tags: ['manifesto', 'principles', 'playbook'], emoji: '🧭' },
        { id: 'nora-onboarding-guide', title: 'Agent Onboarding Guide', category: 'persona', path: 'docs/AGENT_ONBOARDING.md', description: 'Comprehensive step-by-step guide for onboarding new agents into the Pulse ecosystem.', tags: ['onboarding', 'setup'], emoji: '📖' },
        { id: 'nora-onboarding-runbook', title: 'Agent Onboarding Runbook', category: 'persona', path: 'docs/agents/onboarding-runbook.md', description: 'Technical runbook for adding a new agent — agentRunner.js, Virtual Office, launchd daemon, and verification.', tags: ['runbook', 'technical', 'daemon'], emoji: '🛠' },
        // Profile & Presence
        { id: 'nora-profile-reference', title: 'Agent Profile Reference', category: 'profile', path: '.agent/analysis/agent-profile-reference.json', description: 'Complete JSON reference of all agent profile data structures — desk positions, roles, duties, and emoji defaults.', tags: ['profile', 'reference', 'json'], emoji: '📋' },
        { id: 'nora-profile-template', title: 'Agent Profile Template', category: 'profile', path: '.agent/analysis/agent-profile-template.md', description: 'Extracted template for creating agent presence card profiles. Includes checklist, naming conventions, and examples.', tags: ['template', 'checklist', 'presence-card'], emoji: '📝' },
        { id: 'nora-office-layout', title: 'Office Layout Diagram', category: 'profile', path: '.agent/analysis/office-layout-diagram.md', description: 'Visual ASCII diagram of the Virtual Office floor plan with coordinate system, desk positions, and expansion planning.', tags: ['layout', 'diagram', 'coordinates'], emoji: '🗺️' },
        // Integration & Config
        { id: 'nora-runner-script', title: 'Agent Runner Script', category: 'config', path: 'scripts/start-agent-nora.sh', description: 'Shell script to launch the Nora agent daemon with environment configuration.', tags: ['shell', 'daemon', 'startup'], emoji: '🔧' },
        { id: 'nora-openclaw-config', title: 'OpenClaw Runner Smoke Test Plan', category: 'integration', path: 'docs/openclaw-runner-smoke-test-plan.md', description: 'End-to-end smoke test plan for verifying the OpenClaw agent runner integration.', tags: ['openclaw', 'testing', 'smoke-test'], emoji: '🧪' },
        // Analysis & Decisions
        { id: 'nora-round-table-plan', title: 'Round Table Implementation Plan', category: 'analysis', path: '.agent/analysis/round-table-implementation-plan.md', description: 'Implementation plan for the Round Table group collaboration feature — agent animations, chat modal, and orchestration.', tags: ['round-table', 'collaboration', 'planning'], emoji: '📊' },
        { id: 'nora-round-table-reqs', title: 'Round Table Requirements', category: 'analysis', path: '.agent/analysis/round-table-requirements.md', description: 'Feature requirements for agents animating from desks to a central round table for discussions.', tags: ['requirements', 'round-table'], emoji: '📝' },
        { id: 'nora-role-comparison', title: 'Role Title Comparison', category: 'analysis', path: '.agent/analysis/role-title-comparison.md', description: 'Comparison analysis of agent role titles across the system — ensuring consistency.', tags: ['roles', 'comparison', 'consistency'], emoji: '⚖️' },
        { id: 'nora-vo-structure', title: 'Virtual Office Structure Analysis', category: 'analysis', path: '.agent/analysis/virtualOffice-structure-analysis.md', description: 'Detailed structural analysis of the Virtual Office component — data flow, state management, and rendering.', tags: ['virtual-office', 'architecture', 'analysis'], emoji: '🏗️' },
    ],
    scout: [
        // Persona & Identity
        { id: 'scout-manifesto', title: 'Agent Manifesto', category: 'persona', path: 'docs/AGENT_MANIFESTO.md', description: 'Shared manifesto — principles, env knowledge, problem-solving playbook, and lessons learned.', tags: ['manifesto', 'principles'], emoji: '🧭' },
        { id: 'scout-onboarding-guide', title: 'Agent Onboarding Guide', category: 'persona', path: 'docs/AGENT_ONBOARDING.md', description: 'Step-by-step onboarding guide for setting up new agents in the Pulse system.', tags: ['onboarding', 'setup'], emoji: '📖' },
        { id: 'scout-onboarding-runbook', title: 'Agent Onboarding Runbook', category: 'persona', path: 'docs/agents/onboarding-runbook.md', description: 'Technical runbook — agentRunner.js config, Virtual Office setup, daemon management, and verification.', tags: ['runbook', 'technical'], emoji: '🛠' },
        // Profile & Presence
        { id: 'scout-profile-template', title: 'Agent Profile Template (Scout-Based)', category: 'profile', path: '.agent/analysis/agent-profile-template.md', description: "Complete profile template extracted from Scout's configuration — 7 data structures for Virtual Office presence.", tags: ['template', 'profile', 'extracted'], emoji: '📋' },
        { id: 'scout-profile-reference', title: 'Agent Profile Reference', category: 'profile', path: '.agent/analysis/agent-profile-reference.json', description: 'JSON reference of all agent profiles, desk positions, roles, and configuration status.', tags: ['profile', 'reference', 'json'], emoji: '📐' },
        { id: 'scout-office-layout', title: 'Office Layout Diagram', category: 'profile', path: '.agent/analysis/office-layout-diagram.md', description: 'Visual floor plan of the Virtual Office with coordinate system and distance analysis between agents.', tags: ['layout', 'diagram', 'coordinates'], emoji: '🗺️' },
        // Integration & Config
        { id: 'scout-runner-script', title: 'Agent Runner Script', category: 'config', path: 'scripts/start-agent-scout.sh', description: 'Shell script to launch the Scout agent daemon with environment configuration.', tags: ['shell', 'daemon', 'startup'], emoji: '🔧' },
        { id: 'scout-university-api', title: 'University Prospects API', category: 'integration', path: 'src/pages/api/admin/scout-university-prospects.ts', description: "Admin API endpoint for Scout's university influencer prospecting pipeline.", tags: ['api', 'prospects', 'university'], emoji: '🎓' },
        // Analysis & Decisions
        { id: 'scout-desk-verification', title: 'Desk Position Verification', category: 'analysis', path: '.agent/analysis/desk-position-verification.md', description: 'Verification report confirming all agent desk positions are correctly configured with no conflicts.', tags: ['verification', 'desk', 'positions'], emoji: '✅' },
        { id: 'scout-pillars-visual', title: 'Core Pillars Visual Map', category: 'analysis', path: '.agent/analysis/pillars-visual-map.md', description: 'Visual mapping of core pillars across agents and their representation in the system.', tags: ['pillars', 'visual', 'mapping'], emoji: '🗂️' },
    ],
    solara: [
        // Persona & Identity
        { id: 'solara-manifesto', title: 'Agent Manifesto', category: 'persona', path: 'docs/AGENT_MANIFESTO.md', description: 'Shared manifesto with principles, environment knowledge, and collaborative lessons learned.', tags: ['manifesto', 'principles'], emoji: '🧭' },
        { id: 'solara-onboarding-guide', title: 'Agent Onboarding Guide', category: 'persona', path: 'docs/AGENT_ONBOARDING.md', description: 'Step-by-step onboarding guide for integrating new agents into Pulse.', tags: ['onboarding', 'setup'], emoji: '📖' },
        { id: 'solara-brand-role-scan', title: 'Brand Role Scan', category: 'persona', path: 'docs/solara-brand-role-scan.md', description: "Migration audit showing every location where Solara's prior role label was renamed to 'Brand Voice'.", tags: ['brand-voice', 'migration', 'audit'], emoji: '🔍' },
        // Profile & Presence
        { id: 'solara-profile-reference', title: 'Agent Profile Reference', category: 'profile', path: '.agent/analysis/agent-profile-reference.json', description: 'JSON reference of all agent profiles including desk positions, roles, and configuration validation.', tags: ['profile', 'reference', 'json'], emoji: '📋' },
        { id: 'solara-office-layout', title: 'Office Layout Diagram', category: 'profile', path: '.agent/analysis/office-layout-diagram.md', description: 'Virtual Office floor plan with coordinate analysis and expansion planning.', tags: ['layout', 'diagram'], emoji: '🗺️' },
        // Integration & Config
        { id: 'solara-runner-script', title: 'Agent Runner Script', category: 'config', path: 'scripts/start-agent-solara.sh', description: 'Shell script to launch the Solara agent daemon.', tags: ['shell', 'daemon', 'startup'], emoji: '🔧' },
        { id: 'solara-runner-alt', title: 'Alternative Start Script', category: 'config', path: 'scripts/start-solara.sh', description: 'Alternative launcher script for the Solara agent process.', tags: ['shell', 'startup', 'alt'], emoji: '⚙️' },
        // Analysis & Decisions
        { id: 'solara-title-comparison', title: 'Title Comparison Visual', category: 'analysis', path: '.agent/analysis/title-comparison-visual.md', description: "Visual comparison of Solara's title across different parts of the system.", tags: ['title', 'comparison', 'visual'], emoji: '📊' },
        { id: 'solara-core-pillars', title: 'Core Pillars Verification', category: 'analysis', path: '.agent/analysis/core-pillars-verification.md', description: 'Verification that core brand pillars are properly represented across the system.', tags: ['pillars', 'verification'], emoji: '✅' },
    ],
    antigravity: [
        // Persona & Identity
        { id: 'ag-manifesto', title: 'Agent Manifesto', category: 'persona', path: 'docs/AGENT_MANIFESTO.md', description: 'Living manifesto for all Pulse agents — principles, environment knowledge, and operational rules.', tags: ['manifesto', 'principles', 'ops'], emoji: '🧭' },
        { id: 'ag-onboarding-guide', title: 'Agent Onboarding Guide', category: 'persona', path: 'docs/AGENT_ONBOARDING.md', description: 'Full onboarding guide covering agent setup from daemon config to Virtual Office integration.', tags: ['onboarding', 'setup', 'guide'], emoji: '📖' },
        { id: 'ag-onboarding-runbook', title: 'Agent Onboarding Runbook', category: 'persona', path: 'docs/agents/onboarding-runbook.md', description: 'Technical runbook for new agent integration — agentRunner.js, launchd, verification phases.', tags: ['runbook', 'technical', 'phases'], emoji: '🛠' },
        // Profile & Presence
        { id: 'ag-profile-reference', title: 'Agent Profile Reference', category: 'profile', path: '.agent/analysis/agent-profile-reference.json', description: 'JSON snapshot of all agent profile data — desk positions, roles, duties, emoji mappings.', tags: ['profile', 'json', 'reference'], emoji: '📋' },
        { id: 'ag-office-layout', title: 'Office Layout Diagram', category: 'profile', path: '.agent/analysis/office-layout-diagram.md', description: 'ASCII floor plan of the Virtual Office with grid coordinates, agent distribution, and facing directions.', tags: ['layout', 'diagram', 'ascii'], emoji: '🗺️' },
        { id: 'ag-profile-template', title: 'Agent Profile Template', category: 'profile', path: '.agent/analysis/agent-profile-template.md', description: 'Reusable template for creating new agent profiles — checklist, naming conventions, and complete example.', tags: ['template', 'checklist'], emoji: '📝' },
        // Integration & Config
        { id: 'ag-codebase-map', title: 'Codebase Map', category: 'config', path: 'docs/CODEBASE_MAP.md', description: 'High-level map of the QuickLifts codebase — directory structure, key modules, and architecture overview.', tags: ['codebase', 'architecture', 'map'], emoji: '🗂️' },
        { id: 'ag-system-architecture', title: 'System Architecture Overview', category: 'config', path: 'docs/system-architecture-overview-plan.md', description: 'Comprehensive system architecture overview — frontend, backend, data flow, and deployment.', tags: ['architecture', 'system', 'overview'], emoji: '🏗️' },
        // Analysis & Decisions
        { id: 'ag-vo-structure', title: 'Virtual Office Structure Analysis', category: 'analysis', path: '.agent/analysis/virtualOffice-structure-analysis.md', description: 'Deep structural analysis of the Virtual Office component — data flow, state management, modals, and rendering pipeline.', tags: ['virtual-office', 'structure', 'analysis'], emoji: '🔍' },
        { id: 'ag-round-table-plan', title: 'Round Table Implementation Plan', category: 'analysis', path: '.agent/analysis/round-table-implementation-plan.md', description: 'Implementation plan for group collaboration — animation system, orchestration, and chat modal integration.', tags: ['round-table', 'planning', 'implementation'], emoji: '📊' },
        { id: 'ag-browser-test', title: 'Browser Test Verification', category: 'integration', path: '.agent/analysis/browser-test-verification.md', description: 'Functional browser testing verification report for the Virtual Office and its interactive components.', tags: ['testing', 'browser', 'verification'], emoji: '🧪' },
    ],
};

/* ────────────────── file content cache ────────────────── */

const fileContentCache: Record<string, string> = {};

async function fetchFileContent(path: string): Promise<string> {
    if (fileContentCache[path]) return fileContentCache[path];
    try {
        const res = await fetch(`/api/read-file?path=${encodeURIComponent(path)}`);
        if (res.ok) {
            const data = await res.json();
            const content = data.content ?? '(file not found)';
            fileContentCache[path] = content;
            return content;
        }
        return `⚠️ Could not load file.\n\nPath: ${path}`;
    } catch {
        return `📂 File path: ${path}\n\nOpen this file in your code editor to view its contents.`;
    }
}

/* ──────────── expandable artifact card ──────────── */

function ModalArtifactCard({ artifact, catColor }: { artifact: Artifact; catColor: string }) {
    const [expanded, setExpanded] = useState(false);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);

    const handleToggle = async () => {
        if (!expanded && !content) {
            setLoading(true);
            const c = await fetchFileContent(artifact.path);
            setContent(c);
            setLoading(false);
        }
        setExpanded(!expanded);
    };

    return (
        <div className={`modal-artifact-card ${expanded ? 'expanded' : ''}`}>
            <button
                id={`modal-card-${artifact.id}`}
                className="modal-card-header"
                onClick={handleToggle}
                style={{ '--mac-color': catColor } as React.CSSProperties}
            >
                <span className="mac-emoji">{artifact.emoji}</span>
                <div className="mac-body">
                    <span className="mac-title">{artifact.title}</span>
                    <span className="mac-desc">{artifact.description}</span>
                    <div className="mac-tags">
                        {artifact.tags.map((t) => (
                            <span key={t} className="mac-tag">{t}</span>
                        ))}
                    </div>
                </div>
                <span className="mac-path">{artifact.path.split('/').pop()}</span>
                {artifact.status === 'pending-recovery' && (
                    <span className="mac-status pending">⏳</span>
                )}
                <span className={`mac-chevron ${expanded ? 'open' : ''}`}>▸</span>
            </button>
            {expanded && (
                <div className="modal-card-content">
                    {loading ? (
                        <div className="mac-loading">
                            <div className="spinner-sm" />
                            <span>Loading…</span>
                        </div>
                    ) : (
                        <MarkdownRenderer content={content} accentColor={catColor} />
                    )}
                </div>
            )}
        </div>
    );
}

/* ──────────────── category modal ──────────────── */

function CategoryModal({
    category,
    onClose,
    artifacts: allArtifacts,
    agentColor,
}: {
    category: ArtifactCategory;
    onClose: () => void;
    artifacts: Artifact[];
    agentColor: string;
}) {
    const cat = CATEGORIES[category];
    const artifacts = allArtifacts.filter((a) => a.category === category);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div
            className="modal-overlay"
            ref={overlayRef}
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
            <div className="modal-container" style={{ '--modal-accent': cat.color } as React.CSSProperties}>
                <div className="modal-header" style={{ background: cat.gradient }}>
                    <div className="modal-header-content">
                        <span className="modal-header-icon">{cat.icon}</span>
                        <div>
                            <h2>{cat.label}</h2>
                            <p>{artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
                </div>
                <div className="modal-body">
                    {artifacts.length === 0 ? (
                        <div className="modal-empty">
                            <span className="modal-empty-icon">📭</span>
                            <p>No artifacts in this category yet.</p>
                        </div>
                    ) : (
                        artifacts.map((a) => (
                            <ModalArtifactCard key={a.id} artifact={a} catColor={cat.color} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─────────────────── main page ─────────────────── */

export default function AgentDeliverablesPage() {
    const router = useRouter();
    const agentId = (router.query.agent as string) || '';
    const meta = AGENT_REGISTRY[agentId];

    const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [activeCategory, setActiveCategory] = useState<ArtifactCategory | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredCard, setHoveredCard] = useState<string | null>(null);
    const [modalCategory, setModalCategory] = useState<ArtifactCategory | null>(null);
    const [allArtifacts, setAllArtifacts] = useState<Artifact[]>([]);

    /* Load static + dynamic artifacts — poll every 30s for real-time updates */
    useEffect(() => {
        if (!agentId || !meta) return;
        const staticArts = AGENT_ARTIFACTS[agentId] || [];
        let cancelled = false;

        const loadManifest = async () => {
            try {
                const res = await fetch('/api/read-file?path=' + encodeURIComponent(`${meta.deliverableDir}/manifest.json`));
                if (!res.ok || cancelled) {
                    if (!cancelled) setAllArtifacts(staticArts);
                    return;
                }
                const data = await res.json();
                const manifest = JSON.parse(data.content);
                if (!manifest.deliverables?.length) {
                    if (!cancelled) setAllArtifacts(staticArts);
                    return;
                }

                const dynamicArtifacts: Artifact[] = manifest.deliverables.map((d: any) => ({
                    id: d.id,
                    title: d.title,
                    category: 'deliverable' as ArtifactCategory,
                    path: `${meta.deliverableDir}/${d.filename}`,
                    description: d.description,
                    tags: d.tags ?? [],
                    emoji: d.emoji ?? '📡',
                    status: d.status,
                    completedAt: d.completedAt,
                    taskRef: d.taskRef,
                }));

                // For pending-recovery items, check if file actually exists now
                const verified = await Promise.all(
                    dynamicArtifacts.map(async (art) => {
                        if (art.status !== 'pending-recovery') return art;
                        try {
                            const check = await fetch(`/api/read-file?path=${encodeURIComponent(art.path)}`);
                            if (check.ok) return { ...art, status: 'complete' as const };
                        } catch { /* still pending */ }
                        return art;
                    }),
                );

                if (!cancelled) {
                    // Deduplicate: dynamic takes precedence over static with same id
                    const staticIds = new Set(staticArts.map(a => a.id));
                    const dedupedDynamic = verified.filter(a => !staticIds.has(a.id));
                    setAllArtifacts([...dedupedDynamic, ...staticArts]);
                }
            } catch {
                if (!cancelled) setAllArtifacts(staticArts);
            }
        };

        loadManifest();
        const interval = setInterval(loadManifest, 30_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [agentId, meta]);

    const filteredArtifacts = allArtifacts.filter((a) => {
        const matchesCategory = activeCategory === 'all' || a.category === activeCategory;
        const matchesSearch =
            searchQuery === '' ||
            a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    const loadFile = useCallback(async (artifact: Artifact) => {
        setSelectedArtifact(artifact);
        setLoading(true);
        const c = await fetchFileContent(artifact.path);
        setFileContent(c);
        setLoading(false);
    }, []);

    const groupedArtifacts = filteredArtifacts.reduce<Record<ArtifactCategory, Artifact[]>>((acc, a) => {
        if (!acc[a.category]) acc[a.category] = [];
        acc[a.category].push(a);
        return acc;
    }, {} as Record<ArtifactCategory, Artifact[]>);

    /* ── 404 / loading state ── */
    if (!agentId) return null;
    if (!meta) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🤖</span>
                    <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>Agent Not Found</h1>
                    <p style={{ color: '#71717a', fontSize: 14 }}>No agent with ID <code style={{ color: '#f59e0b' }}>{agentId}</code> exists.</p>
                    <button onClick={() => router.push('/admin/virtualOffice')} style={{ marginTop: 24, padding: '8px 20px', borderRadius: 8, background: 'rgba(139,92,246,.15)', border: '1px solid rgba(139,92,246,.3)', color: '#a78bfa', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                        ← Back to Virtual Office
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>{meta.emoji} {meta.displayName} — Deliverables — Pulse</title>
                <meta name="description" content={`Browse all of ${meta.displayName}'s research artifacts, deliverables, and documentation.`} />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
                    rel="stylesheet"
                />
            </Head>

            <div id="sage-deliverables-root">
                {/* ──── sidebar ──── */}
                <aside id="sage-sidebar" style={{ '--agent-color': meta.color } as React.CSSProperties}>
                    <div className="sidebar-header">
                        <button className="back-to-office" onClick={() => router.push('/admin/virtualOffice')}>
                            ← Virtual Office
                        </button>
                        <div className="sage-logo">
                            <span className="logo-emoji">{meta.emoji}</span>
                            <div>
                                <h1>{meta.displayName}</h1>
                                <p className="subtitle">{meta.role}</p>
                            </div>
                        </div>
                        <p className="tagline">{meta.tagline}</p>
                    </div>

                    <div className="search-container">
                        <input
                            id="artifact-search"
                            type="text"
                            placeholder="Search artifacts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <span className="search-icon">⌘K</span>
                    </div>

                    <nav className="category-nav">
                        <button
                            id="filter-all"
                            className={`category-pill ${activeCategory === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveCategory('all')}
                        >
                            All <span className="count">{allArtifacts.length}</span>
                        </button>
                        {(Object.keys(CATEGORIES) as ArtifactCategory[]).map((cat) => {
                            const count = allArtifacts.filter((a) => a.category === cat).length;
                            if (count === 0) return null;
                            return (
                                <button
                                    id={`filter-${cat}`}
                                    key={cat}
                                    className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(cat)}
                                    style={{ '--cat-color': CATEGORIES[cat].color } as React.CSSProperties}
                                >
                                    <span className="pill-icon">{CATEGORIES[cat].icon}</span>
                                    {CATEGORIES[cat].label}
                                    <span className="count">{count}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <div className="artifact-list">
                        {Object.entries(groupedArtifacts).map(([cat, artifacts]) => (
                            <div key={cat} className="artifact-group">
                                <h3 className="group-title" style={{ color: CATEGORIES[cat as ArtifactCategory].color }}>
                                    {CATEGORIES[cat as ArtifactCategory].icon} {CATEGORIES[cat as ArtifactCategory].label}
                                </h3>
                                {artifacts.map((a) => (
                                    <button
                                        id={`artifact-${a.id}`}
                                        key={a.id}
                                        className={`artifact-card ${selectedArtifact?.id === a.id ? 'selected' : ''} ${hoveredCard === a.id ? 'hovered' : ''}`}
                                        onClick={() => loadFile(a)}
                                        onMouseEnter={() => setHoveredCard(a.id)}
                                        onMouseLeave={() => setHoveredCard(null)}
                                    >
                                        <span className="card-emoji">{a.emoji}</span>
                                        <div className="card-body">
                                            <span className="card-title">{a.title}</span>
                                            <span className="card-desc">{a.description}</span>
                                            <div className="card-tags">
                                                {a.tags.map((t) => (
                                                    <span key={t} className="tag">{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <span
                                            className="card-category-dot"
                                            style={{ backgroundColor: CATEGORIES[a.category].color }}
                                        />
                                        {a.status === 'pending-recovery' && (
                                            <span className="status-badge pending">⏳ pending</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        ))}
                        {filteredArtifacts.length === 0 && (
                            <div className="empty-state">
                                <span className="empty-icon">🔍</span>
                                <p>No artifacts match your search.</p>
                            </div>
                        )}
                    </div>

                    <div className="sidebar-footer">
                        <span className="footer-text">
                            {allArtifacts.length} artifacts • {meta.displayName} v1.0
                        </span>
                    </div>
                </aside>

                {/* ──── main content ──── */}
                <main id="sage-content">
                    {!selectedArtifact ? (
                        <div className="welcome-state">
                            <div className="welcome-glow" style={{ background: `radial-gradient(circle at 50% 40%, ${meta.color}18 0%, transparent 60%)` }} />
                            <span className="welcome-emoji">{meta.emoji}</span>
                            <h2>{meta.displayName}&apos;s Deliverables</h2>
                            <p>
                                Click any category below to explore its artifacts,<br />
                                or select an item from the sidebar.
                            </p>
                            <div className="stats-row">
                                {(Object.keys(CATEGORIES) as ArtifactCategory[]).map((cat) => {
                                    const count = allArtifacts.filter((a) => a.category === cat).length;
                                    return (
                                        <button
                                            key={cat}
                                            id={`stat-${cat}`}
                                            className="stat-card"
                                            onClick={() => count > 0 && setModalCategory(cat)}
                                            style={{ '--stat-color': CATEGORIES[cat].color, opacity: count === 0 ? 0.35 : 1 } as React.CSSProperties}
                                        >
                                            <span className="stat-icon">{CATEGORIES[cat].icon}</span>
                                            <span className="stat-count">{count}</span>
                                            <span className="stat-label">{CATEGORIES[cat].label}</span>
                                            {count > 0 && <span className="stat-tap-hint">tap to explore →</span>}
                                        </button>
                                    );
                                })}
                            </div>
                            {meta.creed && meta.creed.length > 0 && (
                                <div className="creed-block">
                                    <h3>Creed</h3>
                                    <ol>
                                        {meta.creed.map((item, i) => {
                                            const [bold, ...rest] = item.split('. ');
                                            return (
                                                <li key={i}><strong>{bold}.</strong> {rest.join('. ')}</li>
                                            );
                                        })}
                                    </ol>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="file-viewer">
                            <div className="file-header">
                                <button id="close-viewer" className="back-btn" onClick={() => { setSelectedArtifact(null); setFileContent(''); }}>
                                    ← Back
                                </button>
                                <div className="file-meta">
                                    <span className="file-emoji">{selectedArtifact.emoji}</span>
                                    <div>
                                        <h2>{selectedArtifact.title}</h2>
                                        <span className="file-path">{selectedArtifact.path}</span>
                                    </div>
                                </div>
                                <div
                                    className="file-category-badge"
                                    style={{ background: CATEGORIES[selectedArtifact.category].gradient }}
                                >
                                    {CATEGORIES[selectedArtifact.category].icon} {CATEGORIES[selectedArtifact.category].label}
                                </div>
                            </div>
                            <div className="file-body">
                                {loading ? (
                                    <div className="loading-state">
                                        <div className="spinner" />
                                        <p>Loading artifact...</p>
                                    </div>
                                ) : (
                                    <MarkdownRenderer content={fileContent} accentColor={meta.color} />
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* ──── category modal ──── */}
            {modalCategory && (
                <CategoryModal
                    category={modalCategory}
                    onClose={() => setModalCategory(null)}
                    artifacts={allArtifacts}
                    agentColor={meta.color}
                />
            )}

            <style jsx global>{`
        /* ─── reuse ALL styles from sage-deliverables page ─── */

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes expandIn { from { transform: scale(.97); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #09090b; color: #e4e4e7; font-family: 'Inter', -apple-system, sans-serif; }

        #sage-deliverables-root {
          display: grid;
          grid-template-columns: 320px 1fr;
          min-height: 100vh;
        }

        /* ── Sidebar ── */
        #sage-sidebar {
          background: #0c0c10;
          border-right: 1px solid rgba(255,255,255,.04);
          display: flex; flex-direction: column;
          overflow-y: auto;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.06) transparent;
        }

        .back-to-office {
          display: block; width: 100%; text-align: left;
          background: none; border: none; color: #818cf8; cursor: pointer;
          font-size: 11px; font-weight: 500; padding: 12px 20px 0;
          font-family: inherit; transition: color .2s;
        }
        .back-to-office:hover { color: #a78bfa; }

        .sidebar-header { padding: 14px 20px 16px; border-bottom: 1px solid rgba(255,255,255,.04); }
        .sage-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .logo-emoji { font-size: 32px; }
        .sage-logo h1 { font-size: 20px; font-weight: 800; color: #fff; margin: 0; }
        .subtitle { font-size: 11px; color: var(--agent-color, #818cf8); font-weight: 600; margin: 2px 0 0; }
        .tagline { font-size: 11px; color: #52525b; font-family: 'JetBrains Mono', monospace; }

        .search-container { position: relative; padding: 12px 20px 8px; }
        .search-container input {
          width: 100%; padding: 8px 12px; border-radius: 8px;
          background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06);
          color: #e4e4e7; font-size: 12px; font-family: inherit;
          transition: all .2s;
        }
        .search-container input:focus {
          outline: none; border-color: rgba(139,92,246,.3);
          background: rgba(139,92,246,.06);
          box-shadow: 0 0 0 3px rgba(139,92,246,.1);
        }
        .search-container input::placeholder { color: #475569; }
        .search-icon {
          position: absolute; right: 32px; top: 50%; transform: translateY(-50%);
          font-size: 10px; color: #475569;
          background: rgba(255,255,255,.06); padding: 3px 6px; border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
        }

        .category-nav {
          display: flex; flex-wrap: wrap; gap: 6px;
          padding: 8px 20px 14px;
          border-bottom: 1px solid rgba(255,255,255,.04);
        }
        .category-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 10px; border-radius: 8px;
          background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06);
          color: #94a3b8; font-size: 11px; font-weight: 500;
          cursor: pointer; transition: all .2s; font-family: inherit;
        }
        .category-pill:hover { background: rgba(255,255,255,.08); color: #e2e8f0; }
        .category-pill.active {
          background: rgba(139,92,246,.15); border-color: rgba(139,92,246,.3);
          color: #a78bfa;
        }
        .pill-icon { font-size: 12px; }
        .count {
          background: rgba(255,255,255,.06); padding: 1px 6px; border-radius: 4px;
          font-size: 10px; font-weight: 600; font-family: 'JetBrains Mono', monospace;
        }

        .artifact-list { flex: 1; overflow-y: auto; padding: 8px 12px; }
        .artifact-group { margin-bottom: 16px; }
        .group-title {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .05em; padding: 6px 8px; margin-bottom: 4px;
        }
        .artifact-card {
          display: flex; align-items: flex-start; gap: 10px;
          width: 100%; padding: 10px; border-radius: 10px;
          background: transparent; border: 1px solid transparent;
          cursor: pointer; text-align: left; transition: all .2s;
          font-family: inherit; position: relative;
        }
        .artifact-card:hover, .artifact-card.hovered {
          background: rgba(255,255,255,.03); border-color: rgba(255,255,255,.06);
        }
        .artifact-card.selected {
          background: rgba(139,92,246,.08); border-color: rgba(139,92,246,.2);
        }
        .card-emoji { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
        .card-body { flex: 1; min-width: 0; }
        .card-title {
          display: block; font-size: 12px; font-weight: 600; color: #e4e4e7;
          margin-bottom: 2px;
        }
        .card-desc {
          display: block; font-size: 11px; color: #71717a; line-height: 1.4;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
        .tag {
          font-size: 9px; padding: 1px 5px; border-radius: 4px;
          background: rgba(255,255,255,.04); color: #52525b;
          font-family: 'JetBrains Mono', monospace;
        }
        .card-category-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 6px;
        }
        .status-badge {
          position: absolute; top: 6px; right: 6px;
          font-size: 8px; font-weight: 600; padding: 2px 6px; border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
        }
        .status-badge.pending {
          background: rgba(245,158,11,.15); color: #f59e0b;
          border: 1px solid rgba(245,158,11,.25);
        }
        .mac-status { flex-shrink: 0; font-size: 14px; }
        .mac-status.pending { animation: pulse-pending 2s ease-in-out infinite; }
        @keyframes pulse-pending {
          0%, 100% { opacity: .6; }
          50% { opacity: 1; }
        }

        .empty-state { text-align: center; padding: 48px 20px; color: #475569; }
        .empty-icon { font-size: 36px; display: block; margin-bottom: 12px; opacity: .5; }

        .sidebar-footer {
          padding: 12px 20px; border-top: 1px solid rgba(255,255,255,.04);
          text-align: center;
        }
        .footer-text {
          font-size: 10px; color: #334155;
          font-family: 'JetBrains Mono', monospace;
        }

        /* ── Main content ── */
        #sage-content {
          display: flex; flex-direction: column;
          overflow-y: auto;
        }
        .welcome-state {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: flex-start;
          padding: 150px 24px 48px;
          position: relative;
          animation: fadeIn .6s ease;
        }
        .welcome-glow {
          position: absolute; inset: 0; pointer-events: none;
        }
        .welcome-emoji {
          font-size: 64px; margin-bottom: 16px;
          animation: slideUp .5s ease;
        }
        .welcome-state h2 {
          font-size: 28px; font-weight: 800; color: #fff;
          margin-bottom: 8px; animation: slideUp .6s ease;
        }
        .welcome-state > p {
          font-size: 14px; color: #71717a; text-align: center; line-height: 1.6;
          animation: slideUp .7s ease;
        }

        .stats-row {
          display: flex; flex-wrap: wrap; gap: 12px;
          margin-top: 32px; justify-content: center;
          animation: slideUp .8s ease;
        }
        .stat-card {
          display: flex; flex-direction: column; align-items: center;
          gap: 4px; padding: 20px 24px; border-radius: 16px;
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.06);
          min-width: 130px; cursor: pointer; transition: all .3s;
          font-family: inherit; position: relative; overflow: hidden;
        }
        .stat-card::before {
          content: ''; position: absolute; inset: 0; opacity: 0;
          background: radial-gradient(circle at 50% 30%, var(--stat-color) 0%, transparent 70%);
          transition: opacity .3s;
        }
        .stat-card:hover::before { opacity: .08; }
        .stat-card:hover {
          border-color: color-mix(in srgb, var(--stat-color) 30%, transparent);
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,0,0,.3);
        }
        .stat-icon { font-size: 28px; position: relative; }
        .stat-count {
          font-size: 26px; font-weight: 800; color: var(--stat-color);
          position: relative;
        }
        .stat-label {
          font-size: 11px; color: #71717a; font-weight: 500;
          position: relative;
        }
        .stat-tap-hint {
          font-size: 9px; color: #52525b; opacity: 0;
          transition: opacity .3s; position: relative;
        }
        .stat-card:hover .stat-tap-hint { opacity: 1; }

        .creed-block {
          margin-top: 40px; max-width: 560px;
          padding: 24px; border-radius: 16px;
          background: rgba(139,92,246,.04);
          border: 1px solid rgba(139,92,246,.1);
          animation: slideUp .9s ease;
        }
        .creed-block h3 {
          font-size: 13px; font-weight: 700; color: #a78bfa;
          text-transform: uppercase; letter-spacing: .04em; margin-bottom: 12px;
        }
        .creed-block ol { padding-left: 20px; }
        .creed-block li {
          font-size: 12px; color: #a1a1aa; line-height: 1.6; margin-bottom: 6px;
        }
        .creed-block li strong { color: #e4e4e7; }

        /* ── File viewer ── */
        .file-viewer { flex: 1; display: flex; flex-direction: column; animation: fadeIn .3s ease; }
        .file-header {
          display: flex; align-items: center; gap: 16px;
          padding: 16px 24px;
          border-bottom: 1px solid rgba(255,255,255,.04);
          background: rgba(255,255,255,.01);
        }
        .back-btn {
          padding: 6px 14px; border-radius: 8px;
          background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06);
          color: #94a3b8; font-size: 12px; font-weight: 500;
          cursor: pointer; transition: all .2s; font-family: inherit;
        }
        .back-btn:hover { background: rgba(255,255,255,.08); color: #e2e8f0; }
        .file-meta { display: flex; align-items: center; gap: 12px; flex: 1; }
        .file-emoji { font-size: 28px; }
        .file-meta h2 { font-size: 16px; font-weight: 700; color: #fff; }
        .file-path {
          font-size: 11px; color: #52525b; font-family: 'JetBrains Mono', monospace;
        }
        .file-category-badge {
          padding: 4px 12px; border-radius: 8px;
          font-size: 11px; font-weight: 600; color: #fff;
        }
        .file-body { flex: 1; padding: 24px; overflow-y: auto; }
        .file-content {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px; line-height: 1.7; color: #d4d4d8;
          white-space: pre-wrap; word-wrap: break-word;
        }
        .loading-state {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 12px; padding: 64px;
          color: #71717a; font-size: 13px;
        }
        .spinner {
          width: 32px; height: 32px; border: 3px solid rgba(139,92,246,.15);
          border-top-color: #8b5cf6; border-radius: 50%;
          animation: spin .8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Modal ── */
        .modal-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,.65);
          display: flex; align-items: center; justify-content: center;
          animation: fadeIn .2s ease;
          backdrop-filter: blur(4px);
        }
        .modal-container {
          width: 640px; max-width: 92vw; max-height: 80vh;
          background: #111114; border-radius: 20px;
          border: 1px solid rgba(255,255,255,.06);
          display: flex; flex-direction: column;
          overflow: hidden;
          animation: expandIn .3s ease;
          box-shadow: 0 32px 64px rgba(0,0,0,.5);
        }
        .modal-header {
          padding: 20px 24px; display: flex; align-items: center;
          justify-content: space-between; flex-shrink: 0;
        }
        .modal-header-content { display: flex; align-items: center; gap: 14px; }
        .modal-header-icon { font-size: 32px; }
        .modal-header h2 { font-size: 18px; font-weight: 700; color: #fff; margin: 0; }
        .modal-header p { font-size: 12px; color: rgba(255,255,255,.7); margin: 2px 0 0; }
        .modal-close {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(255,255,255,.1); border: none;
          color: #fff; font-size: 14px; cursor: pointer;
          transition: background .2s; display: flex; align-items: center; justify-content: center;
        }
        .modal-close:hover { background: rgba(255,255,255,.2); }
        .modal-body {
          flex: 1; overflow-y: auto; padding: 16px 20px;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.06) transparent;
        }
        .modal-empty {
          text-align: center; padding: 48px 0; color: #475569;
        }
        .modal-empty-icon { font-size: 40px; display: block; margin-bottom: 12px; }

        /* ── Modal artifact cards ── */
        .modal-artifact-card {
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 12px; margin-bottom: 10px;
          overflow: hidden; transition: all .2s;
        }
        .modal-artifact-card.expanded {
          border-color: color-mix(in srgb, var(--mac-color, #8b5cf6) 30%, transparent);
        }
        .modal-card-header {
          width: 100%; display: flex; align-items: flex-start; gap: 12px;
          padding: 14px 16px; background: rgba(255,255,255,.02);
          border: none; cursor: pointer; text-align: left;
          transition: background .2s; font-family: inherit;
        }
        .modal-card-header:hover { background: rgba(255,255,255,.05); }
        .mac-emoji { font-size: 22px; flex-shrink: 0; margin-top: 2px; }
        .mac-body { flex: 1; min-width: 0; }
        .mac-title { display: block; font-size: 13px; font-weight: 600; color: #e4e4e7; }
        .mac-desc {
          display: block; font-size: 11px; color: #71717a; line-height: 1.4; margin-top: 2px;
        }
        .mac-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
        .mac-tag {
          font-size: 9px; padding: 1px 5px; border-radius: 4px;
          background: rgba(255,255,255,.04); color: #52525b;
          font-family: 'JetBrains Mono', monospace;
        }
        .mac-path {
          font-size: 10px; color: #3f3f46; flex-shrink: 0;
          font-family: 'JetBrains Mono', monospace; margin-top: 4px;
        }
        .mac-chevron {
          flex-shrink: 0; font-size: 12px; color: #52525b;
          transition: transform .2s; margin-top: 4px;
        }
        .mac-chevron.open { transform: rotate(90deg); }
        .modal-card-content {
          border-top: 1px solid rgba(255,255,255,.04);
          padding: 14px 16px;
          animation: fadeIn .2s ease;
        }
        .mac-file-content {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; line-height: 1.6; color: #a1a1aa;
          white-space: pre-wrap; word-wrap: break-word;
          max-height: 400px; overflow-y: auto;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.06) transparent;
        }
        .mac-loading {
          display: flex; align-items: center; gap: 8px;
          color: #71717a; font-size: 12px; padding: 8px 0;
        }
        .spinner-sm {
          width: 16px; height: 16px;
          border: 2px solid rgba(139,92,246,.15);
          border-top-color: #8b5cf6; border-radius: 50%;
          animation: spin .8s linear infinite;
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          #sage-deliverables-root {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
          }
          #sage-sidebar {
            max-height: 50vh; border-right: none;
            border-bottom: 1px solid rgba(255,255,255,.04);
          }
        }
      `}</style>
        </>
    );
}
