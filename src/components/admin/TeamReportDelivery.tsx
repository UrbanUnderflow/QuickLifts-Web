import React, { useEffect, useState } from 'react';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';

type Config = { teamId: string; dailyEnabled: boolean; weeklyEnabled: boolean; timeZone: string; sendHour: number; startDate: string; recipientUids: string[] };
type Recipient = { uid: string; email: string; name?: string };
type Delivery = { id: string; kind?: string; reportDate?: string; status?: string; recipientEmail?: string; lastError?: string; sentAt?: string | null };

async function request(teamId: string, config?: Config) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in again to manage report delivery.');
  const response = await fetch(`/api/admin/pulsecheck/report-delivery?teamId=${encodeURIComponent(teamId)}`, {
    method: config ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...getFirebaseModeRequestHeaders() },
    ...(config ? { body: JSON.stringify(config) } : {}),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Unable to load report delivery.');
  return body;
}

export default function TeamReportDelivery({ teamId }: { teamId: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setStatus(''); setConfig(null);
    request(teamId).then(body => {
      if (active) { setConfig(body.config); setRecipients(body.recipients); setDeliveries(body.deliveries); }
    }).catch(error => { if (active) setStatus(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [teamId]);
  if (loading) return <p role="status">Loading report settings…</p>;
  if (!config) return <p role="alert">{status || 'Report settings are unavailable.'}</p>;
  const update = (patch: Partial<Config>) => { setConfig({ ...config, ...patch }); setStatus(''); };
  return <div>
    <p style={{ fontSize: 13 }}>Email a secure report link to selected team staff.</p>
    <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0 }}>
      <label style={{ display: 'block', marginBottom: 12 }}><input type="checkbox" checked={config.dailyEnabled} onChange={event => update({ dailyEnabled: event.target.checked })} /> Daily participation: a brief recap of yesterday</label>
      <label style={{ display: 'block', marginBottom: 16 }}><input type="checkbox" checked={config.weeklyEnabled} onChange={event => update({ weeklyEnabled: event.target.checked })} /> Monday weekly report: participation, changes, and a coaching focus</label>
      <div className="pcp-fg">
        <label className="pcp-fld"><span className="pcp-flbl">Send time</span><select className="pcp-finp pcp-select" value={config.sendHour} onChange={event => update({ sendHour: Number(event.target.value) })}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hour % 12 || 12}:00 {hour < 12 ? 'AM' : 'PM'}</option>)}</select></label>
        <label className="pcp-fld"><span className="pcp-flbl">Time zone</span><input className="pcp-finp" value={config.timeZone} onChange={event => update({ timeZone: event.target.value })} placeholder="America/New_York" /></label>
        <label className="pcp-fld"><span className="pcp-flbl">Start date</span><input type="date" className="pcp-finp" value={config.startDate} onChange={event => update({ startDate: event.target.value })} /></label>
      </div>
      <p style={{ fontSize: 13 }}>Send time follows this time zone, including daylight saving time. Report activity dates use UTC, matching the coach dashboard.</p>
      <fieldset style={{ border: 0, padding: 0, margin: '16px 0' }}><legend className="pcp-flbl">Recipients</legend>
        {recipients.length ? recipients.map(person => <label key={person.uid} style={{ display: 'block', marginTop: 10, overflowWrap: 'anywhere' }}><input type="checkbox" checked={config.recipientUids.includes(person.uid)} onChange={event => update({ recipientUids: event.target.checked ? [...config.recipientUids, person.uid] : config.recipientUids.filter(uid => uid !== person.uid) })} /> {person.name || person.email}{person.name ? ` · ${person.email}` : ''}</label>) : <p>No eligible team staff with an email address. Add staff with participation access before enabling delivery.</p>}
        {config.recipientUids.some(uid => !recipients.some(person => person.uid === uid)) && <p role="alert">A saved recipient no longer has eligible team access. Save to remove unavailable recipients.</p>}
      </fieldset>
      <button type="button" className="pcp-ab pcp-ab-g" onClick={async () => {
        setSaving(true); setStatus('');
        try {
          const next = { ...config, recipientUids: config.recipientUids.filter(uid => recipients.some(person => person.uid === uid)) };
          const result = await request(teamId, next); setConfig(result.config); setStatus('Report delivery settings saved.');
        } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to save report settings.'); }
        finally { setSaving(false); }
      }}>{saving ? 'Saving…' : 'Save report delivery'}</button>
    </fieldset>
    <p role="status">{status}</p>
    <h4 style={{ fontSize: 14 }}>Recent deliveries</h4>
    {deliveries.length ? <ul style={{ paddingLeft: 18, fontSize: 13 }}>{deliveries.map(delivery => <li key={delivery.id}>{delivery.kind === 'daily' ? 'Daily' : 'Weekly'} · {delivery.reportDate || 'Report'} · {delivery.status || 'Pending'}{delivery.recipientEmail ? ` · ${delivery.recipientEmail}` : ''}{delivery.lastError ? ` · ${delivery.lastError}` : ''}</li>)}</ul> : <p style={{ fontSize: 13 }}>No report deliveries recorded yet.</p>}
  </div>;
}
