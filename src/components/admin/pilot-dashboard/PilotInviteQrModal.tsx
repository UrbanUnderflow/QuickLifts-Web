import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, ExternalLink, Loader2, QrCode, X } from 'lucide-react';
import QRCode from 'qrcode';
import type { PulseCheckInviteLink } from '../../../api/firebase/pulsecheckProvisioning/types';
import { buildPulseCheckTeamInviteWebUrl } from '../../../utils/pulsecheckInviteLinks';

type PilotInviteQrModalProps = {
  invite: PulseCheckInviteLink | null;
  pilotName?: string;
  teamName?: string;
  organizationName?: string;
  onClose: () => void;
};

const slugifyFilename = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'pulsecheck-invite-qr';

const truncateUrl = (value: string) => {
  if (value.length <= 72) return value;
  return `${value.slice(0, 42)}...${value.slice(-22)}`;
};

const resolveInviteShareUrl = (invite: PulseCheckInviteLink | null) => {
  if (!invite) return '';
  return invite.activationUrl || buildPulseCheckTeamInviteWebUrl(invite.token || invite.id);
};

export function PilotInviteQrModal({
  invite,
  pilotName,
  teamName,
  organizationName,
  onClose,
}: PilotInviteQrModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const shareUrl = resolveInviteShareUrl(invite);

  useEffect(() => {
    let cancelled = false;

    if (!shareUrl) {
      setQrDataUrl('');
      setLoading(false);
      setError('');
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError('');

    QRCode.toDataURL(shareUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 720,
      color: {
        dark: '#09111e',
        light: '#ffffff',
      },
    })
      .then((dataUrl: string) => {
        if (cancelled) return;
        setQrDataUrl(dataUrl);
        setLoading(false);
      })
      .catch((qrError: unknown) => {
        if (cancelled) return;
        console.error('[PilotInviteQrModal] Failed to generate QR code:', qrError);
        setQrDataUrl('');
        setError('We could not generate this QR code right now.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  const handleDownload = () => {
    if (!invite || !shareUrl || !qrDataUrl) return;

    const link = document.createElement('a');
    const fileBase = [
      pilotName || teamName || 'pulsecheck',
      invite.redemptionMode === 'general' ? 'general' : 'single',
      'invite-qr',
    ]
      .filter(Boolean)
      .join('-');

    link.href = qrDataUrl;
    link.download = `${slugifyFilename(fileBase)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isOpen = Boolean(invite);
  const inviteLabel = invite?.redemptionMode === 'general' ? 'General Link' : 'Single-use Link';
  const headline = pilotName?.trim()
    ? `Scan to join ${pilotName.trim()}`
    : `Scan to join ${teamName?.trim() || 'this PulseCheck invite'}`;

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] flex items-center justify-center bg-[#03060d]/88 px-4 py-6 backdrop-blur-xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="relative w-full max-w-4xl overflow-hidden rounded-[34px] border border-white/10 bg-[#0a0f18]/95 shadow-[0_28px_120px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pilot-invite-qr-title"
            data-testid="pilot-invite-qr-modal"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.1),_transparent_28%)]" />
            <div className="relative flex flex-col gap-6 p-5 sm:p-6 lg:grid lg:grid-cols-[minmax(0,420px),minmax(0,1fr)] lg:items-center">
              <div className="rounded-[30px] border border-white/10 bg-[#0d1320]/95 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="rounded-[26px] bg-white p-5 shadow-[0_28px_80px_rgba(9,17,30,0.22)]">
                  <div className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] p-4">
                    <div className="mb-3 flex items-center justify-between text-[#09111e]">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">PulseCheck Invite</div>
                        <div className="mt-1 text-sm font-semibold">{inviteLabel}</div>
                      </div>
                      <div className="rounded-full bg-slate-100 p-2.5 text-slate-700">
                        <QrCode className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                      {loading ? (
                        <div className="flex aspect-square items-center justify-center rounded-[18px] bg-slate-50 text-slate-500">
                          <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                      ) : error ? (
                        <div className="flex aspect-square items-center justify-center rounded-[18px] bg-slate-50 px-6 text-center text-sm text-slate-500">
                          {error}
                        </div>
                      ) : (
                        <img
                          src={qrDataUrl}
                          alt={headline}
                          className="block aspect-square w-full rounded-[18px]"
                          data-testid="pilot-invite-qr-image"
                        />
                      )}
                    </div>

                    <div className="mt-4 rounded-[20px] bg-[#09111e] px-4 py-3 text-center">
                      <div className="text-sm font-semibold text-white">{headline}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-300">
                        {invite?.redemptionMode === 'general'
                          ? 'This QR encodes the reusable PulseCheck OneLink so scans can open the app directly while the invite itself stays valid until you delete it.'
                          : 'Open the invite on a phone camera and move directly into onboarding for this pilot.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative flex min-w-0 flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="inline-flex rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-sky-100">
                      QR Code
                    </div>
                    <h2 id="pilot-invite-qr-title" className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                      {headline}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-300">
                      This QR code is generated directly from the current invite link, so the scan target stays in sync with the share URL you already copy and open from this card.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-white/10 bg-white/5 p-2.5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                    aria-label="Close QR modal"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Pilot</div>
                    <div className="mt-2 text-sm font-medium text-white">{pilotName || 'Current pilot'}</div>
                    <div className="mt-1 text-xs text-zinc-400">{teamName || 'Team'}{organizationName ? ` • ${organizationName}` : ''}</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Link Type</div>
                    <div className="mt-2 text-sm font-medium text-white">{inviteLabel}</div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {invite?.redemptionMode === 'general'
                        ? 'Reusable for group scans and shared screens.'
                        : 'Best for sending to one athlete at a time.'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                    {invite?.redemptionMode === 'general' ? 'Encoded Reusable OneLink' : 'Encoded Share Link'}
                  </div>
                  <div className="mt-2 break-all font-mono text-xs leading-6 text-cyan-100" title={shareUrl}>
                    {truncateUrl(shareUrl)}
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={!qrDataUrl || loading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#09111e] transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Download PNG
                  </button>
                  <a
                    href={shareUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Link
                  </a>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-black/35 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
