/** Server-only report storage. Never import this module from a browser component. */
import { createHash } from 'node:crypto';
import type { firestore } from 'firebase-admin';
import { DashboardAccessError, loadTeamAccess, validTeamId } from './access';
import type { InsightReport, InsightRole } from './insights';

const COLLECTION = 'coach-team-insight-reports';
const SCHEMA = 1;
export function insightFactsFingerprint(value: unknown): string {
  const canonical = (input: any): any => Array.isArray(input) ? input.map(canonical) : input && typeof input === 'object'
    ? Object.fromEntries(Object.keys(input).sort().filter(key => input[key] !== undefined).map(key => [key, canonical(input[key])])) : input;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
function validDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
export function insightReportId(uid: string, teamId: string, role: InsightRole, to: string) {
  if (!uid || !validTeamId(teamId) || !['coach', 'trainer'].includes(role) || !validDate(to)) throw new DashboardAccessError(400, 'Invalid report period.');
  return `${insightFactsFingerprint({ uid, teamId })}_${role}_${to}`;
}
async function authorize(db: firestore.Firestore, uid: string, teamId: string, role: InsightRole) {
  if (!uid || !validTeamId(teamId) || !['coach', 'trainer'].includes(role)) throw new DashboardAccessError(400, 'Invalid report request.');
  const { access } = await loadTeamAccess(db, uid, teamId);
  if (!(role === 'trainer' ? access.wellbeing : access.participation)) throw new DashboardAccessError(403, 'You do not have access to this report.');
}
export type InsightHistoryItem = Pick<InsightReport, 'role' | 'from' | 'to' | 'generatedAt' | 'mode'>;
type StoredReport = { schema: number; uid: string; teamId: string; role: InsightRole; to: string; fingerprint: string; report: InsightReport };
export async function saveInsightReport(db: firestore.Firestore, uid: string, teamId: string, report: InsightReport, fingerprint: string): Promise<void> {
  const id = insightReportId(uid, teamId, report.role, report.to);
  if (!validDate(report.from) || report.from > report.to || !/^[a-f0-9]{64}$/.test(fingerprint)) throw new DashboardAccessError(400, 'Invalid report evidence.');
  await authorize(db, uid, teamId, report.role);
  await db.collection(COLLECTION).doc(id).set({ schema: SCHEMA, uid, teamId, role: report.role, to: report.to, fingerprint, report } satisfies StoredReport);
}
/** Callers must rebuild permitted facts first; a stored report is never an authorization source. */
export async function findInsightReport(db: firestore.Firestore, uid: string, teamId: string, role: InsightRole, to: string, currentFingerprint: string): Promise<{ status: 'missing' | 'stale' } | { status: 'available'; report: InsightReport }> {
  const id = insightReportId(uid, teamId, role, to);
  await authorize(db, uid, teamId, role);
  const snapshot = await db.collection(COLLECTION).doc(id).get();
  if (!snapshot.exists) return { status: 'missing' };
  const data = snapshot.data() as StoredReport;
  if (data.schema !== SCHEMA || data.uid !== uid || data.teamId !== teamId || data.role !== role || data.to !== to || data.fingerprint !== currentFingerprint || data.report?.role !== role || data.report?.to !== to) return { status: 'stale' };
  return { status: 'available', report: data.report };
}
/** Metadata only: no cached takeaway, athlete names, measurements, or counts are returned. */
export async function listInsightReportHistory(db: firestore.Firestore, uid: string, teamId: string, role: InsightRole): Promise<InsightHistoryItem[]> {
  await authorize(db, uid, teamId, role);
  const snapshot = await db.collection(COLLECTION).where('uid', '==', uid).where('teamId', '==', teamId).where('role', '==', role).get();
  return snapshot.docs.flatMap(doc => {
    const data = doc.data() as StoredReport;
    if (data.schema !== SCHEMA || data.uid !== uid || data.teamId !== teamId || data.role !== role || data.report?.role !== role) return [];
    const { from, to, generatedAt, mode } = data.report;
    return [{ role, from, to, generatedAt, mode }];
  }).sort((a, b) => b.to.localeCompare(a.to));
}
/** Idempotent per viewer/role/week; AI and permitted evidence are supplied by the shared generator. */
export async function backfillInsightReports(options: { db: firestore.Firestore; uid: string; teamId: string; role: InsightRole; weekEnds: string[]; generate: (to: string) => Promise<{ report: InsightReport; fingerprint: string }> }) {
  const { db, uid, teamId, role, generate } = options;
  const weeks = [...new Set(options.weekEnds)].sort();
  weeks.forEach(to => insightReportId(uid, teamId, role, to));
  await authorize(db, uid, teamId, role);
  const results: { to: string; mode: InsightReport['mode'] }[] = [];
  for (const to of weeks) {
    // Recheck between weeks so long-running backfills cannot continue after role revocation.
    await authorize(db, uid, teamId, role);
    const { report, fingerprint } = await generate(to);
    if (report.role !== role || report.to !== to) throw new Error('Generated report does not match requested period.');
    await saveInsightReport(db, uid, teamId, report, fingerprint);
    results.push({ to, mode: report.mode });
  }
  return results;
}
