"""Export repository documentation to readable PDFs without modifying sources."""
from pathlib import Path
import re
from html import escape
from zipfile import ZipFile, ZIP_DEFLATED
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT
from docx import Document
from docx.table import Table as WordTable
from docx.text.paragraph import Paragraph as WordParagraph
from pypdf import PdfReader
from scripts.export_policy import is_exportable_source

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'pdf'
FONT = Path('C:/Windows/Fonts')
pdfmetrics.registerFont(TTFont('Body', str(FONT / 'arial.ttf')))
pdfmetrics.registerFont(TTFont('BodyBold', str(FONT / 'arialbd.ttf')))
pdfmetrics.registerFont(TTFont('BodyItalic', str(FONT / 'ariali.ttf')))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyBold', italic='BodyItalic', boldItalic='BodyBold')
styles = getSampleStyleSheet()
for name in ['Normal', 'Title', 'Heading1', 'Heading2', 'Heading3']:
    styles[name].fontName = 'BodyBold' if name != 'Normal' else 'Body'
styles['Normal'].fontSize = 10
styles['Normal'].leading = 15
styles['Normal'].spaceAfter = 7
styles['Title'].fontSize = 21
styles['Title'].leading = 27
styles['Title'].spaceAfter = 18
styles['Heading1'].fontSize = 16
styles['Heading1'].leading = 21
styles['Heading2'].fontSize = 13
styles['Heading2'].leading = 18
styles.add(ParagraphStyle(name='Cell', parent=styles['Normal'], fontSize=8, leading=11, spaceAfter=0, wordWrap='CJK'))
styles.add(ParagraphStyle(name='CodeLine', fontName='Body', fontSize=8, leading=11, spaceAfter=1, wordWrap='CJK', backColor=colors.HexColor('#f0f3f5')))

def inline(s):
    s = escape(s).replace('☐', '[ ]').replace('☑', '[x]').replace('✓', '[x]')
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1 (\2)', s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'`([^`]+)`', r'<font color="#37526b">\1</font>', s)
    return s

def table(rows):
    width = 483
    count = max(len(row) for row in rows)
    data = [[Paragraph(inline(cell), styles['Cell']) for cell in row + [''] * (count-len(row))] for row in rows]
    item = Table(data, colWidths=[width/count]*count, repeatRows=1, hAlign='LEFT')
    item.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e6eee9')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,0),(-1,0),.7,colors.HexColor('#789183')),('LINEBELOW',(0,1),(-1,-1),.25,colors.HexColor('#d8dfda'))]))
    return item

def markdown_story(text):
    story=[]; lines=text.splitlines(); i=0; code=False
    while i<len(lines):
        line=lines[i]; i+=1
        if line.startswith('```'):
            code=not code; story.append(Spacer(1,6)); continue
        if code:
            # Wrap even long commands without clipping the page.
            story.append(Paragraph(escape(line).replace(' ', '&#160;') or '&#160;',styles['CodeLine'])); continue
        if not line.strip(): continue
        if line.startswith('|'):
            rows=[]
            while True:
                cells=[c.strip() for c in line.strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?',c.replace(' ','')) for c in cells):rows.append(cells)
                if i>=len(lines) or not lines[i].startswith('|'):break
                line=lines[i]; i+=1
            story.extend([table(rows),Spacer(1,10)]); continue
        match=re.match(r'^(#{1,6})\s+(.*)',line)
        if match:
            level=len(match[1]); style='Title' if level==1 and not story else f'Heading{min(level,3)}'
            story.append(Paragraph(inline(match[2]),styles[style]));continue
        if re.fullmatch(r'[-*_]{3,}',line.strip()):continue
        line=re.sub(r'^>\s*','',line)
        line=re.sub(r'^- \[ \] ','[ ] ',line)
        line=re.sub(r'^- \[x\] ','[x] ',line)
        line=re.sub(r'^[-*] ','• ',line)
        story.append(Paragraph(inline(line),styles['Normal']))
    return story

def word_story(path):
    doc=Document(path);story=[]
    for element in doc.element.body:
        if element.tag.endswith('}p'):
            p=WordParagraph(element,doc)
            if not p.text.strip():continue
            name=p.style.name if p.style else ''
            style='Title' if name=='Title' else 'Heading2' if name.startswith('Heading') else 'Normal'
            story.append(Paragraph(inline(p.text),styles[style]))
        elif element.tag.endswith('}tbl'):
            rows=[[c.text for c in row.cells] for row in WordTable(element,doc).rows]
            story.extend([table(rows),Spacer(1,10)])
    return story

def footer(canvas,doc):
    canvas.saveState();canvas.setFont('Body',8);canvas.setFillColor(colors.HexColor('#67736b'))
    canvas.drawString(56,30,'Raiz | Documentação do projeto')
    canvas.drawRightString(539,30,str(doc.page));canvas.restoreState()

def main():
    candidates=[*ROOT.glob('*.md'),*ROOT.glob('*.docx'),*(ROOT/'docs').rglob('*.md')]
    sources=sorted(source for source in candidates if is_exportable_source(source))
    manifest=[]
    for source in sources:
        target=OUT/source.relative_to(ROOT).with_suffix('.pdf');target.parent.mkdir(parents=True,exist_ok=True)
        story=word_story(source) if source.suffix=='.docx' else markdown_story(source.read_text(encoding='utf-8-sig'))
        SimpleDocTemplate(str(target),pagesize=(595.28,841.89),leftMargin=56,rightMargin=56,topMargin=52,bottomMargin=52,title=source.stem,author='Projeto Raiz').build(story,onFirstPage=footer,onLaterPages=footer)
        reader=PdfReader(target)
        if not reader.pages or not any(p.extract_text().strip() for p in reader.pages):raise RuntimeError(f'PDF vazio: {target}')
        manifest.append((target,len(reader.pages)))
        print(f'{target.relative_to(OUT)}: {len(reader.pages)} páginas')
    with ZipFile(OUT/'documentacao-raiz-pdfs.zip','w',ZIP_DEFLATED) as archive:
        for path,_ in manifest:archive.write(path,path.relative_to(OUT))
    print(f'TOTAL: {len(manifest)} PDFs, {sum(pages for _,pages in manifest)} páginas')

if __name__=='__main__':main()
