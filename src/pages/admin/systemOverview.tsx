import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { Activity, AlertTriangle, Brain, Check, Copy, Cpu, Database, ExternalLink, Gamepad2, Layers, Link2, Loader2, Server, Share2, Smartphone, TestTube2, Trash2, Users } from 'lucide-react';
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
import CoachJourneyTab from '../../components/admin/system-overview/CoachJourneyTab';
import PulseClubActivationArchitectureTab from '../../components/admin/system-overview/PulseClubActivationArchitectureTab';
import SmartRoutesV1ArchitectureTab from '../../components/admin/system-overview/SmartRoutesV1ArchitectureTab';
import SharedLinkPreviewStrategyTab from '../../components/admin/system-overview/SharedLinkPreviewStrategyTab';
import PulseCheckRuntimeArchitectureTab from '../../components/admin/system-overview/PulseCheckRuntimeArchitectureTab';
import PulseCheckStateSignalLayerTab from '../../components/admin/system-overview/PulseCheckStateSignalLayerTab';
import PulseCheckStateSnapshotFreshnessPolicyTab from '../../components/admin/system-overview/PulseCheckStateSnapshotFreshnessPolicyTab';
import PulseCheckPerformanceStateFlagDefinitionsTab from '../../components/admin/system-overview/PulseCheckPerformanceStateFlagDefinitionsTab';
import PulseCheckNoraAssignmentRulesTab from '../../components/admin/system-overview/PulseCheckNoraAssignmentRulesTab';
import PulseCheckNoraQaEdgeCaseScenarioMatrixTab from '../../components/admin/system-overview/PulseCheckNoraQaEdgeCaseScenarioMatrixTab';
import PulseCheckStateEscalationOrchestrationTab from '../../components/admin/system-overview/PulseCheckStateEscalationOrchestrationTab';
import PulseCheckEscalationIntegrationSpecTab from '../../components/admin/system-overview/PulseCheckEscalationIntegrationSpecTab';
import PulseCheckTeamPilotCohortOnboardingArchitectureTab from '../../components/admin/system-overview/PulseCheckTeamPilotCohortOnboardingArchitectureTab';
import PulseCheckPermissionsVisibilityModelTab from '../../components/admin/system-overview/PulseCheckPermissionsVisibilityModelTab';
import PulseCheckCoachDashboardInformationArchitectureTab from '../../components/admin/system-overview/PulseCheckCoachDashboardInformationArchitectureTab';
import AuntEdnaIntegrationStrategyTab from '../../components/admin/system-overview/AuntEdnaIntegrationStrategyTab';
import PlaywrightTestingStrategyTab from '../../components/admin/system-overview/PlaywrightTestingStrategyTab';
import XCUITestingStrategyTab from '../../components/admin/system-overview/XCUITestingStrategyTab';
import { systemOverviewShareService } from '../../api/systemOverviewShare/service';
import type { SystemOverviewShareLink } from '../../api/systemOverviewShare/types';
import { systemOverviewManifest } from '../../content/system-overview/manifest';
import type { ConnectionType, EcosystemConnection, EcosystemNode } from '../../content/system-overview/schema';

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
    sectionIds: ['executive-summary', 'ecosystem-map', 'product-handbooks', 'pulse-club-activation-architecture', 'smart-routes-v1-architecture', 'shared-link-preview-strategy', 'backend-data', 'integrations', 'end-to-end-flows', 'ownership-release-matrix', 'risks-gaps', 'glossary'],
  },
  {
    id: 'pulsecheck',
    label: 'PulseCheck',
    icon: Brain,
    accent: '#c084fc',
    sectionIds: [
      'simulation-taxonomy',
      'sim-family-tree',
      'promotion-protocol',
      'sim-spec-standards',
      'variant-registry',
      'sim-family-specs',
      'athlete-journey',
      'coach-journey',
      'pulsecheck-runtime-architecture',
      'pulsecheck-state-signal-layer',
      'pulsecheck-state-snapshot-freshness-policy',
      'pulsecheck-performance-state-flag-definitions',
      'pulsecheck-nora-assignment-rules',
      'pulsecheck-nora-qa-edge-case-matrix',
      'pulsecheck-state-escalation-orchestration',
      'pulsecheck-escalation-integration-spec',
      'pulsecheck-team-pilot-cohort-onboarding-architecture',
      'pulsecheck-permissions-visibility-model',
      'pulsecheck-coach-dashboard-information-architecture',
    ],
  },
  {
    id: 'agent-swarm',
    label: 'Agent Swarm',
    icon: Cpu,
    accent: '#22c55e',
    sectionIds: ['agent-infrastructure-handbook'],
  },
  {
    id: 'auntedna',
    label: 'AuntEdna',
    icon: Link2,
    accent: '#f59e0b',
    sectionIds: ['auntedna-integration-strategy'],
  },
  {
    id: 'hunter-world',
    label: 'Hunter World',
    icon: Gamepad2,
    accent: '#facc15',
    sectionIds: ['hunter-world-handbook'],
  },
  {
    id: 'playwright',
    label: 'Playwright',
    icon: TestTube2,
    accent: '#34d399',
    sectionIds: ['playwright-testing-strategy'],
  },
  {
    id: 'xcuitest',
    label: 'XCUITest',
    icon: Smartphone,
    accent: '#f472b6',
    sectionIds: ['xcuitest-testing-strategy'],
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
  const [activeSystemId, setActiveSystemId] = useState<string>(SYSTEM_TABS[0].id);
  const [activeSectionId, setActiveSectionId] = useState<string>(systemOverviewManifest.sections[0]?.id || 'executive-summary');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [shareLinksLoading, setShareLinksLoading] = useState(false);
  const [shareCreating, setShareCreating] = useState(false);
  const [shareRevokingToken, setShareRevokingToken] = useState<string | null>(null);
  const [shareLinks, setShareLinks] = useState<SystemOverviewShareLink[]>([]);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharePasscodeEnabled, setSharePasscodeEnabled] = useState(false);
  const [sharePasscode, setSharePasscode] = useState('');
  const artifactContentRef = React.useRef<HTMLDivElement | null>(null);

  // Derive filtered sidebar sections for the active system tab
  const activeSystemTab = useMemo(() => SYSTEM_TABS.find((t) => t.id === activeSystemId) || SYSTEM_TABS[0], [activeSystemId]);
  const filteredSections = useMemo(
    () => systemOverviewManifest.sections.filter((s) => activeSystemTab.sectionIds.includes(s.id)),
    [activeSystemTab]
  );
  const activeSectionMeta = useMemo(
    () => systemOverviewManifest.sections.find((section) => section.id === activeSectionId),
    [activeSectionId]
  );

  // Read initial section from URL hash if present
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const matchingSection = systemOverviewManifest.sections.find((s) => s.id === hash);
      if (matchingSection) {
        setActiveSectionId(hash);
        // Also set the correct system tab
        setActiveSystemId(getSystemForSection(hash));
      }
    }
  }, []);

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

  const handleCopyActiveSection = async () => {
    const content = artifactContentRef.current?.innerText?.trim();
    if (!content) {
      setCopyState('error');
      return;
    }

    const headerLines = [
      systemOverviewManifest.title,
      activeSectionMeta?.label || activeSectionId,
      '',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(`${headerLines}${content}`);
      setCopyState('copied');
    } catch (error) {
      console.error('[SystemOverview] Failed to copy artifact text:', error);
      setCopyState('error');
    }
  };

  useEffect(() => {
    setCopyState('idle');
    setShareMenuOpen(false);
    setShareError(null);
    setSharePasscodeEnabled(false);
    setSharePasscode('');
  }, [activeSectionId]);

  useEffect(() => {
    if (copyState !== 'copied') return;
    const timeout = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  useEffect(() => {
    let cancelled = false;

    const loadShareLinks = async () => {
      if (!activeSectionId) return;
      setShareLinksLoading(true);
      setShareError(null);

      try {
        const links = await systemOverviewShareService.list(activeSectionId);
        if (!cancelled) {
          setShareLinks(links.filter((link) => !link.revokedAt));
        }
      } catch (error) {
        console.error('[SystemOverview] Failed to load share links:', error);
        if (!cancelled) {
          setShareLinks([]);
          setShareError('Failed to load share links.');
        }
      } finally {
        if (!cancelled) {
          setShareLinksLoading(false);
        }
      }
    };

    void loadShareLinks();

    return () => {
      cancelled = true;
    };
  }, [activeSectionId]);

  const handleCreateShareLink = async () => {
    const snapshotText = artifactContentRef.current?.innerText?.trim();
    if (!snapshotText || !activeSectionMeta) {
      setShareError('Nothing available to share.');
      return;
    }

    if (sharePasscodeEnabled && sharePasscode.trim().length < 4) {
      setShareError('Passcode must be at least 4 characters.');
      return;
    }

    setShareCreating(true);
    setShareError(null);

    try {
      const createdLink = await systemOverviewShareService.create({
        sectionId: activeSectionMeta.id,
        systemId: activeSystemId,
        sectionLabel: activeSectionMeta.label,
        sectionDescription: activeSectionMeta.description,
        snapshotText,
        passcode: sharePasscodeEnabled ? sharePasscode.trim() : '',
      });

      setShareLinks((current) => [createdLink, ...current]);
      await navigator.clipboard.writeText(createdLink.shareUrl);
      setSharePasscodeEnabled(false);
      setSharePasscode('');
    } catch (error) {
      console.error('[SystemOverview] Failed to create share link:', error);
      setShareError('Failed to create share link.');
    } finally {
      setShareCreating(false);
    }
  };

  const handleCopyShareLink = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (error) {
      console.error('[SystemOverview] Failed to copy share link:', error);
      setShareError('Failed to copy share link.');
    }
  };

  const handleRevokeShareLink = async (token: string) => {
    setShareRevokingToken(token);
    setShareError(null);

    try {
      await systemOverviewShareService.revoke(token);
      setShareLinks((current) => current.filter((link) => link.token !== token));
    } catch (error) {
      console.error('[SystemOverview] Failed to revoke share link:', error);
      setShareError('Failed to revoke share link.');
    } finally {
      setShareRevokingToken(null);
    }
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

      case 'pulse-club-activation-architecture':
        return <PulseClubActivationArchitectureTab />;

      case 'smart-routes-v1-architecture':
        return <SmartRoutesV1ArchitectureTab />;

      case 'shared-link-preview-strategy':
        return <SharedLinkPreviewStrategyTab />;

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

      case 'coach-journey':
        return <CoachJourneyTab />;

      case 'pulsecheck-runtime-architecture':
        return <PulseCheckRuntimeArchitectureTab />;

      case 'pulsecheck-state-signal-layer':
        return <PulseCheckStateSignalLayerTab />;

      case 'pulsecheck-state-snapshot-freshness-policy':
        return <PulseCheckStateSnapshotFreshnessPolicyTab />;

      case 'pulsecheck-performance-state-flag-definitions':
        return <PulseCheckPerformanceStateFlagDefinitionsTab />;

      case 'pulsecheck-nora-assignment-rules':
        return <PulseCheckNoraAssignmentRulesTab />;

      case 'pulsecheck-nora-qa-edge-case-matrix':
        return <PulseCheckNoraQaEdgeCaseScenarioMatrixTab />;

      case 'pulsecheck-state-escalation-orchestration':
        return <PulseCheckStateEscalationOrchestrationTab />;

      case 'pulsecheck-escalation-integration-spec':
        return <PulseCheckEscalationIntegrationSpecTab />;

      case 'pulsecheck-team-pilot-cohort-onboarding-architecture':
        return <PulseCheckTeamPilotCohortOnboardingArchitectureTab />;

      case 'pulsecheck-permissions-visibility-model':
        return <PulseCheckPermissionsVisibilityModelTab />;

      case 'pulsecheck-coach-dashboard-information-architecture':
        return <PulseCheckCoachDashboardInformationArchitectureTab />;

      case 'auntedna-integration-strategy':
        return <AuntEdnaIntegrationStrategyTab />;

      case 'playwright-testing-strategy':
        return <PlaywrightTestingStrategyTab />;

      case 'xcuitest-testing-strategy':
        return <XCUITestingStrategyTab />;

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
              <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-[#090f1c] p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Artifact Actions</p>
                  <p className="mt-1 text-sm font-semibold text-white">{activeSectionMeta?.label || 'Current Section'}</p>
                  {activeSectionMeta?.description ? (
                    <p className="mt-1 text-xs text-zinc-400">{activeSectionMeta.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  {copyState === 'error' ? (
                    <p className="text-xs text-red-400">Copy failed. Try again.</p>
                  ) : null}
                  {shareError ? (
                    <p className="text-xs text-red-400">{shareError}</p>
                  ) : null}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShareMenuOpen((current) => !current)}
                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-black/20 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>

                    {shareMenuOpen ? (
                      <div className="absolute right-0 z-30 mt-2 w-[360px] rounded-2xl border border-zinc-800 bg-[#090f1c] p-3 shadow-2xl">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">Share Links</p>
                            <p className="text-xs text-zinc-500">Each share creates a unique revocable public link.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleCreateShareLink()}
                            disabled={shareCreating}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {shareCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                            {shareCreating ? 'Creating...' : 'New Link'}
                          </button>
                        </div>

                        <div className="mt-3 space-y-2">
                          <div className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold text-white">Passcode Protection</p>
                                <p className="mt-1 text-[11px] text-zinc-500">
                                  Require a passcode before the shared artifact can be viewed.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSharePasscodeEnabled((current) => !current);
                                  setSharePasscode('');
                                }}
                                className={`inline-flex h-6 w-11 items-center rounded-full border transition ${
                                  sharePasscodeEnabled ? 'border-amber-400/40 bg-amber-500/20' : 'border-zinc-700 bg-black/20'
                                }`}
                              >
                                <span
                                  className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                                    sharePasscodeEnabled ? 'translate-x-5' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                            {sharePasscodeEnabled ? (
                              <label className="mt-3 block">
                                <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">Passcode</span>
                                <input
                                  type="password"
                                  value={sharePasscode}
                                  onChange={(event) => setSharePasscode(event.target.value.toUpperCase())}
                                  autoCapitalize="characters"
                                  autoCorrect="off"
                                  spellCheck={false}
                                  className="w-full rounded-lg border border-zinc-700 bg-black/20 px-3 py-2 text-xs text-white outline-none transition focus:border-amber-400"
                                  placeholder="Set passcode"
                                />
                              </label>
                            ) : null}
                          </div>

                          {shareLinksLoading ? (
                            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-black/20 px-3 py-3 text-xs text-zinc-400">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Loading share links...
                            </div>
                          ) : shareLinks.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-zinc-700 bg-black/10 px-3 py-3 text-xs text-zinc-500">
                              No active share links for this artifact.
                            </div>
                          ) : (
                            shareLinks.map((link) => (
                              <div key={link.token} className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-3">
                                <p className="truncate text-xs font-medium text-white">{link.shareUrl}</p>
                                <p className="mt-1 text-[11px] text-zinc-500">
                                  Created {link.createdAt ? new Date(link.createdAt).toLocaleString() : 'just now'}
                                </p>
                                {link.passcodeProtected ? (
                                  <p className="mt-1 text-[11px] text-amber-300">Passcode protected</p>
                                ) : null}
                                <div className="mt-3 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleCopyShareLink(link.shareUrl)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[11px] text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    Copy
                                  </button>
                                  <a
                                    href={link.shareUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[11px] text-zinc-200 transition hover:border-zinc-500 hover:text-white"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Open
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => void handleRevokeShareLink(link.token)}
                                    disabled={shareRevokingToken === link.token}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 px-2.5 py-1.5 text-[11px] text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {shareRevokingToken === link.token ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                    Revoke
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyActiveSection}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                      copyState === 'copied'
                        ? 'border-green-500/30 bg-green-500/10 text-green-200'
                        : 'border-zinc-700 bg-black/20 text-zinc-200 hover:border-zinc-500 hover:text-white'
                    }`}
                  >
                    {copyState === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copyState === 'copied' ? 'Copied' : 'Copy to Clipboard'}
                  </button>
                </div>
              </div>

              <div ref={artifactContentRef}>
                {renderSectionContent()}
              </div>
            </div>
          </main>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default SystemOverviewPage;
