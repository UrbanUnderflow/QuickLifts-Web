export type DateView='month'|'this-year'|'last-year'|'last-seven';
export function dateViewRange(view:DateView,year:number,month:number,now=new Date()) {
 const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 if(view==='month')return {start:iso(new Date(year,month-1,1)),end:iso(new Date(year,month,0)),label:new Date(year,month-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})};
 if(view==='last-seven'){const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());start.setDate(start.getDate()-6);return {start:iso(start),end:iso(now),label:`Last 7 days · ${iso(start)}–${iso(now)}`};}
 const y=now.getFullYear()-(view==='last-year'?1:0);return {start:`${y}-01-01`,end:view==='last-year'?`${y}-12-31`:iso(now),label:view==='last-year'?`${y}`:`${y} year to date`};
}
