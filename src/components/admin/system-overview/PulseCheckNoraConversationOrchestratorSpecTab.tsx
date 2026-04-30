import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-5">
    <h3 className="mb-2 text-base font-semibold text-zinc-100">{title}</h3>
    <div className="space-y-2 text-sm text-zinc-300">{children}</div>
  </div>
);

const Card: React.FC<{ title: string; children: React.ReactNode; tone?: 'doctrine' | 'neutral' }> = ({ title, children, tone = 'neutral' }) => (
  <div className={`rounded-2xl border p-4 ${
    tone === 'doctrine' ? 'border-violet-700/40 bg-violet-950/20' : 'border-zinc-800 bg-zinc-950/40'
  }`}>
    <h4 className="mb-2 text-sm font-semibold text-zinc-100">{title}</h4>
    <div className="space-y-2 text-sm text-zinc-300">{children}</div>
  </div>
);

const PulseCheckNoraConversationOrchestratorSpecTab: React.FC = () => (
  <div className="text-zinc-100">
    <header className="mb-6 rounded-2xl border border-violet-700/30 bg-gradient-to-br from-violet-950/30 to-indigo-950/30 p-6">
      <p className="text-xs uppercase tracking-wide text-violet-300">PulseCheck · Phase D</p>
      <h2 className="mt-1 text-2xl font-bold">Nora Conversation Orchestrator</h2>
      <p className="mt-2 max-w-3xl text-sm text-zinc-300">
        Reactive trigger sweep + conversation state machine. Detects when to open a conversation, fires the opener,
        ingests athlete replies, dispatches probes / action delivery via Phase C voice translation.
      </p>
    </header>

    <Section title="Doctrine">
      <Card tone="doctrine" title="Reactive only — proactive lives in Phase I">
        <p>The Curriculum Layer fires daily regardless of state. The Conversation Orchestrator fires ONLY when one of the
        4 triggers below detects a state change worth speaking up about.</p>
      </Card>
      <Card tone="doctrine" title="Voice always flows through Phase C">
        <p>Phase D supplies the SHAPE (opener / probe / action). Phase C supplies the VOICE. Action delivery turns are
        always wrapped in <code className="rounded bg-black/40 px-1">translateForAthlete()</code> with full guardrail
        post-processing.</p>
      </Card>
      <Card tone="doctrine" title="One trigger fires once per athlete per day">
        <p>Dedupe lives at the trigger-fire layer (<code className="rounded bg-black/40 px-1">pulsecheck-nora-trigger-fires</code>),
        keyed by <code className="rounded bg-black/40 px-1">{`{athleteUserId}_{trigger}_{dayKey}`}</code>. Re-runs of the
        scheduler in the same window will not re-open a conversation.</p>
      </Card>
    </Section>

    <Section title="The 4 triggers">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="coach-context-flag">
          <p>Coach sets a flag (e.g. competition weekend) that hasn't been consumed. Lookback: 36 hours. Source: <code className="rounded bg-black/40 px-1">pulsecheck-coach-context-flags</code>.</p>
        </Card>
        <Card title="hcsr-delta-detected">
          <p>Latest snapshot circadianDisruption band stepped to travel_signature/jetlag, OR autonomic load minutes ≥ 360, OR sleep efficiency dropped &gt;15% vs 7d baseline.</p>
        </Card>
        <Card title="calendar-sport-event">
          <p>Athlete has a competition/game/tournament in the next 36 hours. Source: <code className="rounded bg-black/40 px-1">pulsecheck-athlete-calendar-events</code>.</p>
        </Card>
        <Card title="behavioral-drift">
          <p>No engagement (completion event, chat reply) in last 5 days. Source: <code className="rounded bg-black/40 px-1">pulsecheck-assignment-events</code>.</p>
        </Card>
      </div>
    </Section>

    <Section title="State machine">
      <Card title="Transitions">
        <p><strong>opened</strong> → opener push sent. Awaiting first reply.</p>
        <p><strong>awaiting-reply</strong> → probe pushed after first reply. Awaiting classified reply.</p>
        <p><strong>action-delivered</strong> → final translated guidance delivered. Conversation closed.</p>
        <p><strong>closed-no-reply</strong> → athlete never engaged. Conversation closed by timeout sweep.</p>
        <p><strong>closed-revoked</strong> → operator killed via Nora Guard.</p>
      </Card>
    </Section>

    <Section title="Reply classification">
      <Card title="Anthropic Haiku 4.5 + keyword fallback">
        <p>Athlete replies are classified into a state bucket (e.g., sleep × debt) by Haiku 4.5 with a domain-specific system prompt. If the model fails or returns unrecognized output, a keyword heuristic in <code className="rounded bg-black/40 px-1">orchestrator.ts:keywordFallback</code> takes over.</p>
        <p>The classified bucket is the <code className="rounded bg-black/40 px-1">state</code> param fed into <code className="rounded bg-black/40 px-1">translateForAthlete()</code> for the action delivery turn.</p>
      </Card>
    </Section>

    <Section title="Architecture">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Reads">
          <ul className="list-disc pl-5">
            <li>health-context-snapshots (HCSR-delta detector)</li>
            <li>pulsecheck-coach-context-flags</li>
            <li>pulsecheck-athlete-calendar-events</li>
            <li>pulsecheck-assignment-events (behavioral-drift detector)</li>
            <li>pulsecheck-conversation-tree (Phase B-seeded branches)</li>
          </ul>
        </Card>
        <Card title="Writes">
          <ul className="list-disc pl-5">
            <li>pulsecheck-nora-conversations</li>
            <li>pulsecheck-nora-trigger-fires (dedupe)</li>
            <li>pulsecheck-nora-translation-log (via Phase C)</li>
          </ul>
        </Card>
      </div>
    </Section>

    <Section title="Endpoints">
      <Card title="Server-side">
        <ul className="list-disc pl-5">
          <li><code className="rounded bg-black/40 px-1">netlify/functions/scheduled-nora-conversation.ts</code> — 30-min cron sweep</li>
          <li><code className="rounded bg-black/40 px-1">netlify/functions/nora-athlete-reply.ts</code> — POST endpoint, athlete-authenticated, advances state</li>
        </ul>
      </Card>
    </Section>
  </div>
);

export default PulseCheckNoraConversationOrchestratorSpecTab;
