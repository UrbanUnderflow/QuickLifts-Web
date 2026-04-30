import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import {
  Activity,
  AlertTriangle,
  Bell,
  Brain,
  Check,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  Gamepad2,
  Layers,
  Link2,
  Loader2,
  MessageSquareQuote,
  Search,
  Server,
  Share2,
  ShieldCheck,
  Smartphone,
  TestTube2,
  Trash2,
  Utensils,
  Users,
  X,
} from "lucide-react";
import AdminRouteGuard from "../../components/auth/AdminRouteGuard";
import SectionNav from "../../components/admin/system-overview/SectionNav";
import ProductHandbook from "../../components/admin/system-overview/ProductHandbook";
import MacraSystemOverviewTab from "../../components/admin/system-overview/MacraSystemOverviewTab";
import HeartbeatProtocolTab from "../../components/admin/HeartbeatProtocolTab";
import HunterWorldTab from "../../components/admin/HunterWorldTab";
import SimulationTaxonomyTab from "../../components/admin/system-overview/SimulationTaxonomyTab";
import SimFamilyTreeTab from "../../components/admin/system-overview/SimFamilyTreeTab";
import PromotionProtocolTab from "../../components/admin/system-overview/PromotionProtocolTab";
import SimSpecStandardsTab from "../../components/admin/system-overview/SimSpecStandardsTab";
import VariantRegistryTab from "../../components/admin/system-overview/VariantRegistryTab";
import ProtocolRegistryTab from "../../components/admin/system-overview/ProtocolRegistryTab";
import PulseCheckProtocolGovernanceSpecTab from "../../components/admin/system-overview/PulseCheckProtocolGovernanceSpecTab";
import PulseCheckProtocolAuthoringWorkflowTab from "../../components/admin/system-overview/PulseCheckProtocolAuthoringWorkflowTab";
import PulseCheckProtocolResponsivenessProfileSpecTab from "../../components/admin/system-overview/PulseCheckProtocolResponsivenessProfileSpecTab";
import PulseCheckProtocolResponsivenessInspectorTab from "../../components/admin/system-overview/PulseCheckProtocolResponsivenessInspectorTab";
import PulseCheckProtocolLaunchReadinessTab from "../../components/admin/system-overview/PulseCheckProtocolLaunchReadinessTab";
import PulseCheckProtocolPlannerPolicyEnforcementTab from "../../components/admin/system-overview/PulseCheckProtocolPlannerPolicyEnforcementTab";
import PulseCheckProtocolPracticeConversationSpecTab from "../../components/admin/system-overview/PulseCheckProtocolPracticeConversationSpecTab";
import PulseCheckProtocolEvidenceDashboardTab from "../../components/admin/system-overview/PulseCheckProtocolEvidenceDashboardTab";
import PulseCheckProtocolRevisionAuditTraceTab from "../../components/admin/system-overview/PulseCheckProtocolRevisionAuditTraceTab";
import PulseCheckProtocolOpsRunbookTab from "../../components/admin/system-overview/PulseCheckProtocolOpsRunbookTab";
import PulseCheckProtocolLaunchQaMatrixTab from "../../components/admin/system-overview/PulseCheckProtocolLaunchQaMatrixTab";
import SimFamilySpecTab from "../../components/admin/system-overview/SimFamilySpecTab";
import AthleteJourneyTab from "../../components/admin/system-overview/AthleteJourneyTab";
import CoachJourneyTab from "../../components/admin/system-overview/CoachJourneyTab";
import PulseClubActivationArchitectureTab from "../../components/admin/system-overview/PulseClubActivationArchitectureTab";
import SmartRoutesV1ArchitectureTab from "../../components/admin/system-overview/SmartRoutesV1ArchitectureTab";
import SharedLinkPreviewStrategyTab from "../../components/admin/system-overview/SharedLinkPreviewStrategyTab";
import PulseCheckRuntimeArchitectureTab from "../../components/admin/system-overview/PulseCheckRuntimeArchitectureTab";
import PulseCheckStateSignalLayerTab from "../../components/admin/system-overview/PulseCheckStateSignalLayerTab";
import PulseCheckCheckInSignalLayerIntegrationSpecTab from "../../components/admin/system-overview/PulseCheckCheckInSignalLayerIntegrationSpecTab";
import PulseCheckDailyTaskTrainingPlanAlignmentSpecTab from "../../components/admin/system-overview/PulseCheckDailyTaskTrainingPlanAlignmentSpecTab";
import PulseCheckTrainingPlanAuthoringSpecTab from "../../components/admin/system-overview/PulseCheckTrainingPlanAuthoringSpecTab";
import PulseCheckHealthChatArchitectureTab from "../../components/admin/system-overview/PulseCheckHealthChatArchitectureTab";
import PulseCheckAthleteHealthContextSnapshotSpecTab from "../../components/admin/system-overview/PulseCheckAthleteHealthContextSnapshotSpecTab";
import PulseCheckHealthContextSourceRecordSpecTab from "../../components/admin/system-overview/PulseCheckHealthContextSourceRecordSpecTab";
import PulseCheckHealthContextSnapshotAssemblerSpecTab from "../../components/admin/system-overview/PulseCheckHealthContextSnapshotAssemblerSpecTab";
import PulseCheckHealthContextPersistenceStorageSpecTab from "../../components/admin/system-overview/PulseCheckHealthContextPersistenceStorageSpecTab";
import PulseCheckHealthContextOperationalOrchestrationSpecTab from "../../components/admin/system-overview/PulseCheckHealthContextOperationalOrchestrationSpecTab";
import PulseCheckHealthContextImplementationRolloutPlanTab from "../../components/admin/system-overview/PulseCheckHealthContextImplementationRolloutPlanTab";
import PulseCheckHealthContextOperatorRunbookTab from "../../components/admin/system-overview/PulseCheckHealthContextOperatorRunbookTab";
import PulseCheckHealthContextDefinitionOfDoneTab from "../../components/admin/system-overview/PulseCheckHealthContextDefinitionOfDoneTab";
import PulseCheckHealthContextEngineeringTaskBreakdownTab from "../../components/admin/system-overview/PulseCheckHealthContextEngineeringTaskBreakdownTab";
import PulseCheckHealthContextFirestoreSchemaIndexSpecTab from "../../components/admin/system-overview/PulseCheckHealthContextFirestoreSchemaIndexSpecTab";
import PulseCheckPhysiologyCognitionCorrelationEngineTab from "../../components/admin/system-overview/PulseCheckPhysiologyCognitionCorrelationEngineTab";
import PulseCheckCorrelationEngineContractLockTab from "../../components/admin/system-overview/PulseCheckCorrelationEngineContractLockTab";
import PulseCheckSportsIntelligenceLayerSpecTab from "../../components/admin/system-overview/PulseCheckSportsIntelligenceLayerSpecTab";
import PulseCheckCurriculumLayerSpecTab from "../../components/admin/system-overview/PulseCheckCurriculumLayerSpecTab";
import PulseCheckSportsIntelligenceAggregationInferenceContractTab from "../../components/admin/system-overview/PulseCheckSportsIntelligenceAggregationInferenceContractTab";
import PulseCheckSportsIntelligenceMockReportBaselinesTab from "../../components/admin/system-overview/PulseCheckSportsIntelligenceMockReportBaselinesTab";
import PulseCheckNoraContextCaptureSpecTab from "../../components/admin/system-overview/PulseCheckNoraContextCaptureSpecTab";
import PulseCheckSessionDetectionMatchingSpecTab from "../../components/admin/system-overview/PulseCheckSessionDetectionMatchingSpecTab";
import PulseCheckSportLoadModelSpecTab from "../../components/admin/system-overview/PulseCheckSportLoadModelSpecTab";
import PulseCheckCorrelationDataModelSpecTab from "../../components/admin/system-overview/PulseCheckCorrelationDataModelSpecTab";
import PulseCheckCorrelationEngineEngineeringTaskBreakdownTab from "../../components/admin/system-overview/PulseCheckCorrelationEngineEngineeringTaskBreakdownTab";
import PulseCheckCorrelationEnginePilotDashboardTab from "../../components/admin/system-overview/PulseCheckCorrelationEnginePilotDashboardTab";
import PulseCheckCorrelationEnginePilotDashboardAddendumTab from "../../components/admin/system-overview/PulseCheckCorrelationEnginePilotDashboardAddendumTab";
import PulseCheckCorrelationEnginePilotOpsRunbookTab from "../../components/admin/system-overview/PulseCheckCorrelationEnginePilotOpsRunbookTab";
import PulseCheckCorrelationEnginePilotResearchReadoutTab from "../../components/admin/system-overview/PulseCheckCorrelationEnginePilotResearchReadoutTab";
import PulseCheckPilotOutcomeMetricsContractTab from "../../components/admin/system-overview/PulseCheckPilotOutcomeMetricsContractTab";
import PulseCheckOuraIntegrationStrategyTab from "../../components/admin/system-overview/PulseCheckOuraIntegrationStrategyTab";
import PulseCheckOuraCognitiveCorrelationSpecTab from "../../components/admin/system-overview/PulseCheckOuraCognitiveCorrelationSpecTab";
import PulseCheckDeviceIntegrationStrategyTab from "../../components/admin/system-overview/PulseCheckDeviceIntegrationStrategyTab";
import PulseCheckDeviceIntegrationPartnershipMatrixTab from "../../components/admin/system-overview/PulseCheckDeviceIntegrationPartnershipMatrixTab";
import PulseCheckSchoolWearableBundlePlanTab from "../../components/admin/system-overview/PulseCheckSchoolWearableBundlePlanTab";
import PulseCheckPatentEligibilityAuditTab from "../../components/admin/system-overview/PulseCheckPatentEligibilityAuditTab";
import FirestoreIndexRegistryTab from "../../components/admin/system-overview/FirestoreIndexRegistryTab";
import InfrastructureSecretsStackTab from "../../components/admin/system-overview/InfrastructureSecretsStackTab";
import FirebaseAdminCredentialArchitectureTab from "../../components/admin/system-overview/FirebaseAdminCredentialArchitectureTab";
import PulseCheckStateSnapshotFreshnessPolicyTab from "../../components/admin/system-overview/PulseCheckStateSnapshotFreshnessPolicyTab";
import PulseCheckPerformanceStateFlagDefinitionsTab from "../../components/admin/system-overview/PulseCheckPerformanceStateFlagDefinitionsTab";
import PulseCheckNoraAssignmentRulesTab from "../../components/admin/system-overview/PulseCheckNoraAssignmentRulesTab";
import PulseCheckNoraQaEdgeCaseScenarioMatrixTab from "../../components/admin/system-overview/PulseCheckNoraQaEdgeCaseScenarioMatrixTab";
import PulseCheckStateEscalationOrchestrationTab from "../../components/admin/system-overview/PulseCheckStateEscalationOrchestrationTab";
import PulseCheckEscalationIntegrationSpecTab from "../../components/admin/system-overview/PulseCheckEscalationIntegrationSpecTab";
import PulseCheckMemberOnboardingGuideTab from "../../components/admin/system-overview/PulseCheckMemberOnboardingGuideTab";
import PulseCheckTeamPilotCohortOnboardingArchitectureTab from "../../components/admin/system-overview/PulseCheckTeamPilotCohortOnboardingArchitectureTab";
import PulseCheckPermissionsVisibilityModelTab from "../../components/admin/system-overview/PulseCheckPermissionsVisibilityModelTab";
import PulseCheckCoachDashboardInformationArchitectureTab from "../../components/admin/system-overview/PulseCheckCoachDashboardInformationArchitectureTab";
import PulseCheckProfileArchitectureTab from "../../components/admin/system-overview/PulseCheckProfileArchitectureTab";
import PulseCheckProfileSnapshotExportSpecTab from "../../components/admin/system-overview/PulseCheckProfileSnapshotExportSpecTab";
import PulseCheckAthleteShowroomAvatarTab from "../../components/admin/system-overview/PulseCheckAthleteShowroomAvatarTab";
import QuickLiftsProfileHealthSystemTab, {
  QuickLiftsProfileHealthEnergyMergeSpecTab,
  QuickLiftsProfileHealthSnapshotContractTab,
  QuickLiftsProfileHealthStorySpecTab,
} from "../../components/admin/system-overview/QuickLiftsProfileHealthSystemTab";
import PulseCheckVisionProImmersiveTestsTab from "../../components/admin/system-overview/PulseCheckVisionProImmersiveTestsTab";
import PulseSystemDesignLanguageTab from "../../components/admin/system-overview/PulseSystemDesignLanguageTab";
import AuntEdnaIntegrationStrategyTab from "../../components/admin/system-overview/AuntEdnaIntegrationStrategyTab";
import AuntEdnaPilotAuthorizationMemoTab from "../../components/admin/system-overview/AuntEdnaPilotAuthorizationMemoTab";
import AuntEdnaExhibitATab from "../../components/admin/system-overview/AuntEdnaExhibitATab";
import AuntEdnaExhibitBTab from "../../components/admin/system-overview/AuntEdnaExhibitBTab";
import { AgentOutcomeRubricSpecTab } from "../../components/admin/system-overview/AgentOutcomeSystemTabs";
import SystemTestCoverageTab from "../../components/admin/system-overview/SystemTestCoverageTab";
import PlaywrightTestingStrategyTab from "../../components/admin/system-overview/PlaywrightTestingStrategyTab";
import AndroidTestingStrategyTab from "../../components/admin/system-overview/AndroidTestingStrategyTab";
import XCUITestingStrategyTab from "../../components/admin/system-overview/XCUITestingStrategyTab";
import { systemOverviewShareService } from "../../api/systemOverviewShare/service";
import type { SystemOverviewShareLink } from "../../api/systemOverviewShare/types";
import { systemOverviewManifest } from "../../content/system-overview/manifest";
import type {
  ConnectionType,
  EcosystemConnection,
  EcosystemNode,
} from "../../content/system-overview/schema";

const CONNECTION_COLORS: Record<ConnectionType, string> = {
  data: "#38bdf8",
  auth: "#a78bfa",
  events: "#facc15",
};

const LAYER_STYLES: Record<EcosystemNode["layer"], string> = {
  surface: "bg-blue-500/10 border-blue-400/40",
  backend: "bg-purple-500/10 border-purple-400/40",
  integration: "bg-amber-500/10 border-amber-400/40",
  agent: "bg-green-500/10 border-green-400/40",
};

const PRODUCT_POSITIONING = [
  {
    title: "Fit With Pulse",
    eyebrow: "Consumer health + fitness",
    icon: Users,
    accent: "border-blue-400/25 bg-blue-400/[0.06] text-blue-200",
    body:
      "The external consumer surface for workouts, clubs, rounds, creators, profile health, and social accountability. QuickLifts remains the repo/internal lineage name.",
  },
  {
    title: "Pulse Check",
    eyebrow: "Elite athlete service tech",
    icon: Brain,
    accent: "border-violet-400/25 bg-violet-400/[0.06] text-violet-200",
    body:
      "White-glove mental performance, readiness, protocols, simulations, coach visibility, team pilots, and operator-facing athlete support.",
  },
  {
    title: "Macra",
    eyebrow: "Nutrition",
    icon: Utensils,
    accent: "border-lime-400/25 bg-lime-400/[0.06] text-lime-200",
    body:
      "Dedicated nutrition AI surface for macros, food journaling, meal scans, label scans, meal planning, supplements, and Nora nutrition chat.",
  },
  {
    title: "Web + Admin",
    eyebrow: "Platform operations",
    icon: Server,
    accent: "border-cyan-400/25 bg-cyan-400/[0.06] text-cyan-200",
    body:
      "The QuickLifts-Web repo powers public web, admin operations, bridge functions, provisioning, system docs, and internal command surfaces.",
  },
];

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
    id: "pulse-community",
    label: "Fit With Pulse",
    icon: Users,
    accent: "#60a5fa",
    sectionIds: [
      "executive-summary",
      "ecosystem-map",
      "product-handbooks",
      "quicklifts-profile-health-system",
      "quicklifts-profile-health-story-spec",
      "quicklifts-profile-health-snapshot-contract",
      "quicklifts-profile-health-energy-merge-spec",
      "pulse-club-activation-architecture",
      "smart-routes-v1-architecture",
      "shared-link-preview-strategy",
      "notification-systems-architecture",
      "workout-share-cards",
      "backend-data",
      "infrastructure-secrets-stack",
      "firebase-admin-credential-architecture",
      "firestore-index-registry",
      "integrations",
      "end-to-end-flows",
      "ownership-release-matrix",
      "risks-gaps",
      "glossary",
    ],
  },
  {
    id: "macra",
    label: "Macra",
    icon: Utensils,
    accent: "#d9f99d",
    sectionIds: ["macra-system-overview"],
  },
  {
    id: "pulsecheck",
    label: "Pulse Check",
    icon: Brain,
    accent: "#c084fc",
    sectionIds: [
      "simulation-taxonomy",
      "sim-family-tree",
      "promotion-protocol",
      "sim-spec-standards",
      "variant-registry",
      "protocol-registry",
      "pulsecheck-protocol-governance-spec",
      "pulsecheck-protocol-authoring-workflow",
      "pulsecheck-protocol-responsiveness-profile-spec",
      "pulsecheck-protocol-responsiveness-inspector",
      "pulsecheck-protocol-launch-readiness",
      "pulsecheck-protocol-planner-policy-enforcement",
      "pulsecheck-protocol-practice-conversation-spec",
      "pulsecheck-protocol-evidence-dashboard",
      "pulsecheck-protocol-revision-audit-trace",
      "pulsecheck-protocol-ops-runbook",
      "pulsecheck-protocol-launch-qa-matrix",
      "sim-family-specs",
      "athlete-journey",
      "coach-journey",
      "notification-systems-architecture",
      "pulsecheck-runtime-architecture",
      "pulsecheck-state-signal-layer",
      "pulsecheck-checkin-signal-layer-integration-spec",
      "pulsecheck-daily-task-training-plan-alignment-spec",
      "pulsecheck-training-plan-authoring-spec",
      "pulsecheck-health-chat-architecture",
      "pulsecheck-athlete-health-context-snapshot-spec",
      "pulsecheck-health-context-source-record-spec",
      "pulsecheck-health-context-snapshot-assembler-spec",
      "pulsecheck-health-context-persistence-storage-spec",
      "pulsecheck-health-context-operational-orchestration-spec",
      "pulsecheck-health-context-implementation-rollout-plan",
      "pulsecheck-health-context-operator-runbook",
      "pulsecheck-health-context-definition-of-done",
      "pulsecheck-health-context-engineering-task-breakdown",
      "pulsecheck-health-context-firestore-schema-index-spec",
      "pulsecheck-physiology-cognition-correlation-engine",
      "pulsecheck-correlation-engine-contract-lock",
      "pulsecheck-correlation-data-model-spec",
      "pulsecheck-correlation-engine-engineering-task-breakdown",
      "pulsecheck-correlation-engine-pilot-dashboard",
      "pulsecheck-correlation-engine-pilot-dashboard-addendum",
      "pulsecheck-pilot-outcome-metrics-contract",
      "pulsecheck-correlation-engine-pilot-ops-runbook",
      "pulsecheck-correlation-engine-pilot-research-readout",
      "pulsecheck-oura-integration-strategy",
      "pulsecheck-oura-cognitive-correlation-spec",
      "pulsecheck-sports-intelligence-layer-spec",
      "pulsecheck-sports-intelligence-aggregation-inference-contract",
      "pulsecheck-sports-intelligence-mock-report-baselines",
      "pulsecheck-curriculum-layer-spec",
      "pulsecheck-nora-context-capture",
      "pulsecheck-session-detection-matching",
      "pulsecheck-sport-load-model",
      "pulsecheck-device-integration-strategy",
      "pulsecheck-device-integration-partnership-matrix",
      "pulsecheck-school-wearable-bundle-plan",
      "pulsecheck-patent-eligibility-audit",
      "pulsecheck-state-snapshot-freshness-policy",
      "pulsecheck-performance-state-flag-definitions",
      "pulsecheck-nora-assignment-rules",
      "pulsecheck-nora-qa-edge-case-matrix",
      "pulsecheck-state-escalation-orchestration",
      "pulsecheck-escalation-integration-spec",
      "pulsecheck-member-onboarding-guide",
      "pulsecheck-team-pilot-cohort-onboarding-architecture",
      "pulsecheck-permissions-visibility-model",
      "pulsecheck-coach-dashboard-information-architecture",
      "pulsecheck-profile-architecture",
      "pulsecheck-profile-snapshot-export-spec",
      "pulsecheck-athlete-showroom-avatar",
      "pulsecheck-vision-pro-immersive-tests",
    ],
  },
  {
    id: "design-language",
    label: "Design Language",
    icon: MessageSquareQuote,
    accent: "#f97316",
    sectionIds: ["system-design-language"],
  },
  {
    id: "agent-swarm",
    label: "Agent Swarm",
    icon: Cpu,
    accent: "#22c55e",
    sectionIds: ["agent-infrastructure-handbook", "agent-outcome-rubric-spec"],
  },
  {
    id: "auntedna",
    label: "AuntEdna",
    icon: Link2,
    accent: "#f59e0b",
    sectionIds: [
      "auntedna-integration-strategy",
      "auntedna-pilot-authorization-memo",
      "auntedna-exhibit-a-data-architecture",
      "auntedna-exhibit-b-performance-standards",
    ],
  },
  {
    id: "system-test-coverage",
    label: "Coverage",
    icon: ShieldCheck,
    accent: "#22d3ee",
    sectionIds: ["system-test-coverage"],
  },
  {
    id: "hunter-world",
    label: "Hunter World",
    icon: Gamepad2,
    accent: "#facc15",
    sectionIds: ["hunter-world-handbook"],
  },
  {
    id: "playwright",
    label: "Playwright",
    icon: TestTube2,
    accent: "#34d399",
    sectionIds: ["playwright-testing-strategy"],
  },
  {
    id: "android-test",
    label: "Android",
    icon: Activity,
    accent: "#84cc16",
    sectionIds: ["android-testing-strategy"],
  },
  {
    id: "xcuitest",
    label: "XCUITest",
    icon: Smartphone,
    accent: "#f472b6",
    sectionIds: ["xcuitest-testing-strategy"],
  },
];

/* Find which system tab a given section belongs to */
function getSystemForSection(sectionId: string): string {
  for (const tab of SYSTEM_TABS) {
    if (tab.sectionIds.includes(sectionId)) return tab.id;
  }
  const section = systemOverviewManifest.sections.find((item) => item.id === sectionId);
  if (section?.parentSectionId) {
    return getSystemForSection(section.parentSectionId);
  }
  return SYSTEM_TABS[0].id;
}

function getArtifactRootSectionId(sectionId: string): string {
  const section = systemOverviewManifest.sections.find((item) => item.id === sectionId);
  return section?.parentSectionId ?? sectionId;
}

function EcosystemMap({
  nodes,
  connections,
}: {
  nodes: EcosystemNode[];
  connections: EcosystemConnection[];
}) {
  const nodeMap = useMemo(
    () => Object.fromEntries(nodes.map((node) => [node.id, node])),
    [nodes],
  );

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
          <marker
            id="map-arrowhead"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
            fill="#f8fafc"
          >
            <path d="M0,0 L0,6 L6,3 z" />
          </marker>
        </defs>
      </svg>
      {nodes.map((node) => (
        <div
          key={node.id}
          className={`absolute px-3 py-2 rounded-xl text-left text-xs border shadow-lg ${LAYER_STYLES[node.layer]}`}
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            transform: "translate(-50%, -50%)",
          }}
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
  const [activeSystemId, setActiveSystemId] = useState<string>(
    SYSTEM_TABS[0].id,
  );
  const [activeSectionId, setActiveSectionId] = useState<string>(
    systemOverviewManifest.sections[0]?.id || "executive-summary",
  );
  const [handbookSearchQuery, setHandbookSearchQuery] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [shareLinksLoading, setShareLinksLoading] = useState(false);
  const [shareCreating, setShareCreating] = useState(false);
  const [shareRevokingToken, setShareRevokingToken] = useState<string | null>(
    null,
  );
  const [shareLinks, setShareLinks] = useState<SystemOverviewShareLink[]>([]);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharePasscodeEnabled, setSharePasscodeEnabled] = useState(false);
  const [sharePasscode, setSharePasscode] = useState("");
  const artifactContentRef = React.useRef<HTMLDivElement | null>(null);

  // Derive filtered sidebar sections for the active system tab
  const activeSystemTab = useMemo(
    () => SYSTEM_TABS.find((t) => t.id === activeSystemId) || SYSTEM_TABS[0],
    [activeSystemId],
  );
  const filteredSections = useMemo(
    () =>
      systemOverviewManifest.sections.filter((s) =>
        activeSystemTab.sectionIds.includes(s.id) ||
        Boolean(
          s.parentSectionId &&
            activeSystemTab.sectionIds.includes(s.parentSectionId),
        ),
      ),
    [activeSystemTab],
  );
  const trimmedHandbookSearchQuery = handbookSearchQuery.trim();
  const normalizedHandbookSearchQuery =
    trimmedHandbookSearchQuery.toLowerCase();
  const handbookSearchIndex = useMemo(
    () =>
      systemOverviewManifest.sections
      .filter((section) => !section.parentSectionId)
      .map((section) => {
        const childSections = systemOverviewManifest.sections.filter(
          (candidate) => candidate.parentSectionId === section.id,
        );
        const systemId = getSystemForSection(section.id);
        const systemTab =
          SYSTEM_TABS.find((tab) => tab.id === systemId) || SYSTEM_TABS[0];
        const searchTerms = [
          section.label,
          section.description,
          section.id.replace(/-/g, " "),
          systemTab.label,
          ...childSections.flatMap((child) => [
            child.label,
            child.description,
            child.id.replace(/-/g, " "),
          ]),
        ];

        switch (section.id) {
          case "product-handbooks":
            searchTerms.push(
              ...systemOverviewManifest.products.map((product) => product.name),
              ...systemOverviewManifest.products.flatMap((product) =>
                product.featureInventory.map((feature) => feature.name),
              ),
            );
            break;
          case "backend-data":
            searchTerms.push(
              ...systemOverviewManifest.backendServices.map(
                (service) => service.name,
              ),
              ...systemOverviewManifest.dataCollections.map(
                (collection) => collection.name,
              ),
            );
            break;
          case "integrations":
            searchTerms.push(
              ...systemOverviewManifest.integrations.map(
                (integration) => integration.name,
              ),
            );
            break;
          case "end-to-end-flows":
            searchTerms.push(
              ...systemOverviewManifest.flows.map((flow) => flow.name),
            );
            break;
          case "notification-systems-architecture":
            searchTerms.push(
              "notifications",
              "push notifications",
              "local notifications",
              "FCM",
              "APNS",
              "notification sequences",
              "Fit With Pulse",
              "Pulse Check",
              "pulseCheckFcmToken",
              "fcmToken",
              "pushTokenSourceApp",
            );
            break;
          case "ownership-release-matrix":
            searchTerms.push(
              ...systemOverviewManifest.ownershipMatrix.map(
                (owner) => owner.domain,
              ),
            );
            break;
          case "risks-gaps":
            searchTerms.push(
              ...systemOverviewManifest.risksAndGaps.map((risk) => risk.title),
            );
            break;
          case "glossary":
            searchTerms.push(
              ...systemOverviewManifest.glossary.map((term) => term.term),
            );
            break;
          default:
            break;
        }

        return {
          section,
          systemId,
          systemLabel: systemTab.label,
          searchText: searchTerms.join(" ").toLowerCase(),
        };
      }),
    [],
  );
  const handbookSearchResults = useMemo(() => {
    if (!normalizedHandbookSearchQuery) return [];

    const queryTerms = normalizedHandbookSearchQuery
      .split(/\s+/)
      .filter(Boolean);

    return handbookSearchIndex
      .map((item) => {
        const label = item.section.label.toLowerCase();
        const description = item.section.description.toLowerCase();
        const idText = item.section.id.replace(/-/g, " ").toLowerCase();
        let score = 0;

        if (label.startsWith(normalizedHandbookSearchQuery)) score += 7;
        else if (label.includes(normalizedHandbookSearchQuery)) score += 5;

        if (description.includes(normalizedHandbookSearchQuery)) score += 3;
        if (idText.includes(normalizedHandbookSearchQuery)) score += 2;

        score += queryTerms.reduce(
          (total, term) => total + (item.searchText.includes(term) ? 1 : 0),
          0,
        );

        if (score === 0) return null;

        return {
          ...item,
          score,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.section.label.localeCompare(right.section.label),
      );
  }, [handbookSearchIndex, normalizedHandbookSearchQuery]);
  const sidebarSections = useMemo(
    () =>
      normalizedHandbookSearchQuery
        ? handbookSearchResults.map((result) => result.section)
        : filteredSections,
    [filteredSections, handbookSearchResults, normalizedHandbookSearchQuery],
  );
  const activeSectionMeta = useMemo(
    () =>
      systemOverviewManifest.sections.find(
        (section) => section.id === activeSectionId,
      ),
    [activeSectionId],
  );
  const isPlaywrightSystem = activeSystemId === "playwright";

  // Read initial section from URL hash if present
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const matchingSection = systemOverviewManifest.sections.find(
        (s) => s.id === hash,
      );
      if (matchingSection) {
        setActiveSectionId(hash);
        // Also set the correct system tab
        setActiveSystemId(getSystemForSection(hash));
      }
    }
  }, []);

  useEffect(() => {
    const handleRelatedDocumentNavigation = (event: Event) => {
      const sectionId = (event as CustomEvent<{ sectionId?: string }>).detail?.sectionId;
      if (!sectionId) return;

      const matchingSection = systemOverviewManifest.sections.find(
        (section) => section.id === sectionId,
      );
      if (!matchingSection) return;

      setActiveSystemId(getSystemForSection(sectionId));
      setActiveSectionId(sectionId);
      window.history.replaceState(null, "", `#${sectionId}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    window.addEventListener(
      "system-overview:navigate-section",
      handleRelatedDocumentNavigation,
    );

    return () => {
      window.removeEventListener(
        "system-overview:navigate-section",
        handleRelatedDocumentNavigation,
      );
    };
  }, []);

  const handleSystemChange = (systemId: string) => {
    setActiveSystemId(systemId);
    // Auto-select the first section in the new system
    const tab = SYSTEM_TABS.find((t) => t.id === systemId);
    if (tab && tab.sectionIds.length > 0) {
      const firstSectionId = tab.sectionIds[0];
      setActiveSectionId(firstSectionId);
      window.history.replaceState(null, "", `#${firstSectionId}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSectionChange = (sectionId: string) => {
    setActiveSectionId(sectionId);
    // Update URL hash without scrolling
    window.history.replaceState(null, "", `#${sectionId}`);
    // Scroll to top of content area
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleHandbookSearchResultSelect = (sectionId: string) => {
    const rootSectionId = getArtifactRootSectionId(sectionId);
    setActiveSystemId(getSystemForSection(rootSectionId));
    handleSectionChange(rootSectionId);
  };

  const handleHandbookSearchSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const bestMatch = handbookSearchResults[0];
    if (!bestMatch) return;
    handleHandbookSearchResultSelect(bestMatch.section.id);
  };

  const handleCopyActiveSection = async () => {
    const content = artifactContentRef.current?.innerText?.trim();
    if (!content) {
      setCopyState("error");
      return;
    }

    const headerLines = [
      systemOverviewManifest.title,
      activeSectionMeta?.label || activeSectionId,
      "",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(`${headerLines}${content}`);
      setCopyState("copied");
    } catch (error) {
      console.error("[SystemOverview] Failed to copy artifact text:", error);
      setCopyState("error");
    }
  };

  useEffect(() => {
    setCopyState("idle");
    setShareMenuOpen(false);
    setShareLinks([]);
    setShareLinksLoading(false);
    setShareError(null);
    setSharePasscodeEnabled(false);
    setSharePasscode("");
  }, [activeSectionId]);

  useEffect(() => {
    if (copyState !== "copied") return;
    const timeout = window.setTimeout(() => setCopyState("idle"), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  useEffect(() => {
    let cancelled = false;

    const loadShareLinks = async () => {
      if (!activeSectionId || !shareMenuOpen) return;
      setShareLinksLoading(true);
      setShareError(null);

      try {
        const links = await systemOverviewShareService.list(activeSectionId);
        if (!cancelled) {
          setShareLinks(links.filter((link) => !link.revokedAt));
        }
      } catch (error) {
        console.error("[SystemOverview] Failed to load share links:", error);
        if (!cancelled) {
          setShareLinks([]);
          setShareError("Failed to load share links.");
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
  }, [activeSectionId, shareMenuOpen]);

  const handleCreateShareLink = async () => {
    const snapshotText = artifactContentRef.current?.innerText?.trim();
    if (!snapshotText || !activeSectionMeta) {
      setShareError("Nothing available to share.");
      return;
    }

    if (sharePasscodeEnabled && sharePasscode.trim().length < 4) {
      setShareError("Passcode must be at least 4 characters.");
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
        passcode: sharePasscodeEnabled ? sharePasscode.trim() : "",
      });

      setShareLinks((current) => [createdLink, ...current]);
      await navigator.clipboard.writeText(createdLink.shareUrl);
      setSharePasscodeEnabled(false);
      setSharePasscode("");
    } catch (error) {
      console.error("[SystemOverview] Failed to create share link:", error);
      setShareError("Failed to create share link.");
    } finally {
      setShareCreating(false);
    }
  };

  const handleCopyShareLink = async (shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (error) {
      console.error("[SystemOverview] Failed to copy share link:", error);
      setShareError("Failed to copy share link.");
    }
  };

  const handleRevokeShareLink = async (token: string) => {
    setShareRevokingToken(token);
    setShareError(null);

    try {
      await systemOverviewShareService.revoke(token);
      setShareLinks((current) =>
        current.filter((link) => link.token !== token),
      );
    } catch (error) {
      console.error("[SystemOverview] Failed to revoke share link:", error);
      setShareError("Failed to revoke share link.");
    } finally {
      setShareRevokingToken(null);
    }
  };

  const summaryCards = useMemo(
    () => [
      {
        title: "Products",
        value: String(systemOverviewManifest.products.length),
        icon: <Layers className="w-5 h-5" />,
        caption: "Fit With Pulse, Pulse Check, Macra, Web/Admin",
        tone: "from-blue-500/30 to-blue-300/10",
      },
      {
        title: "Backend Services",
        value: String(systemOverviewManifest.backendServices.length),
        icon: <Server className="w-5 h-5" />,
        caption: "Core platform runtime services",
        tone: "from-purple-500/30 to-purple-300/10",
      },
      {
        title: "Integrations",
        value: String(systemOverviewManifest.integrations.length),
        icon: <Link2 className="w-5 h-5" />,
        caption: "Billing, messaging, AI, health data",
        tone: "from-amber-500/30 to-amber-300/10",
      },
      {
        title: "End-to-End Flows",
        value: String(systemOverviewManifest.flows.length),
        icon: <Activity className="w-5 h-5" />,
        caption: "Cross-product lifecycle maps",
        tone: "from-green-500/30 to-green-300/10",
      },
    ],
    [],
  );

  /* ---- SECTION CONTENT RENDERER ---- */
  const renderSectionContent = () => {
    switch (activeSectionId) {
      case "executive-summary":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
              {summaryCards.map((card) => (
                <div
                  key={card.title}
                  className={`bg-gradient-to-br ${card.tone} border border-white/5 rounded-2xl p-4 flex items-center justify-between`}
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-400">
                      {card.title}
                    </p>
                    <p className="text-2xl font-semibold text-white mt-1">
                      {card.value}
                    </p>
                    <p className="text-[11px] text-white/70 mt-0.5">
                      {card.caption}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-black/30 text-white">
                    {card.icon}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Current Product Architecture
                </p>
                <h2 className="text-xl font-semibold mt-1">
                  Fit With Pulse, Pulse Check, and Macra are distinct surfaces
                </h2>
                <p className="text-sm text-zinc-400 mt-2 max-w-4xl">
                  The overview now treats QuickLifts naming as repo/internal
                  lineage. The external product model is Fit With Pulse for
                  consumer fitness and clubs, Pulse Check for white-glove elite
                  athlete service technology, and Macra for nutrition.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-3">
                {PRODUCT_POSITIONING.map((product) => {
                  const Icon = product.icon;
                  return (
                    <article
                      key={product.title}
                      className={`rounded-2xl border p-4 ${product.accent}`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <p className="text-sm font-semibold text-white">
                          {product.title}
                        </p>
                      </div>
                      <p className="mt-2 text-[11px] uppercase tracking-wide text-current">
                        {product.eyebrow}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                        {product.body}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Mission</h2>
                <p className="text-sm text-zinc-300 mt-1">
                  {systemOverviewManifest.executiveSummary.mission}
                </p>
                <p className="text-xs text-zinc-500 mt-2">
                  Audience: {systemOverviewManifest.executiveSummary.audience}
                </p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-black/20 border border-zinc-800 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
                    What Changed Recently
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-300">
                    {systemOverviewManifest.executiveSummary.whatChangedRecently.map(
                      (item) => (
                        <li key={item}>{item}</li>
                      ),
                    )}
                  </ul>
                </div>
                <div className="bg-black/20 border border-zinc-800 rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
                    Highlights
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-300">
                    {systemOverviewManifest.executiveSummary.highlights.map(
                      (item) => (
                        <li key={item}>{item}</li>
                      ),
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case "ecosystem-map":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Ecosystem Map</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Layered map of system surfaces, backend, integrations, and agent
                infrastructure.
              </p>
            </div>
            <EcosystemMap
              nodes={systemOverviewManifest.ecosystemMap.nodes}
              connections={systemOverviewManifest.ecosystemMap.connections}
            />
            <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#38bdf8] inline-block" />
                Data
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#a78bfa] inline-block" />
                Auth
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#facc15] inline-block" />
                Events
              </span>
            </div>
          </div>
        );

      case "product-handbooks":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Product Handbooks</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Feature-by-feature inventory with dependencies, data paths,
                ownership, and release channels.
              </p>
            </div>
            {systemOverviewManifest.products.map((product) => (
              <ProductHandbook key={product.id} product={product} />
            ))}
          </div>
        );

      case "macra-system-overview":
        return <MacraSystemOverviewTab />;

      case "pulse-club-activation-architecture":
        return <PulseClubActivationArchitectureTab />;

      case "smart-routes-v1-architecture":
        return <SmartRoutesV1ArchitectureTab />;

      case "shared-link-preview-strategy":
        return <SharedLinkPreviewStrategyTab />;

      case "notification-systems-architecture":
        return (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Notification Systems</h2>
                <p className="text-sm text-zinc-400 mt-1 max-w-3xl">
                  Cross-product reference for how Fit With Pulse and Pulse Check
                  notifications are scoped, stored, scheduled, sent, and
                  debugged. This section documents the architecture; the
                  notification sequence page is the living inventory of
                  individual messages and launch behaviors.
                </p>
              </div>
              <a
                href="/admin/notificationSequences"
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-400/15"
              >
                <Bell className="h-4 w-4" />
                Open Notification Sequences
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <article className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-lime-300" />
                  <h3 className="text-lg font-semibold">Fit With Pulse</h3>
                </div>
                <div className="space-y-3 text-sm text-zinc-300">
                  <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Canonical Push Token
                    </p>
                    <p className="mt-1 font-mono text-cyan-200">users.fcmToken</p>
                    <p className="mt-2 text-zinc-400">
                      Legacy Pulse / Fit With Pulse mobile push lane. This field
                      should continue to power Fit With Pulse notifications and
                      should not be repurposed for Pulse Check.
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Typical Senders
                    </p>
                    <ul className="mt-2 list-disc pl-5 space-y-1 text-zinc-300">
                      <li>Challenge, chat, referral, club, and workout notification functions.</li>
                      <li>Fit With Pulse iOS direct send flows that still target the legacy Pulse ecosystem.</li>
                      <li>Admin test tooling when the product scope is Pulse.</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      User-Facing App Identity
                    </p>
                    <p className="mt-1 text-zinc-300">
                      Notifications should surface under the Fit With Pulse /
                      Pulse app install, because that token belongs to the
                      legacy mobile client.
                    </p>
                  </div>
                </div>
              </article>

              <article className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-violet-300" />
                  <h3 className="text-lg font-semibold">Pulse Check</h3>
                </div>
                <div className="space-y-3 text-sm text-zinc-300">
                  <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Canonical Push Token
                    </p>
                    <p className="mt-1 font-mono text-cyan-200">users.pulseCheckFcmToken</p>
                    <p className="mt-2 text-zinc-400">
                      Owned by the Pulse Check iOS app. Pulse Check writes this
                      token together with{" "}
                      <span className="font-mono text-zinc-300">
                        pushTokenSourceApp = "pulsecheck"
                      </span>{" "}
                      and should only receive remote pushes through this lane.
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Typical Senders
                    </p>
                    <ul className="mt-2 list-disc pl-5 space-y-1 text-zinc-300">
                      <li>Pulse Check remote push jobs in Netlify and Firebase functions.</li>
                      <li>Oura-sync biometric-brief push pipeline.</li>
                      <li>Daily reflection push scheduler and Pulse Check-scoped admin tests.</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
                    <p className="text-xs uppercase tracking-wide text-emerald-300">
                      Guardrail
                    </p>
                    <p className="mt-1 text-zinc-300">
                      Pulse Check senders should require both the Pulse Check
                      token field and the Pulse Check source marker so a stale
                      or mis-scoped token cannot route a Nora notification to
                      the wrong app.
                    </p>
                  </div>
                </div>
              </article>
            </div>

            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-300" />
                <h3 className="text-lg font-semibold">Token Ownership And Storage Rules</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Legacy Pulse Lane</p>
                  <p className="mt-2 font-mono text-cyan-200">users.fcmToken</p>
                  <p className="mt-2 text-zinc-400">
                    Reserved for Fit With Pulse / legacy Pulse notifications.
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Pulse Check Lane</p>
                  <p className="mt-2 font-mono text-cyan-200">users.pulseCheckFcmToken</p>
                  <p className="mt-2 text-zinc-400">
                    Reserved for Pulse Check remote pushes and Pulse Check
                    notification sequences.
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Scope Marker</p>
                  <p className="mt-2 font-mono text-cyan-200">users.pushTokenSourceApp</p>
                  <p className="mt-2 text-zinc-400">
                    Used as a defensive app-source assertion. Current Pulse
                    Check value:{" "}
                    <span className="font-mono text-zinc-300">pulsecheck</span>.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-300">
                <p className="font-semibold text-white">Canonical rule</p>
                <p className="mt-2">
                  Do not mirror Pulse Check tokens into{" "}
                  <span className="font-mono">users.fcmToken</span>. Fit With
                  Pulse and Pulse Check should each own their own FCM field, and
                  senders must choose the field that matches the target product.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <article className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-purple-300" />
                  <h3 className="text-lg font-semibold">Delivery Lanes</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                    <p className="font-semibold text-white">Remote FCM / APNS</p>
                    <p className="mt-1 text-zinc-400">
                      Backend-triggered pushes for biometric brief ready, Pulse
                      Check daily reflection, chat, rounds, club activity, and
                      other server-owned events.
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                    <p className="font-semibold text-white">Local iOS Notifications</p>
                    <p className="mt-1 text-zinc-400">
                      Device-scheduled reminders owned by the app itself, such
                      as Pulse Check onboarding reflection reminders and
                      wind-down prompts.
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                    <p className="font-semibold text-white">Scheduled Backend Jobs</p>
                    <p className="mt-1 text-zinc-400">
                      Recurring functions that evaluate time windows and user
                      state before sending, such as Pulse Check daily reflection
                      scheduler jobs.
                    </p>
                  </div>
                </div>
              </article>

              <article className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-cyan-300" />
                  <h3 className="text-lg font-semibold">How Notification Sequences Fit In</h3>
                </div>
                <div className="space-y-3 text-sm text-zinc-300">
                  <p>
                    The{" "}
                    <a
                      href="/admin/notificationSequences"
                      className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
                    >
                      Notification Sequences
                    </a>{" "}
                    page is the message inventory and launch map. It answers:
                    what gets sent, when it gets sent, what payload keys are
                    attached, and which screen should open.
                  </p>
                  <p>
                    This handbook section is the infrastructure map. It answers:
                    which product owns the token, which sender is allowed to use
                    it, where the send logic lives, and how to debug a
                    notification landing in the wrong app.
                  </p>
                  <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                    <p className="font-semibold text-white">Recommended usage</p>
                    <ul className="mt-2 list-disc pl-5 space-y-1 text-zinc-300">
                      <li>Use System Overview to understand architecture and ownership.</li>
                      <li>Use Notification Sequences to verify specific copy, triggers, and deep-link behavior.</li>
                      <li>Use admin notification testing only after confirming the correct product scope and token field.</li>
                    </ul>
                  </div>
                </div>
              </article>
            </div>

            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-300" />
                <h3 className="text-lg font-semibold">Current Pulse Check Notification Path</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">1. Client Registration</p>
                  <p className="mt-2 text-zinc-300">
                    Pulse Check receives an FCM token and writes{" "}
                    <span className="font-mono">pulseCheckFcmToken</span> plus{" "}
                    <span className="font-mono">pushTokenSourceApp</span>.
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">2. Backend Event</p>
                  <p className="mt-2 text-zinc-300">
                    Oura sync, reflection scheduler, or another Pulse Check
                    sender decides that a Nora notification should fire.
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">3. Scope Validation</p>
                  <p className="mt-2 text-zinc-300">
                    Sender resolves the Pulse Check push target and rejects the
                    send if the token or source marker is missing or mismatched.
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">4. Nora Launch</p>
                  <p className="mt-2 text-zinc-300">
                    Payload arrives under the Pulse Check app, then routes into
                    Nora chat or the intended Pulse Check surface using the data
                    keys defined in Notification Sequences.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300" />
                <h3 className="text-lg font-semibold">Debugging Checklist</h3>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 text-sm text-zinc-300">
                <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                  <p className="font-semibold text-white">If a Pulse Check push lands under Fit With Pulse</p>
                  <ul className="mt-2 list-disc pl-5 space-y-1">
                    <li>Check the user doc for both token fields and confirm which one the sender used.</li>
                    <li>Confirm the Pulse Check sender required the Pulse Check source marker.</li>
                    <li>Open Pulse Check on device to refresh and re-save the latest token metadata.</li>
                    <li>Verify the message came from a Pulse Check sender, not a legacy Pulse sender with similar copy.</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
                  <p className="font-semibold text-white">If a Pulse Check push does not send at all</p>
                  <ul className="mt-2 list-disc pl-5 space-y-1">
                    <li>Confirm the user has a non-empty <span className="font-mono">pulseCheckFcmToken</span>.</li>
                    <li>Confirm <span className="font-mono">pushTokenSourceApp</span> is set to <span className="font-mono">pulsecheck</span>.</li>
                    <li>Check product-scope selection in admin notification testing.</li>
                    <li>Review notification logs and sender-specific failure reasons.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case "backend-data":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Backend and Data</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Platform service inventory and canonical data collection usage.
              </p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-purple-300" />
                  <h3 className="text-lg font-semibold">Backend Services</h3>
                </div>
                <div className="space-y-3 text-sm">
                  {systemOverviewManifest.backendServices.map((service) => (
                    <div
                      key={service.id}
                      className="border border-zinc-800 rounded-xl p-3 bg-black/20"
                    >
                      <p className="text-white font-semibold">{service.name}</p>
                      <p className="text-zinc-400 text-xs mt-1">
                        {service.purpose}
                      </p>
                      <p className="text-zinc-500 text-xs mt-2">
                        Owner: {service.owner} | Environments:{" "}
                        {service.environments.join(", ")}
                      </p>
                      <p className="text-zinc-500 text-xs">
                        Dependencies: {service.keyDependencies.join(", ")}
                      </p>
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
                    <div
                      key={collection.id}
                      className="border border-zinc-800 rounded-xl p-3 bg-black/20"
                    >
                      <p className="text-white font-semibold font-mono text-xs">
                        {collection.name}
                      </p>
                      <p className="text-zinc-400 text-xs mt-1">
                        {collection.purpose}
                      </p>
                      <p className="text-zinc-500 text-xs mt-2">
                        Written by: {collection.writtenBy}
                      </p>
                      <p className="text-zinc-500 text-xs">
                        Read by: {collection.readBy}
                      </p>
                      <p className="text-zinc-500 text-xs">
                        Critical fields: {collection.criticalFields.join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case "integrations":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Integrations</h2>
              <p className="text-sm text-zinc-400 mt-1">
                External systems, operational ownership, and credential origin
                visibility.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {systemOverviewManifest.integrations.map((integration) => (
                <article
                  key={integration.id}
                  className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">
                      {integration.name}
                    </h3>
                    <span className="text-[11px] uppercase tracking-wide text-zinc-400">
                      {integration.status}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 mt-2">
                    {integration.purpose}
                  </p>
                  <p className="text-xs text-zinc-500 mt-2">
                    Owner: {integration.owner}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Credential source: {integration.credentialSource}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Products: {integration.products.join(", ")}
                  </p>
                </article>
              ))}
            </div>
          </div>
        );

      case "end-to-end-flows":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">End-to-End Flows</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Trigger-to-outcome maps with data touchpoints and failure modes.
              </p>
            </div>
            <div className="space-y-4">
              {systemOverviewManifest.flows.map((flow) => (
                <article
                  key={flow.id}
                  className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-3"
                >
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {flow.name}
                    </h3>
                    <p className="text-sm text-zinc-400 mt-1">
                      Trigger: {flow.trigger}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-xs">
                    <div className="border border-zinc-800 rounded-xl p-3 bg-black/20">
                      <p className="uppercase tracking-wide text-zinc-500 mb-1">
                        System Path
                      </p>
                      <p className="text-zinc-300">
                        {flow.backendPath.join(" -> ")}
                      </p>
                      <p className="text-zinc-500 mt-2 break-words">
                        Products: {flow.involvedProducts.join(", ")}
                      </p>
                      <p className="text-zinc-500 break-words">
                        Collections: {flow.collectionsTouched.join(", ")}
                      </p>
                      <p className="text-zinc-500 break-words">
                        Integrations: {flow.integrations.join(", ") || "N/A"}
                      </p>
                    </div>
                    <div className="border border-zinc-800 rounded-xl p-3 bg-black/20">
                      <p className="uppercase tracking-wide text-zinc-500 mb-1">
                        Failure Points
                      </p>
                      <ul className="list-disc pl-4 text-zinc-300 space-y-1">
                        {flow.failurePoints.map((failure) => (
                          <li key={failure}>{failure}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <ol className="space-y-2">
                    {flow.steps.map((step) => (
                      <li
                        key={step.id}
                        className="border border-zinc-800 rounded-xl p-3 bg-black/20"
                      >
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">
                          {step.actor}
                        </p>
                        <p className="text-sm text-white font-semibold mt-1">
                          {step.action}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          Output: {step.output}
                        </p>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </div>
        );

      case "ownership-release-matrix":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">
                Ownership and Release Matrix
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Primary operational ownership, escalation backup, and cadence
                references.
              </p>
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
                      <td className="px-3 py-3 text-zinc-300">
                        {row.primaryOwner}
                      </td>
                      <td className="px-3 py-3 text-zinc-300">
                        {row.backupOwner}
                      </td>
                      <td className="px-3 py-3 text-zinc-300">
                        {row.releaseCadence}
                      </td>
                      <td className="px-3 py-3 text-zinc-500 text-xs font-mono break-all">
                        {row.runbookPath}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "agent-infrastructure-handbook":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">
                Agent Infrastructure Handbook
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Embedded chapter preserving current heartbeat protocol, data
                schema, and operator docs.
              </p>
            </div>
            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4 overflow-hidden">
              <HeartbeatProtocolTab />
            </div>
          </div>
        );

      case "agent-outcome-rubric-spec":
        return <AgentOutcomeRubricSpecTab />;

      case "hunter-world-handbook":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Hunter World Handbook</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Embedded chapter for leveling mechanics, specialty classes, and
                creator narrative system.
              </p>
            </div>
            <div className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4 overflow-hidden">
              <HunterWorldTab />
            </div>
          </div>
        );

      case "risks-gaps":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Risks and Gaps</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Known system risks and active mitigation posture.
              </p>
            </div>
            <div className="space-y-3">
              {systemOverviewManifest.risksAndGaps.map((risk) => (
                <article
                  key={risk.id}
                  className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-4"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-300" />
                    <h3 className="text-lg font-semibold text-white">
                      {risk.title}
                    </h3>
                    <span className="text-[11px] uppercase tracking-wide text-zinc-400 ml-auto">
                      {risk.severity}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 mt-2">
                    Impact: {risk.impact}
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    Mitigation: {risk.mitigation}
                  </p>
                  <p className="text-xs text-zinc-500 mt-2">
                    Owner: {risk.owner}
                  </p>
                </article>
              ))}
            </div>
          </div>
        );

      case "glossary":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Glossary</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Shared language across product, engineering, and operations.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {systemOverviewManifest.glossary.map((entry) => (
                <article
                  key={entry.term}
                  className="bg-[#090f1c] border border-zinc-800 rounded-xl p-4"
                >
                  <p className="text-sm font-semibold text-white">
                    {entry.term}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {entry.definition}
                  </p>
                </article>
              ))}
            </div>
          </div>
        );

      case "simulation-taxonomy":
        return <SimulationTaxonomyTab />;

      case "sim-family-tree":
        return <SimFamilyTreeTab />;

      case "promotion-protocol":
        return <PromotionProtocolTab />;

      case "sim-spec-standards":
        return <SimSpecStandardsTab />;

      case "variant-registry":
        return <VariantRegistryTab />;

      case "protocol-registry":
        return <ProtocolRegistryTab />;

      case "pulsecheck-protocol-governance-spec":
        return <PulseCheckProtocolGovernanceSpecTab />;

      case "pulsecheck-protocol-authoring-workflow":
        return <PulseCheckProtocolAuthoringWorkflowTab />;

      case "pulsecheck-protocol-responsiveness-profile-spec":
        return <PulseCheckProtocolResponsivenessProfileSpecTab />;

      case "pulsecheck-protocol-responsiveness-inspector":
        return <PulseCheckProtocolResponsivenessInspectorTab />;

      case "pulsecheck-protocol-launch-readiness":
        return <PulseCheckProtocolLaunchReadinessTab />;

      case "pulsecheck-protocol-planner-policy-enforcement":
        return <PulseCheckProtocolPlannerPolicyEnforcementTab />;

      case "pulsecheck-protocol-practice-conversation-spec":
        return <PulseCheckProtocolPracticeConversationSpecTab />;

      case "pulsecheck-protocol-evidence-dashboard":
        return <PulseCheckProtocolEvidenceDashboardTab />;

      case "pulsecheck-protocol-revision-audit-trace":
        return <PulseCheckProtocolRevisionAuditTraceTab />;

      case "pulsecheck-protocol-ops-runbook":
        return <PulseCheckProtocolOpsRunbookTab />;

      case "pulsecheck-protocol-launch-qa-matrix":
        return <PulseCheckProtocolLaunchQaMatrixTab />;

      case "sim-family-specs":
        return <SimFamilySpecTab />;

      case "athlete-journey":
        return <AthleteJourneyTab />;

      case "coach-journey":
        return <CoachJourneyTab />;

      case "pulsecheck-runtime-architecture":
        return <PulseCheckRuntimeArchitectureTab />;

      case "pulsecheck-state-signal-layer":
        return <PulseCheckStateSignalLayerTab />;

      case "pulsecheck-checkin-signal-layer-integration-spec":
        return <PulseCheckCheckInSignalLayerIntegrationSpecTab />;

      case "pulsecheck-daily-task-training-plan-alignment-spec":
        return <PulseCheckDailyTaskTrainingPlanAlignmentSpecTab />;

      case "pulsecheck-training-plan-authoring-spec":
        return <PulseCheckTrainingPlanAuthoringSpecTab />;

      case "pulsecheck-health-chat-architecture":
        return <PulseCheckHealthChatArchitectureTab />;

      case "pulsecheck-athlete-health-context-snapshot-spec":
        return <PulseCheckAthleteHealthContextSnapshotSpecTab />;

      case "pulsecheck-health-context-source-record-spec":
        return <PulseCheckHealthContextSourceRecordSpecTab />;

      case "pulsecheck-health-context-snapshot-assembler-spec":
        return <PulseCheckHealthContextSnapshotAssemblerSpecTab />;

      case "pulsecheck-health-context-persistence-storage-spec":
        return <PulseCheckHealthContextPersistenceStorageSpecTab />;

      case "pulsecheck-health-context-operational-orchestration-spec":
        return <PulseCheckHealthContextOperationalOrchestrationSpecTab />;

      case "pulsecheck-health-context-implementation-rollout-plan":
        return <PulseCheckHealthContextImplementationRolloutPlanTab />;

      case "pulsecheck-health-context-operator-runbook":
        return <PulseCheckHealthContextOperatorRunbookTab />;

      case "pulsecheck-health-context-definition-of-done":
        return <PulseCheckHealthContextDefinitionOfDoneTab />;

      case "pulsecheck-health-context-engineering-task-breakdown":
        return <PulseCheckHealthContextEngineeringTaskBreakdownTab />;

      case "pulsecheck-health-context-firestore-schema-index-spec":
        return <PulseCheckHealthContextFirestoreSchemaIndexSpecTab />;

      case "pulsecheck-physiology-cognition-correlation-engine":
        return <PulseCheckPhysiologyCognitionCorrelationEngineTab />;

      case "pulsecheck-correlation-engine-contract-lock":
        return <PulseCheckCorrelationEngineContractLockTab />;

      case "pulsecheck-sports-intelligence-layer-spec":
        return <PulseCheckSportsIntelligenceLayerSpecTab />;

      case "pulsecheck-curriculum-layer-spec":
        return <PulseCheckCurriculumLayerSpecTab />;

      case "pulsecheck-sports-intelligence-aggregation-inference-contract":
        return <PulseCheckSportsIntelligenceAggregationInferenceContractTab />;

      case "pulsecheck-sports-intelligence-mock-report-baselines":
        return <PulseCheckSportsIntelligenceMockReportBaselinesTab />;

      case "pulsecheck-nora-context-capture":
        return <PulseCheckNoraContextCaptureSpecTab />;

      case "pulsecheck-session-detection-matching":
        return <PulseCheckSessionDetectionMatchingSpecTab />;

      case "pulsecheck-sport-load-model":
        return <PulseCheckSportLoadModelSpecTab />;

      case "pulsecheck-correlation-data-model-spec":
        return <PulseCheckCorrelationDataModelSpecTab />;

      case "pulsecheck-correlation-engine-engineering-task-breakdown":
        return <PulseCheckCorrelationEngineEngineeringTaskBreakdownTab />;

      case "pulsecheck-correlation-engine-pilot-dashboard":
        return <PulseCheckCorrelationEnginePilotDashboardTab />;

      case "pulsecheck-correlation-engine-pilot-dashboard-addendum":
        return <PulseCheckCorrelationEnginePilotDashboardAddendumTab />;

      case "pulsecheck-pilot-outcome-metrics-contract":
        return <PulseCheckPilotOutcomeMetricsContractTab />;

      case "pulsecheck-correlation-engine-pilot-ops-runbook":
        return <PulseCheckCorrelationEnginePilotOpsRunbookTab />;

      case "pulsecheck-correlation-engine-pilot-research-readout":
        return <PulseCheckCorrelationEnginePilotResearchReadoutTab />;

      case "pulsecheck-oura-integration-strategy":
        return <PulseCheckOuraIntegrationStrategyTab />;

      case "pulsecheck-oura-cognitive-correlation-spec":
        return <PulseCheckOuraCognitiveCorrelationSpecTab />;

      case "pulsecheck-device-integration-strategy":
        return <PulseCheckDeviceIntegrationStrategyTab />;

      case "pulsecheck-device-integration-partnership-matrix":
        return <PulseCheckDeviceIntegrationPartnershipMatrixTab />;

      case "pulsecheck-school-wearable-bundle-plan":
        return <PulseCheckSchoolWearableBundlePlanTab />;

      case "pulsecheck-patent-eligibility-audit":
        return <PulseCheckPatentEligibilityAuditTab />;

      case "firestore-index-registry":
        return <FirestoreIndexRegistryTab />;

      case "infrastructure-secrets-stack":
        return <InfrastructureSecretsStackTab />;

      case "firebase-admin-credential-architecture":
        return <FirebaseAdminCredentialArchitectureTab />;

      case "pulsecheck-state-snapshot-freshness-policy":
        return <PulseCheckStateSnapshotFreshnessPolicyTab />;

      case "pulsecheck-performance-state-flag-definitions":
        return <PulseCheckPerformanceStateFlagDefinitionsTab />;

      case "pulsecheck-nora-assignment-rules":
        return <PulseCheckNoraAssignmentRulesTab />;

      case "pulsecheck-nora-qa-edge-case-matrix":
        return <PulseCheckNoraQaEdgeCaseScenarioMatrixTab />;

      case "pulsecheck-state-escalation-orchestration":
        return <PulseCheckStateEscalationOrchestrationTab />;

      case "pulsecheck-escalation-integration-spec":
        return <PulseCheckEscalationIntegrationSpecTab />;

      case "pulsecheck-member-onboarding-guide":
        return <PulseCheckMemberOnboardingGuideTab />;

      case "pulsecheck-team-pilot-cohort-onboarding-architecture":
        return <PulseCheckTeamPilotCohortOnboardingArchitectureTab />;

      case "pulsecheck-permissions-visibility-model":
        return <PulseCheckPermissionsVisibilityModelTab />;

      case "pulsecheck-coach-dashboard-information-architecture":
        return <PulseCheckCoachDashboardInformationArchitectureTab />;

      case "pulsecheck-profile-architecture":
        return <PulseCheckProfileArchitectureTab />;

      case "pulsecheck-profile-snapshot-export-spec":
        return <PulseCheckProfileSnapshotExportSpecTab />;

      case "pulsecheck-athlete-showroom-avatar":
        return <PulseCheckAthleteShowroomAvatarTab />;

      case "quicklifts-profile-health-system":
        return <QuickLiftsProfileHealthSystemTab />;

      case "quicklifts-profile-health-story-spec":
        return <QuickLiftsProfileHealthStorySpecTab />;

      case "quicklifts-profile-health-snapshot-contract":
        return <QuickLiftsProfileHealthSnapshotContractTab />;

      case "quicklifts-profile-health-energy-merge-spec":
        return <QuickLiftsProfileHealthEnergyMergeSpecTab />;

      case "pulsecheck-vision-pro-immersive-tests":
        return <PulseCheckVisionProImmersiveTestsTab />;

      case "system-design-language":
        return <PulseSystemDesignLanguageTab />;

      case "auntedna-integration-strategy":
        return <AuntEdnaIntegrationStrategyTab />;

      case "auntedna-pilot-authorization-memo":
        return <AuntEdnaPilotAuthorizationMemoTab />;

      case "auntedna-exhibit-a-data-architecture":
        return <AuntEdnaExhibitATab />;

      case "auntedna-exhibit-b-performance-standards":
        return <AuntEdnaExhibitBTab />;

      case "system-test-coverage":
        return <SystemTestCoverageTab />;

      case "playwright-testing-strategy":
        return <PlaywrightTestingStrategyTab />;

      case "android-testing-strategy":
        return <AndroidTestingStrategyTab />;

      case "xcuitest-testing-strategy":
        return <XCUITestingStrategyTab />;

      case "workout-share-cards":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-6">
              <h2 className="text-xl font-bold text-white mb-1">
                Workout Share Cards
              </h2>
              <p className="text-sm text-zinc-400">
                Branded 1080×1350 (4:5) shareable image cards for each workout
                category. Supports two export modes: a dark-background{" "}
                <strong className="text-white">Story Card</strong> (saved as
                JPEG) and a fully transparent{" "}
                <strong className="text-white">Sticker PNG</strong> (alpha
                channel preserved via{" "}
                <code className="text-amber-400 text-xs bg-amber-500/10 px-1 rounded">
                  PHPhotoLibrary
                </code>
                ) that can be overlaid on any photo.
              </p>
            </div>

            {/* Why PHPhotoLibrary for transparent PNGs */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
              <h3 className="font-semibold text-amber-300 mb-2">
                💡 Transparent PNG Save Implementation
              </h3>
              <p className="text-sm text-zinc-300 mb-3">
                <code className="text-amber-400 text-xs bg-amber-500/10 px-1 rounded">
                  UIImageWriteToSavedPhotosAlbum
                </code>{" "}
                always re-encodes as JPEG and silently strips the alpha channel
                — so a transparent card would save with a black background.
              </p>
              <p className="text-sm text-zinc-300">
                To preserve transparency we use{" "}
                <code className="text-amber-400 text-xs bg-amber-500/10 px-1 rounded">
                  PHPhotoLibrary.shared().performChanges
                </code>{" "}
                with a{" "}
                <code className="text-amber-400 text-xs bg-amber-500/10 px-1 rounded">
                  PHAssetCreationRequest
                </code>{" "}
                supplying raw{" "}
                <code className="text-amber-400 text-xs bg-amber-500/10 px-1 rounded">
                  img.pngData()
                </code>{" "}
                and{" "}
                <code className="text-amber-400 text-xs bg-amber-500/10 px-1 rounded">
                  uniformTypeIdentifier: &quot;public.png&quot;
                </code>
                . This writes a real PNG asset with full alpha channel intact.
              </p>
            </div>

            {/* Category cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[
                {
                  label: "Run",
                  color: "#3b82f6",
                  icon: "🏃",
                  file: "RunSummaryView.swift / RunShareStoryView.swift",
                  stats: "Distance · Pace · Time · Calories",
                  note: "Swipeable Map Route + Stats-Only cards. Stats-only center uses subtle radial glow; icon moves to stats bar corner.",
                },
                {
                  label: "Bike",
                  color: "#06b6d4",
                  icon: "🚴",
                  file: "BikeSummaryView.swift / BikeShareStoryView.swift",
                  stats: "Distance · Speed · Biking Time · Calories",
                  note: "GPS route shown when available. Indoor/no-GPS sessions use stats-only center + icon in stats bar.",
                },
                {
                  label: "Lift",
                  color: "#22c55e",
                  icon: "🏋",
                  file: "WorkoutShareStoryView.swift / WorkoutSummaryView.swift",
                  stats: "Duration · Exercises · Calories",
                  note: "Workout title as center hero. Category icon in stats bar corner. Dark teal-green background.",
                },
                {
                  label: "Stretch",
                  color: "#a855f7",
                  icon: "🧘",
                  file: "WorkoutShareStoryView.swift / WorkoutSummaryView.swift",
                  stats: "Duration · Stretches · Calories",
                  note: "Same WorkoutShareStoryView as Lift, themed purple. inferredHistoryType == .stretch triggers purple palette.",
                },
                {
                  label: "Fat Burn",
                  color: "#ef4444",
                  icon: "🔥",
                  file: "FatBurnShareStoryView.swift / FatBurnSummaryView.swift",
                  stats: "Duration · Floors or Distance · Calories",
                  note: "Equipment-specific middle stat: Floors (Stairmaster), Distance (elliptical/treadmill/bike). Equipment icon in stats bar.",
                },
              ].map((cat) => (
                <div
                  key={cat.label}
                  className="rounded-xl border p-4 space-y-2"
                  style={{
                    borderColor: `${cat.color}30`,
                    background: `${cat.color}08`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cat.icon}</span>
                    <span className="font-semibold text-white">
                      {cat.label}
                    </span>
                    <span
                      className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${cat.color}20`, color: cat.color }}
                    >
                      active
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono">{cat.file}</p>
                  <p className="text-xs text-zinc-300">
                    <span className="font-medium" style={{ color: cat.color }}>
                      Stats:{" "}
                    </span>
                    {cat.stats}
                  </p>
                  <p className="text-xs text-zinc-400">{cat.note}</p>
                </div>
              ))}
            </div>

            {/* Code architecture */}
            <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-6 space-y-4">
              <h3 className="font-semibold text-white">
                Code Architecture Pattern
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                  <p className="font-medium text-zinc-200 mb-2">
                    *ShareStoryView
                  </p>
                  <p className="text-zinc-400 text-xs">
                    Pure SwiftUI view, 1080×1350 frame. Accepts a{" "}
                    <code className="text-amber-400">style: RunShareStyle</code>{" "}
                    param (.story | .transparent). Rendered off-screen via{" "}
                    <code className="text-amber-400">ImageRenderer</code>. No
                    state.
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                  <p className="font-medium text-zinc-200 mb-2">
                    prepare*ShareImages()
                  </p>
                  <p className="text-zinc-400 text-xs">
                    <code className="text-amber-400">@MainActor</code> function
                    on the summary view. Calls{" "}
                    <code className="text-amber-400">ImageRenderer</code> twice
                    (story + sticker), caches{" "}
                    <code className="text-amber-400">UIImage</code> in{" "}
                    <code className="text-amber-400">@State</code>, then sets{" "}
                    <code className="text-amber-400">
                      show*ShareComposer = true
                    </code>
                    .
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                  <p className="font-medium text-zinc-200 mb-2">
                    *ShareComposerSheet
                  </p>
                  <p className="text-zinc-400 text-xs">
                    Bottom sheet with preview card, style picker (Story /
                    Transparent), Share (UIActivityViewController), Save Story
                    Card (UIImageWriteToSavedPhotosAlbum — JPEG), and Save
                    Transparent PNG (PHPhotoLibrary — PNG).
                  </p>
                </div>
              </div>
            </div>

            {/* Key files */}
            <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-6">
              <h3 className="font-semibold text-white mb-3">
                Key Source Files
              </h3>
              <div className="space-y-2">
                {[
                  [
                    "RunShareStoryView.swift",
                    "Run story card. Supports GPS map route + stats-only center.",
                  ],
                  [
                    "RunSummaryView.swift",
                    "Run composer sheet, saveTransparentImageToPhotos, saveImageToPhotos helpers.",
                  ],
                  [
                    "BikeShareStoryView.swift",
                    "Bike story card. GPS route or stats-only center (no large icon). Cyan theme.",
                  ],
                  [
                    "BikeSummaryView.swift",
                    "Bike composer sheet with Save Transparent PNG (PHPhotoLibrary).",
                  ],
                  [
                    "WorkoutShareStoryView.swift",
                    "Lift + Stretch card. Workout title as hero, category icon in stats bar. Green / Purple theme.",
                  ],
                  [
                    "WorkoutSummaryView.swift",
                    "Lift/Stretch composer sheet + prepareWorkoutShareImages().",
                  ],
                  [
                    "FatBurnShareStoryView.swift",
                    "Fat Burn card. Equipment chip + equipment-specific middle stat. Red theme.",
                  ],
                  [
                    "FatBurnSummaryView.swift",
                    "Fat Burn composer sheet + prepareFatBurnShareImages().",
                  ],
                ].map(([file, desc]) => (
                  <div key={file} className="flex gap-3 items-start">
                    <code className="text-xs text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded shrink-0">
                      {file}
                    </code>
                    <p className="text-xs text-zinc-400">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

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
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Operations Handbook
            </p>
            <h1 className="text-3xl font-semibold">
              {systemOverviewManifest.title}
            </h1>
            <p className="text-zinc-300 text-sm max-w-4xl">
              {systemOverviewManifest.subtitle}
            </p>
            <p className="text-xs text-zinc-500">
              Last updated: {systemOverviewManifest.lastUpdated}
            </p>
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
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? "text-white shadow-lg"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] border border-transparent hover:border-zinc-800"
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
                  <Icon
                    className="w-4 h-4"
                    style={isActive ? { color: tab.accent } : undefined}
                  />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <section className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-4">
            <form onSubmit={handleHandbookSearchSubmit}>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    Search Handbook Docs
                  </p>
                  <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={handbookSearchQuery}
                      onChange={(event) =>
                        setHandbookSearchQuery(event.target.value)
                      }
                      placeholder="Search docs, specs, flows, or playbooks"
                      className="w-full rounded-xl border border-zinc-700 bg-black/20 py-3 pl-11 pr-11 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-500"
                    />
                    {trimmedHandbookSearchQuery ? (
                      <button
                        type="button"
                        onClick={() => setHandbookSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 transition hover:bg-white/5 hover:text-white"
                        aria-label="Clear handbook search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-3 xl:self-end">
                  <button
                    type="submit"
                    disabled={!handbookSearchResults.length}
                    className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Open Best Match
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span>
                Searches titles, descriptions, and core handbook inventory terms
                across all docs.
              </span>
              {trimmedHandbookSearchQuery ? (
                <span className="text-zinc-400">
                  {handbookSearchResults.length}{" "}
                  {handbookSearchResults.length === 1 ? "match" : "matches"}
                </span>
              ) : null}
            </div>

            {trimmedHandbookSearchQuery ? (
              handbookSearchResults.length > 0 ? (
                <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-3">
                  {handbookSearchResults.slice(0, 9).map((result) => {
                    const isActive = result.section.id === activeSectionId;
                    return (
                      <button
                        key={result.section.id}
                        type="button"
                        onClick={() =>
                          handleHandbookSearchResultSelect(result.section.id)
                        }
                        className={`rounded-xl border p-3 text-left transition ${
                          isActive
                            ? "border-white bg-white text-black"
                            : "border-zinc-800 bg-black/20 text-white hover:border-zinc-600 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p
                              className={`text-sm font-semibold ${isActive ? "text-black" : "text-white"}`}
                            >
                              {result.section.label}
                            </p>
                            <p
                              className={`mt-1 text-[11px] uppercase tracking-[0.16em] ${isActive ? "text-zinc-700" : "text-zinc-500"}`}
                            >
                              {result.systemLabel}
                            </p>
                          </div>
                        </div>
                        <p
                          className={`mt-2 text-xs leading-relaxed ${isActive ? "text-zinc-700" : "text-zinc-400"}`}
                        >
                          {result.section.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-black/20 px-4 py-4 text-sm text-zinc-400">
                  No docs matched "{trimmedHandbookSearchQuery}". Try a section
                  title, product name, or keyword like "Nora" or "Vision Pro".
                </div>
              )
            ) : null}
          </section>

          {isPlaywrightSystem ? (
            <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
                    Machine Setup
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    New machine handoff lives in the Playwright docs and local setup runbook.
                  </p>
                  <p className="mt-1 text-xs text-emerald-50/80">
                    Start with <code className="rounded bg-black/20 px-1.5 py-0.5 text-[11px] text-emerald-100">docs/testing/local-machine-setup.md</code>. Brand-new machines should first pull <code className="rounded bg-black/20 px-1.5 py-0.5 text-[11px] text-emerald-100">local-machine-setup.bundle.enc.json</code> from Google Drive, import the encrypted setup bundle, then run <code className="rounded bg-black/20 px-1.5 py-0.5 text-[11px] text-emerald-100">npm run test:e2e:bootstrap:check</code> before auth capture.
                  </p>
                  <p className="mt-2 text-xs text-emerald-50/80">
                    Android release signing should also be part of local machine setup. The upload key <code className="rounded bg-black/20 px-1.5 py-0.5 text-[11px] text-emerald-100">pulse-release-key.jks</code> is stored in Google Drive as well. After downloading it locally, export <code className="rounded bg-black/20 px-1.5 py-0.5 text-[11px] text-emerald-100">PULSE_KEYSTORE_PATH</code>, <code className="rounded bg-black/20 px-1.5 py-0.5 text-[11px] text-emerald-100">PULSE_STORE_PASSWORD</code>, <code className="rounded bg-black/20 px-1.5 py-0.5 text-[11px] text-emerald-100">PULSE_KEY_ALIAS</code>, and <code className="rounded bg-black/20 px-1.5 py-0.5 text-[11px] text-emerald-100">PULSE_KEY_PASSWORD</code> before running <code className="rounded bg-black/20 px-1.5 py-0.5 text-[11px] text-emerald-100">./gradlew bundleProdRelease</code>.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {activeSectionId !== "playwright-testing-strategy" ? (
                    <button
                      type="button"
                      onClick={() => handleSectionChange("playwright-testing-strategy")}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-black/20 px-4 py-2 text-sm font-medium text-emerald-50 transition-colors hover:border-emerald-200/60 hover:bg-black/30"
                    >
                      <TestTube2 className="h-4 w-4" />
                      Open Playwright Strategy
                    </button>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          <main className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start min-w-0">
            <SectionNav
              sections={sidebarSections}
              activeSectionId={activeSectionId}
              onSectionChange={handleSectionChange}
              title={
                trimmedHandbookSearchQuery
                  ? "Search Results"
                  : "Handbook Sections"
              }
              emptyMessage={
                trimmedHandbookSearchQuery
                  ? `No docs matched "${trimmedHandbookSearchQuery}".`
                  : "No handbook sections available."
              }
            />

            <div className="min-w-0">
              <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-[#090f1c] p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    Artifact Actions
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {activeSectionMeta?.label || "Current Section"}
                  </p>
                  {activeSectionMeta?.description ? (
                    <p className="mt-1 text-xs text-zinc-400">
                      {activeSectionMeta.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  {activeSectionId === "system-design-language" ? (
                    <a
                      href="/admin/pulsecheckDesignSystem"
                      className="inline-flex items-center gap-2 rounded-xl border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-100 transition-colors hover:border-orange-300/50 hover:bg-orange-500/15 hover:text-white"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Design System
                    </a>
                  ) : null}
                  {copyState === "error" ? (
                    <p className="text-xs text-red-400">
                      Copy failed. Try again.
                    </p>
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
                            <p className="text-sm font-semibold text-white">
                              Share Links
                            </p>
                            <p className="text-xs text-zinc-500">
                              Each share creates a unique revocable public link.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleCreateShareLink()}
                            disabled={shareCreating}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {shareCreating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Share2 className="h-3.5 w-3.5" />
                            )}
                            {shareCreating ? "Creating..." : "New Link"}
                          </button>
                        </div>

                        <div className="mt-3 space-y-2">
                          <div className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold text-white">
                                  Passcode Protection
                                </p>
                                <p className="mt-1 text-[11px] text-zinc-500">
                                  Require a passcode before the shared artifact
                                  can be viewed.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSharePasscodeEnabled(
                                    (current) => !current,
                                  );
                                  setSharePasscode("");
                                }}
                                className={`inline-flex h-6 w-11 items-center rounded-full border transition ${
                                  sharePasscodeEnabled
                                    ? "border-amber-400/40 bg-amber-500/20"
                                    : "border-zinc-700 bg-black/20"
                                }`}
                              >
                                <span
                                  className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                                    sharePasscodeEnabled
                                      ? "translate-x-5"
                                      : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </div>
                            {sharePasscodeEnabled ? (
                              <label className="mt-3 block">
                                <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
                                  Passcode
                                </span>
                                <input
                                  type="password"
                                  value={sharePasscode}
                                  onChange={(event) =>
                                    setSharePasscode(
                                      event.target.value.toUpperCase(),
                                    )
                                  }
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
                              <div
                                key={link.token}
                                className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-3"
                              >
                                <p className="truncate text-xs font-medium text-white">
                                  {link.shareUrl}
                                </p>
                                <p className="mt-1 text-[11px] text-zinc-500">
                                  Created{" "}
                                  {link.createdAt
                                    ? new Date(link.createdAt).toLocaleString()
                                    : "just now"}
                                </p>
                                {link.passcodeProtected ? (
                                  <p className="mt-1 text-[11px] text-amber-300">
                                    Passcode protected
                                  </p>
                                ) : null}
                                <div className="mt-3 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleCopyShareLink(link.shareUrl)
                                    }
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
                                    onClick={() =>
                                      void handleRevokeShareLink(link.token)
                                    }
                                    disabled={shareRevokingToken === link.token}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 px-2.5 py-1.5 text-[11px] text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {shareRevokingToken === link.token ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
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
                      copyState === "copied"
                        ? "border-green-500/30 bg-green-500/10 text-green-200"
                        : "border-zinc-700 bg-black/20 text-zinc-200 hover:border-zinc-500 hover:text-white"
                    }`}
                  >
                    {copyState === "copied" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copyState === "copied" ? "Copied" : "Copy to Clipboard"}
                  </button>
                </div>
              </div>

              <div ref={artifactContentRef}>{renderSectionContent()}</div>
            </div>
          </main>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default SystemOverviewPage;
