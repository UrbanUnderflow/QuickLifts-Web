import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import GroupMeetInviteAvailability from './GroupMeetInviteAvailability';

export default function GroupMeetHostAvailabilityModal({ token, onFinish, onClose }: {
  token: string;
  onFinish: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onClose={() => { if (!busy) onClose(); }} className="fixed inset-0 z-[70]">
      <div className="fixed inset-0 bg-stone-950/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-6">
        <DialogPanel className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-4 border-b border-stone-200 px-5 py-4">
            <DialogTitle className="text-lg font-semibold text-stone-950">Host availability</DialogTitle>
            <button type="button" disabled={busy} onClick={onClose} className="rounded-md border border-stone-200 px-4 py-2 text-sm disabled:opacity-50">Close</button>
          </div>
          <div className="min-h-0 overflow-y-auto">
            <GroupMeetInviteAvailability token={token} onFinish={onFinish} onClose={onClose} onBusyChange={setBusy} />
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
