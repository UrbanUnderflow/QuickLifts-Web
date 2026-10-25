import React, { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { APP_VERSION_PRODUCT_CONFIGS, type AppVersionProduct } from '../../utils/appVersioning';
import { emptyInAppMessage, normalizeInAppAnnouncement, validateInAppMessage, inAppAnnouncementDisablePatch, type InAppAnnouncement, type InAppMessageAudience } from '../../utils/inAppMessages';
import AppMessageEditor from './AppMessageEditor';

export default function InAppAnnouncementEditor({product}:{product:AppVersionProduct}) {
  const [message,setMessage]=useState<InAppAnnouncement>({...emptyInAppMessage(),id:'',revision:'',audience:'all'});
  const [loadFailed,setLoadFailed]=useState(false),[reloadToken,setReloadToken]=useState(0);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const app=APP_VERSION_PRODUCT_CONFIGS[product];
  useEffect(()=>{let active=true;setLoading(true);setLoadFailed(false);setError('');setNotice('');getDoc(doc(db,'company-config',`${app.appIdentity}-in-app-announcement`)).then(snapshot=>{if(active)setMessage(normalizeInAppAnnouncement(snapshot.data())||{...emptyInAppMessage(),id:'',revision:'',audience:'all'});}).catch(()=>{if(active){setLoadFailed(true);setError('The saved announcement could not be loaded. Try again before making changes.');}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[app.appIdentity,reloadToken]);
  async function save(publish:boolean) {
    setError('');setNotice('');
    try {
      if (!publish) {
        setSaving(true);
        await setDoc(doc(db,'company-config',`${app.appIdentity}-in-app-announcement`), {...inAppAnnouncementDisablePatch(),updatedAt:serverTimestamp()}, {merge:true});
        setMessage({...message,isEnabled:false});
        setNotice('Announcement turned off. Your current draft stays in this editor.');
        return;
      }
      const content=validateInAppMessage({...message,isEnabled:true});
      setSaving(true);
      const next={...content,id:message.id||crypto.randomUUID(),revision:crypto.randomUUID(),audience:message.audience};
      await setDoc(doc(db,'company-config',`${app.appIdentity}-in-app-announcement`),{...next,updatedAt:serverTimestamp()},{merge:true});
      setMessage(next);setNotice('Announcement published. Eligible accounts will see this revision once.');
    } catch(e){setError(e instanceof Error?e.message:'The announcement could not be saved. Please try again.');}
    finally {setSaving(false);}
  }
  return <section className="mb-6 rounded-2xl border border-zinc-700 bg-[#1a1e24] p-6 shadow-xl">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#d5e575]">Send something new</p><h2 className="text-2xl font-semibold text-white">In-app announcement</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Publish a message independently of an app release. Publish again to show a new revision to accounts that already saw it.</p></div><span className={`rounded-full px-3 py-1 text-xs ${message.isEnabled?'bg-emerald-900/40 text-emerald-200':'bg-zinc-700 text-zinc-200'}`}>{message.isEnabled?'Live':'Off'}</span></div>
    {loading?<p className="text-zinc-300">Loading announcement…</p>:loadFailed?<button type="button" onClick={()=>setReloadToken(value=>value+1)} className="rounded-xl bg-[#d5e575] px-5 py-3 font-semibold text-[#20271c]">Try again</button>:<>
      <AppMessageEditor value={message} onChange={content=>setMessage({...message,...content})} label="Include this announcement" showEnabled={false}/>
      <label className="mt-5 block max-w-xs text-sm text-zinc-300">Audience<select value={message.audience} onChange={e=>setMessage({...message,audience:e.target.value as InAppMessageAudience})} className="mt-2 w-full rounded-xl border border-zinc-600 bg-[#11171b] p-3 text-white"><option value="all">Everyone</option><option value="athletes">Athletes</option><option value="coaches">Coaches</option></select></label>
      <div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={()=>save(true)} className="rounded-xl bg-[#d5e575] px-6 py-3 font-semibold text-[#20271c] disabled:opacity-50">{saving?'Saving…':message.isEnabled?'Publish new revision':'Publish announcement'}</button><button type="button" disabled={saving} onClick={()=>save(false)} className="rounded-xl border border-zinc-600 px-6 py-3 font-semibold text-zinc-200 disabled:opacity-50">Turn off</button></div>
    </>}
    {error&&<p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}{notice&&<p role="status" className="mt-4 text-sm text-emerald-200">{notice}</p>}
  </section>;
}
