(function(root){
 const clean=value=>String(value||'').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/[^\x20-\x7E\n\xA0-\xFF]/g,'');
 function create(event,jsPDF){
  const doc=new jsPDF({unit:'pt',format:'letter',compress:true});
  const left=44,width=524,bottom=738;let y=0,section='Visit overview';
  const total=d=>d.segments.reduce((n,s)=>n+s.minutes,0);
  const date=d=>d.date?new Date(d.date+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'}):d.dayNumber?`Day ${d.dayNumber} · Month TBD`:'Date TBD';
  const clock=n=>new Date(n).toLocaleTimeString('en-US',{timeZone:event.timeZone,hour:'numeric',minute:'2-digit'});
  function header(){doc.setFillColor(27,43,35);doc.rect(0,0,612,7,'F');doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(27,43,35);doc.text('AthleticMind | PulseCheck and auntEDNA.ai',left,35);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(85,98,89);doc.text('RUN OF SHOW',568,35,{align:'right'});doc.setDrawColor(216,224,214);doc.line(left,48,568,48);y=72;}
  function page(){doc.addPage();header();doc.setFontSize(10);doc.text(clean(section)+' · continued',left,y);y+=24;}
  function lines(text,size=10.5,w=width,bold=false){doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);return doc.splitTextToSize(clean(text),w);}
  function paragraph(text,{size=10.5,color=[64,75,66],gap=12,bold=false}={}){const list=lines(text,size,width,bold);doc.setTextColor(...color);for(const line of list){if(y+size*1.4>bottom)page();doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);doc.text(line,left,y);y+=size*1.4;}y+=gap;}
  function heading(text,size=23){paragraph(text,{size,bold:true,color:[27,43,35],gap:12});}
  function row(label,body){const head=lines(label,11,width,true),desc=lines(body,10.5);const h=head.length*15+desc.length*14+22;if(y+h>bottom)page();paragraph(label,{size:11,bold:true,gap:3});paragraph(body,{gap:12});}
  header();heading(event.title||'Run of Show',25);paragraph(`${event.days.length} days · ${event.days.reduce((n,d)=>n+total(d),0)} minutes of planned sessions\nTimes shown in ${event.timeZone.replaceAll('_',' ')}.`,{size:10,gap:18});
  heading('Visit at a glance',15);
  for(const d of event.days){row(`${date(d)}  |  ${d.title}`,d.segments.length?`${total(d)} minutes · ${d.startTime?'Planned start '+clock(d.planned):'Start time TBD'}${d.requestedMinutes&&total(d)!==d.requestedMinutes?` · ${d.requestedMinutes} minutes requested`:''}`:d.notes||'No timed segments planned.');}
  if(event.notes){heading('Coordination notes',15);paragraph(event.notes,{size:10.5});}
  for(const day of event.days.filter(d=>d.segments.length)){
   section=day.title;doc.addPage();header();paragraph(date(day),{size:10,bold:true,gap:8});heading(day.title);paragraph(`${total(day)} minutes · ${day.segments.length} segments · ${day.startTime?'Planned start '+clock(day.planned):'Start time TBD; timings below are minutes from session start.'}`,{size:10,gap:10});if(day.notes)paragraph(day.notes,{size:10,gap:18});
   let offset=0;
   for(const [i,s] of day.segments.entries()){
    const timing=day.startTime?`${clock(day.planned+offset*60000)} - ${clock(day.planned+(offset+s.minutes)*60000)}`:`+${offset} to +${offset+s.minutes} min`;
    const title=lines(`${String(i+1).padStart(2,'0')}  ${s.title}`,12,width,true),desc=lines(s.description||'',10.5);
    const needed=22+title.length*16+desc.length*14.7+24;
    if(y+needed>bottom&&needed<bottom-100)page();
    if(y+65>bottom)page();
    doc.setDrawColor(211,221,207);doc.line(left,y-13,568,y-13);paragraph(`${timing}  |  ${s.minutes} minutes`,{size:9,bold:true,color:[75,97,62],gap:5});paragraph(`${String(i+1).padStart(2,'0')}  ${s.title}`,{size:12,bold:true,color:[27,43,35],gap:5});if(s.description)paragraph(s.description,{size:10.5,gap:16});else y+=10;offset+=s.minutes;
   }
  }
  const count=doc.getNumberOfPages();for(let n=1;n<=count;n++){doc.setPage(n);doc.setDrawColor(216,224,214);doc.line(left,753,568,753);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(96,106,98);doc.text('AthleticMind | PulseCheck and auntEDNA.ai · Planned schedule',left,770);doc.text(`${n} / ${count}`,568,770,{align:'right'});}
  doc.setProperties({title:clean(event.title)+' | Run of Show',author:'AthleticMind | PulseCheck and auntEDNA.ai',subject:'Planned visit schedule'});return doc;
 }
 const api={create,filename:event=>(clean(event.title).replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'')||'Run-of-Show')+'.pdf'};
 if(typeof module!=='undefined')module.exports=api;else root.RunOfShowPDF=api;
})(typeof window!=='undefined'?window:globalThis);
