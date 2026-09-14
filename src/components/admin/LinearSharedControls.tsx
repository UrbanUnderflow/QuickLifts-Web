import React, { useEffect, useState } from 'react';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';
import type { LinearPublicationDraft } from '../../api/firebase/dailyCurriculum/linearPublication';
export default function LinearSharedControls({ draft, valid }: { draft: LinearPublicationDraft; valid: boolean }) {
  const signature = JSON.stringify(draft);
  const [flags, setFlags] = useState({ sharedWrites: false, runtime: false });
  const [shared, setShared] = useState<{ id: string; revision: number; signature: string; fingerprint: string; review?: string } | null>(null);
  const [approvedIds, setApprovedIds] = useState(''), [runtimeReviewed, setRuntimeReviewed] = useState(false);
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [published, setPublished] = useState('');
  const [audience, setAudience] = useState(''), [athlete, setAthlete] = useState(''), [timezone, setTimezone] = useState('');
  const [audienceRevision, setAudienceRevision] = useState<number | null>(null), [confirmed, setConfirmed] = useState(false);
  useEffect(() => { let live = true; fetch('/api/admin/curriculum/status').then(r => r.json()).then(value => { if (live) setFlags({ sharedWrites: value.sharedWrites === true, runtime: value.runtime === true }); }).catch(() => {}); return () => { live = false; }; }, []);
  const post = async (path: string, body: unknown) => {
    if (!auth.currentUser) throw new Error('Sign in with an administrator account.');
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/admin/curriculum/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...getFirebaseModeRequestHeaders() }, body: JSON.stringify(body) });
    const value = await response.json(); if (!response.ok) throw new Error(value.message || value.error || 'Request could not be completed.'); return value;
  };
  const run = async (work: () => Promise<void>) => { setBusy(true); setMessage(''); try { await work(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Request could not be completed.'); } finally { setBusy(false); } };
  const current = shared?.signature === signature;
  return <section className="space-y-3 rounded border border-stone-200 p-3">
    <h3 className="font-semibold">Shared version workflow</h3>
    <p className="text-xs text-stone-600">{flags.sharedWrites ? 'Shared saving and publishing are enabled on this server.' : 'Shared saving and publishing are disabled on this server.'} Publishing stores content; athlete enrollment is separate. Runtime approval is a separate per-skill review and is never inferred from this button.</p>
    <details><summary className="cursor-pointer text-xs font-medium">Per-skill runtime approval</summary><div className="mt-2 space-y-2 text-xs"><p>Only enter skill IDs after reviewing their guided content, independent practice or game, Use flow, and completion behavior on the supported athlete apps. Empty means no skills are approved for assignment.</p><label className="block">Reviewed skill IDs<input value={approvedIds} onChange={e => { setApprovedIds(e.target.value); setRuntimeReviewed(false); }} placeholder="Comma-separated canonical skill IDs" className="mt-1 w-full rounded border p-2" /></label><label><input type="checkbox" checked={runtimeReviewed} onChange={e => setRuntimeReviewed(e.target.checked)} /> I completed runtime review for these exact skills.</label></div></details>
    <div className="flex flex-wrap gap-2">
      <button disabled={!flags.sharedWrites || !valid || busy} className="rounded border px-3 py-2 disabled:opacity-40" onClick={() => void run(async () => { const checked = await post('publication', { action: 'review', draft }); const saved = await post('publication', { action: 'save_draft', draft, draftId: shared?.id, expectedDraftRevision: shared?.revision ?? null, expectedCatalogFingerprint: checked.catalogFingerprint }); setShared({ id: saved.draft.id, revision: saved.draft.revision, signature, fingerprint: checked.catalogFingerprint }); setMessage(`Shared draft revision ${saved.draft.revision} saved. Review it before publishing.`); })}>Save shared draft</button>
      <button disabled={!flags.sharedWrites || !current || busy} className="rounded border px-3 py-2 disabled:opacity-40" onClick={() => void run(async () => { const checked = await post('publication', { action: 'review', draftId: shared!.id, expectedCatalogFingerprint: shared!.fingerprint }); if (!checked.publishable || checked.draftRevision !== shared!.revision) throw new Error('The shared draft changed or requires further decisions.'); setShared({ ...shared!, review: checked.reviewFingerprint }); setMessage(`Shared revision ${shared!.revision} reviewed.`); })}>Review shared revision</button>
      <button disabled={!flags.sharedWrites || !current || !shared?.review || (approvedIds.trim().length > 0 && !runtimeReviewed) || busy} className="rounded border px-3 py-2 disabled:opacity-40" onClick={() => void run(async () => { const result = await post('publication', { action: 'publish', draftId: shared!.id, expectedDraftRevision: shared!.revision, expectedCatalogFingerprint: shared!.fingerprint, expectedReviewFingerprint: shared!.review, runtimeReadySkillIds: approvedIds.split(',').map(id => id.trim()).filter(Boolean), confirmRuntimeReviewed: runtimeReviewed }); setPublished(result.versionId); setMessage(`Version ${result.versionId} published. No athletes were enrolled.`); })}>Publish reviewed version</button>
    </div>
    {shared && <p className="text-xs">Shared draft {shared.id}, revision {shared.revision}. {current ? shared.review ? 'Reviewed.' : 'Needs review.' : 'Local draft has changed.'}</p>}
    <details><summary className="cursor-pointer font-medium">Explicit audience and enrollment</summary><div className="mt-3 space-y-3">
      <p className="text-xs">{flags.runtime ? 'Runtime routing is enabled.' : 'Runtime routing and enrollment are disabled.'} A runtime-approved version is required. Existing enrollment is never replaced by this action.</p>
      <label className="block">Published version<input className="ml-2 rounded border p-2" value={published} onChange={e => setPublished(e.target.value)} /></label>
      <label className="block">Audience ID<input className="ml-2 rounded border p-2" value={audience} onChange={e => { setAudience(e.target.value); setAudienceRevision(null); }} /></label>
      <label className="block">Athlete account ID<input className="ml-2 rounded border p-2" value={athlete} onChange={e => setAthlete(e.target.value)} /></label>
      <label className="block">Athlete timezone<input className="ml-2 rounded border p-2" placeholder="America/New_York" value={timezone} onChange={e => setTimezone(e.target.value)} /></label>
      <label className="block"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I have confirmed this athlete’s opt-in. Preserve all prior history.</label>
      <button disabled={!flags.runtime || !confirmed || !published || !audience || !athlete || busy} className="rounded border px-3 py-2 disabled:opacity-40" onClick={() => void run(async () => { const result = await post('enrollment', { action: 'set_audience', audienceId: audience, versionId: published, athleteIds: [athlete], expectedRevision: audienceRevision }); setAudienceRevision(result.audience.revision); setMessage('Explicit audience saved. No athlete enrollment was changed.'); })}>Save this explicit audience</button>
      <button disabled={!flags.runtime || !confirmed || !audienceRevision || !timezone || busy} className="ml-2 rounded border px-3 py-2 disabled:opacity-40" onClick={() => void run(async () => { await post('enrollment', { action: 'enroll', audienceId: audience, athleteId: athlete, timezone, confirmOptIn: true, preserveHistory: true, expectedStateRevision: null }); setMessage('Explicit enrollment is recorded. Prior history is preserved.'); })}>Enroll this athlete</button>
    </div></details>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
