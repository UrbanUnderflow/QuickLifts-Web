import React from 'react';
import {
  ShieldCheck,
  HeartHandshake,
  Eye,
  EyeOff,
  Lock,
  MessageCircle,
  Users,
  Scale,
  BookMarked,
  Sparkles,
  CheckCircle2,
  CircleHelp,
} from 'lucide-react';

// PulseCheck · Nora-Moderated Check-In research + design spec.
// Locked into the System Overview so the trust model and its grounding in
// therapeutic-mediation + sports-psychology research are documented for future
// white-papering and to keep every feature defensibly evidence-based.

type Principle = { title: string; body: string };
const PRINCIPLES: Principle[] = [
  {
    title: 'Confidence is held, never spent',
    body: "Nora never repeats what an athlete told her in 1:1 conversation. At the highest-stakes moment — in front of the coach — she visibly keeps the confidence. Watching that happen is what earns trust, rather than spending it.",
  },
  {
    title: 'Public signal vs. private content',
    body: "Nora may name what the coach can already see (readiness dip, check-in gaps, mood trend). She never names the private 'why' from her conversations. She only invites the athlete to bridge from the visible signal to the rest, if they choose.",
  },
  {
    title: 'Agency before access',
    body: 'The athlete consents to the conversation starting, and owns every disclosure inside it. A check-in is an invitation with exit ramps, never a summons.',
  },
  {
    title: 'Moderator, not messenger',
    body: 'Nora is a visible, neutral third party both the coach and the athlete can lean on — owned by neither. She manages the process (tone, turns, safety), not the disclosure of content.',
  },
  {
    title: 'Power-aware by design',
    body: 'A coach holds real power over an athlete (selection, belonging). Moderation must protect the lower-power party: agency, consent, exit ramps, and never letting non-disclosure cost the athlete with the coach.',
  },
  {
    title: 'Close the loop',
    body: 'Every check-in ends with a shared next step, and Nora quietly tracks whether it happened — turning a conversation into follow-through.',
  },
];

type DisclosureRow = { signal: string; noraMay: string; noraMayNot: string };
const DISCLOSURE: DisclosureRow[] = [
  {
    signal: 'Readiness / mood trend (dashboard-visible)',
    noraMay: 'Reference it to open: "Coach noticed your readiness dipped this week."',
    noraMayNot: '—',
  },
  {
    signal: 'Check-in frequency / gaps (dashboard-visible)',
    noraMay: 'Reference it as context for the outreach.',
    noraMayNot: '—',
  },
  {
    signal: 'The private "why" from 1:1 chats (sleep, home life, the spiral)',
    noraMay: 'Privately encourage the athlete to share it themselves.',
    noraMayNot: 'Never state it in the shared conversation.',
  },
  {
    signal: 'Specific quotes / transcripts',
    noraMay: 'Surface trend-level themes only, with consent.',
    noraMayNot: 'Never reproduce the athlete’s words to the coach.',
  },
];

type Phase = {
  n: string;
  title: string;
  body: string;
  grounding: string;
};
const FLOW: Phase[] = [
  {
    n: '0',
    title: 'Coach initiates — nothing reaches the athlete yet',
    body: 'The coach taps "Check in now." No content is exposed; the athlete is not yet pinged. The coach’s card reflects a soft "Nora is checking in" state.',
    grounding: 'Power-aware design · Autonomy support (SDT)',
  },
  {
    n: '1',
    title: 'Nora privately preps the athlete',
    body: 'In a 1:1, Nora frames the moment and offers agency: "Coach wants to check in. I know it’s been a heavy week — this could be a good chance to let them in, even a little. Totally your call."',
    grounding: 'Softened startup (Gottman) · Pre-session priming · Motivational interviewing',
  },
  {
    n: '2',
    title: 'Explicit confidence promise',
    body: 'Nora states the rule out loud, once: "I never share what you tell me — I only help you share it yourself." Saying it is itself a trust deposit. (Locked decision.)',
    grounding: 'Confidentiality policy (AAMFT) · Trust-capital thesis',
  },
  {
    n: '3',
    title: 'Consent to start',
    body: 'Athlete chooses: Yes / Not now / Just talk to Nora first. Declining never reads to the coach as a refusal.',
    grounding: 'Self-determination (autonomy) · Informed consent',
  },
  {
    n: '4',
    title: 'Coach sees "Nora is checking in"',
    body: 'The coach gets a soft status, never "athlete declined you." Honesty by the athlete is never punished with the coach. (Locked decision.)',
    grounding: 'Power-aware design · Psychological safety (Edmondson)',
  },
  {
    n: '5',
    title: 'Three-way opens with a softened start',
    body: 'Nora goes first and names only the public signal, then invites: "Coach noticed your readiness has dipped this week and wanted to check in — anything you want to share?"',
    grounding: 'Softened startup (Gottman) · Process-not-content (EFT)',
  },
  {
    n: '6',
    title: 'Athlete-led disclosure',
    body: 'The athlete bridges from the visible signal to the private content at their own pace. Nora can name that "something exists" worth raising without naming what.',
    grounding: 'Autonomy support · Affect labeling ("name it to tame it")',
  },
  {
    n: '7',
    title: 'Nora facilitates',
    body: 'She keeps turns, softens a blunt coach message before it lands, surfaces the underlying need, and slows the exchange if it heats up.',
    grounding: 'EFT de-escalation · Repair attempts (Gottman) · Speaker–Listener (PREP)',
  },
  {
    n: '8',
    title: 'Close the loop',
    body: 'A shared next step is agreed; Nora logs it and later checks whether it happened, then reports follow-through (not content) to the coach.',
    grounding: 'Behavior change · Adherence psychology',
  },
];

type Citation = { framework: string; authors: string; maps: string };
const CITATIONS: Citation[] = [
  {
    framework: 'Emotionally Focused Therapy (EFT)',
    authors: 'Sue Johnson',
    maps: 'Nora facilitates the process and underlying emotion/need rather than disclosing facts; de-escalation as a core move.',
  },
  {
    framework: 'Sound Relationship House — softened startup & repair attempts',
    authors: 'John & Julie Gottman',
    maps: 'How a hard conversation opens predicts how it ends. Nora’s private prep + gentle ice-break = softened startup; intercepting harsh messages = repair attempts.',
  },
  {
    framework: 'Multidirected partiality (Contextual Therapy)',
    authors: 'Iván Böszörményi-Nagy',
    maps: 'The mediator is "for" everyone in turn — caring to both, owned by neither. Defines Nora’s neutral-middle stance.',
  },
  {
    framework: 'Speaker–Listener Technique (PREP)',
    authors: 'Markman, Stanley & Blumberg',
    maps: 'Structured turns keep the exchange from becoming a pile-on; Nora holds the frame.',
  },
  {
    framework: 'Confidentiality / "no-secrets" policy in conjoint work',
    authors: 'AAMFT Code of Ethics',
    maps: 'Private (individual) content is held by the clinician and not revealed to the other party. Grounds the disclosure model and the explicit confidence promise.',
  },
  {
    framework: 'Self-Determination Theory',
    authors: 'Deci & Ryan',
    maps: 'Autonomy and agency drive internalized motivation and adherence — the basis for consent gates, exit ramps, and "your call" framing.',
  },
  {
    framework: 'Autonomy-supportive vs. controlling coaching',
    authors: 'Mageau & Vallerand; Jowett (3+1 Cs)',
    maps: 'Autonomy-supportive coaching improves motivation; controlling behavior harms it. Nora protects athlete autonomy against the coach’s power gradient.',
  },
  {
    framework: 'Psychological safety',
    authors: 'Amy Edmondson',
    maps: 'Athletes disclose only where it is safe to do so; never punishing honesty (no "declined" to coach) preserves safety.',
  },
  {
    framework: 'Motivational Interviewing',
    authors: 'Miller & Rollnick',
    maps: 'Eliciting and autonomy-supportive prompting (avoiding the "righting reflex"): Nora invites rather than tells.',
  },
  {
    framework: 'Affect labeling',
    authors: 'Lieberman et al. (neuroscience)',
    maps: 'Putting feelings into words down-regulates amygdala threat response; Nora helping athletes articulate is regulating, not just expressive.',
  },
  {
    framework: 'Co-regulation / safety & social engagement',
    authors: 'Porges (Polyvagal theory)',
    maps: 'A calm, trusted third presence lowers threat physiology, opening the prefrontal capacity needed for an honest conversation.',
  },
];

const DECISIONS = [
  'Explicit confidence promise — Nora states "I never share what you tell me, I only help you share it yourself" out loud, once, at check-in.',
  'Soft coach status — the coach sees "Nora is checking in," never "athlete declined." Honesty is never punished.',
  'Disclosure line — public (dashboard-visible) signal is nameable; private 1:1 content is athlete-owned and only ever athlete-disclosed.',
];

const SURFACES = [
  ['Coach dashboard (web)', 'Check-in trigger + "Nora is checking in" soft state on the readiness card.', 'In progress'],
  ['Athlete app', 'Nora private prep, confidence promise, consent gate, then the 3-way room.', 'Spec’d'],
  ['Nora orchestration', 'Moderator logic: disclosure guardrails, softened startup, tone/repair, loop close.', 'Spec’d'],
  ['Messaging infrastructure', '3-way thread model with Nora as a first-class participant.', 'Spec’d'],
];

const OPEN_QUESTIONS = [
  'Default Nora mode at launch: co-pilot (athlete sees only coach) vs. visible 3-way. Leaning visible-moderator for trust, co-pilot as a fallback.',
  'How "Nora is checking in" expires / nudges if the athlete doesn’t respond, without becoming pressure.',
  'Escalation interaction: for Tier 2/3, the check-in becomes a guided, safety-first outreach rather than open chat.',
];

const PulseCheckModeratedCheckInSpecTab: React.FC = () => {
  return (
    <div className="space-y-8">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <HeartHandshake className="h-4 w-4 text-violet-400" />
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-400">
            PulseCheck · Coach ↔ Athlete Trust
          </p>
        </div>
        <h2 className="text-xl font-semibold text-white">Nora-Moderated Check-In</h2>
        <p className="mt-1 max-w-3xl text-sm text-zinc-400">
          A trust-preserving model for the coach’s "Check in now" action, in which Nora acts as a neutral
          moderator between coach and athlete. This spec documents the disclosure model, the end-to-end flow, the
          locked design decisions, and the therapeutic-mediation and sports-psychology research the design is
          grounded in.
        </p>
      </div>

      {/* Thesis */}
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.07] p-5">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
          <div>
            <p className="mb-1 text-sm font-semibold text-white">Trust-capital thesis</p>
            <p className="text-sm leading-relaxed text-zinc-300">
              The reflexive design — dumping what the athlete confided into the coach conversation — is an immediate
              loss of trust. The bridge: the moment Nora <span className="font-semibold text-white">declines</span> to
              disclose, out loud and in front of the coach, is the moment trust is <span className="font-semibold text-white">earned
              in public</span>. The athlete watches the system keep a promise at the highest-stakes moment. Withholding
              is the feature, not a limitation.
            </p>
          </div>
        </div>
      </div>

      {/* Principles */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-200">Core Principles</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="rounded-xl border border-zinc-800 bg-[#090f1c] p-4">
              <p className="text-sm font-semibold text-white">{p.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{p.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Disclosure model */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-200">
          <Eye className="h-4 w-4 text-emerald-400" /> Disclosure Model
        </h3>
        <div className="overflow-hidden rounded-2xl border border-zinc-800">
          <div className="grid grid-cols-[1.3fr_1.3fr_1fr] gap-0 border-b border-zinc-800 bg-zinc-800/40 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
            <div>Information</div>
            <div>Nora may</div>
            <div>Nora may not</div>
          </div>
          {DISCLOSURE.map((row) => (
            <div key={row.signal} className="grid grid-cols-[1.3fr_1.3fr_1fr] gap-0 border-b border-zinc-800/60 px-4 py-3 text-xs leading-5">
              <div className="pr-3 text-zinc-300">{row.signal}</div>
              <div className="flex items-start gap-1.5 pr-3 text-zinc-400">
                <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>{row.noraMay}</span>
              </div>
              <div className="flex items-start gap-1.5 text-zinc-400">
                {row.noraMayNot === '—' ? (
                  <span className="text-zinc-600">—</span>
                ) : (
                  <>
                    <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                    <span>{row.noraMayNot}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Flow */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-200">
          <MessageCircle className="h-4 w-4 text-violet-400" /> End-to-End Flow
        </h3>
        <div className="space-y-2">
          {FLOW.map((phase) => (
            <div key={phase.n} className="flex gap-3 rounded-xl border border-zinc-800 bg-[#090f1c] p-4">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-300">
                {phase.n}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{phase.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{phase.body}</p>
                <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-zinc-800/60 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                  <BookMarked className="h-3 w-3 text-violet-400" /> {phase.grounding}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Locked decisions */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className="mb-2 text-sm font-semibold text-white">Locked Decisions</p>
            <div className="space-y-2">
              {DECISIONS.map((d) => (
                <div key={d} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <p className="text-sm leading-relaxed text-zinc-300">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Power asymmetry */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] p-5">
        <div className="flex items-start gap-3">
          <Scale className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="mb-1 text-sm font-semibold text-white">Why this is more than couples mediation</p>
            <p className="text-sm leading-relaxed text-zinc-300">
              Couples are roughly peers; a coach holds real power over an athlete (selection, playing time, belonging).
              Nora’s moderation is therefore power-aware: the lower-power party always gets the agency, the consent
              gate, and the exit ramp, and the athlete must never feel that <span className="italic">not</span> opening
              up costs them with the coach. Protecting athlete autonomy is precisely what keeps the coach’s power
              from poisoning the channel — and what makes athletes willing to open up at all.
            </p>
          </div>
        </div>
      </div>

      {/* Research foundations */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-200">
          <Sparkles className="h-4 w-4 text-violet-400" /> Research Foundations
        </h3>
        <p className="mb-3 max-w-3xl text-xs text-zinc-500">
          Theoretical grounding for the moderation model. Cited at the framework level as the evidentiary basis for the
          design; specific in-product effect sizes will come from PulseCheck pilots.
        </p>
        <div className="space-y-2">
          {CITATIONS.map((c) => (
            <div key={c.framework} className="rounded-xl border border-zinc-800 bg-[#090f1c] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-white">{c.framework}</p>
                <p className="text-[11px] font-medium text-violet-300">{c.authors}</p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{c.maps}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Implementation surfaces */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-200">
          <Users className="h-4 w-4 text-emerald-400" /> Implementation Surfaces
        </h3>
        <div className="overflow-hidden rounded-2xl border border-zinc-800">
          <div className="grid grid-cols-[1fr_1.6fr_0.6fr] border-b border-zinc-800 bg-zinc-800/40 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
            <div>Surface</div>
            <div>Responsibility</div>
            <div>Status</div>
          </div>
          {SURFACES.map(([surface, resp, status]) => (
            <div key={surface} className="grid grid-cols-[1fr_1.6fr_0.6fr] border-b border-zinc-800/60 px-4 py-3 text-xs leading-5">
              <div className="pr-3 font-medium text-zinc-200">{surface}</div>
              <div className="pr-3 text-zinc-400">{resp}</div>
              <div className="text-zinc-400">{status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Open questions */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-200">
          <CircleHelp className="h-4 w-4 text-amber-400" /> Open Questions
        </h3>
        <div className="space-y-2">
          {OPEN_QUESTIONS.map((q) => (
            <div key={q} className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-[#090f1c] p-3">
              <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-xs leading-relaxed text-zinc-300">{q}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PulseCheckModeratedCheckInSpecTab;
