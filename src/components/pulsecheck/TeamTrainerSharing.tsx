import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseModeRequestHeaders } from '../../api/firebase/config';
import { TRAINER_SHARING_FIELDS, TRAINER_SHARING_TEXT, TRAINER_SHARING_VERSION, type TrainerSharingChoices } from '../../lib/coach-dashboard/types';
import styles from './TeamTrainerSharing.module.css';

type Team = { teamId: string; displayName: string; choices: TrainerSharingChoices; updatedAt?: string | null };
const EMPTY: TrainerSharingChoices = { mood: false, recovery: false, wearables: false, journaling: false };
const labels: Record<keyof TrainerSharingChoices, { title: string; detail: string }> = {
  mood: { title: 'Team mood', detail: 'Your reported check-in mood contributes to a team summary.' },
  recovery: { title: 'Self-reported recovery', detail: 'Recovery responses from your check-ins contribute to a team summary.' },
  wearables: { title: 'Wearable recovery signals', detail: 'Sleep duration and resting heart rate from your connected sources.' },
  journaling: { title: 'Journaling activity', detail: 'Activity counts only. Your journal entry text stays private.' },
};
const normalize = (value?: Partial<TrainerSharingChoices>): TrainerSharingChoices => ({
  mood: value?.mood === true, recovery: value?.recovery === true,
  wearables: value?.wearables === true, journaling: value?.journaling === true,
});

export default function TeamTrainerSharing({ user }: { user: User }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState('');
  const [choices, setChoices] = useState<TrainerSharingChoices>({ ...EMPTY });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setTeams([]); setTeamId(''); setChoices({ ...EMPTY });
    void (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/coach/trainer-sharing', { headers: { Authorization: `Bearer ${token}`, ...getFirebaseModeRequestHeaders() }, signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Your sharing choices could not be loaded. Please try again.');
        const body = await response.json();
        if (controller.signal.aborted) return;
        const next: Team[] = (body.teams || []).map((team: Team) => ({ ...team, choices: normalize(team.choices) }));
        setTeams(next); setTeamId(next[0]?.teamId || ''); setChoices(next[0]?.choices || { ...EMPTY });
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load sharing choices.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [user, retry]);
  const selected = teams.find(team => team.teamId === teamId);
  const dirty = Boolean(selected && TRAINER_SHARING_FIELDS.some(key => choices[key] !== selected.choices[key]));
  const save = async () => {
    if (!selected || saving) return;
    setSaving(true); setError(''); setNotice('');
    const submitted = { ...choices };
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/coach/trainer-sharing', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...getFirebaseModeRequestHeaders() },
        body: JSON.stringify({ teamId, version: TRAINER_SHARING_VERSION, choices: submitted }),
      });
      if (!response.ok) throw new Error('Your choices were not saved. Please try again.');
      const body = await response.json();
      if (body.saved !== true) throw new Error('Your choices were not confirmed. Please try again.');
      const saved = normalize(body.choices);
      setTeams(current => current.map(team => team.teamId === teamId ? { ...team, choices: saved } : team));
      setChoices(saved); setNotice(`Sharing choices saved for ${selected.displayName}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your choices were not saved.'); }
    finally { setSaving(false); }
  };
  return <section className={styles.panel} aria-labelledby="sharing-title">
    <p className={styles.eyebrow}>Your privacy</p>
    <h1 id="sharing-title">Team trainer sharing</h1>
    <p className={styles.explanation}>{TRAINER_SHARING_TEXT}</p>
    {loading ? <p role="status">Loading your teams and sharing choices…</p> : <>
      {error && <div role="alert" className={styles.error}>{error}{teams.length === 0 && <button onClick={() => setRetry(value => value + 1)}>Try again</button>}</div>}
      {!error && teams.length === 0 && <p>You do not have an active athlete team membership. Team sharing choices will appear when you join a team.</p>}
      {selected && <form onSubmit={event => { event.preventDefault(); void save(); }}>
        <label className={styles.teamLabel} htmlFor="sharing-team">Team</label>
        <select id="sharing-team" value={teamId} disabled={saving} onChange={event => {
          const team = teams.find(item => item.teamId === event.target.value);
          setTeamId(event.target.value); setChoices(team?.choices || { ...EMPTY }); setNotice(''); setError('');
        }}>{teams.map(team => <option key={team.teamId} value={team.teamId}>{team.displayName}</option>)}</select>
        <p className={styles.help}>Sharing starts on by default for each team. Turn off any category you do not want to share, then save your choices.</p>
        <fieldset disabled={saving}>
          <legend className={styles.legend}>Include in trainer team summaries</legend>
          {TRAINER_SHARING_FIELDS.map(key => <label className={styles.choice} key={key}>
            <span><strong>{labels[key].title}</strong><span className={styles.detail}>{labels[key].detail}</span></span>
            <input type="checkbox" checked={choices[key]} onChange={event => { setChoices(current => ({ ...current, [key]: event.target.checked })); setNotice(''); }} />
          </label>)}
        </fieldset>
        <div className={styles.actions}>
          <button className={styles.save} type="submit" disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save choices'}</button>
          <button type="button" disabled={saving || !TRAINER_SHARING_FIELDS.some(key => choices[key])} onClick={() => { setChoices({ ...EMPTY }); setNotice('All choices are off. Save choices to stop sharing.'); }}>Turn all off</button>
        </div>
        {dirty && <p className={styles.help}>You have unsaved changes.</p>}
        <p role="status" aria-live="polite">{notice}</p>
      </form>}
    </>}
  </section>;
}
