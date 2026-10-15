const $ = id => document.getElementById(id);
const storageKey = 'pulse-run-of-show-v2';
const shared = location.hash.startsWith('#preview=');
let event = Visit.initial(), preview = shared, previewEvent = null, editing = null, addingDay = false, ready = false;
// The previous single-day schedule remains untouched under its v1 storage key.
try {
 const saved = JSON.parse(localStorage.getItem(storageKey));
 if (saved) {
  Preview.decode(Preview.encode(saved));
  const validRun = saved.days.every(d => Array.isArray(d.completed) && d.completed.length <= d.segments.length && d.completed.every((c,i) => c.id===d.segments[i].id && Number.isFinite(c.start) && Number.isFinite(c.end)) && (!d.active || (d.active.id===d.segments[d.completed.length]?.id && Number.isFinite(d.active.start) && Number.isFinite(d.active.end))));
  if(validRun) event=saved;
 }
} catch (_) {}
// Apply the requested deck alignment once, retaining a copy of the prior visit.
if(!shared){
 const aligned=Visit.alignSessionDecks(event);
 if(aligned!==event){
  try{localStorage.setItem(storageKey+'-before-deck-alignment',JSON.stringify(event));event=aligned;}catch(_){/* Preserve the saved visit if a backup cannot be made. */}
 }
}
if(!shared){const cleaned=Visit.staffFacing(event);if(cleaned!==event){try{localStorage.setItem(storageKey+'-before-staff-copy',JSON.stringify(event));event=cleaned;}catch(_){}}}
if (!shared) event.notes=event.notes.replace('Practice visits: golf, bowling, and basketball. Days and times to coordinate.', 'Practice visits: golf and bowling. Basketball (tentative): coaches only. Days and times to coordinate.');
if(!shared) event.notes=event.notes.replace(' Basketball (tentative): coaches only.', '');
if(!shared){event.notes=event.notes.replace('Lodging: two hotel rooms for three nights.', 'Lodging confirmed: two hotel rooms for three nights.');event.days=event.days.map(d=>d.id==='arrival'?{...d,notes:d.notes.replace(' Two hotel rooms requested for three nights. Arrival time and lodging details to confirm.', '')}:d);}
if(!shared&&event.logisticsRevision!=='confirmed-2026-10-14'){
 const defaults=Visit.initial();event={...event,timeZone:'America/New_York',logisticsRevision:'confirmed-2026-10-14',notes:event.notes.replace('Session times and lengths await confirmation from Dr. Lamar.','Coaches and student-athlete sessions begin at 6 PM Eastern.').replace('Lodging confirmed: two hotel rooms for three nights.','Lodging confirmed: Hampton Inn & Suites Salisbury/Fruitland, 304 Prosperity Lane, Fruitland, MD 21826. Two hotel rooms for three nights.'),days:event.days.map(d=>{
 if(d.id==='arrival')return {...d,notes:d.notes.replace('Arrive on campus and check in.',defaults.days.find(x=>x.id==='arrival').notes)};
 if(!['coaches','athletes'].includes(d.id))return d;
 return {...d,startTime:'18:00',planned:Visit.timestamp(d.date,'18:00','America/New_York'),notes:d.notes.replace('Start time and room to confirm.','Starts at 6 PM Eastern. Room to confirm.').replace('Start time, AV-equipped room, reliable Wi-Fi, and food arrangements to confirm.','Starts at 6 PM Eastern. AV-equipped room, reliable Wi-Fi, and food arrangements to confirm.')};
 })};
}
if(!shared){event.notes=event.notes.replace('Athletes: anticipate 23 across bowling, women’s golf, and men’s golf. Aim for one combined session coordinated around practice schedules.','Athletes: 26 across bowling, women’s golf, and men’s golf. One combined session is confirmed.');event.days=event.days.map(d=>d.id==='athletes'?{...d,notes:d.notes.replace('Anticipate 23 athletes across bowling, women’s golf, and men’s golf.','Confirmed combined session for 26 athletes across bowling, women’s golf, and men’s golf.')}:d);}
if(!shared) event.days=event.days.map(d=>({...d,segments:d.segments.map(s=>({...s,description:(s.description||'').replace('Two check-ins per week is the proposed pilot target.','').trim()}))}));
if(!shared) event.days=event.days.map(d=>d.id==='athletes'?{...d,notes:d.notes.replace("Coaches and trainers are not in the room for this session.","Coaches join for the opening address, then leave before the athlete activities begin. Trainers are not in the room for the athlete session."),segments:d.segments.map(s=>({...s,description:(s.description||'').replace("A hands-on introduction to focus, composure, and decision-making. Athletes learn what to expect from the session and the opportunity to train their mental skills.","Coaches open with a brief address emphasizing the importance of mental training and their support for the session, then leave the room before the athlete activities begin. Athletes receive a hands-on introduction to focus, composure, and decision-making, learn what to expect, and explore the opportunity to train their mental skills.")}))}:d);
if(!shared) event.days=event.days.map(d=>({...d,segments:d.segments.map(s=>({...s,description:(s.description||'').replace("Athletes explore the roles of Advocate, Influencer, and Critic, choose the role they relate to, and discuss how different perspectives contribute to a team.","Athletes explore established team roles and athlete personas, identify those they relate to, and discuss how different perspectives contribute to a team.")}))}));
if(!shared) event=Visit.mergeBaseline(event);
if(!shared) event.days=event.days.map(d=>({...d,segments:d.segments.map(s=>s.title==='Food and questions'?{...s,title:'Questions',description:(s.description||'').replace('Food and open questions, with an opportunity','Open questions, with an opportunity')}:s)}));
if(!shared&&event.title==='Campus Visit · Pulse & Aunt Edna')event.title='UMES Campus Visit';
if(!shared&&event.title==='UMES Campus Visit')event.title='UMES Campus Onboarding And Activation';
if (shared) {
 try { const decoded=Preview.decode(location.hash.slice(9)); previewEvent=decoded.version===2?decoded:Visit.fromLegacy(decoded); }
 catch (_) {document.querySelector('main').replaceChildren(Object.assign(document.createElement('p'),{textContent:'This preview link is incomplete or invalid. Ask the organizer for a new link.'}));throw Error('Invalid preview link');}
}
let selectedId=(previewEvent||event).selectedDayId;
const view=()=>preview?previewEvent:event;
const currentDay=()=>view().days.find(d=>d.id===selectedId)||view().days[0];
function save(){if(shared)return;try{localStorage.setItem(storageKey,JSON.stringify(event));$('save-status').textContent=preview?'Read-only preview':'Saved on this device';}catch(_){$('save-status').textContent='Storage unavailable. Keep this tab open.';}}
function updateDay(next){event.days=event.days.map(d=>d.id===next.id?next:d);save();}
const time=n=>new Date(n).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:view().timeZone});
const duration=n=>`${Math.floor(n/60).toString().padStart(2,'0')}:${Math.floor(n%60).toString().padStart(2,'0')}`;
const minutes=d=>d.segments.reduce((sum,s)=>sum+s.minutes,0);
function tabs(){
 const nav=$('day-tabs');nav.replaceChildren();
 view().days.forEach(d=>{const b=document.createElement('button');b.className='day-tab';b.setAttribute('aria-current',d.id===currentDay().id?'date':'false');b.innerHTML='<span></span><strong></strong><small></small>';b.children[0].textContent=Visit.label(d);b.children[1].textContent=d.title;b.children[2].textContent=d.active?'● Running':d.segments.length?`${minutes(d)} min · ${d.segments.length} segments`:'Travel & logistics';b.onclick=()=>{selectedId=d.id;if(!preview){event.selectedDayId=d.id;save();}rebuild();};nav.append(b);});
}
function rebuild(){ready=false;$('timeline').replaceChildren();tabs();render();}
function render(){
 const now=Date.now();
 if(!shared){let changed=false;event.days=event.days.map(d=>{const n=Runner.normalize(d,now);if(n!==d)changed=true;return n;});if(changed){save();tabs();}}
 const state=currentDay(), rows=Runner.timeline(state,now), index=state.completed.length, current=state.segments[index], running=!!state.active, complete=!current, total=minutes(state), untimed=!state.startTime&&!running&&!index;
 const otherRunning=event.days.find(d=>d.active&&d.id!==state.id);
 $('clock').textContent=time(now);$('day-date').textContent=Visit.label(state);$('date-label').textContent=state.title;
 $('visit-notes').textContent=view().notes;$('day-notes').textContent=state.notes;$('planned-label').textContent=state.startTime?`Planned start · ${time(state.planned)}`:'Start time TBD';
 $('visit-subtitle').textContent=`${view().days.length} days · ${view().days.reduce((n,d)=>n+minutes(d),0)} minutes of planned sessions`;
 if(!ready){$('show-title').value=view().title;ready=true;}
 $('show-title').readOnly=preview;
 $('schedule-summary').textContent=`${rows.length} segments · ${total} min planned${state.requestedMinutes?` / ${state.requestedMinutes} min requested`:''}`;
 $('schedule-summary').classList.toggle('over-budget',!!state.requestedMinutes&&total!==state.requestedMinutes);
 let offset=0;
 rows.forEach((s,i)=>{
  let slot=$('slot-'+s.id);
  if(!slot){slot=document.createElement('div');slot.id='slot-'+s.id;slot.className='slot';const label=document.createElement('div');label.className='time-label';const b=document.createElement('article');b.className='segment';b.innerHTML='<div class="segment-content"></div><span class="segment-duration"></span>';const main=document.createElement(preview?'div':'button');main.className='segment-main';main.innerHTML='<div class="segment-index"></div><h3></h3><p></p>';b.firstElementChild.append(main);const read=document.createElement('button');read.type='button';read.className='read-description';read.textContent='Read description';read.onclick=e=>{e.stopPropagation();const segment=currentDay().segments.find(item=>item.id===s.id);if(!segment)return;$('description-title').textContent=segment.title;$('description-body').textContent=segment.description||'No description has been added yet.';$('description-dialog').showModal();};b.firstElementChild.append(read);b.onclick=()=>openEditor(s.id);const handle=document.createElement('button');handle.type='button';handle.className='drag-handle';handle.textContent='⠿';handle.title='Drag to reorder. Use arrow keys to move.';handle.onclick=e=>e.stopPropagation();handle.onpointerdown=e=>beginDrag(e,s.id,handle);handle.onkeydown=e=>{if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();moveSegment(s.id,currentDay().segments.findIndex(item=>item.id===s.id)+(e.key==='ArrowUp'?-1:1));};b.append(handle);slot.dataset.segmentId=s.id;slot.append(label,b);$('timeline').append(slot);}
  slot.children[0].textContent=untimed?`+${offset} min`:time(s.start);
  const b=slot.children[1];const handle=b.querySelector('.drag-handle');handle.hidden=preview;handle.disabled=i<state.completed.length+(state.active?1:0);handle.setAttribute('aria-label',`Reorder ${s.title}`);b.className=`segment ${s.color} ${s.status}`;b.style.minHeight=`${Math.max(98,Math.min(300,s.minutes*2.15))}px`;
  b.querySelector('.segment-index').textContent=`${String(i+1).padStart(2,'0')} / ${s.status==='done'?'COMPLETED':s.status==='live'?'LIVE NOW':'PLANNED'}`;
  b.querySelector('h3').textContent=s.title;b.querySelector('p').textContent=untimed?`${offset}–${offset+s.minutes} min from session start`:`${time(s.start)} – ${time(s.end)}`;
  b.querySelector('.read-description').hidden=!s.description?.trim();b.querySelector('.segment-duration').textContent=`${s.minutes} min ${preview?'':s.status==='done'?'✓':'↗'}`;if(!preview)b.querySelector('.segment-main').setAttribute('aria-label',`Edit ${s.title}`);offset+=s.minutes;
 });
 [...$('timeline').children].forEach(el=>{if(!rows.some(s=>el.id==='slot-'+s.id))el.remove();});
 $('empty-day').hidden=rows.length>0;
 $('runner-status').textContent=!rows.length?'TRAVEL & LOGISTICS':complete?'THAT’S A WRAP':running?'IN THE MOMENT':index?'READY FOR WHAT’S NEXT':'READY WHEN YOU ARE';
 $('segment-number').textContent=!rows.length?Visit.label(state):complete?'ALL SEGMENTS COMPLETE':`SEGMENT ${String(index+1).padStart(2,'0')} OF ${String(rows.length).padStart(2,'0')}`;
 $('current-title').textContent=current?.title||(!rows.length?state.title:'Time well spent.');
 $('countdown').textContent=!rows.length?'TBD':duration(running?Math.max(0,Math.ceil((state.active.end-now)/1000)):current?current.minutes*60:0);
 $('timer-caption').textContent=!rows.length?'Travel time to confirm':running?'remaining in this segment':complete?'Your run is complete.':'minutes : seconds';
 $('progress-fill').style.width=running?`${Math.min(100,100*(now-state.active.start)/(state.active.end-state.active.start))}%`:complete?'100%':'0%';
 $('run').hidden=preview||!rows.length;$('run').disabled=!!otherRunning;
 $('run').textContent=otherRunning?`${otherRunning.title} is running`:running?'✓ End segment early':complete?'↺ Run again':index?'▶ Start next segment':'▶ Start run';
 $('runner-note').textContent=otherRunning?'Open the running day to manage its countdown.':!rows.length?'Travel details are listed in the day notes.':running?'Finish early and the schedule moves with you.':complete?'Reset this day whenever you’re ready for another run.':index?'Take a breath. The schedule waits for you.':'Start when you’re ready. Every segment follows your lead.';
 const next=state.segments[index+1];$('next-title').textContent=next?.title||'Room to wrap up';$('next-details').textContent=next?`${next.minutes} minutes${untimed?'':` · ${time(rows[index+1].start)}`}`:'Everything has its moment.';
 $('finish-time').textContent=!rows.length||untimed?'TBD':time(rows.at(-1).end);$('completed-count').textContent=`${index} / ${rows.length}`;
 const delta=rows.length?Math.round((rows.at(-1).end-state.planned-total*60000)/60000):0;
 $('timing-note').textContent=!state.startTime?'Session times to confirm. Durations are proposed.':index||running?delta===0?'Right on your original schedule.':`${Math.abs(delta)} min ${delta>0?'later':'earlier'} than your original plan.`:'The schedule follows your pace.';
 $('completed-count').parentElement.hidden=preview||!rows.length;
 if(preview){$('runner-status').textContent='DAY AT A GLANCE';$('segment-number').textContent=Visit.label(state);$('current-title').textContent=state.title;$('countdown').textContent=rows.length?String(total):'TBD';$('timer-caption').textContent=rows.length?'minutes together':'Travel time to confirm';$('runner-note').textContent=`Times shown in ${view().timeZone.replaceAll('_',' ')}.`;$('timing-note').textContent='Proposed schedule. Session times and logistics to confirm.';}
}
function moveSegment(id,targetIndex){
 if(preview)return;const state=currentDay(),next=Runner.reorder(state,id,targetIndex);if(next===state)return;
 updateDay(next);rebuild();$('slot-'+id)?.querySelector('.drag-handle').focus({preventScroll:true});
 $('reorder-status').textContent=`${next.segments[targetIndex].title} moved to position ${targetIndex+1}.`;
}
function beginDrag(e,id,handle){
 if(preview||handle.disabled||e.button!==0)return;e.preventDefault();e.stopPropagation();
 const dayId=currentDay().id,slot=handle.closest('.slot');let y=e.clientY,startY=y,target=null,moved=false,frame;
 handle.setPointerCapture(e.pointerId);slot.classList.add('dragging');
 function clearMarks(){document.querySelectorAll('.drop-before,.drop-after').forEach(el=>el.classList.remove('drop-before','drop-after'));}
 function locate(){clearMarks();const state=currentDay(),locked=state.completed.length+(state.active?1:0);const candidates=[...$('timeline').children].filter(el=>el!==slot&&state.segments.findIndex(s=>s.id===el.dataset.segmentId)>=locked);const before=candidates.find(el=>{const r=el.getBoundingClientRect();return y<r.top+r.height/2;});target=before?{id:before.dataset.segmentId,after:false}:candidates.length?{id:candidates.at(-1).dataset.segmentId,after:true}:null;if(target)(before||candidates.at(-1)).classList.add(before?'drop-before':'drop-after');}
 function tick(){if(moved){const speed=y<85?-14:y>innerHeight-85?14:0;if(speed)window.scrollBy(0,speed);locate();}frame=requestAnimationFrame(tick);}
 const move=ev=>{y=ev.clientY;moved=moved||Math.abs(y-startY)>5;};
 function finish(ev){cancelAnimationFrame(frame);handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',finish);slot.classList.remove('dragging');clearMarks();if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);if(ev.type==='pointercancel'||!moved||!target||preview||currentDay().id!==dayId)return;const rest=currentDay().segments.filter(s=>s.id!==id);moveSegment(id,rest.findIndex(s=>s.id===target.id)+(target.after?1:0));}
 handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);frame=requestAnimationFrame(tick);
}
function reset(){if(preview)return;const state=currentDay();if((state.active||state.completed.length)&&!confirm('Reset this day? Your segments and planned schedule will stay.'))return;updateDay({...state,active:null,completed:[]});rebuild();}
function openEditor(id=null){if(preview)return;editing=id;const state=currentDay(),s=state.segments.find(s=>s.id===id),locked=s&&(state.completed.some(c=>c.id===id)||state.active?.id===id);$('editor-title').textContent=s?'Edit segment':'Add segment';$('edit-title').setCustomValidity('');$('edit-title').value=s?.title||'';$('edit-description').value=s?.description||'';$('edit-minutes').value=s?.minutes||15;$('edit-color').value=s?.color||'lime';$('edit-minutes').disabled=!!locked;$('delete').hidden=!s||!!locked;$('editor').showModal();$('edit-title').focus();}
$('show-title').oninput=e=>{if(preview)return;event.title=e.target.value;save();};
$('run').onclick=()=>{if(preview)return;const state=currentDay();if(event.days.some(d=>d.active&&d.id!==state.id))return;if(state.completed.length===state.segments.length){reset();return;}updateDay(state.active?Runner.finish(state,Date.now()):Runner.start(state,Date.now()));tabs();render();};
$('reset').onclick=reset;$('add').onclick=()=>openEditor();$('add-bottom').onclick=()=>openEditor();$('close-editor').onclick=()=>$('editor').close();$('close-description').onclick=()=>$('description-dialog').close();
$('edit-form').onsubmit=e=>{e.preventDefault();if(preview)return;const state=currentDay(),title=$('edit-title').value.trim();if(!title){$('edit-title').setCustomValidity('Enter a segment title.');$('edit-title').reportValidity();return;}const old=state.segments.find(s=>s.id===editing);const item={id:editing||crypto.randomUUID(),title,description:$('edit-description').value.trim(),minutes:old&&$('edit-minutes').disabled?old.minutes:Number($('edit-minutes').value),color:$('edit-color').value};updateDay({...state,segments:old?state.segments.map(s=>s.id===editing?item:s):[...state.segments,item]});$('editor').close();tabs();render();};
$('edit-title').oninput=()=>$('edit-title').setCustomValidity('');$('delete').onclick=()=>{if(preview)return;const state=currentDay();updateDay({...state,segments:state.segments.filter(s=>s.id!==editing)});$('editor').close();tabs();render();};
function editDay(add=false){if(preview)return;addingDay=add;const d=add?{title:'',date:'',dayNumber:null,startTime:'',notes:'',requestedMinutes:null}:currentDay();$('day-editor-title').textContent=add?'Add day':'Edit day';$('day-title').value=d.title;$('day-date-input').value=d.date;$('day-number').value=d.dayNumber||'';$('day-time').value=d.startTime;$('day-length').value=d.requestedMinutes||'';$('day-description').value=d.notes;const locked=!add&&(d.active||d.completed.length);['day-date-input','day-number','day-time'].forEach(id=>$(id).disabled=!!locked);$('delete-day').hidden=add||event.days.length===1||!!locked;$('day-editor').showModal();}
$('edit-day').onclick=()=>editDay();$('add-day').onclick=()=>editDay(true);$('close-day').onclick=()=>$('day-editor').close();
$('day-form').onsubmit=e=>{e.preventDefault();if(preview)return;const old=addingDay?{id:crypto.randomUUID(),segments:[],completed:[],active:null}:currentDay();const title=$('day-title').value.trim();if(!title)return;const locked=old.active||old.completed.length;const d={...old,title,date:locked?old.date:$('day-date-input').value,dayNumber:locked?old.dayNumber:Number($('day-number').value)||null,startTime:locked?old.startTime:$('day-time').value,notes:$('day-description').value.trim(),requestedMinutes:Number($('day-length').value)||null};d.planned=Visit.timestamp(d.date,d.startTime,event.timeZone);if(addingDay)event.days.push(d);else event.days=event.days.map(day=>day.id===d.id?d:day);selectedId=d.id;event.selectedDayId=d.id;save();$('day-editor').close();rebuild();};
$('delete-day').onclick=()=>{if(preview||event.days.length===1)return;const d=currentDay();if(d.active||d.completed.length)return;if(!confirm(`Delete ${d.title} and its segments?`))return;event.days=event.days.filter(day=>day.id!==d.id);selectedId=event.days[0].id;event.selectedDayId=selectedId;save();$('day-editor').close();rebuild();};
$('edit-visit').onclick=()=>{if(preview)return;$('visit-description').value=event.notes;$('visit-editor').showModal();};$('close-visit').onclick=()=>$('visit-editor').close();$('visit-form').onsubmit=e=>{e.preventDefault();if(preview)return;event.notes=$('visit-description').value.trim();save();$('visit-editor').close();render();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(_){$('fullscreen').title='Full screen is unavailable in this browser';}};
document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');});
function setMode(){document.body.classList.toggle('preview-mode',preview);['reset','add','add-bottom','edit-hint','edit-day','add-day','edit-visit'].forEach(id=>$(id).hidden=preview);$('preview').hidden=shared;$('preview').textContent=preview?'Back to editing':'Preview mode';$('share').hidden=!preview;$('preview-notice').hidden=!preview;$('save-status').textContent=preview?'Read-only preview':'Saved on this device';rebuild();}
$('preview').onclick=()=>{preview=!preview;previewEvent=preview?Preview.snapshot(event):null;setMode();};
$('share').onclick=()=>{const url=new URL(location.href);url.hash='preview='+Preview.encode(previewEvent);$('share-url').value=url.href;$('copy-link').textContent='Copy preview link';$('share-note').textContent=['localhost','127.0.0.1'].includes(location.hostname)?'This preview is running locally. Links will work for stakeholders after the app is published.':'This link includes all days, descriptions, and coordination notes.';$('share-dialog').showModal();};
$('close-share').onclick=()=>$('share-dialog').close();$('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText($('share-url').value);$('copy-link').textContent='Copied';}catch(_){$('share-url').focus();$('share-url').select();$('share-note').textContent='Select and copy the link above.';}};
if(!shared)save();setMode();setInterval(render,250);

$('export-pdf').onclick=()=>{const button=$('export-pdf');button.disabled=true;try{const snapshot=Preview.snapshot(view());RunOfShowPDF.create(snapshot,window.jspdf.jsPDF).save(RunOfShowPDF.filename(snapshot));}catch(error){alert('The PDF could not be created. Please try again.');console.error(error);}finally{button.disabled=false;}};
