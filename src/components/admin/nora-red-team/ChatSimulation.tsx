import MealActionCard from './MealActionCard';
import PracticeActionCards from './PracticeActionCards';
import { offersMealLog } from '../../../lib/nora-red-team/chatActions';
import ChatMarkdown from './ChatMarkdown';
import React, { useEffect, useRef, useState } from 'react';
import type { SimulationMessage, SimulationReview } from '../../../lib/nora-red-team/chatSimulation';
import styles from './ChatSimulation.module.css';
type Result = { chatActions?: {id:string;type:string;label:string;exerciseId?:string}[]; runtimeEvidence?: { build: string; runtime: string }; reply: string; review: SimulationReview | null; reviewError: string | null };
export default function ChatSimulation({ send, retryReview, enableActions = false }: { enableActions?: boolean; send: (messages: SimulationMessage[]) => Promise<Result>; retryReview: (messages: SimulationMessage[], reply: string) => Promise<Result> }) {
  const [declinedMeals,setDeclinedMeals]=useState(false);
  const [actionResults,setActionResults]=useState<string[]>([]);
  const [messages, setMessages] = useState<SimulationMessage[]>([]);
  const [reviews, setReviews] = useState<Result[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState<number | null>(null);
  const [selected, setSelected] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !draft.trim() || reviews.length >= 16) return;
    const next: SimulationMessage[] = [...messages, { role: 'user', content: draft.trim() }];
    setBusy(true); setError('');
    try {
      const result = await send(next);
      setMessages([...next, { role: 'assistant', content: result.reply }]);
      setReviews([...reviews, result]); setSelected(reviews.length); setDraft('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Try again.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.root}>
    <header className={styles.header}><div><h2>Chat Simulation</h2><p>Uses the app’s Nora endpoint with synthetic development data. Each reply is reviewed separately.</p></div><button disabled={busy || retrying !== null || !messages.length} onClick={() => { setMessages([]); setReviews([]); setDraft(''); setError(''); setSelected(0); setDeclinedMeals(false); setActionResults([]); }}>New conversation</button></header>
    <p className={styles.notice}>Use fictional examples only. The app runtime uses temporary synthetic development records and suppresses external messages and clinical handoffs. Test records are cleaned up after each reply. The visible conversation stays in this page and is sent for replies and reviews. Scores are AI suggestions for human review.</p>
    <div className={styles.columns}>
      <div className={styles.chat}>
        <div className={styles.messages} aria-label="Simulation conversation" aria-live="polite">
          {!messages.length && <div className={styles.empty}><h3>Start with something an athlete might say</h3><p>Try a request, then follow up naturally to test whether Nora keeps track.</p>{['I rush my volleyball serve. Give me one mental cue.', 'My wearable says HRV is 45 milliseconds at 7 AM. Read it back.', 'Please help me find my account settings.'].map(s => <button key={s} onClick={() => setDraft(s)}>{s}</button>)}</div>}
          {messages.map((m, i) => <article key={i} className={m.role === 'user' ? styles.user : styles.assistant}><strong>{m.role === 'user' ? 'You' : `Nora · Reply ${Math.ceil(i / 2)}`}</strong>{m.role === 'assistant' ? <ChatMarkdown content={m.content}/> : <p>{m.content}</p>}{m.role === 'assistant' && <><button onClick={() => setSelected(Math.floor(i / 2))}>View review</button>{enableActions&&<><PracticeActionCards actions={reviews[Math.floor(i/2)]?.chatActions || []} onComplete={text=>setActionResults(previous=>[...previous,text])}/>{!declinedMeals&&reviews[Math.floor(i/2)]?.chatActions?.some(a=>a.type==='meal')&&<MealActionCard description={messages[i-1].content} onDecline={()=>setDeclinedMeals(true)} onSaved={text=>setActionResults(previous=>[...previous,text])}/>}</>}</>}</article>)}
          {busy && <p role="status">Nora is responding and the reviewer is checking the reply…</p>}{actionResults.map((text,i)=><p key={i} role="status">{text}</p>)}<div ref={end}/>
        </div>
        <form onSubmit={submit} className={styles.form}><label htmlFor="simulation-message">Your fictional athlete message</label><textarea id="simulation-message" value={draft} onChange={e => setDraft(e.target.value)} maxLength={4000} rows={3} disabled={busy || reviews.length >= 16} placeholder="Type your message…"/><div><small>{reviews.length}/16 turns · Enter adds a new line</small><button disabled={busy || !draft.trim() || reviews.length >= 16} type="submit">{busy ? 'Reviewing…' : 'Send'}</button></div>{error && <p role="alert">{error}</p>}{reviews.length >= 16 && <p>Start a new conversation to continue testing.</p>}</form>
      </div>
      <aside className={styles.log} aria-label="Response review log"><h3>Response review log</h3><p>Each score belongs to one reply. Privacy and usefulness need separate judgment.</p>{!reviews.length && <p>Your first review will appear here.</p>}{reviews.map((r, i) => <article key={i} className={selected === i ? styles.selected : styles.review}><button aria-expanded={selected === i} onClick={() => setSelected(i)}>Reply {i + 1} <strong>{r.review ? `${r.review.score}/10` : 'Unscored'}</strong></button>{selected === i && (r.review ? <>{r.runtimeEvidence && <p>App runtime verified. Build: {r.runtimeEvidence.build}. Native screen behavior needs device checks.</p>}<h4>Why this score</h4><p>{r.review.reason}</p><blockquote>{r.review.evidence}</blockquote><h4>How to improve</h4><p>{r.review.recommendation}</p><h4>Protection check</h4><p>{r.review.protectionConcern}</p></> : <div><p role="status">{r.reviewError}</p><button disabled={retrying !== null || busy} onClick={async () => {setRetrying(i); try {const result=await retryReview(messages.slice(0, i * 2 + 1), r.reply); setReviews(previous => previous.map((item,index)=>index===i?{...result,runtimeEvidence:item.runtimeEvidence,chatActions:item.chatActions}:item));} catch {setError('The review could not finish. Try again.');} finally {setRetrying(null);}}}>{retrying===i?'Reviewing…':'Retry review'}</button></div>)}</article>)}</aside>
    </div>
  </section>;
}
