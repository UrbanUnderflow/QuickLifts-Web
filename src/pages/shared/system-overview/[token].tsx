import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { motion } from 'framer-motion';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import { Loader2, StickyNote, Trash2, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import { db } from '../../../api/firebase/config';
import { RootState } from '../../../redux/store';
import admin from '../../../lib/firebase-admin';
import { getSystemOverviewShareCookieName, verifySystemOverviewShareAccessCookieValue } from '../../../lib/systemOverviewShareAccess';
import { resolveSystemOverviewSharePreviewMeta } from '../../../lib/sharePreviewMeta';

// ─── Types ──────────────────────────────────────────────────────────────

type SharedSystemOverviewPageProps = {
  share: {
    token: string;
    sectionLabel: string;
    sectionDescription: string;
    snapshotText: string;
    createdAt: string | null;
    passcodeProtected: boolean;
    isLocked: boolean;
  };
  ogMeta: {
    title: string;
    description: string;
    image: string;
    url: string;
  };
};

type NoteColorKey = 'yellow' | 'pink' | 'blue' | 'green' | 'purple';

type ArtifactNote = {
  id: string;
  documentId: string;
  authorName: string;
  content: string;
  xPercent: number;
  yOffset: number;
  createdAt: Timestamp | Date;
  authorKey?: string;
  color?: NoteColorKey;
};

const NOTE_COLORS: { key: NoteColorKey; bg: string; icon: string; tooltipBg: string; tooltipText: string; ring: string }[] = [
  { key: 'yellow', bg: 'bg-yellow-400', icon: 'text-yellow-800', tooltipBg: 'bg-yellow-100', tooltipText: 'text-yellow-900', ring: 'rgba(250, 204, 21, 0.45)' },
  { key: 'pink', bg: 'bg-pink-400', icon: 'text-pink-800', tooltipBg: 'bg-pink-100', tooltipText: 'text-pink-900', ring: 'rgba(244, 114, 182, 0.45)' },
  { key: 'blue', bg: 'bg-blue-400', icon: 'text-blue-800', tooltipBg: 'bg-blue-100', tooltipText: 'text-blue-900', ring: 'rgba(96, 165, 250, 0.45)' },
  { key: 'green', bg: 'bg-green-400', icon: 'text-green-800', tooltipBg: 'bg-green-100', tooltipText: 'text-green-900', ring: 'rgba(74, 222, 128, 0.45)' },
  { key: 'purple', bg: 'bg-purple-400', icon: 'text-purple-800', tooltipBg: 'bg-purple-100', tooltipText: 'text-purple-900', ring: 'rgba(192, 132, 252, 0.45)' },
];

const getNoteColorStyles = (colorKey: NoteColorKey | undefined) => {
  return NOTE_COLORS.find((color) => color.key === (colorKey || 'yellow')) ?? NOTE_COLORS[0];
};

const getAuthorKey = (): string => {
  if (typeof window === 'undefined') return '';
  const storageKey = 'document-notes-author-key';
  let key = window.localStorage.getItem(storageKey);
  if (!key) {
    key = `author_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
    window.localStorage.setItem(storageKey, key);
  }
  return key;
};

const formatNoteDate = (value: Timestamp | Date | undefined): string => {
  if (!value) return '';
  const date = value instanceof Timestamp ? value.toDate() : value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getArtifactNotesDocumentId = (token: string) => `system-overview-share:${token}`;

// ─── Smart Text Parser ──────────────────────────────────────────────────

type Block =
  | { type: 'section-header'; text: string }
  | { type: 'sub-header'; text: string }
  | { type: 'version-badge'; text: string }
  | { type: 'body'; lines: string[] }
  | { type: 'card-grid'; cards: { title: string; body: string }[] }
  | { type: 'flow-diagram'; steps: string[]; label?: string }
  | { type: 'api-table'; rows: { method: string; path: string; description: string }[] }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'labeled-table'; labelCol: string; valueCol: string; rows: { label: string; value: string }[] };

function parseSnapshotText(raw: string): Block[] {
  const lines = raw
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  const blocks: Block[] = [];
  let i = 0;

  const isSectionHeader = (line: string) => {
    const t = line.trim();
    return /^[A-Z][A-Z\s\-\/&]+$/.test(t) && t.length >= 4 && t.length < 80 && !t.includes('.');
  };

  const isVersionBadge = (line: string) => {
    const t = line.trim();
    return /^VERSION\s+[\d.]+/i.test(t) || /^V[\d.]+\s*\|/i.test(t);
  };

  const isSubHeader = (line: string) => {
    const t = line.trim();
    if (t.length > 90 || t.length < 4) return false;
    if (t.endsWith('.') || t.endsWith(',')) return false;
    if (isSectionHeader(t) || isVersionBadge(t)) return false;
    const words = t.split(/\s+/).filter((w) => w.length > 2);
    if (words.length < 2 || words.length > 12) return false;
    const capitalised = words.filter((w) => /^[A-Z]/.test(w));
    return capitalised.length / words.length >= 0.5;
  };

  const isBodyLine = (line: string) =>
    !isSectionHeader(line) && !isSubHeader(line) && !isVersionBadge(line);

  // Detect inline flow / pipeline patterns: "A → B → C" or "A -> B -> C"
  const isFlowLine = (line: string) => {
    const t = line.trim();
    const arrowCount = (t.match(/→|->|➜|➔|⟶/g) || []).length;
    return arrowCount >= 2;
  };

  // Detect API endpoint lines: "GET /path ..." or "POST /path ..."
  const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  const isApiEndpointLine = (line: string) => {
    const t = line.trim();
    return HTTP_METHODS.some((m) => t.startsWith(m + ' /'));
  };

  // Parse an API endpoint line into method, path, description
  const parseApiLine = (line: string): { method: string; path: string; description: string } => {
    const t = line.trim();
    const firstSpace = t.indexOf(' ');
    const method = t.substring(0, firstSpace);
    const rest = t.substring(firstSpace + 1);
    // The path ends at the next space after which non-path text begins
    const pathMatch = rest.match(/^(\/\S+)\s*(.*)$/);
    if (pathMatch) {
      return { method, path: pathMatch[1], description: pathMatch[2] };
    }
    return { method, path: rest, description: '' };
  };

  // Detect bullet list lines
  const isBulletLine = (line: string) => {
    const t = line.trim();
    return /^[•\-\*]\s/.test(t) || /^\d+[.)\-]\s/.test(t);
  };

  const parseBulletText = (line: string) => {
    return line.trim().replace(/^[•\-\*]\s+/, '').replace(/^\d+[.)\-]\s+/, '');
  };

  // Merge consecutive body lines into a single block for better paragraphing
  const pushBody = (text: string) => {
    const last = blocks[blocks.length - 1];
    if (last && last.type === 'body') {
      last.lines.push(text);
    } else {
      blocks.push({ type: 'body', lines: [text] });
    }
  };

  while (i < lines.length) {
    const line = lines[i].trim();

    if (isVersionBadge(line)) {
      blocks.push({ type: 'version-badge', text: line });
      i++;
      continue;
    }

    if (isSectionHeader(line)) {
      blocks.push({ type: 'section-header', text: line });
      i++;
      continue;
    }

    // Flow diagram: inline arrow pattern  ("A → B → C → D")
    if (isFlowLine(line)) {
      const steps = line.split(/\s*(?:→|->|➜|➔|⟶)\s*/).map((s) => s.trim()).filter(Boolean);
      if (steps.length >= 3) {
        // Check if the previous block was a sub-header — use it as label
        const prev = blocks[blocks.length - 1];
        const label = prev && prev.type === 'sub-header' ? prev.text : undefined;
        if (label) blocks.pop(); // consume the sub-header as the label
        blocks.push({ type: 'flow-diagram', steps, label });
        i++;
        continue;
      }
    }

    // API endpoint table: collect consecutive endpoint lines
    if (isApiEndpointLine(line)) {
      const rows: { method: string; path: string; description: string }[] = [];
      let j = i;
      while (j < lines.length && isApiEndpointLine(lines[j])) {
        const parsed = parseApiLine(lines[j]);
        // Look ahead for continuation lines (description wrapping to next line)
        j++;
        while (j < lines.length && !isApiEndpointLine(lines[j]) && !isSectionHeader(lines[j]) && !isSubHeader(lines[j]) && !isVersionBadge(lines[j]) && !isFlowLine(lines[j]) && !isBulletLine(lines[j]) && lines[j].trim().length > 0) {
          // Check if next line is just continuation text (not a new structural element)
          const nextTrimmed = lines[j].trim();
          if (/^[A-Z][a-z]/.test(nextTrimmed) || /^[a-z]/.test(nextTrimmed)) {
            parsed.description += ' ' + nextTrimmed;
            j++;
          } else {
            break;
          }
        }
        rows.push(parsed);
      }
      if (rows.length >= 2) {
        blocks.push({ type: 'api-table', rows });
        i = j;
        continue;
      }
    }

    // Labeled sequence table: "Phase 1 ...", "Phase 2 ...", "Step 1 ...", "Priority 1 ...", or numbered "1 label desc"
    const labeledMatch = line.match(/^(Phase|Step|Stage|Priority|Level|Tier|Round|Sprint|Milestone|Rule|Signal|Checkpoint|Principle|Requirement|Criteria|Item|Point|Layer)\s+(\d+)\b[:\s-]*(.*)/i);
    if (labeledMatch) {
      const prefix = labeledMatch[1];
      const rows: { label: string; value: string }[] = [];
      let j = i;
      // Collect all consecutive lines with the same prefix pattern
      while (j < lines.length) {
        const jt = lines[j].trim();
        const jm = jt.match(new RegExp(`^${prefix}\\s+(\\d+)\\b[:\\s-]*(.*)`, 'i'));
        if (!jm) break;
        const label = `${prefix} ${jm[1]}`;
        let value = jm[2];
        j++;
        // Collect continuation lines
        while (j < lines.length) {
          const next = lines[j].trim();
          if (!next || isSectionHeader(next) || isSubHeader(next) || isVersionBadge(next) || isFlowLine(next) || isApiEndpointLine(next) || isBulletLine(next)) break;
          const nextLabelMatch = next.match(new RegExp(`^${prefix}\\s+\\d+\\b`, 'i'));
          if (nextLabelMatch) break;
          value += ' ' + next;
          j++;
        }
        rows.push({ label, value });
      }
      if (rows.length >= 2) {
        blocks.push({ type: 'labeled-table', labelCol: prefix.toUpperCase(), valueCol: 'DESCRIPTION', rows });
        i = j;
        continue;
      }
    }

    // Plain numbered sequence: "1 someLabel Long description..." repeated
    const numberedMatch = line.match(/^(\d+)\s+([a-zA-Z]\S*)\s+(.*)/); 
    if (numberedMatch && !isSubHeader(line)) {
      const rows: { label: string; value: string }[] = [];
      let j = i;
      let expectedNum = parseInt(numberedMatch[1], 10);
      while (j < lines.length) {
        const jt = lines[j].trim();
        const jm = jt.match(/^(\d+)\s+(\S+)\s+(.*)/);
        if (!jm || parseInt(jm[1], 10) !== expectedNum) break;
        let value = jm[3];
        const label = jm[2];
        j++;
        // Continuation
        while (j < lines.length) {
          const next = lines[j].trim();
          if (!next || isSectionHeader(next) || isSubHeader(next) || isVersionBadge(next) || isFlowLine(next) || isApiEndpointLine(next) || isBulletLine(next)) break;
          if (/^\d+\s+\S+\s+/.test(next)) break;
          value += ' ' + next;
          j++;
        }
        rows.push({ label, value });
        expectedNum++;
      }
      if (rows.length >= 3) {
        blocks.push({ type: 'labeled-table', labelCol: '#', valueCol: 'DESCRIPTION', rows });
        i = j;
        continue;
      }
    }

    // Bullet list: collect consecutive bullet lines
    if (isBulletLine(line)) {
      const items: string[] = [];
      let j = i;
      while (j < lines.length && isBulletLine(lines[j])) {
        items.push(parseBulletText(lines[j]));
        j++;
      }
      if (items.length >= 2) {
        blocks.push({ type: 'bullet-list', items });
        i = j;
        continue;
      }
    }

    // Look-ahead: detect card-grid (sub-header + body, repeated 2+)
    if (isSubHeader(line) && i + 1 < lines.length && isBodyLine(lines[i + 1])) {
      const group: { title: string; body: string }[] = [];
      let j = i;
      while (j < lines.length) {
        const jLine = lines[j].trim();
        if (!isSubHeader(jLine)) break;
        const title = jLine;
        j++;
        const bodyParts: string[] = [];
        while (j < lines.length && isBodyLine(lines[j]) && !isSubHeader(lines[j])) {
          bodyParts.push(lines[j].trim());
          j++;
        }
        group.push({ title, body: bodyParts.join(' ') });
      }
      if (group.length >= 2) {
        blocks.push({ type: 'card-grid', cards: group });
        i = j;
        continue;
      }
    }

    if (isSubHeader(line)) {
      blocks.push({ type: 'sub-header', text: line });
      i++;
      continue;
    }

    pushBody(line);
    i++;
  }

  return blocks;
}

// ─── Accent cycling ─────────────────────────────────────────────────────

const ACCENTS = ['#E0FE10', '#3B82F6', '#8B5CF6', '#06B6D4', '#F59E0B'];

// ─── Flow Diagram Component ─────────────────────────────────────────────

const FlowDiagram: React.FC<{ steps: string[]; label?: string; accent: string }> = ({ steps, label, accent }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      style={{ marginTop: 20, marginBottom: 24 }}
    >
      {/* Optional label */}
      {label && (
        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', letterSpacing: '0.02em' }}>{label}</span>
        </div>
      )}

      {/* Flow container */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          padding: '24px 28px',
          background: `linear-gradient(135deg, ${accent}06, rgba(20,20,24,0.4))`,
          border: `1px solid ${accent}18`,
        }}
      >
        {/* Chromatic top line */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)`, opacity: 0.5 }} />

        {/* Responsive: horizontal on desktop, vertical on mobile */}
        {/* Desktop horizontal layout */}
        <div className="hidden md:flex items-center gap-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {steps.map((step, si) => (
            <React.Fragment key={si}>
              {/* Node */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: si * 0.08 }}
                className="flex items-center gap-3 flex-shrink-0"
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  minWidth: 0,
                }}
              >
                {/* Step number */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: `${accent}18`,
                    border: `1px solid ${accent}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: accent,
                    flexShrink: 0,
                  }}
                >
                  {si + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e4e4e7', whiteSpace: 'nowrap' }}>
                  {step}
                </span>
              </motion.div>

              {/* Connector arrow */}
              {si < steps.length - 1 && (
                <div className="flex items-center flex-shrink-0" style={{ padding: '0 6px' }}>
                  <div style={{ width: 20, height: 1, background: `linear-gradient(90deg, ${accent}40, ${accent}20)` }} />
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ marginLeft: -1 }}>
                    <path d="M1 1l3 3-3 3" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                  </svg>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Mobile vertical layout */}
        <div className="md:hidden flex flex-col gap-0">
          {steps.map((step, si) => (
            <React.Fragment key={si}>
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: si * 0.06 }}
                className="flex items-center gap-3"
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: `${accent}18`,
                    border: `1px solid ${accent}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: accent,
                    flexShrink: 0,
                  }}
                >
                  {si + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e4e4e7' }}>{step}</span>
              </motion.div>

              {/* Vertical connector */}
              {si < steps.length - 1 && (
                <div className="flex justify-start" style={{ paddingLeft: 24 }}>
                  <div style={{ width: 1, height: 16, background: `linear-gradient(180deg, ${accent}35, ${accent}10)` }} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// ─── API Table Component ────────────────────────────────────────────────

const ApiTable: React.FC<{ rows: { method: string; path: string; description: string }[]; accent: string }> = ({ rows, accent }) => {
  const methodColor = (m: string) => {
    switch (m) {
      case 'GET': return '#22D3EE';
      case 'POST': return '#E0FE10';
      case 'PUT': return '#F59E0B';
      case 'PATCH': return '#F59E0B';
      case 'DELETE': return '#EF4444';
      default: return '#a1a1aa';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45 }}
      style={{ marginTop: 16, marginBottom: 24 }}
    >
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}30, transparent)`, opacity: 0.5 }} />

        {/* Table header */}
        <div
          className="grid gap-0"
          style={{
            gridTemplateColumns: '100px 1fr 2fr',
            background: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {['Method', 'Endpoint', 'Description'].map((h) => (
            <div
              key={h}
              style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#71717a' }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Table rows */}
        {rows.map((row, ri) => (
          <div
            key={ri}
            className="grid gap-0"
            style={{
              gridTemplateColumns: '100px 1fr 2fr',
              borderBottom: ri < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {/* Method badge */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  color: methodColor(row.method),
                  background: `${methodColor(row.method)}12`,
                  border: `1px solid ${methodColor(row.method)}25`,
                  letterSpacing: '0.04em',
                }}
              >
                {row.method}
              </span>
            </div>

            {/* Path */}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start' }}>
              <code
                style={{
                  fontSize: 12,
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  color: '#e4e4e7',
                  wordBreak: 'break-all',
                }}
              >
                {row.path}
              </code>
            </div>

            {/* Description */}
            <div style={{ padding: '12px 16px' }}>
              <span style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.55 }}>
                {row.description}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// ─── Bullet List Component ──────────────────────────────────────────────

const BulletList: React.FC<{ items: string[]; accent: string }> = ({ items, accent }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.4 }}
    style={{ marginTop: 8, marginBottom: 16 }}
  >
    <div
      className="rounded-xl"
      style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      {items.map((item, ii) => (
        <div
          key={ii}
          className="flex gap-3"
          style={{ padding: '6px 0', borderBottom: ii < items.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
        >
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: accent, opacity: 0.5, marginTop: 7, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#d4d4d8', lineHeight: 1.6 }}>{item}</span>
        </div>
      ))}
    </div>
  </motion.div>
);

// ─── Labeled Table Component ────────────────────────────────────────────

const LabeledTable: React.FC<{ labelCol: string; valueCol: string; rows: { label: string; value: string }[]; accent: string }> = ({ labelCol, valueCol, rows, accent }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.45 }}
    style={{ marginTop: 16, marginBottom: 24 }}
  >
    <div
      className="relative rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}30, transparent)`, opacity: 0.5 }} />

      {/* Header */}
      <div
        className="grid gap-0"
        style={{
          gridTemplateColumns: 'clamp(180px, 24%, 280px) minmax(0, 1fr)',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#71717a' }}>
          {labelCol}
        </div>
        <div style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#71717a' }}>
          {valueCol}
        </div>
      </div>

      {/* Rows */}
      {rows.map((row, ri) => (
        <div
          key={ri}
          className="grid gap-0"
          style={{
            gridTemplateColumns: 'clamp(180px, 24%, 280px) minmax(0, 1fr)',
            borderBottom: ri < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1.35,
                color: accent,
                background: `${accent}10`,
                border: `1px solid ${accent}22`,
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
              }}
            >
              {row.label}
            </span>
          </div>
          <div style={{ padding: '12px 16px' }}>
            <span style={{ fontSize: 13, color: '#d4d4d8', lineHeight: 1.6 }}>
              {row.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

// ─── Inline text enhancer ───────────────────────────────────────────────

function renderEnhancedText(text: string): React.ReactNode {
  // Highlight inline code patterns: paths like /foo/bar, backticked text
  const parts = text.split(/(`[^`]+`|\/[a-zA-Z][a-zA-Z0-9_.\-/:{}=?&]*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{ fontSize: '0.9em', padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: '#e4e4e7', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('/') && part.length > 2 && /\/[a-zA-Z]/.test(part)) {
      return (
        <code key={i} style={{ fontSize: '0.9em', padding: '1px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: '#e4e4e7', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          {part}
        </code>
      );
    }
    return part;
  });
}

// ─── Main Page Component ─────────────────────────────────────────────────

const SharedSystemOverviewPage = ({ share, ogMeta }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const isAdmin = currentUser?.role === 'admin';
  const blocks = useMemo(() => (share.isLocked ? [] : parseSnapshotText(share.snapshotText)), [share.isLocked, share.snapshotText]);
  const [copied, setCopied] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [notes, setNotes] = useState<ArtifactNote[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteFormPosition, setNoteFormPosition] = useState({ xPercent: 0, yOffset: 0 });
  const [newNoteName, setNewNoteName] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteColor, setNewNoteColor] = useState<NoteColorKey>('yellow');
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
  const [localAuthorKey, setLocalAuthorKey] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const hideNoteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const artifactNotesDocumentId = useMemo(() => getArtifactNotesDocumentId(share.token), [share.token]);
  const HIDE_NOTE_DELAY_MS = 2500;

  const scheduleHideNote = (noteId: string) => {
    if (hideNoteTimeoutRef.current) clearTimeout(hideNoteTimeoutRef.current);
    hideNoteTimeoutRef.current = setTimeout(() => {
      setHoveredNoteId((current) => (current === noteId ? null : current));
      hideNoteTimeoutRef.current = null;
    }, HIDE_NOTE_DELAY_MS);
  };

  const cancelHideNote = () => {
    if (hideNoteTimeoutRef.current) {
      clearTimeout(hideNoteTimeoutRef.current);
      hideNoteTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    setLocalAuthorKey(getAuthorKey());
  }, []);

  useEffect(() => {
    return () => {
      if (hideNoteTimeoutRef.current) clearTimeout(hideNoteTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (share.isLocked) {
      setNotes([]);
      return;
    }

    const notesQuery = query(
      collection(db, 'document-notes'),
      where('documentId', '==', artifactNotesDocumentId)
    );

    const unsubscribe = onSnapshot(notesQuery, (snapshot) => {
      const notesData = snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      })) as ArtifactNote[];

      notesData.sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : a.createdAt?.toDate?.()?.getTime?.() || 0;
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : b.createdAt?.toDate?.()?.getTime?.() || 0;
        return aTime - bTime;
      });

      setNotes(notesData);
    }, (error) => {
      console.error('[SharedArtifactNotes] Error fetching notes:', error);
    });

    return () => unsubscribe();
  }, [artifactNotesDocumentId, share.isLocked]);

  const handleCopy = async () => {
    if (share.isLocked) return;
    try {
      await navigator.clipboard.writeText(share.snapshotText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (share.isLocked || !contentRef.current) return;

    const rect = contentRef.current.getBoundingClientRect();
    const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
    const yOffset = event.clientY - rect.top + contentRef.current.scrollTop;

    setNoteFormPosition({ xPercent, yOffset });
    setShowNoteForm(true);
    setNewNoteName('');
    setNewNoteContent('');
    setNewNoteColor('yellow');
  };

  const handleSaveNote = async () => {
    if (!newNoteName.trim() || !newNoteContent.trim()) return;

    setSavingNote(true);
    try {
      await addDoc(collection(db, 'document-notes'), {
        documentId: artifactNotesDocumentId,
        authorName: newNoteName.trim(),
        content: newNoteContent.trim(),
        xPercent: noteFormPosition.xPercent,
        yOffset: noteFormPosition.yOffset,
        createdAt: new Date(),
        authorKey: localAuthorKey,
        color: newNoteColor,
      });

      setShowNoteForm(false);
      setNewNoteName('');
      setNewNoteContent('');
      setNewNoteColor('yellow');
    } catch (error) {
      console.error('[SharedArtifactNotes] Error saving note:', error);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setDeletingNoteId(noteId);
    try {
      await deleteDoc(doc(db, 'document-notes', noteId));
    } catch (error) {
      console.error('[SharedArtifactNotes] Error deleting note:', error);
    } finally {
      setDeletingNoteId(null);
    }
  };

  const canDeleteNote = (note: ArtifactNote): boolean => {
    if (isAdmin) return true;
    return Boolean(note.authorKey && note.authorKey === localAuthorKey);
  };

  const handleUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passcode.trim()) {
      setUnlockError('Passcode is required.');
      return;
    }

    setUnlocking(true);
    setUnlockError(null);

    try {
      const response = await fetch(`/api/shared/system-overview/${encodeURIComponent(share.token)}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Incorrect passcode.');
      }

      window.location.reload();
    } catch (error) {
      console.error('[shared/system-overview] Failed to unlock share:', error);
      setUnlockError(error instanceof Error ? error.message : 'Failed to unlock shared artifact.');
    } finally {
      setUnlocking(false);
    }
  };

  let sectionIdx = 0;

  return (
    <>
      <Head>
        <title>{ogMeta.title}</title>
        <meta name="description" content={ogMeta.description} />
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href={ogMeta.url} />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style>{`
          html { scroll-behavior: smooth; }
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
        `}</style>
      </Head>

      <div className="min-h-screen text-white overflow-x-hidden" style={{ background: '#05070c' }}>

        {/* ── Ambient background ── */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <motion.div
            className="absolute rounded-full blur-[120px]"
            style={{ width: 520, height: 520, top: '-6%', left: '-6%', backgroundColor: '#E0FE10' }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.12, 0.22, 0.12] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute rounded-full blur-[120px]"
            style={{ width: 440, height: 440, top: '35%', right: '-5%', backgroundColor: '#3B82F6' }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.10, 0.18, 0.10] }}
            transition={{ duration: 12, repeat: Infinity, delay: 3, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute rounded-full blur-[120px]"
            style={{ width: 380, height: 380, bottom: '2%', left: '25%', backgroundColor: '#8B5CF6' }}
            animate={{ scale: [1, 1.14, 1], opacity: [0.08, 0.16, 0.08] }}
            transition={{ duration: 11, repeat: Infinity, delay: 5, ease: 'easeInOut' }}
          />
          {/* Noise texture */}
          <div
            className="absolute inset-0 opacity-[0.012]"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence baseFrequency=\'.85\' stitchTiles=\'stitch\' type=\'fractalNoise\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3C/filter%3E%3Crect width=\'200\' height=\'200\' filter=\'url(%23n)\' opacity=\'.06\'/%3E%3C/svg%3E")',
            }}
          />
        </div>

        {/* ── Sticky navigation bar ── */}
        <header className="fixed top-0 left-0 right-0 z-50" style={{ padding: '12px 16px 0' }}>
          <motion.nav
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto flex items-center justify-between gap-4 rounded-2xl backdrop-blur-xl border border-white/[0.08]"
            style={{ maxWidth: 860, padding: '10px 20px', background: 'rgba(10,10,14,0.75)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-lg"
                style={{ width: 28, height: 28, background: 'rgba(224,254,16,0.12)', border: '1px solid rgba(224,254,16,0.2)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E0FE10" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p style={{ fontSize: 9, letterSpacing: '0.14em', lineHeight: 1, color: '#71717a', textTransform: 'uppercase', fontWeight: 600 }}>
                  Shared Artifact
                </p>
                <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', lineHeight: 1.3, maxWidth: 240 }}>
                  {share.sectionLabel}
                </p>
              </div>
            </div>

            <button
              onClick={handleCopy}
              disabled={share.isLocked}
              className="flex-shrink-0 flex items-center gap-1.5 rounded-lg transition-all duration-200"
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '6px 12px',
                border: copied ? '1px solid rgba(224,254,16,0.3)' : '1px solid rgba(63,63,70,0.8)',
                background: copied ? 'rgba(224,254,16,0.08)' : 'rgba(39,39,42,0.5)',
                color: copied ? '#E0FE10' : share.isLocked ? '#52525b' : '#a1a1aa',
                opacity: share.isLocked ? 0.6 : 1,
              }}
            >
              {copied ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
              )}
              {share.isLocked ? 'Locked' : copied ? 'Copied' : 'Copy'}
            </button>
          </motion.nav>
        </header>

        {/* ── Page content ── */}
        <main className="relative z-10 mx-auto" style={{ maxWidth: 860, padding: '0 20px' }}>

          {/* Hero card */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="relative rounded-2xl overflow-hidden"
            style={{ marginTop: 80 }}
          >
            {/* Glass surface layers */}
            <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(24,24,27,0.7), rgba(14,14,18,0.6))', border: '1px solid rgba(255,255,255,0.06)' }} />
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(224,254,16,0.35) 30%, rgba(59,130,246,0.2) 70%, transparent 95%)' }} />
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.025] via-transparent to-transparent pointer-events-none rounded-2xl" />

            <div className="relative" style={{ padding: '36px 36px 32px' }}>
              {/* Badge */}
              <div
                className="inline-flex items-center gap-2 rounded-full"
                style={{ padding: '4px 12px', marginBottom: 16, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#E0FE10', background: 'rgba(224,254,16,0.08)', border: '1px solid rgba(224,254,16,0.15)' }}
              >
                <span className="animate-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: '#E0FE10', display: 'inline-block' }} />
                PulseCheck · Shared Artifact
              </div>

              <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fafafa', lineHeight: 1.25, marginBottom: 10, letterSpacing: '-0.01em' }}>
                {share.sectionLabel}
              </h1>

              {share.sectionDescription && (
                <p style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.65, maxWidth: 600 }}>
                  {share.sectionDescription}
                </p>
              )}

              {/* Meta divider */}
              <div
                className="flex flex-wrap items-center gap-4"
                style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}
              >
                <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#52525b' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  {share.createdAt
                    ? new Date(share.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : 'Recently shared'}
                </span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#3f3f46' }} />
                <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: '#52525b' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                  {share.passcodeProtected ? 'View-only · Passcode protected' : 'View-only · Private link'}
                </span>
              </div>
            </div>
          </motion.section>

          {share.isLocked ? (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="relative rounded-2xl overflow-hidden"
              style={{ marginTop: 16 }}
            >
              <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(180deg, rgba(20,20,24,0.55), rgba(12,12,16,0.45))', border: '1px solid rgba(255,255,255,0.05)' }} />
              <div className="absolute top-0 left-0 right-0 h-px opacity-30" style={{ background: 'linear-gradient(90deg, transparent 10%, rgba(139,92,246,0.4) 50%, transparent 90%)' }} />

              <div className="relative" style={{ padding: '32px 36px 40px' }}>
                <div
                  className="rounded-2xl"
                  style={{
                    padding: '28px 24px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    maxWidth: 520,
                  }}
                >
                  <div
                    className="inline-flex items-center gap-2 rounded-full"
                    style={{
                      padding: '5px 12px',
                      marginBottom: 16,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: '#facc15',
                      background: 'rgba(250,204,21,0.08)',
                      border: '1px solid rgba(250,204,21,0.16)',
                    }}
                  >
                    Protected Share
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fafafa', lineHeight: 1.25 }}>
                    Enter passcode to view this artifact
                  </h2>
                  <p style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.7, marginTop: 12 }}>
                    This shared document is protected at the server level. The artifact content is not sent to the browser until the correct passcode is verified.
                  </p>

                  <form onSubmit={handleUnlock} style={{ marginTop: 22 }}>
                    <label style={{ display: 'block' }}>
                      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#71717a', marginBottom: 8 }}>
                        Passcode
                      </span>
                      <input
                        type="password"
                        value={passcode}
                        onChange={(event) => setPasscode(event.target.value.toUpperCase())}
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        style={{
                          width: '100%',
                          borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'rgba(0,0,0,0.25)',
                          color: '#fafafa',
                          padding: '12px 14px',
                          outline: 'none',
                        }}
                        placeholder="Enter passcode"
                      />
                    </label>

                    {unlockError ? (
                      <p style={{ marginTop: 10, fontSize: 12, color: '#fca5a5' }}>{unlockError}</p>
                    ) : null}

                    <button
                      type="submit"
                      disabled={unlocking}
                      style={{
                        marginTop: 16,
                        borderRadius: 12,
                        border: '1px solid rgba(224,254,16,0.18)',
                        background: 'rgba(224,254,16,0.9)',
                        color: '#111827',
                        padding: '11px 16px',
                        fontSize: 13,
                        fontWeight: 700,
                        opacity: unlocking ? 0.7 : 1,
                        cursor: unlocking ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {unlocking ? 'Unlocking...' : 'Unlock Artifact'}
                    </button>
                  </form>
                </div>
              </div>
            </motion.section>
          ) : (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="relative rounded-2xl overflow-hidden"
              style={{ marginTop: 16 }}
            >
              {/* Glass surface */}
              <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(180deg, rgba(20,20,24,0.55), rgba(12,12,16,0.45))', border: '1px solid rgba(255,255,255,0.05)' }} />
              <div className="absolute top-0 left-0 right-0 h-px opacity-30" style={{ background: 'linear-gradient(90deg, transparent 10%, rgba(139,92,246,0.4) 50%, transparent 90%)' }} />

              <div className="relative" style={{ padding: '32px 36px 40px' }}>
                <div
                  className="mb-5 flex flex-col gap-2 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="flex items-center gap-2 text-xs text-zinc-500">
                    <StickyNote className="h-4 w-4 text-yellow-400" />
                    Double-click anywhere in the artifact to add a note
                  </p>
                  {notes.length > 0 ? (
                    <span
                      className="self-start rounded-full px-2 py-1 text-xs font-medium text-yellow-300 sm:self-auto"
                      style={{ background: 'rgba(250, 204, 21, 0.12)', border: '1px solid rgba(250, 204, 21, 0.18)' }}
                    >
                      {notes.length} note{notes.length === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </div>

                <div
                  ref={contentRef}
                  className="relative"
                  onDoubleClick={handleDoubleClick}
                  style={{ cursor: 'text' }}
                >
                  {blocks.map((block, idx) => {
                    switch (block.type) {
                      case 'section-header': {
                        const accent = ACCENTS[sectionIdx % ACCENTS.length];
                        sectionIdx++;
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4 }}
                            style={{ marginTop: idx === 0 ? 0 : 40, marginBottom: 12 }}
                          >
                            {idx > 0 && (
                              <div style={{ height: 1, marginBottom: 28, background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent 80%)' }} />
                            )}
                            <div className="flex items-center gap-3">
                              <span style={{ width: 24, height: 2, borderRadius: 1, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
                              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent }}>
                                {block.text}
                              </span>
                            </div>
                          </motion.div>
                        );
                      }

                      case 'sub-header':
                        return (
                          <motion.h2
                            key={idx}
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.35 }}
                            style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', lineHeight: 1.35, marginTop: 24, marginBottom: 8, letterSpacing: '-0.005em' }}
                          >
                            {block.text}
                          </motion.h2>
                        );

                      case 'version-badge':
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.96 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.35 }}
                            className="inline-flex items-center gap-2"
                            style={{ padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 500, fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: '#a1a1aa', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginTop: 4, marginBottom: 12 }}
                          >
                            <span className="animate-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: '#E0FE10', display: 'inline-block' }} />
                            {block.text}
                          </motion.div>
                        );

                      case 'body':
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 6 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4 }}
                            className="space-y-3"
                            style={{ marginBottom: 16 }}
                          >
                            {block.lines.map((line, li) => (
                              <p
                                key={li}
                                style={{ fontSize: 14, color: '#d4d4d8', lineHeight: 1.75, maxWidth: 680 }}
                              >
                                {renderEnhancedText(line)}
                              </p>
                            ))}
                          </motion.div>
                        );

                      case 'flow-diagram':
                        return (
                          <FlowDiagram
                            key={idx}
                            steps={block.steps}
                            label={block.label}
                            accent={ACCENTS[(sectionIdx - 1 + ACCENTS.length) % ACCENTS.length]}
                          />
                        );

                      case 'api-table':
                        return (
                          <ApiTable
                            key={idx}
                            rows={block.rows}
                            accent={ACCENTS[(sectionIdx - 1 + ACCENTS.length) % ACCENTS.length]}
                          />
                        );

                      case 'bullet-list':
                        return (
                          <BulletList
                            key={idx}
                            items={block.items}
                            accent={ACCENTS[(sectionIdx - 1 + ACCENTS.length) % ACCENTS.length]}
                          />
                        );

                      case 'labeled-table':
                        return (
                          <LabeledTable
                            key={idx}
                            labelCol={block.labelCol}
                            valueCol={block.valueCol}
                            rows={block.rows}
                            accent={ACCENTS[(sectionIdx - 1 + ACCENTS.length) % ACCENTS.length]}
                          />
                        );

                      case 'card-grid': {
                        const cols = block.cards.length <= 2 ? 2 : block.cards.length === 3 ? 3 : 2;
                        return (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 14 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.45 }}
                            className="grid gap-3"
                            style={{
                              gridTemplateColumns: `repeat(${cols}, 1fr)`,
                              marginTop: 16,
                              marginBottom: 20,
                            }}
                          >
                            {block.cards.map((card, ci) => {
                              const accent = ACCENTS[(sectionIdx + ci) % ACCENTS.length];
                              return (
                                <motion.div
                                  key={ci}
                                  initial={{ opacity: 0, y: 10 }}
                                  whileInView={{ opacity: 1, y: 0 }}
                                  viewport={{ once: true }}
                                  transition={{ duration: 0.35, delay: ci * 0.06 }}
                                  className="relative group rounded-xl overflow-hidden"
                                  style={{
                                    padding: '20px 20px 18px',
                                    background: `linear-gradient(135deg, ${accent}08, transparent)`,
                                    border: `1px solid ${accent}20`,
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    const el = e.currentTarget;
                                    el.style.transform = 'translateY(-2px)';
                                    el.style.boxShadow = `0 4px 24px ${accent}10`;
                                  }}
                                  onMouseLeave={(e) => {
                                    const el = e.currentTarget;
                                    el.style.transform = 'translateY(0)';
                                    el.style.boxShadow = 'none';
                                  }}
                                >
                                  <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}50, transparent)`, opacity: 0.6 }} />
                                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-transparent pointer-events-none" />

                                  <div className="relative">
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, opacity: 0.7, marginBottom: 10 }} />
                                    <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', lineHeight: 1.35, marginBottom: 6 }}>
                                      {card.title}
                                    </h3>
                                    {card.body ? (
                                      <p style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.6 }}>
                                        {card.body}
                                      </p>
                                    ) : null}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </motion.div>
                        );
                      }

                      default:
                        return null;
                    }
                  })}

                  {notes.map((note) => {
                    const styles = getNoteColorStyles(note.color);
                    const isHovered = hoveredNoteId === note.id;

                    return (
                      <div
                        key={note.id}
                        className="absolute z-20"
                        style={{
                          left: `${Math.min(Math.max(note.xPercent, 2), 95)}%`,
                          top: `${note.yOffset}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        onMouseEnter={() => {
                          cancelHideNote();
                          setHoveredNoteId(note.id);
                        }}
                        onMouseLeave={() => scheduleHideNote(note.id)}
                      >
                        <div
                          className={`${styles.bg} flex h-8 w-8 cursor-pointer items-center justify-center rounded shadow-lg transition-all duration-200 ${isHovered ? 'scale-110 opacity-100' : 'opacity-30 hover:scale-110 hover:opacity-100'}`}
                          onMouseEnter={() => {
                            cancelHideNote();
                            setHoveredNoteId(note.id);
                          }}
                        >
                          <StickyNote className={`h-5 w-5 ${styles.icon}`} />
                        </div>

                        {isHovered ? (
                          <div
                            className={`absolute z-30 min-w-[200px] max-w-[300px] rounded-lg p-3 shadow-xl ${styles.tooltipBg} ${styles.tooltipText}`}
                            style={{
                              left: note.xPercent > 70 ? 'auto' : '100%',
                              right: note.xPercent > 70 ? '100%' : 'auto',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              marginLeft: note.xPercent > 70 ? 0 : '8px',
                              marginRight: note.xPercent > 70 ? '8px' : 0,
                            }}
                            onMouseEnter={cancelHideNote}
                            onMouseLeave={() => scheduleHideNote(note.id)}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold">{note.authorName}</div>
                              {canDeleteNote(note) ? (
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeleteNote(note.id);
                                  }}
                                  disabled={deletingNoteId === note.id}
                                  className="rounded p-1 text-red-600 transition-colors hover:bg-red-200 hover:text-red-700"
                                  title="Delete note"
                                >
                                  {deletingNoteId === note.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              ) : null}
                            </div>
                            <div className="whitespace-pre-wrap text-sm">{note.content}</div>
                            <div className={`mt-2 text-xs opacity-80 ${styles.tooltipText}`}>
                              {formatNoteDate(note.createdAt)}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.section>
          )}

          {showNoteForm ? (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
              onClick={(event) => {
                if (event.target === event.currentTarget) setShowNoteForm(false);
              }}
            >
              <div
                className="w-full max-w-md rounded-xl border border-zinc-700 bg-[#17191f] p-6 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded ${getNoteColorStyles(newNoteColor).bg}`}>
                      <StickyNote className={`h-5 w-5 ${getNoteColorStyles(newNoteColor).icon}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Add Note</h3>
                  </div>
                  <button
                    onClick={() => setShowNoteForm(false)}
                    className="rounded-lg p-1 transition-colors hover:bg-zinc-700"
                    title="Close note form"
                  >
                    <X className="h-5 w-5 text-zinc-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-300">Note color</label>
                    <div className="flex flex-wrap gap-2">
                      {NOTE_COLORS.map(({ key, bg, icon, ring }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setNewNoteColor(key)}
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg} transition-all`}
                          style={{
                            boxShadow: newNoteColor === key ? `0 0 0 2px #fff, 0 0 0 4px ${ring}` : 'none',
                          }}
                          title={key.charAt(0).toUpperCase() + key.slice(1)}
                        >
                          <StickyNote className={`h-5 w-5 ${icon}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-300">Your Name</label>
                    <input
                      type="text"
                      value={newNoteName}
                      onChange={(event) => setNewNoteName(event.target.value)}
                      placeholder="Enter your name"
                      autoFocus
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-500/30"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-300">Note</label>
                    <textarea
                      value={newNoteContent}
                      onChange={(event) => setNewNoteContent(event.target.value)}
                      placeholder="Enter your note or comment..."
                      rows={4}
                      className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-500/30"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowNoteForm(false)}
                      className="flex-1 rounded-lg bg-zinc-700 px-4 py-2.5 font-medium text-white transition-colors hover:bg-zinc-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNote}
                      disabled={!newNoteName.trim() || !newNoteContent.trim() || savingNote}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 px-4 py-2.5 font-medium text-black transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-400"
                    >
                      {savingNote ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Note'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Footer */}
          <footer className="flex flex-col items-center gap-3" style={{ paddingTop: 36, paddingBottom: 48 }}>
            <div className="flex items-center gap-3">
              <span style={{ width: 48, height: 1, background: 'linear-gradient(90deg, transparent, rgba(63,63,70,0.6))' }} />
              <div
                className="flex items-center justify-center"
                style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(224,254,16,0.1)', border: '1px solid rgba(224,254,16,0.18)' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#E0FE10" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span style={{ width: 48, height: 1, background: 'linear-gradient(90deg, rgba(63,63,70,0.6), transparent)' }} />
            </div>
            <p style={{ fontSize: 11, color: '#3f3f46', textAlign: 'center', lineHeight: 1.5 }}>
              Powered by PulseCheck · This link was generated by an internal team member
            </p>
          </footer>
        </main>
      </div>
    </>
  );
};

// ─── Server Side Props ───────────────────────────────────────────────────

export const getServerSideProps: GetServerSideProps<SharedSystemOverviewPageProps> = async ({ params, req, res }) => {
  const token = typeof params?.token === 'string' ? params.token : '';
  if (!token) return { notFound: true };

  try {
    const docSnap = await admin.firestore().collection('systemOverviewShareLinks').doc(token).get();
    if (!docSnap.exists) return { notFound: true };

    const data = docSnap.data() || {};
    if (data.revokedAt) return { notFound: true };
    const passcodeProtected = Boolean(data.passcodeProtected && data.passcodeHash && data.passcodeSalt);
    const accessCookie = req.cookies[getSystemOverviewShareCookieName(token)];
    const isUnlocked = !passcodeProtected || verifySystemOverviewShareAccessCookieValue(token, accessCookie);
    const isLocked = passcodeProtected && !isUnlocked;
    const siteOrigin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const ogMeta = resolveSystemOverviewSharePreviewMeta({
      token,
      sectionId: data.sectionId || '',
      sectionLabel: data.sectionLabel || 'Shared System Overview Artifact',
      sectionDescription: data.sectionDescription || '',
      siteOrigin,
      isLocked,
    });

    res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    return {
      props: {
        share: {
          token,
          sectionLabel: data.sectionLabel || 'Shared System Overview Artifact',
          sectionDescription: data.sectionDescription || '',
          snapshotText: isUnlocked ? data.snapshotText || '' : '',
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
          passcodeProtected,
          isLocked,
        },
        ogMeta,
      },
    };
  } catch (error) {
    console.error('[shared/system-overview] Failed to load share link:', error);
    return { notFound: true };
  }
};

export default SharedSystemOverviewPage;
