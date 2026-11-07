import React, { useRef } from 'react';
import { Dialog, DialogPanel, DialogTitle, Description } from '@headlessui/react';

interface RenameBudgetSpaceModalProps {
  open: boolean;
  name: string;
  busy: boolean;
  error: string | null;
  onNameChange: (name: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function RenameBudgetSpaceModal({ open, name, busy, error, onNameChange, onClose, onSave }: RenameBudgetSpaceModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Dialog open={open} onClose={onClose} initialFocus={inputRef} className="relative z-[70]">
      <div className="fixed inset-0 bg-stone-950/40" aria-hidden="true" />
      <div className="fixed inset-0 overflow-y-auto p-4 sm:p-6">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-xl">
            <DialogTitle className="text-xl font-semibold text-stone-950">Rename Budget Space</DialogTitle>
            <Description className="mt-2 text-sm text-stone-600">Choose a name for this budget.</Description>
            <form className="mt-5" onSubmit={(event) => { event.preventDefault(); if (!busy) onSave(); }} aria-busy={busy}>
              <label htmlFor="rename-budget-space-name" className="mb-2 block text-sm font-semibold text-stone-900">Budget name</label>
              <input
                ref={inputRef}
                id="rename-budget-space-name"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                disabled={busy}
                aria-invalid={!!error}
                aria-describedby={error ? 'rename-budget-space-error' : undefined}
                autoComplete="off"
                className="w-full rounded-lg border border-stone-300 bg-[#FAFAF7] px-3 py-2 text-sm text-stone-950 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
              />
              {error && <p id="rename-budget-space-error" role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
              {busy && <p role="status" className="mt-3 text-sm text-stone-600">Saving your change. You can close this window while it finishes.</p>}
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">{busy ? 'Close' : 'Cancel'}</button>
                <button type="submit" disabled={busy || !name.trim()} className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50">{busy ? 'Saving…' : 'Save name'}</button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
