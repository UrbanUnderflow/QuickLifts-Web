import React, { useEffect, useState } from 'react';
import type { PulseCheckAppBranding, PulseCheckProductBrand } from '../../api/firebase/pulsecheckProvisioning/types';

type Configuration = { productBrand?: PulseCheckProductBrand; appBranding?: PulseCheckAppBranding };
export function ProductConfigurationFields({ value, onChange, disabled = false }: {
  value: Configuration; onChange: (value: Configuration) => void; disabled?: boolean;
}) {
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
    <div className="pcp-fg">
      <label className="pcp-fld"><span className="pcp-flbl">Program product</span>
        <select className="pcp-finp pcp-select" value={value.productBrand || 'athleticmind'} onChange={event => onChange({ ...value, productBrand: event.target.value as PulseCheckProductBrand })}>
          <option value="athleticmind">AthleticMind</option><option value="pulsecheck">PulseCheck</option>
        </select>
      </label>
      <div className="pcp-fld"><span className="pcp-flbl">Support pathway</span>
        <p>{value.productBrand === 'pulsecheck' ? '988 crisis support' : 'AuntEdna care team'}</p>
      </div>
    </div>
    <p style={{ fontSize: 13 }}>Teams inherit this product and support pathway. Existing support cases keep their assigned route.</p>
    <div className="pcp-fg">
      {(['pulsecheck', 'athleticmind'] as const).map(app => <label className="pcp-fld" key={app}>
        <span className="pcp-flbl">{app === 'pulsecheck' ? 'PulseCheck app branding' : 'AthleticMind app branding'}</span>
        <select className="pcp-finp pcp-select" value={value.appBranding?.[app] || app} onChange={event => onChange({ ...value, appBranding: { ...value.appBranding, [app]: event.target.value as PulseCheckProductBrand } })}>
          <option value="pulsecheck">PulseCheck{app === 'pulsecheck' ? ' (default)' : ''}</option>
          <option value="athleticmind">AthleticMind{app === 'athleticmind' ? ' (default)' : ''}</option>
        </select>
      </label>)}
    </div>
    <p style={{ fontSize: 13 }}>App branding takes effect after the athlete joins this program. Branding does not change care routing or staff permissions.</p>
  </fieldset>;
}

export default function ProgramProductConfiguration({ configuration, onSave }: {
  configuration: Configuration; onSave: (value: Configuration) => Promise<void>;
}) {
  const [value, setValue] = useState(configuration);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => { setValue(configuration); }, [configuration.productBrand, configuration.appBranding?.pulsecheck, configuration.appBranding?.athleticmind]);
  return <section style={{ padding: 20, marginBottom: 20, border: '1px solid rgba(128,128,128,.3)', borderRadius: 16 }}>
    <h3>Product and app branding</h3>
    <ProductConfigurationFields value={value} onChange={next => { setValue(next); setStatus(''); }} disabled={saving} />
    <button type="button" className="pcp-ab pcp-ab-g" disabled={saving} onClick={async () => {
      setSaving(true); setStatus('');
      try { await onSave(value); setStatus('Product configuration saved.'); }
      catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to save product configuration.'); }
      finally { setSaving(false); }
    }}>{saving ? 'Saving…' : 'Save product configuration'}</button>
    <p role="status">{status}</p>
  </section>;
}
