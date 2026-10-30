from pathlib import Path
import json,re,html,sys,shutil
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,KeepTogether,PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER,TA_LEFT
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader,PdfWriter
from PIL import Image
import fitz
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from prepare_bank import norm
WORK=Path('/workspace/scratch/5e5d36981802')
OUT=WORK/'output'/'pdf';OUT.mkdir(parents=True,exist_ok=True)
DL=ROOT/'public'/'downloads';DL.mkdir(parents=True,exist_ok=True)
SRC=ROOT/'public'/'sources';SRC.mkdir(parents=True,exist_ok=True)
FONT=WORK/'tmp'/'fonts'/'CJK.ttf'
pdfmetrics.registerFont(TTFont('CJK',str(FONT)))
pdfmetrics.registerFont(TTFont('Latin','/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'))
pdfmetrics.registerFont(TTFont('LatinBold','/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'))
pdfmetrics.registerFontFamily('Latin',normal='Latin',bold='LatinBold')
pdfmetrics.registerFontFamily('CJK',normal='CJK',bold='CJK')
NAVY=colors.HexColor('#172d42'); MUTED=colors.HexColor('#62707b'); RED=colors.HexColor('#9b4248')
WIDTH=A4[0]-92
base=ParagraphStyle('body',fontName='CJK',fontSize=10.5,leading=17,wordWrap='CJK',textColor=NAVY,spaceAfter=7)
styles={
 'cn':base,
 'en':ParagraphStyle('en',parent=base,fontName='Latin',fontSize=10.5,leading=15,wordWrap=None),
 'math':ParagraphStyle('math',parent=base,fontSize=12,leading=28,spaceAfter=8,wordWrap=None),
 'mathsol':ParagraphStyle('mathsol',parent=base,fontSize=11,leading=23,spaceAfter=7,wordWrap=None),
 'small':ParagraphStyle('small',parent=base,fontSize=8.5,leading=13,textColor=MUTED),
 'title':ParagraphStyle('title',parent=base,fontSize=22,leading=30,spaceAfter=9),
 'subtitle':ParagraphStyle('subtitle',parent=base,fontSize=11,leading=17,textColor=RED,spaceAfter=12),
 'section':ParagraphStyle('section',parent=base,fontSize=14,leading=21,spaceBefore=12,spaceAfter=6,keepWithNext=True),
 'sectiondesc':ParagraphStyle('sectiondesc',parent=base,fontSize=8.5,leading=13,textColor=MUTED,keepWithNext=True),
 'block':ParagraphStyle('block',parent=base,fontSize=12,leading=19,spaceBefore=10,spaceAfter=4,alignment=TA_CENTER,keepWithNext=True),
 'source':ParagraphStyle('source',parent=base,fontSize=8.5,leading=12,alignment=TA_CENTER,textColor=MUTED,spaceAfter=9,keepWithNext=True),
 'poem':ParagraphStyle('poem',parent=base,fontSize=12,leading=23,alignment=TA_CENTER,spaceAfter=12),
 'option':ParagraphStyle('option',parent=base,fontSize=10,leading=15,spaceAfter=3,wordWrap=None),
 'enoption':ParagraphStyle('enoption',parent=base,fontName='Latin',fontSize=9.5,leading=14,wordWrap=None,spaceAfter=3),
 'key':ParagraphStyle('key',parent=base,fontName='Latin',fontSize=10,leading=15,alignment=TA_CENTER),
}
BANK=json.loads((ROOT/'public'/'bank.json').read_text())
FORM=json.loads((ROOT/'.cache'/'formulas.json').read_text())

def literal(txt,latinfont='Latin'):
    # CJK fallback covers the Chinese range; Latin fonts preserve pinyin accents.
    out=[];buf='';latin=None
    for c in txt:
        islat=not ('\u2e80'<=c<='\u9fff' or '\uff00'<=c<='\uffef' or '\u3000'<=c<='\u303f')
        if latin is not None and islat!=latin:
            out.append(('<font name="'+latinfont+'">'+html.escape(buf)+'</font>') if latin else html.escape(buf));buf=''
        buf+=c;latin=islat
    if buf:out.append(('<font name="'+latinfont+'">'+html.escape(buf)+'</font>') if latin else html.escape(buf))
    return ''.join(out)

def fmt(text,scale=1,latinfont='Latin'):
    out=''
    for p in re.split(r'(\$[^$]+\$)',text):
        if p.startswith('$') and p.endswith('$') and len(p)>1:
            a=FORM[norm(p[1:-1])];w=a['width']*.88*scale;h=a['height']*.88*scale
            out+=f'<img src="{a["png"]}" width="{w:.2f}" height="{h:.2f}" valign="middle"/>'
        else:out+=literal(p,latinfont).replace('\n','<br/>')
    return out

def P(txt,style='cn'):return Paragraph(fmt(txt,scale=1.1 if style=='math' else 1.03 if style=='mathsol' else 1,latinfont='Times-Roman' if style in ['en','enoption'] else 'Latin'),styles[style])

def footer(canvas,doc):
    canvas.saveState();w,h=A4
    canvas.setStrokeColor(colors.HexColor('#d6dce1'));canvas.setLineWidth(.5);canvas.line(46,39,w-46,39)
    canvas.setFont('CJK',8);canvas.setFillColor(MUTED)
    canvas.drawString(46,26,'燕园备考 · 模拟卷 A · 非官方试题')
    canvas.setFont('Latin',8);canvas.drawRightString(w-46,26,str(doc.page));canvas.restoreState()

def doc(path,story):
    SimpleDocTemplate(str(path),pagesize=A4,rightMargin=46,leftMargin=46,topMargin=40,bottomMargin=50,title=path.stem,author='燕园备考 · 命题原创',pageCompression=1).build(story,onFirstPage=footer,onLaterPages=footer)

def keytable(qs):
    cells=[]
    for start in range(0,len(qs),10):
        group=qs[start:start+10]
        cells.append([P(str(q['id']),'key') for q in group]+['']*(10-len(group)))
        cells.append([P(q['answer'],'key') for q in group]+['']*(10-len(group)))
    t=Table(cells,colWidths=[WIDTH/10]*10,hAlign='LEFT')
    t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.4,colors.HexColor('#d6dce1')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]+[('BACKGROUND',(0,i),(-1,i),colors.HexColor('#eef2f4')) for i in range(0,len(cells),2)]))
    return t

def options(q,subject,section):
    opts=[P(letter+'. '+text,'enoption' if subject=='英语' else 'option') for letter,text in zip('ABCD',q['options'])]
    cols=4 if subject=='数学' or section in ['en-cloze','en-mc'] else 1
    if cols==1:return opts
    rows=[opts[i:i+cols] for i in range(0,4,cols)]
    t=Table(rows,colWidths=[WIDTH/cols]*cols,hAlign='LEFT')
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),3)]))
    return [t]

def student(p):
    story=[P('北大外语类保送备考','subtitle'),P(p['title'],'title'),P('100 分  /  60 分钟  /  模拟卷 A  /  2026.10','subtitle'),P('姓名：________________    日期：________________    得分：________________','small'),Spacer(1,8),P(p['intro'],'small'),P('命题依据：用户上传预测样卷的结构与题型；本卷为新编训练材料，不是官方试卷。','small')]
    if p.get('copyrightNote'):story.append(P(p['copyrightNote'],'small'))
    for si,sec in enumerate(p['sections']):
        # A clean section boundary also helps print-and-sit use.
        if p['subject']=='英语' and si>0:story.append(PageBreak())
        story+=[P(sec['title'],'section'),P(sec['description'],'sectiondesc')]
        for b in sec['blocks']:
            if b['title']:story.append(P(b['title'],'block'))
            if b.get('source'):story.append(P(b['source'],'source'))
            if b.get('sourceUrl'):story.append(Paragraph('<link href="'+html.escape(b['sourceUrl'],quote=True)+'" color="#9b4248">'+literal('原文出处（点击查看）')+'</link>',styles['source']))
            if b.get('poem'):story.append(P(b['text'],'poem'))
            else:
                for n,para in enumerate(b['text'].split('\n\n'),1):
                    if para:
                        prefix=f'[{n}] ' if p['subject']=='英语' and sec['id']=='en-reading' else ''
                        story.append(P(prefix+para,'en' if p['subject']=='英语' else 'cn'))
            if b.get('note'):story.append(P(b['note'],'small'))
            for q in b['questions']:
                label=f'{q["id"]}. '+q['stem']
                # In cloze, the options directly follow the numbered blank label.
                if sec['id']=='en-cloze':label=str(q['id'])+'.'
                st='math' if p['subject']=='数学' else 'en' if p['subject']=='英语' else 'cn'
                group=[P(label,st)]+options(q,p['subject'],sec['id'])+[Spacer(1,13 if p['subject']=='数学' else 5)]
                story.append(KeepTogether(group))
    qs=[q for s in p['sections'] for b in s['blocks'] for q in b['questions']]
    blank=[dict(q,answer='_____') for q in qs]
    story.append(KeepTogether([Spacer(1,12),P('答题记录区','section'),P('请在对应题号下填写 A、B、C 或 D；建议在整卷完成后再查看独立解析。','small'),keytable(blank)]))
    path=DL/(p['id']+'-student.pdf');doc(path,story);return path

def answers(p):
    qs=[q for s in p['sections'] for b in s['blocks'] for q in b['questions']]
    story=[P('北大外语类保送备考','subtitle'),P(p['title']+' · 答案解析','title'),P('作家选文修订版 v1.1  /  2026.10.25' if p['subject']=='语文' else '独立核对版  /  客观题计分  /  2026.10','subtitle'),P('每题仅一个正确答案。'+('第 1—20 题每题 2 分，第 21—35 题每题 1 分，第 36—50 题每题 3 分。' if p['subject']=='英语' else '每题 '+str(qs[0]['points'])+' 分。'),'small'),keytable(qs),Spacer(1,10)]
    for sec in p['sections']:
        story.append(P(sec['title'],'section'))
        for b in sec['blocks']:
            if b['title']:story.append(P(b['title'],'block'))
            for q in b['questions']:
                correct=q['options']['ABCD'.index(q['answer'])]
                heading=P(str(q['id'])+'. '+q['answer']+'  |  '+q['tag'],'section')
                stem=P(q['stem'],'mathsol' if p['subject']=='数学' else 'cn')
                sol=P('正确选项：'+correct,'mathsol' if p['subject']=='数学' else 'cn')
                explain=P(q['analysis'],'mathsol' if p['subject']=='数学' else 'cn')
                story.append(KeepTogether([heading,stem,sol,explain,Spacer(1,5)]))
    if p.get('sources'):
        story.append(P('选材与核对来源','section'))
        for src in p['sources']:
            # Short human-readable labels keep long URLs out of the print layout.
            text=literal(src['title'])+'  <link href="'+html.escape(src['url'],quote=True)+'" color="#9b4248">'+literal('查看原文／资料')+'</link>'
            story.append(Paragraph(text,styles['small']))
    story+=[P('难度说明：本卷据样卷进行定性仿编，尚未经群体实测等值；首次作答的得分与用时可用于下一版校准。','small')]
    path=DL/(p['id']+'-answers.pdf');doc(path,story);return path

def restore_originals():
    upload=WORK/'upload'
    for p in upload.glob('*.pdf'):
        target='english-original.pdf' if '英语' in p.name else 'math-original.pdf' if '数学' in p.name else 'chinese-original.pdf'
        shutil.copy2(p,SRC/target)
    img=next(upload.glob('*.png'));shutil.copy2(img,SRC/'chinese-first-page.png')
    # Preserve the uploaded image as-is, centred on an A4 first page.
    im=Image.open(img);w,h=im.size
    d=fitz.open();page=d.new_page(width=A4[0],height=A4[1]);rect=fitz.Rect(0,0,A4[0],A4[1]);page.insert_image(rect,filename=str(img),keep_proportion=True)
    first=ROOT/'.cache'/'source-first.pdf';d.save(first);d.close()
    wr=PdfWriter();wr.append(first);wr.append(SRC/'chinese-original.pdf');wr.add_metadata({'/Title':'语文预测样卷 - 上传附图拼接版','/Subject':'附图原样置于上传 PDF 前；未补写裁切内容'})
    with (SRC/'chinese-restored.pdf').open('wb') as f:wr.write(f)

def main():
    students=[];keys=[]
    for p in BANK['papers']:
        if '--chinese-only' in sys.argv and p['subject']!='语文':
            sp=DL/(p['id']+'-student.pdf');ap=DL/(p['id']+'-answers.pdf')
        else:sp=student(p);ap=answers(p)
        students.append(sp);keys.append(ap)
        p['studentPages']=len(PdfReader(sp).pages);p['answerPages']=len(PdfReader(ap).pages)
    for files,name,title in [(students,'北大保送模拟卷A_三科学生版.pdf','北大保送备考模拟卷 A - 三科学生版'),(keys,'北大保送模拟卷A_三科答案解析.pdf','北大保送备考模拟卷 A - 三科答案解析')]:
        w=PdfWriter()
        for f in files:w.append(f)
        w.add_metadata({'/Title':title,'/Author':'燕园备考','/Subject':'按上传预测样卷仿编；非官方试题'})
        with (OUT/name).open('wb') as f:w.write(f)
        shutil.copy2(OUT/name,DL/('all-student.pdf' if files is students else 'all-answers.pdf'))
    if '--chinese-only' not in sys.argv:restore_originals()
    (ROOT/'public'/'bank.json').write_text(json.dumps(BANK,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(dict(papers=[dict(id=p['id'],studentPages=p['studentPages'],answerPages=p['answerPages']) for p in BANK['papers']],outputs=[str(f) for f in OUT.glob('*.pdf')]),ensure_ascii=False))
if __name__=='__main__':main()
