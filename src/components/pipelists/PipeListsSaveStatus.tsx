import React, { useEffect, useRef, useState } from 'react';

export type SaveFailure = { message: string; code: string };

export const saveFailureDetails = (error: unknown): SaveFailure => {
  const details = error && typeof error === 'object' ? error as { message?: unknown; code?: unknown } : {};
  return {
    message: typeof details.message === 'string' && details.message ? details.message : 'Unable to save PipeLists.',
    code: details.code ? String(details.code) : 'No error code provided',
  };
};

export default function PipeListsSaveStatus({ failure, children }: { failure: SaveFailure | null; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!failure) setOpen(false);
  }, [failure]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return <div ref={root} className="relative hidden md:block">
    <button ref={trigger} type="button" disabled={!failure} aria-expanded={open} aria-controls={failure ? 'pipelists-save-error' : undefined}
      aria-label={failure ? 'Save failed. Show error details' : undefined}
      onClick={() => setOpen(!open)}
      className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-500 shadow-sm enabled:hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500">
      {children}
    </button>
    {open && failure && <div id="pipelists-save-error" role="region" aria-label="Save error details"
      className="absolute right-0 top-full z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-stone-200 bg-white p-4 text-left text-sm text-stone-800 shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-3"><strong>Save failed</strong><button type="button" onClick={() => { setOpen(false); trigger.current?.focus(); }} aria-label="Close save error" className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100">×</button></div>
      <p className="whitespace-pre-wrap break-words">{failure.message}</p>
      <p className="mt-3 text-xs text-stone-500">Error code</p>
      <code className="mt-1 block break-all text-xs text-stone-800">{failure.code}</code>
    </div>}
  </div>;
}
