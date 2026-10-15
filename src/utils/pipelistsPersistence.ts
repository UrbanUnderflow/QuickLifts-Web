import { pipeListSnapshotsEqual } from './pipelistsCollaboration';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const keyed = (value: unknown[]): value is Array<RecordValue & { id: string }> => value.every(entry => record(entry) && typeof entry.id === 'string' && entry.id.length > 0) && new Set(value.map(entry => (entry as RecordValue).id)).size === value.length;

/** Apply only actual view edits to the stored representation. Display defaults,
 * hidden archived records, future fields and normalized stage IDs are not edits.
 * Call after the existing three-way concurrency merge, inside its transaction.
 */
export function applyPipeListViewEdits<T>(stored: T, displayed: unknown, edited: unknown): T {
  if (pipeListSnapshotsEqual(displayed, edited)) return stored;
  if (Array.isArray(displayed) && Array.isArray(edited) && Array.isArray(stored) && keyed(displayed) && keyed(edited) && keyed(stored)) {
    const before = new Map(displayed.map(entry => [entry.id, entry]));
    const after = new Map(edited.map(entry => [entry.id, entry]));
    const raw = new Map(stored.map(entry => [entry.id, entry]));
    // Preserve raw ordering when only values changed. A deliberate view reorder
    // is applied while retaining records not represented in that view.
    const beforeIds = displayed.map(entry => entry.id);
    const afterIds = edited.map(entry => entry.id);
    const reordered = !pipeListSnapshotsEqual(beforeIds, afterIds);
    const ids = reordered ? [...after.keys(), ...raw.keys()].filter((id, index, all) => all.indexOf(id) === index) : [...raw.keys(), ...after.keys()].filter((id, index, all) => all.indexOf(id) === index);
    return ids.flatMap(id => {
      if (before.has(id) && !after.has(id)) return [];
      if (!after.has(id)) return raw.has(id) ? [raw.get(id)] : [];
      if (!before.has(id)) return [after.get(id)];
      if (!raw.has(id)) return pipeListSnapshotsEqual(before.get(id), after.get(id)) ? [] : [after.get(id)];
      return [applyPipeListViewEdits(raw.get(id), before.get(id), after.get(id))];
    }) as T;
  }
  if (Array.isArray(stored) && Array.isArray(displayed) && Array.isArray(edited) && [...stored, ...displayed, ...edited].some(record)) {
    throw new Error('This legacy list has missing or duplicate record IDs. Review and repair those records before saving edits to them.');
  }
  if (record(displayed) && record(edited)) {
    const result: RecordValue = record(stored) ? { ...stored } : {};
    for (const key of new Set([...Object.keys(displayed), ...Object.keys(edited)])) {
      if (pipeListSnapshotsEqual(displayed[key], edited[key])) continue;
      if (!(key in edited)) delete result[key];
      else result[key] = applyPipeListViewEdits(result[key], displayed[key], edited[key]);
    }
    return result as T;
  }
  return edited as T;
}

export function preserveStoredUniversityList<T extends { templateKey?: string }>(stored: T, displayed: T, edited: T): T {
  return stored.templateKey === 'university-pilot' ? applyPipeListViewEdits(stored, displayed, edited) : edited;
}
