(function(root){
 const api={
  snapshot(state){if(state.version===2){return {version:2,title:state.title,timeZone:state.timeZone,notes:state.notes,selectedDayId:state.selectedDayId,days:state.days.map(d=>({...api.snapshot({...d,timeZone:state.timeZone}),id:d.id,date:d.date,startTime:d.startTime,dayNumber:d.dayNumber,notes:d.notes,requestedMinutes:d.requestedMinutes}))};}return {version:1,title:state.title,planned:state.planned,timeZone:state.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone,segments:state.segments.map((s,i)=>({id:String(i),title:s.title,description:s.description||'',minutes:s.minutes,color:s.color})),active:null,completed:[]};},
  encode(state){const bytes=new TextEncoder().encode(JSON.stringify(api.snapshot(state)));return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');},
  decode(value){
   if(!value||value.length>500000)throw Error('Invalid preview');
   const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));
   if(data.version===2){
    if(typeof data.title!=='string'||data.title.length>100||typeof data.notes!=='string'||data.notes.length>10000||!Array.isArray(data.days)||!data.days.length||data.days.length>100||new Set(data.days.map(d=>d.id)).size!==data.days.length)throw Error('Invalid visit');
    new Intl.DateTimeFormat('en-US',{timeZone:data.timeZone}).format();
    for(const d of data.days){if(typeof d.id!=='string'||d.id.length>100||typeof d.notes!=='string'||d.notes.length>10000||typeof d.date!=='string'||(d.date&&!/^\d{4}-\d{2}-\d{2}$/.test(d.date))||typeof d.startTime!=='string'||(d.startTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.startTime))||(d.dayNumber!==null&&(!Number.isInteger(d.dayNumber)||d.dayNumber<1||d.dayNumber>31))||(d.requestedMinutes!==null&&(!Number.isInteger(d.requestedMinutes)||d.requestedMinutes<1||d.requestedMinutes>1440)))throw Error('Invalid day');api.decode(api.encode({...d,version:1}));}
    return api.snapshot(data);
   }
   if(data.version!==1||typeof data.title!=='string'||data.title.length>100||!Number.isFinite(data.planned)||!Number.isFinite(new Date(data.planned).getTime())||!Array.isArray(data.segments)||data.segments.length>500||!data.segments.every(s=>typeof s.title==='string'&&s.title.length<=120&&typeof s.description==='string'&&s.description.length<=2000&&Number.isInteger(s.minutes)&&s.minutes>=1&&s.minutes<=1440&&['lime','teal','violet','blue'].includes(s.color)))throw Error('Invalid preview');
   new Intl.DateTimeFormat('en-US',{timeZone:data.timeZone}).format(data.planned);
   return api.snapshot(data);
  }
 };
 if(typeof module!=='undefined')module.exports=api;else root.Preview=api;
})(typeof window!=='undefined'?window:globalThis);
