from pathlib import Path
import json,re,html
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,KeepTogether,Table,TableStyle
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from pypdf import PdfReader
root=Path.cwd();items=json.loads((root/'src/content/equity/edna-capitalization-approvals.json').read_text())
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='Legal',fontName='Times-Roman',fontSize=11,leading=14,spaceAfter=8))
styles.add(ParagraphStyle(name='LegalHead',fontName='Times-Bold',fontSize=11,leading=14,spaceBefore=7,spaceAfter=7,keepWithNext=True))
styles.add(ParagraphStyle(name='LegalTitle',fontName='Times-Bold',fontSize=13,leading=16,alignment=TA_CENTER,spaceAfter=10))
styles.add(ParagraphStyle(name='CellLegal',fontName='Times-Roman',fontSize=9,leading=12))
def footer(c,d):
 c.setFont('Times-Roman',9);c.setFillColor(colors.HexColor('#555555'));c.drawString(54,32,'Pulse Intelligence Labs, Inc. | Confidential');c.drawRightString(558,32,f'Page {d.page}')
for key,item in items.items():
 target=root/'output/pdf'/item['fileName'].replace('.txt','.pdf')
 story=[]
 for i,para in enumerate(item['content'].strip().split('\n\n')):
  if ' | ' in para:
   rows=[line.split(' | ') for line in para.splitlines()]
   cols=max(len(row) for row in rows)
   if min(len(row) for row in rows)!=cols:
    for row in rows:story.append(Paragraph(html.escape(' | '.join(row)),styles['Legal']))
   else:
    widths=[240,80,184] if cols==3 and key=='certificate' and rows[0][0]=='Category' else [180,90,234] if cols==3 else [504/cols]*cols
    table=Table([[Paragraph(html.escape(cell),styles['CellLegal']) for cell in row] for row in rows],colWidths=widths,hAlign='LEFT')
    table.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,colors.HexColor('#bbbbbb')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    story.extend([table,Spacer(1,9)])
  else:
   sty=styles['LegalTitle'] if i==0 else styles['LegalHead'] if re.match(r'^\d+\. [A-Z ]+$',para) or para=='ATTACHMENT' else styles['Legal']
   p=Paragraph(html.escape(para).replace('\n','<br/>'),sty)
   story.append(KeepTogether([p]) if 'Signature: ' in para else p)
 SimpleDocTemplate(str(target),pagesize=(612,792),leftMargin=54,rightMargin=54,topMargin=46,bottomMargin=50,title=item['title'],author='Pulse Intelligence Labs, Inc.').build(story,onFirstPage=footer,onLaterPages=footer)
 reader=PdfReader(target)
 print(target.name,len(reader.pages),'pages')
 for n,page in enumerate(reader.pages):
  if not page.extract_text().strip():raise Exception('Blank page')
