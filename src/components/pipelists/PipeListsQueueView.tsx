import React from 'react';
import { formatQueueTimestamp, type QueueSequence } from '../../utils/pipelistsQueue';

function Evidence({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold text-stone-500">{label}</dt><dd className="mt-1 break-words text-sm text-stone-900 [overflow-wrap:anywhere]">{children}</dd></div>;
}

export default function PipeListsQueueView({ sequences, listId, loadedAt }: {
  sequences: QueueSequence[];
  listId: string;
  loadedAt: string;
}) {
  return <section aria-label="Stored email queue" className="space-y-4">
    <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
      <p className="break-words [overflow-wrap:anywhere]">List ID: <strong className="text-stone-900">{listId}</strong> · {sequences.length} stored {sequences.length === 1 ? 'sequence' : 'sequences'}</p>
      <p className="mt-1">Read at {formatQueueTimestamp(loadedAt)}. This result covers only this list.</p>
      <p className="mt-1">Provider evidence is stored data. A message ID or sent status alone does not confirm delivery. Provider tracking has not been refreshed.</p>
    </div>
    {sequences.length === 0 && <p className="rounded-xl border border-stone-200 bg-white p-5 text-stone-700">No stored email sequences were returned for this list.</p>}
    {sequences.map((sequence, index) => <article key={`${sequence.id}-${index}`} aria-label={`Sequence for ${sequence.toEmail || sequence.itemId}`} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 p-5">
        <div className="min-w-0"><h2 className="break-words text-lg font-semibold text-stone-900 [overflow-wrap:anywhere]">{sequence.toEmail || 'Recipient not recorded'}</h2><p className="mt-1 break-words text-xs text-stone-500 [overflow-wrap:anywhere]">Sequence ID: {sequence.id}</p></div>
        <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-sm font-semibold text-stone-800">{sequence.status}</span>
      </header>
      <dl className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Evidence label="List ID">{sequence.listId}</Evidence>
        <Evidence label="Item ID">{sequence.itemId}</Evidence>
        <Evidence label="Recipient">{sequence.toEmail || 'Not recorded'}</Evidence>
        <Evidence label="From">{sequence.fromEmail || 'Not recorded'}</Evidence>
        <Evidence label="CC">{sequence.ccEmails.join(', ') || 'None recorded'}</Evidence>
        <Evidence label="BCC">{sequence.bccEmails.join(', ') || 'None recorded'}</Evidence>
        <Evidence label="Stored next send">{formatQueueTimestamp(sequence.nextSendAt, 'Not scheduled')}</Evidence>
        <Evidence label="Next step index">{sequence.nextStepIndex ?? 'Not recorded'} (zero-based)</Evidence>
        <Evidence label="Updated">{formatQueueTimestamp(sequence.updatedAt)}</Evidence>
        <Evidence label="Provider">Brevo (sequence transport)</Evidence>
        <Evidence label="Attempt / claim">{sequence.attempt ? `Step index ${sequence.attempt.index ?? 'unknown'} · Started ${formatQueueTimestamp(sequence.attempt.startedAt)}` : 'No current claim recorded'}</Evidence>
        <Evidence label="Last error">{sequence.lastError || 'None recorded'}</Evidence>
      </dl>
      {sequence.attempt && <p className="mx-5 mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">A delivery claim is recorded. Its outcome may still need review; this page does not retry it.</p>}
      <section aria-label="Stored message evidence" className="border-t border-stone-200 bg-stone-50 p-5">
        <h3 className="text-sm font-semibold text-stone-900">Stored message evidence</h3>
        <div className="mt-3 space-y-3">{sequence.steps.map((step, stepIndex) => <div key={`${step.id}-${stepIndex}`} className="rounded-lg border border-stone-200 bg-white p-4">
          <h4 className="break-words text-sm font-semibold text-stone-900 [overflow-wrap:anywhere]">Email {stepIndex + 1}: {step.subject || 'Subject not recorded'}</h4>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Evidence label="Step ID">{step.id || 'Not recorded'}</Evidence>
            <Evidence label="Provider message ID">{step.messageId || 'Not recorded'}</Evidence>
            <Evidence label="Sent at">{formatQueueTimestamp(step.sentAt)}</Evidence>
            <Evidence label="Stored provider status">{step.tracking?.status || 'Not recorded'}</Evidence>
            <Evidence label="Last provider event">{formatQueueTimestamp(step.tracking?.lastEventAt || '')}</Evidence>
            <Evidence label="Delivered at">{formatQueueTimestamp(step.tracking?.deliveredAt || '')}</Evidence>
            <Evidence label="Last opened">{formatQueueTimestamp(step.tracking?.openedAt || '')}</Evidence>
            <Evidence label="Last clicked">{formatQueueTimestamp(step.tracking?.clickedAt || '')}</Evidence>
            <Evidence label="Last issue">{formatQueueTimestamp(step.tracking?.lastIssueAt || '')}</Evidence>
            <Evidence label="Tracked opens / clicks">{step.tracking?.openCount ?? 'Not recorded'} / {step.tracking?.clickCount ?? 'Not recorded'}</Evidence>
          </dl>
        </div>)}</div>
        {sequence.steps.length === 0 && <p className="mt-3 text-sm text-stone-600">No email-step evidence is recorded.</p>}
      </section>
    </article>)}
  </section>;
}
