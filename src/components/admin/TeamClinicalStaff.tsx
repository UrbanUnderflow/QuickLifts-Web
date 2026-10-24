import React, { useEffect, useState } from 'react';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';
import { ClinicalContact, DesignatedClinicalStaff, SavedClinicalStaff, emptyClinicalStaff, validateClinicalStaff } from '../../lib/pulsecheck/designatedClinicalStaff';

async function request(teamId: string, configuration?: DesignatedClinicalStaff, expectedRevision = 0) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in to manage clinical staff.');
  const response = await fetch(`/api/admin/pulsecheck/designated-clinical-staff?teamId=${encodeURIComponent(teamId)}`, {
    method: configuration ? 'PUT' : 'GET', headers: { ...getFirebaseModeRequestHeaders(), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(configuration ? { body: JSON.stringify({ teamId, configuration, expectedRevision }) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Clinical staff settings are unavailable.');
  return result.config as SavedClinicalStaff | null;
}
export default function TeamClinicalStaff({ teamId, currentRoute }: { teamId: string; currentRoute: string }) {
  const [config, setConfig] = useState<DesignatedClinicalStaff>(emptyClinicalStaff);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoaded(false); setError('');
    request(teamId).then(value => {
      if (!active) return;
      setConfig(value ? { primary: value.primary, backup: value.backup, coverage: value.coverage, timeZone: value.timeZone, acknowledgmentMinutes: value.acknowledgmentMinutes } : emptyClinicalStaff());
      setRevision(value?.revision || 0); setLoaded(true);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [teamId]);
  function update(patch: Partial<DesignatedClinicalStaff>) { setConfig(v => ({ ...v, ...patch })); setStatus(''); }
  const contactFields = (key: 'primary' | 'backup', title: string) => {
    const person = config[key];
    if (!person) return null;
    return <fieldset style={{ border: '1px solid var(--pcp-border, #d8dfd9)', borderRadius: 16, padding: 16, margin: '16px 0' }}>
      <legend className="pcp-flbl">{title}</legend>
      <div className="pcp-fg">
        {(['name', 'email', 'phone'] as const).map(field => <label className="pcp-fld" key={field}>
          <span className="pcp-flbl">{field === 'name' ? 'Full name' : field === 'email' ? 'Work email' : 'Phone with country code'}</span>
          <input className="pcp-finp" type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'} value={person[field]}
            autoComplete="off" placeholder={field === 'phone' ? '+1 410 555 0123' : ''}
            onChange={e => update({ [key]: { ...person, [field]: e.target.value } as ClinicalContact })} />
        </label>)}
      </div>
    </fieldset>;
  };
  if (loading) return <p role="status">Loading clinical staff settings…</p>;
  return <div>
    <p>Choose your program’s own clinical contacts. An AuntEdna profile is optional and managed separately.</p>
    <div className="pcp-warn-box"><strong>Setup only · Delivery inactive</strong><p>Save the people and coverage you want to use. Phone calls, emails and backup escalation need verified staff access and delivery setup before activation.</p>
      <p>Current team route: <strong>{currentRoute === 'hotline' ? '988' : 'Clinician'}</strong>. Saving this draft keeps that route in place.</p></div>
    <fieldset disabled={!loaded || saving} style={{ border: 0, padding: 0, minWidth: 0 }}>
      {contactFields('primary', 'Primary clinical contact')}
      <label><input type="checkbox" checked={!!config.backup} onChange={e => update({ backup: e.target.checked ? { name: '', email: '', phone: '' } : null })} /> Add a backup clinical contact</label>
      {contactFields('backup', 'Backup clinical contact')}
      {!config.backup && <p>A backup contact is needed before an unanswered alert can be escalated to another person.</p>}
      <div className="pcp-fg" style={{ marginTop: 16 }}>
        <label className="pcp-fld"><span className="pcp-flbl">Coverage</span><select className="pcp-finp pcp-select" value={config.coverage.mode} onChange={e => update({ coverage: { ...config.coverage, mode: e.target.value as 'scheduled' | 'always' } })}><option value="scheduled">Scheduled hours</option><option value="always">24 hours, every day</option></select></label>
        <label className="pcp-fld"><span className="pcp-flbl">Time zone</span><input className="pcp-finp" value={config.timeZone} onChange={e => update({ timeZone: e.target.value })} placeholder="America/New_York" /></label>
      </div>
      {config.coverage.mode === 'scheduled' && <>
        <fieldset style={{ border: 0, padding: '16px 0' }}><legend className="pcp-flbl">Coverage days</legend><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => <label key={day}><input type="checkbox" checked={config.coverage.days.includes(i)} onChange={e => update({ coverage: { ...config.coverage, days: e.target.checked ? [...config.coverage.days, i] : config.coverage.days.filter(d => d !== i) } })} /> {day}</label>)}</div></fieldset>
        <div className="pcp-fg">{(['start', 'end'] as const).map(field => <label className="pcp-fld" key={field}><span className="pcp-flbl">{field === 'start' ? 'From' : 'Until'}</span><input className="pcp-finp" type="time" value={config.coverage[field]} onChange={e => update({ coverage: { ...config.coverage, [field]: e.target.value } })} /></label>)}</div>
        <p>Hours apply to the primary and backup contacts. Outside these hours, plan to keep 988 available. Overnight or different backup schedules require additional setup.</p>
      </>}
      <label className="pcp-fld" style={{ margin: '16px 0' }}><span className="pcp-flbl">Planned acknowledgment window (minutes)</span><input className="pcp-finp" type="number" min={1} max={30} value={config.acknowledgmentMinutes} onChange={e => update({ acknowledgmentMinutes: Number(e.target.value) })} /></label>
      <p>This is the planned time before trying the backup, not a promised clinical response time. Saving a contact does not grant access to athlete records.</p>
      <button type="button" className="pcp-ab pcp-ab-t" onClick={async () => {
        setError(''); setStatus(''); setSaving(true);
        try {
          const validated = validateClinicalStaff(config);
          const saved = await request(teamId, validated, revision);
          setConfig(validated); setRevision(saved!.revision);
          setStatus('Clinical staff draft saved. Current routing is unchanged.');
        } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save.'); }
        finally { setSaving(false); }
      }}>{saving ? 'Saving…' : 'Save clinical staff draft'}</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}
  </div>;
}
