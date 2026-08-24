import React, { useCallback, useRef } from 'react';
import {
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { usePilotDashboardTheme } from './PilotDashboardTheme';

type PilotAthleteRemovalModalProps = {
  open: boolean;
  athleteName: string;
  teamName: string;
  pilotName?: string;
  isOnlyTeamContext: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

const PilotAthleteRemovalModal: React.FC<PilotAthleteRemovalModalProps> = ({
  open,
  athleteName,
  teamName,
  pilotName,
  isOnlyTeamContext,
  saving,
  error,
  onClose,
  onConfirm,
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const { theme } = usePilotDashboardTheme();
  const handleClose = useCallback(() => {
    if (!saving) onClose();
  }, [onClose, saving]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      initialFocus={cancelButtonRef}
      role="alertdialog"
      className="pilot-dashboard-theme-frame relative z-[140]"
      data-pilot-theme={theme}
      data-testid="pilot-athlete-removal-modal"
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition duration-150 ease-out data-[closed]:opacity-0"
        data-testid="pilot-athlete-removal-backdrop"
      />

      <div className="fixed inset-0 overflow-y-auto px-4 py-6 sm:py-10">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel
            transition
            aria-busy={saving}
            className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0f17] shadow-[0_30px_100px_rgba(0,0,0,0.5)] transition duration-150 ease-out data-[closed]:translate-y-2 data-[closed]:scale-[0.98] data-[closed]:opacity-0"
            data-testid="pilot-athlete-removal-panel"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#11151f] px-5 py-5 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-400/10 text-rose-200">
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-200/80">
                    Team access
                  </div>
                  <DialogTitle
                    className="mt-1 text-xl font-semibold text-white"
                    data-testid="pilot-athlete-removal-title"
                  >
                    Remove from team?
                  </DialogTitle>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close removal confirmation"
                data-testid="pilot-athlete-removal-close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <Description
              as="div"
              className="space-y-4 px-5 py-5 text-sm leading-6 text-zinc-300 sm:px-6"
              data-testid="pilot-athlete-removal-description"
            >
              <p>
                Remove <strong className="font-semibold text-white">{athleteName}</strong> from{' '}
                <strong className="font-semibold text-white">{teamName}</strong>? They will lose access through this team.
              </p>
              {pilotName ? (
                <p>
                  Their enrollment in <strong className="font-semibold text-white">{pilotName}</strong> will also be withdrawn.
                </p>
              ) : null}
              <p>Their Pulse account and historical records will not be deleted.</p>
              <p>
                They can rejoin later with a fresh single-use invite or an active general invite for{' '}
                <strong className="font-semibold text-white">{teamName}</strong>. A previously redeemed
                single-use invite cannot be used again.
              </p>
            </Description>

            <div className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
              {isOnlyTeamContext ? (
                <div
                  className="flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100"
                  data-testid="pilot-athlete-removal-only-team-warning"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    This is their only active team membership. After removal, they will not have access
                    through another team until they rejoin.
                  </span>
                </div>
              ) : null}

              {error ? (
                <div
                  className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100"
                  role="alert"
                  data-testid="pilot-athlete-removal-error"
                >
                  {error}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  ref={cancelButtonRef}
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="pilot-athlete-removal-cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={saving}
                  className="pilot-athlete-removal-confirm inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70 disabled:cursor-not-allowed disabled:opacity-65"
                  data-testid="pilot-athlete-removal-confirm"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  {saving ? 'Removing...' : 'Remove from team'}
                </button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </div>

      <style>{`
        .pilot-athlete-removal-confirm {
          border-color: rgba(251, 113, 133, 0.5) !important;
          background: #be123c !important;
          color: #ffffff !important;
          box-shadow: 0 8px 24px rgba(190, 18, 60, 0.2);
        }

        .pilot-athlete-removal-confirm:hover:not(:disabled) {
          border-color: rgba(253, 164, 175, 0.7) !important;
          background: #9f1239 !important;
          color: #ffffff !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-athlete-removal-confirm {
          border-color: #be123c !important;
          background: #be123c !important;
          color: #ffffff !important;
          box-shadow: 0 8px 20px rgba(190, 18, 60, 0.16);
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-athlete-removal-confirm:hover:not(:disabled) {
          border-color: #9f1239 !important;
          background: #9f1239 !important;
          color: #ffffff !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .pilot-athlete-removal-confirm {
            transition: none;
          }
        }
      `}</style>
    </Dialog>
  );
};

export default PilotAthleteRemovalModal;
