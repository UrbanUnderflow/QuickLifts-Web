import React from "react";
import {
  CheckCircle2,
  ClipboardList,
  Database,
  Eye,
  FileCheck2,
  GitBranch,
  Layers3,
  Scale,
  ShieldCheck,
  Target,
} from "lucide-react";

type DetailCard = {
  title: string;
  body: string;
  accent: string;
  icon: React.ReactNode;
};

const SOURCE_PATHS = {
  spec: "QuickLifts-Web/docs/agents/outcome-rubric-v1-spec.md",
};

const SPEC_CARDS: DetailCard[] = [
  {
    title: "Outcome classes",
    body:
      "The runtime now distinguishes terminal, enabling, learning, invalidation, and constraint outcomes so business movement, enabling capability, and negative learning cannot be scored as the same thing.",
    accent: "text-emerald-300",
    icon: <Target className="h-4 w-4" />,
  },
  {
    title: "Proof packet",
    body:
      "Execute work requires a machine-evaluable proof packet with source queries, metric refs, predicates, guardrails, and observation windows before it can enter the runnable queue.",
    accent: "text-cyan-300",
    icon: <FileCheck2 className="h-4 w-4" />,
  },
  {
    title: "Policy packs",
    body:
      "Ambiguous business language is replaced by versioned mission, domain, benchmark, risk, quality, and calibration policies that are resolved and snapshotted at evaluation time.",
    accent: "text-violet-300",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    title: "Score semantics",
    body:
      "Credited score, net score, and business debt are tracked separately so the system can distinguish visible wins from economics, downside, reversals, and hard failures.",
    accent: "text-amber-300",
    icon: <Scale className="h-4 w-4" />,
  },
  {
    title: "Outcome graph",
    body:
      "Parent-child outcomes, dependency edges, and deterministic rollup rules let the planner map enabling work and invalidations back to the terminal outcomes they support or de-risk.",
    accent: "text-fuchsia-300",
    icon: <GitBranch className="h-4 w-4" />,
  },
  {
    title: "Observation lifecycle",
    body:
      "Artifact completion does not automatically become business progress. Outcomes move through artifact-verified, observing, confirmed, reversed, expired, failed, waived, canceled, and superseded states.",
    accent: "text-lime-300",
    icon: <Eye className="h-4 w-4" />,
  },
];

const SPEC_OPERATING_RULES = [
  "Plan from target outcomes first, then generate execute tasks that point to one explicit target outcome.",
  "Reject execute work when proof compile, dry-run, policy resolution, or expected score thresholds do not pass.",
  "Keep artifact verification separate from outcome confirmation so shipped work cannot masquerade as business movement.",
  "Use deterministic identity, dedupe, contributor posting, and reversal math so one external event cannot produce inflated credit.",
];

function SourcePathCard({
  title,
  description,
  primaryPath,
}: {
  title: string;
  description: string;
  primaryPath: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/20 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-cyan-300" />
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <p className="text-sm text-zinc-300">{description}</p>
      <div className="space-y-3 text-sm">
        <div className="rounded-xl border border-zinc-800 bg-[#090f1c] p-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            Canonical source
          </p>
          <p className="mt-2 break-all font-mono text-cyan-200">{primaryPath}</p>
        </div>
      </div>
    </div>
  );
}

function DetailGridCard({ card }: { card: DetailCard }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
      <div className={`flex items-center gap-2 ${card.accent}`}>
        {card.icon}
        <h3 className="text-sm font-semibold text-white">{card.title}</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{card.body}</p>
    </article>
  );
}

export function AgentOutcomeRubricSpecTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 via-cyan-500/10 to-transparent p-6">
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-200">
            Frozen v1.0
          </span>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-200">
            Outcome-first runtime
          </span>
          <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-violet-200">
            Execute gate required
          </span>
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-white">
          Outcome Rubric v1
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-300">
          The frozen contract for how the swarm defines meaningful outcomes,
          evaluates proof, handles long-loop observation, and keeps business
          movement separate from agent narration or artifact completion.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr,0.9fr] gap-4">
        <SourcePathCard
          title="Frozen contract"
          description="This is the source of truth for implementation. Changes after this freeze require a versioned spec update instead of silent runtime drift."
          primaryPath={SOURCE_PATHS.spec}
        />
        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            <h3 className="text-lg font-semibold text-white">
              Frozen implementation rules
            </h3>
          </div>
          <ul className="list-disc space-y-3 pl-5 text-sm text-zinc-300">
            {SPEC_OPERATING_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
        {SPEC_CARDS.map((card) => (
          <DetailGridCard key={card.title} card={card} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-300" />
            <h3 className="text-lg font-semibold text-white">
              Planner expectation
            </h3>
          </div>
          <p className="text-sm leading-6 text-zinc-300">
            The planner must target a business outcome first, attach the proof
            design, resolve policy, estimate credited and net value, then emit
            execute work only when the gate is satisfiable.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-cyan-300" />
            <h3 className="text-lg font-semibold text-white">
              Runner expectation
            </h3>
          </div>
          <p className="text-sm leading-6 text-zinc-300">
            The runner verifies artifacts, records evidence, evaluates
            outcome-state transitions, and posts score deltas. It does not treat
            self-reported progress as confirmed business movement.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-black/20 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-violet-300" />
            <h3 className="text-lg font-semibold text-white">
              Reporting expectation
            </h3>
          </div>
          <p className="text-sm leading-6 text-zinc-300">
            Mission reporting must show credited outcomes, net value, business
            debt, observation queues, reversals, and contributor postings as
            separate accounting layers.
          </p>
        </div>
      </div>
    </div>
  );
}
