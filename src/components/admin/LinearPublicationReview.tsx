import LinearSharedControls from './LinearSharedControls';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';
import React, { useMemo, useState } from 'react';
import { LinearCurriculumEntry } from '../../api/firebase/dailyCurriculum/linearCurriculum';
import { LinearPublicationDraft, validateLinearPublication, buildLinearVersion, previewLinearAssignment } from '../../api/firebase/dailyCurriculum/linearPublication';

/** Review rehearsal only. Does not publish, enroll, or write athlete records. */
export default function LinearPublicationReview({ orderedIds, rationales, active }: { orderedIds: string[]; rationales: Record<string, string>; active: LinearCurriculumEntry[] }) {
  const [audience, setAudience] = useState(false);
  const [practice, setPractice] = useState('');
  const [use, setUse] = useState('');
  const [serverReview, setServerReview] = useState<{ signature: string; message: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const draft: LinearPublicationDraft = useMemo(() => ({ orderedIds, rationales, audience: audience ? { mode: 'explicit_athlete_ids', confirmed: true } : null, progressionBasis: 'five_days_in_fourteen', protocolDays: [5, 5, 5], simulationDays: practice && use ? { practice: Number(practice), useIt: Number(use) } : null }), [orderedIds, rationales, audience, practice, use]);
  const signature = JSON.stringify(draft);
  const validation = validateLinearPublication(draft, active);
  const current = review === signature;
  const preview = current ? previewLinearAssignment({ featureEnabled: true, athleteId: 'review-only', version: buildLinearVersion({ id: 'local-review', status: 'published', publishedAt: new Date().toISOString(), draft, active }), enrollment: { athleteId: 'review-only', versionId: 'local-review', optedIn: true, historyPolicy: 'preserve', startedOn: '2026-09-13', timezone: 'America/New_York' }, asOf: '2026-09-13' }) : null;
  const checkServer = async () => {
    setChecking(true);
    try {
      if (!auth.currentUser) throw new Error('Sign in with an administrator account to check the current library.');
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/curriculum/publication', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...getFirebaseModeRequestHeaders() }, body: JSON.stringify({ action: 'review', draft }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || 'The current library could not be checked.');
      setServerReview({ signature, message: result.publishable ? `Server review passed for this draft. Review reference: ${result.reviewFingerprint.slice(0, 12)}. No writes performed.` : result.errors.join(' ') });
    } catch (error) { setServerReview({ signature, message: error instanceof Error ? error.message : 'The current library could not be checked.' }); }
    finally { setChecking(false); }
  };
  const field = 'ml-2 rounded border border-stone-300 bg-white p-2';
  return <details className="rounded-lg border border-stone-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold">Review draft for publishing</summary>
    <div className="mt-4 space-y-4 text-sm">
      <p>Local review only. Publishing creates a fixed version; athlete enrollment is a separate explicit action. Athletes finish their entire current skill using its pinned content, phase plan and progress window. At the skill boundary, the latest applicable order supplies the earliest eligible skill they have not completed. Publishing never resets their progress or history.</p>
      <p className="text-stone-600">The five-of-fourteen progression rule is selected. Audience and simulation phase settings remain review items. This rehearsal does not save live configuration.</p>
      <label className="block"><input type="checkbox" checked={audience} onChange={e => setAudience(e.target.checked)} /> Proposed audience: only athletes explicitly enrolled in this version. No athletes selected or enrolled.</label>
      <p><strong>Progression: five distinct completion days within fourteen days.</strong> Days can be nonconsecutive. A repeat on the same local date counts once. The window starts when the phase begins, includes day 14, and restarts the current phase count on day 15 if fewer than five days were completed. All history stays saved. The next phase begins the day after the fifth qualifying completion.</p>
      <p>Protocols: Learn 5 → Practice 5 → Use it 5. Journaling stays inside Use it.</p>
      <div className="flex flex-wrap gap-3"><label>Simulation Practice completion days<input className={field} aria-label="Simulation Practice completion days" type="number" min="5" max="5" value={practice} onChange={e => setPractice(e.target.value)} /></label><label>Simulation Use it completion days<input className={field} aria-label="Simulation Use it completion days" type="number" min="5" max="5" value={use} onChange={e => setUse(e.target.value)} /></label></div>
      <p className="text-stone-600">Simulation learning belongs in the first Practice session. Confirm these simulation phase settings for review. Each confirmed phase uses the same five-of-fourteen policy. Completion dates use the athlete’s pinned timezone; calendar time alone never advances a phase.</p>
      {validation.errors.length > 0 && <ul className="list-disc space-y-1 pl-5 text-amber-900">{validation.errors.map(error => <li key={error}>{error}</li>)}</ul>}
      <button className="rounded bg-stone-950 px-4 py-2 text-white disabled:opacity-40" disabled={validation.errors.length > 0} onClick={() => setReview(signature)}>Review this exact draft</button>
      <button className="ml-2 rounded border border-stone-300 px-4 py-2 disabled:opacity-40" disabled={!current || checking} onClick={checkServer}>{checking ? 'Checking library…' : 'Check against current library'}</button>
      {serverReview && <p role="status" className="text-stone-700">{serverReview.signature === signature ? serverReview.message : 'Draft changed since the server check. Check it again.'}</p>}
      <p role="status">{current ? 'Draft reviewed locally. No published version or enrollment was created.' : review ? 'Draft changed since review. Review it again before publishing.' : 'Not reviewed.'}</p>
      {preview && <div className="rounded border border-amber-200 bg-amber-50 p-3"><h3 className="font-semibold">Athlete assignment readiness</h3><p className="mt-1">{preview.kind === 'assignment' ? `${preview.skillName}: ${preview.phase}, ${preview.phasePosition} of ${preview.phaseLength}` : preview.kind === 'skill_complete' ? 'This skill is complete.' : preview.reason}</p><p className="mt-2">Content previews are available in each skill’s review details. No skill receives runtime approval from this rehearsal.</p></div>}
      <LinearSharedControls draft={draft} valid={validation.errors.length === 0} />
      <p className="text-xs text-stone-600">Shared actions follow the server rollout flags. Protected storage, per-skill runtime approval and explicit enrollment are required before athlete delivery.</p>
    </div>
  </details>;
}
