(function(root){
 const segments=items=>items.map(([title,minutes,description],i)=>({id:String(i),title,minutes,description,color:['lime','teal','violet','blue'][i%4]}));
 const day=(id,dayNumber,title,notes,requestedMinutes,items)=>({id,dayNumber,title,date:`2026-10-${dayNumber}`,startTime:['coaches','athletes'].includes(id)?'18:00':'',planned:['coaches','athletes'].includes(id)?Date.parse(`2026-10-${dayNumber}T18:00:00-04:00`):0,notes,requestedMinutes,segments:segments(items),active:null,completed:[]});
 const api={
  initial(){return {version:2,agendaRevision:'umes-decks-2026-10-14',title:'UMES Campus Onboarding And Activation',timeZone:'America/New_York',notes:'Proposed visit: October 25–28, 2026. Coaches and student-athlete sessions begin at 6 PM Eastern.\nLodging confirmed: Hampton Inn & Suites Salisbury/Fruitland, 304 Prosperity Lane, Fruitland, MD 21826. Two hotel rooms for three nights. Check in on the 25th; check out on the 28th.\nAthletes: 26 across bowling, women’s golf, and men’s golf. One combined session is confirmed.\nRoom: AV-equipped, with reliable Wi-Fi for activities and guided onboarding.\nPractice visits: golf and bowling. Days and times to coordinate.\nGoal: build buy-in through an engaging introduction to mental training and care, with something athletes are excited to continue.',selectedDayId:'coaches',days:[
   day('arrival',25,'Arrival','Arrive and check in at Hampton Inn & Suites Salisbury/Fruitland, 304 Prosperity Lane, Fruitland, MD 21826.',null,[]),
   day('coaches',26,'Coaches Session',"60-minute coach welcome session. Starts at 6 PM Eastern. Room to confirm. Includes the athlete-journey video, coach survey, weekly routine, and support routes.",60,[
    ["Welcome", 5, "An introduction to the pilot, its shared goals, the coaching role, voluntary athlete participation, and the proposed weekly routine."],
    ["Your goals and needs", 7, "Coaches share their team support needs, current challenges, and existing meeting schedules. Discussion focuses on shared themes while respecting athlete privacy."],
    ["The athlete journey on video", 8, "A narrated video introduces the athlete experience, including Nora, daily check-ins, the coach view, team schedules, and care handoffs with athlete authorization. Time is included for questions."],
    ["What we have learned", 5, "A discussion of lessons from the pilot and how voluntary participation and experience over time inform the program."],
    ["Your role and where to refer", 10, "A review of team information available to coaches, athlete privacy, and coaching responsibilities. Discussion covers pathways for routine, non-urgent, and urgent support needs."],
    ["Your weekly routine", 10, "Coaches explore a sample team report, choose a team-level action, and identify a weekly review time of about five minutes. Topics include participation, engagement, wellbeing trends, optional shared sleep and recovery trends, and support pathways."],
    ["Coach survey", 10, "Coaches complete a brief survey on support needs, referral pathways, weekly availability, success measures, and voluntary athlete-leader nominations, followed by questions. Responses focus on team workflow; research participation requires separate authorization."],
    ["Wrap-up and next steps", 5, "A review of the proposed timeline: 20 onboarding days, 90 operational days, early findings around Days 80–90, and Day 110 closeout. The group aligns on athlete onboarding, follow-up, support contacts, and outstanding questions."]
   ]),
   day('athletes',27,'Student-Athlete Session',"90-minute athlete session. Confirmed combined session for 26 athletes across bowling, women’s golf, and men’s golf. Coaches join for the opening address, then leave before the athlete activities begin. Trainers are not in the room for the athlete session. Starts at 6 PM Eastern. AV-equipped room, reliable Wi-Fi, and food arrangements to confirm.",90,[
    ["Welcome and why we are here", 10, "Coaches open with a brief address emphasizing the importance of mental training and their support for the session, then leave the room before the athlete activities begin. Athletes receive a hands-on introduction to focus, composure, and decision-making, learn what to expect, and explore the opportunity to train their mental skills."],
    ["Your game-day story", 15, "A movement and discussion activity explores game-day pressure, pre-game rituals, and barriers to focus. Athletes can share their experiences or choose to pass."],
    ["Reset under pressure", 20, "A brief challenge and guided breathing reset help athletes notice changes in tension. Participation is optional. The session also covers data access, follow-up boundaries, and anonymous feedback before onboarding."],
    ["PulseCheck onboarding and baseline assessment", 20, "Guided support to download PulseCheck, sign in, and complete the 48-question baseline assessment as part of onboarding. Athletes receive help with setup and questions, meet Nora, and learn how to continue using the app."],
    ["Know your team role", 10, "Athletes explore established team roles and athlete personas, identify those they relate to, and discuss how different perspectives contribute to a team."],
    ["What you take with you", 5, "A recap of the breathing reset, first check-in, weekly commitment, trusted support people, and AuntEDNA.ai support within the pilot. Athletes receive a take-home card and an overview of the proposed onboarding and pilot timeline."],
    ["Questions", 10, "Open questions, with an opportunity for private questions after the group closes. Athletes can submit anonymous feedback and receive follow-up contact information."]
   ]),
   day('departure',28,'Departure','Check out after three nights and depart. Departure time and travel arrangements to confirm.',null,[])
  ]};},
  mergeBaseline(event){
   return {...event,days:event.days.map(d=>{
    if(d.id!=='athletes'||d.segments.some(s=>s.title==='PulseCheck onboarding and baseline assessment'))return d;
    const onboarding=d.segments.find(s=>s.title==='Get set up on PulseCheck'),baseline=d.segments.find(s=>s.title==='Baseline assessment');
    if(!onboarding)return d;
    const source=api.initial().days.find(x=>x.id==='athletes').segments.find(s=>s.title==='PulseCheck onboarding and baseline assessment');
    return {...d,segments:d.segments.filter(s=>s!==baseline).map(s=>s===onboarding?{...s,title:source.title,description:source.description,minutes:s.minutes+(baseline?.minutes||0)}:s)};
   })};
  },
  staffFacing(event){
   if(event.copyRevision==='staff-facing-2026-10-14')return event;
   const defaults=api.initial();
   return {...event,copyRevision:'staff-facing-2026-10-14',days:event.days.map(d=>{
    const source=defaults.days.find(x=>x.id===d.id);if(!source)return d;
    return {...d,segments:d.segments.map(s=>{const match=source.segments.find(x=>x.title===s.title);return match?{...s,description:match.description}:s;})};
   })};
  },
  alignSessionDecks(event){
   if(event.agendaRevision==='umes-decks-2026-10-14')return event;
   const ids=['coaches','athletes'];
   if(!ids.every(id=>event.days.some(d=>d.id===id))||event.days.some(d=>ids.includes(d.id)&&(d.active||d.completed.length)))return event;
   const defaults=api.initial();
   return {...event,agendaRevision:defaults.agendaRevision,days:event.days.map(d=>{
    if(!ids.includes(d.id))return d;
    const source=defaults.days.find(s=>s.id===d.id);
    return {...d,segments:source.segments,notes:source.notes,requestedMinutes:source.requestedMinutes};
   })};
  },
  label(day){return day.date?new Date(day.date+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'short',month:'long',day:'numeric',year:'numeric'}):day.dayNumber?`${day.dayNumber}th · Month TBD`:'Date TBD';},
  timestamp(date,time,timeZone){if(!time)return 0;const target=Date.parse((date||'2000-01-01')+'T'+time+':00Z');let result=target;for(let i=0;i<3;i++){const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(result);const get=t=>parts.find(p=>p.type===t).value;const represented=Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);result+=target-represented;}return result;},
  fromLegacy(old){const tz=old.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone;const parts=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(old.planned);const get=t=>parts.find(p=>p.type===t).value;return {version:2,title:old.title,timeZone:tz,notes:'',selectedDayId:'legacy',days:[{...old,id:'legacy',date:`${get('year')}-${get('month')}-${get('day')}`,startTime:`${get('hour')}:${get('minute')}`,dayNumber:null,notes:'',requestedMinutes:null}]};}
 };
 if(typeof module!=='undefined')module.exports=api;else root.Visit=api;
})(typeof window!=='undefined'?window:globalThis);
