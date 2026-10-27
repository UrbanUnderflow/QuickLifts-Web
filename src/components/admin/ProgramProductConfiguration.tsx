import React, { useEffect, useState } from 'react';
import type { PulseCheckAppExperience, PulseCheckAppBranding, PulseCheckProductBrand } from '../../api/firebase/pulsecheckProvisioning/types';

type Configuration = { productBrand?: PulseCheckProductBrand; appBranding?: PulseCheckAppBranding; appExperience?: PulseCheckAppExperience; signInPolicy?: import('../../lib/pulsecheck/signInPolicy').ProgramSignInPolicy };
export function ProductConfigurationFields({ value, onChange, disabled = false }: {
  value: Configuration; onChange: (value: Configuration) => void; disabled?: boolean;
}) {
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
    <div className="pcp-fg">
      <label className="pcp-fld"><span className="pcp-flbl">Program registration</span>
        <select className="pcp-finp pcp-select" value={value.signInPolicy?.mode || 'standard'} onChange={event => onChange({ ...value, signInPolicy: { mode: event.target.value as 'standard' | 'institution-phone', emailDomains: value.signInPolicy?.emailDomains || [] } })}>
          <option value="standard">Standard registration</option><option value="institution-phone">Institutional email and phone</option>
        </select>
      </label>
      <label className="pcp-fld"><span className="pcp-flbl">Institution email domains</span>
        <input className="pcp-finp" placeholder="umes.edu" value={(value.signInPolicy?.emailDomains || []).join(', ')} onChange={event => onChange({ ...value, signInPolicy: { mode: value.signInPolicy?.mode || 'standard', emailDomains: event.target.value.split(',').map(domain => domain.trim().replace(/^@/, '').toLowerCase()) } })} />
      </label>
    </div>
    <p style={{ fontSize: 13 }}>Institutional registration collects an approved email address and verifies a phone number for this organization. Returning users choose their sign-in method. Separate multiple email domains with commas.</p>
    <div className="pcp-fg">
      <label className="pcp-fld"><span className="pcp-flbl">Program product</span>
        <select className="pcp-finp pcp-select" value={value.productBrand || ''} onChange={event => onChange({ ...value, productBrand: event.target.value as PulseCheckProductBrand })}>
          <option value="" disabled>Select a program product</option><option value="athleticmind">AthleticMind</option><option value="pulsecheck">PulseCheck</option>
        </select>
      </label>
      <div className="pcp-fld"><span className="pcp-flbl">Support pathway</span>
        <p>{value.productBrand === 'pulsecheck' ? '988 crisis support' : value.productBrand === 'athleticmind' ? 'AuntEdna care team' : 'Choose a program product'}</p>
      </div>
    </div>
    <p style={{ fontSize: 13 }}>Teams inherit this product and support pathway. Existing support cases keep their assigned route.</p>
    <div className="pcp-fg">
      {(['pulsecheck', 'athleticmind'] as const).map(app => <label className="pcp-fld" key={app}>
        <span className="pcp-flbl">{app === 'pulsecheck' ? 'PulseCheck app branding' : 'AthleticMind app branding'}</span>
        <select className="pcp-finp pcp-select" value={value.appBranding?.[app] || app} onChange={event => onChange({ ...value, appBranding: { ...value.appBranding, [app]: event.target.value as PulseCheckProductBrand } })}>
          <option value="pulsecheck">PulseCheck{app === 'pulsecheck' ? ' (default)' : ''}</option>
          <option value="" disabled>Select a program product</option><option value="athleticmind">AthleticMind{app === 'athleticmind' ? ' (default)' : ''}</option>
        </select>
      </label>)}
    </div>
    <p style={{ fontSize: 13 }}>App branding takes effect after the athlete joins this program. Branding does not change care routing or staff permissions.</p>
    <div className="pcp-fg">
      {(['ios', 'android'] as const).map(platform => <label className="pcp-fld" key={platform}>
        <span className="pcp-flbl">{platform === 'ios' ? 'iOS' : 'Android'} app appearance</span>
        <select className="pcp-finp pcp-select" value={value.appExperience?.[platform] || 'standard'} onChange={event => onChange({ ...value, appExperience: { ...value.appExperience, [platform]: event.target.value as 'standard' | 'clay' } })}>
          <option value="standard">Standard</option><option value="clay">Clay</option>
        </select>
      </label>)}
    </div>
    <p style={{ fontSize: 13 }}>Choose each platform’s visual experience independently. Appearance does not change branding, permissions, or the support pathway.</p>
  </fieldset>;
}

export default function ProgramProductConfiguration({ configuration, onSave }: {
  configuration: Configuration; onSave: (value: Configuration) => Promise<void>;
}) {
  const [value, setValue] = useState(configuration);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => { setValue(configuration); }, [configuration.productBrand, configuration.appBranding?.pulsecheck, configuration.appBranding?.athleticmind, configuration.appExperience?.ios, configuration.appExperience?.android, configuration.signInPolicy]);
  return <section style={{ padding: 20, marginBottom: 20, border: '1px solid rgba(128,128,128,.3)', borderRadius: 16 }}>
    <h3>Product and app branding</h3>
    <ProductConfigurationFields value={value} onChange={next => { setValue(next); setStatus(''); }} disabled={saving} />
    <button type="button" className="pcp-ab pcp-ab-g" disabled={saving || !value.productBrand} onClick={async () => {
      setSaving(true); setStatus('');
      try { await onSave(value); setStatus('Product configuration saved.'); }
      catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to save product configuration.'); }
      finally { setSaving(false); }
    }}>{saving ? 'Saving…' : 'Save product configuration'}</button>
    <p role="status">{status}</p>
  </section>;
}
