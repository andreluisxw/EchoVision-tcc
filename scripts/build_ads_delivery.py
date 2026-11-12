"""Build the academic package from the retained Fatec Franca ADS template."""
from pathlib import Path
from copy import deepcopy
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json, re, argparse
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.enum.section import WD_SECTION_START
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from scripts.export_policy import is_exportable_source

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/entrega-fatec-franca'
REF=ROOT/'docs/referencias-oficiais/modelo-projeto-software-ads.docx'
MAIN=ROOT/'docs/projeto-software-ads.md'
TITLE='Plataforma web colaborativa para registro e consulta de ocorrências ambientais'
AUTHORS=['Guilherme Henrique Campos da Silva','André Luis Maia Junior']
OUT.mkdir(parents=True,exist_ok=True)

def clean_markup(value):
    value=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',r'\1 (\2)',value)
    return value.replace('`','').replace('**','').replace('☐','[ ]').replace('☑','[x]')

def style_setup(doc):
    # Derive new roles from the retained template rather than replacing its styles.
    for name in ['ADS Heading 1','ADS Heading 2','ADS Summary','ADS Caption','ADS Code','ADS Cell','ADS TOC']:
        if name not in doc.styles:doc.styles.add_style(name,WD_STYLE_TYPE.PARAGRAPH)
        style=doc.styles[name];style.base_style=doc.styles['Normal']
        style.font.name='Arial';style.font.color.rgb=RGBColor(0,0,0)
        fmt=style.paragraph_format
        if name.startswith('ADS Heading'):
            style.font.size=Pt(14 if name.endswith('1') else 12);style.font.bold=True
            fmt.first_line_indent=Cm(0);fmt.space_before=Pt(18);fmt.space_after=Pt(12);fmt.keep_with_next=True
            fmt.line_spacing=1.5
            outline=OxmlElement('w:outlineLvl');outline.set(qn('w:val'),'0' if name.endswith('1') else '1');style.element.get_or_add_pPr().append(outline)
        elif name=='ADS Summary':
            style.font.size=Pt(12);fmt.first_line_indent=Cm(0);fmt.line_spacing=1;fmt.space_after=Pt(12)
        elif name=='ADS Caption':
            style.font.size=Pt(10);fmt.first_line_indent=Cm(0);fmt.line_spacing=1;fmt.space_before=Pt(6);fmt.space_after=Pt(6)
        elif name=='ADS Code':
            style.font.name='Courier New';style.font.size=Pt(9);fmt.first_line_indent=Cm(0);fmt.line_spacing=1;fmt.keep_with_next=True
        elif name=='ADS Cell':
            style.font.size=Pt(10);fmt.first_line_indent=Cm(0);fmt.line_spacing=1;fmt.space_after=Pt(3);fmt.alignment=WD_ALIGN_PARAGRAPH.LEFT
        elif name=='ADS TOC':
            style.font.size=Pt(11);fmt.first_line_indent=Cm(0);fmt.line_spacing=1;fmt.space_after=Pt(5)
    for section in doc.sections:
        section.page_width=Cm(21);section.page_height=Cm(29.7)
        section.top_margin=Cm(3);section.left_margin=Cm(3);section.right_margin=Cm(2);section.bottom_margin=Cm(2)
    setting=OxmlElement('w:updateFields');setting.set(qn('w:val'),'true');doc.settings.element.append(setting)

def paragraph(doc,text,style=None):
    p=doc.add_paragraph(style=style or 'Normal')
    # Preserve inline emphasis without printing Markdown syntax.
    for i,part in enumerate(re.split(r'(\*\*.*?\*\*)',text)):
        run=p.add_run(clean_markup(part));run.bold=True if part.startswith('**') else None
    return p

def add_table(doc,rows):
    n=max(map(len,rows));table=doc.add_table(rows=0,cols=n);table.autofit=False
    # Give short identifiers less room; distribute the remaining width.
    short=n>=3 and rows[0][0] in ['ID','Caso']
    widths=([1.6]+[(16-1.6)/(n-1)]*(n-1)) if short else [16/n]*n
    if n==2:widths=[4,12]
    if rows[0][0]=='Indicador':widths=[4.8,4.3,6.9]
    if rows[0][0]=='Caso':widths=[1.8,7.1,7.1]
    if n==4 and rows[0][-1]=='Estado':widths=[1.7,9.0,2.5,2.8]
    if n==4 and rows[0][0]=='ID' and rows[0][-1]=='Requisitos':widths=[1.7,5.5,4.1,4.7]
    for col,width in zip(table.columns,widths):col.width=Cm(width)
    props=table._tbl.tblPr
    borders=OxmlElement('w:tblBorders')
    for name in ['top','left','bottom','right','insideH','insideV']:
        edge=OxmlElement('w:'+name);edge.set(qn('w:val'),'single');edge.set(qn('w:sz'),'4');edge.set(qn('w:color'),'B7B7B7');borders.append(edge)
    props.append(borders)
    for i,values in enumerate(rows):
        cells=table.add_row().cells
        trPr=table.rows[-1]._tr.get_or_add_trPr();trPr.append(OxmlElement('w:cantSplit'))
        if i==0:trPr.append(OxmlElement('w:tblHeader'))
        for j,cell in enumerate(cells):
            cell.width=Cm(widths[j]);p=cell.paragraphs[0];p.style=doc.styles['ADS Cell'];p.add_run(clean_markup(values[j] if j<len(values) else '')).bold=(i==0)
            if i==0:
                fill=OxmlElement('w:shd');fill.set(qn('w:fill'),'EDEDED');cell._tc.get_or_add_tcPr().append(fill)
    doc.add_paragraph().paragraph_format.space_after=Pt(0)

def parse_body(doc,text,main=False,pages=None):
    lines=text.splitlines();i=0;code=False;section='';started=False
    while i<len(lines):
        line=lines[i].strip();i+=1
        if not line:continue
        if line.startswith('# '):continue
        if line.startswith('```'):
            code=not code;continue
        if code:
            paragraph(doc,line,'ADS Code');continue
        match=re.match(r'^(#{2,6})\s+(.*)',line)
        if match:
            depth=len(match[1]);heading=match[2];section=heading
            if main and heading=='1 Introdução':
                add_toc(doc,text,pages)
                s=doc.add_section(WD_SECTION_START.NEW_PAGE)
                pg=s._sectPr.find(qn('w:pgNumType'))
                if pg is not None:pg.attrib.pop(qn('w:start'),None)
                s.header.is_linked_to_previous=False
                for p in s.header.paragraphs:p.clear()
                hp=s.header.paragraphs[0];hp.alignment=WD_ALIGN_PARAGRAPH.RIGHT;hp.paragraph_format.first_line_indent=Cm(0)
                field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');hp._p.append(field)
                started=True
            p=paragraph(doc,heading,'ADS Heading 1' if depth==2 else 'ADS Heading 2')
            if depth==2:
                if not main or heading!='1 Introdução':p.paragraph_format.page_break_before=True
                if heading in ['Resumo','Abstract']:p.alignment=WD_ALIGN_PARAGRAPH.CENTER
            continue
        if line.startswith('|'):
            rows=[]
            while True:
                cells=[v.strip() for v in line.strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?',v.replace(' ','')) for v in cells):rows.append(cells)
                if i>=len(lines) or not lines[i].strip().startswith('|'):break
                line=lines[i].strip();i+=1
            add_table(doc,rows);continue
        image=re.match(r'!\[([^]]*)\]\(([^)]+)\)',line)
        if image:
            path=ROOT/'docs'/image[2]
            if not path.exists():raise FileNotFoundError(path)
            p=doc.add_paragraph();p.paragraph_format.first_line_indent=Cm(0);p.paragraph_format.keep_with_next=True;p.alignment=WD_ALIGN_PARAGRAPH.CENTER
            p.add_run().add_picture(str(path),width=Cm(16));continue
        if re.fullmatch('[-*_]{3,}',line):continue
        style='Normal'
        if line.startswith(('Figura ','Quadro ','Trecho ','Fonte:')):style='ADS Caption'
        if section in ['Resumo','Abstract']:style='ADS Summary'
        if section=='Referências':style='ADS Summary'
        line=re.sub(r'^>\s*','',line)
        line=re.sub(r'^- \[ \] ','[ ] ',line);line=re.sub(r'^- \[x\] ','[x] ',line)
        line=re.sub(r'^[-*] ','• ',line)
        p=paragraph(doc,line,style)
        if style=='ADS Caption' and not line.startswith('Fonte:'):p.paragraph_format.keep_with_next=True
        if section=='Abstract':
            for run in p.runs:run.italic=True
    return doc

def add_toc(doc,text,pages):
    p=paragraph(doc,'Sumário','ADS Heading 1');p.paragraph_format.page_break_before=True;p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    headings=re.findall(r'^(#{2,3}) (.+)$',text,re.M)
    for level,h in headings:
        if h in ['Resumo','Abstract']:continue
        num=(pages or {}).get(h,'—')
        p=paragraph(doc,f'{h}\t{num}','ADS TOC')
        if level=='###':p.paragraph_format.left_indent=Cm(0.5)
        from docx.enum.text import WD_TAB_ALIGNMENT,WD_TAB_LEADER
        p.paragraph_format.tab_stops.add_tab_stop(Cm(16),WD_TAB_ALIGNMENT.RIGHT,WD_TAB_LEADER.DOTS)

def cover(doc):
    p=doc.paragraphs
    replacements={10:'\n'.join(AUTHORS),14:TITLE,15:'',21:'Orientador: Prof. Leonardo Henrique Raiz',25:'FRANCA/SP',26:'2026'}
    for i,value in replacements.items():
        sample=deepcopy(p[i].runs[0]._r.rPr) if p[i].runs and p[i].runs[0]._r.rPr is not None else None
        p[i].clear();r=p[i].add_run(value)
        if sample is not None:r._r.insert(0,sample)
        r.font.highlight_color=None
    # Both author names and the long title fit by reclaiming empty template rows.
    for i in [6,7,8,9,11,12,13,16,17,18,20,22,23,24]:
        p[i].paragraph_format.line_spacing=Pt(2);p[i].paragraph_format.space_before=Pt(0);p[i].paragraph_format.space_after=Pt(0)
        for r in p[i].runs:r.font.size=Pt(5)
    for i in [0,1,2]:p[i].paragraph_format.space_after=Pt(0);p[i].paragraph_format.first_line_indent=Cm(0)
    p[10].paragraph_format.first_line_indent=Cm(0);p[10].paragraph_format.space_before=Pt(12)
    p[14].paragraph_format.first_line_indent=Cm(0);p[14].paragraph_format.space_before=Pt(12)
    p[19].paragraph_format.space_before=Pt(12)
    p[25].paragraph_format.first_line_indent=Cm(0);p[25].paragraph_format.space_before=Pt(12)
    p[26].paragraph_format.first_line_indent=Cm(0)

def base_from_template():
    doc=Document(REF)
    body=doc.element.body
    boundary=doc.paragraphs[27]._p
    found=False
    for child in list(body):
        if child is boundary:found=True;continue
        if found and child.tag!=qn('w:sectPr'):body.remove(child)
    style_setup(doc);cover(doc)
    # Start pre-text page count after the cover, without displaying it.
    s=doc.sections[1];s.start_type=WD_SECTION_START.NEW_PAGE
    pg=s._sectPr.find(qn('w:pgNumType'))
    if pg is None:pg=OxmlElement('w:pgNumType');s._sectPr.append(pg)
    pg.set(qn('w:start'),'1')
    doc.core_properties.author='; '.join(AUTHORS);doc.core_properties.title=TITLE
    return doc

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--pages');args=parser.parse_args()
    pages=json.loads(Path(args.pages).read_text(encoding='utf-8')) if args.pages else None
    doc=base_from_template();parse_body(doc,MAIN.read_text(encoding='utf-8'),True,pages)
    path=OUT/'tg_ads_echovision_2026.docx';doc.save(path)
    refhash=hashlib.sha256(REF.read_bytes()).hexdigest()
    (ROOT/'tmp/entrega/template-inventory.json').write_text(json.dumps({'sha256':refhash,'parts':{n:hashlib.sha256(b).hexdigest() for n,b in ((n,ZipFile(REF).read(n)) for n in ZipFile(REF).namelist())}},indent=2),encoding='utf-8')
    # Supplemental records remain separate from the academic narrative.
    candidates=[ROOT/'README.md',*(ROOT/'docs').rglob('*.md')]
    sources=sorted(p for p in candidates if is_exportable_source(p) and p.name not in ['tcc-relatorio-completo.md','projeto-software-ads.md'] and 'referencias-oficiais' not in p.parts)
    for source in sources:
        if not source.exists():continue
        d=Document(REF)
        for child in list(d.element.body):
            if child.tag!=qn('w:sectPr'):d.element.body.remove(child)
        style_setup(d)
        text=source.read_text(encoding='utf-8-sig')
        title=next((l[2:] for l in text.splitlines() if l.startswith('# ')),source.stem)
        p=paragraph(d,title,'ADS Heading 1');p.paragraph_format.page_break_before=False
        paragraph(d,'Documento complementar ao Projeto de Software de ADS · Fatec Franca · 2026','ADS Caption')
        parse_body(d,text)
        # Supplemental sections flow continuously rather than making each checklist page a chapter.
        for p in d.paragraphs:
            if p.style.name=='ADS Heading 1':p.paragraph_format.page_break_before=False
        target=OUT/'complementos'/source.relative_to(ROOT).with_suffix('.docx');target.parent.mkdir(parents=True,exist_ok=True);d.save(target)
    print(path)

if __name__=='__main__':main()
