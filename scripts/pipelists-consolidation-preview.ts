// Read-only preview. Deliberately contains no Firestore writes or Auth mutations.
// Run with existing authorized ADC/service-account environment, never credentials
// on the command line. Full-fidelity backups are private files outside the repo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getSimpBudgetAuth, getSimpBudgetFirestore } from '../netlify/functions/utils/getSimpBudgetServiceAccount';
import { pipeListSnapshotsEqual } from '../src/utils/pipelistsCollaboration';
import { mergeMovedLead, planPipeListsConsolidation } from '../src/utils/pipelistsIntegrity';

async function main() {
  const output = process.argv[2];
  if (!output || !path.isAbsolute(output) || output.startsWith(process.cwd() + path.sep)) throw new Error('Supply a private absolute output directory outside the repository.');
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const auth = await getSimpBudgetAuth();
  const db = await getSimpBudgetFirestore();
  const sourceUser = await auth.getUserByEmail('tremaine.grant@gmail.com');
  const destinationUser = await auth.getUserByEmail('tre@fitwithpulse.ai');
  if (sourceUser.uid === destinationUser.uid || destinationUser.disabled || !destinationUser.emailVerified) throw new Error('Destination must be a separate enabled, verified account.');
  const source = await db.doc(`simpbudget-users/${sourceUser.uid}/pipeLists/state`).get();
  const destination = await db.doc(`simpbudget-users/${destinationUser.uid}/pipeLists/state`).get();
  const lists = source.data()?.lists || [];
  const resolve = (name: string) => {
    const matches = lists.filter((list: any) => list.name === name);
    if (matches.length !== 1) throw new Error(`Expected exactly one ${name} list, found ${matches.length}.`);
    return matches[0];
  };
  const grants = resolve('Grants');
  const pitch = resolve('Pitch Competitions');
  const snapshots: any[] = [source, destination];
  const scopedShares: any[] = [];
  for (const list of [grants, pitch]) {
    for (const collection of ['pipeListShares', 'pipeListProtectedShares']) {
      const snapshot = await db.doc(`${collection}/${sourceUser.uid}-${list.id}`).get();
      snapshots.push(snapshot); scopedShares.push(snapshot);
    }
    const links = await db.collection('pipeLeadShares').where('ownerUid', '==', sourceUser.uid).where('listId', '==', list.id).get();
    snapshots.push(...links.docs);
  }
  // Firestore wire values preserve timestamps, bytes, references and integers
  // exactly, unlike JSON.stringify(snapshot.data()). Hashes guard rollback inputs.
  const backup = {
    version: 1, capturedAt: new Date().toISOString(), sourceUid: sourceUser.uid, destinationUid: destinationUser.uid,
    documents: snapshots.map(snapshot => ({ path: snapshot.ref.path, exists: snapshot.exists,
      updateTime: snapshot.updateTime ? { seconds: snapshot.updateTime.seconds, nanoseconds: snapshot.updateTime.nanoseconds } : null,
      fields: snapshot.exists ? snapshot._fieldsProto : null })),
  };
  const backupBytes = JSON.stringify(backup, null, 2);
  const hash = crypto.createHash('sha256').update(backupBytes).digest('hex');
  const backupPath = path.join(output, `backup-${hash.slice(0, 12)}.json`);
  fs.writeFileSync(backupPath, backupBytes, { mode: 0o600, flag: 'wx' });
  for (const list of [grants, pitch]) {
    const protectedSnapshot = scopedShares.find(snapshot => snapshot.ref.path === `pipeListProtectedShares/${sourceUser.uid}-${list.id}`);
    if (protectedSnapshot?.exists && !pipeListSnapshotsEqual(protectedSnapshot.data()?.list?.items, list.items)) {
      throw new Error(`Protected ${list.name} records differ from personal state. Backup saved; reconcile before migration.`);
    }
  }
  if ((destination.data()?.lists || []).some((list: any) => list.id === grants.id)) throw new Error('Destination Grants ID already exists. Backup saved; review before migration.');
  const byId = new Map<string, any>(grants.items.map((item: any) => [item.id, item]));
  const records = pitch.items.map((item: any) => {
    const existing = byId.get(item.id);
    const titleMatches = grants.items.filter((other: any) => other.title?.trim().toLowerCase() === item.title?.trim().toLowerCase());
    let result = item.deletedAt ? 'keep-source-tombstone' : existing ? 'merge-same-id-prefer-grants' : titleMatches.length ? 'manual-review-different-id' : 'move-unique-record';
    if (existing?.deletedAt || existing?.movedToListId) result = 'manual-review-destination-tombstone';
    if (result === 'merge-same-id-prefer-grants') mergeMovedLead(item, existing);
    return { id: item.id, title: item.title, result, sourceDeleted: Boolean(item.deletedAt), destinationId: existing?.id || null,
      differentIdTitleMatches: titleMatches.filter((other: any) => other.id !== item.id).map((other: any) => other.id),
      differingFields: existing ? Object.keys(item).filter(key => JSON.stringify(item[key]) !== JSON.stringify(existing[key])) : [],
      sourceLogs: item.weeklyLogs?.length || 0, destinationLogs: existing?.weeklyLogs?.length || 0,
      sourceAttachments: item.attachments?.length || 0, destinationAttachments: existing?.attachments?.length || 0 };
  });
  const consolidated = planPipeListsConsolidation(pitch, grants, backup.capturedAt);
  const proposedPath = path.join(output, `proposed-${hash.slice(0, 12)}.json`);
  fs.writeFileSync(proposedPath, JSON.stringify({
    backupSha256: hash, basedOn: backup.documents.map(document => ({ path: document.path, updateTime: document.updateTime })),
    destinationUid: destinationUser.uid,
    grants: { ...consolidated.destination, publicLinksDisabled: true },
    pitchAfterConsolidation: consolidated.source,
    activeGrants: consolidated.destination.items.filter((item: any) => !item.deletedAt).length,
    activePitch: consolidated.source.items.filter((item: any) => !item.deletedAt).length,
    securityApprovalRequired: true, permanentDeletionApproved: false,
  }, null, 2), { mode: 0o600, flag: 'wx' });
  const preview = {
    mode: 'preview-only', backupPath, backupSha256: hash, proposedPath,
    source: { uid: sourceUser.uid, email: sourceUser.email }, destination: { uid: destinationUser.uid, email: destinationUser.email, verified: destinationUser.emailVerified },
    lists: [grants, pitch].map(list => ({ id: list.id, name: list.name, active: list.items.filter((item: any) => !item.deletedAt).length, tombstones: list.items.filter((item: any) => item.deletedAt).length })),
    records,
    shares: scopedShares.filter(snapshot => snapshot.exists).map(snapshot => ({ path: snapshot.ref.path, listId: snapshot.data().listId || snapshot.data().list?.id, publicRead: snapshot.data().publicRead, viewers: snapshot.data().viewerEmails, editors: snapshot.data().editorEmails, pending: Object.entries(snapshot.data().inviteStatuses || {}).filter(([, value]: any) => value.status === 'sent').map(([email]) => email) })),
    leadLinkCount: snapshots.filter(snapshot => snapshot.ref.parent.id === 'pipeLeadShares').length,
    emptyListsForSeparateConfirmation: lists.filter((list: any) => !list.items.some((item: any) => !item.deletedAt)).map((list: any) => ({ id: list.id, name: list.name, tombstones: list.items.length })),
    destinationCollision: (destination.data()?.lists || []).some((list: any) => list.id === grants.id),
    proposedSteps: ['Recheck every document updateTime and backup checksum before writes.', 'Merge into a private Grants list under the verified destination UID, preserving destination state and all Grants fields; keep conflicts as full revisions.', 'Verify destination read/edit ownership and the exact migrated record count before revoking source access.', 'Revoke only affected list/lead public links and collaborators. Retain unrelated list permissions.', 'Remove source canonical copies only after action-time ownership confirmation; retain a private rollback backup outside both workspaces.', 'Permanent deletion of named empty lists requires separate confirmation. No permanent deletion is part of this preview.'],
    rollback: 'Use wire-value backups with compare-and-swap updateTime guards. Restore only affected list entries and scoped share documents, never replace an entire workspace after unrelated changes.',
  };
  const previewPath = path.join(output, `preview-${hash.slice(0, 12)}.json`);
  fs.writeFileSync(previewPath, JSON.stringify(preview, null, 2), { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ previewPath, proposedPath, backupPath, backupSha256: hash, lists: preview.lists, records: records.map(({id,title,result}: any) => ({id,title,result})), destinationCollision: preview.destinationCollision, emptyListsForSeparateConfirmation: preview.emptyListsForSeparateConfirmation }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
