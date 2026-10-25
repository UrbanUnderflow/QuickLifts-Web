import { cadenceLabel } from '../../lib/coachSurveys/cadence';
import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { commentFor, VERSION, questionsFor, type Answer, type SurveyKind } from '../../lib/coachSurveys/questionnaire';
import styles from './CoachSurvey.module.css';

export default function CoachSurvey({ kind, review }: { kind: SurveyKind; review: boolean }) {
  const [recallDays,setRecallDays] = useState(21);
  const items = questionsFor(kind,recallDays), periodic = kind === 'check-in';
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [comment, setComment] = useState('');
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'complete' | 'blocked'>(review ? 'ready' : 'loading');
  const [error, setError] = useState('');
  const token = useRef(''), busy = useRef(false), notice = useRef<HTMLDivElement>(null);
  const title = periodic ? 'Coach check-in' : 'Your coach baseline';
  const endpoint = `/api/pulsecheck/coach-survey/${kind}`;
  async function request(method: 'GET' | 'POST') {
    const response = await fetch(endpoint, {
      method, cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token.current}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      ...(method === 'POST' ? { body: JSON.stringify({ version: VERSION, answers, comment, otherText }) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'We could not confirm your response. Please try again.');
    return result;
  }
  async function check() {
    const requestToken = token.current;
    setState('loading'); setError('');
    try { const result = await request('GET'); if (requestToken === token.current) { setRecallDays(result.recallDays || 21); setState(result.completed ? 'complete' : 'ready'); } }
    catch (err) { if (requestToken === token.current) { setState('blocked'); setError((err as Error).message); } }
  }
  useEffect(() => {
    if (review) return;
    // Fragments are not sent in HTTP requests or referrers. Remove from browser
    // history immediately and retain only in memory, never in localStorage.
    const openLink = () => {
      const incoming = new URLSearchParams(window.location.hash.slice(1)).get('token');
      if (incoming && incoming !== token.current) { token.current = incoming; setAnswers({}); setOtherText({}); setComment(''); }
      if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
      if (!token.current) { setState('blocked'); setError('Open the complete survey link from your program contact.'); return; }
      void check();
    };
    openLink();
    window.addEventListener('hashchange', openLink);
    return () => window.removeEventListener('hashchange', openLink);
    // A page navigation to another kind remounts the standalone page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, review]);
  useEffect(() => { if (error || state === 'complete') notice.current?.focus(); }, [error, state]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy.current) return;
    if (items.some(q => q.multiple && (!Array.isArray(answers[q.id]) || answers[q.id].length === 0))) { setError('Choose at least one response for every question.'); return; }
    busy.current = true; setError(''); setState('saving');
    const requestToken = token.current;
    try {
      if (!review) await request('POST');
      if (requestToken === token.current) setState('complete');
    } catch (err) { if (requestToken === token.current) { setError((err as Error).message); setState('ready'); } }
    finally { busy.current = false; }
  }
  const count = items.filter(q => Array.isArray(answers[q.id]) ? answers[q.id].length > 0 : Boolean(answers[q.id])).length;
  function choose(id: string, value: string) {
    const q = items.find(item => item.id === id)!;
    if (!q.multiple) { setAnswers(previous => ({ ...previous, [id]: value })); return; }
    const previous = Array.isArray(answers[id]) ? answers[id] as string[] : [];
    const next = previous.includes(value) ? previous.filter(v => v !== value) : value === q.exclusive ? [value] : [...previous.filter(v => v !== q.exclusive), value];
    setAnswers(current => ({ ...current, [id]: next }));
    if (!next.includes('Other')) setOtherText(current => { const copy = { ...current }; delete copy[id]; return copy; });
  }
  return <>
    <Head><title>{title} | PulseCheck</title><meta name="robots" content="noindex,nofollow" /><meta name="referrer" content="no-referrer" /></Head>
    <main className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.brand}>PULSECHECK <span>COACH PERSPECTIVE</span></header>
        {review && <aside className={styles.review}><strong>Internal review</strong><br />{periodic ? 'Approved two-question direction. Answer choices and release setup remain reviewable; this is operational feedback, not Dr. T’s instrument.' : 'Approved six-question operational readiness baseline. This is not Dr. T’s source questionnaire.'} Review uses synthetic data only. Responses are not saved.</aside>}
        <p className={styles.eyebrow}>{periodic ? `EVERY ${cadenceLabel(recallDays).toUpperCase()} · 2 QUESTIONS` : 'INITIAL QUESTIONNAIRE · 6 QUESTIONS'}</p>
        <h1>{title}</h1>
        <p className={styles.intro}>{periodic ? 'Reflect on your own experience using AthleticMind with your team.' : 'Tell us about your current support process, your confidence starting conversations, and what you would like AthleticMind to help with.'}</p>
        {state === 'loading' && <p role="status">Checking your survey link…</p>}
        {state === 'blocked' && <div ref={notice} tabIndex={-1} className={styles.card}><p role="alert">{error}</p>{token.current && <button type="button" onClick={check}>Try again</button>}</div>}
        {state === 'complete' && <div ref={notice} tabIndex={-1} className={styles.card} role="status"><h2>{review ? 'Review complete' : 'Thank you. Your response is recorded.'}</h2><p>{review ? 'This was a local preview. No response was saved or sent.' : 'You can close this page. Your program contact will share your next check-in link.'}</p>{review && <button onClick={() => { setAnswers({}); setOtherText({}); setComment(''); setState('ready'); }}>Review again</button>}</div>}
        {(state === 'ready' || state === 'saving') && <form onSubmit={submit}>
          <div className={styles.guide}><strong>{periodic ? `Consider the past ${cadenceLabel(recallDays)}.` : 'Think about your current coaching experience.'}</strong><p>{periodic ? "Choose one response for each question, based on your own experience." : "Answer from your own experience. Some questions let you choose more than one response."}</p><p>Keep comments about the team environment. Leave out athlete names and private health information.</p></div>
          <div className={styles.progress} aria-live="polite">{count} of {items.length} questions answered<progress value={count} max={items.length} aria-label="Questions answered" /></div>
          {items.map((q, index) => <fieldset key={q.id} className={styles.question} disabled={state === 'saving'}>
            <legend><span>{String(index + 1).padStart(2, '0')}</span>{q.text}</legend>
            {q.multiple && <p className={styles.choiceHint}>{q.max ? `Choose up to ${q.max}.` : 'Choose all that apply.'}</p>}
            <div className={styles.choices}>{q.options.map(option => {
              const chosen = q.multiple ? (answers[q.id] || []).includes(option.value) : answers[q.id] === option.value;
              const atLimit = q.multiple && q.max && Array.isArray(answers[q.id]) && answers[q.id].length >= q.max && !chosen;
              return <label key={option.value} className={chosen ? styles.selected : ''}>
                <input type={q.multiple ? 'checkbox' : 'radio'} name={q.id} value={option.value} required={!q.multiple} disabled={Boolean(atLimit)} checked={chosen} onChange={() => choose(q.id, option.value)} />
                <span>{option.label}</span>
              </label>;
            })}</div>
            {q.multiple && (answers[q.id] || []).includes('Other') && <label className={styles.other}>Other (optional). Leave out names and private health details.<input type="text" maxLength={300} value={otherText[q.id] || ''} onChange={e => setOtherText(current => ({ ...current, [q.id]: e.target.value }))} /></label>}

          </fieldset>)}
          <div className={styles.card}><label htmlFor="coach-comment"><strong>{commentFor(kind)} (optional)</strong><p>Share any thoughts you would like us to hear. Please leave out athlete names and private health details.</p></label><textarea id="coach-comment" value={comment} maxLength={1000} rows={4} disabled={state === 'saving'} onChange={e => setComment(e.target.value)} aria-describedby="comment-limit" /><small id="comment-limit">{comment.length}/1,000 characters</small></div>
          {error && <div ref={notice} tabIndex={-1} role="alert" className={styles.error}>{error} Your answers remain on this page.</div>}
          <div className={styles.finish}><p>Check your answers before submitting. Each survey link records one response.</p><button type="submit" disabled={state === 'saving'}>{state === 'saving' ? 'Submitting…' : review ? 'Finish review' : 'Submit response'}</button></div>
        </form>}
        <footer>PulseCheck · Coach support environment</footer>
      </div>
    </main>
  </>;
}
