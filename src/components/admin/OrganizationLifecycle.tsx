import React, { useCallback, useEffect, useRef, useState } from 'react';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';

type Organization = { id: string; displayName: string };
type DeletedOrganization = Organization & { deletedAt: number; purgeAfter: number; status: string };

async function lifecycleRequest(change?: { organizationId: string; action: 'delete' | 'restore'; confirmationName?: string }) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in again to manage organizations.');
  const response = await fetch('/api/admin/pulsecheck/organization-lifecycle', {
    method: change ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...getFirebaseModeRequestHeaders() },
    ...(change ? { body: JSON.stringify(change) } : {}),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Unable to update organizations.');
  return body;
}

export default function OrganizationLifecycle({ target, onClose, onChanged }: {
  target: Organization | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [organizations, setOrganizations] = useState<DeletedOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const dialog = useRef<HTMLDialogElement>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const body = await lifecycleRequest(); setOrganizations(body.organizations); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to load deleted organizations.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    setConfirmation(''); setError('');
    if (target) dialog.current?.showModal(); else dialog.current?.close();
  }, [target]);
  const change = async (organization: Organization, action: 'delete' | 'restore') => {
    setBusy(true); setError(''); setMessage('');
    try {
      await lifecycleRequest({ organizationId: organization.id, action, ...(action === 'delete' ? { confirmationName: confirmation } : {}) });
      if (action === 'delete') onClose();
      setMessage(action === 'delete' ? `${organization.displayName} is decommissioned. You can restore it from Deleted organizations for 90 days.` : `${organization.displayName} has been restored.`);
      await Promise.all([refresh(), onChanged()]);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to update this organization.'); }
    finally { setBusy(false); }
  };
  return <>
    <section aria-label="Deleted organizations" style={{ marginTop: 28, padding: 20, border: '1px solid #d9dcd5', borderRadius: 16, background: '#fff' }}>
      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Deleted organizations{!loading ? ` (${organizations.length})` : ''}</summary>
        <p style={{ fontSize: 13 }}>Deleted organizations are decommissioned immediately. Restore them within 90 days. After 90 days, permanent decommissioning removes organization and team settings, invitations, and report data. Personal accounts and history, plus consent, research, and clinical records, are retained.</p>
        {loading ? <p role="status">Loading deleted organizations…</p> : organizations.length ? <ul style={{ padding: 0, listStyle: 'none' }}>{organizations.map(organization => {
          const restorable = organization.status === 'deleted' && organization.purgeAfter > now;
          const days = Math.ceil((organization.purgeAfter - now) / 86_400_000);
          return <li key={organization.id} style={{ padding: '14px 0', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div><strong>{organization.displayName}</strong><p style={{ margin: '6px 0 0', fontSize: 13 }}>{restorable ? `${days} day${days === 1 ? '' : 's'} left to restore. Permanent decommissioning begins ${new Date(organization.purgeAfter).toLocaleString()}.` : organization.status === 'purged' ? 'Permanently decommissioned.' : 'Restoration period ended. Permanent decommissioning is in progress.'}</p></div>
            <button type="button" className="pcp-ab pcp-ab-g" disabled={busy || !restorable} onClick={() => void change(organization, 'restore')}>Restore organization</button>
          </li>;
        })}</ul> : <p>No deleted organizations.</p>}
        <button type="button" className="pcp-ab" disabled={loading || busy} onClick={() => { setError(''); void refresh(); }}>Refresh deleted organizations</button>
      </details>
      {message && <p role="status">{message}</p>}
      {error && !target && <p role="alert">{error}</p>}
    </section>
    <dialog ref={dialog} aria-labelledby="organization-delete-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} style={{ width: 'min(520px, calc(100vw - 32px))', padding: 28, border: '1px solid #d9dcd5', borderRadius: 18, color: '#18201c' }}>
      <h2 id="organization-delete-title" style={{ marginTop: 0 }}>Delete {target?.displayName}?</h2>
      <p>This immediately decommissions the organization and its teams, blocks access, and removes it from the active directory.</p>
      <p>You have 90 days to restore it. After 90 days, permanent decommissioning removes organization and team settings, invitations, and report data. Personal accounts and history, plus consent, research, and clinical records, are retained.</p>
      <form onSubmit={event => { event.preventDefault(); if (target && confirmation === target.displayName && !busy) void change(target, 'delete'); }}>
        <label className="pcp-fld"><span className="pcp-flbl">Type {target?.displayName} to confirm</span><input autoFocus className="pcp-finp" value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} autoComplete="off" /></label>
        {error && <p role="alert">{error}</p>}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="pcp-ab pcp-ab-g" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" className="pcp-ab" disabled={busy || !target || confirmation !== target.displayName} style={{ background: '#9f2525', color: '#fff' }}>{busy ? 'Deleting…' : 'Delete organization'}</button>
        </div>
      </form>
    </dialog>
  </>;
}
