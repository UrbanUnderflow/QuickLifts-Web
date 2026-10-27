import Head from 'next/head';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import styles from './PublicCoachJoin.module.css';

type Program = {
  organization: { id: string; name: string; productBrand: string };
  teams: { id: string; name: string }[];
};

export default function PublicCoachJoin({ organization }: { organization: string }) {
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const request = useRef<{ details: string; id: string } | null>(null);
  const endpoint = '/api/pulsecheck/coach-survey/public';

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    setLoading(true);
    setError('');
    fetch(`${endpoint}?organization=${encodeURIComponent(organization)}`, {
      cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We could not load the teams. Please try again.');
      setProgram(data);
    }).catch(() => {
      if (!controller.signal.aborted || !document.hidden) setError('We could not load the teams. Check your connection and try again.');
    }).finally(() => { window.clearTimeout(timeout); setLoading(false); });
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [organization, attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const values = {
      organization,
      email: String(form.get('email') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      teamId: String(form.get('teamId') || ''),
      accountConsent: form.get('accountConsent') === 'on',
    };
    const details = JSON.stringify(values);
    if (request.current?.details !== details) request.current = { details, id: crypto.randomUUID() };
    setSaving(true);
    setError('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, requestId: request.current.id }),
        cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'We could not continue. Please try again.');
      if (typeof result.path !== 'string' || !result.path.startsWith('/PulseCheck/coach-survey/baseline#token=')) {
        throw new Error('We could not open your baseline. Please try again.');
      }
      window.location.assign(result.path);
    } catch (reason) {
      setError(reason instanceof Error && reason.name !== 'AbortError' ? reason.message : 'This is taking longer than expected. Please try again.');
      setSaving(false);
    } finally { window.clearTimeout(timeout); }
  }

  const brand = program?.organization.productBrand === 'athleticmind' ? 'The Athletic Mind' : program ? 'PulseCheck' : '';
  return <>
    <Head><title>UMES coach baseline</title><meta name="robots" content="noindex,nofollow" /><meta name="referrer" content="no-referrer" /></Head>
    <main className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.header}><span className={styles.brand}>{brand || 'UMES'}</span><span>Coach baseline</span></header>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>University of Maryland Eastern Shore</p>
          <h1>Start with your team.</h1>
          <p>Tell us where you coach, then complete your baseline.</p>
        </section>
        {loading ? <p role="status" className={styles.status}>Loading your teams…</p> : program ?
          <form className={styles.card} onSubmit={submit} aria-busy={saving}>
            <h2>Your details</h2>
            <fieldset disabled={saving}>
              <label htmlFor="coach-email">Institutional email</label>
              <input id="coach-email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@umes.edu" pattern={String.raw`[^@\s]+@[Uu][Mm][Ee][Ss]\.[Ee][Dd][Uu]`} title="Use your UMES institutional email address ending in @umes.edu." required maxLength={254} aria-describedby="email-hint" />
              <p id="email-hint" className={styles.hint}>Use your @umes.edu email address.</p>
              <label htmlFor="coach-phone">Phone number</label>
              <input id="coach-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={30} aria-describedby="phone-hint" />
              <p id="phone-hint" className={styles.hint}>Providing your number does not sign you up for text messages.</p>
              <label htmlFor="coach-team">Your team</label>
              <select id="coach-team" name="teamId" required defaultValue=""><option value="" disabled>Select your team</option>{program.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
              <label className={styles.consent}><input type="checkbox" name="accountConsent" required /><span>Create or connect my PulseCheck account and record my selected team at {program.organization.name}.</span></label>
              <p className={styles.hint}>Complete your baseline now. Team access requires confirmation.</p>
              {error && <p role="alert" className={styles.error}>{error}</p>}
              <button type="submit" disabled={!program.teams.length}>{saving ? 'Opening your baseline…' : 'Continue to baseline'}<span aria-hidden="true"> →</span></button>
              {!program.teams.length && <p role="status">No teams are available yet. Please ask your program contact for help.</p>}
            </fieldset>
          </form> : <div className={styles.card}><p role="alert" className={styles.error}>{error}</p><button onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
        <footer className={styles.footer}>UMES · Coach onboarding</footer>
      </div>
    </main>
  </>;
}
