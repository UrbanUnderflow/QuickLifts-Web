import React, { useMemo, useState } from 'react';
import { ArrowRight, Search, Users, Activity, BookOpen, Watch, ChevronLeft } from 'lucide-react';
import type { CoverageMetric, ParticipationAthlete, TeamParticipation, TeamWellbeing, WellbeingCard } from '../../lib/coach-dashboard/types';
import s from './ClayParticipationViews.module.css';

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
}
const labels = { checkIns: 'Check-ins', skillTraining: 'Skill training', wearables: 'Wearable coverage' };
const keys = ['checkIns', 'skillTraining', 'wearables'] as const;
const icons = { checkIns: Activity, skillTraining: BookOpen, wearables: Watch };
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
function AthleteTable({ athletes, onSelect }: {athletes: ParticipationAthlete[]; onSelect: (id:string)=>void}) {
  return <div className={s.tableScroll}><table className={s.table}><thead><tr><th>Athlete</th><th>Check-ins</th><th>Skill training</th><th>Wearables</th><th>Currently learning</th></tr></thead><tbody>{athletes.map(a => <tr key={a.id}><td><button className={s.athleteButton} onClick={()=>onSelect(a.id)}><span className={s.avatar} aria-hidden="true">{a.displayName.split(' ').map(w=>w[0]).slice(0,2).join('')}</span>{a.displayName}</button></td>{keys.map(key=><td key={key}><span className={a[key].status === 'available' ? s.status : s.muted} title={a[key].reason}>{metricText(a[key])}</span></td>)}<td>{a.currentSkill ? <><span>{a.currentSkill.name}</span><small className={s.block}>{phaseLabel(a.currentSkill.phase)}</small></> : <span className={s.muted}>No active skill recorded</span>}</td></tr>)}</tbody></table></div>;
}
function WeeklyActivity({data}: {data: TeamParticipation}) {
  const maximum = Math.max(1, ...data.daily.flatMap(d=>keys.map(key=>d[key])));
  return <section className={s.card}><div className={s.cardHeading}><div><h2>Daily participation</h2><p className={s.muted}>Athletes with recorded activity each day</p></div><span className={s.pill}>{dateLabel(data.from)} – {dateLabel(data.to)}</span></div><div className={s.legend}>{keys.map((key,i)=><span key={key}><i className={s[`series${i}`]} />{labels[key]}</span>)}</div>{data.daily.length ? <div className={s.chart} role="img" aria-label={data.daily.map(d=>`${dateLabel(d.date)}: ${d.checkIns} check-ins, ${d.skillTraining} skill training, ${d.wearables} wearable data`).join('; ')}>{data.daily.map(day=><div className={s.chartDay} key={day.date}><div className={s.bars}>{keys.map((key,i)=><span key={key} title={`${labels[key]}: ${day[key]}`} className={s[`series${i}`]} style={{height:`${day[key] / maximum * 100}%`, minHeight:day[key] ? 3 : 0}} />)}</div><span>{dateLabel(day.date)}</span></div>)}</div> : <p className={s.empty}>Daily activity will appear as your team participates.</p>}</section>;
}
function WellbeingTile({title, description, card}: {title:string;description:string;card:WellbeingCard}) {
  return <section className={s.card}><h2>{title}</h2><p className={s.muted}>{description}</p>{card.status === 'available' && card.values.length > 0 ? <dl className={s.values}>{card.values.map((v,i)=><div key={`${v.label}-${i}`}><dt>{v.label}</dt><dd>{Number.isInteger(v.value) ? v.value : v.value.toFixed(1)} <small>{v.unit}</small></dd></div>)}</dl> : <div className={s.empty}>{card.reason || 'No shared team summary available yet.'}</div>}<div className={s.cardFoot}><span>{card.status === 'available' ? `${card.contributors} of ${card.eligible} eligible athletes contributed` : 'Contributor count withheld until the minimum is met'}</span><span>Source: {card.source}</span><span>Updated {dateLabel(card.asOf)}</span></div></section>;
}
export default function ClayParticipationViews({view,participation,wellbeing,loading,error,onRetry,onOpenSkills,onOpenAthletes,onInvite}:ClayParticipationViewsProps) {
  const [query,setQuery]=useState('');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const athletes=participation?.athletes ?? [];
  const filtered=useMemo(()=>athletes.filter(a=>a.displayName.toLowerCase().includes(query.toLowerCase())),[athletes,query]);
  const selected=athletes.find(a=>a.id===selectedId);
  const skills=useMemo(()=>[...(participation?.skills??[])].sort((a,b)=>b.athleteCount-a.athleteCount||a.name.localeCompare(b.name)),[participation?.skills]);
  const titles={overview:'Your team, in rhythm.',athletes:'Athletes',skills:'Skill training',wellbeing:'Wellbeing & recovery'};
  const subtitles={overview:'Follow participation. Build a steady mental training routine.',athletes:'A clear view of each athlete’s participation.',skills:'See what your team is learning and where they are in the skill.',wellbeing:'Shared team summaries for authorized athletic trainers.'};
  return <div className={s.root}><header className={s.pageHeading}><div><span className={s.eyebrow}>{view==='wellbeing'?'TRAINER WORKSPACE':'TEAM WORKSPACE'}</span><h1>{titles[view]}</h1><p>{subtitles[view]}</p></div>{view==='athletes'&&onInvite&&<button className={s.primary} onClick={onInvite}>Invite athletes <ArrowRight size={16}/></button>}</header>
  {loading ? <section className={s.card} role="status"><p className={s.empty}>Loading your team’s {view==='wellbeing'?'shared summaries':'participation'}…</p></section> : error ? <section className={s.card} role="alert"><h2>We couldn’t load this view.</h2><p>{error}</p><button className={s.secondary} onClick={onRetry}>Try again</button></section> : view==='wellbeing' ? wellbeing ? <><p className={s.notice}>Each summary requires at least {wellbeing.minimumContributors} contributing athletes with sharing enabled. Private journal entries and Nora conversations stay private.</p><div className={s.twoColumns}><WellbeingTile title="Team mood" description="How athletes described their check-ins." card={wellbeing.mood}/><WellbeingTile title="Self-reported recovery" description="Recovery reported by athletes in their check-ins." card={wellbeing.recovery}/><WellbeingTile title="Wearable recovery signals" description="Shared measurements from connected wearables." card={wellbeing.wearables}/><WellbeingTile title="Journaling activity" description="Activity counts from athletes with sharing enabled." card={wellbeing.journaling}/></div></> : <section className={s.card}><p className={s.empty}>Shared summaries are not available for this team.</p></section> : !participation ? <section className={s.card}><p className={s.empty}>Select a team to view participation.</p></section> : <>
  {view==='overview'&&<><div className={s.threeColumns}>{keys.map(key=>{const Icon=icons[key];return <section className={s.card} key={key}><Icon size={21} className={s.metricIcon}/><Metric metric={participation.adherence[key]} label={labels[key]}/></section>})}</div><div className={s.overviewColumns}><WeeklyActivity data={participation}/><section className={`${s.card} ${s.learningCard}`}><span className={s.eyebrow}>CURRENT TEAM FOCUS</span><h2>What your team is learning</h2>{skills[0]?<><span className={s.clayWave} aria-hidden="true">∿</span><h3>{skills[0].name}</h3><p>{skills[0].athleteCount} of {athletes.length} athletes currently learning this skill</p>{skills.length>1&&<p className={s.muted}>{skills.length-1} other active {skills.length===2?'skill':'skills'} across the team</p>}</>:<p className={s.empty}>Active skills will appear when athletes begin skill training.</p>}{onOpenSkills&&<button className={s.primary} onClick={onOpenSkills}>View skill breakdown <ArrowRight size={16}/></button>}</section></div><section className={s.card}><div className={s.cardHeading}><h2>Athlete participation</h2>{onOpenAthletes&&<button className={s.textButton} onClick={onOpenAthletes}>View all athletes <ArrowRight size={16}/></button>}</div>{athletes.length?<AthleteTable athletes={athletes.slice(0,5)} onSelect={setSelectedId}/>:<p className={s.empty}>Your roster will appear when athletes join this team.</p>}</section></>}
  {view==='athletes'&&<section className={s.card}><div className={s.cardHeading}><span className={s.pill}><Users size={15}/> {athletes.length} athletes</span><label className={s.search}><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find an athlete" aria-label="Find an athlete"/></label></div>{filtered.length?<AthleteTable athletes={filtered} onSelect={setSelectedId}/>:<p className={s.empty}>{query?'No athletes match this search.':'Your roster will appear when athletes join this team.'}</p>}</section>}
  {view==='skills'&&<><div className={s.threeColumns}><section className={s.card}><span className={s.label}>Active skills</span><strong className={s.bigNumber}>{skills.length}</strong></section><section className={s.card}><span className={s.label}>Athletes learning</span><strong className={s.bigNumber}>{athletes.filter(a=>a.currentSkill).length}<small> / {athletes.length}</small></strong></section><section className={s.card}><Metric label="Skill training adherence" metric={participation.adherence.skillTraining}/></section></div><section className={s.card}><div className={s.cardHeading}><div><h2>What your team is learning</h2><p className={s.muted}>Current skills, ordered by the number of athletes learning them.</p></div></div>{skills.length?<div className={s.skillList}>{skills.map((skill,index)=><article className={s.skillRow} key={skill.id}><div><span className={s.eyebrow}>{index===0?'MOST COMMON ACTIVE SKILL':'ACTIVE SKILL'}</span><h3>{skill.name}</h3><p>{skill.athleteCount} of {athletes.length} athletes</p></div><div className={s.phases}>{Object.entries(skill.phases).length?Object.entries(skill.phases).map(([phase,count])=><div key={phase}><strong>{count}</strong><span>{phaseLabel(phase)}</span></div>):<span className={s.muted}>Phase breakdown unavailable</span>}</div></article>)}</div>:<p className={s.empty}>Active skills will appear when athletes begin skill training.</p>}</section></>}
  {selected&&(view==='athletes'||view==='overview')&&<section className={`${s.card} ${s.selected}`} aria-label={`${selected.displayName} participation summary`}><div className={s.cardHeading}><div><span className={s.eyebrow}>PARTICIPATION SUMMARY</span><h2>{selected.displayName}</h2></div><button className={s.secondary} onClick={()=>setSelectedId(null)}><ChevronLeft size={16}/> Close summary</button></div><div className={s.threeColumns}>{keys.map(key=><Metric compact key={key} label={labels[key]} metric={selected[key]}/>)}</div><p>Currently learning: <strong>{selected.currentSkill?.name||'No active skill recorded'}</strong>{selected.currentSkill&&` · ${phaseLabel(selected.currentSkill.phase)}`}</p></section>}
  <footer className={s.footer}><span>Participation only. Private reflections stay private.</span><span>{dateLabel(participation.from)} – {dateLabel(participation.to)} · Updated {dateLabel(participation.asOf)}</span></footer>{participation.limitations.length>0&&<details className={s.limitations}><summary>About this data</summary><ul>{participation.limitations.map((item,i)=><li key={i}>{item}</li>)}</ul></details>}
  </>}
  </div>;
}

export function ClayParticipationReportSummary({data}:{data:TeamParticipation}) {
  return <div className={s.root}><div className={s.cardHeading}><h2>Current participation</h2><span className={s.pill}>{dateLabel(data.from)} – {dateLabel(data.to)}</span></div><div className={s.threeColumns}>{keys.map(key=><section key={key} className={s.card}><Metric metric={data.adherence[key]} label={labels[key]}/></section>)}</div><section className={s.card} style={{marginTop:20}}><WeeklyActivity data={data}/></section></div>;
}
