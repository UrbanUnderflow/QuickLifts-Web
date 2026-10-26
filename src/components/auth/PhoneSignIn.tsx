import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { createPhoneAuthAttempt, normalizeAuthPhone, phoneAuthError } from '../../api/firebase/auth/phone';

type Props = {
  mode?: 'signin' | 'link';
  disabled?: boolean;
  onSuccess: (user: User) => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
};

export default function PhoneSignIn({ mode = 'signin', disabled, onSuccess, onBusyChange }: Props) {
  const [open, setOpen] = useState(mode === 'signin');
  const [institutionalEmail, setInstitutionalEmail] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [existingAccount, setExistingAccount] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const container = useRef<HTMLDivElement>(null);
  const attempt = useRef<Awaited<ReturnType<typeof createPhoneAuthAttempt>>>();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; void attempt.current?.dispose(); };
  }, []);
  useEffect(() => {
    if (retryAt <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); onBusyChange?.(true); setError(''); setExistingAccount(false);
    try { await operation(); }
    catch (err) { if (active.current) { setError(phoneAuthError(err)); setExistingAccount((err as { code?: string })?.code === 'phone-auth/existing-account'); } }
    finally { if (active.current) { setBusy(false); onBusyChange?.(false); } }
  };
  const send = () => void run(async () => {
    if (mode === 'signin' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(institutionalEmail.trim())) throw new Error('Enter your institutional email address.');
    if (mode === 'signin' && !acceptTerms) throw new Error('Agree to the Terms and Privacy Policy to continue.');
    const normalized = normalizeAuthPhone(phone);
    await attempt.current?.dispose();
    attempt.current = await createPhoneAuthAttempt(container.current!, mode);
    if (!active.current) { await attempt.current.dispose(); return; }
    await attempt.current.send(normalized);
    if (active.current) { setPhone(normalized); setSent(true); setCode(''); setRetryAt(Date.now() + 60000); setNow(Date.now()); }
  });
  const confirm = () => void run(async () => {
    if (!attempt.current) throw new Error('Request a new code to continue.');
    const user = await attempt.current.confirm(code, institutionalEmail, acceptTerms);
    if (!active.current) return;
    await onSuccess(user);
    await attempt.current.dispose(); attempt.current = undefined;
    if (active.current) { setOpen(false); setSent(false); setCode(''); }
  });
  return (
    <div className="my-3 rounded-xl border border-white/10 bg-zinc-950 p-3 text-sm text-white">
      {!open ? (
        <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="w-full py-2 font-medium disabled:opacity-50">
          {mode === 'link' ? 'Connect phone number' : 'Continue with email and phone'}
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs leading-5 text-zinc-400">{mode === 'link'
            ? 'Verify your phone to use it for this same account.'
            : 'Enter your institutional email and phone number. Your phone verifies your identity; your email is saved for reference. No password needed.'}</p>
          {mode === 'signin' && <label className="block">Institutional email
            <input type="email" autoComplete="email" value={institutionalEmail} onChange={(e) => setInstitutionalEmail(e.target.value)} disabled={sent || busy}
              placeholder="you@institution.edu" className="mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 p-3 text-white" />
          </label>}
          {mode === 'signin' && <label className="flex items-start gap-2 text-xs text-zinc-300">
            <input type="checkbox" checked={acceptTerms} disabled={busy || sent} onChange={(e) => setAcceptTerms(e.target.checked)} />
            <span>I agree to the <a href="/terms" target="_blank" rel="noreferrer" className="underline">Terms</a> and <a href="/privacy" target="_blank" rel="noreferrer" className="underline">Privacy Policy</a>.</span>
          </label>}
          <label className="block">Phone number
            <input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent || busy}
              placeholder="+1 202 555 0123" className="mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 p-3 text-white" />
          </label>
          <div ref={container} />
          {sent && <>
            <p role="status" className="text-xs text-zinc-300">Code sent to {phone}.</p>
            <label className="block">Verification code
              <input inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 p-3 text-white" />
            </label>
          </>}
          {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
          {existingAccount && <a className="block text-xs underline" href={`/PulseCheck/login?phoneSetup=1&email=${encodeURIComponent(institutionalEmail)}`}>Connect your existing account without a password</a>}
          <button type="button" onClick={sent ? confirm : send} disabled={busy || disabled || (sent && code.length !== 6)}
            className="w-full rounded-lg bg-white py-3 font-semibold text-zinc-900 disabled:opacity-50">
            {busy ? 'Please wait…' : sent ? (mode === 'link' ? 'Verify and connect' : 'Verify and sign in') : 'Send text message'}
          </button>
          {sent && <button type="button" disabled={busy || remaining > 0} onClick={send} className="mr-4 text-xs disabled:opacity-50">
            {remaining ? `Resend in ${remaining}s` : 'Resend code'}
          </button>}
          <button type="button" disabled={busy} className="text-xs text-zinc-400" onClick={() => {
            void attempt.current?.dispose(); attempt.current = undefined; setSent(false); setCode(''); setError(''); setOpen(false);
          }}>Cancel</button>
          <p className="text-[11px] leading-4 text-zinc-500">By requesting a code, you agree to receive a verification text. Message and data rates may apply. Google processes your phone number to prevent abuse.</p>
        </div>
      )}
    </div>
  );
}
