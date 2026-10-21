import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
/** Explicit admin action also upgrades older invitations without replacing them. */
export default function AthleteActivationQR({token, label}: {token: string; label: string}) {
  const [data, setData] = useState<{code: string; url: string; image: string} | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function open() {
    setBusy(true); setError('');
    try {
      const invite = await pulseCheckProvisioningService.prepareAthleteActivation(token);
      const qr = await import('qrcode');
      setData({...invite, image: await qr.toDataURL(invite.url, {width: 1000, margin: 4, errorCorrectionLevel: 'M'})});
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to prepare activation.'); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className="pcp-ab pcp-ab-g" disabled={busy} onClick={e => {e.stopPropagation(); void open();}}>{busy ? 'Preparing…' : 'Activation QR'}</button>
    {error && <span role="alert">{error}</span>}
    {data && createPortal(<div role="dialog" aria-modal="true" aria-label={`${label} activation`} style={{position:'fixed', inset:0, zIndex:10000, background:'#15291fba', display:'grid', placeItems:'center', padding:24}} onClick={()=>setData(null)}>
      <div style={{background:'#f4f2e9', color:'#243d32', borderRadius:24, padding:28, maxWidth:460, width:'100%', textAlign:'center'}} onClick={e=>e.stopPropagation()}>
        <button type="button" onClick={()=>setData(null)} style={{float:'right'}}>Close</button>
        <h2 style={{fontSize:24, marginTop:30}}>Join {label}</h2>
        <p>Scan to get the app. Already installed? Scan this same code inside the app.</p>
        <img src={data.image} alt={`Activation QR for ${label}`} style={{width:'100%', maxWidth:300, margin:'16px auto'}} />
        <p>Or enter your activation code</p><strong style={{fontSize:20, letterSpacing:2, overflowWrap:'anywhere'}}>{data.code}</strong>
        <p style={{marginTop:16}}><a href={data.image} download={`team-activation-qr.png`}>Download QR for your activation slide</a></p>
        {!new URL(data.url).hostname.endsWith('.onelink.me') && <p role="status" style={{marginTop:12}}>App-store routing is not configured for this product yet. This QR opens the invitation web page.</p>}
      </div>
    </div>, document.body)}
  </>;
}
