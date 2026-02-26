import React, { useState } from 'react';
import {
    Activity,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    Clock,
    Database,
    GitBranch,
    Layers,
    Radio,
    Repeat,
    Server,
    Sparkles,
    Target,
    Users,
    Zap,
} from 'lucide-react';

/* ─── Data Types ─────────────────────────────────────── */

interface FlowStep {
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    firestoreCollection?: string;
    script?: string;
    color: string;
}

interface DataCollection {
    name: string;
    purpose: string;
    writtenBy: string;
    readBy: string;
    fields: string[];
}

interface BeatType {
    type: string;
    emoji: string;
    when: string;
    color: string;
    example: string;
}

/* ─── Static Data ────────────────────────────────────── */

const telemetryFlowSteps: FlowStep[] = [
    {
        id: 'trigger',
        icon: <Zap className="w-5 h-5" />,
        title: '1. Telemetry Check Triggered',
        description: 'Either manually from the Virtual Office UI ("Run Telemetry Check" button) or automatically on the configured interval (default: hourly). The UI calls /api/agent/trigger-standup which spawns the dailyStandup.js script.',
        script: 'pages/api/agent/trigger-standup.ts → scripts/dailyStandup.js',
        color: 'from-indigo-500/30 to-indigo-300/10',
    },
    {
        id: 'session',
        icon: <Users className="w-5 h-5" />,
        title: '2. Group Chat Session Created',
        description: 'A new agent-group-chats document is created in Firestore with standupMeta. All 4 agents are added as participants. The Virtual Office detects this via a real-time onSnapshot listener and animates agents to the round table.',
        firestoreCollection: 'agent-group-chats',
        color: 'from-violet-500/30 to-violet-300/10',
    },
    {
        id: 'presence',
        icon: <Radio className="w-5 h-5" />,
        title: '3. Agent Presence → "Meeting"',
        description: 'All agents\' presence status is set to "meeting" with a note indicating the telemetry check is active. The Virtual Office shows agents gathered at the round table.',
        firestoreCollection: 'agent-presence',
        color: 'from-blue-500/30 to-blue-300/10',
    },
    {
        id: 'rounds',
        icon: <Repeat className="w-5 h-5" />,
        title: '4. Conversation Rounds Execute',
        description: 'Three rounds run sequentially: (1) Status & Health — each agent reports ACTIVE / IDLE / BLOCKED, (2) Work Assignment — Nora assigns Capsules to idle agents, (3) Closing heartbeat log. Each round broadcasts a prompt and collects AI-generated responses.',
        script: 'dailyStandup.js → buildTelemetryPrompts()',
        color: 'from-cyan-500/30 to-cyan-300/10',
    },
    {
        id: 'north-star',
        icon: <Target className="w-5 h-5" />,
        title: '5. North Star Task Assignment',
        description: 'After rounds complete, the system loads the North Star from Firestore (company-config/north-star) and generates role-specific Capsules for idle agents. Each Capsule is aligned to the current North Star objectives and rotates through them hourly.',
        firestoreCollection: 'kanbanTasks + company-config',
        color: 'from-amber-500/30 to-amber-300/10',
    },
    {
        id: 'beats',
        icon: <Activity className="w-5 h-5" />,
        title: '6. Beats Posted to Timeline',
        description: 'Meeting minutes are saved to the Filing Cabinet (meeting-minutes collection). Capsule assignments are posted as beats to the progress-timeline. Agents return to idle status and their runners pick up new Capsules.',
        firestoreCollection: 'progress-timeline + meeting-minutes',
        color: 'from-green-500/30 to-green-300/10',
    },
];

const agentRunnerFlow: FlowStep[] = [
    {
        id: 'poll',
        icon: <Database className="w-5 h-5" />,
        title: '1. Task Polling',
        description: 'Each agent runner polls Firestore kanbanTasks for items assigned to them with status "todo" or "in-progress". When a task is found, work begins.',
        firestoreCollection: 'kanbanTasks',
        color: 'from-blue-500/30 to-blue-400/10',
    },
    {
        id: 'decompose',
        icon: <GitBranch className="w-5 h-5" />,
        title: '2. Task Decomposition',
        description: 'The task is broken into discrete steps by AI. Each step has a description, reasoning, and expected outcome. The agent posts a "hypothesis" beat to the timeline.',
        color: 'from-indigo-500/30 to-indigo-400/10',
    },
    {
        id: 'execute',
        icon: <Zap className="w-5 h-5" />,
        title: '3. Step Execution Loop',
        description: 'Steps execute sequentially via OpenClaw. For each step: a "starting" beat fires, the agent works, output is scanned for insights (signal-spike beats), and a "completed" beat fires. At the halfway point, a checkpoint beat is posted.',
        color: 'from-violet-500/30 to-violet-400/10',
    },
    {
        id: 'validate',
        icon: <Sparkles className="w-5 h-5" />,
        title: '4. Validation Gate',
        description: 'After all steps pass, an independent AI auditor verifies the work. If validation fails, a corrective task is auto-created. Validation results are posted as beats.',
        color: 'from-amber-500/30 to-amber-400/10',
    },
    {
        id: 'complete',
        icon: <Target className="w-5 h-5" />,
        title: '5. Completion & Reporting',
        description: 'A "result" beat is posted. Deliverables are recorded. The agent returns to idle. If idle for 2+ cycles, the agent self-assigns a North Star-aligned task or Nora\'s task manager sweep creates one.',
        firestoreCollection: 'progress-timeline + agent-presence',
        color: 'from-green-500/30 to-green-400/10',
    },
];

const firestoreCollections: DataCollection[] = [
    {
        name: 'agent-presence',
        purpose: 'Real-time agent status, heartbeats, and current task information.',
        writtenBy: 'Agent Runner (every 30s)',
        readBy: 'Virtual Office UI (real-time listener)',
        fields: ['status', 'currentTask', 'currentTaskId', 'taskProgress', 'lastUpdate', 'role', 'emoji'],
    },
    {
        name: 'kanbanTasks',
        purpose: 'Work items (Capsules) assigned to agents. The source of truth for what agents should be working on.',
        writtenBy: 'Telemetry Check auto-assign, Nora task manager, UI manual creation',
        readBy: 'Agent Runner (polling), Virtual Office Kanban board',
        fields: ['name', 'description', 'assignee', 'status', 'priority', 'source', 'northStarAligned'],
    },
    {
        name: 'progress-timeline',
        purpose: 'The Heartbeat Feed. All events, nudges, and signal-spikes from all agents.',
        writtenBy: 'Agent Runner postBeat(), Telemetry Check, Nora task manager',
        readBy: 'Virtual Office Progress Timeline UI',
        fields: ['agentId', 'agentName', 'beat', 'headline', 'confidenceColor', 'artifactText', 'createdAt'],
    },
    {
        name: 'progress-snapshots',
        purpose: 'Hourly Health Snapshot entries per agent. Powers the Health Snapshot view in the Heartbeat Feed.',
        writtenBy: 'Agent Runner (once per calendar hour)',
        readBy: 'Virtual Office Health Snapshot view',
        fields: ['hourIso', 'agentId', 'objectiveCode', 'color', 'stateTag', 'note'],
    },
    {
        name: 'agent-group-chats',
        purpose: 'Group chat sessions for telemetry checks and round table discussions.',
        writtenBy: 'dailyStandup.js on telemetry trigger',
        readBy: 'Virtual Office GroupChatModal + standup listener',
        fields: ['participants', 'status', 'standupMeta', 'messages (subcollection)'],
    },
    {
        name: 'meeting-minutes',
        purpose: 'Archived telemetry check summaries displayed in the Filing Cabinet.',
        writtenBy: 'dailyStandup.js post-session',
        readBy: 'Virtual Office FilingCabinet component',
        fields: ['type', 'sessionId', 'durationMinutes', 'summary', 'protocol'],
    },
    {
        name: 'company-config/north-star',
        purpose: 'The company\'s North Star — strategic goal that drives all agent task generation.',
        writtenBy: 'Admin UI (North Star editor)',
        readBy: 'Telemetry Check (Capsule generation), Agent Runner (self-assignment)',
        fields: ['title', 'description', 'objectives[]'],
    },
    {
        name: 'standup-config/default',
        purpose: 'Configuration for telemetry check scheduling (interval, agents, moderator).',
        writtenBy: 'StandupConfigPanel (Telemetry Schedule UI)',
        readBy: 'dailyStandup.js',
        fields: ['enabled', 'intervalMinutes', 'maxDurationMinutes', 'agents', 'moderator', 'protocol'],
    },
];

const beatTypes: BeatType[] = [
    { type: 'hypothesis', emoji: '💡', when: 'Task picked up / self-assigned', color: 'blue', example: 'Starting: "Research competitive landscape"' },
    { type: 'work-in-flight', emoji: '⚡', when: 'Step starting, completing, halfway checkpoint, validation pass', color: 'blue → green', example: '✅ Step 3/5: Analyze competitor frameworks' },
    { type: 'result', emoji: '✅', when: 'Task completed successfully', color: 'green', example: '✅ Completed: "Draft white paper"' },
    { type: 'block', emoji: '🔴', when: 'Step failure (non-fatal or fatal), validation failure', color: 'yellow / red', example: '⚠️ Step 2/5 failed: missing dependency' },
    { type: 'signal-spike', emoji: '🔍', when: 'Agent discovers notable insight mid-task (auto-extracted)', color: 'green', example: '🔍 Whitespace: no framework uses continuous telemetry' },
];

/* ─── Sub-Components ─────────────────────────────────── */

function FlowDiagram({ subtitle, steps }: { subtitle: string; steps: FlowStep[] }) {
    return (
        <div className="space-y-4">
            <p className="text-sm text-zinc-400">{subtitle}</p>
            <div className="space-y-3">
                {steps.map((step, idx) => (
                    <div key={step.id} className="relative">
                        <div className={`bg-gradient-to-r ${step.color} border border-white/5 rounded-2xl p-5`}>
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 rounded-xl bg-black/30 text-white shrink-0 mt-0.5">
                                    {step.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-white font-semibold text-sm">{step.title}</h4>
                                    <p className="text-zinc-300 text-sm mt-1 leading-relaxed">{step.description}</p>
                                    {step.firestoreCollection && (
                                        <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1">
                                            <Database className="w-3 h-3" /> Firestore: <span className="text-zinc-300 font-mono">{step.firestoreCollection}</span>
                                        </p>
                                    )}
                                    {step.script && (
                                        <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                                            <Server className="w-3 h-3" /> Script: <span className="text-zinc-300 font-mono">{step.script}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        {idx < steps.length - 1 && (
                            <div className="flex justify-center py-1">
                                <ArrowRight className="w-4 h-4 text-zinc-600 rotate-90" />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function Collapsible({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-[#090d14] border border-zinc-800 rounded-2xl overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 text-white">{icon}</div>
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                </div>
                {open ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
            </button>
            {open && <div className="px-5 pb-5 border-t border-zinc-800/50">{children}</div>}
        </div>
    );
}

/* ─── Main Tab Content ───────────────────────────────── */

export default function HeartbeatProtocolTab() {
    return (
        <div className="space-y-8">

            {/* ─── Intro ─── */}
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-400/20">
                    <Activity className="w-6 h-6 text-indigo-300" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">Heartbeat Protocol</h2>
                    <p className="text-zinc-400 text-sm">
                        Agent-native methodology for continuous, autonomous work management.
                    </p>
                </div>
            </div>

            {/* ─── Documentation Downloads ─── */}
            <section className="bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 rounded-2xl p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Layers className="w-5 h-5 text-indigo-400" />
                            Agent Infrastructure Setup
                        </h3>
                        <p className="text-zinc-400 text-sm mt-1 mb-4 flex-grow max-w-2xl">
                            Deploy identical Virtual Office capabilities to other machines or environments. Download the step-by-step setup guides below.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <a
                        href="/docs/agent-infra/01_Architecture_Overview.md"
                        download
                        className="flex flex-col gap-2 p-4 rounded-xl bg-black/20 border border-white/5 hover:border-indigo-400/50 hover:bg-indigo-500/10 transition-all group"
                    >
                        <span className="text-xs text-indigo-300 font-mono tracking-wider opacity-60">PART 01</span>
                        <span className="font-semibold text-white text-sm group-hover:text-indigo-200 transition-colors">Architecture Overview</span>
                    </a>
                    <a
                        href="/docs/agent-infra/02_Setting_Up_Firestore_Collections.md"
                        download
                        className="flex flex-col gap-2 p-4 rounded-xl bg-black/20 border border-white/5 hover:border-indigo-400/50 hover:bg-indigo-500/10 transition-all group"
                    >
                        <span className="text-xs text-indigo-300 font-mono tracking-wider opacity-60">PART 02</span>
                        <span className="font-semibold text-white text-sm group-hover:text-indigo-200 transition-colors">Firestore Collections</span>
                    </a>
                    <a
                        href="/docs/agent-infra/03_Configuring_The_Agent_Runner.md"
                        download
                        className="flex flex-col gap-2 p-4 rounded-xl bg-black/20 border border-white/5 hover:border-indigo-400/50 hover:bg-indigo-500/10 transition-all group"
                    >
                        <span className="text-xs text-indigo-300 font-mono tracking-wider opacity-60">PART 03</span>
                        <span className="font-semibold text-white text-sm group-hover:text-indigo-200 transition-colors">Runner Context</span>
                    </a>
                    <a
                        href="/docs/agent-infra/04_Building_Virtual_Office_UI.md"
                        download
                        className="flex flex-col gap-2 p-4 rounded-xl bg-black/20 border border-white/5 hover:border-indigo-400/50 hover:bg-indigo-500/10 transition-all group"
                    >
                        <span className="text-xs text-indigo-300 font-mono tracking-wider opacity-60">PART 04</span>
                        <span className="font-semibold text-white text-sm group-hover:text-indigo-200 transition-colors">Building the Web UI</span>
                    </a>
                </div>

                <div className="flex justify-end">
                    <a
                        href="/docs/agent-infra-bundle.zip"
                        download
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                    >
                        <Database className="w-4 h-4" />
                        Download Full Bundle (.zip)
                    </a>
                </div>
            </section>

            <p className="text-zinc-400 text-sm leading-relaxed max-w-3xl">
                Instead of traditional standups, the system uses <strong className="text-white">hourly telemetry checks</strong>,
                <strong className="text-white"> automated Capsule assignment</strong>, and <strong className="text-white">real-time beat posting</strong> to
                keep agents productive and aligned to the North Star — all with zero human intervention.
            </p>

            {/* ─── Core Concepts ─── */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { title: 'Telemetry Check', value: 'Hourly', icon: <Clock className="w-5 h-5" />, tone: 'from-indigo-500/30 to-indigo-300/10', caption: 'Replaces daily standups' },
                    { title: 'Work Unit', value: 'Capsule', icon: <Layers className="w-5 h-5" />, tone: 'from-violet-500/30 to-violet-300/10', caption: 'Self-contained tasks' },
                    { title: 'Alignment', value: 'North Star', icon: <Target className="w-5 h-5" />, tone: 'from-amber-500/30 to-amber-300/10', caption: 'All work flows from this' },
                    { title: 'Heartbeat Feed', value: 'Events', icon: <Activity className="w-5 h-5" />, tone: 'from-green-500/30 to-green-300/10', caption: 'Real-time progress stream' },
                ].map((card) => (
                    <div key={card.title} className={`bg-gradient-to-br ${card.tone} border border-white/5 rounded-2xl p-4 flex items-center justify-between`}>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-zinc-400">{card.title}</p>
                            <p className="text-2xl font-semibold text-white mt-1">{card.value}</p>
                            {card.caption && <p className="text-[11px] text-white/70 mt-0.5">{card.caption}</p>}
                        </div>
                        <div className="p-3 rounded-full bg-black/30 text-white">{card.icon}</div>
                    </div>
                ))}
            </section>

            {/* ─── Architecture Layers ─── */}
            <section className="bg-[#090d14] border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-xl font-semibold mb-2">System Layers</h3>
                <p className="text-sm text-zinc-400 mb-6">Click any component to jump to its description below.</p>

                <div className="relative bg-[#06090f] border border-zinc-800 rounded-2xl p-8 overflow-hidden">
                    <div className="space-y-8">
                        {/* UI Layer */}
                        <div>
                            <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">UI Layer</p>
                            <div className="flex flex-wrap gap-3">
                                {['virtual-office', 'progress-timeline-ui', 'kanban-board', 'filing-cabinet', 'north-star-editor'].map((id) => {
                                    const labels: Record<string, string> = {
                                        'virtual-office': 'Virtual Office',
                                        'progress-timeline-ui': 'Progress Timeline',
                                        'kanban-board': 'Kanban Board',
                                        'filing-cabinet': 'Filing Cabinet',
                                        'north-star-editor': 'North Star Editor',
                                    };
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => document.getElementById(`glossary-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                            className="px-3 py-2 rounded-xl text-xs border bg-blue-500/10 border-blue-400/30 text-blue-200 hover:bg-blue-500/25 hover:border-blue-300/50 transition-all cursor-pointer"
                                        >
                                            {labels[id]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-zinc-600">
                            <div className="flex-1 border-t border-zinc-800" />
                            <span className="text-[10px] uppercase tracking-wide">Firestore Real-time</span>
                            <ArrowRight className="w-3 h-3 rotate-90" />
                            <ArrowRight className="w-3 h-3 -rotate-90" />
                            <div className="flex-1 border-t border-zinc-800" />
                        </div>

                        {/* Script Layer */}
                        <div>
                            <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Script Layer</p>
                            <div className="flex flex-wrap gap-3">
                                {[
                                    { id: 'agent-runner', name: 'Agent Runner ×4', detail: 'agentRunner.js' },
                                    { id: 'telemetry-check', name: 'Telemetry Check', detail: 'dailyStandup.js' },
                                    { id: 'trigger-api', name: 'Trigger API', detail: 'trigger-standup.ts' },
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => document.getElementById(`glossary-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                        className="px-3 py-2 rounded-xl text-xs border bg-green-500/10 border-green-400/30 text-green-200 hover:bg-green-500/25 hover:border-green-300/50 transition-all cursor-pointer flex flex-col text-left"
                                    >
                                        <span className="font-semibold">{item.name}</span>
                                        <span className="text-green-400/60 font-mono text-[10px]">{item.detail}</span>
                                    </button>
                                ))}
                                <button
                                    onClick={() => document.getElementById('glossary-openclaw')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                    className="px-3 py-2 rounded-xl text-xs border bg-purple-500/10 border-purple-400/30 text-purple-200 hover:bg-purple-500/25 hover:border-purple-300/50 transition-all cursor-pointer flex flex-col text-left"
                                >
                                    <span className="font-semibold">OpenClaw Engine</span>
                                    <span className="text-purple-400/60 font-mono text-[10px]">AI execution runtime</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-zinc-600">
                            <div className="flex-1 border-t border-zinc-800" />
                            <span className="text-[10px] uppercase tracking-wide">Reads &amp; Writes</span>
                            <ArrowRight className="w-3 h-3 rotate-90" />
                            <ArrowRight className="w-3 h-3 -rotate-90" />
                            <div className="flex-1 border-t border-zinc-800" />
                        </div>

                        {/* Data Layer */}
                        <div>
                            <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Data Layer (Firestore)</p>
                            <div className="flex flex-wrap gap-3">
                                {['agent-presence', 'kanbanTasks', 'progress-timeline', 'progress-snapshots', 'agent-group-chats', 'meeting-minutes', 'company-config', 'standup-config'].map((coll) => (
                                    <button
                                        key={coll}
                                        onClick={() => document.getElementById(`glossary-${coll}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                        className="px-3 py-2 rounded-xl text-xs border bg-amber-500/10 border-amber-400/30 text-amber-200 font-mono hover:bg-amber-500/25 hover:border-amber-300/50 transition-all cursor-pointer"
                                    >
                                        {coll}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Component Glossary ─── */}
            <section className="bg-[#090d14] border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-xl font-semibold mb-2">Component Glossary</h3>
                <p className="text-sm text-zinc-400 mb-6">What each component does, where it lives, and how it connects to the system.</p>

                {/* UI Layer Components */}
                <div className="mb-6">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400" /> UI Layer
                    </p>
                    <div className="space-y-3">
                        {[
                            { id: 'virtual-office', name: 'Virtual Office', purpose: 'The real-time command center showing all agents, their status, current tasks, and the round table animation. Agents animate between desks and meeting table during telemetry checks. This is the primary admin interface for monitoring the agent workforce.', path: 'src/components/virtualOffice/VirtualOfficeContent.tsx', reads: 'agent-presence, agent-group-chats', color: 'blue' },
                            { id: 'progress-timeline-ui', name: 'Progress Timeline', purpose: 'The Heartbeat Feed — a real-time stream of events from all agents. Shows work-in-flight updates, completions, failures, and signal-spike discoveries. Each event includes the agent name, headline, confidence color, and optional artifact text.', path: 'src/components/virtualOffice/ProgressTimeline.tsx', reads: 'progress-timeline, progress-snapshots', color: 'blue' },
                            { id: 'kanban-board', name: 'Kanban Board', purpose: 'Visual board of Capsules (tasks) organized by status: To Do, In Progress, Done, Blocked. Admins can manually create tasks, reassign agents, or adjust priorities. The board is synced with Firestore in real-time.', path: 'src/components/virtualOffice/ (Kanban section)', reads: 'kanbanTasks', color: 'blue' },
                            { id: 'filing-cabinet', name: 'Filing Cabinet', purpose: 'Archive of all telemetry check meeting minutes. Each entry shows the executive summary, participating agents, duration, and key highlights. Opens in a modal with full conversation details.', path: 'src/components/virtualOffice/FilingCabinet.tsx', reads: 'meeting-minutes', color: 'blue' },
                            { id: 'north-star-editor', name: 'North Star Editor', purpose: 'Admin UI for setting the company\'s strategic direction. The North Star has a title, description, and a list of key objectives. All autonomous task generation (Capsules) is aligned to whatever is set here. Changing the North Star immediately shifts what agents work on.', path: 'Virtual Office ⭐ button', reads: 'company-config/north-star', color: 'blue' },
                        ].map((item) => (
                            <div key={item.id} id={`glossary-${item.id}`} className="border border-zinc-800 rounded-xl p-4 bg-blue-500/[0.03] scroll-mt-24">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                                    <span className="text-sm font-semibold text-white">{item.name}</span>
                                    <span className="text-[10px] font-mono text-zinc-600 ml-auto">{item.path}</span>
                                </div>
                                <p className="text-sm text-zinc-300 leading-relaxed">{item.purpose}</p>
                                <p className="text-[10px] text-zinc-500 mt-2">Reads from: <span className="text-zinc-400 font-mono">{item.reads}</span></p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Script Layer Components */}
                <div className="mb-6">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400" /> Script Layer
                    </p>
                    <div className="space-y-3">
                        {[
                            { id: 'agent-runner', name: 'Agent Runner ×4', purpose: 'The brain of each agent. Runs as a long-lived Node.js process on the Mac Mini. Polls kanbanTasks for assigned work, decomposes tasks into steps, executes each step via the OpenClaw engine, posts events to the Heartbeat Feed on every milestone, and manages idle self-assignment. Each agent (Nora, Scout, Solara, Sage) runs its own instance with role-specific behavior.', path: 'scripts/agentRunner.js', reads: 'kanbanTasks, agent-presence, progress-timeline', color: 'green' },
                            { id: 'telemetry-check', name: 'Telemetry Check', purpose: 'The group coordination script. Creates a Firestore group chat session, runs 3 conversation rounds where agents report status, assigns North Star-aligned Capsules to idle agents, saves meeting minutes to the Filing Cabinet, and posts a summary event to the Heartbeat Feed. Replaces traditional daily standups.', path: 'scripts/dailyStandup.js', reads: 'agent-group-chats, standup-config, company-config', color: 'green' },
                            { id: 'trigger-api', name: 'Trigger API', purpose: 'The HTTP bridge. A Next.js API endpoint that spawns dailyStandup.js as a child process when the "Run Telemetry Check" button is clicked in the Virtual Office. Handles authentication and passes the check type (morning/evening).', path: 'pages/api/agent/trigger-standup.ts', reads: 'N/A (triggers script)', color: 'green' },
                            { id: 'openclaw', name: 'OpenClaw Engine', purpose: 'The AI execution runtime. A custom engine that wraps LLM API calls with tool use, file system access, and git integration. Agent Runners delegate step execution to OpenClaw, which produces outputs (code changes, research docs, analyses) that the runner then validates and commits.', path: 'External dependency', reads: 'N/A (called by Agent Runner)', color: 'purple' },
                        ].map((item) => (
                            <div key={item.id} id={`glossary-${item.id}`} className={`border border-zinc-800 rounded-xl p-4 scroll-mt-24 ${item.color === 'purple' ? 'bg-purple-500/[0.03]' : 'bg-green-500/[0.03]'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`w-2 h-2 rounded-full ${item.color === 'purple' ? 'bg-purple-400' : 'bg-green-400'}`} />
                                    <span className="text-sm font-semibold text-white">{item.name}</span>
                                    <span className="text-[10px] font-mono text-zinc-600 ml-auto">{item.path}</span>
                                </div>
                                <p className="text-sm text-zinc-300 leading-relaxed">{item.purpose}</p>
                                <p className="text-[10px] text-zinc-500 mt-2">Connects to: <span className="text-zinc-400 font-mono">{item.reads}</span></p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Data Layer Components */}
                <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400" /> Data Layer (Firestore)
                    </p>
                    <div className="space-y-3">
                        {[
                            { id: 'agent-presence', name: 'agent-presence', purpose: 'Real-time agent status and heartbeat data. Each agent writes to their document every 30 seconds with current status (idle/working/meeting), current task name, task progress percentage, and a timestamp. The Virtual Office reads this in real-time to show agent positions and activity.', writtenBy: 'Agent Runner', readBy: 'Virtual Office UI' },
                            { id: 'kanbanTasks', name: 'kanbanTasks', purpose: 'The task queue. Contains all Capsules (work items) with their assignee, status (todo/in-progress/done/blocked), description, priority, and source (manual, telemetry-auto-assign, self-assigned). Agent Runners poll this to find work.', writtenBy: 'Telemetry Check, Nora sweep, Admin UI', readBy: 'Agent Runner, Kanban Board UI' },
                            { id: 'progress-timeline', name: 'progress-timeline', purpose: 'The Heartbeat Feed data source. Each document is an event — an atomic update from an agent. Contains the beat type (hypothesis, work-in-flight, result, block, signal-spike), headline, optional artifact text, confidence color, and timestamp.', writtenBy: 'Agent Runner postBeat()', readBy: 'Progress Timeline UI' },
                            { id: 'progress-snapshots', name: 'progress-snapshots', purpose: 'Hourly Health Snapshot entries. Each agent writes one document per calendar hour summarizing their state: what objective they were on, their health color, stateTag, and a brief note. Powers the Health Snapshot tab in the Heartbeat Feed.', writtenBy: 'Agent Runner (hourly)', readBy: 'Health Snapshot UI tab' },
                            { id: 'agent-group-chats', name: 'agent-group-chats', purpose: 'Group conversation sessions. Created when a telemetry check starts. Contains participant list, session metadata, status (open/closed), and a messages subcollection with each round\'s prompt and responses. The Virtual Office listens for new sessions to trigger the round table animation.', writtenBy: 'Telemetry Check script', readBy: 'Virtual Office, GroupChatModal' },
                            { id: 'meeting-minutes', name: 'meeting-minutes', purpose: 'Archived summaries of completed telemetry checks. Each document contains an executive summary, agent highlights, duration, participant list, and the session\'s chat ID. Displayed in the Filing Cabinet drawer.', writtenBy: 'Telemetry Check (post-session)', readBy: 'Filing Cabinet UI' },
                            { id: 'company-config', name: 'company-config', purpose: 'Company-level configuration. The north-star sub-document holds the strategic goal (title, description, objectives array) that drives all autonomous Capsule generation. Changing this immediately redirects what all agents work on.', writtenBy: 'Admin UI (North Star Editor)', readBy: 'Telemetry Check, Agent Runner' },
                            { id: 'standup-config', name: 'standup-config', purpose: 'Telemetry check scheduling configuration. Contains the interval (minutes), whether checks are enabled, max duration, which agents participate, who moderates, and the protocol version. Edited via the StandupConfigPanel in the Virtual Office.', writtenBy: 'StandupConfigPanel UI', readBy: 'Telemetry Check script' },
                        ].map((item) => (
                            <div key={item.id} id={`glossary-${item.id}`} className="border border-zinc-800 rounded-xl p-4 bg-amber-500/[0.03] scroll-mt-24">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                                    <span className="text-sm font-semibold font-mono text-amber-300">{item.name}</span>
                                </div>
                                <p className="text-sm text-zinc-300 leading-relaxed">{item.purpose}</p>
                                <div className="flex gap-4 mt-2 text-[10px] text-zinc-500">
                                    <span>Written by: <span className="text-zinc-400">{item.writtenBy}</span></span>
                                    <span>Read by: <span className="text-zinc-400">{item.readBy}</span></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Telemetry Check Flow ─── */}
            <Collapsible title="Telemetry Check Flow" icon={<Radio className="w-5 h-5 text-indigo-300" />} defaultOpen>
                <div className="mt-4">
                    <FlowDiagram subtitle="End-to-end flow when a telemetry check runs — from trigger to Capsule assignment." steps={telemetryFlowSteps} />
                </div>
            </Collapsible>

            {/* ─── Agent Runner Lifecycle ─── */}
            <Collapsible title="Agent Runner Lifecycle" icon={<Zap className="w-5 h-5 text-green-300" />}>
                <div className="mt-4">
                    <FlowDiagram subtitle="How each agent runner picks up, executes, and reports on Capsules." steps={agentRunnerFlow} />
                </div>
            </Collapsible>

            {/* ─── Beat Types ─── */}
            <Collapsible title="Beat Types & Timeline Activity" icon={<Activity className="w-5 h-5 text-violet-300" />}>
                <div className="mt-4 space-y-3">
                    <p className="text-sm text-zinc-400 mb-4">
                        Events are the atomic unit of the Heartbeat Feed. Each event represents a meaningful moment in an agent&apos;s work.
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-zinc-500 text-xs uppercase">
                                <tr>
                                    <th className="text-left py-2 pr-3">Type</th>
                                    <th className="text-left pr-3">When It Fires</th>
                                    <th className="text-left pr-3">Color</th>
                                    <th className="text-left">Example</th>
                                </tr>
                            </thead>
                            <tbody className="text-zinc-300">
                                {beatTypes.map((bt) => (
                                    <tr key={bt.type} className="border-t border-zinc-800">
                                        <td className="py-3 pr-3">
                                            <span className="font-mono text-xs bg-white/5 px-2 py-1 rounded-lg">{bt.emoji} {bt.type}</span>
                                        </td>
                                        <td className="pr-3 text-xs">{bt.when}</td>
                                        <td className="pr-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${bt.color.includes('blue') ? 'bg-blue-500/20 text-blue-300' : bt.color.includes('green') ? 'bg-green-500/20 text-green-300' : bt.color.includes('yellow') ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'}`}>
                                                {bt.color}
                                            </span>
                                        </td>
                                        <td className="text-xs text-zinc-400 italic">{bt.example}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Collapsible>

            {/* ─── Firestore Schema ─── */}
            <Collapsible title="Firestore Data Schema" icon={<Database className="w-5 h-5 text-amber-300" />}>
                <div className="mt-4 space-y-4">
                    <p className="text-sm text-zinc-400 mb-2">
                        All Heartbeat Protocol data lives in Firestore. Every collection, who writes to it, and who reads from it.
                    </p>
                    {firestoreCollections.map((coll) => (
                        <div key={coll.name} className="border border-zinc-800 rounded-xl p-4 bg-white/[0.02]">
                            <span className="font-mono text-sm text-amber-300">{coll.name}</span>
                            <p className="text-sm text-zinc-300 mt-1 mb-3">{coll.purpose}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-zinc-500 uppercase tracking-wide">Written by:</span>
                                    <p className="text-zinc-300 mt-0.5">{coll.writtenBy}</p>
                                </div>
                                <div>
                                    <span className="text-zinc-500 uppercase tracking-wide">Read by:</span>
                                    <p className="text-zinc-300 mt-0.5">{coll.readBy}</p>
                                </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {coll.fields.map((field) => (
                                    <span key={field} className="font-mono text-[10px] bg-white/5 text-zinc-400 px-2 py-0.5 rounded-md">{field}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </Collapsible>

            {/* ─── North Star → Capsule Pipeline ─── */}
            <Collapsible title="North Star → Capsule Pipeline" icon={<Target className="w-5 h-5 text-amber-300" />}>
                <div className="mt-4 space-y-4">
                    <p className="text-sm text-zinc-400">
                        The North Star drives all autonomous task generation. Strategic direction flows into individual agent work.
                    </p>
                    <div className="bg-[#06090f] border border-zinc-800 rounded-2xl p-6 space-y-6">
                        {[
                            { step: '1', title: 'North Star Set', detail: 'Admin sets strategic goal with title, description, and key objectives.', store: 'company-config/north-star' },
                            { step: '2', title: 'Telemetry Check Loads North Star', detail: 'loadNorthStarRaw() fetches title, description & objectives from Firestore.', store: 'dailyStandup.js' },
                            { step: '3', title: 'Idle Agents Detected', detail: 'System checks each agent\'s kanban queue. Empty queue = IDLE.', store: 'kanbanTasks' },
                            { step: '4', title: 'Capsule Generated per Role', detail: 'Nora → ops audit, Scout → research, Solara → architecture, Sage → synthesis. Objectives rotate hourly.', store: 'generateCapsule()' },
                            { step: '5', title: 'Capsule Added to Kanban', detail: 'Written to kanbanTasks with source: "telemetry-auto-assign". Beat posted.', store: 'kanbanTasks + progress-timeline' },
                            { step: '6', title: 'Agent Runner Picks Up Capsule', detail: 'Runner detects new task on next poll (~30s). Execution begins. Beats flow.', store: 'agentRunner.js' },
                        ].map((item) => (
                            <div key={item.step} className="flex gap-4">
                                <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/40 to-amber-300/20 border border-amber-400/30 flex items-center justify-center text-sm font-bold text-amber-200">
                                    {item.step}
                                </div>
                                <div>
                                    <h4 className="text-white font-semibold text-sm">{item.title}</h4>
                                    <p className="text-zinc-400 text-sm mt-0.5">{item.detail}</p>
                                    <p className="text-[10px] text-zinc-600 font-mono mt-1">{item.store}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Collapsible>

            {/* ─── Key Scripts ─── */}
            <section className="bg-[#090d14] border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Server className="w-4 h-4 text-zinc-400" />
                    Key Scripts Reference
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {[
                        { file: 'scripts/agentRunner.js', purpose: 'Polls kanban tasks, decomposes into steps, executes via OpenClaw, posts beats, manages idle self-assignment and Nora\'s task manager sweep.' },
                        { file: 'scripts/dailyStandup.js', purpose: 'Telemetry check orchestrator. Creates group sessions, runs rounds, posts minutes, assigns Capsules to idle agents.' },
                        { file: 'pages/api/agent/trigger-standup.ts', purpose: 'API endpoint that spawns dailyStandup.js. Called by the "Run Telemetry Check" button.' },
                        { file: 'scripts/start-agent-[name].sh', purpose: 'Launch scripts per agent. Sets env vars (AGENT_ID, AGENT_NAME, USE_OPENCLAW) and runs agentRunner.js.' },
                    ].map((script) => (
                        <div key={script.file} className="border border-zinc-800 rounded-xl p-4 bg-white/[0.02]">
                            <p className="font-mono text-xs text-indigo-300 mb-1">{script.file}</p>
                            <p className="text-zinc-400 text-xs leading-relaxed">{script.purpose}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
