"""Reviewed reference bands, deliberately conservative; no forced high-tier stock."""
import json,copy,re
from pathlib import Path
R=Path(__file__).resolve().parents[1];P=R/'public'
b=json.loads((P/'bank.json').read_text());h=json.loads((P/'schools.json').read_text());w=json.loads((P/'workflows.json').read_text())
tiers={
 '英语':[('cet4','四级','常用词汇、单层句法与直接信息定位'),('cet6','六级','较长句、学术常用词与局部推断'),('tem4','专四','语法细分、搭配辨析与篇章关系'),('postgrad','考研','论证关系、语境义与有约束的推断'),('tem8','专八','抽象论述、隐含立场与多处证据整合'),('tem8plus','专八加','在专八参照上提高词汇、句法、论证及干扰强度，须有独立依据')],
 '数学':[('gaokao-mid','高考中档题','常规概念、基本转化与有限步骤'),('gaokao-final','高考压轴题','参数分类、多条件整合与较长推理'),('foundation','强基数学','非常规方法、知识迁移与选拔性综合'),('competition1','一试数竞','竞赛一试参照，需典型竞赛知识与技巧'),('competition2','二试数竞','竞赛二试参照，重证明与深入构造，不能用普通单选题冒充')],
 '语文':[('gaokao','高考','常见语言知识、文本理解与有依据的分析'),('gaokao-plus','高考加','叙述距离、反讽、论证结构、跨篇比较与近似干扰'),('school-exam','语文校招难度','保送等校考的文学与文史综合参照，需相应样题校准'),('graduate','研究生考试难度','依具体专业与科目设置文史、文论或专题要求，不能仅靠生僻词判断')]}
sections={'英语':[('mc','词汇与语法','题'),('reading','阅读理解','篇'),('cloze','完形填空','篇'),('fill','语法填空','题'),('ordering','语篇排序','组'),('translation','翻译','段'),('writing','写作','题')], '数学':[('algebra','代数与函数','题'),('geometry','几何与向量','题'),('counting','计数与概率','题'),('number','数论与离散','题')], '语文':[('modern','现代文阅读','组（每组10题）'),('classical','文言文阅读','组（每组10题）'),('poem','古诗阅读','组（每组5题）')]}
items=[]
def add(id,subject,section,tier,questions,reason,**kw):
 questions=copy.deepcopy(questions)
 for q in questions:q.setdefault('kind','mc')
 items.append(dict(id=id,subject=subject,section=section,tier=tier,classificationStatus='编辑暂定',reason=reason,questions=questions,**kw))
mc_bands={1:'tem4',2:'tem4',3:'tem8',4:'tem4',5:'cet6',6:'tem4',7:'tem4',8:'tem8',9:'tem4',10:'tem8',11:'cet4',12:'tem8',13:'tem4',14:'cet6',15:'tem4',16:'cet6',17:'cet4',18:'tem8',19:'tem4',20:'cet6'}
for p in b['papers']:
 for sec in p['sections']:
  if p['subject']=='英语' and sec['id']=='en-mc':
   for z in sec['blocks']:
    for q in z['questions']:
     q=copy.deepcopy(q);q['sourceId']=p['id']+':'+str(q['id']);add(q['sourceId'],'英语','mc',mc_bands[q['id']],[q],'依据本题具体词汇或句法任务：'+q['tag']+'；单题能力参照，不代表整场考试等值。',title=q['tag'])
  if p['subject']=='数学':
   for z in sec['blocks']:
    for q in z['questions']:
     n=q['id'];tier='gaokao-mid' if n in [1,3,6] else 'gaokao-final' if n in [2,9,11,13,14] else 'foundation'
     category='geometry' if n in [9,13,14] else 'counting' if n in [17,19] else 'number' if n in [7,8,10,16,18] else 'algebra'
     q=copy.deepcopy(q);q['sourceId']=p['id']+':'+str(n);add(q['sourceId'],'数学',category,tier,[q],'依据'+q['tag']+'中的方法与推理链暂分；尚不足以认证为数竞题。',title=q['tag'])
for q in h['writtenExtra']:
 q=copy.deepcopy(q);q['sourceId']='extra:'+q['id']
 if q['subject']=='英语':
  n=int(q['id'][1:]);tier='cet4' if n in [3,5,9,10,28] else 'tem4' if n in [1,2,4,7,8,11,15,17,18,20,22,23,26,29] else 'cet6';add(q['sourceId'],'英语','mc',tier,[q],'按实际考点'+q['tag']+'暂定；不按旧“基础/进阶/挑战”机械升档。',title=q['tag'])
 else:
  n=int(q['id'][1:]);category='geometry' if n in [10,11,16] else 'counting' if n in [3,4,9,17] else 'number' if n==13 else 'algebra';tier='gaokao-final' if n in [1,2,7,14,15,20] else 'gaokao-mid';add(q['sourceId'],'数学',category,tier,[q],'依据'+q['tag']+'的常规或综合求解要求暂定。',title=q['tag'])
readbands=['tem8','postgrad','cet6','tem8','tem8','postgrad','tem8','tem4','cet6','tem4','postgrad','cet4','postgrad','cet6']
for z,t in zip(w['readings'],readbands):
 add(z['materialId'],'英语','reading',t,z['questions'],'按篇章抽象度、句法与配套题的推断范围综合暂定；短节选不代表正式考试篇幅。',title=z['title'],text=z['text'],paragraphs=z.get('paragraphs',[]),source=z['source'],sourceUrl=z.get('sourceUrl',''),materialId=z['materialId'],topic=z.get('topic'),schoolIds=z.get('schoolIds'))
for z,t in zip(w['clozes'],['postgrad','cet6','tem4']):
 add(z['materialId'],'英语','cloze',t,z['questions'],'综合上下文逻辑、选项词汇和搭配需求暂定；未经过正确率实测。',title=z['title'],text=z['text'],source=z['source'],materialId=z['materialId'],topic=z.get('topic'))
families={1:'cet4',2:'cet4',3:'tem4',4:'tem4',5:'cet6',6:'tem4',7:'cet6',8:'tem4',9:'cet4',10:'cet6',11:'cet6',12:'tem4',13:'tem4',14:'cet6',15:'tem4',16:'cet4',17:'tem4',18:'cet6',19:'cet4',20:'cet6'}
for q in w['fills']:add(q['sourceId'],'英语','fill',families[int(q['sourceId'].split('-')[1])],[q],'根据具体语法考点暂定：'+q['tag'],title=q['tag'])
for z,t in zip(w['orders'],['postgrad','cet6']):add(z['materialId'],'英语','ordering',t,z['questions'],'按指代衔接、论证次序和段落功能暂定。',title=z['title'],materialId=z['materialId'])
for z in w['translations']:add(z['materialId'],'英语','translation','cet6',z['questions'],'按当前短篇的信息转述、搭配与句间逻辑要求暂定。',title=z['title'],schoolIds=z['schoolIds'],materialId=z['materialId'])
for z in w['writings']:add(z['materialId'],'英语','writing','cet6',z['questions'],'只标题目的任务要求；实际写作难度也取决于评分标准，不能等同成稿水平。',title=z['title'],schoolIds=z['schoolIds'],materialId=z['materialId'])
# Paired modern/classical readings remain together: q10/q20 require both texts.
chinese=[(next(p for p in b['papers'] if p['subject']=='语文'),'gaokao-plus')]
old=next((p for p in b.get('archivedPapers',[]) if p['id']=='chinese-a-pd'),None)
if old:chinese.append((old,'gaokao'))
for p,tier in chinese:
 for sec,key in zip(p['sections'],['modern','classical','poem']):
  texts=[];qs=[]
  for z in sec['blocks']:
   texts.append(z['title']+'\n'+z.get('source','')+'\n\n'+z['text']);
   for q in z['questions']:
    q=copy.deepcopy(q);q['sourceId']=p['id']+':'+str(q['id']);qs.append(q)
  add(p['id']+':'+key,'语文',key,tier,qs,'整组按阅读与干扰要求暂定；保留基础题，跨篇比较所需的两篇材料不拆开。',title=sec['title'],text='\n\n'.join(texts),source='真实作家节选；作者、译者及删节说明沿用原卷',materialId=p['id']+':'+key)
data=dict(version='3.0',reviewDate='2026-10-29',tiers={s:[dict(id=i,label=l,description=d) for i,l,d in ts] for s,ts in tiers.items()},sections={s:[dict(id=i,label=l,unit=u) for i,l,u in ts] for s,ts in sections.items()},items=items,notice='档位是命题能力参照，不是官方考试等值或单一线性排名；当前题目均为编辑暂定。无充足证据的高档位保持空缺。',sampleNeeds=['题目及完整配套材料','答案、逐题解析及评分标准','考试名称、年份、题型与原始来源','你或教师建议的难度及理由','可选：限时、实际得分和各选项选择情况','允许使用或分享的范围；扫描件请附可复制文字'])
(P/'difficulty.json').write_text(json.dumps(data,ensure_ascii=False,indent=2));print('Classified',len(items),'units; no fabricated competition or graduate stock.')
