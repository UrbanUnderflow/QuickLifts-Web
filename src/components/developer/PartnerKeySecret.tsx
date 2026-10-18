import React, {useEffect, useRef, useState} from 'react';
import {Check, Copy, Eye, EyeOff} from 'lucide-react';
import type {PartnerKeyTransport} from './PartnerApiKeysWorkspace';
import styles from './PartnerApiKeysWorkspace.module.css';

export default function PartnerKeySecret({keyId, request, disabled = false, initialSecret}: {keyId: string; request: PartnerKeyTransport; disabled?: boolean; initialSecret?: string}) {
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    setSecret(null); setCopied(false); setBusy(false);
    const clear = () => {generation.current++; setSecret(null); setCopied(false); setBusy(false);};
    const visibility = () => {if (document.hidden) clear();};
    window.addEventListener('pagehide', clear);
    document.addEventListener('visibilitychange', visibility);
    return () => {generation.current++; window.removeEventListener('pagehide', clear); document.removeEventListener('visibilitychange', visibility);};
  }, [keyId, disabled]);
  useEffect(() => {
    if (!secret) return;
    const timer = window.setTimeout(() => setSecret(null), 60000);
    return () => window.clearTimeout(timer);
  }, [secret]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const access = async (copy: boolean) => {
    if (disabled || busy) return;
    const current = generation.current;
    setBusy(true); setError(''); setCopied(false);
    try {
      const value = initialSecret || (await request({action: 'reveal', keyId})).secret;
      if (generation.current !== current) return;
      if (typeof value !== 'string' || !value) throw new Error();
      if (copy) {await navigator.clipboard.writeText(value); if (generation.current === current) setCopied(true);}
      else setSecret(value);
    } catch (error) {
      if (generation.current === current) {
        const code = error instanceof Error ? error.message : '';
        setError(code === 'invalid_action'
          ? 'Secret access is not available on the connected server yet. The server needs the partner key reveal update.'
          : code === 'key_encryption_unavailable'
            ? 'The server could not unlock this saved credential. Its encryption configuration needs attention.'
            : copy ? 'Could not copy the secret. Try again or reveal it to copy manually.' : 'Could not reveal the secret. Refresh and try again.');
      }
    } finally {if (generation.current === current) setBusy(false);}
  };
  return <div className={styles.credential}>
    <span className={styles.credentialLabel}>API secret</span>
    <div className={styles.secretControl}>
      <code aria-label={secret && !disabled ? 'API secret' : 'Hidden API secret'}>{!disabled && secret ? secret : '************************'}</code>
      <button type="button" className={styles.button} aria-label={secret ? 'Hide API secret' : 'Reveal API secret'} title={secret ? 'Hide API secret' : 'Reveal API secret'} aria-pressed={!!secret} disabled={disabled || busy} onClick={() => secret ? setSecret(null) : void access(false)}>{secret ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
      <button type="button" className={styles.button} aria-label="Copy API secret" title="Copy API secret" disabled={disabled || busy} onClick={() => void access(true)}>{copied ? <Check size={16}/> : <Copy size={16}/>}</button>
    </div>
    <span role="status" className={styles.credentialLabel}>{busy ? 'Accessing secret…' : copied ? 'Copied' : ''}</span>
    {error && <p role="alert">{error}</p>}
  </div>;
}
