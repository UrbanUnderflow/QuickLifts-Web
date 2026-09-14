import React, { useEffect, useRef, useState } from 'react';
import { ActiveExercise } from '../../mentaltraining/ExercisePlayer';
import { requestLinearRuntime, saveLinearJournal, loadLinearJournal, type LinearRuntimeAssignment, type LinearUseOutcome } from '../../../api/firebase/dailyCurriculum/linearRuntimeClient';
const phaseLabel = { learn: 'Learn', practice: 'Practice', use_it: 'Use it' };
const transferPrompts: Record<string, string> = {
  reset: 'What interrupted you, what did you do next, and what helped you return to the next action?',
  noise_gate: 'What competed for your attention, which cue mattered, and how did you return to it?',
  brake_point: 'What stop or change cue did you notice, and what action did you take or hold back?',
  signal_window: 'Which visible cue supported your decision, what did you choose, and what remained unclear?',
  sequence_shift: 'What changed from your old assignment to the new one, and which instruction did you follow?',
  endurance_lock: 'What attention cue did you use early and later in practice, and what did you notice about following it?',
};
export default function LinearSkillFlow({ assignment, preview = false, onSaved }: {
  assignment: LinearRuntimeAssignment; preview?: boolean; onSaved: () => void;
}) {
  const [playing, setPlaying] = useState(false), [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0), [saving, setSaving] = useState(false), [saved, setSaved] = useState(false);
  const [error, setError] = useState(''), [outcome, setOutcome] = useState<LinearUseOutcome | null>(null);
  const [journal, setJournal] = useState(''), [journalSaved, setJournalSaved] = useState(false);
  const journalEdited = useRef(false);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState(''), [journalSaving, setJournalSaving] = useState(false);
  const pendingCompletion = useRef(false);
  const exercise = assignment.contentSnapshot;
  const transferPrompt = transferPrompts[exercise?.buildArtifact?.engineKey || (exercise?.id === 'focus-3-second-reset' ? 'reset' : '')] || 'When did you try the technique, what did you do, and what did you notice?';
  const authoredMinutes = Number(exercise?.durationMinutes);
  const duration = (Number.isFinite(authoredMinutes) && authoredMinutes > 0 ? authoredMinutes : 3) * 60;
  const independent = assignment.skillType === 'protocol' && assignment.phase === 'practice';
  const hasEngine = !!exercise?.buildArtifact?.engineKey || exercise?.exerciseConfig?.type === 'focus' && (exercise.exerciseConfig.config as { type?: string }).type === 'reset';
  const available = assignment.clientContractVersion === 1 && !!exercise?.exerciseConfig && (assignment.skillType === 'protocol' || hasEngine);
  useEffect(() => {
    if (!playing || paused) return;
    const timer = window.setInterval(() => setElapsed(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [playing, paused]);
  const saveJournal = async () => {
    setJournalSaving(true); setJournalError('');
    try { if (!preview) await saveLinearJournal(assignment.id, journal); setJournalSaved(true); }
    catch (err) { setJournalError(err instanceof Error ? err.message : 'Your private journal was not saved.'); }
    finally { setJournalSaving(false); }
  };
  useEffect(() => {
    if (preview || assignment.phase !== 'use_it') return;
    let live = true; setJournalLoading(true);
    loadLinearJournal(assignment.id).then(text => { if (live && !journalEdited.current) { setJournal(text); setJournalSaved(!!text); } }).catch(err => { if (live) setJournalError(err instanceof Error ? err.message : 'Saved journal unavailable.'); }).finally(() => { if (live) setJournalLoading(false); });
    return () => { live = false; };
  }, [assignment.id, assignment.phase, preview]);
  const start = async () => {
    setSaving(true); setError('');
    try { if (!preview) await requestLinearRuntime({ action: 'start', assignmentId: assignment.id }); setPlaying(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not start.'); }
    finally { setSaving(false); }
  };
  const complete = async () => {
    setPlaying(false); pendingCompletion.current = true; setSaving(true); setError('');
    try {
      if (!preview && assignment.phase === 'use_it') await requestLinearRuntime({ action: 'start', assignmentId: assignment.id });
      if (!preview) await requestLinearRuntime({ action: 'complete', assignmentId: assignment.id, ...(assignment.phase === 'use_it' && outcome ? { outcome } : {}) });
      pendingCompletion.current = false; setSaved(true); if (!preview && assignment.phase !== 'use_it') onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save.'); }
    finally { setSaving(false); }
  };
  return <section className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-white/15 bg-zinc-950 p-6 text-white">
    {preview && <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">Local preview. Activity stays in this page and is never saved to an athlete record.</p>}
    <header><p className="text-sm text-zinc-400">{phaseLabel[assignment.phase]}</p><h1 className="mt-1 text-3xl font-semibold">{assignment.skillName}</h1>
      <p className="mt-3 text-sm text-zinc-300">{assignment.completedDayCount} of {assignment.requiredDays} completed days in this phase. Window ends {assignment.windowEnd}.</p></header>
    {!available ? <p role="alert">This skill needs an updated player before it can open. Your progress is preserved.</p> : saved ? <p role="status">{preview ? 'Preview finished. No activity was saved.' : outcome && outcome !== 'used' ? 'Your response is recorded. Try using the skill when an opportunity comes up.' : 'Saved for today.'}</p> : assignment.phaseCompletedToday ? <p role="status">You have completed today’s phase activity. Come back on another day to continue.</p> : assignment.phase === 'use_it' ? <div className="space-y-4">
      <p>Try this skill in a real practice or competition moment. Afterward, record what happened.</p>
      <p className="text-sm text-zinc-300">{transferPrompt} Writing is optional.</p>
      <fieldset className="space-y-2"><legend className="mb-2 font-medium">Did you use it?</legend>{([['used', 'Used it'], ['forgot', 'Forgot'], ['no_chance', 'No chance']] as const).map(([value, label]) => <label key={value} className="flex items-center gap-3 rounded-lg border border-white/20 p-3"><input type="radio" name="skill-use" value={value} checked={outcome === value} onChange={() => setOutcome(value)} />{label}</label>)}</fieldset>
      <p className="text-xs text-zinc-400">All choices are recorded honestly. A day when you used the skill counts toward this phase. Your practice progress stays separate.</p>
      <button disabled={!outcome || saving} onClick={() => void complete()} className="rounded-lg bg-white px-5 py-3 font-semibold text-zinc-950 disabled:opacity-40">{saving ? 'Saving…' : 'Save response'}</button>
    </div> : playing ? independent ? <div className="space-y-5 text-center"><h2 className="text-xl font-medium">Practice the technique on your own</h2><p className="text-zinc-300">Use what you learned. Move at a comfortable pace and pause when you need to.</p><p className="text-4xl tabular-nums">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</p><button onClick={() => setPaused(value => !value)} className="rounded-lg border border-white/30 px-5 py-3">{paused ? 'Resume' : 'Pause'}</button><button disabled={elapsed < duration || saving} onClick={() => void complete()} className="ml-3 rounded-lg bg-white px-5 py-3 text-zinc-950 disabled:opacity-40">Finish practice</button></div> : <ActiveExercise exercise={exercise} isPaused={paused} elapsedSeconds={elapsed} categoryColor="from-teal-500 to-cyan-500" onPause={() => setPaused(true)} onResume={() => setPaused(false)} onClose={() => setPlaying(false)} onComplete={() => void complete()} soundEnabled={false} previewMode allowConversationPractice={false} /> : <div className="space-y-4"><p>{assignment.phase === 'learn' ? 'Follow the guided technique and get familiar with its steps.' : independent ? 'Practice the same technique on your own, using what you learned.' : 'Practice the task, then look at its task-specific feedback.'}</p><button disabled={saving} onClick={() => void start()} className="rounded-lg bg-white px-5 py-3 font-semibold text-zinc-950 disabled:opacity-40">{saving ? 'Opening…' : `Start ${phaseLabel[assignment.phase].toLowerCase()}`}</button></div>}
    {available && assignment.phase === 'use_it' && <div className="space-y-3 border-t border-white/15 pt-5">
      <label htmlFor="private-use-journal" className="block font-medium">Private journal (optional)</label>
      <p className="text-sm text-zinc-300">Write about the moment, what you tried, and what you noticed. Your writing stays separate from the phase response and module metrics.</p>
      <textarea id="private-use-journal" value={journal} disabled={journalSaving || journalLoading} maxLength={4000} rows={4} onChange={event => { journalEdited.current = true; setJournal(event.target.value); setJournalSaved(false); }} className="w-full rounded-lg border border-white/25 bg-zinc-900 p-3 text-white" aria-describedby="private-journal-status" />
      <p id="private-journal-status" className="text-xs text-zinc-400">{journalLoading ? 'Loading saved journal…' : `${journal.length} / 4,000 characters.`} {preview ? 'Preview writing stays on this page only.' : journalSaved ? 'Private journal saved.' : 'Changes stay on this page until you save the journal.'}</p>
      <button type="button" disabled={!journal.trim() || journalSaving || journalSaved} onClick={() => void saveJournal()} className="rounded-lg border border-white/30 px-4 py-2 disabled:opacity-40">{journalSaving ? 'Saving journal…' : journalSaved ? preview ? 'Journal kept in preview' : 'Journal saved' : journalError ? 'Retry journal save' : 'Save private journal'}</button>
      {journalError && <p role="alert" className="text-sm text-rose-200">{journalError} Your writing is still here.</p>}
      {saved && <button type="button" disabled={journalSaving || (!!journal.trim() && !journalSaved)} onClick={onSaved} className="ml-3 text-sm underline disabled:opacity-40">Refresh skill plan</button>}
    </div>}
    {error && <div role="alert" className="space-y-2 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-rose-100"><p>{error}</p>{pendingCompletion.current && <button disabled={saving} onClick={() => void complete()} className="underline">Retry save</button>}</div>}
  </section>;
}
