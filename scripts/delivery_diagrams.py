from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/assets/entrega';OUT.mkdir(parents=True,exist_ok=True)
FONT='C:/Windows/Fonts/arial.ttf'
def start(w=1600,h=900):
    im=Image.new('RGB',(w,h),'white');return im,ImageDraw.Draw(im)
def text(d,x,y,label,size=26):
    f=ImageFont.truetype(FONT,size)
    lines=label.split('\n')
    for i,line in enumerate(lines):
        box=d.textbbox((0,0),line,font=f);d.text((x-(box[2]-box[0])/2,y+i*(size+8)),line,font=f,fill='#15241a')
def box(d,x,y,w,h,label):
    d.rounded_rectangle((x-w/2,y-h/2,x+w/2,y+h/2),radius=18,fill='#f4f7f4',outline='#334e3c',width=3)
    text(d,x,y-len(label.split('\n'))*17,label)
def arrow(d,points,dashed=False):
    if dashed:
        for a,b in zip(points,points[1:]):
            length=math.dist(a,b);n=max(1,int(length/14))
            for i in range(0,n,2):
                p=(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n);q=(a[0]+(b[0]-a[0])*min(i+1,n)/n,a[1]+(b[1]-a[1])*min(i+1,n)/n);d.line([p,q],fill='#334e3c',width=3)
    else:d.line(points,fill='#334e3c',width=3)
    a,b=points[-2:];angle=math.atan2(b[1]-a[1],b[0]-a[0]);r=14
    d.polygon([b,(b[0]-r*math.cos(angle-.45),b[1]-r*math.sin(angle-.45)),(b[0]-r*math.cos(angle+.45),b[1]-r*math.sin(angle+.45))],fill='#334e3c')
def bpmn():
    im,d=start(1600,670)
    d.rectangle((35,70,1565,610),outline='#334e3c',width=3);d.line((35,330,1565,330),fill='#334e3c',width=2)
    text(d,800,15,'Processo de contribuição em uma ocorrência',32)
    text(d,145,90,'Colaborador',22);text(d,145,350,'Aplicação / API',22)
    d.ellipse((75,184,125,234),outline='#334e3c',width=3)
    box(d,290,210,220,90,'Informar categoria\ne localização')
    box(d,500,460,230,100,'Consultar\npróximas')
    d.polygon([(735,150),(795,210),(735,270),(675,210)],fill='white',outline='#334e3c',width=3);text(d,735,188,'X',30)
    text(d,735,115,'É a mesma?',23)
    box(d,1010,210,220,90,'Optar por\nnova ocorrência')
    box(d,1010,460,220,100,'Confirmar\nexistente')
    box(d,1300,460,220,100,'Validar e\npersistir')
    d.ellipse((1480,435,1530,485),outline='#334e3c',width=6)
    arrow(d,[(125,209),(180,209)])
    arrow(d,[(400,210),(500,210),(500,410)])
    arrow(d,[(615,460),(645,460),(645,210),(675,210)])
    arrow(d,[(795,210),(900,210)]);text(d,850,170,'Não',22)
    arrow(d,[(735,270),(735,460),(900,460)]);text(d,770,365,'Sim',22)
    arrow(d,[(1120,210),(1300,210),(1300,410)])
    arrow(d,[(1120,460),(1190,460)])
    arrow(d,[(1410,460),(1480,460)])
    text(d,800,630,'Recorte principal; erros de validação retornam ao preenchimento.',22)
    im.save(OUT/'bpmn.png')
def actor(d,x,y,label):
    d.ellipse((x-20,y-70,x+20,y-30),outline='#334e3c',width=3);d.line([(x,y-30),(x,y+30)],fill='#334e3c',width=3)
    for a,b in [((x-35,y-5),(x+35,y-5)),((x,y+30),(x-30,y+70)),((x,y+30),(x+30,y+70))]:d.line([a,b],fill='#334e3c',width=3)
    text(d,x,y+80,label,24)
def usecases():
    im,d=start(1600,850);d.rectangle((275,65,1320,750),outline='#334e3c',width=3);text(d,790,85,'Sistema Raiz',30)
    actor(d,125,235,'Visitante');actor(d,125,575,'Colaborador');actor(d,1460,235,'Moderador');actor(d,1460,575,'Proprietário')
    labels=[(560,235,'UC-01 Consultar mapa'),(560,430,'UC-02 Publicar relato'),(560,625,'UC-03 Confirmar'),(1050,235,'UC-04 Autenticar'),(1050,430,'UC-05 Moderar / histórico'),(1050,625,'UC-06 Gerenciar contas')]
    for x,y,label in labels:d.ellipse((x-235,y-65,x+235,y+65),fill='#f4f7f4',outline='#334e3c',width=3);text(d,x,y-15,label,24)
    for a,b in [((160,235),(325,235)),((160,575),(325,430)),((160,575),(325,625)),((1425,235),(1285,235)),((1425,235),(1285,430)),((1425,575),(1285,625)),((1425,575),(1285,430)),((1425,575),(1285,235))]:d.line([a,b],fill='#334e3c',width=2)
    text(d,800,790,'Proprietário possui também acesso às operações de moderação.',24);im.save(OUT/'casos-uso.png')
def data():
    im,d=start(1600,1000)
    rows=[(285,220,'issues\nid PK • category • location\nreport_count • estados\nresolved_at'),(805,220,'reports\nid PK • issue_id FK\nip_hash • description\nimage_id FK'),(1320,220,'media_files\nid PK • object_key\nmime_type • width • height'),(285,700,'admin_accounts\nid PK • name • email\npassword_hash • role\nactive • bloqueio'),(805,700,'admin_sessions\ntoken_hash PK\naccount_id FK\nexpires_at'),(1320,700,'admin_audit_events\nid PK • actor_id FK\naction • entity_id lógico\nantes/depois • motivo • data')]
    for x,y,label in rows:box(d,x,y,450,230,label)
    arrow(d,[(510,220),(580,220)]);text(d,545,160,'1:N',23)
    arrow(d,[(1030,220),(1095,220)]);text(d,1060,160,'0..1',22)
    arrow(d,[(510,700),(580,700)]);text(d,545,640,'1:N',23)
    arrow(d,[(285,815),(285,900),(1320,900),(1320,815)]);text(d,800,915,'Conta 1:N eventos; entity_id é referência lógica polimórfica',24)
    text(d,800,35,'Modelo persistente do protótipo',32);im.save(OUT/'dados.png')
def architecture():
    im,d=start(1600,740)
    for x,y,w,h,label in [(220,220,300,120,'Navegador\nReact / MapLibre'),(690,220,300,120,'Nginx\nestáticos / proxy'),(1170,220,300,120,'Fastify\nAPI REST'),(1170,550,300,120,'PostgreSQL\nPostGIS'),(690,550,300,120,'Volume privado\nimagens'),(220,550,300,120,'Provedor externo\ntiles do mapa')]:box(d,x,y,w,h,label)
    arrow(d,[(370,220),(540,220)]);text(d,455,170,'HTTP',24)
    arrow(d,[(840,220),(1020,220)]);text(d,930,170,'/api/v1',24)
    arrow(d,[(1170,280),(1170,490)])
    arrow(d,[(1090,280),(1090,390),(690,390),(690,490)])
    arrow(d,[(220,280),(220,490)],True)
    text(d,800,35,'Arquitetura local em Docker Compose',32)
    text(d,800,680,'Tipos compartilhados: packages/shared • dados persistentes: volumes',24);im.save(OUT/'arquitetura.png')
if __name__=='__main__':bpmn();usecases();data();architecture()
