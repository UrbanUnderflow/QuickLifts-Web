import { pipeListSnapshotsEqual } from './pipelistsCollaboration';

// Monotonic document revision is enforced by Firestore rules. Wall-clock item
// timestamps are descriptive metadata, never permission to overwrite a record.
export function nextPipeListsRevision(data?: { revision?: unknown; writeProtocol?: unknown }) {
  // Activation is an explicit administrative operation after rules rollout.
  // Unmarked documents remain compatible with the currently deployed rules.
  if (data?.writeProtocol !== 2) return {};
  const current = data?.revision;
  if (current !== undefined && (!Number.isSafeInteger(current) || Number(current) < 0)) throw new Error('Invalid PipeLists revision. Refresh before saving.');
  return { writeProtocol: 2, revision: Number(current || 0) + 1 };
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const keyed = (value: unknown): value is { id: string }[] => Array.isArray(value) && value.every(entry => record(entry) && typeof entry.id === 'string');
const metadata = new Set(['updatedAt', 'createdAt', 'lastEditedBy', 'mergeRevisions']);

export function pipeListWriteConflicts(base: unknown, remote: unknown, local: unknown, path = ''): string[] {
  if (pipeListSnapshotsEqual(remote, base) || pipeListSnapshotsEqual(local, base) || pipeListSnapshotsEqual(remote, local)) return [];
  if (keyed(remote) && keyed(local) && (base === undefined || keyed(base))) {
    const b = new Map((base || []).map(entry => [entry.id, entry]));
    const r = new Map(remote.map(entry => [entry.id, entry]));
    const l = new Map(local.map(entry => [entry.id, entry]));
    return [...new Set([...r.keys(), ...l.keys()])].flatMap(id => pipeListWriteConflicts(b.get(id), r.get(id), l.get(id), `${path}/${id}`));
  }
  // Missing entries are retained, not interpreted as deletion. Explicit
  // deletedAt/movedToListId fields carry deletion and move intent instead.
  if (remote === undefined || local === undefined) return [];
  if (record(remote) && record(local)) {
    const b = record(base) ? base : {};
    return [...new Set([...Object.keys(remote), ...Object.keys(local)])].filter(key => !metadata.has(key))
      .flatMap(key => pipeListWriteConflicts(b[key], remote[key], local[key], `${path}/${key}`));
  }
  return [path];
}

export function assertPipeListWriteSafe(base: unknown, remote: unknown, local: unknown) {
  const conflicts = pipeListWriteConflicts(base, remote, local);
  if (conflicts.length) throw new Error(`Another session changed the same fields (${conflicts.slice(0, 3).join(', ')}). Your edits remain open. Export a full backup, then reload the saved version before editing again.`);
}
