// The text stays a normal string for legacy clients. Parallel runs identify the
// visible Unicode code points. An insertion gets its own identity even when two
// users type the same letter. Consecutive typing in one tab compresses to a run.
type Run = { origin: string; start: number; count: number };
type FieldRuns = { hash: string; runs: Run[] };
type Mark = { origin: string; index: number; value: string };
type RecordData = Record<string, unknown>;
const textFields = new Set([
  'name', 'description', 'objective', 'leadDefinition', 'researchBrief', 'title', 'organization',
  'contactPhone', 'linkedinUrl', 'nextStep', 'notes', 'sourceUrl', 'segment', 'decisionMaker',
  'contractTerm', 'pilotScope', 'lossReason', 'expansionPath', 'deadlineSource', 'summary',
  'metricSource', 'label', 'reason', 'grossMargin', 'partnerCost', 'hardwareCost', 'acv',
  'athleteCount', 'amount',
]);
export const isPipeListTextField = (key: string) => textFields.has(key);
export const isPipeListSelection = (key: string) =>
  ['stage', 'owner', 'assignee', 'priority', 'outcome', 'track', 'tone', 'status', 'accent',
   'emailStatus', 'dueDate', 'expectedCloseDate', 'pilotStart', 'pilotEnd', 'conversionLikelihood'].includes(key);

function signature(text: string) {
  let a = 2166136261;
  let b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return (a >>> 0).toString(36) + '-' + (b >>> 0).toString(36);
}
const markId = (m: Mark) => m.origin + ':' + m.index;
let tabId: string;
let sequence = 0;

function readRuns(data: RecordData, field: string, value: string): Mark[] | undefined {
  const source = (data.textRuns as Record<string, FieldRuns> | undefined)?.[field];
  if (!source || source.hash !== signature(value) || !Array.isArray(source.runs)) return;
  const chars = Array.from(value);
  const result: Mark[] = [];
  for (const r of source.runs) {
    if (!r || typeof r.origin !== 'string' || !Number.isSafeInteger(r.start) || r.start < 0 ||
        !Number.isSafeInteger(r.count) || r.count <= 0 || r.count > chars.length - result.length) return;
    for (let i = 0; i < r.count; i++) result.push({ origin: r.origin, index: r.start + i, value: chars[result.length] });
  }
  return result.length === chars.length ? result : undefined;
}

function pack(marks: Mark[]): FieldRuns {
  const runs: Run[] = [];
  for (const m of marks) {
    const last = runs[runs.length - 1];
    if (last && last.origin === m.origin && last.start + last.count === m.index) last.count++;
    else runs.push({ origin: m.origin, start: m.index, count: 1 });
  }
  return { hash: signature(marks.map(m => m.value).join('')), runs };
}

function legacyMarks(value: string) {
  const origin = 'base-' + signature(value);
  return Array.from(value, (char, index) => ({ origin, index, value: char }));
}

// Retain common prefix/suffix for a keystroke or paste. For a multi-span change
// by a legacy client, match the middle using a size-bounded common subsequence.
function editMarks(before: Mark[], after: string, origin: string, next: () => number): Mark[] {
  const chars = Array.from(after);
  let start = 0;
  let end = 0;
  while (start < before.length && before[start].value === chars[start]) start++;
  while (end < Math.min(before.length, chars.length) - start &&
         before[before.length - 1 - end].value === chars[chars.length - 1 - end]) end++;
  const oldCount = before.length - start - end;
  const count = chars.length - start - end;
  const middle: Mark[] = [];
  const insert = (j: number) => middle.push({ origin, index: next(), value: chars[start + j] });
  if (oldCount && count && oldCount * count <= 250000) {
    const width = count + 1;
    const common = new Uint32Array((oldCount + 1) * width);
    for (let i = oldCount - 1; i >= 0; i--) {
      for (let j = count - 1; j >= 0; j--) {
        common[i * width + j] = before[start + i].value === chars[start + j]
          ? 1 + common[(i + 1) * width + j + 1]
          : Math.max(common[(i + 1) * width + j], common[i * width + j + 1]);
      }
    }
    let i = 0;
    for (let j = 0; j < count;) {
      if (i < oldCount && before[start + i].value === chars[start + j]) {
        middle.push(before[start + i++]);
        j++;
      } else if (i < oldCount && common[(i + 1) * width + j] > common[i * width + j + 1]) i++;
      else insert(j++);
    }
  } else for (let j = 0; j < count; j++) insert(j);
  return [...before.slice(0, start), ...middle, ...before.slice(before.length - end)];
}

export function stampPipeListTextChanges<T extends object>(before: T, after: T): T {
  const b = before as RecordData;
  const a = after as RecordData;
  const changes: Record<string, FieldRuns> = {};
  for (const field of textFields) {
    const old = b[field];
    const value = a[field];
    if (typeof old !== 'string' || typeof value !== 'string' || old === value) continue;
    tabId ||= globalThis.crypto.randomUUID();
    changes[field] = pack(editMarks(readRuns(b, field, old) ?? legacyMarks(old), value, tabId, () => sequence++));
  }
  return Object.keys(changes).length ? { ...after, textRuns: { ...(b.textRuns as object), ...changes } } : after;
}

function sideMarks(data: RecordData, field: string, value: string, base: Mark[]) {
  const saved = readRuns(data, field, value);
  if (saved) return saved;
  let index = 0;
  const origin = 'legacy-' + signature(base.map(markId).join('/') + '|' + value);
  return editMarks(base, value, origin, () => index++);
}

// Both sides preserve the order of every character they observed. Merge the
// two sequences at common surviving anchors. A deletion affects only identities
// observed in the common baseline, so it cannot delete a concurrent insertion.
function weave(base: Mark[], left: Mark[], right: Mark[]): Mark[] {
  const ids = (marks: Mark[]) => new Set(marks.map(markId));
  const baseIds = ids(base);
  const leftIds = ids(left);
  const rightIds = ids(right);
  const surviving = (mark: Mark) => !baseIds.has(markId(mark)) || (leftIds.has(markId(mark)) && rightIds.has(markId(mark)));
  const l = left.filter(surviving);
  const r = right.filter(surviving);
  const result: Mark[] = [];
  let i = 0;
  let j = 0;
  while (i < l.length && j < r.length) {
    const x = markId(l[i]);
    const y = markId(r[j]);
    if (x === y) { result.push(l[i++]); j++; }
    else if (leftIds.has(y) || (!rightIds.has(x) && x < y)) result.push(l[i++]);
    else result.push(r[j++]);
  }
  return [...result, ...l.slice(i), ...r.slice(j)];
}

export function mergePipeListRecordText(base: RecordData, remote: RecordData, local: RecordData, merged: RecordData) {
  const metadata: Record<string, FieldRuns> = {};
  for (const field of textFields) {
    const r = remote[field];
    const l = local[field];
    if (typeof r !== 'string' || typeof l !== 'string') {
      const remaining = typeof l === 'string' ? local : remote;
      const value = remaining[field];
      const marks = typeof value === 'string' && readRuns(remaining, field, value);
      if (marks) metadata[field] = pack(marks);
      continue;
    }
    const tracked = [base, remote, local].some(record => Object.prototype.hasOwnProperty.call(record.textRuns ?? {}, field));
    if (!tracked && (r === l || base[field] === r || base[field] === l)) continue;
    const b = typeof base[field] === 'string' ? base[field] as string : '';
    const bMarks = readRuns(base, field, b) ?? legacyMarks(b);
    const result = weave(bMarks, sideMarks(remote, field, r, bMarks), sideMarks(local, field, l, bMarks));
    merged[field] = result.map(m => m.value).join('');
    if (field in ((remote.textRuns as object) || {}) || field in ((local.textRuns as object) || {}) || (r !== l && b !== r && b !== l)) metadata[field] = pack(result);
  }
  if (Object.keys(metadata).length) merged.textRuns = metadata;
}

export function mergePipeListText(base: string, remote: string, local: string) {
  if (base === local || local === remote) return remote;
  if (base === remote) return local;
  const merged: RecordData = {};
  mergePipeListRecordText({ notes: base }, { notes: remote }, { notes: local }, merged);
  return merged.notes as string;
}

export function mapPipeListTextOffset(before: string, after: string, offset: number) {
  if (before === after) return offset;
  const base = legacyMarks(before);
  let next = 0;
  const changed = editMarks(base, after, 'insert', () => next++);
  const origin = base[0]?.origin;
  const boundary = Array.from(before.slice(0, offset)).length;
  let position = 0;
  for (const m of changed) {
    if (m.origin === origin && m.index >= boundary) break;
    position += m.value.length;
  }
  return position;
}

// Strip operation identifiers wherever they occur before creating a public projection.
export function stripPipeListTextMetadata<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripPipeListTextMetadata) as T;
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'textRuns')
    .map(([key, entry]) => [key, stripPipeListTextMetadata(entry)])) as T;
}
