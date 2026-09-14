import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import dynamic from 'next/dynamic';
import { SEEDED_EXERCISES } from '../../api/firebase/mentaltraining/exerciseLibraryService';
import type { LinearRuntimeAssignment } from '../../api/firebase/dailyCurriculum/linearRuntimeClient';
const Flow = dynamic(() => import('../../components/pulsecheck/linear/LinearSkillFlow'), { ssr: false });
export const getServerSideProps: GetServerSideProps = async () => process.env.NODE_ENV === 'development' ? { props: {} } : { notFound: true };
export default function LinearPreview() {
  const [kind, setKind] = useState<'protocol' | 'simulation'>('protocol');
  const [phase, setPhase] = useState<LinearRuntimeAssignment['phase']>('learn');
  const exercise = SEEDED_EXERCISES.find(item => item.id === (kind === 'protocol' ? 'breathing-478' : 'focus-3-second-reset'))!;
  const assignment: LinearRuntimeAssignment = { id: `fixture-${kind}-${phase}`, versionId: 'local-preview', skillId: exercise.id, skillName: exercise.name, skillType: kind, phase, sourceDate: '2026-09-13', timezone: 'America/New_York', windowStart: '2026-09-13', windowEnd: '2026-09-26', completedDayCount: 0, requiredDays: 5, phaseCompletedToday: false, contentSnapshot: exercise, clientContractVersion: 1 };
  return <main className="min-h-screen space-y-5 bg-zinc-950 p-6 text-white"><h1 className="text-xl">Local skill journey preview</h1><div className="flex flex-wrap gap-3">{(['protocol', 'simulation'] as const).map(value => <button key={value} aria-pressed={kind === value} className="rounded border border-white/30 p-3 capitalize" onClick={() => { setKind(value); setPhase(value === 'protocol' ? 'learn' : 'practice'); }}>{value} journey</button>)}</div><div className="flex gap-3">{(kind === 'protocol' ? ['learn', 'practice', 'use_it'] as const : ['practice', 'use_it'] as const).map(value => <button key={value} aria-pressed={phase === value} className="rounded border border-white/30 p-3" onClick={() => setPhase(value)}>{value === 'use_it' ? 'Use it' : value === 'learn' ? 'Learn' : 'Practice'}</button>)}</div><Flow key={assignment.id} assignment={assignment} preview onSaved={() => {}} /></main>;
}
