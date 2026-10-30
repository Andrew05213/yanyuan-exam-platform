from pathlib import Path
import sys, json, re, html, hashlib, io, shutil
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'content'))
from math_content import make_math
from chinese_public_domain import make_chinese
from english_content import make_english
import matplotlib
matplotlib.use('Agg')
from matplotlib.mathtext import math_to_image
from matplotlib.font_manager import FontProperties
from PIL import Image

DIST=ROOT/'public'; MATH=DIST/'math'; MATH.mkdir(exist_ok=True,parents=True)
CACHE=ROOT/'.cache'/'math'; CACHE.mkdir(parents=True,exist_ok=True)

def norm(s):
    special={'frac':2,'binom':2,'sqrt':1,'mathbf':1,'overline':1}
    def parse(i,stop=False):
        out=''
        while i<len(s):
            if stop and s[i]=='}': return out,i+1
            if s[i]=='{':
                inn,i=parse(i+1,True);out+='{'+inn+'}';continue
            if s[i]=='\\':
                m=re.match(r'\\([A-Za-z]+|.)',s[i:]); cmd=m.group(1);i+=len(m.group(0));v='\\'+cmd
                if cmd in special:
                    if cmd=='sqrt' and i<len(s) and s[i]=='[':
                        j=s.index(']',i);v+=s[i:j+1];i=j+1
                    for _ in range(special[cmd]):
                        while i<len(s) and s[i].isspace():i+=1
                        if s[i]=='{':
                            inn,i=parse(i+1,True);v+='{'+inn+'}'
                        elif s[i]=='\\':
                            mm=re.match(r'\\[A-Za-z]+',s[i:]);v+='{'+mm.group(0)+'}';i+=len(mm.group(0))
                        else:v+='{'+s[i]+'}';i+=1
                out+=v;continue
            out+=s[i];i+=1
        return out,i
    return parse(0)[0]

FORMULAS={}
def math_asset(raw):
    tex=norm(raw)
    if tex in FORMULAS:return FORMULAS[tex]
    key=hashlib.sha256(tex.encode()).hexdigest()[:16]
    svg=MATH/(key+'.svg');png=CACHE/(key+'.png')
    for dest,fmt in [(svg,'svg'),(png,'png')]:
        if not dest.exists():math_to_image('$'+tex+'$',str(dest),prop=FontProperties(size=12),dpi=216,format=fmt,color='#172d42')
    im=Image.open(png);w,h=im.size
    entry=dict(src='math/'+svg.name,png=str(png),width=w/3,height=h/3,tex=tex)
    FORMULAS[tex]=entry
    return entry

def rich(text):
    pieces=re.split(r'(\$[^$]+\$)',text)
    out=''
    for part in pieces:
        if part.startswith('$') and part.endswith('$') and len(part)>1:
            a=math_asset(part[1:-1]);out+=f'<img class="formula" src="{a["src"]}" alt="{html.escape(a["tex"],quote=True)}" style="width:{a["width"]/12:.3f}em;height:{a["height"]/12:.3f}em">'
        else:out+=html.escape(part).replace('\n','<br>')
    return out

def run():
    papers=[make_chinese(),make_math(),make_english()]
    ref=json.loads((ROOT/'content/chinese-literary-reference.json').read_text())
    papers[0].update(id='chinese-a-literary',title='语文模拟卷 A · 文学素养提升版',subtitle='文学细读 · 文言论证 · 诗歌比较',version='1.2',intro='25 道单项选择题，每题 4 分，建议 60 分钟。依据提供的文学素养提升卷；文本沿用此前核对的作家选文，难度未经群体实测。')
    for sec in papers[0]['sections']:
        for block in sec['blocks']:
            block['questions']=[ref[str(q['id'])] for q in block['questions']]
    papers[2]['sources']=[dict(title='科学原理核对：OpenStax University Physics 1，16.1、16.3',url='https://openstax.org/books/university-physics-volume-1/pages/16-3-wave-speed-on-a-stretched-string')]
    for p in papers:
        ids=[];points=0
        for sec in p['sections']:
            for b in sec['blocks']:
                b['paragraphs']=[rich(t) for t in b['text'].split('\n\n') if t]
                for q in b['questions']:
                    assert len(q['options'])==4 and q['answer'] in 'ABCD'
                    ids.append(q['id']);points+=q['points']
                    q['stemHtml']=rich(q['stem']);q['optionsHtml']=[rich(o) for o in q['options']];q['analysisHtml']=rich(q['analysis'])
        assert ids==list(range(1,len(ids)+1)),p['id']
        assert points==100,(p['id'],points)
        p['count']=len(ids)
        p['studentPdf']=None if p['id']=='chinese-a-literary' else 'downloads/'+p['id']+'-student.pdf'
        p['answerPdf']=None if p['id']=='chinese-a-literary' else 'downloads/'+p['id']+'-answers.pdf'
        if p['id']=='chinese-a-literary':p['studentPages']=p['answerPages']=0
    sources=[
      dict(id='source-cn',subject='语文',title='语文预测样卷 · 原始 PDF',format='PDF · 7 页',path='sources/chinese-original.pdf',description='原文件从印刷页码 2 开始；与附图分开原样存档。'),
      dict(id='source-cn-first',subject='语文',title='语文首页 · 上传附图',format='PNG · 原始图像',path='sources/chinese-first-page.png',description='保留上传原貌，顶部标题已有裁切。'),
      dict(id='source-cn-restored',subject='语文',title='语文预测样卷 · 附图拼接版',format='PDF · 8 页',path='sources/chinese-restored.pdf',description='将附图置于原 PDF 前，便于连续浏览；不补写裁切或未提供的内容。'),
      dict(id='source-math',subject='数学',title='数学预测样卷 · 原始 PDF',format='PDF · 3 页',path='sources/math-original.pdf',description='100 分／60 分钟；20 道单项选择题。'),
      dict(id='source-en',subject='英语',title='英语预测样卷 · 原始 PDF',format='PDF · 7 页',path='sources/english-original.pdf',description='100 分／60 分钟；原文件带有已有手写批注，原样保存。')]
    blueprint=[
      dict(subject='语文',original='25 道单选，每题 4 分；现代文 10 题、文言文 10 题、古诗 5 题。',mock='结构、题数与分值一致；现代文采用一篇中国作家、一篇外国作家的真实作品节选。',focus='字音、词义、断句、人物描写、叙述视角、反讽、诗歌意象和中外文本比较。',difficulty='以阅读密度、干扰项和推断要求作定性对标。现代文为鲁迅《在酒楼上》、芥川龙之介《鼻子》（鲁迅旧译）；原文和译本分别核对公有领域状态。'),
      dict(subject='数学',original='20 道单选，每题 5 分；多题 D 项为“以上答案都不正确”。',mock='题数、分值及 D 项形式一致；保留代数、复数、向量几何、整数条件和组合计数。',focus='共轭根、三角连乘、函数方程、条件最值、整点计数、椭圆面积、多项式、根式与取整。',difficulty='保留较快作答节奏与条件转化要求；计算量控制在单选题范围。并非所有题目与样卷逐题一一配对。'),
      dict(subject='英语',original='20 道词汇语法×2 分，15 道完形×1 分，3 篇阅读共 15 题×3 分。',mock='题数、三部分顺序及分值一致；阅读保留人文阐释、组织行为、科学说明三种文体。',focus='中高阶词汇、固定搭配、倒装与虚拟、篇章逻辑、证据评价、主旨与推断。',difficulty='用长句、概念区分和近义干扰项接近样卷要求；文本为原创命题材料，不伪装成真实新闻或研究。')]
    archived=json.loads((ROOT/'content/archive-v1.json').read_text())
    bank=dict(title='燕园备考',subtitle='三科试卷资料库',edition='模拟卷 A · 2026.10',created='2026-10-24',updated='2026-10-25',version='1.1',papers=papers,archivedPapers=[archived,json.loads((ROOT/'content/archive-chinese-pd-v11.json').read_text())],sources=sources,blueprint=blueprint,sourceNote='上传材料的页眉标注为“2026 年外语类保送笔试预测题”；本库按提供样卷仿编，不将其认证为北京大学官方真题，也不据此宣称 2027 年官方考试安排。',calibration='模拟卷难度为依据结构、知识跨度和阅读负荷进行的定性估计，尚未经群体实测等值。可在首次作答后依据实际得分、错题和用时校准。',storageNote='试卷、解析和原始材料随网站版本保存，可长期反复访问。在线答案、计时和提交记录仅保存在当前浏览器；请使用“导出练习记录”备份，换设备后可导入。')
    (DIST/'bank.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'.cache'/'formulas.json').write_text(json.dumps(FORMULAS,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(dict(papers=[dict(id=p['id'],questions=p['count'],total=p['total'],words=[len(re.findall(r"\b[A-Za-z]+(?:'[A-Za-z]+)?\b",b['text'])) for s in p['sections'] for b in s['blocks'] if b['text']]) for p in papers],formulas=len(FORMULAS)),ensure_ascii=False))
if __name__=='__main__':run()
