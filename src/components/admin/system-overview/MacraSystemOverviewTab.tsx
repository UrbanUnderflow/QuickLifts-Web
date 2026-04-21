import React from 'react';
import {
  Camera,
  CreditCard,
  Database,
  FileImage,
  LockKeyhole,
  MessageCircle,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Utensils,
} from 'lucide-react';
import {
  BulletList,
  CardGrid,
  DataTable,
  DocHeader,
  InfoCard,
  InlineTag,
  RuntimeAlignmentPanel,
  SectionBlock,
} from './PulseCheckRuntimeDocPrimitives';

const SCREENSHOTS = [
  {
    title: 'Food Journal',
    file: '01-food-journal.png',
    path: '/system-overview/macra/app-store-screenshots/01-food-journal.png',
    caption: 'Daily macro cockpit, meal timeline, progress rings, and Nora entry point.',
  },
  {
    title: 'AI Meal Scan',
    file: '02-ai-meal-scan.png',
    path: '/system-overview/macra/app-store-screenshots/02-ai-meal-scan.png',
    caption: 'Camera-first meal capture with structured macro estimates from dummy food data.',
  },
  {
    title: 'Meal Planning',
    file: '03-meal-planning.png',
    path: '/system-overview/macra/app-store-screenshots/03-meal-planning.png',
    caption: 'Nora-made plans, macro targets, prep cadence, and grocery-aware planning copy.',
  },
  {
    title: 'Label Scanner',
    file: '04-label-scanner.png',
    path: '/system-overview/macra/app-store-screenshots/04-label-scanner.png',
    caption: 'Label grading, concern flags, alternatives, and saved scan behavior.',
  },
  {
    title: 'Ask Nora',
    file: '05-ask-nora.png',
    path: '/system-overview/macra/app-store-screenshots/05-ask-nora.png',
    caption: 'Day-aware nutrition chat built from meals, targets, and short thread history.',
  },
  {
    title: 'Macra Plus',
    file: '06-macra-plus.png',
    path: '/system-overview/macra/app-store-screenshots/06-macra-plus.png',
    caption: 'Premium access frame for AI logging, planning, label scans, and coaching.',
  },
];

const SYSTEM_SHAPE_ROWS = [
  ['App shell', 'SwiftUI app routes through splash, intro, onboarding, subscription checks, then the nutrition shell.'],
  ['Tabs', 'Journal, Plan, Scan, Supps, and More are the primary home surfaces.'],
  ['AI boundary', 'Macra never sends provider keys from the client. GPTService posts Firebase-authenticated requests to the web bridge.'],
  ['Data boundary', 'Macra owns nested nutrition collections and only patches explicit Macra-owned root user fields.'],
  ['Release assets', 'The public overview now stores the final 6.5-inch screenshot set at 1242 x 2688 PNG.'],
];

const FEATURE_ROWS = [
  ['Food journal', 'users/{uid}/mealLogs', 'Text, voice, photo, history, and pinned meal entry paths.'],
  ['Label scanner', 'users/{uid}/labelScans + pinnedLabelScans', 'Nutrition and supplement label analysis with storage-backed images.'],
  ['Meal planning', 'meal-plan + macro-profile/{uid}/macro-recommendations', 'Nora macro assessment, active plan editing, and archived generated plans.'],
  ['Ask Nora', 'users/{uid}/noraChat', 'Daily Q&A over meals, macro targets, goals, and recent chat history.'],
  ['Supplements', 'users/{uid}/savedSupplements + supplementLogs', 'Saved supplement library plus per-day intake logging.'],
  ['Access', 'users subscription mirror + RevenueCat entitlement', 'Plus entitlement, StoreKit fallback, and beta access handling.'],
];

const BRIDGE_ROWS = [
  ['openai-bridge.ts', 'Generic authenticated OpenAI proxy with Macra feature limits for meal plans and Nora nutrition chat.'],
  ['generate-macra-meal-plan.ts', 'Server-authenticated plan generation and cache/archive path for Nora-created plans.'],
  ['nora-nutrition-chat.ts', 'Builds day context from meals, macro target, goal, and history before calling the bridge.'],
  ['GPTService.swift', 'Client-side bridge caller for meal analysis, label analysis, Nora macro assessment, and image/text prompts.'],
];

const CONTRACTS = [
  'Root users/{uid} documents are shared across products; Macra must patch explicit fields instead of writing a full user model over an existing document.',
  'Macra profile answers live at users/{uid}/macra/profile so nutrition onboarding can evolve without breaking Fit With Pulse or Pulse Check profile semantics.',
  'AI calls require a Firebase ID token and route through the website base URL to keep OpenAI credentials server-side.',
  'Label scan imagery uses the label-scans storage folder and should remain tied to scan documents or pinned scan summaries.',
  'Screenshot exports are release artifacts, not live simulator captures; regenerate from the Macra Playwright harness when the product story changes.',
];

const SOURCE_ROWS = [
  ['Macra app shell', '../Macra/Macra/AppCoordinator.swift'],
  ['Home nutrition surfaces', '../Macra/Macra/View/Screens/Home/HomeView.swift'],
  ['Shared nutrition collections', '../Macra/Macra/NutritionCore/NutritionCoreSupport.swift'],
  ['Macra user write boundary', '../Macra/Macra/Services/UserService.swift'],
  ['OpenAI bridge client', '../Macra/Macra/Services/GPTService.swift'],
  ['Locked screenshot assets', 'public/system-overview/macra/app-store-screenshots'],
];

const MacraSystemOverviewTab: React.FC = () => {
  return (
    <div className="space-y-10">
      <DocHeader
        eyebrow="Macra System Overview"
        title="Macra Nutrition AI"
        version="System overview v1.0 | April 21, 2026"
        summary="Macra is the standalone SwiftUI nutrition AI app in the Pulse ecosystem. It gives users a daily macro cockpit, AI meal logging, label scanning, Nora meal planning, supplement tracking, and subscription-gated Plus access while respecting the shared Pulse user-document contract."
        highlights={[
          {
            title: 'Native Nutrition Shell',
            body: 'Journal, Plan, Scan, Supps, and More form the five-tab runtime for daily macro behavior.',
          },
          {
            title: 'Nora Through A Server Bridge',
            body: 'Meal analysis, label analysis, macro assessment, and chat all route through authenticated web functions.',
          },
          {
            title: 'Screenshots Locked',
            body: 'The App Store screenshot set is now stored in this repo at the 6.5-inch 1242 x 2688 requirement.',
          },
        ]}
      />

      <RuntimeAlignmentPanel
        role="Canonical overview for how Macra fits into the Pulse system, which data it owns, how Nora reaches AI services, and which release assets are currently locked."
        sourceOfTruth="This tab documents the Macra product contract inside the System Overview. The Macra repo remains the runtime source of truth for SwiftUI implementation, models, and the Playwright screenshot harness."
        masterReference="Use this page when changing Macra onboarding, nutrition collections, AI bridge behavior, RevenueCat access, label scan persistence, or App Store release assets."
        relatedDocs={['Product Handbooks', 'Backend and Data', 'Integrations', 'End-to-End Flows', 'users.write-contract']}
      />

      <SectionBlock icon={FileImage} title="Locked App Store Screenshot Set">
        <div className="flex flex-wrap gap-2">
          <InlineTag label="6 screenshots" color="green" />
          <InlineTag label="1242 x 2688" color="blue" />
          <InlineTag label="6.5-inch display" color="purple" />
          <InlineTag label="Dummy data" color="amber" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {SCREENSHOTS.map((screenshot) => (
            <article key={screenshot.file} className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#090f1c]">
              <div className="border-b border-zinc-800 bg-black/30 px-4 py-3">
                <p className="text-sm font-semibold text-white">{screenshot.title}</p>
                <p className="mt-1 font-mono text-[11px] text-zinc-500">{screenshot.file}</p>
              </div>
              <div className="bg-black/40 p-3">
                <div className="mx-auto aspect-[1242/2688] max-h-[520px] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl shadow-black/40">
                  <img
                    src={screenshot.path}
                    alt={`Macra App Store screenshot - ${screenshot.title}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
              <p className="border-t border-zinc-800 px-4 py-3 text-sm leading-relaxed text-zinc-400">
                {screenshot.caption}
              </p>
            </article>
          ))}
        </div>
      </SectionBlock>

      <SectionBlock icon={Smartphone} title="System Shape">
        <CardGrid columns="xl:grid-cols-3">
          <InfoCard
            title="What Macra Is"
            accent="green"
            body="A nutrition-specific iOS app that turns daily eating into a guided macro operating system: journal, scan, plan, ask Nora, and manage access."
          />
          <InfoCard
            title="Where It Lives"
            accent="blue"
            body="Runtime code lives in the Macra repo. The web repo owns bridge functions, system documentation, public release assets, and the marketing surface."
          />
          <InfoCard
            title="What Must Stay True"
            accent="amber"
            body="Macra can read the shared user profile, but its nutrition state should live in Macra-owned subcollections and nested profile documents."
          />
        </CardGrid>
        <DataTable columns={['Layer', 'Current Contract']} rows={SYSTEM_SHAPE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Utensils} title="Product Capabilities">
        <DataTable columns={['Capability', 'Primary Data Path', 'Runtime Meaning']} rows={FEATURE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Sparkles} title="Nora And AI Bridge">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Client Request Shape"
            accent="purple"
            body="Macra sends OpenAI-style chat completion payloads with a Firebase ID token and a feature label in the openai-organization header. The client never owns provider credentials."
          />
          <InfoCard
            title="Server Responsibility"
            accent="blue"
            body="Netlify functions verify auth, apply feature-level token/model limits, assemble nutrition context where needed, and forward only approved payloads to OpenAI."
          />
        </CardGrid>
        <DataTable columns={['Runtime File', 'Responsibility']} rows={BRIDGE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={Database} title="Data Ownership">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Nested Macra Profile"
            accent="green"
            body="Onboarding answers are saved at users/{uid}/macra/profile. This keeps goal and routine data out of the crowded root user document."
          />
          <InfoCard
            title="Root User Patch Rule"
            accent="red"
            body="Existing users must only receive explicit root-user field patches, such as hasCompletedMacraOnboarding or macra.betaAccess. Do not merge a full User model from Macra."
          />
        </CardGrid>
        <BulletList items={CONTRACTS} />
      </SectionBlock>

      <SectionBlock icon={ScanLine} title="Scanner, Pins, And History">
        <CardGrid columns="xl:grid-cols-3">
          <InfoCard
            title="Label History"
            accent="blue"
            body="Label scans persist under users/{uid}/labelScans with parsed grade, macro, ingredient, concern, and image metadata."
          />
          <InfoCard
            title="Pinned Library"
            accent="purple"
            body="Pinned label scans and pinned food snaps are separate quick-add summaries, so repeat choices do not mutate the original scan or meal record."
          />
          <InfoCard
            title="Storage Folder"
            accent="amber"
            body="Label scan images use the label-scans storage folder and should remain tied to the corresponding scan document."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={MessageCircle} title="Ask Nora Runtime">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Daily Thread"
            accent="green"
            body="Ask Nora stores one dated chat stream under users/{uid}/noraChat. The home surface loads today or the selected date and appends user and assistant messages."
          />
          <InfoCard
            title="Context Window"
            accent="blue"
            body="The nutrition chat function summarizes meals, daily macro totals, optional targets, goal text, and recent history before asking Nora to answer."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={CreditCard} title="Access And Subscriptions">
        <CardGrid columns="xl:grid-cols-3">
          <InfoCard
            title="RevenueCat Plus"
            accent="green"
            body="Plus entitlement state is resolved through RevenueCat first, with supported monthly and annual product identifiers."
          />
          <InfoCard
            title="StoreKit Fallback"
            accent="blue"
            body="PurchaseService checks current and latest StoreKit transactions so paid access can recover when RevenueCat state lags."
          />
          <InfoCard
            title="Beta Path"
            accent="purple"
            body="Local beta access and Macra-owned root markers can grant access during controlled beta rollout."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={ShieldCheck} title="Operational Guardrails">
        <CardGrid columns="xl:grid-cols-2">
          <InfoCard
            title="Schema Safety"
            accent="red"
            body="Treat the shared root user record as a platform contract. Macra additions should be nested, explicit, and patch-only."
          />
          <InfoCard
            title="Release Safety"
            accent="amber"
            body="When App Store copy, feature order, or product story changes, regenerate screenshots from the Macra Playwright harness and replace this locked public asset set."
          />
          <InfoCard
            title="Bridge Safety"
            accent="purple"
            body="Feature limits in the bridge should be kept aligned with Macra client labels so one route cannot silently consume another feature's budget."
          />
          <InfoCard
            title="Review Mode"
            accent="blue"
            body="The Macra app includes a review screenshot mode for paywall capture; keep it deterministic for App Store review assets."
          />
        </CardGrid>
      </SectionBlock>

      <SectionBlock icon={Camera} title="Implementation References">
        <DataTable columns={['Area', 'Source']} rows={SOURCE_ROWS} />
      </SectionBlock>

      <SectionBlock icon={LockKeyhole} title="Definition Of Locked">
        <InfoCard
          title="Current Lock"
          accent="green"
          body="The System Overview now owns a Macra tab, the typed Macra product handbook, the Macra end-to-end flow, and the App Store screenshot PNG set copied into public assets at the required dimensions."
        />
      </SectionBlock>
    </div>
  );
};

export default MacraSystemOverviewTab;
