import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-5">
    <h3 className="mb-2 text-base font-semibold text-zinc-100">{title}</h3>
    <div className="space-y-2 text-sm text-zinc-300">{children}</div>
  </div>
);

const Card: React.FC<{ title: string; children: React.ReactNode; tone?: 'doctrine' | 'neutral' | 'warn' }> = ({
  title,
  children,
  tone = 'neutral',
}) => (
  <div className={`rounded-2xl border p-4 ${
    tone === 'doctrine' ? 'border-violet-700/40 bg-violet-950/20' :
    tone === 'warn' ? 'border-amber-700/40 bg-amber-950/20' :
    'border-zinc-800 bg-zinc-950/40'
  }`}>
    <h4 className="mb-2 text-sm font-semibold text-zinc-100">{title}</h4>
    <div className="space-y-2 text-sm text-zinc-300">{children}</div>
  </div>
);

const PulseCheckAdaptiveFramingLayerSpecTab: React.FC = () => (
  <div className="text-zinc-100">
    <header className="mb-6 rounded-2xl border border-violet-700/30 bg-gradient-to-br from-violet-950/30 to-indigo-950/30 p-6">
      <p className="text-xs uppercase tracking-wide text-violet-300">PulseCheck · Phases B/C/E</p>
      <h2 className="mt-1 text-2xl font-bold">Adaptation Framing Layer</h2>
      <p className="mt-2 max-w-3xl text-sm text-zinc-300">
        Athlete-safe translation layer that turns structured state and physiology signals into Nora-voice guidance
        without exposing biomarker numbers, diagnostic labels, or negative-priming language.
      </p>
    </header>

    <Section title="Current Runtime Truth">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Anthropic Primary">
          <p>
            <code className="rounded bg-black/40 px-1">translateForAthlete()</code> calls Claude using the
            <code className="mx-1 rounded bg-black/40 px-1">noraAthleteTranslation</code> feature config. The model is
            currently pinned through <code className="rounded bg-black/40 px-1">src/api/anthropic/featureRouting.ts</code>.
          </p>
        </Card>
        <Card title="Seed Fallback, Not OpenAI">
          <p>
            If Claude errors, a translation row is missing, or guardrails reject the output, the athlete receives the
            seeded <code className="rounded bg-black/40 px-1">athletePhrasing</code>. This lane intentionally does not
            use OpenAI fallback.
          </p>
        </Card>
        <Card title="Guardrail Enforcement">
          <p>
            Guardrails reject numeric units, forbidden phrase patterns, negative priming, missing action verbs, and
            out-of-bounds sentence count before any athlete-facing action line ships.
          </p>
        </Card>
        <Card title="Audit Log">
          <p>
            Production calls write <code className="rounded bg-black/40 px-1">pulsecheck-nora-translation-log</code>
            with provider, fallback reason, guardrail results, seed phrasing, raw Claude output, row revision, and
            optional context.
          </p>
        </Card>
      </div>
    </Section>

    <Section title="Anthropic Bridge Boundary">
      <Card title="Two Access Patterns">
        <p>
          Server code can call the Anthropic SDK directly. Browser or iOS proxy use goes through
          <code className="mx-1 rounded bg-black/40 px-1">/api/anthropic/*</code>, which Netlify redirects to
          <code className="mx-1 rounded bg-black/40 px-1">netlify/functions/anthropic-bridge.ts</code>.
        </p>
        <p>
          The bridge verifies Firebase auth, enforces the per-feature model pattern and max-token cap, and can relay
          local development requests to the deployed bridge when a local Anthropic key is absent.
        </p>
      </Card>
    </Section>

    <Section title="Source Collections">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Reads">
          <ul className="list-disc pl-5">
            <li><code className="rounded bg-black/40 px-1">pulsecheck-translation-table</code></li>
            <li><code className="rounded bg-black/40 px-1">pulsecheck-translation-off-limits/current</code></li>
            <li>structured signal payload supplied by state, sports intelligence, or Nora conversation orchestration</li>
          </ul>
        </Card>
        <Card title="Writes">
          <ul className="list-disc pl-5">
            <li><code className="rounded bg-black/40 px-1">pulsecheck-nora-translation-log</code></li>
            <li><code className="rounded bg-black/40 px-1">pulsecheck-bridge-fallback-log</code> for dual-path non-translation features</li>
          </ul>
        </Card>
      </div>
    </Section>

    <Section title="Remaining Gaps">
      <Card tone="warn" title="Nora Guard Kill Switch Is Not Yet Server-Enforced">
        <p>
          The admin surface can toggle <code className="rounded bg-black/40 px-1">pulsecheck-nora-guard-config/current</code>,
          but <code className="rounded bg-black/40 px-1">translateForAthlete()</code> still logs full translation entries
          whenever <code className="rounded bg-black/40 px-1">persistLog</code> is true. Server-side enforcement is still needed.
        </p>
      </Card>
      <Card tone="warn" title="Opener and Probe Copy Are Still Tree Text">
        <p>
          The final action delivery turn uses this layer. Conversation openers and probes currently come from
          <code className="mx-1 rounded bg-black/40 px-1">pulsecheck-conversation-tree</code> rather than being rephrased
          through <code className="rounded bg-black/40 px-1">translateForAthlete()</code> on every send.
        </p>
      </Card>
    </Section>
  </div>
);

export default PulseCheckAdaptiveFramingLayerSpecTab;
