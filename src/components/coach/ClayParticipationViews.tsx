import React, { useMemo, useState, useId, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { LinearRuntimeAssignment } from '../../api/firebase/dailyCurriculum/linearRuntimeClient';
import { createPortal } from 'react-dom';
import { ArrowRight, Search, Users, Activity, BookOpen, Watch, ChevronLeft } from 'lucide-react';
import type { CoverageMetric, ParticipationAthlete, TeamParticipation, TeamWellbeing, WellbeingCard } from '../../lib/coach-dashboard/types';
import s from './ClayParticipationViews.module.css';
import { rankParticipation } from '../../lib/coach-dashboard/participationRanking';

const SkillPreviewFlow = dynamic(() => import('../pulsecheck/linear/LinearSkillFlow'), {ssr:false});

export type ClayParticipationView = 'overview' | 'athletes' | 'skills' | 'wellbeing';
export interface ClayParticipationViewsProps {
  view: ClayParticipationView;
  participation: TeamParticipation | null;
  wellbeing?: TeamWellbeing | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenSkills?: () => void;
  onOpenAthletes?: () => void;
  onInvite?: () => void;
  onSelectAthlete?: (id: string) => void;
}
const labels = { checkIns: 'Check-ins', skillTraining: 'Skill training', wearables: 'Wearable coverage' };
const keys = ['checkIns', 'skillTraining', 'wearables'] as const;
function dateLabel(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Date unavailable' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }); }
function metricText(metric: CoverageMetric) {
  if (metric.status === 'not_connected') return 'Not connected';
  if (metric.status === 'sync_pending') return 'Sync pending';
  if (metric.status === 'unavailable') return metric.completed > 0 ? `${metric.completed} recorded` : 'Unavailable';
  if (metric.expected === 0) return 'None scheduled';
  return metric.expected === null ? `${metric.completed} recorded` : `${metric.completed} of ${metric.expected}`;
}
function phaseLabel(phase: string | null) {
  if (!phase) return 'Phase unavailable';
  const key = phase.toLowerCase();
  if (key.includes('learn')) return 'Learn it';
  if (key.includes('practice')) return 'Practice it';
  if (key.includes('use') || key.includes('apply')) return 'Use it';
  return phase;
}
function Metric({ metric, label, compact = false }: {metric: CoverageMetric; label: string; compact?: boolean}) {
  const percentage = metric.rate === null ? null : Math.round(Math.min(100, Math.max(0, metric.rate)));
  return <div className={compact ? s.compactMetric : s.metric}><span className={s.label}>{label}</span><strong>{metricText(metric)}</strong>{percentage !== null && metric.status === 'available' && <><div className={s.track}><span style={{ width: `${percentage}%` }} /></div><span className={s.muted}>{percentage}% coverage</span></>}{metric.reason && !compact && <p className={s.muted}>{metric.reason}</p>}</div>;
}
function CompletionPercentage({ metric, label }: {metric: CoverageMetric; label: string}) {
  return <div className={s.metric}><span className={s.label}>{label}</span><strong>{metric.rate === null ? '—' : `${Math.round(Math.min(100, Math.max(0, metric.rate)))}%`}</strong><span className={s.muted}>{metric.rate === null ? metricText(metric) : 'Last 7 days'}</span></div>;
}
function ParticipationCards({data}: {data: TeamParticipation}) {
  const days = data.athletes.flatMap(athlete => athlete.dailyParticipation ?? []).filter(day => day.scheduled && day.date >= data.from && day.date <= data.to);
  const periods = [['morningCompleted', 'Morning'], ['recoveryCompleted', 'Recovery'], ['eveningCompleted', 'Evening']] as const;
  return <div className={s.threeColumns}>
    <section className={s.card}><Activity size={21} className={s.metricIcon}/><span className={s.label}>Check-ins</span><div className={s.checkInPercentages}>{periods.map(([field, label]) => {
      const available = days.length > 0 && days.every(day => typeof day[field] === 'boolean');
      return <div key={field}><span className={s.label}>{label}</span><strong>{available ? `${Math.round(days.filter(day => day[field]).length / days.length * 100)}%` : '—'}</strong></div>;
    })}</div><span className={s.muted}>Last 7 days</span></section>
    <section className={s.card}><BookOpen size={21} className={s.metricIcon}/><CompletionPercentage metric={data.adherence.skillTraining} label="Skill training"/></section>
    <section className={s.card}><Watch size={21} className={s.metricIcon}/><Metric metric={data.adherence.wearables} label={labels.wearables}/></section>
  </div>;
}
function ParticipationHover({athlete, kind}: {athlete: ParticipationAthlete; kind: 'checkIns' | 'skillTraining' | 'wearables'}) {
  const [position, setPosition] = useState<{left:number;top:number}|null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepOpen = () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const closeSoon = () => {
    keepOpen();
    closeTimer.current = setTimeout(() => { setPosition(null); closeTimer.current = null; }, 350);
  };
  const closeNow = () => { keepOpen(); setPosition(null); };
  useEffect(() => () => { if (closeTimer.current !== null) clearTimeout(closeTimer.current); }, []);
  const id = useId();
  const metric = athlete[kind];
  const open = (target: HTMLElement) => {
    keepOpen();
    const rect = target.getBoundingClientRect();
    setPosition({left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)), top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 360))});
  };
  return <><button type="button" className={`${s.status} ${s.hoverTrigger}`} aria-label={`${athlete.displayName}: ${labels[kind]} details`} aria-describedby={position ? id : undefined}
    onMouseEnter={e=>open(e.currentTarget)} onMouseLeave={closeSoon} onFocus={e=>open(e.currentTarget)} onBlur={closeSoon} onClick={e=>open(e.currentTarget)} onKeyDown={e=>{if(e.key==='Escape')closeNow();}}>{metricText(metric)}</button>
    {position && createPortal(<div id={id} role="tooltip" className={s.hoverCard} style={position} onMouseEnter={keepOpen} onMouseLeave={closeSoon}><strong>{athlete.displayName} · {labels[kind]}</strong><p>{metricText(metric)}{metric.rate!==null ? ` · ${metric.rate}%` : ''}</p>
      {kind==='wearables' && <p>{metric.status==='available' ? 'Connected source · measured days' : metric.status==='sync_pending' ? 'Connected source · awaiting synced data' : metric.status==='not_connected' ? 'No connected source' : 'Connection not verified'}</p>}
      {kind==='skillTraining' && <p>{athlete.currentSkill ? `${athlete.currentSkill.name} · ${phaseLabel(athlete.currentSkill.phase)}` : 'No active skill recorded'}</p>}
      {kind==='checkIns' && athlete.dailyParticipation?.length ? <div className={`${s.wearablePeriods} ${s.checkInPeriods}`}><div><span>Date</span>{(['morningCompleted','eveningCompleted','recoveryCompleted'] as const).map((field,i)=><span key={field}>{['Morning','Night','Recovery'][i]}<br/>{athlete.dailyParticipation!.filter(d=>d.scheduled&&d[field]===true).length}/{athlete.dailyParticipation!.filter(d=>d.scheduled).length}</span>)}</div>{athlete.dailyParticipation.map(day=><div key={day.date}><span>{dateLabel(day.date)}</span>{(['morningCompleted','eveningCompleted','recoveryCompleted'] as const).map(period=>{const done=day[period];const label=done===true?'Done':!day.scheduled?'Not due':done===false?'Missing':'Unknown';return <span key={period}><i className={done===true?s.periodRecorded:done===false&&day.scheduled?s.periodMissing:s.periodUnknown}/>{label}</span>;})}</div>)}<p>Completion only. Recovery answers stay private.</p></div> : kind==='wearables' && athlete.dailyParticipation?.length ? <div className={s.wearablePeriods}><div><span>Date</span><span>Daytime</span><span>Overnight</span></div>{athlete.dailyParticipation.map(day=><div key={day.date}><span>{dateLabel(day.date)}</span>{(['wearableDaytime','wearableOvernight'] as const).map(period=>{const recorded=day[period];const label=recorded===true?'Recorded':recorded===false?'No data':'Unavailable';return <span key={period}><i className={recorded===true?s.periodRecorded:recorded===false?s.periodMissing:s.periodUnknown}/>{label}</span>;})}</div>)}</div> : athlete.dailyParticipation?.length ? <dl>{athlete.dailyParticipation.map(day=><div key={day.date}><dt>{dateLabel(day.date)}</dt><dd>{kind==='wearables' ? day.wearableRecorded === true ? 'Data recorded' : metric.status==='not_connected' ? 'Not connected' : metric.status==='unavailable'||day.wearableRecorded===undefined ? 'Unavailable' : !day.scheduled ? 'Outside coverage schedule' : 'No synced data' : kind==='checkIns' ? day.checkIn?'Completed':day.scheduled?'Not completed':'Not scheduled' : day.skillAssigned ? `${day.skillCompleted} of ${day.skillAssigned} completed` : 'None assigned'}</dd></div>)}</dl> : <p>Daily breakdown is not available for this record.</p>}
      {metric.reason&&<p>{metric.reason}</p>}
    </div>, document.body)}</>;
}
function LifetimeAthleteTable({athletes,onSelect}:{athletes:ParticipationAthlete[];onSelect:(id:string)=>void}) {
 const columns=[['morning','Morning check-ins'],['recovery','Recovery check-ins'],['evening','Evening check-ins'],['skills','Skill completions'],['wearableDays','Wearable days'],['conversations','Nora conversations']] as const;
 return <div className={s.tableScroll}><table className={s.table}><thead><tr><th>Athlete</th>{columns.map(([key,label])=><th key={key}>{label}</th>)}</tr></thead><tbody>{athletes.map(a=><tr key={a.id}><td><button className={s.athleteButton} onClick={()=>onSelect(a.id)}>{a.displayName}</button></td>{columns.map(([key])=><td key={key}>{a.lifetime?.[key]??'—'}</td>)}</tr>)}</tbody></table><p className={s.muted}>All time · Recorded activity since joining the platform. Skill completions count completed assignments. Wearable days include currently authorized sources. — means unavailable.</p></div>;
}
function AthleteTable({ athletes, onSelect, ranked = false }: {athletes: ParticipationAthlete[]; onSelect: (id:string)=>void; ranked?: boolean}) {
  const rows = ranked ? rankParticipation(athletes) : athletes.map(athlete => ({athlete, adherence: null, rank: null}));
  return <div className={s.tableScroll}><table className={s.table}><thead><tr>{ranked&&<th>Rank</th>}<th>Athlete</th>{ranked&&<><th>Morning</th><th>Recovery</th><th>Evening</th></>}<th>Check-ins</th><th>Skill training</th><th>Wearables</th><th title="Distinct Nora threads with an athlete message in the last 7 days. Conversation content stays private.">Nora conversations</th><th>Currently learning</th></tr></thead><tbody>{rows.map(({athlete:a, rank}) => <tr key={a.id}>{ranked&&<td>{rank ?? '—'}</td>}<td><button className={s.athleteButton} onClick={()=>onSelect(a.id)}><span className={s.avatar} aria-hidden="true">{a.displayName.split(' ').map(w=>w[0]).slice(0,2).join('')}</span>{a.displayName}</button></td>{ranked&&(['morningCompleted','recoveryCompleted','eveningCompleted'] as const).map(field=>{const days=a.dailyParticipation?.filter(day=>day.scheduled)??[];const available=days.length>0&&days.every(day=>typeof day[field]==='boolean');return <td key={field}>{available?`${Math.round(days.filter(day=>day[field]).length/days.length*100)}%`:'—'}</td>;})}{keys.map(key=><td key={key}><ParticipationHover athlete={a} kind={key}/></td>)}<td>{a.noraConversationCount ?? '—'}</td><td>{a.currentSkill ? <><span>{a.currentSkill.name}</span><small className={s.block}>{phaseLabel(a.currentSkill.phase)}</small></> : <span className={s.muted}>No active skill recorded</span>}</td></tr>)}</tbody></table></div>;
}
function FullSkillList({data}:{data:TeamParticipation}) {
 return <section className={s.card}><div className={s.cardHeading}><div><h2>Full skill list</h2><p className={s.muted}>Every active skill in the curriculum library. Current team assignments are marked below.</p></div><span className={s.pill}>{data.curriculum?.sequences.reduce((n,sequence)=>n+sequence.skills.length,0)??0} skills</span></div>{data.curriculum?.status==='available'?data.curriculum.sequences.map(sequence=><div className={s.skillList} key={sequence.id}>{sequence.skills.map((skill,index)=><article className={s.skillRow} key={skill.id}><div><span className={s.eyebrow}>{index+1} · {skill.type==='protocol'?'PROTOCOL':'SIMULATION'}</span><h3>{skill.name}</h3></div><span className={skill.currentCount?s.pill:s.muted}>{skill.currentCount?`${skill.currentCount} athletes currently assigned`:'Not currently assigned'}</span></article>)}</div>):<p className={s.empty}>The full skill list could not be loaded. Try refreshing this view.</p>}</section>;
}
function SkillProgress({skill}: {skill: TeamParticipation['skills'][number]}) {
  const progress=skill.progress;
  return <div><div className={s.phases}>{Object.entries(skill.phases).filter(([phase])=>phase!=='Unknown').map(([phase,count])=><div key={phase}><strong>{count}</strong><span>{phaseLabel(phase)}</span></div>)}</div>{progress?.rate!=null?<div className={s.metric}><strong>{progress.rate}%</strong><span className={s.muted}>{progress.completed} of {progress.expected} assignments completed for this skill · Last 7 days</span><div className={s.track}><span style={{width:`${progress.rate}%`}}/></div></div>:<p className={s.muted}>No assignments for this skill in the last 7 days.</p>}{skill.assignedDate&&<p className={s.muted}>Based on each athlete’s latest assigned task.</p>}</div>;
}
function WeeklyActivity({data}: {data: TeamParticipation}) {
  const maximum = Math.max(1, ...data.daily.flatMap(d=>keys.map(key=>d[key])));
  return <section className={s.card}><div className={s.cardHeading}><div><h2>Daily participation</h2><p className={s.muted}>Athletes with recorded activity each day</p></div><span className={s.pill}>{dateLabel(data.from)} – {dateLabel(data.to)}</span></div><div className={s.legend}>{keys.map((key,i)=><span key={key}><i className={s[`series${i}`]} />{labels[key]}</span>)}</div>{data.daily.length ? <div className={s.chart} role="img" aria-label={data.daily.map(d=>`${dateLabel(d.date)}: ${d.checkIns} check-ins, ${d.skillTraining} skill training, ${d.wearables} wearable data`).join('; ')}>{data.daily.map(day=><div className={s.chartDay} key={day.date}><div className={s.bars}>{keys.map((key,i)=><span key={key} title={`${labels[key]}: ${day[key]}`} className={s[`series${i}`]} style={{height:`${day[key] / maximum * 100}%`, minHeight:day[key] ? 3 : 0}} />)}</div><span>{dateLabel(day.date)}</span></div>)}</div> : <p className={s.empty}>Daily activity will appear as your team participates.</p>}</section>;
}
function WellbeingTile({title, description, card}: {title:string;description:string;card:WellbeingCard}) {
  return <section className={s.card}><h2>{title}</h2><p className={s.muted}>{description}</p>{card.status === 'available' && card.values.length > 0 ? <dl className={s.values}>{card.values.map((v,i)=><div key={`${v.label}-${i}`}><dt>{v.label}</dt><dd>{Number.isInteger(v.value) ? v.value : v.value.toFixed(1)} <small>{v.unit}</small></dd></div>)}</dl> : <div className={s.empty}>{card.reason || 'No shared team summary available yet.'}</div>}<div className={s.cardFoot}><span>{card.status === 'available' ? `${card.contributors} of ${card.eligible} eligible athletes contributed` : 'No shared measurements in this window'}</span><span>Source: {card.source}</span><span>Updated {dateLabel(card.asOf)}</span></div></section>;
}
export default function ClayParticipationViews({view,participation,wellbeing,loading,error,onRetry,onOpenSkills,onOpenAthletes,onInvite,onSelectAthlete}:ClayParticipationViewsProps) {
  const [preview,setPreview]=useState<LinearRuntimeAssignment|null>(null);
  useEffect(()=>{setPreview(null);},[view,participation?.teamId]);
  const [query,setQuery]=useState('');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const athletes=participation?.athletes ?? [];
  const filtered=useMemo(()=>athletes.filter(a=>a.displayName.toLowerCase().includes(query.toLowerCase())),[athletes,query]);
  const selected=athletes.find(a=>a.id===selectedId);
  const skills=useMemo(()=>[...(participation?.skills??[])].sort((a,b)=>b.athleteCount-a.athleteCount||a.name.localeCompare(b.name)),[participation?.skills]);
  const titles={overview:'Your team, in rhythm.',athletes:'Athletes',skills:'Skill training',wellbeing:'Wellbeing & recovery'};
  const subtitles={overview:'Follow participation. Build a steady mental training routine.',athletes:'All-time totals since each athlete joined the platform.',skills:'See what your team is learning and where they are in the skill.',wellbeing:'Shared team summaries for authorized athletic trainers.'};
  return <div className={s.root}><header className={s.pageHeading}><div><span className={s.eyebrow}>{view==='wellbeing'?'TRAINER WORKSPACE':'TEAM WORKSPACE'}</span><h1>{titles[view]}</h1><p>{subtitles[view]}</p></div>{view==='athletes'&&onInvite&&<button className={s.primary} onClick={onInvite}>Invite athletes <ArrowRight size={16}/></button>}</header>
  {loading ? <section className={s.card} role="status"><p className={s.empty}>Loading your team’s {view==='wellbeing'?'shared summaries':'participation'}…</p></section> : error ? <section className={s.card} role="alert"><h2>We couldn’t load this view.</h2><p>{error}</p><button className={s.secondary} onClick={onRetry}>Try again</button></section> : view==='wellbeing' ? wellbeing ? <><p className={s.notice}>Summaries show available shared reports from the last 7 days. Private journal entries and Nora conversations stay private.</p><div className={s.twoColumns}><WellbeingTile title="Team mood" description="How athletes described their check-ins." card={wellbeing.mood}/><WellbeingTile title="Self-reported recovery" description="How recovered athletes feel: 1 = very tired, 5 = fully recovered." card={wellbeing.recovery}/><WellbeingTile title="Wearable recovery signals" description="Shared measurements from connected wearables." card={wellbeing.wearables}/><WellbeingTile title="Journaling activity" description="Activity counts from athletes with sharing enabled." card={wellbeing.journaling}/></div></> : <section className={s.card}><p className={s.empty}>Shared summaries are not available for this team.</p></section> : !participation ? <section className={s.card}><p className={s.empty}>Select a team to view participation.</p></section> : <>
  {view==='overview'&&<><ParticipationCards data={participation}/><div className={s.overviewColumns}><WeeklyActivity data={participation}/><section className={`${s.card} ${s.learningCard}`}><span className={s.eyebrow}>CURRENT TEAM FOCUS</span><h2>What your team is learning</h2>{skills[0]?<><span className={s.clayWave} aria-hidden="true">∿</span><h3>{skills[0].name}</h3><p>{skills[0].athleteCount} of {athletes.length} athletes assigned this skill</p><SkillProgress skill={skills[0]}/>{skills.length>1&&<p className={s.muted}>{skills.length-1} other active {skills.length===2?'skill':'skills'} across the team</p>}</>:<p className={s.empty}>No current skill or recent assigned task found for this team.</p>}{onOpenSkills&&<button className={s.primary} onClick={onOpenSkills}>View skill breakdown <ArrowRight size={16}/></button>}</section></div><section className={s.card}><div className={s.cardHeading}><div><h2>Athlete participation</h2><p className={s.muted}>Last 7 days · Ranked by average check-in and skill completion</p></div>{onOpenAthletes&&<button className={s.textButton} onClick={onOpenAthletes}>Open athlete roster <ArrowRight size={16}/></button>}</div>{athletes.length?<AthleteTable ranked athletes={athletes} onSelect={onSelectAthlete || setSelectedId}/>:<p className={s.empty}>Your roster will appear when athletes join this team.</p>}</section></>}
  {view==='athletes'&&<section className={s.card}><div className={s.cardHeading}><span className={s.pill}><Users size={15}/> {athletes.length} athletes</span><label className={s.search}><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find an athlete" aria-label="Find an athlete"/></label></div>{filtered.length?<LifetimeAthleteTable athletes={filtered} onSelect={onSelectAthlete || setSelectedId}/>:<p className={s.empty}>{query?'No athletes match this search.':'Your roster will appear when athletes join this team.'}</p>}</section>}
  {view==='skills'&&<><div className={s.threeColumns}><section className={s.card}><span className={s.label}>Active skills</span><strong className={s.bigNumber}>{skills.length}</strong></section><section className={s.card}><span className={s.label}>Athletes learning</span><strong className={s.bigNumber}>{athletes.filter(a=>a.currentSkill).length}<small> / {athletes.length}</small></strong></section><section className={s.card}><CompletionPercentage label="Skill training" metric={participation.adherence.skillTraining}/></section></div><section className={s.card}><div className={s.cardHeading}><div><h2>What your team is learning</h2><p className={s.muted}>Current skills, ordered by the number of athletes learning them.</p></div></div>{skills.length?<div className={s.skillList}>{skills.map((skill,index)=><article className={s.skillRow} key={skill.id}><div><span className={s.eyebrow}>{index===0?'MOST COMMON ACTIVE SKILL':'ACTIVE SKILL'}</span><h3>{skill.name}</h3><p>{skill.athleteCount} of {athletes.length} athletes</p><button className={s.secondary} disabled={!skill.preview} onClick={()=>setPreview(skill.preview||null)}>{skill.preview?'Preview skill training':'Preview unavailable'}</button></div><SkillProgress skill={skill}/></article>)}</div>:<p className={s.empty}>No current skill or recent assigned task found for this team.</p>}</section><FullSkillList data={participation}/></>}
  {selected&&(view==='athletes'||view==='overview')&&<section className={`${s.card} ${s.selected}`} aria-label={`${selected.displayName} participation summary`}><div className={s.cardHeading}><div><span className={s.eyebrow}>PARTICIPATION SUMMARY</span><h2>{selected.displayName}</h2></div><button className={s.secondary} onClick={()=>setSelectedId(null)}><ChevronLeft size={16}/> Close summary</button></div><div className={s.threeColumns}>{keys.map(key=><Metric compact key={key} label={labels[key]} metric={selected[key]}/>)}</div><p>Currently learning: <strong>{selected.currentSkill?.name||'No active skill recorded'}</strong>{selected.currentSkill&&` · ${phaseLabel(selected.currentSkill.phase)}`}</p></section>}
  <footer className={s.footer}><span>Participation only. Private reflections stay private.</span><span>{view==='athletes'?'All time':`${dateLabel(participation.from)} – ${dateLabel(participation.to)}`} · Updated {dateLabel(participation.asOf)}</span></footer>{participation.limitations.length>0&&<details className={s.limitations}><summary>About this data</summary><ul>{participation.limitations.map((item,i)=><li key={i}>{item}</li>)}</ul></details>}
  </>}
  {preview&&<div className={s.previewOverlay} role="dialog" aria-modal="true" aria-label={`Preview ${preview.skillName}`} onKeyDown={e=>{if(e.key==='Escape')setPreview(null);}}><section className={s.previewPanel}><div className={s.cardHeading}><h2>{preview.skillName}</h2><button autoFocus className={s.secondary} onClick={()=>setPreview(null)}>Close preview</button></div><div className={s.phases}>{(preview.skillType==='simulation'?['practice','use_it']:['learn','practice','use_it']).map(phase=><button className={s.secondary} key={phase} aria-pressed={preview.phase===phase} onClick={()=>setPreview({...preview,phase:phase as LinearRuntimeAssignment['phase']})}>{phaseLabel(phase)}</button>)}</div><SkillPreviewFlow key={`${preview.id}-${preview.phase}`} assignment={preview} preview onSaved={()=>{}}/></section></div>}
  </div>;
}

export function ClayParticipationReportSummary({data}:{data:TeamParticipation}) {
  return <div className={s.root}><div className={s.cardHeading}><h2>Current participation</h2><span className={s.pill}>{dateLabel(data.from)} – {dateLabel(data.to)}</span></div><ParticipationCards data={data}/><section className={s.card} style={{marginTop:20}}><WeeklyActivity data={data}/></section></div>;
}
