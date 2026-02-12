import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { presenceService, AgentPresence } from '../../api/firebase/presence/service';
import { Activity, Database, Layers, Link2, Server, Users } from 'lucide-react';

interface SystemNode {
  id: string;
  name: string;
  layer: 'surface' | 'backend' | 'integration' | 'agent';
  status: 'stable' | 'degraded' | 'planned';
  description: string;
  owner?: string;
  repo?: string;
  link?: string;
  x: number; // percentage positions inside map canvas
  y: number;
}

interface Connection {
  from: string;
  to: string;
  type: 'data' | 'auth' | 'events';
}

const systemNodes: SystemNode[] = [
  {
    id: 'quicklifts-ios',
    name: 'QuickLifts iOS',
    layer: 'surface',
    status: 'stable',
    description: 'Flagship consumer + creator surface built in SwiftUI.',
    owner: 'iOS Squad',
    repo: 'QuickLifts',
    x: 15,
    y: 20,
  },
  {
    id: 'pulse-android',
    name: 'Pulse Android',
    layer: 'surface',
    status: 'stable',
    description: 'Jetpack Compose app nearing feature parity.',
    owner: 'Android Squad',
    repo: 'Pulse-Android',
    x: 35,
    y: 25,
  },
  {
    id: 'pulsecheck-ios',
    name: 'PulseCheck iOS',
    layer: 'surface',
    status: 'stable',
    description: 'Mental training + Nora companion app.',
    owner: 'PulseCheck Team',
    repo: 'PulseCheck',
    x: 55,
    y: 20,
  },
  {
    id: 'quicklifts-web',
    name: 'QuickLifts Web',
    layer: 'surface',
    status: 'stable',
    description: 'Marketing site, admin console, creator tooling.',
    owner: 'Web Platform',
    repo: 'QuickLifts-Web',
    x: 75,
    y: 24,
  },
  {
    id: 'firebase-auth',
    name: 'Firebase Auth',
    layer: 'backend',
    status: 'stable',
    description: 'Email/Apple/Google sign-in for all clients.',
    x: 20,
    y: 55,
  },
  {
    id: 'firestore',
    name: 'Cloud Firestore',
    layer: 'backend',
    status: 'stable',
    description: 'Primary data store: users, rounds, creator pages.',
    x: 40,
    y: 60,
  },
  {
    id: 'storage',
    name: 'Firebase Storage',
    layer: 'backend',
    status: 'stable',
    description: 'Move videos, thumbnails, legal docs.',
    x: 60,
    y: 58,
  },
  {
    id: 'netlify-functions',
    name: 'Netlify Functions',
    layer: 'backend',
    status: 'stable',
    description: 'Serverless jobs (payments, emails, automations).',
    x: 80,
    y: 62,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    layer: 'integration',
    status: 'stable',
    description: 'Subscriptions, deposits, prize payouts.',
    x: 25,
    y: 80,
  },
  {
    id: 'revenuecat',
    name: 'RevenueCat',
    layer: 'integration',
    status: 'stable',
    description: 'Cross-platform subscription sync.',
    x: 45,
    y: 82,
  },
  {
    id: 'brevo',
    name: 'Brevo',
    layer: 'integration',
    status: 'stable',
    description: 'Waitlist + lifecycle email flows.',
    x: 65,
    y: 84,
  },
  {
    id: 'instantly',
    name: 'Instantly',
    layer: 'integration',
    status: 'stable',
    description: 'Outbound sequencing + automations.',
    x: 85,
    y: 80,
  },
  {
    id: 'virtual-office',
    name: 'Virtual Office',
    layer: 'agent',
    status: 'stable',
    description: 'Presence UI powered by agent-presence collection.',
    x: 30,
    y: 35,
  },
  {
    id: 'agent-runner',
    name: 'Agent Runner',
    layer: 'agent',
    status: 'stable',
    description: 'CLI daemon executing kanban tasks + heartbeats.',
    x: 50,
    y: 38,
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    layer: 'agent',
    status: 'stable',
    description: 'IDE copilot coordinating engineering tasks.',
    x: 70,
    y: 36,
  },
];

const connections: Connection[] = [
  { from: 'quicklifts-ios', to: 'firebase-auth', type: 'auth' },
  { from: 'quicklifts-ios', to: 'firestore', type: 'data' },
  { from: 'quicklifts-web', to: 'netlify-functions', type: 'events' },
  { from: 'quicklifts-web', to: 'firestore', type: 'data' },
  { from: 'pulse-android', to: 'firestore', type: 'data' },
  { from: 'pulsecheck-ios', to: 'firestore', type: 'data' },
  { from: 'firestore', to: 'netlify-functions', type: 'events' },
  { from: 'netlify-functions', to: 'stripe', type: 'data' },
  { from: 'netlify-functions', to: 'brevo', type: 'events' },
  { from: 'netlify-functions', to: 'instantly', type: 'events' },
  { from: 'firebase-auth', to: 'virtual-office', type: 'data' },
  { from: 'firestore', to: 'virtual-office', type: 'data' },
  { from: 'firestore', to: 'agent-runner', type: 'data' },
  { from: 'virtual-office', to: 'antigravity', type: 'events' },
];

const summaryCards = [
  { title: 'Client Surfaces', value: '4', icon: <Layers className="w-5 h-5" />, tone: 'from-blue-500/30 to-blue-300/10' },
  { title: 'Backend Services', value: '4', icon: <Server className="w-5 h-5" />, tone: 'from-purple-500/30 to-purple-300/10' },
  { title: 'Integrations', value: '4', icon: <Link2 className="w-5 h-5" />, tone: 'from-amber-500/30 to-amber-300/10' },
  { title: 'Agents Online', value: '4', icon: <Users className="w-5 h-5" />, tone: 'from-green-500/30 to-green-300/10' },
];

const surfacesTable = [
  { name: 'QuickLifts iOS', repo: 'QuickLifts', release: 'TestFlight weekly', status: 'Production' },
  { name: 'Pulse Android', repo: 'Pulse-Android', release: 'Internal QA', status: 'Staging' },
  { name: 'PulseCheck iOS', repo: 'PulseCheck', release: 'App Store beta', status: 'Production' },
  { name: 'QuickLifts Web', repo: 'QuickLifts-Web', release: 'Netlify (main)', status: 'Production' },
];

const backendTable = [
  { name: 'Firestore', detail: 'Users, rounds, creator-pages, kanban tasks', owner: 'Platform', status: 'Healthy' },
  { name: 'Netlify Functions', detail: 'Payments, messaging, automation jobs', owner: 'Platform', status: 'Healthy' },
  { name: 'Firebase Auth', detail: 'Email, Apple, Google sign-in', owner: 'Platform', status: 'Healthy' },
  { name: 'Firebase Storage', detail: 'Videos, waivers, legal docs', owner: 'Platform', status: 'Healthy' },
];

const integrationsTable = [
  { name: 'Stripe', purpose: 'Subscriptions, deposits, prize payouts', status: 'Connected' },
  { name: 'RevenueCat', purpose: 'Subscription sync for mobile apps', status: 'Connected' },
  { name: 'Brevo', purpose: 'Waitlists + lifecycle messaging', status: 'Connected' },
  { name: 'Instantly', purpose: 'Outbound automation', status: 'Active' },
];

const detailCopy: Record<string, string> = systemNodes.reduce((acc, node) => {
  acc[node.id] = node.description;
  return acc;
}, {} as Record<string, string>);

function SummaryCard({ title, value, icon, tone }: { title: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <div className={`bg-gradient-to-br ${tone} border border-white/5 rounded-2xl p-4 flex items-center justify-between`}> 
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-400">{title}</p>
        <p className="text-2xl font-semibold text-white mt-1">{value}</p>
      </div>
      <div className="p-3 rounded-full bg-black/30 text-white">{icon}</div>
    </div>
  );
}

function SystemMap({ nodes, selectedId, onSelect }: { nodes: SystemNode[]; selectedId?: string; onSelect: (id: string) => void }) {
  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes]);
  const lines = connections.filter((conn) => nodeMap[conn.from] && nodeMap[conn.to]);

  return (
    <div className="relative bg-[#06090f] border border-zinc-800 rounded-2xl h-[420px] overflow-hidden">
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {lines.map((conn) => {
          const from = nodeMap[conn.from];
          const to = nodeMap[conn.to];
          const path = `M ${from.x}% ${from.y}% C ${(from.x + to.x) / 2}% ${from.y}%, ${(from.x + to.x) / 2}% ${to.y}%, ${to.x}% ${to.y}%`;
          const color = conn.type === 'data' ? '#38bdf8' : conn.type === 'auth' ? '#a78bfa' : '#facc15';
          return <path key={`${conn.from}-${conn.to}`} d={path} stroke={color} strokeWidth={1.5} fill="none" strokeOpacity={0.35} markerEnd="url(#arrowhead)" />;
        })}
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" fill="#f8fafc">
            <path d="M0,0 L0,6 L6,3 z" />
          </marker>
        </defs>
      </svg>
      {nodes.map((node) => (
        <button
          key={node.id}
          className={`absolute px-3 py-2 rounded-xl text-left text-sm border shadow-lg transition-all duration-300 ${
            node.layer === 'surface'
              ? 'bg-blue-500/10 border-blue-400/40'
              : node.layer === 'backend'
              ? 'bg-purple-500/10 border-purple-400/40'
              : node.layer === 'integration'
              ? 'bg-amber-500/10 border-amber-400/40'
              : 'bg-green-500/10 border-green-400/40'
          } ${selectedId === node.id ? 'ring-2 ring-white/60' : ''}`}
          style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
          onClick={() => onSelect(node.id)}
        >
          <p className="text-xs uppercase tracking-wide text-white/60">{node.layer}</p>
          <p className="text-white font-semibold">{node.name}</p>
          <p className="text-xs text-white/60">{node.status === 'stable' ? 'Stable' : node.status === 'degraded' ? 'Degraded' : 'Planned'}</p>
        </button>
      ))}
    </div>
  );
}

const DetailPanel: React.FC<{ node?: SystemNode; agents: AgentPresence[] }> = ({ node, agents }) => {
  if (!node) {
    return (
      <div className="bg-[#0b0f18] border border-zinc-800 rounded-2xl p-6 text-zinc-500 text-sm">
        Select a node to view details.
      </div>
    );
  }

  const linkedAgent = node.layer === 'agent' ? agents.find((a) => a.displayName === node.name || a.id === node.id) : undefined;

  return (
    <div className="bg-[#0b0f18] border border-zinc-800 rounded-2xl p-6">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{node.layer}</p>
      <h3 className="text-2xl font-semibold text-white mb-2">{node.name}</h3>
      <p className="text-sm text-zinc-300 mb-4">{detailCopy[node.id]}</p>
      {node.owner && (
        <p className="text-xs text-zinc-400 mb-1">Owner: <span className="text-white">{node.owner}</span></p>
      )}
      {node.repo && (
        <p className="text-xs text-zinc-400 mb-3">Repo: <span className="text-white">{node.repo}</span></p>
      )}
      {linkedAgent && (
        <div className="mt-4 text-xs text-zinc-300">
          <p className="font-semibold text-sm text-white mb-1">Live presence</p>
          <p>Status: {linkedAgent.status}</p>
          <p>Task: {linkedAgent.currentTask || '—'}</p>
          <p>Last heartbeat: {linkedAgent.lastUpdate ? linkedAgent.lastUpdate.toLocaleTimeString() : '—'}</p>
        </div>
      )}
    </div>
  );
};

const SystemOverviewPage: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>('quicklifts-web');
  const [agentPresence, setAgentPresence] = useState<AgentPresence[]>([]);

  useEffect(() => {
    const unsubscribe = presenceService.listen((agents) => setAgentPresence(agents));
    return () => unsubscribe();
  }, []);

  const selectedNode = useMemo(() => systemNodes.find((node) => node.id === selectedNodeId), [selectedNodeId]);

  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <Head>
        <title>System Architecture Overview - Pulse Admin</title>
      </Head>
      <AdminRouteGuard>
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
          <header>
            <p className="text-sm text-zinc-500 uppercase">Operations</p>
            <h1 className="text-3xl font-semibold">System Architecture Overview</h1>
            <p className="text-zinc-400 text-sm mt-1">Living map of surfaces, services, integrations, and agents powering Pulse.</p>
          </header>

          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map((card) => (
              <SummaryCard key={card.title} {...card} />
            ))}
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">Systems Map</h2>
                <span className="text-xs text-zinc-500 flex items-center gap-1"><Activity className="w-3 h-3" /> Live</span>
              </div>
              <SystemMap nodes={systemNodes} selectedId={selectedNodeId} onSelect={setSelectedNodeId} />
            </div>
            <DetailPanel node={selectedNode} agents={agentPresence} />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#090d14] border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-blue-300" />
                <h3 className="text-lg font-semibold">Client Surfaces</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-zinc-500 text-xs uppercase">
                    <tr>
                      <th className="text-left py-2">Surface</th>
                      <th className="text-left">Repo</th>
                      <th className="text-left">Release</th>
                      <th className="text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    {surfacesTable.map((row) => (
                      <tr key={row.name} className="border-t border-zinc-800">
                        <td className="py-2">{row.name}</td>
                        <td>{row.repo}</td>
                        <td>{row.release}</td>
                        <td>{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#090d14] border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Server className="w-4 h-4 text-purple-300" />
                <h3 className="text-lg font-semibold">Backend Services</h3>
              </div>
              <div className="space-y-3 text-sm text-zinc-300">
                {backendTable.map((service) => (
                  <div key={service.name} className="border border-zinc-800 rounded-xl p-3 bg-white/5">
                    <p className="text-white font-semibold">{service.name}</p>
                    <p className="text-xs text-zinc-400">{service.detail}</p>
                    <p className="text-xs text-zinc-500 mt-1">Owner: {service.owner} • Status: {service.status}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#090d14] border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-green-300" />
                <h3 className="text-lg font-semibold">Agent Infrastructure</h3>
              </div>
              <div className="space-y-3 text-sm">
                {agentPresence.length === 0 && <p className="text-zinc-500">No agents online.</p>}
                {agentPresence.map((agent) => (
                  <div key={agent.id} className="border border-zinc-800 rounded-xl p-3 bg-white/5">
                    <p className="text-white font-semibold flex items-center gap-2">
                      {agent.emoji} {agent.displayName}
                    </p>
                    <p className="text-xs text-zinc-400">Status: {agent.status}</p>
                    <p className="text-xs text-zinc-400">Task: {agent.currentTask || '—'}</p>
                    <p className="text-xs text-zinc-500">Last heartbeat: {agent.lastUpdate ? agent.lastUpdate.toLocaleTimeString() : '—'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#090d14] border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-4 h-4 text-amber-300" />
                <h3 className="text-lg font-semibold">Integrations</h3>
              </div>
              <div className="space-y-3 text-sm text-zinc-300">
                {integrationsTable.map((integration) => (
                  <div key={integration.name} className="border border-zinc-800 rounded-xl p-3 bg-white/5">
                    <p className="text-white font-semibold">{integration.name}</p>
                    <p className="text-xs text-zinc-400">{integration.purpose}</p>
                    <p className="text-xs text-zinc-500 mt-1">Status: {integration.status}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </AdminRouteGuard>
    </div>
  );
};

export default SystemOverviewPage;
