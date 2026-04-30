import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-5">
    <h3 className="mb-2 text-base font-semibold text-zinc-100">{title}</h3>
    <div className="space-y-2 text-sm text-zinc-300">{children}</div>
  </div>
);

const Card: React.FC<{ title: string; children: React.ReactNode; tone?: 'doctrine' | 'neutral' | 'warn' }> = ({ title, children, tone = 'neutral' }) => (
  <div className={`rounded-2xl border p-4 ${
    tone === 'doctrine' ? 'border-violet-700/40 bg-violet-950/20' :
    tone === 'warn' ? 'border-amber-700/40 bg-amber-950/20' :
    'border-zinc-800 bg-zinc-950/40'
  }`}>
    <h4 className="mb-2 text-sm font-semibold text-zinc-100">{title}</h4>
    <div className="space-y-2 text-sm text-zinc-300">{children}</div>
  </div>
);

const PulseCheckNoraGuardSpecTab: React.FC = () => (
  <div className="text-zinc-100">
    <header className="mb-6 rounded-2xl border border-violet-700/30 bg-gradient-to-br from-violet-950/30 to-indigo-950/30 p-6">
      <p className="text-xs uppercase tracking-wide text-violet-300">PulseCheck · Phase G</p>
      <h2 className="mt-1 text-2xl font-bold">Nora Guard</h2>
      <p className="mt-2 max-w-3xl text-sm text-zinc-300">
        Pilot-canary safety net. Full message-validation inbox where Pulse staff can read every Nora message + every
        athlete reply in dev/pilot. Disable post-pilot.
      </p>
    </header>

    <Section title="Doctrine">
      <Card tone="doctrine" title="Pilot canary, not permanent monitoring">
        <p>During the first 2 weeks of the pilot, every Nora message is logged in full. Staff can review for voice quality,
        guardrail bypass, and tone issues. After pilot, we can disable full-body logging via the kill switch.</p>
      </Card>
      <Card tone="doctrine" title="Athletes are informed via consent v6">
        <p>The consent doc bumped to v6 includes the disclosure: "During the pilot, Pulse staff may review messages
        between you and Nora to validate quality and safety." No silent surveillance.</p>
      </Card>
      <Card tone="warn" title="PII redaction is a guardrail, not a feature">
        <p>The right rail's "raw model output" defaults to redacted view (emails / phone numbers / first-name patterns
        masked). One click reveals literal text — but only for staff who need it for a specific investigation.
        Localstorage flag, not a server-side toggle.</p>
      </Card>
    </Section>

    <Section title="Architecture">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="Data sources">
          <ul className="list-disc pl-5">
            <li><code className="rounded bg-black/40 px-1">pulsecheck-nora-conversations</code> — full thread per athlete</li>
            <li><code className="rounded bg-black/40 px-1">pulsecheck-nora-translation-log</code> — per-message technical evidence</li>
            <li><code className="rounded bg-black/40 px-1">pulsecheck-nora-guard-config</code> — singleton kill switch + sampling rate</li>
          </ul>
        </Card>
        <Card title="Surface controls">
          <ul className="list-disc pl-5">
            <li>Logging kill switch (admin can flip; banner shows when off)</li>
            <li>PII redaction toggle (localstorage; per-staff)</li>
            <li>Per-conversation revoke (closes mid-flight conversations)</li>
          </ul>
        </Card>
      </div>
    </Section>

    <Section title="Layout">
      <Card title="3-column inbox">
        <p><strong>Left rail</strong> — athlete list ordered by most-recently-active. Displays guardrail-rejection count over last 7d.</p>
        <p><strong>Center pane</strong> — full thread for the selected athlete. Every Nora message + every athlete reply.
        Long messages render in full (no preview truncation).</p>
        <p><strong>Right rail</strong> — per-turn technical evidence: trigger that fired, classified state bucket, raw
        Claude output, guardrail outcome, scale/tree revision IDs, fallback used.</p>
      </Card>
    </Section>

    <Section title="Kill-switch behavior">
      <Card title="loggingEnabled = false">
        <p>Translations still happen and athletes still receive messages. Only minimal metadata is logged (timestamp,
        guardrail outcome). Full message bodies are NOT persisted to <code className="rounded bg-black/40 px-1">pulsecheck-nora-translation-log</code> when this flag is off.</p>
        <p>Conversation thread bodies remain in <code className="rounded bg-black/40 px-1">pulsecheck-nora-conversations</code> regardless — the conversation doc IS the storage of record. The kill switch only gates the translation log's body persistence.</p>
      </Card>
    </Section>
  </div>
);

export default PulseCheckNoraGuardSpecTab;
