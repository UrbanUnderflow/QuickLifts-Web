import React from 'react';
import { AlertTriangle, BarChart3, BookOpen, FlaskConical, Gamepad2, Ruler, ShieldCheck, Target } from 'lucide-react';

export interface EvidenceAlignedSimSpecConfig {
  family: string;
  version: string;
  accent: string;
  purpose: string;
  task: string;
  observedMeasures: string[];
  constructHypothesis: string;
  transferHypothesis: string;
  evidenceStatus: string;
  scheduleRules: string[];
  telemetry: string[];
  prohibitedInferences: string[];
  validationRoadmap: string[];
  sources: Array<{ citation: string; url: string }>;
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-base font-semibold text-white">{icon}{title}</h3>
      {children}
    </section>
  );
}

function List({ items, accent }: { items: string[]; accent: string }) {
  return (
    <div className="divide-y divide-white/5 border border-zinc-800 bg-[#090b0f]">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-3 px-4 py-3">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
          <p className="text-xs leading-relaxed text-zinc-400">{item}</p>
        </div>
      ))}
    </div>
  );
}

export const EvidenceAlignedSimSpec: React.FC<{ config: EvidenceAlignedSimSpecConfig }> = ({ config }) => (
  <div className="space-y-9">
    <header className="border-b border-zinc-800 pb-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.26em]" style={{ color: config.accent }}>PulseCheck simulation specification</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">{config.family}</h2>
      <p className="mt-1 text-xs text-zinc-500">Evidence-informed implementation contract · {config.version}</p>
    </header>

    <div className="border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-xs leading-relaxed text-amber-100">
      <AlertTriangle className="mr-2 inline h-4 w-4" />This task is not a diagnostic, clinical, readiness, or sport-transfer instrument. The specification defines what the current runtime may report while validation remains in progress.
    </div>

    <Section icon={<Target className="h-4 w-4" style={{ color: config.accent }} />} title="Purpose">
      <p className="text-sm leading-relaxed text-zinc-300">{config.purpose}</p>
    </Section>

    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="border border-zinc-800 bg-[#090b0f] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Task</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{config.task}</p>
      </div>
      <div className="border border-zinc-800 bg-[#090b0f] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Evidence status</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{config.evidenceStatus}</p>
      </div>
    </div>

    <Section icon={<BarChart3 className="h-4 w-4 text-cyan-300" />} title="Observed Measures">
      <List items={config.observedMeasures} accent={config.accent} />
    </Section>

    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="border border-zinc-800 bg-[#090b0f] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Construct hypothesis</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-300">{config.constructHypothesis}</p>
      </div>
      <div className="border border-zinc-800 bg-[#090b0f] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Transfer hypothesis</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-300">{config.transferHypothesis}</p>
      </div>
    </div>

    <Section icon={<Gamepad2 className="h-4 w-4 text-violet-300" />} title="Runtime and Schedule Rules">
      <List items={config.scheduleRules} accent={config.accent} />
    </Section>

    <Section icon={<Ruler className="h-4 w-4 text-emerald-300" />} title="Telemetry Contract">
      <List items={config.telemetry} accent={config.accent} />
    </Section>

    <Section icon={<ShieldCheck className="h-4 w-4 text-amber-300" />} title="Prohibited Inferences">
      <List items={config.prohibitedInferences} accent="#f59e0b" />
    </Section>

    <Section icon={<FlaskConical className="h-4 w-4 text-pink-300" />} title="Validation Roadmap">
      <List items={config.validationRoadmap} accent="#f472b6" />
    </Section>

    <Section icon={<BookOpen className="h-4 w-4 text-sky-300" />} title="Primary Sources">
      <div className="space-y-2">
        {config.sources.map((source) => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block border border-zinc-800 bg-[#090b0f] px-4 py-3 text-xs leading-relaxed text-zinc-400 hover:text-white">
            {source.citation}
          </a>
        ))}
      </div>
    </Section>
  </div>
);

export default EvidenceAlignedSimSpec;
