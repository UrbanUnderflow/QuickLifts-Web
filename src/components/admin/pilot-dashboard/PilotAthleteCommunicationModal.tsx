import React from 'react';
import { ExternalLink, Loader2, Mail, Send, Smartphone, X } from 'lucide-react';

export type PilotAthleteCommunicationChannel = 'email' | 'push';
export type PilotAthleteCommunicationStatus = 'not-sent' | 'sent' | 'delivered' | 'opened' | 'failed';

export type PilotAthleteCommunicationPreview = {
  channel: PilotAthleteCommunicationChannel;
  title?: string;
  subject?: string;
  subtitle?: string;
  body: string;
  html?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export type PilotAthleteCommunicationRecord = {
  id: string;
  channel: PilotAthleteCommunicationChannel;
  status: PilotAthleteCommunicationStatus;
  messageId?: string | null;
  sentAt?: any;
  deliveredAt?: any;
  openedAt?: any;
  updatedAt?: any;
  lastError?: string | null;
  preview?: PilotAthleteCommunicationPreview | null;
};

type Props = {
  isOpen: boolean;
  athleteName: string;
  athleteEmail: string;
  channel: PilotAthleteCommunicationChannel;
  preview: PilotAthleteCommunicationPreview | null;
  record: PilotAthleteCommunicationRecord | null;
  loadingPreview: boolean;
  sending: boolean;
  error: string | null;
  onClose: () => void;
  onSend: () => void;
};

const toDateValue = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const formatTimestamp = (value: any) => {
  const date = toDateValue(value);
  return date ? date.toLocaleString() : 'Not yet';
};

const stageIsActive = (
  channel: PilotAthleteCommunicationChannel,
  record: PilotAthleteCommunicationRecord | null,
  stage: 'sent' | 'delivered' | 'opened'
) => {
  if (!record) return false;
  if (stage === 'sent') {
    return Boolean(record.sentAt || record.messageId || ['sent', 'delivered', 'opened'].includes(record.status));
  }
  if (stage === 'delivered') {
    return Boolean(record.deliveredAt || ['delivered', 'opened'].includes(record.status));
  }
  if (stage === 'opened') {
    return Boolean(record.openedAt || record.status === 'opened');
  }
  return false;
};

const statusPillClassName = (active: boolean) =>
  active
    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
    : 'border-white/10 bg-white/5 text-zinc-500';

export const PilotAthleteCommunicationModal: React.FC<Props> = ({
  isOpen,
  athleteName,
  athleteEmail,
  channel,
  preview,
  record,
  loadingPreview,
  sending,
  error,
  onClose,
  onSend,
}) => {
  if (!isOpen) return null;

  const title = channel === 'email' ? 'Email preview' : 'Push preview';
  const accentIcon = channel === 'email' ? <Mail className="h-5 w-5 text-amber-200" /> : <Smartphone className="h-5 w-5 text-cyan-200" />;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0f17] shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#11151f] px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                {accentIcon}
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">{title}</div>
                <h3 className="mt-1 text-xl font-semibold text-white">{athleteName}</h3>
              </div>
            </div>
            <p className="mt-3 text-sm text-zinc-400">{athleteEmail || 'No email on file'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-0 lg:grid-cols-[320px,minmax(0,1fr)]">
          <div className="border-b border-white/10 bg-[#0f1420] p-6 lg:border-b-0 lg:border-r">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Status</div>
            <div className="mt-4 space-y-3">
              {record?.status === 'failed' ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {record.lastError || 'Last send failed.'}
                </div>
              ) : null}

              {(['sent', 'delivered', 'opened'] as const).map((stage) => {
                const active = stageIsActive(channel, record, stage);
                return (
                  <div key={stage} className={`rounded-2xl border px-4 py-3 ${statusPillClassName(active)}`}>
                    <div className="text-xs uppercase tracking-[0.18em]">{stage}</div>
                    <div className="mt-2 text-sm">
                      {stage === 'sent'
                        ? formatTimestamp(record?.sentAt)
                        : stage === 'delivered'
                          ? formatTimestamp(record?.deliveredAt)
                          : formatTimestamp(record?.openedAt)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-6 text-zinc-400">
              {channel === 'email'
                ? 'Email status comes from Brevo send, delivery, and open tracking.'
                : 'Push shows sent status immediately. Delivery and open receipts only appear if the client or provider reports them.'}
            </div>

            {record?.messageId ? (
              <div className="mt-6">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Message Id</div>
                <div className="mt-2 break-all rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-300">
                  {record.messageId}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={onSend}
                disabled={loadingPreview || sending || !preview}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#d7ff00] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#c5eb00] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Sending...' : channel === 'email' ? 'Send email' : 'Send push'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Close
              </button>
            </div>
          </div>

          <div className="min-h-[520px] bg-[#0b0f17] p-6">
            {loadingPreview ? (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-[28px] border border-white/10 bg-[#11151f]">
                <div className="flex items-center gap-3 text-sm text-zinc-300">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading preview…
                </div>
              </div>
            ) : error ? (
              <div className="rounded-[28px] border border-rose-400/20 bg-rose-400/10 p-6 text-sm text-rose-100">
                {error}
              </div>
            ) : preview ? (
              channel === 'email' ? (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-[#11151f] p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Subject</div>
                    <div className="mt-2 text-lg font-semibold text-white">{preview.subject || 'No subject'}</div>
                  </div>
                  <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white">
                    <iframe
                      title="Email preview"
                      srcDoc={preview.html || '<div style="padding:24px;font-family:Arial,sans-serif;color:#111827;">No HTML preview available.</div>'}
                      className="h-[540px] w-full bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="mx-auto flex max-w-md flex-col items-center">
                  <div className="w-full rounded-[40px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_45%),#0d1420] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
                    <div className="rounded-[32px] border border-white/10 bg-[#05070d] p-4">
                      <div className="flex items-center justify-between px-2 pb-4 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        <span>Push preview</span>
                        <span>PulseCheck</span>
                      </div>
                      <div className="rounded-[28px] border border-white/10 bg-[#121a27] p-4 shadow-[0_15px_45px_rgba(0,0,0,0.35)]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                            <Smartphone className="h-5 w-5 text-cyan-200" />
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.16em] text-zinc-400">PulseCheck</div>
                            <div className="text-sm font-semibold text-white">{preview.title || 'PulseCheck'}</div>
                          </div>
                        </div>
                        {preview.subtitle ? (
                          <div className="mt-4 text-xs uppercase tracking-[0.14em] text-cyan-200">{preview.subtitle}</div>
                        ) : null}
                        <p className="mt-4 text-sm leading-7 text-zinc-100">{preview.body}</p>
                        {(preview.ctaLabel || preview.ctaUrl) ? (
                          <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs text-cyan-100">
                            <div className="font-semibold">{preview.ctaLabel || 'Open app'}</div>
                            {preview.ctaUrl ? <div className="mt-1 break-all text-cyan-200/80">{preview.ctaUrl}</div> : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {(preview.ctaLabel || preview.ctaUrl) ? (
                    <a
                      href={preview.ctaUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm text-cyan-200 hover:text-cyan-100"
                    >
                      {preview.ctaLabel || 'Open app link'}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              )
            ) : (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-[28px] border border-white/10 bg-[#11151f] text-sm text-zinc-400">
                No preview available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PilotAthleteCommunicationModal;
