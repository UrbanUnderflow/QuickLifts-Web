import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, X } from 'lucide-react';

type DashboardTrainingStep = { id: string; title: string; body: string; target?: string };

// The legacy narration describes older readiness and data-access behavior.
// Keep this tour text-led until narration matching these steps is recorded.
export const TRAINING_STEPS: DashboardTrainingStep[] = [
  { id: 'overview', title: 'A daily view of participation', target: '[data-nav="home"]', body: 'Overview brings check-in adherence, skill training and wearable coverage together. Connection and sync gaps are shown separately from missed activity.' },
  { id: 'athletes', title: 'Follow each athlete’s participation', target: '[data-nav="roster"]', body: 'Athletes shows your roster and participation across the three measures. Use it to support the routine and spot gaps in participation.' },
  { id: 'skills', title: 'What your team is learning', target: '[data-nav="skills"]', body: 'Skill training shows the skills athletes are actively learning and their current phases. The overview features the most common active skill.' },
  { id: 'messages', title: 'Keep team conversations together', target: '[data-nav="inbox"]', body: 'Messages is for direct athlete and staff conversations. Private Nora conversations and journal entries are not part of the coach participation view.' },
  { id: 'nora', title: 'Give Nora your team’s context', target: '[data-nav="nora"]', body: 'Train Nora holds your team’s files, schedules and notes. Upload a file, add a note or chat with Nora to maintain the knowledge library.' },
  { id: 'schedule', title: 'Plan around the team calendar', target: '[data-nav="schedule"]', body: 'Review the calendar, add an event or select Import schedule to use a published link. Scheduling-tool connections are arranged during team setup.' },
  { id: 'reports', title: 'Review team participation', target: '[data-nav="reports"]', body: 'Reports brings participation and available coverage together. Use the date range and source information to understand what each measure represents.' },
  { id: 'permissions', title: 'Access follows each person’s role', body: 'Coaches see participation. Authorized trainers can see aggregate mood, recovery, wearable signals and journaling activity when athletes opt in for that team. Private chat and journal contents stay private. Summaries require at least five contributors.' },
];

export default function NoraDashboardTraining({ onComplete }: { onComplete?: () => void }) {
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const step = TRAINING_STEPS[index];
  useEffect(() => {
    if (dismissed || !step.target) return;
    const element = document.querySelector<HTMLElement>(step.target);
    // Only navigate to a tab the current role can actually access.
    if (!element || element.hasAttribute('disabled')) return;
    element.click();
    element.classList.add('clay-tour-highlight');
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return () => element.classList.remove('clay-tour-highlight');
  }, [step, dismissed]);
  const close = () => { setDismissed(true); onComplete?.(); };
  if (dismissed) return null;
  const last = index === TRAINING_STEPS.length - 1;
  return <>
    <style>{`.clay-tour-highlight { outline: 2px solid #527565 !important; outline-offset: 3px; }`}</style>
    <section aria-label="Dashboard tour" className="fixed bottom-20 right-4 z-[60] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[#dbe3d8] bg-white p-5 text-[#24382e] shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest">Nora · Dashboard tour</p>
        <button type="button" aria-label="Close dashboard tour" onClick={close} className="rounded-lg p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#527565]"><X size={18} /></button>
      </div>
      <div aria-live="polite" aria-atomic="true">
        <h3 className="mt-3 text-xl" style={{ fontFamily: 'Georgia, serif' }}>{step.title}</h3>
        <p className="mt-3 text-sm leading-6 text-[#53655b]">{step.body}</p>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" disabled={index === 0} onClick={() => setIndex(current => current - 1)} className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm disabled:opacity-35"><ArrowLeft size={15} /> Back</button>
        <span className="text-xs text-[#53655b]">{index + 1} of {TRAINING_STEPS.length}</span>
        <button type="button" onClick={() => last ? close() : setIndex(current => current + 1)} className="flex items-center gap-1 rounded-xl bg-[#d7f126] px-4 py-2 text-sm font-semibold">{last ? 'Finish' : 'Next'}{last ? <Check size={16} /> : <ChevronRight size={16} />}</button>
      </div>
    </section>
  </>;
}
