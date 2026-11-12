import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, getFirebaseModeRequestHeaders } from '../../api/firebase/config';
export default function RuntimeDiagnosticPage() {
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  useEffect(() => onAuthStateChanged(auth, user => setAllowed(user?.uid === 'RI6D2h6ygab46uxxxZwVkYpWU6B2')), []);
  async function check() {
    setBusy(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { setResult('Sign in to the coach dashboard first.'); return; }
      const response = await fetch('/api/coach/communications/runtime-diagnostic', {method:'POST',cache:'no-store',headers:{Authorization:`Bearer ${token}`,...getFirebaseModeRequestHeaders(),'Content-Type':'application/json'},body:'{}'});
      const data = await response.json().catch(() => null);
      setResult(JSON.stringify({status:response.status,...(data ? {diagnostic:data} : {})},null,2));
    } catch { setResult('Diagnostic unavailable.'); }
    finally { setBusy(false); }
  }
  return <main style={{padding:32}}><h1>Messaging authentication check</h1>{allowed ? <button disabled={busy} onClick={check}>{busy ? 'Checking…' : 'Run read-only authentication check'}</button> : <p>Sign in with the authorized coach account.</p>}<pre>{result}</pre></main>;
}
