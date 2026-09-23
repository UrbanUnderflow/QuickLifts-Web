import { jsPDF } from 'jspdf';

/** Text-based export avoids browser print headers, URLs and timestamps. */
export function buildEquityCleanPdf(content: string) {
  const pdf = new jsPDF({unit:'pt',format:'letter'});
  const margin=54, bottom=730, width=504;
  let y=margin;
  const printable = content.replace(/((?:By|Director Signature):[^\n]*)(\n\nName:[^\n]*)(\n\nTitle:[^\n]*)?(\n\nDate of Execution:[^\n]*)/g, block => block.replace(/\n\n/g, '\n'));
  for (const paragraph of printable.split(/\n\s*\n/)) {
    if (paragraph.trim() === '[DOCUMENT PAGE BREAK]') { pdf.addPage(); y=margin; continue; }
    if (/^ATTACHMENTS TO BE PRESENTED/.test(paragraph) && y + 210 > bottom) { pdf.addPage(); y=margin; }
    if (/^## SECTION 8/.test(paragraph) && y + 260 > bottom) { pdf.addPage(); y=margin; }
    const heading=/^#{1,3}\s/.test(paragraph) || (/^\d+\.(?:\d+)?\s/.test(paragraph) && paragraph.length < 100) || (/^[A-Z][A-Z ,.;—–-]+$/.test(paragraph) && paragraph.length < 100);
    const text=paragraph.replace(/^#{1,3}\s/, '').replace(/\*\*/g,'').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-').replace(/…/g,'...');
    const size=heading ? 12 : 10.5;
    const step=heading ? 16 : 14;
    pdf.setFont('times',heading ? 'bold':'normal'); pdf.setFontSize(size);
    const lines=pdf.splitTextToSize(text,width) as string[];
    if (y + (heading ? lines.length*step+28 : /^(By|Director Signature):/.test(paragraph) ? lines.length*step : Math.min(lines.length,3)*step) > bottom) {pdf.addPage();y=margin;}
    for (const line of lines) {
      if(y+step>bottom){pdf.addPage();y=margin;}
      pdf.text(line,margin,y); y+=step;
    }
    y+=9;
  }
  const count=pdf.getNumberOfPages();
  for(let page=1;page<=count;page++) {pdf.setPage(page);pdf.setFont('times','normal');pdf.setFontSize(9);pdf.text(`${page} / ${count}`,306,760,{align:'center'});}
  return pdf;
}
export function downloadEquityCleanPdf(title:string, content:string) {
  buildEquityCleanPdf(content).save(`${title.replace(/[^a-zA-Z0-9 ._-]/g,'')}.pdf`);
}
