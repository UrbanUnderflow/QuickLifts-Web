import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AlertCircle, CheckCircle2, Clock, RefreshCw} from 'lucide-react';
import {auth, isUsingDevFirebase} from '../../api/firebase/config';
import {getEquityEmailDelivery, equityEmailTimestamp} from '../../lib/equityEmailDelivery';

export type DeliveryRequest = {
  id: string; packageId?: string; documentType?: string; documentName?: string; equityDocumentId?: string;
  recipientName?: string; recipientEmail?: string; status?: string; emailStatus?: string;
  messageId?: string | null; emailDelivery?: any; sentAt?: unknown; lastSentAt?: unknown;
  previewMode?: boolean; invalidatedAt?: unknown;
};
export type SubmissionIssue = {stage: 'prepare' | 'send'; documentId: string; documentName: string; requestId?: string; recipientName?: string; recipientEmail?: string; message: string; occurredAt?: string};
export type DeliveryControls = {
  submissionIssues: SubmissionIssue[]; recordSubmissionIssue: (issue: SubmissionIssue) => void; clearSubmissionIssue: (documentId: string, requestId?: string) => void;
  check: (requestIds?: string[]) => Promise<void>; checkingIds: string[]; error: string;
};
export function deliveryRequests(requests: DeliveryRequest[]) {
  const roots = new Map(requests.map(request => [request.id, request]));
  return [...new Map(requests.filter(request => !request.invalidatedAt).map(request => {
    const parent = request.packageId && roots.get(request.packageId);
    const resolved = parent || request;
    return [resolved.packageId || resolved.id, resolved] as const;
  })).values()].filter(request => Boolean(request.emailDelivery || request.messageId || request.emailStatus || request.sentAt || request.lastSentAt || ['sent', 'delivered', 'failed', 'soft_bounce', 'hard_bounce', 'blocked', 'deferred'].includes(request.status || '')));
}
export function withPackageEmailDelivery<T extends DeliveryRequest>(requests: T[]): T[] {
  const roots = new Map(requests.map(request => [request.id, request]));
  return requests.map(request => {
    const parent = request.packageId && roots.get(request.packageId);
    return parent ? {...request, emailDelivery: getEquityEmailDelivery(parent)} : request;
  });
}
export function deliveryCheckErrors(results: Array<{requestId: string; error?: unknown; emailDelivery?: {checkError?: unknown}}>, requests: DeliveryRequest[]): string[] {
  return [...new Set(results.flatMap(result => {
    if (typeof result.error !== 'string' || !result.error.trim() || result.emailDelivery?.checkError) return [];
    const request = requests.find(item => (item.packageId || item.id) === result.requestId);
    return [`${request?.documentName || 'Signature request'}: ${result.error.trim()}`];
  }))];
}
export function useEquityDeliveryChecks(requests: DeliveryRequest[], applyResults: (results: Array<{requestId: string; emailDelivery?: any}>) => void): DeliveryControls {
  const latest = useRef(requests);
  latest.current = requests;
  const [checkingIds, setCheckingIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [submissionIssues, setSubmissionIssues] = useState<SubmissionIssue[]>([]);
  const issueRef = useRef<SubmissionIssue[]>([]);
  const storageKey = auth.currentUser?.uid ? `equity-email-submission:${isUsingDevFirebase() ? 'dev' : 'prod'}:${auth.currentUser.uid}` : '';
  const storeIssues = useCallback((issues: SubmissionIssue[]) => {
    issueRef.current = issues; setSubmissionIssues(issues);
    if (storageKey && typeof window !== 'undefined') {try {window.localStorage.setItem(storageKey, JSON.stringify(issues));} catch {}}
  }, [storageKey]);
  useEffect(() => {
    let issues: SubmissionIssue[] = [];
    if (storageKey) {try {const saved = JSON.parse(window.localStorage.getItem(storageKey) || '[]'); if (Array.isArray(saved)) issues = saved.filter(item => item && ['prepare', 'send'].includes(item.stage) && typeof item.documentId === 'string' && typeof item.message === 'string');} catch {}}
    issueRef.current = issues; setSubmissionIssues(issues);
  }, [storageKey]);
  const recordSubmissionIssue = useCallback((issue: SubmissionIssue) => {
    storeIssues([...issueRef.current.filter(item => !(item.stage === issue.stage && item.documentId === issue.documentId && item.requestId === issue.requestId)), {...issue, occurredAt: new Date().toISOString()}]);
  }, [storeIssues]);
  const clearSubmissionIssue = useCallback((documentId: string, requestId?: string) => {
    storeIssues(issueRef.current.filter(issue => requestId ? issue.requestId !== requestId : !(issue.documentId === documentId && issue.stage === 'prepare')));
  }, [storeIssues]);
  const inFlight = useRef(new Set<string>());
  const check = useCallback(async (ids?: string[]) => {
    const requestIds = [...new Set(ids || [...deliveryRequests(latest.current).map(request => request.packageId || request.id), ...issueRef.current.flatMap(issue => issue.requestId ? [issue.requestId] : [])])].filter(id => !inFlight.current.has(id));
    if (!requestIds.length || !auth.currentUser) return;
    requestIds.forEach(id => inFlight.current.add(id));
    setCheckingIds([...inFlight.current]);
    const checkErrors: string[] = [];
    try {
      const token = await auth.currentUser.getIdToken();
      for (let start = 0; start < requestIds.length; start += 20) {
        const response = await fetch('/.netlify/functions/check-equity-email-status', {
          method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-PulseCheck-Firebase-Mode': isUsingDevFirebase() ? 'dev' : 'prod'},
          body: JSON.stringify({requestIds: requestIds.slice(start, start + 20)}),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || result.message || 'Unable to check email delivery. The last recorded status is shown.');
        if (Array.isArray(result.results)) {
          applyResults(result.results);
          checkErrors.push(...deliveryCheckErrors(result.results, latest.current));
          for (const item of result.results) if (item.emailDelivery && ['accepted', 'delivered', 'failed', 'deferred'].includes(item.emailDelivery.status)) clearSubmissionIssue('', item.requestId);
        }
      }
      setError([...new Set(checkErrors)].join(' '));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to check email delivery. The last recorded status is shown.');
    } finally {
      requestIds.forEach(id => inFlight.current.delete(id));
      setCheckingIds([...inFlight.current]);
    }
  }, [applyResults, clearSubmissionIssue]);
  // Each send starts a short, bounded check window. Persistent records survive closing this page.
  const sendKey = [...deliveryRequests(requests).map(request => `${request.packageId || request.id}:${request.emailDelivery?.attemptId || request.emailDelivery?.messageId || request.messageId || 'legacy'}`), ...submissionIssues.flatMap(issue => issue.requestId ? [`issue:${issue.requestId}`] : [])].sort().join('|');
  useEffect(() => {
    if (!sendKey) return;
    const timers = [0, 8000, 25000, 60000].map((delay, index) => window.setTimeout(() => {
      const ids = [...deliveryRequests(latest.current).filter(request => index === 0 || !['delivered', 'failed'].includes(getEquityEmailDelivery(request).status)).map(request => request.packageId || request.id), ...issueRef.current.flatMap(issue => issue.requestId ? [issue.requestId] : [])];
      void check(ids);
    }, delay));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [sendKey, check]);
  return {check, checkingIds, error, submissionIssues, recordSubmissionIssue, clearSubmissionIssue};
}

export function emailDeliveryIsUnconfirmed(request: DeliveryRequest | undefined) {
  if (!request || !(request.emailDelivery || request.messageId || request.sentAt || request.lastSentAt)) return false;
  return ['unknown', 'sending'].includes(getEquityEmailDelivery(request).status);
}
export function emailDeliverySendInProgress(request: DeliveryRequest | undefined) {
  if (!request) return false;
  const state = getEquityEmailDelivery(request);
  const attemptedAt = equityEmailTimestamp(state.attemptedAt);
  return state.status === 'sending' && Number.isFinite(attemptedAt) && Date.now() - attemptedAt < 120000;
}
export function emailDeliveryNeedsAttention(request: DeliveryRequest) {
  const state = getEquityEmailDelivery(request);
  return state.status === 'failed' || Boolean((state as any).unresolvedFailure);
}
export function emailDeliveryLabel(request: DeliveryRequest) {
  const state = getEquityEmailDelivery(request);
  if (state.status === 'failed') return 'Email delivery failed';
  if ((state as any).unresolvedFailure) return 'Retry awaiting delivery';
  return {sending: 'Submitting email', accepted: 'Accepted by Brevo. Delivery pending', delivered: 'Delivered to recipient mail server', deferred: 'Delivery delayed', unknown: 'Delivery unconfirmed'}[state.status] || 'Delivery unconfirmed';
}
const dateLabel = (value: any) => {
  const date = typeof value?.toDate === 'function' ? value.toDate() : typeof value?.seconds === 'number' ? new Date(value.seconds * 1000) : new Date(value || '');
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};
export default function EquityEmailDeliveryPanel({requests, controls, compact = false, heading = 'Email delivery', documentIds}: {
  requests: DeliveryRequest[]; controls: DeliveryControls; compact?: boolean; heading?: string; documentIds?: string[];
}) {
  const tracked = deliveryRequests(requests);
  const issues = (controls.submissionIssues || []).filter(issue => documentIds ? documentIds.includes(issue.documentId) : compact ? requests.some(request => (request.packageId || request.id) === issue.requestId || request.equityDocumentId === issue.documentId) : true).filter(issue => !issue.requestId || !tracked.some(request => (request.packageId || request.id) === issue.requestId && ['accepted', 'delivered', 'failed', 'deferred'].includes(getEquityEmailDelivery(request).status)));
  if (!tracked.length && !issues.length) return null;
  const failed = tracked.filter(emailDeliveryNeedsAttention);
  const attentionCount = failed.length + issues.length;
  const rows = (compact ? tracked : tracked.filter(request => emailDeliveryNeedsAttention(request) || getEquityEmailDelivery(request).status !== 'delivered')).filter(request => !issues.some(issue => issue.requestId === (request.packageId || request.id)));
  const checking = tracked.some(request => controls.checkingIds.includes(request.packageId || request.id)) || issues.some(issue => issue.requestId && controls.checkingIds.includes(issue.requestId));
  return <section aria-label={heading} className={`rounded-xl border p-4 ${attentionCount ? 'border-red-500/50 bg-red-950/30' : 'border-zinc-700 bg-zinc-900/40'}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className={`text-sm font-semibold flex items-center gap-2 ${attentionCount ? 'text-red-200' : 'text-zinc-200'}`}>{attentionCount ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{attentionCount ? `${attentionCount} email${attentionCount === 1 ? '' : 's'} need attention` : heading}</p>
      {(tracked.length > 0 || issues.some(issue => issue.requestId)) && <button type="button" disabled={checking} onClick={event => {event.stopPropagation(); void controls.check([...tracked.map(request => request.packageId || request.id), ...issues.flatMap(issue => issue.requestId ? [issue.requestId] : [])]);}} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 px-2.5 py-1.5 text-xs text-zinc-200 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />{checking ? 'Checking Brevo…' : 'Check delivery status'}</button>}
    </div>
    {attentionCount > 0 && <p className="mt-2 text-xs text-red-100/80">This alert stays here until the submission issue is resolved or delivery is confirmed. Review the reason before trying again.</p>}
    {rows.length === 0 && issues.length === 0 && <p className="mt-2 text-xs text-emerald-300">Brevo confirms delivery for {tracked.length} email{tracked.length === 1 ? '' : 's'}.</p>}
    <div className="space-y-3">{issues.map(issue => <div key={`${issue.stage}:${issue.documentId}:${issue.requestId || ''}`} className="pt-3 text-xs">
      <p className="font-medium text-zinc-100">{issue.documentName}</p>
      {issue.recipientEmail && <p className="mt-1 break-words text-zinc-300">{issue.recipientName ? `${issue.recipientName} · ` : ''}{issue.recipientEmail}</p>}
      <p className="mt-1 text-red-200">{issue.stage === 'prepare' ? 'Could not prepare request. No email was submitted.' : 'Email submission could not be confirmed.'}</p>
      <p className="mt-1 break-words text-red-100/90">{issue.message}</p>
      <p className="mt-1 text-zinc-400">{issue.stage === 'prepare' ? 'Open the document and try Send for signature again.' : 'Check delivery status before sending again.'}</p>
    </div>)}{rows.map(request => {
      const state = getEquityEmailDelivery(request);
      const failure = (state as any).unresolvedFailure;
      const attention = emailDeliveryNeedsAttention(request);
      const reason = state.reason || failure?.reason;
      const checkedAt = dateLabel(state.checkedAt);
      return <div key={request.packageId || request.id} className="pt-3 text-xs">
        <p className="font-medium text-zinc-100">{request.documentName || 'Signature request'}{request.previewMode ? ' (preview)' : ''}</p>
        <p className="mt-1 break-words text-zinc-300">{request.recipientName ? `${request.recipientName} · ` : ''}{state.recipientEmail || request.recipientEmail}</p>
        <p className={`mt-1 flex gap-1.5 items-center ${attention ? 'text-red-200' : state.status === 'delivered' ? 'text-emerald-300' : 'text-amber-200'}`}>{attention ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : <Clock className="h-3.5 w-3.5 shrink-0" />}{emailDeliveryLabel(request)}</p>
        {reason && <p className={`mt-1 break-words ${attention ? 'text-red-100/90' : 'text-zinc-300'}`}>{reason}</p>}
        {state.checkError && <p className="mt-1 text-amber-200">Status check unavailable: {state.checkError.replace(/[.!?]+$/, '')}. Last recorded status retained.</p>}
        {checkedAt && <p className="mt-1 text-zinc-500">Last checked: {checkedAt}</p>}
      </div>;
    })}</div>
    {controls.error && <p role="status" className="mt-3 text-xs text-amber-200">{controls.error}</p>}
  </section>;
}
