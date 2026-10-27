import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseModeRequestHeaders } from '../../api/firebase/config';
import { createPhoneAuthAttempt, normalizeAuthPhone, phoneAuthError } from '../../api/firebase/auth/phone';

type Props = {
  mode?: 'signin' | 'register' | 'link';
  organizationId?: string;
  initialEmail?: string;
  disabled?: boolean;
  onSuccess: (user: User) => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  onPolicyChange?: (standard: boolean) => void;
};

export default function PhoneSignIn({ mode = 'signin', disabled, onSuccess, onBusyChange, onPolicyChange, organizationId, initialEmail = '' }: Props) {
  const [open, setOpen] = useState(mode !== 'link');
  const [institutionalEmail, setInstitutionalEmail] = useState(initialEmail);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [existingAccount, setExistingAccount] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const policyChange = useRef(onPolicyChange);
  policyChange.current = onPolicyChange;
  useEffect(() => {
    policyChange.current?.(true);
    if (mode !== 'register' || !organizationId) return;
    const context = organizationId;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch('/.netlify/functions/program-sign-in-policy', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...getFirebaseModeRequestHeaders() },
        body: JSON.stringify({ organizationId: context }),
      }).then(async response => {
        if (!response.ok) throw new Error('Policy unavailable');
        const policy = await response.json();
        if (!controller.signal.aborted) {
          setRegistrationEnabled(policy.mode === 'institution-phone' || policy.mode === 'standard');
          policyChange.current?.(policy.mode === 'standard');
        }
      }).catch(() => { /* Standard registration remains available when policy cannot be loaded. */ });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [mode, organizationId]);
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
    finally {
      if (active.current) setBusy(false);
      // A successful sign-in can unmount this form while its parent stays open.
      // Release the parent's pending state so team enrollment can continue.
      onBusyChange?.(false);
    }
  };
  const send = () => void run(async () => {
    if (mode === 'register' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(institutionalEmail.trim())) throw new Error('Enter your institutional email address.');
    if (mode === 'register' && !acceptTerms) throw new Error('Agree to the Terms and Privacy Policy to continue.');
    const normalized = normalizeAuthPhone(phone);
    await attempt.current?.dispose();
    attempt.current = await createPhoneAuthAttempt(container.current!, mode === 'link' ? 'link' : 'signin');
    if (!active.current) { await attempt.current.dispose(); return; }
    await attempt.current.send(normalized);
    if (active.current) { setPhone(normalized.slice(2)); setSent(true); setCode(''); setRetryAt(Date.now() + 60000); setNow(Date.now()); }
  });
  const confirm = () => void run(async () => {
    if (!attempt.current) throw new Error('Request a new code to continue.');
    const user = await attempt.current.confirm(code, mode === 'register' ? institutionalEmail : '', mode === 'register' && acceptTerms, mode === 'register' ? organizationId : undefined);
    if (!active.current) return;
    await onSuccess(user);
    await attempt.current.dispose(); attempt.current = undefined;
    if (active.current) { setOpen(false); setSent(false); setCode(''); }
  });
  if (mode === 'register' && !registrationEnabled) return null;
  return (
    <div className="text-sm text-white" data-phone-sign-in="integrated" onKeyDown={event => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type !== 'checkbox') { event.preventDefault(); if (!busy && !disabled && (!sent || code.length === 6)) { if (sent) confirm(); else send(); } }
    }}>
      {!open ? (
        <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="w-full py-2 font-medium disabled:opacity-50">
          {mode === 'link' ? 'Connect phone number' : 'Log in'}
        </button>
      ) : (
        <div className="space-y-5">
          {!sent && mode === 'register' && <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Institutional email
            <input type="email" autoComplete="email" value={institutionalEmail} onChange={(e) => setInstitutionalEmail(e.target.value)} disabled={sent || busy}
              placeholder="you@institution.edu" className="mt-2 min-h-[52px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base font-normal normal-case tracking-normal text-white outline-none focus:border-[#E0FE10]/60" />
          </label>}
          {!sent && <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Phone number
            <div className="relative"><span aria-hidden="true" className="absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-base font-normal tracking-normal text-zinc-400">+1</span>
            <input type="tel" aria-label="Phone number" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent || busy}
              placeholder="(202) 555-0123" className="pl-12 mt-2 min-h-[52px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base font-normal normal-case tracking-normal text-white outline-none focus:border-[#E0FE10]/60" /></div>
          </label>}
          {!sent && mode === 'register' && <label className="flex items-start gap-2 text-xs text-zinc-300">
            <input type="checkbox" checked={acceptTerms} disabled={busy || sent} onChange={(e) => setAcceptTerms(e.target.checked)} />
            <span>I agree to the <a href="/terms" target="_blank" rel="noreferrer" className="underline">Terms</a> and <a href="/privacy" target="_blank" rel="noreferrer" className="underline">Privacy Policy</a>.</span>
          </label>}
          <div ref={container} />
          {sent && <>
            <p role="status" className="text-xs text-zinc-300">Enter the code sent via text to +1 {phone}.</p>
            <label className="block">Verification code
              <input inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="mt-2 min-h-[52px] w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base font-normal normal-case tracking-normal text-white outline-none focus:border-[#E0FE10]/60" />
            </label>
          </>}
          {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
          {existingAccount && <a className="block text-xs underline" href={`/PulseCheck/login?phoneSetup=1&email=${encodeURIComponent(institutionalEmail)}`}>Connect your existing account without a password</a>}
          <button type="button" onClick={sent ? confirm : send} disabled={busy || disabled || (sent && code.length !== 6)}
            className="min-h-[52px] w-full rounded-2xl bg-gradient-to-br from-[#E0FE10] to-[#A6C900] px-4 py-3 text-base font-semibold text-black shadow-[0_8px_28px_rgba(224,254,16,0.14)] transition hover:brightness-110 disabled:opacity-50">
            {busy ? 'Please wait…' : sent ? (mode === 'link' ? 'Verify and connect' : 'Continue') : mode === 'register' ? 'Sign up' : mode === 'link' ? 'Connect phone number' : 'Log in'}
          </button>
          {sent && <button type="button" disabled={busy || remaining > 0} onClick={send} className="mr-4 text-xs disabled:opacity-50">
            {remaining ? `Resend in ${remaining}s` : 'Resend code'}
          </button>}
          {(mode === 'link' || sent) && <button type="button" disabled={busy} className="text-xs text-zinc-400" onClick={() => {
            void attempt.current?.dispose(); attempt.current = undefined; setSent(false); setCode(''); setError(''); if (mode === 'link') setOpen(false);
          }}>{mode === 'link' ? 'Cancel' : 'Change number'}</button>}
          <p className="text-[11px] leading-4 text-zinc-500">We’ll text you a verification code. Message and data rates may apply. Google processes your number to prevent abuse.</p>
        </div>
      )}
    </div>
  );
}
