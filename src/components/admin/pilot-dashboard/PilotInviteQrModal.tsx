import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Clipboard, Download, ExternalLink, Loader2, QrCode, X } from 'lucide-react';
import type { PulseCheckInviteLink } from '../../../api/firebase/pulsecheckProvisioning/types';
import {
  renderPilotInviteQrDataUrl,
  resolvePilotInviteShareUrl,
} from '../../../utils/pilotInviteQr';
import { usePilotDashboardTheme } from './PilotDashboardTheme';

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

export function PilotInviteQrModal({
  invite,
  pilotName,
  teamName,
  organizationName,
  onClose,
}: PilotInviteQrModalProps) {
  const { theme } = usePilotDashboardTheme();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const shareUrl = resolvePilotInviteShareUrl(
    invite,
    typeof window !== 'undefined' ? window.location.origin : undefined
  );

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

    renderPilotInviteQrDataUrl(shareUrl)
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

  useEffect(() => {
    setCopied(false);
    setCopyError('');
  }, [shareUrl]);

  useEffect(() => {
    if (!invite) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusTimeout = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('aria-hidden'));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimeout);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [invite, onClose]);

  const handleDownload = () => {
    if (!invite || !shareUrl || !qrDataUrl) return;

    const link = document.createElement('a');
    const fileBase = [
      pilotName || teamName || 'pulsecheck',
      invite.redemptionMode === 'general' ? 'join' : 'single',
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

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setCopyError('');
      window.setTimeout(() => setCopied(false), 1800);
    } catch (copyError) {
      console.error('[PilotInviteQrModal] Failed to copy invite link:', copyError);
      setCopyError('The QR is ready, but the invite link could not be copied.');
    }
  };

  const isOpen = Boolean(invite);
  const inviteLabel = invite?.redemptionMode === 'general' ? 'Athlete join QR' : 'One-athlete QR';
  const destinationName = invite?.cohortName?.trim() || pilotName?.trim() || teamName?.trim();
  const headline = destinationName
    ? `Scan to join ${destinationName}`
    : `Scan to join ${teamName?.trim() || 'this PulseCheck invite'}`;
  const assignedScopeLabel = pilotName?.trim() ? 'this team and pilot' : 'this team';
  const destinationPath = [organizationName, teamName, pilotName, invite?.cohortName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' / ');

  if (typeof document === 'undefined') return null;

  const modal = (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-[#03060d]/88 px-4 py-6 backdrop-blur-xl sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            ref={dialogRef}
            className="relative max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-y-auto rounded-[34px] border border-white/10 bg-[#0a0f18]/95 shadow-[0_28px_120px_rgba(0,0,0,0.45)]"
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
                      ) : qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt={headline}
                          className="block aspect-square w-full rounded-[18px]"
                          data-testid="pilot-invite-qr-image"
                          data-encoded-value={shareUrl}
                        />
                      ) : (
                        <div className="flex aspect-square items-center justify-center rounded-[18px] bg-slate-50 px-6 text-center text-sm text-slate-500">
                          Preparing QR code...
                        </div>
                      )}
                    </div>

                    <div className="pilot-invite-qr-fixed-dark mt-4 rounded-[20px] bg-[#09111e] px-4 py-3 text-center">
                      <div className="pilot-invite-qr-fixed-dark-title text-sm font-semibold text-white">{headline}</div>
                      <div className="pilot-invite-qr-fixed-dark-copy mt-1 text-xs leading-5 text-slate-300">
                        {invite?.redemptionMode === 'general'
                          ? 'Open your phone camera and scan this code to begin PulseCheck onboarding.'
                          : 'This code is intended for the one athlete attached to this invite.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative flex min-w-0 flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="inline-flex rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-sky-100">
                      Athlete invite QR
                    </div>
                    <h2 id="pilot-invite-qr-title" className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                      {headline}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-300">
                      This code uses the active invite link already assigned to {assignedScopeLabel}.
                    </p>
                  </div>
                  <button
                    ref={closeButtonRef}
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
                    <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Destination</div>
                    <div className="mt-2 text-sm font-medium text-white">{destinationPath || 'Current pilot'}</div>
                    <div className="mt-1 text-xs text-zinc-400">Confirm this scope before displaying or printing the code.</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Join link</div>
                    <div className="mt-2 text-sm font-medium text-white">
                      {invite?.redemptionMode === 'general' ? 'One destination link' : inviteLabel}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {invite?.redemptionMode === 'general'
                        ? 'The same link works for every athlete joining this destination.'
                        : 'This code stops working after the assigned athlete redeems it.'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                    Encoded invite link
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
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    disabled={!shareUrl}
                    data-testid="pilot-invite-qr-copy-link"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                  <a
                    href={shareUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    data-testid="pilot-invite-qr-open-link"
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
                {copyError ? (
                  <div className="mt-3 text-sm text-amber-100" role="status">
                    {copyError}
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(
    <div className="pilot-dashboard-theme-frame" data-pilot-theme={theme}>
      {modal}
    </div>,
    document.body
  );
}
