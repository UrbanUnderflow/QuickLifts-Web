import React, { useState } from 'react';
import type { PulseCheckRequiredConsentDocument } from '../../../api/firebase/pulsecheckProvisioning/types';
import { consentCategory, type ConsentDecisions } from '../../../api/firebase/pulsecheckProvisioning/consentPolicy';

const labels = { participation: 'Program participation', health_authorization: 'Health information authorization', research: 'Optional research', staff: 'Staff responsibilities' };
export default function ConsentChoices({ documents, decisions, onChange, name }: {
  documents: PulseCheckRequiredConsentDocument[]; decisions: ConsentDecisions; onChange: (next: ConsentDecisions) => void; name: string;
}) {
  const [signedName, setSignedName] = useState('');
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  function decide(doc: PulseCheckRequiredConsentDocument, decision: 'accepted' | 'declined' | 'revoked') {
    onChange({ ...decisions, [doc.id]: { decision, version: doc.version, signedName: signedName.trim(), decidedAt: new Date().toISOString(), document: doc } });
  }
  function download(doc: PulseCheckRequiredConsentDocument) {
    const candidate = decisions[doc.id];
    const entry = candidate?.version === doc.version && candidate?.document?.body === doc.body ? candidate : undefined;
    const text = `${doc.title}\nVersion: ${doc.version}\n\n${doc.body}\n\nDecision: ${entry?.decision || 'Pending'}\nName: ${entry?.signedName || name}\nDecision time: ${entry?.decidedAt || ''}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${doc.id}-${doc.version}.txt`; a.click(); URL.revokeObjectURL(url);
  }
  return <section className="space-y-5 rounded-2xl border border-white/15 p-5 text-white">
    <h2 className="text-xl font-semibold">Your agreements and choices</h2>
    <p className="text-sm text-zinc-300">{documents.every(doc => consentCategory(doc) === 'staff') ? 'Review your confidentiality, access, and support responsibilities before joining your team workspace.' : 'Review each set of terms and make a separate decision. Health sharing and research are optional. Your choices apply only to the purposes shown.'}</p>
    <label className="block text-sm">Your full name for electronic signature
      <input className="mt-2 w-full rounded-xl border border-white/20 bg-black/20 p-3 text-white" autoComplete="name" placeholder={name || 'Full name'} value={signedName} onChange={e => setSignedName(e.target.value)} />
    </label>
    <p className="text-xs text-zinc-300">Choosing “Agree and sign” or “Authorize and sign” applies your typed name as your electronic signature to that set of terms.</p>
    {documents.map(doc => {
      const category = consentCategory(doc);
      const optional = category === 'health_authorization' || category === 'research';
      const entry = decisions[doc.id];
      const current = entry?.version === doc.version && entry?.document?.body === doc.body ? entry : undefined;
      return <article key={doc.id} className="rounded-xl border border-white/15 p-4 space-y-3">
        <p className="text-xs uppercase tracking-wide text-zinc-300">{labels[category]}</p>
        <h3 className="font-semibold">{doc.title}</h3>
        <details onToggle={e => { if (e.currentTarget.open) setOpened(v => ({ ...v, [doc.id]: true })); }}>
          <summary className="cursor-pointer underline">Read terms · {doc.version}</summary>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-200">{doc.body}</div>
        </details>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={!signedName.trim() || !opened[doc.id]} onClick={() => decide(doc, 'accepted')} className="rounded-lg bg-white px-4 py-2 text-black disabled:opacity-40">{category === 'health_authorization' ? 'Authorize and sign' : 'Agree and sign'}</button>
          {category !== 'staff' && <button type="button" onClick={() => decide(doc, 'declined')} className="rounded-lg border border-white/30 px-4 py-2">{category === 'research' ? 'Decline research' : category === 'participation' ? 'Decline participation' : 'Decline authorization'}</button>}
          {category === 'health_authorization' && current?.decision === 'accepted' && <button type="button" onClick={() => decide(doc, 'revoked')} className="rounded-lg border border-white/30 px-4 py-2">Revoke authorization</button>}
          <button type="button" onClick={() => download(doc)} className="underline text-sm">Save {current ? 'decision and terms' : 'terms'}</button>
        </div>
        <p role="status" className="text-sm text-zinc-300">{current ? `Selected choice: ${current.decision}.` : 'Choose after reviewing the terms. Continue to save your choices.'}</p>
        {optional && <p className="text-xs text-zinc-300">You can continue with the remaining program features if you decline.</p>}
      </article>;
    })}
  </section>;
}
