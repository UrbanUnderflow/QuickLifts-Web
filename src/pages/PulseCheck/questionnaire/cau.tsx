import Head from 'next/head';
import React, { useEffect, useRef, useState } from 'react';
import source from '../../../content/questionnaires/cau-operational.json';

// Preserve source items; the user requested name and email in place of onboarding ID.
const allQuestions = source.questions.filter(q => q.id !== 'cau-operational-04');
export function getServerSideProps({ res }: any) {
  res.setHeader('Cache-Control', 'no-store');
  return { props: { collectionEnabled: false } };
}
export default function CAUQuestionnaire({ collectionEnabled }: { collectionEnabled: boolean }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [invite, setInvite] = useState('');
  const submissionId = useRef('');
  useEffect(() => { submissionId.current = crypto.randomUUID(); setInvite(new URLSearchParams(window.location.hash.slice(1)).get('invite') || ''); window.history.replaceState(null, '', window.location.pathname); }, []);
  const [started, setStarted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [track, setTrack] = useState<'performance' | 'health' | null>(null);
  const [completed, setCompleted] = useState({ performance: false, health: false });
  const [positions, setPositions] = useState({ performance: 0, health: 0 });
  const isHealth = (q: typeof allQuestions[number]) => {
    const n = Number(q.id.split('-').pop());
    return (n >= 14 && n <= 32) || (n >= 41 && n <= 51) || n === 62;
  };
  const questions = allQuestions.filter(q => track === 'health' ? isHealth(q) : !isHealth(q));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const q = questions[index];
  const value = q && answers[q.id];
  useEffect(() => () => clearTimeout(timer.current), []);
  const move = (next: number) => {
    clearTimeout(timer.current); setError('');
    if (!track) return;
    if (next >= questions.length) { setCompleted(old => ({ ...old, [track]: true })); setPositions(old => ({ ...old, [track]: 0 })); setTrack(null); setIndex(0); }
    else { setIndex(next); setPositions(old => ({ ...old, [track]: next })); }
    window.scrollTo({ top: 0 });
  };
  const openTrack = (next: 'performance' | 'health') => { clearTimeout(timer.current); setError(''); setTrack(next); setIndex(positions[next]); window.scrollTo({ top: 0 }); };
  function choose(option: string) {
    clearTimeout(timer.current);
    const previous = Array.isArray(value) ? value : [];
    const selected = previous.includes(option);
    const exclusive = q.exclusiveChoices as string[];
    const next = selected ? previous.filter(v => v !== option) : exclusive.includes(option) ? [option] : [...previous.filter(v => !exclusive.includes(v)), option];
    if (q.type === 'multi_select' && q.maxSelections && next.length > q.maxSelections) { setError(`Choose up to ${q.maxSelections} answers.`); return; }
    setError('');
    setAnswers(old => ({ ...old, [q.id]: q.type === 'multi_select' ? next : option }));
    if (q.type !== 'multi_select' && (!q.requiresConfirmation || option === 'Yes')) timer.current = setTimeout(() => move(index + 1), 450);
  }
  async function submit() {
    if (saving || saved || !completed.health || !completed.performance) return;
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/pulsecheck/questionnaire/cau', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${invite}` }, body: JSON.stringify({ submissionId: submissionId.current, name, email, answers, completedSections: completed }) });
      const result = await response.json();
      if (!response.ok || !result.saved) throw Error(result.error || 'Unable to save answers.');
      setSaved(true); setAnswers({}); setName(''); setEmail('');
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  const card = { padding: '18px', borderRadius: 16, border: '1px solid #424641', background: '#20251f', color: '#fff', textAlign: 'left' as const, fontSize: 17, width: '100%' };
  return <main style={{ minHeight: '100vh', background: '#11160f', color: '#f7f8f5', padding: '32px 20px', fontFamily: 'system-ui, sans-serif' }}>
    <Head><title>CAU baseline questionnaire</title><meta name="robots" content="noindex,nofollow" /><meta name="referrer" content="no-referrer" /></Head>
    <div style={{ maxWidth: 620, margin: '0 auto', display: 'grid', gap: 20 }}>
      <p style={{ letterSpacing: 2, fontSize: 12 }}>PULSECHECK · CAU</p>
      <p role="status" style={{ color: '#d5dbce' }}>{collectionEnabled ? 'Mental Health answers will go directly to auntEDNA. PulseCheck will keep performance answers and restricted references to the auntEDNA records.' : 'Preview. Saving is paused until the direct auntEDNA connection is ready. Keep real personal information out of this preview.'}</p>
      {saved ? <><h1>Your answers are saved.</h1><p>Thank you for sharing your starting point.</p></> : !started ? <form onSubmit={e => { e.preventDefault(); if (!name.trim()) return; setStarted(true); }} style={{ display: 'grid', gap: 20 }}>
        <h1>Hey, I’m Nora. Let’s start with you.</h1>
        <p>These questions help us understand how you’re feeling and where you’d like support. Answer from where you are today. We’ll take it one step at a time.</p>
        <label>Your name<input required maxLength={150} autoComplete="name" value={name} onChange={e => setName(e.target.value)} style={card} /></label>
        <label>Email address<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={card} /></label>
        <button style={{ ...card, background: '#d9f764', color: '#17200b', textAlign: 'center' }}>Begin</button>
      </form> : track && q ? <>
        <button onClick={() => { clearTimeout(timer.current); setTrack(null); }} style={card}>Back to sections</button>
        <progress aria-label="Questionnaire progress" value={index} max={questions.length} style={{ width: '100%', accentColor: '#d9f764' }} />
        <p>{index + 1} of {questions.length} · {q.sectionTitle}</p>
        {q.instructions && <details><summary>Question context and privacy</summary><p style={{ whiteSpace: 'pre-line' }}>{q.instructions}</p></details>}
        <h1 style={{ fontSize: 28 }}>{q.question}</h1>
        {q.type === 'multi_select' && <p>Choose all that fit{q.maxSelections ? `, up to ${q.maxSelections}` : ''}.</p>}
        {q.choices.length ? q.choices.map(option => {
          const selected = Array.isArray(value) ? value.includes(option) : value === option;
          return <button key={option} aria-pressed={selected} onClick={() => choose(option)} style={{ ...card, borderColor: selected ? '#d9f764' : '#424641' }}>{selected ? '✓ ' : ''}{option}</button>;
        }) : q.type === 'date' ? <>
          {[0, -1].map(offset => { const date = new Date(); date.setDate(date.getDate() + offset); const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return <button key={offset} style={card} aria-pressed={value === dateValue} onClick={() => setAnswers(old => ({ ...old, [q.id]: dateValue }))}>{offset === 0 ? 'Today' : 'Yesterday'} · {date.toLocaleDateString()}</button>; })}
          <label>Choose a date<input type="date" value={typeof value === 'string' ? value : ''} onChange={e => setAnswers(old => ({ ...old, [q.id]: e.target.value }))} style={card} /></label>
        </> : <label>Your answer<textarea maxLength={4000} rows={4} value={typeof value === 'string' ? value : ''} onChange={e => setAnswers(old => ({ ...old, [q.id]: e.target.value }))} style={card} /></label>}
        {error && <p role="alert">{error}</p>}
        <div style={{ display: 'flex', gap: 12 }}><button disabled={index === 0} onClick={() => move(index - 1)} style={card}>Back</button><button onClick={() => move(index + 1)} style={{ ...card, background: '#d9f764', color: '#17200b' }}>Continue</button></div>
      </> : <>
        <h1>Your starting point</h1>
        <p>Choose either section to begin. Finish both, then submit your answers.</p>
        <details><summary>Before you begin: privacy and questionnaire context</summary><p style={{ whiteSpace: 'pre-line' }}>{source.questions[0].instructions}</p></details>
        {(['performance', 'health'] as const).map(section => <button key={section} style={{ ...card, borderColor: completed[section] ? '#d9f764' : '#424641' }} onClick={() => openTrack(section)}>
          <strong>{completed[section] ? '✓ ' : ''}{section === 'health' ? 'Mental Health' : 'Mental Performance'}</strong>
          <p style={{ fontSize: 14 }}>{section === 'health' ? 'Well-being, stress, sleep, and support.' : 'Your setup, readiness, and platform experience.'}</p>
          <span>{completed[section] ? 'Complete · review answers' : positions[section] > 0 ? 'In progress · continue' : 'Still to do'}</span>
        </button>)}
        <p>{Number(completed.performance) + Number(completed.health)} of 2 sections complete. Answers are saved when you submit both sections. Keep this page open until then.</p>
        {completed.health && completed.performance && <details><summary>Review all answers</summary>
        {allQuestions.map((question, i) => <section key={question.id}><h2 style={{ fontSize: 17 }}>{question.question}</h2><p>{Array.isArray(answers[question.id]) ? (answers[question.id] as string[]).join(', ') : answers[question.id] || 'Skipped'}</p><button onClick={() => { const section = isHealth(question) ? 'health' : 'performance'; const items = allQuestions.filter(item => isHealth(item) === isHealth(question)); setTrack(section); setIndex(items.findIndex(item => item.id === question.id)); }} style={card}>Edit answer</button></section>)}
        </details>}
        {error && <p role="alert">{error}</p>}
        <button disabled={!collectionEnabled || saving || !completed.health || !completed.performance} onClick={submit} style={{ ...card, background: '#d9f764', color: '#17200b' }}>{saving ? 'Saving…' : collectionEnabled ? 'Submit answers' : 'Preview: saving is unavailable'}</button>
      </>}
    </div>
  </main>;
}
