import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface Highlight {
  title: string;
  body: string;
}

export function DocHeader({
  eyebrow,
  title,
  version,
  summary,
  highlights,
}: {
  eyebrow: string;
  title: string;
  version: string;
  summary: string;
  highlights: Highlight[];
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-400">{eyebrow}</p>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">{title}</h2>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-zinc-300">{summary}</p>
          </div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{version}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {highlights.map((highlight) => (
          <div key={highlight.title} className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-4">
            <p className="text-sm font-semibold text-white">{highlight.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{highlight.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
        <Icon className="h-4 w-4 text-purple-400" />
        {title}
      </h3>
      {children}
    </section>
  );
}

export function CardGrid({
  columns = 'xl:grid-cols-3',
  children,
}: {
  columns?: string;
  children: React.ReactNode;
}) {
  return <div className={`grid grid-cols-1 gap-3 ${columns}`}>{children}</div>;
}

export function InfoCard({
  title,
  body,
  accent = 'purple',
}: {
  title: string;
  body: React.ReactNode;
  accent?: 'purple' | 'blue' | 'green' | 'amber' | 'red';
}) {
  const accents = {
    purple: 'border-purple-500/20 bg-purple-500/[0.06]',
    blue: 'border-blue-500/20 bg-blue-500/[0.06]',
    green: 'border-green-500/20 bg-green-500/[0.06]',
    amber: 'border-amber-500/20 bg-amber-500/[0.06]',
    red: 'border-red-500/20 bg-red-500/[0.06]',
  };

  return (
    <article className={`rounded-2xl border p-4 ${accents[accent]}`}>
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-2 text-sm leading-relaxed text-zinc-300">{body}</div>
    </article>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-relaxed text-zinc-300">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-purple-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-[#090f1c]">
      <table className="min-w-full text-sm">
        <thead className="bg-black/20 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-left font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-zinc-800 align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 text-zinc-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StepRail({
  steps,
}: {
  steps: Array<{ title: string; body: string; owner?: string }>;
}) {
  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <div key={step.title} className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/10 text-xs font-semibold text-purple-300">
                {index + 1}
              </div>
              <p className="text-sm font-semibold text-white">{step.title}</p>
            </div>
            {step.owner ? <p className="text-xs uppercase tracking-wide text-zinc-500">{step.owner}</p> : null}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">{step.body}</p>
        </div>
      ))}
    </div>
  );
}

export function InlineTag({
  label,
  color = 'purple',
}: {
  label: string;
  color?: 'purple' | 'blue' | 'green' | 'amber' | 'red';
}) {
  const palette = {
    purple: 'border-purple-500/25 bg-purple-500/10 text-purple-200',
    blue: 'border-blue-500/25 bg-blue-500/10 text-blue-200',
    green: 'border-green-500/25 bg-green-500/10 text-green-200',
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
    red: 'border-red-500/25 bg-red-500/10 text-red-200',
  };

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${palette[color]}`}>
      {label}
    </span>
  );
}

export function RuntimeAlignmentPanel({
  sectionLabel = 'Runtime Alignment',
  role,
  sourceOfTruth,
  masterReference,
  relatedDocs,
}: {
  sectionLabel?: string;
  role: string;
  sourceOfTruth: string;
  masterReference: string;
  relatedDocs: string[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#090f1c] p-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{sectionLabel}</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{role}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Source-of-Truth Position</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{sourceOfTruth}</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Master Reference</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{masterReference}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Related Documents</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {relatedDocs.map((doc) => (
                <InlineTag key={doc} label={doc} color="blue" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TemporaryPlanningPanel({
  title = 'Temporary Implementation Planning Artifact',
  status = 'Temporary',
  intent,
  promotionRule,
}: {
  title?: string;
  status?: string;
  intent: string;
  promotionRule: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300">{title}</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-200">{intent}</p>
        </div>
        <span className="inline-flex rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
          {status}
        </span>
      </div>
      <div className="mt-4 rounded-xl border border-zinc-800 bg-black/20 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Promotion Rule</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{promotionRule}</p>
      </div>
    </div>
  );
}
