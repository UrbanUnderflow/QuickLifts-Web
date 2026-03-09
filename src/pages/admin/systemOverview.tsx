import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { Activity, AlertTriangle, Brain, Database, Gamepad2, Layers, Link2, Server, Users, Cpu } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import SectionNav from '../../components/admin/system-overview/SectionNav';
import ProductHandbook from '../../components/admin/system-overview/ProductHandbook';
import HeartbeatProtocolTab from '../../components/admin/HeartbeatProtocolTab';
import HunterWorldTab from '../../components/admin/HunterWorldTab';
import SimulationTaxonomyTab from '../../components/admin/system-overview/SimulationTaxonomyTab';
import SimFamilyTreeTab from '../../components/admin/system-overview/SimFamilyTreeTab';
import PromotionProtocolTab from '../../components/admin/system-overview/PromotionProtocolTab';
import SimSpecStandardsTab from '../../components/admin/system-overview/SimSpecStandardsTab';
import VariantRegistryTab from '../../components/admin/system-overview/VariantRegistryTab';
import SimFamilySpecTab from '../../components/admin/system-overview/SimFamilySpecTab';
import AthleteJourneyTab from '../../components/admin/system-overview/AthleteJourneyTab';
import { systemOverviewManifest } from '../../content/system-overview/manifest';
import type { ConnectionType, EcosystemConnection, EcosystemNode } from '../../content/system-overview/schema';

const SYSTEM_OVERVIEW_PASSCODE = 'PULSESECURE';
const SYSTEM_OVERVIEW_UNLOCK_KEY = 'system-overview-unlocked';

const CONNECTION_COLORS: Record<ConnectionType, string> = {
  data: '#38bdf8',
  auth: '#a78bfa',
  events: '#facc15',
};

const LAYER_STYLES: Record<EcosystemNode['layer'], string> = {
  surface: 'bg-blue-500/10 border-blue-400/40',
  backend: 'bg-purple-500/10 border-purple-400/40',
  integration: 'bg-amber-500/10 border-amber-400/40',
  agent: 'bg-green-500/10 border-green-400/40',
};

/* ---- SYSTEM-LEVEL TAB DEFINITIONS ---- */
interface SystemTab {
  id: string;
  label: string;
  icon: React.ElementType;
  accent: string;
  sectionIds: string[];
}

const SYSTEM_TABS: SystemTab[] = [
  {
    id: 'pulse-community',
    label: 'Pulse Community',
    icon: Users,
    accent: '#60a5fa',
    sectionIds: ['executive-summary', 'ecosystem-map', 'product-handbooks', 'backend-data', 'integrations', 'end-to-end-flows', 'ownership-release-matrix', 'risks-gaps', 'glossary'],
  },
  {
    id: 'pulsecheck',
    label: 'PulseCheck',
    icon: Brain,
    accent: '#c084fc',
    sectionIds: ['simulation-taxonomy', 'sim-family-tree', 'promotion-protocol', 'sim-spec-standards', 'variant-registry', 'sim-family-specs', 'athlete-journey'],
  },
  {
    id: 'agent-swarm',
    label: 'Agent Swarm',
    icon: Cpu,
    accent: '#22c55e',
    sectionIds: ['agent-infrastructure-handbook'],
  },
  {
    id: 'hunter-world',
    label: 'Hunter World',
    icon: Gamepad2,
    accent: '#facc15',
    sectionIds: ['hunter-world-handbook'],
  },
];

/* Find which system tab a given section belongs to */
function getSystemForSection(sectionId: string): string {
  for (const tab of SYSTEM_TABS) {
    if (tab.sectionIds.includes(sectionId)) return tab.id;
  }
  return SYSTEM_TABS[0].id;
}

function EcosystemMap({ nodes, connections }: { nodes: EcosystemNode[]; connections: EcosystemConnection[] }) {
  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes]);

  return (
    <div className="relative bg-[#050a14] border border-zinc-800 rounded-2xl h-[460px] overflow-hidden">
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {connections.map((connection) => {
          const from = nodeMap[connection.from];
          const to = nodeMap[connection.to];
          if (!from || !to) return null;
          const path = `M ${from.x}% ${from.y}% C ${(from.x + to.x) / 2}% ${from.y}%, ${(from.x + to.x) / 2}% ${to.y}%, ${to.x}% ${to.y}%`;
          return (
            <path
              key={`${connection.from}-${connection.to}`}
              d={path}
              stroke={CONNECTION_COLORS[connection.type]}
              strokeWidth={1.5}
              fill="none"
              strokeOpacity={0.45}
              markerEnd="url(#map-arrowhead)"
            />
          );
        })}
        <defs>
          <marker id="map-arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" fill="#f8fafc">
            <path d="M0,0 L0,6 L6,3 z" />
          </marker>
        </defs>
      </svg>
      {nodes.map((node) => (
        <div
          key={node.id}
          className={`absolute px-3 py-2 rounded-xl text-left text-xs border shadow-lg ${LAYER_STYLES[node.layer]}`}
          style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
        >
          <p className="uppercase tracking-wide text-white/60">{node.layer}</p>
          <p className="text-sm text-white font-semibold">{node.name}</p>
          <p className="text-white/70">{node.owner}</p>
        </div>
      ))}
    </div>
  );
}

const SystemOverviewPage: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [activeSystemId, setActiveSystemId] = useState<string>(SYSTEM_TABS[0].id);
  const [activeSectionId, setActiveSectionId] = useState<string>(systemOverviewManifest.sections[0]?.id || 'executive-summary');

  // Derive filtered sidebar sections for the active system tab
  const activeSystemTab = useMemo(() => SYSTEM_TABS.find((t) => t.id === activeSystemId) || SYSTEM_TABS[0], [activeSystemId]);
  const filteredSections = useMemo(
    () => systemOverviewManifest.sections.filter((s) => activeSystemTab.sectionIds.includes(s.id)),
    [activeSystemTab]
  );

  useEffect(() => {
    try {
      const unlocked = sessionStorage.getItem(SYSTEM_OVERVIEW_UNLOCK_KEY) === 'true';
      setIsUnlocked(unlocked);
    } catch {
      setIsUnlocked(false);
    }
  }, []);

  // Read initial section from URL hash if present
  useEffect(() => {
    if (!isUnlocked) return;
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const matchingSection = systemOverviewManifest.sections.find((s) => s.id === hash);
      if (matchingSection) {
        setActiveSectionId(hash);
        // Also set the correct system tab
        setActiveSystemId(getSystemForSection(hash));
      }
    }
  }, [isUnlocked]);

  const handleSystemChange = (systemId: string) => {
    setActiveSystemId(systemId);
    // Auto-select the first section in the new system
    const tab = SYSTEM_TABS.find((t) => t.id === systemId);
    if (tab && tab.sectionIds.length > 0) {
      const firstSectionId = tab.sectionIds[0];
      setActiveSectionId(firstSectionId);
      window.history.replaceState(null, '', `#${firstSectionId}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSectionChange = (sectionId: string) => {
    setActiveSectionId(sectionId);
    // Update URL hash without scrolling
    window.history.replaceState(null, '', `#${sectionId}`);
    // Scroll to top of content area
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const summaryCards = useMemo(
    () => [
      {
        title: 'Products',
        value: String(systemOverviewManifest.products.length),
        icon: <Layers className="w-5 h-5" />,
        caption: 'QuickLifts iOS, Android, PulseCheck, Web',
        tone: 'from-blue-500/30 to-blue-300/10',
      },
      {
        title: 'Backend Services',
        value: String(systemOverviewManifest.backendServices.length),
        icon: <Server className="w-5 h-5" />,
        caption: 'Core platform runtime services',
        tone: 'from-purple-500/30 to-purple-300/10',
      },
      {
        title: 'Integrations',
        value: String(systemOverviewManifest.integrations.length),
        icon: <Link2 className="w-5 h-5" />,
        caption: 'Billing, messaging, AI, health data',
        tone: 'from-amber-500/30 to-amber-300/10',
      },
      {
        title: 'End-to-End Flows',
        value: String(systemOverviewManifest.flows.length),
        icon: <Activity className="w-5 h-5" />,
        caption: 'Cross-product lifecycle maps',
        tone: 'from-green-500/30 to-green-300/10',
      },
    ],
    []
  );

  const handlePasscodeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPasscode = passcodeInput.trim().toUpperCase();

    if (trimmedPasscode === SYSTEM_OVERVIEW_PASSCODE) {
      try {
        sessionStorage.setItem(SYSTEM_OVERVIEW_UNLOCK_KEY, 'true');
      } catch {
        // no-op when session storage is unavailable
      }
      setIsUnlocked(true);
      setPasscodeInput('');
      setPasscodeError('');
      return;
    }

    setPasscodeError('Incorrect passcode. Please try again.');
  };

  if (!isUnlocked) {
    return (
      <AdminRouteGuard>
        <div className="min-h-screen bg-[#05070c] text-white flex items-center justify-center px-6">
          <Head>
            <title>System Overview Access | Pulse</title>
          </Head>
          <div className="w-full max-w-sm bg-[#0b0f18] border border-zinc-800 rounded-2xl p-6">
            <h1 className="text-xl font-semibold">System Overview</h1>
            <p className="text-zinc-400 text-sm mt-1 mb-5">Enter passcode to view the handbook.</p>
            <form onSubmit={handlePasscodeSubmit} className="space-y-3">
              <input
                type="password"
                value={passcodeInput}
                onChange={(event) => {
                  setPasscodeInput(event.target.value.toUpperCase());
                  setPasscodeError('');
                }}
                placeholder="Passcode"
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-white/50 uppercase"
                style={{ textTransform: 'uppercase' }}
                autoComplete="off"
                autoFocus
              />
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors"
              >
                Enter
              </button>
              {passcodeError && <p className="text-red-400 text-sm">{passcodeError}</p>}
            </form>
          </div>
        </div>
      </AdminRouteGuard>
    );
  }

  /* ---- SECTION CONTENT RENDERER ---- */
  const renderSectionContent = () => {
    switch (activeSectionId) {
      case 'executive-summary':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
              {summaryCards.map((card) => (
                <div key={card.title} className={`bg-gradient-to-br ${card.tone} border border-white/5 rounded-2xl p-4 flex items-center justify-between`}>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-400">{card.title}</p>
                    <p className="text-2xl font-semibold text-white mt-1">{card.value}</p>
                    <p className="text-[11px] text-white/70 mt-0.5">{card.caption}</p>
                  </div>
                  <div className="p-3 rounded-full bg-black/30 text-white">{card.icon}</div>
                </div>
              ))}
            </div>

            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Mission</h2>
                <p className="text-sm text-zinc-300 mt-1">{systemOverviewManifest.executiveSummary.mission}</p>
                <p className="text-xs text-zinc-500 mt-2">Audience: {systemOverviewManifest.executiveSummary.audience}</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-black/20 border border-zinc-800 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">What Changed Recently</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-300">
                    {systemOverviewManifest.executiveSummary.whatChangedRecently.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-black/20 border border-zinc-800 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Highlights</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-300">
                    {systemOverviewManifest.executiveSummary.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'ecosystem-map':
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Ecosystem Map</h2>
              <p className="text-sm text-zinc-400 mt-1">Layered map of system surfaces, backend, integrations, and agent infrastructure.</p>
            </div>
            <EcosystemMap nodes={systemOverviewManifest.ecosystemMap.nodes} connections={systemOverviewManifest.ecosystemMap.connections} />
            <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#38bdf8] inline-block" />Data</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#a78bfa] inline-block" />Auth</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#facc15] inline-block" />Events</span>
            </div>
          </div>
        );

      case 'product-handbooks':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Product Handbooks</h2>
              <p className="text-sm text-zinc-400 mt-1">Feature-by-feature inventory with dependencies, data paths, ownership, and release channels.</p>
            </div>
            {systemOverviewManifest.products.map((product) => (
              <ProductHandbook key={product.id} product={product} />
            ))}
          </div>
        );

      case 'backend-data':
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Backend and Data</h2>
              <p className="text-sm text-zinc-400 mt-1">Platform service inventory and canonical data collection usage.</p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-purple-300" />
                  <h3 className="text-lg font-semibold">Backend Services</h3>
                </div>
                <div className="space-y-3 text-sm">
                  {systemOverviewManifest.backendServices.map((service) => (
                    <div key={service.id} className="border border-zinc-800 rounded-xl p-3 bg-black/20">
                      <p className="text-white font-semibold">{service.name}</p>
                      <p className="text-zinc-400 text-xs mt-1">{service.purpose}</p>
                      <p className="text-zinc-500 text-xs mt-2">Owner: {service.owner} | Environments: {service.environments.join(', ')}</p>
                      <p className="text-zinc-500 text-xs">Dependencies: {service.keyDependencies.join(', ')}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-300" />
                  <h3 className="text-lg font-semibold">Data Collections</h3>
                </div>
                <div className="space-y-3 text-sm max-h-[560px] overflow-auto pr-1">
                  {systemOverviewManifest.dataCollections.map((collection) => (
                    <div key={collection.id} className="border border-zinc-800 rounded-xl p-3 bg-black/20">
                      <p className="text-white font-semibold font-mono text-xs">{collection.name}</p>
                      <p className="text-zinc-400 text-xs mt-1">{collection.purpose}</p>
                      <p className="text-zinc-500 text-xs mt-2">Written by: {collection.writtenBy}</p>
                      <p className="text-zinc-500 text-xs">Read by: {collection.readBy}</p>
                      <p className="text-zinc-500 text-xs">Critical fields: {collection.criticalFields.join(', ')}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'integrations':
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Integrations</h2>
              <p className="text-sm text-zinc-400 mt-1">External systems, operational ownership, and credential origin visibility.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {systemOverviewManifest.integrations.map((integration) => (
                <article key={integration.id} className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">{integration.name}</h3>
                    <span className="text-[11px] uppercase tracking-wide text-zinc-400">{integration.status}</span>
                  </div>
                  <p className="text-sm text-zinc-300 mt-2">{integration.purpose}</p>
                  <p className="text-xs text-zinc-500 mt-2">Owner: {integration.owner}</p>
                  <p className="text-xs text-zinc-500">Credential source: {integration.credentialSource}</p>
                  <p className="text-xs text-zinc-500">Products: {integration.products.join(', ')}</p>
                </article>
              ))}
            </div>
          </div>
        );

      case 'end-to-end-flows':
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">End-to-End Flows</h2>
              <p className="text-sm text-zinc-400 mt-1">Trigger-to-outcome maps with data touchpoints and failure modes.</p>
            </div>
            <div className="space-y-4">
              {systemOverviewManifest.flows.map((flow) => (
                <article key={flow.id} className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{flow.name}</h3>
                    <p className="text-sm text-zinc-400 mt-1">Trigger: {flow.trigger}</p>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-xs">
                    <div className="border border-zinc-800 rounded-xl p-3 bg-black/20">
                      <p className="uppercase tracking-wide text-zinc-500 mb-1">System Path</p>
                      <p className="text-zinc-300">{flow.backendPath.join(' -> ')}</p>
                      <p className="text-zinc-500 mt-2 break-words">Products: {flow.involvedProducts.join(', ')}</p>
                      <p className="text-zinc-500 break-words">Collections: {flow.collectionsTouched.join(', ')}</p>
                      <p className="text-zinc-500 break-words">Integrations: {flow.integrations.join(', ') || 'N/A'}</p>
                    </div>
                    <div className="border border-zinc-800 rounded-xl p-3 bg-black/20">
                      <p className="uppercase tracking-wide text-zinc-500 mb-1">Failure Points</p>
                      <ul className="list-disc pl-4 text-zinc-300 space-y-1">
                        {flow.failurePoints.map((failure) => (
                          <li key={failure}>{failure}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <ol className="space-y-2">
                    {flow.steps.map((step) => (
                      <li key={step.id} className="border border-zinc-800 rounded-xl p-3 bg-black/20">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">{step.actor}</p>
                        <p className="text-sm text-white font-semibold mt-1">{step.action}</p>
                        <p className="text-xs text-zinc-400 mt-1">Output: {step.output}</p>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </div>
        );

      case 'ownership-release-matrix':
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Ownership and Release Matrix</h2>
              <p className="text-sm text-zinc-400 mt-1">Primary operational ownership, escalation backup, and cadence references.</p>
            </div>
            <div className="overflow-x-auto border border-zinc-800 rounded-2xl">
              <table className="w-full text-sm min-w-[860px]">
                <thead className="bg-black/20 text-zinc-400 uppercase text-xs tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-2">Domain</th>
                    <th className="text-left px-3 py-2">Primary Owner</th>
                    <th className="text-left px-3 py-2">Backup Owner</th>
                    <th className="text-left px-3 py-2">Release Cadence</th>
                    <th className="text-left px-3 py-2">Runbook Path</th>
                  </tr>
                </thead>
                <tbody>
                  {systemOverviewManifest.ownershipMatrix.map((row) => (
                    <tr key={row.domain} className="border-t border-zinc-800">
                      <td className="px-3 py-3 text-zinc-200">{row.domain}</td>
                      <td className="px-3 py-3 text-zinc-300">{row.primaryOwner}</td>
                      <td className="px-3 py-3 text-zinc-300">{row.backupOwner}</td>
                      <td className="px-3 py-3 text-zinc-300">{row.releaseCadence}</td>
                      <td className="px-3 py-3 text-zinc-500 text-xs font-mono break-all">{row.runbookPath}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'agent-infrastructure-handbook':
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Agent Infrastructure Handbook</h2>
              <p className="text-sm text-zinc-400 mt-1">Embedded chapter preserving current heartbeat protocol, data schema, and operator docs.</p>
            </div>
            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4 overflow-hidden">
              <HeartbeatProtocolTab />
            </div>
          </div>
        );

      case 'hunter-world-handbook':
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Hunter World Handbook</h2>
              <p className="text-sm text-zinc-400 mt-1">Embedded chapter for leveling mechanics, specialty classes, and creator narrative system.</p>
            </div>
            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4 overflow-hidden">
              <HunterWorldTab />
            </div>
          </div>
        );

      case 'risks-gaps':
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Risks and Gaps</h2>
              <p className="text-sm text-zinc-400 mt-1">Known system risks and active mitigation posture.</p>
            </div>
            <div className="space-y-3">
              {systemOverviewManifest.risksAndGaps.map((risk) => (
                <article key={risk.id} className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-300" />
                    <h3 className="text-lg font-semibold text-white">{risk.title}</h3>
                    <span className="text-[11px] uppercase tracking-wide text-zinc-400 ml-auto">{risk.severity}</span>
                  </div>
                  <p className="text-sm text-zinc-300 mt-2">Impact: {risk.impact}</p>
                  <p className="text-sm text-zinc-400 mt-1">Mitigation: {risk.mitigation}</p>
                  <p className="text-xs text-zinc-500 mt-2">Owner: {risk.owner}</p>
                </article>
              ))}
            </div>
          </div>
        );

      case 'glossary':
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Glossary</h2>
              <p className="text-sm text-zinc-400 mt-1">Shared language across product, engineering, and operations.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {systemOverviewManifest.glossary.map((entry) => (
                <article key={entry.term} className="bg-[#090f1c] border border-zinc-800 rounded-xl p-4">
                  <p className="text-sm font-semibold text-white">{entry.term}</p>
                  <p className="text-xs text-zinc-400 mt-1">{entry.definition}</p>
                </article>
              ))}
            </div>
          </div>
        );

      case 'simulation-taxonomy':
        return <SimulationTaxonomyTab />;

      case 'sim-family-tree':
        return <SimFamilyTreeTab />;

      case 'promotion-protocol':
        return <PromotionProtocolTab />;

      case 'sim-spec-standards':
        return <SimSpecStandardsTab />;

      case 'variant-registry':
        return <VariantRegistryTab />;

      case 'sim-family-specs':
        return <SimFamilySpecTab />;

      case 'athlete-journey':
        return <AthleteJourneyTab />;

      default:
        return null;
    }
  };

  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-[#05070c] text-white overflow-x-hidden">
        <Head>
          <title>{systemOverviewManifest.title} | Pulse Admin</title>
        </Head>

        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-6 py-8 md:py-10 space-y-6">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Operations Handbook</p>
            <h1 className="text-3xl font-semibold">{systemOverviewManifest.title}</h1>
            <p className="text-zinc-300 text-sm max-w-4xl">{systemOverviewManifest.subtitle}</p>
            <p className="text-xs text-zinc-500">Last updated: {systemOverviewManifest.lastUpdated}</p>
          </header>

          {/* ---- SYSTEM-LEVEL TABS ---- */}
          <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-2">
            {SYSTEM_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeSystemId;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSystemChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${isActive
                    ? 'text-white shadow-lg'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] border border-transparent hover:border-zinc-800'
                    }`}
                  style={
                    isActive
                      ? {
                        background: `linear-gradient(135deg, ${tab.accent}18, ${tab.accent}08)`,
                        border: `1px solid ${tab.accent}35`,
                        boxShadow: `0 0 20px ${tab.accent}10`,
                      }
                      : undefined
                  }
                >
                  <Icon className="w-4 h-4" style={isActive ? { color: tab.accent } : undefined} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <main className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start min-w-0">
            <SectionNav
              sections={filteredSections}
              activeSectionId={activeSectionId}
              onSectionChange={handleSectionChange}
            />

            <div className="min-w-0">
              {renderSectionContent()}
            </div>
          </main>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default SystemOverviewPage;
