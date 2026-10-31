import { mergePipeListSnapshotsThreeWay, pipeListSnapshotsEqual } from './pipelistsCollaboration';

export type ArchivedPipeList<T> = { list: T; archivedAt: string; restoredAt?: string; transferredToUid?: string };

export function isArchived(value: unknown): boolean {
  const entry = value as { archivedAt?: string; restoredAt?: string } | undefined;
  return Boolean(entry && (!entry.restoredAt || (entry.archivedAt || '') > entry.restoredAt));
}

export function mergeArchiveMarkers<T extends { archivedAt: string; restoredAt?: string }>(previous: Record<string, T>, incoming: Record<string, T>): Record<string, T> {
  const result = { ...previous };
  for (const [id, entry] of Object.entries(incoming)) {
    const timestamp = (value: T) => [value.archivedAt, value.restoredAt || ''].sort().at(-1)!;
    if (!result[id] || timestamp(entry) >= timestamp(result[id])) result[id] = entry;
  }
  return result;
}

// Markers live outside the lists array, so an old client writing that array
// cannot undo a deletion. Only an explicit restore supersedes a marker.
export function visiblePipeLists<T extends { id: string }>(lists: T[], archived: Record<string, unknown> = {}): T[] {
  return lists.filter(list => !isArchived(archived[list.id]));
}

export function reconcilePipeLists<T extends { id: string }>(base: T[], remote: T[], local: T[], archived: Record<string, unknown> = {}, ignoreTimestampOrder = false): T[] {
  // List disappearance also requires a durable archive marker. A partial
  // workspace snapshot is not an explicit delete operation.
  const complete = (side: T[]) => [...side, ...[...local, ...remote, ...base].filter((list, index, all) => !side.some(existing => existing.id === list.id) && all.findIndex(candidate => candidate.id === list.id) === index)];
  return visiblePipeLists(mergePipeListSnapshotsThreeWay(base, complete(remote), complete(local), ignoreTimestampOrder), archived);
}

type MergeableLead = { id: string; deletedAt?: string; movedToListId?: string; [key: string]: unknown };

// Prefer the destination's decisions, including intentional blanks and statuses.
// Preserve the complete incoming version in a revision when anything differs.
// Arrays retain distinct entries (including conflicting log/attachment versions).
export function mergeMovedLead<T extends { id: string; deletedAt?: string; movedToListId?: string }>(source: T, destination?: T): T {
  if (!destination) return source;
  if (source.id !== destination.id) throw new Error('Only identical record IDs can be merged automatically.');
  if (destination.deletedAt || destination.movedToListId) throw new Error('The destination contains a deleted or moved record. Restore or review it before moving.');
  const incoming = source as unknown as MergeableLead;
  const existing = destination as unknown as MergeableLead;
  const merged: MergeableLead = { ...incoming, ...existing };
  for (const key of Object.keys(incoming)) {
    if (Array.isArray(incoming[key]) && Array.isArray(existing[key])) {
      const entries = [...existing[key] as unknown[], ...incoming[key] as unknown[]];
      merged[key] = entries.filter((entry, index) => entries.findIndex(other =>
        entry && other && typeof entry === 'object' && typeof other === 'object' && 'id' in entry && 'id' in other
          ? entry.id === other.id : pipeListSnapshotsEqual(other, entry)) === index);
    }
  }
  if (!pipeListSnapshotsEqual(source, destination)) {
    // Avoid nesting revision history, while retaining every earlier revision.
    const { mergeRevisions: sourceRevisions, ...snapshot } = incoming;
    const revisions = [...(Array.isArray(existing.mergeRevisions) ? existing.mergeRevisions : []),
      ...(Array.isArray(sourceRevisions) ? sourceRevisions : []), snapshot];
    merged.mergeRevisions = revisions.filter((entry, index) => revisions.findIndex(other => pipeListSnapshotsEqual(other, entry)) === index);
  }
  return merged as unknown as T;
}

export function planPipeListsConsolidation<T extends { id: string; items: { id: string; title?: string; deletedAt?: string; movedToListId?: string }[] }>(source: T, destination: T, now: string) {
  if (source.id === destination.id) throw new Error('Choose two different lists.');
  const items = [...destination.items];
  const sourceItems = source.items.map(item => {
    if (item.deletedAt || item.movedToListId) return item;
    const index = items.findIndex(existing => existing.id === item.id);
    if (index < 0 && items.some(existing => item.title && existing.title?.trim().toLowerCase() === item.title.trim().toLowerCase())) {
      throw new Error(`Different IDs share the title ${item.title}; review before consolidation.`);
    }
    const merged = mergeMovedLead(item, index < 0 ? undefined : items[index]);
    if (index < 0) items.push(merged); else items[index] = merged;
    return { ...item, deletedAt: now, movedToListId: destination.id, updatedAt: now };
  });
  return { source: { ...source, items: sourceItems }, destination: { ...destination, items }, moved: sourceItems.filter((item, index) => item !== source.items[index]).length };
}

export function removeListMember(data: { viewerEmails?: string[]; editorEmails?: string[]; inviteStatuses?: Record<string, unknown> }, email: string) {
  const viewerEmails = (data.viewerEmails || []).filter(value => value.toLowerCase() !== email.toLowerCase());
  const editorEmails = (data.editorEmails || []).filter(value => value.toLowerCase() !== email.toLowerCase());
  const inviteStatuses = Object.fromEntries(Object.entries(data.inviteStatuses || {}).filter(([key]) => key.toLowerCase() !== email.toLowerCase()));
  return { viewerEmails, editorEmails, inviteStatuses, access: editorEmails.length ? 'edit' : 'read' };
}
