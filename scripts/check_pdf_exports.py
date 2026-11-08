from pathlib import Path
import os
import shutil
import subprocess
from PIL import Image, ImageOps, ImageDraw
from pypdf import PdfReader
from scripts.export_policy import is_exportable_source
ROOT=Path(__file__).resolve().parents[1]
TEMP=Path(os.environ.get('PDF_QA_DIR', ROOT/'tmp'/'pdfs'));TEMP.mkdir(parents=True,exist_ok=True)
POPPLER=os.environ.get('PDFTOPPM') or shutil.which('pdftoppm')
if not POPPLER:
    raise RuntimeError('pdftoppm não encontrado; defina PDFTOPPM ou adicione o executável ao PATH')
tiles=[]
pdfs=(pdf for pdf in (ROOT/'output'/'pdf').rglob('*.pdf') if is_exportable_source(pdf))
for n,pdf in enumerate(sorted(pdfs)):
    prefix=TEMP/f'doc-{n:02}'
    subprocess.run([str(POPPLER),'-scale-to','550','-png',str(pdf),str(prefix)],check=True,capture_output=True)
    for page in sorted(TEMP.glob(f'doc-{n:02}-*.png')):
        img=Image.open(page).convert('RGB')
        tile=Image.new('RGB',(300,450),'#d7ddd9')
        preview=ImageOps.contain(img,(290,415));tile.paste(preview,((300-preview.width)//2,25))
        ImageDraw.Draw(tile).text((5,5),f'{n+1}: {pdf.stem[:27]} / {page.stem.split("-")[-1]}',fill='black')
        tiles.append(tile)
for group in range(0,len(tiles),20):
    sheet=Image.new('RGB',(1500,1800),'#b6bfb8')
    for index,tile in enumerate(tiles[group:group+20]):sheet.paste(tile,((index%5)*300,(index//5)*450))
    target=TEMP/f'contact-{group//20+1}.jpg';sheet.save(target,quality=90);print(target)
