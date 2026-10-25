import React, { useState } from 'react';
import { type AppVersionDocument, type AppVersionProduct } from '../../utils/appVersioning';
import { emptyInAppMessage } from '../../utils/inAppMessages';
import { savePublishedReleaseHighlights } from '../../api/firebase/admin/versionHighlights';
import AppMessageEditor from './AppMessageEditor';

export default function ExistingReleaseHighlightsEditor({product,release,onClose,onSaved}:{product:AppVersionProduct;release:AppVersionDocument;onClose:()=>void;onSaved:()=>void}) {
  const [content,setContent]=useState(release.whatsNew || {...emptyInAppMessage(),isEnabled:true,title:'What’s new',markdown:release.changeNotes.map(note=>`- ${note}`).join('\n')});
  const [saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  async function save() {
    if (saving) return;
    setSaving(true);setError('');setNotice('');
    try {await savePublishedReleaseHighlights(product,release.version,content);setNotice(`Highlights saved for version ${release.version}.`);onSaved();}
    catch (failure) {setError(failure instanceof Error?failure.message:'The highlights could not be saved. Please try again.');}
    finally {setSaving(false);}
  }
  return <section className="mb-6 rounded-2xl border border-[#d5e575]/30 bg-[#171d22] p-6">
    <div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#d5e575]">Version {release.version}{release.buildNumber?` · Build ${release.buildNumber}`:''}</p><h2 className="text-xl font-semibold text-white">Edit release highlights</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Save the message for this published release. Its media, version, build, change notes and critical-update setting stay as published.</p></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close highlight editor" className="rounded-full border border-zinc-600 px-3 py-2 text-zinc-300">×</button></div>
    <fieldset disabled={saving}><AppMessageEditor value={content} onChange={next=>{setContent(next);setNotice('');}} label="Show these highlights for this release" eyebrow="WHAT’S NEW"/></fieldset>
    <button type="button" onClick={save} disabled={saving} className="mt-6 rounded-xl bg-[#d5e575] px-6 py-3 font-semibold text-[#20271c] disabled:opacity-50">{saving?'Saving highlights…':'Save highlights only'}</button>
    {error&&<p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}{notice&&<p role="status" className="mt-4 text-sm text-emerald-200">{notice}</p>}
  </section>;
}
