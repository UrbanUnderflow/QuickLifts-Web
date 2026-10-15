import React, {useCallback, useEffect, useRef, useState} from 'react';
import Head from 'next/head';
import type {GetServerSideProps} from 'next';
import {ArrowUpRight, Check, Copy, Eye, EyeOff, LockKeyhole, LogOut} from 'lucide-react';
import DeveloperLayout from '../../../../components/developer/DeveloperLayout';
import styles from '../../../../components/developer/AuntEdnaPartnerPortal.module.css';

type Session = {authenticated: true; keyId: string; expiresAt: string; sessionExpiresAt: string};
const API = '/api/developer/partner/auntedna';
export const getServerSideProps: GetServerSideProps = async ({res}) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  return {props: {}};
};
export default function AuntEdnaPartnerPortal() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState<'login' | 'secret' | 'copy' | 'logout' | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const generation = useRef(0);
  const clearSecret = useCallback(() => {generation.current += 1; setSecret(null); setCopied(false);}, []);
  const readSession = useCallback(async () => {
    const response = await fetch(`${API}/session`, {cache: 'no-store'});
    if (response.status === 401) {setSession(null); clearSecret(); return;}
    if (!response.ok) throw new Error('Partner access is temporarily unavailable. Please try again.');
    const data = await response.json();
    if (data.authenticated !== true || typeof data.keyId !== 'string' || typeof data.expiresAt !== 'string' || typeof data.sessionExpiresAt !== 'string') throw new Error('Partner access is temporarily unavailable.');
    setSession(data);
  }, [clearSecret]);
  useEffect(() => {let mounted = true; void readSession().catch(failure => {if (mounted) setError(failure.message);}).finally(() => {if (mounted) setChecking(false);}); return () => {mounted = false; generation.current += 1;};}, [readSession]);
  useEffect(() => {const onHidden = () => {if (document.visibilityState === 'hidden') clearSecret();}; window.addEventListener('pagehide', clearSecret); window.addEventListener('pageshow', clearSecret); document.addEventListener('visibilitychange', onHidden); return () => {window.removeEventListener('pagehide', clearSecret); window.removeEventListener('pageshow', clearSecret); document.removeEventListener('visibilitychange', onHidden);};}, [clearSecret]);
  useEffect(() => {if (!secret) return; const timer = window.setTimeout(clearSecret, 60000); return () => window.clearTimeout(timer);}, [secret, clearSecret]);
  useEffect(() => {if (!session) return; const remaining = Date.parse(session.sessionExpiresAt) - Date.now(); const end = () => {clearSecret(); setSession(null); setError('Your session has ended. Enter the partner password again.');}; if (!Number.isFinite(remaining) || remaining <= 0) {end(); return;} const timer = window.setTimeout(end, remaining); return () => window.clearTimeout(timer);}, [session, clearSecret]);
  const login = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy('login'); setError(''); clearSecret();
    try {
      const response = await fetch(`${API}/login`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({password})});
      setPassword('');
      if (!response.ok) {setError(response.status === 401 ? 'That partner password was not accepted.' : response.status === 429 ? 'Too many attempts. Please try again later.' : 'Partner access is temporarily unavailable. Please try again.'); return;}
      await readSession();
    } catch {setError('Could not connect. Please try again.');} finally {setPassword(''); setBusy(null);}
  };
  const accessSecret = async (action: 'reveal' | 'copy') => {
    setBusy(action === 'copy' ? 'copy' : 'secret'); setError(''); setCopied(false); const attempt = ++generation.current;
    try {
      const response = await fetch(`${API}/secret`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}', cache: 'no-store'});
      if (!response.ok) {
        if (attempt !== generation.current) return;
        clearSecret();
        if (response.status === 401) setSession(null);
        setError(response.status === 401 ? 'Your session has ended. Enter the partner password again.' : 'The secret key is temporarily unavailable. Please try again.');
        return;
      }
      const data = await response.json();
      if (attempt !== generation.current) return;
      if (typeof data.secret !== 'string' || !data.secret || data.keyId !== session?.keyId) throw new Error('The credential changed. Refresh this page before continuing.');
      if (action === 'reveal') setSecret(data.secret);
      else {await navigator.clipboard.writeText(data.secret); if (attempt === generation.current) setCopied(true);}
    } catch (failure) {if (attempt === generation.current) {clearSecret(); setError(failure instanceof Error ? failure.message : 'Could not access the secret key.');}} finally {setBusy(null);}
  };
  const logout = async () => {
    clearSecret(); setPassword(''); setBusy('logout'); setError('');
    try {const response = await fetch(`${API}/logout`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'}); if (!response.ok) throw new Error(); setSession(null);}
    catch {setError('Could not end the session. Your displayed secret has been cleared. Please try logging out again.');} finally {setBusy(null);}
  };
  return <DeveloperLayout title="AuntEdna partner portal"><Head><meta name="robots" content="noindex, nofollow"/><meta name="referrer" content="no-referrer"/></Head>
    <header className={styles.heading}><div><p className={styles.eyebrow}>Partner access</p><h1>AuntEdna integration</h1><p>Your connection details and integration guides, together.</p></div>{session && <button type="button" className={styles.secondary} disabled={busy !== null} onClick={() => void logout()}><LogOut size={15}/>Log out</button>}</header>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {checking ? <p role="status">Checking partner access…</p> : !session ? <section className={styles.login}>
      <div className={styles.icon}><LockKeyhole size={23}/></div><h2>Open your partner portal</h2><p>Use the dedicated AuntEdna partner password provided through your agreed secure channel.</p>
      <form onSubmit={login}><label htmlFor="auntedna-partner-password">Partner password</label><div className={styles.passwordRow}><input id="auntedna-partner-password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={event => setPassword(event.target.value)}/><button type="submit" className={styles.primary} disabled={!password.trim() || busy !== null}>{busy === 'login' ? 'Opening…' : 'Open portal'}</button></div></form><p className={styles.hint}>No Pulse account is required. This portal uses its own partner password.</p>
    </section> : <>
      <section className={styles.secretCard} aria-label="Partner credential"><div className={styles.cardHeading}><div><p className={styles.eyebrow}>Athletic Mind snapshot API</p><h2>Secret key</h2></div><span className={styles.badge}>AuntEdna</span></div>
        <p className={styles.description}>Use this secret on your server to sign snapshot requests. Store it in your secrets manager.</p>
        <div className={styles.secretValue}><code aria-label={secret ? 'Revealed secret key' : 'Masked secret key'}>{secret || '••••••••••••••••••••••••••••••••'}</code></div>
        <div className={styles.actions}><button type="button" className={styles.primary} disabled={busy !== null} onClick={() => secret ? clearSecret() : void accessSecret('reveal')}>{secret ? <EyeOff size={16}/> : <Eye size={16}/>} {busy === 'secret' ? 'Loading…' : secret ? 'Hide' : 'Reveal'}</button><button type="button" className={styles.secondary} disabled={busy !== null} onClick={() => void accessSecret('copy')}>{copied ? <Check size={16}/> : <Copy size={16}/>} {busy === 'copy' ? 'Copying…' : copied ? 'Copied' : 'Copy'}</button><span className={styles.hint} role="status">{copied ? 'Secret key copied.' : secret ? 'The key hides automatically after one minute.' : 'Copy securely or reveal the key briefly.'}</span></div>
        <dl className={styles.metadata}><div><dt>Key ID</dt><dd><code>{session.keyId}</code></dd></div><div><dt>Expires</dt><dd>{new Date(session.expiresAt).toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'})}</dd></div></dl>
      </section>
      <section aria-labelledby="partner-guides"><h2 id="partner-guides" className={styles.sectionTitle}>Integration guides</h2><div className={styles.guides}>
        <a href="/developer/api/auntedna"><h3>AuntEdna athlete baseline <ArrowUpRight size={20}/></h3><p>The 48-item Starting Point, question ownership, versioning, and delivery examples.</p><span>Open baseline guide</span></a>
        <a href="/developer/api/athleticmind-snapshots"><h3>Athletic Mind snapshots <ArrowUpRight size={20}/></h3><p>Request signing, payload schema, examples, and receipts.</p><span>Open snapshot guide</span></a>
        <a href="/developer/api/clinical-bridge"><h3>Clinical bridge <ArrowUpRight size={20}/></h3><p>Emergency handoff, case acknowledgment, and workflow updates.</p><span>Open clinical guide</span></a>
      </div><p className={styles.hint}>The snapshot secret signs snapshot API requests. Baseline delivery uses the AuntEdna partner Bearer key. Clinical bridge credentials follow the setup described in its guide.</p></section>
    </>}
  </DeveloperLayout>;
}
