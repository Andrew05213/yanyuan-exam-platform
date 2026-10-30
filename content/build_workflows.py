"""School-specific training configurations and authored mixed-format material.
Configurations are training designs, never assertions of unpublished exam rules.
"""
from pathlib import Path
import json,html
R=Path(__file__).resolve().parents[1]
H=json.loads((R/'public/schools.json').read_text())
B=json.loads((R/'public/bank.json').read_text())
ALL=['pku','speit','thu','ruc','bfsu','zju']
PROFILES={
 'pku':dict(name='文学与论证精读',level='挑战',topics=['literature','argument','society'],minutes=60,readingCount=3,mcCount=20,fillCount=0,clozeCount=1,orderCount=0,translationCount=0,writingCount=0,focus='强调文本细读、语义辨析与论证推断；沿用原有预测样卷的客观题训练方向。'),
 'speit':dict(name='巴院英语综合',level='进阶',topics=['science','culture','education'],minutes=90,readingCount=4,mcCount=0,fillCount=20,clozeCount=1,orderCount=1,translationCount=0,writingCount=1,focus='四篇阅读、语篇排序、完形、20个语法填空及作文，依据你提供的备考题型设置。'),
 'thu':dict(name='科学与论证交叉',level='挑战',topics=['science','argument','literature'],minutes=75,readingCount=3,mcCount=20,fillCount=0,clozeCount=0,orderCount=1,translationCount=0,writingCount=1,focus='增加科学推理、论证结构与复杂句控制。具体题型比例为本站训练设计。'),
 'ruc':dict(name='社会议题与规则',level='挑战',topics=['society','argument','education'],minutes=75,readingCount=3,mcCount=20,fillCount=0,clozeCount=0,orderCount=0,translationCount=1,writingCount=1,focus='社会研究、公共议题、限定与证据；翻译和写作为拓展训练。'),
 'bfsu':dict(name='语言细读与翻译',level='进阶',topics=['culture','literature','argument'],minutes=90,readingCount=3,mcCount=20,fillCount=0,clozeCount=0,orderCount=0,translationCount=2,writingCount=1,focus='突出词义、文化解释、译者选择和表达。此为短版训练配置，不等同150分钟官方全卷。'),
 'zju':dict(name='教育与科技比较',level='进阶',topics=['education','science','society'],minutes=60,readingCount=2,mcCount=10,fillCount=20,clozeCount=0,orderCount=0,translationCount=0,writingCount=1,focus='教育、技术和比较视角；具体题型比例为本站训练设计。'),
}
for sid,p in PROFILES.items():p.update(schoolId=sid,excludeAttempted=True,excludeGenerated=False,excludeMaterials=False)

def q(id,stem,opts,key,analysis,tag='阅读理解',level='进阶',**extra):
 return dict(sourceId=id,kind='mc',stem=stem,stemHtml=html.escape(stem),options=opts,optionsHtml=[html.escape(o) for o in opts],answer=key,analysis=analysis,analysisHtml=html.escape(analysis),tag=tag,level=level,**extra)

READINGS=[]
en=next(p for p in B['papers'] if p['subject']=='英语')
for sec in en['sections']:
 if sec['id']=='en-reading':
  for i,block in enumerate(sec['blocks']):
   item=dict(block);item.update(materialId='english-a-reading-'+str(i+1),topic=['society','argument','science'][i],level='进阶',schoolIds=ALL,kind='reading',source='ChatGPT 原创训练文章（原模拟卷A）')
   item['questions']=[{**question,'sourceId':'english-a:'+str(question['id']),'kind':'mc'} for question in block['questions']]
   READINGS.append(item)

PD_QUESTIONS={
 'read-bacon-study':[
 ('Which relationship best represents Bacon’s view?',['Experience should limit and guide the use of study.','Study eliminates the need for experience.','Natural ability develops best without education.','Books provide exact rules for every practical situation.'],'A','第二段说明学问需要经验约束其过于宽泛的指引，首段并未否认实践经验。','观点归纳'),
 ('The comparison with plants suggests that natural abilities require',['public recognition.','careful cultivation.','complete replacement.','freedom from all limits.'],'B','proyning是修剪，强调天资需要学习培养，而不是摧毁或任其自然。','隐喻释义'),
 ('The final sentence recommends reading primarily to',['win every argument.','collect impressive quotations.','judge ideas thoughtfully.','accept learned authority.'],'C','weigh and consider对应权衡思考，前面的否定结构排除争胜、盲信与炫示。','句意理解')],
 'read-bacon-reading':[
 ('Why does Bacon distinguish tasting, swallowing and digesting books?',['To rank readers by their social position.','To insist that every book be read slowly.','To show that literary pleasure is harmful.','To match different kinds of attention to different books.'],'D','比喻随后以that is逐项解释，说明不同书籍应采用不同程度的阅读。','论证结构'),
 ('“Writing an exact man” most nearly means that writing encourages',['precise thought and expression.','beautiful handwriting alone.','the accumulation of possessions.','immediate agreement with others.'],'A','exact在此强调思想与表达准确，不是字迹美观；后文memory等讨论的是思维能力。','语境词义'),
 ('Bacon’s attitude to reading through a deputy is best described as',['unconditional rejection.','limited acceptance.','complete endorsement.','indifference to importance.'],'B','作者允许较不重要的书由他人代读，但警惕重要作品被过度浓缩。','限定与推断')],
 'read-mill-errors':[
 ('Reliable judgment rests mainly on our capacity to',['avoid encountering disagreement.','interpret every fact without discussion.','correct mistakes through criticism and experience.','prove that earlier generations were entirely irrational.'],'C','首段以errors are corrigible提出核心，后文解释讨论和批评如何使纠错成为可能。','主旨归纳'),
 ('Why is experience alone insufficient?',['It always leads to the wrong conclusion.','It has no connection with facts.','It is less valuable than confidence.','Its significance must be interpreted and discussed.'],'D','第二段明确指出讨论帮助说明经验应如何解释，并非否定经验。','因果解释'),
 ('Which action best fits the passage?',['Stating what evidence could lead one to revise a belief.','Rejecting criticism because a belief feels certain.','Treating disagreement as proof of hostility.','Preserving a theory by excluding contrary observations.'],'A','愿意设定修正条件能体现kept his mind open to criticism；其他选项关闭了纠错渠道。','应用推断')],
 'read-mill-tree':[
 ('The tree image stresses a person’s',['need to follow a single external model.','capacity for development from within.','independence from every social relationship.','inability to exercise self-control.'],'B','树按内在力量向各方面生长，与按外在样板制造的机器对照。','隐喻释义'),
 ('Which distinction does Mill make about custom?',['All custom is equally harmful.','Old customs are always better.','Reasoned adherence differs from mechanical conformity.','Individuals should never depart from custom.'],'C','intelligent following与blind mechanical adhesion形成明确区别。','对照关系'),
 ('Strong impulses are dangerous when they',['produce energy.','are accompanied by beliefs.','remain part of a person.','develop without an adequate balance of other capacities.'],'D','作者强调not properly balanced，随后区分欲望强与良心弱，不能将强烈冲动一概判为恶。','条件与限定')],
 'read-thoreau-life':[
 ('Thoreau’s purpose is chiefly to',['test what is essential in life through direct experience.','demonstrate that city residents cannot think.','avoid every form of difficulty.','establish a compulsory rule for everyone.'],'A','live deliberately及essential facts说明自觉检验生活；文段没有把个人实验变成普遍命令。','主旨归纳'),
 ('The physical metaphors make his inquiry appear',['detached and effortless.','vigorous and concrete.','purely mathematical.','mainly concerned with physical danger.'],'B','marrow、cut a swath等具体动作加强追索生活本质的力度，不能按字面仅理解为体力活动。','修辞效果'),
 ('Which conclusion is best supported?',['Life’s value can be determined without living it.','Resignation is always the best response.','Thoreau intends to discover life’s character rather than assume it.','The author has already proved that life is necessarily sublime.'],'C','if it proved to be mean / if it were sublime保留结果开放性，体现通过经验检验。','语气与推断')],
}
for oral in H['oralItems']:
 if oral['type']!='reading':continue
 qs=[q(oral['id']+':'+str(i+1),*row,level='挑战' if 'bacon' in oral['id'] or 'mill' in oral['id'] else '进阶') for i,row in enumerate(PD_QUESTIONS[oral['id']])]
 READINGS.append(dict(materialId=oral['id'],title=oral['title'],text=oral['text'],paragraphs=oral['text'].split('\n\n'),source=oral['source']['label'],sourceUrl=oral['source']['url'],note=oral['source']['note'],topic='literature' if 'thoreau' in oral['id'] or 'bacon' in oral['id'] else 'argument',level=qs[0]['level'],kind='reading',schoolIds=ALL,questions=qs,learningPoints=oral['terms']))

def reading(id,title,topic,level,text,rows):
 READINGS.append(dict(materialId=id,title=title,topic=topic,level=level,text=text,paragraphs=text.split('\n\n'),source='ChatGPT 原创训练文章；机构与项目为虚构情境',sourceUrl='',note='',kind='reading',schoolIds=ALL,questions=[q(id+':'+str(i+1),*row,level=level) for i,row in enumerate(rows)]))

reading('read-engineering','A Warning That Could Be Understood','science','进阶',
'''A fictional engineering team developed a sensor that could warn a village when a small bridge was moving unusually. In laboratory tests, the device detected changes with impressive accuracy. The team initially assumed that installing it would therefore make the crossing safer. The village council asked a different question: what would people actually do when the warning appeared?

The first display used three technical categories, each described by a short code. Engineers could explain the distinction, but residents could not tell whether a particular code meant “avoid the bridge” or “ask for more information”. Some people treated every warning as an emergency. Others, after finding the bridge apparently unchanged, stopped paying attention. The sensor was measuring movement; the display was unintentionally measuring the public’s ability to interpret engineering language.

The team replaced the codes with instructions that stated an action and a reason. It also agreed with the council on who could close the crossing and who would inspect it. This did not make every future warning correct. A highly sensitive system could still produce false alarms, while a less sensitive one might miss an early change. The important difference was that these trade-offs were now explained and connected to decisions.

During a later review, the engineers resisted the claim that communication had simply been added after the “real” technical work. They had changed the design because understanding a warning was part of the system’s purpose. A device that reports a measurement perfectly can still fail if the people who need the information cannot use it.''',
 [('The council’s question exposed a gap between',['technical measurement and practical response.','village history and laboratory funding.','the age of the bridge and its appearance.','public interest and the existence of engineers.'],'A','首段将检测精度与居民收到警报后的实际行动区分，后文围绕这一差距展开。','问题定位'),
  ('Why did some residents stop paying attention?',['They had received a technical education.','Every warning had already been confirmed.','The relation between the codes and observable danger was unclear.','The council had prohibited them from reading the display.'],'C','警示代码缺少明确行动含义，且桥看似未变，使部分居民不再关注；不能推断检测完全无用。','因果解释'),
  ('What does the passage say about sensitivity?',['More sensitivity guarantees fewer false alarms.','Changing it involves trade-offs.','It is unrelated to warning design.','It can be selected without considering purpose.'],'B','第三段明确对照false alarms与miss an early change，两类错误需要权衡。','科学推理'),
  ('The final paragraph rejects the idea that communication is',['a source of useful information.','dependent on the intended user.','capable of changing a design.','merely an addition to completed technical work.'],'D','团队把能否理解警报纳入系统目的，反对将沟通视为核心技术完成后的附属品。','观点归纳')])

reading('read-labels','The Name on the Museum Label','culture','进阶',
'''A fictional museum prepared a bilingual label for an everyday ceramic bowl. Its local name referred to both the object and a way of sharing food. The first English version replaced that name with “traditional bowl”. This was easy to read, but a visitor could learn almost nothing about why the object had been selected for the exhibition.

One translator proposed keeping the local name and adding a lengthy explanation. A curator objected that visitors rarely stood in front of a small object long enough to read an essay. Their disagreement was initially described as a conflict between accuracy and simplicity. Yet neither side really wanted inaccurate information or unnecessary difficulty. They were making different assumptions about what the label was supposed to do.

The revised label kept the name, gave a brief description of how the bowl was used, and directed interested visitors to a longer account. Its opening sentence connected the object to a shared meal rather than to an undefined idea of tradition. This arrangement allowed readers to stop after a basic explanation or continue to the more detailed discussion.

The museum did not conclude that every unfamiliar word should be preserved. Some names could be translated directly without losing a useful distinction. Others needed explanation. The decision depended on the object, the audience and the purpose of the display. Translation, the team discovered, was not a contest to fit the largest possible amount of information into the smallest possible space. It was a series of choices about what a particular reader needed to understand.''',
 [('What was the problem with “traditional bowl”?',['It was too long to fit the label.','It removed information important to the exhibition.','It contained a false claim about the material.','It was impossible to pronounce.'],'B','“traditional bowl”虽易读，却抹掉名称与共同用餐方式的联系。','语义辨析'),
  ('The translators’ disagreement mainly concerned',['whether museums should display ordinary objects.','which language had more words.','the intended function of the label.','whether visitors were allowed to ask questions.'],'C','第二段末明确指出双方对标签应发挥的作用有不同假设，并非一方追求不准确。','论证转折'),
  ('The revised arrangement offered visitors',['different levels of explanation.','a single compulsory route.','only the original local term.','more information without any selection.'],'A','简明说明与延伸阅读形成层次，使不同需要的观众能选择阅读深度。','结构分析'),
  ('The museum’s conclusion is best described as',['a universal preference for literal translation.','a rejection of all unfamiliar terms.','a rule that longer translations are always better.','a context-dependent approach to translation.'],'D','最后一段依据对象、受众与目的作条件判断，不支持一概保留或一概替换。','限定与归纳')])

reading('read-survey','What the Survey Did Not Ask','society','挑战',
'''A fictional student newspaper wanted to discover whether its readers supported extending the library’s opening hours. Its online survey asked: “Should hardworking students be allowed to study later?” Most respondents selected yes. The editors planned a headline announcing overwhelming support for the proposal.

A statistics teacher asked whether the question had measured that support. Few readers wished to describe themselves as opponents of hardworking students. Moreover, the survey said nothing about staffing costs, transport home or alternative uses of the same budget. Someone could approve of studying late while preferring a different way to support it. The wording had joined a general value to a particular policy and made the two difficult to separate.

The editors then tested several more neutral questions. One asked which problem readers experienced most often: lack of study space, inconvenient opening hours or difficulty obtaining books. Another described the cost of a proposed extension and asked respondents to compare it with other improvements. The answers were less dramatic. Some groups still strongly favoured longer hours, while others gave priority to different needs.

This did not prove that the first respondents had been dishonest. People can answer the question actually placed before them without considering a question they were never asked. The revised survey was more useful because it made competing choices visible. Its value lay not in producing a less popular proposal, but in distinguishing agreement with an attractive principle from support for one specific way of acting on it.''',
 [('The initial wording was problematic because it',['offered too many policy alternatives.','made cost the only consideration.','linked a favourable identity to a particular proposal.','prevented readers from using the internet.'],'C','“hardworking students”把正面身份和延长开放这一具体政策捆绑，具有诱导性。','调查方法'),
  ('Which distinction is central to the passage?',['Printed newspapers versus online newspapers.','A desirable principle versus a particular policy.','Students versus all other library users.','Sincere respondents versus dishonest respondents.'],'B','结尾将认可一般原则与支持具体实施方案区分，是全文核心。','概念区分'),
  ('The revised questions were more useful mainly because they',['made every respondent choose the same answer.','proved that longer hours were unnecessary.','removed all uncertainty from the decision.','allowed people to compare needs and alternatives.'],'D','新题明确成本、不同需求和替代改进，增加信息而非保证一致或彻底消除不确定性。','论证评价'),
  ('What can be inferred about the first respondents?',['Their answers need not have been dishonest.','They all misunderstood the word library.','They had already considered every possible cost.','Their preferences could never change.'],'A','最后一段明确否认由题目缺陷直接推断受访者不诚实。','推断边界')])

reading('read-apprentice','Learning Beyond One Workplace','education','基础',
'''A fictional college introduced a course that combined classroom study with work in local businesses. Students welcomed the chance to use new skills immediately. Employers liked receiving help from people who already understood the basic ideas behind their tasks. At first, the course was judged mainly by how quickly students could complete familiar jobs.

After a business changed its equipment, however, some students struggled. They knew the steps used in one workplace but could not explain why those steps had been chosen. The college realised that practical experience was not automatically the same as understanding. Repeating a task could produce speed without preparing someone to adapt.

Teachers and employers redesigned the course together. Students still practised routine work, but they also compared methods used in different settings and explained their decisions. A report about a failed attempt could be valuable if it showed that the student had identified the problem and tested an improvement. Success was no longer measured only by whether a familiar task had been completed quickly.

The revised course did not set theory against practice. It asked how each could make the other more useful. Classroom discussion could reveal reasons hidden inside a routine, while practical experience could expose a weakness in an abstract explanation. The aim was to help students become effective in their first workplace without making them dependent on its particular way of doing things.''',
 [('What weakness did the equipment change reveal?',['Some students knew procedures without understanding their reasons.','The college had never offered practical work.','All employers used identical equipment.','Classroom learning always prevented adaptation.'],'A','第二段区分熟练步骤与理解原因，设备改变暴露适应困难。','细节理解'),
  ('Why could a report on failure be valuable?',['It could replace all practical training.','It showed that speed was unimportant in every case.','It might demonstrate diagnosis and improvement.','It guaranteed a future job.'],'C','第三段重视发现问题并检验改进，而不是把失败本身当作价值。','条件与因果'),
  ('The revised course sought to combine',['memorisation and dependence.','theory and practice.','employment and permanent routine.','competition and identical results.'],'B','末段反对theory against practice，强调相互校正与支持。','主旨归纳'),
  ('The final sentence suggests that good preparation should',['be limited to the first employer’s needs.','avoid every routine task.','ignore immediate effectiveness.','support both present work and later adaptation.'],'D','既能胜任第一份工作，又不依赖某一具体方法，兼顾当前与长期能力。','句意推断')])

reading('read-explanation','When a Clear Explanation Misleads','argument','挑战',
'''A fictional science writer was praised for turning difficult research into memorable stories. In one article she described a new treatment as a key designed to fit a particular lock. Readers could easily imagine the process. Some then assumed that the treatment would act in exactly the same way in every patient, just as an ordinary key opens an ordinary lock.

The writer’s image had explained one relationship while hiding others. Biological systems change, interact and respond differently under different conditions. The comparison had not caused those complexities to disappear; it had simply made them less visible. When later results were mixed, several readers felt that the scientists had broken a promise the scientists had never actually made.

The writer kept the image in a revised article, but stated where it stopped being useful. She explained what the key-and-lock comparison helped readers understand, then added that the surrounding system could alter the effect. The explanation became slightly longer and less tidy. It also became less likely to support a false expectation.

Clarity, she concluded, should not be judged only by how easily a sentence can be remembered. An explanation is useful when readers can draw appropriate conclusions from it. A vivid comparison may open the door to understanding, but it needs a boundary. Without that boundary, simplicity can quietly become a claim of certainty.''',
 [('The original comparison encouraged some readers to',['expect a uniform effect across different patients.','reject every attempt to explain science.','recognise all the relevant biological differences.','distinguish laboratory evidence from every clinical outcome.'],'A','首段说明部分读者把钥匙开锁的一致性迁移到不同病人，形成过度确定的预期。','隐喻与误推'),
  ('Why did some readers feel a promise had been broken?',['The scientists had guaranteed a result to every reader.','The writer had explained the research without any comparison.','They inferred certainty from the simplified image.','Mixed results could not occur in biological research.'],'C','文段强调the scientists had never actually made该承诺，读者从比喻作了额外推断。','因果链'),
  ('What was the main purpose of the revision?',['To remove all memorable images.','To define the limits of a helpful comparison.','To make the article shorter at any cost.','To replace evidence with a more attractive story.'],'B','第三段保留比喻并说明适用边界，不能误解为反对一切类比。','修订目的'),
  ('Which standard of clarity does the passage endorse?',['Maximum memorability alone.','The absence of all qualifications.','The shortest possible explanation.','The ability to support warranted conclusions.'],'D','结尾以appropriate conclusions评价清晰性，强调推论是否恰当。','论点归纳')])

reading('read-space','A Bench, a Map and a Public Decision','society','进阶',
'''A fictional city invited residents to identify places where more public seating was needed. Most marks on the online map appeared near shops and cafés in the centre. Officials considered placing nearly all the new benches there. A community worker noticed that the proposal would do little for the older residents she visited outside the centre.

She did not argue that the map was wrong. It accurately recorded the suggestions it had received. The difficulty was that receiving a suggestion depended on access to the website, knowledge of the project and willingness to take part. The absence of marks in a neighbourhood could mean that people needed no benches. It could also mean that their needs had not reached the map.

The city added visits to community centres and short conversations at bus stops. These did not produce a perfect account either: people present at a particular time could differ from those who were absent. Yet the new information revealed needs that the online process had not captured. The final plan distributed seating across several kinds of location and explained how the evidence had been collected.

Officials described the extra work as a way of improving participation rather than replacing it with expert judgment. An open invitation is important, but openness alone does not ensure that every group can respond equally. A public decision becomes more defensible when its organisers examine not only the answers they receive, but also the conditions that make an answer possible.''',
 [('The community worker’s concern was that the map',['contained no genuine suggestions.','might underrepresent some residents’ needs.','had been designed to ban public seating.','proved that older residents disliked benches.'],'B','地图忠实记录已收到意见，但参与条件使部分人需要未被反映。','代表性'),
  ('The absence of marks in an area',['proves that no resident wants a bench.','is always caused by a technical fault.','must be interpreted in light of participation conditions.','makes every existing suggestion invalid.'],'C','第二段列出不同解释，不能从没有意见直接推出没有需求。','证据边界'),
  ('What does the author say about the added conversations?',['They provided useful but still limited evidence.','They removed every possible sampling problem.','They should replace all online participation.','They were unrelated to the final plan.'],'A','第三段承认新办法仍有时间与样本限制，同时补充地图未覆盖的信息。','限定与评价'),
  ('The final paragraph distinguishes an open invitation from',['the use of any evidence.','all forms of public responsibility.','an expert’s personal preference.','an equal practical opportunity to respond.'],'D','程序开放不等于每个群体实际拥有相同参与能力，是结尾的核心区别。','概念区分')])

FILLS=[]
patterns=[
 ('Each member of the {group} ____ (be) responsible for checking one source.',['is'],'主谓一致','each member为单数主语，of后的复数或团体不改变主谓一致。','基础'),
 ('The {group} avoided ____ (repeat) the same claim without evidence.',['repeating'],'非谓语','avoid后接动名词，不接to do。','基础'),
 ('The proposal requires that each member of the {group} ____ (submit) a summary.',['submit','should submit'],'虚拟语气','require表示要求，that从句用(should)+动词原形。','进阶'),
 ('Only after comparing the sources ____ the {group} announce its conclusion.',['did'],'倒装','Only+状语前置，主句部分倒装；announce为原形，过去情境用did。','挑战'),
 ('The {group} distinguished correlation ____ causation.',['from'],'介词搭配','distinguish A from B，区分相关与因果。','基础'),
 ('Had the {group} checked the date, it ____ (notice) the error.',['would have noticed'],'虚拟语气','Had ... checked是过去反事实条件句倒装，主句would have done。','挑战'),
 ('The account was consistent ____ the evidence collected by the {group}.',['with'],'形容词搭配','be consistent with表示与……一致。','基础'),
 ('The {group} found three letters, none of ____ had been published.',['which'],'定语从句','非限制性定语从句，none of which作主语。','进阶'),
 ('The more carefully the {group} defined the task, the ____ (easy) it became to complete.',['easier'],'比较结构','the+比较级，the+比较级，后接easier。','基础'),
 ('The {group} postponed the decision until the evidence ____ (check) by two independent readers.',['had been checked','was checked'],'时态与语态','evidence与check为被动；had been checked突出先后，was checked也可表达until的过去终点，均接受。','进阶'),
 ('The question was too complicated ____ (answer) with a single figure.',['to answer','to be answered'],'非谓语','too ... to ...；此处不定式可用主动表被动，也可直接使用被动式。','进阶'),
 ('It was the wording, rather than the readers, ____ the {group} decided to change.',['that'],'强调句','It was ... that ...强调宾语the wording。','进阶'),
 ('No sooner had the {group} finished its report ____ new evidence appeared.',['than'],'关联结构','no sooner ... than ...，注意与hardly ... when区分。','进阶'),
 ('The {group} learned that not every silence could be treated ____ proof of absence.',['as'],'动词搭配','treat A as B，把A视为B。','基础'),
 ('____ (examine) carefully, the records gave the {group} a more complex picture.',['Examined','examined'],'分词结构','records与examine为被动，过去分词短语作状语，不能用Examining造成逻辑主语错误。','挑战'),
 ('The {group} did not know ____ the archive was complete or not.',['whether'],'名词性从句','whether ... or not引导宾语从句。','基础'),
 ('The {group} would rather the editor ____ (read) the whole passage before commenting tomorrow.',['read'],'虚拟语气','would rather sb did sth表示对现在或将来的愿望；read过去式拼写相同。','挑战'),
 ('The {group} has made its findings ____ (access) to readers without specialist training.',['accessible'],'词性转换','make+宾语+形容词补语；accessible to表示易于理解、可以获取。','进阶'),
 ('There is little point ____ counting comments without examining their quality, the {group} noted.',['in'],'固定结构','there is little point in doing sth。','基础'),
 ('The {group} could not rule ____ the possibility of a different explanation.',['out'],'短语动词','rule out表示排除。','进阶'),
]
for i,(stem,answers,tag,analysis,level) in enumerate(patterns):
 for j,group in enumerate(['research team','translation group','debate club','museum project']):
  FILLS.append(dict(sourceId=f'fill-{i+1:02}-{j}',family=f'fill-{i+1:02}',kind='fill',stem=stem.format(group=group),accepted=answers,analysis=analysis,tag=tag,level=level,learningPoints=[analysis]))

CLOZES=[]
for sec in en['sections']:
 if sec['id']=='en-cloze':
  for block in sec['blocks']:
   CLOZES.append(dict(materialId='english-a-cloze',kind='cloze',title=block['title'],text=block['text'],source='ChatGPT 原创训练文章（原模拟卷A）',level='进阶',topic='society',questions=[{**x,'sourceId':'english-a:'+str(x['id']),'kind':'mc','sourceNumber':x['id']} for x in block['questions']]))

def cloze(id,title,text,items):
 qs=[]
 for i,(right,wrong,analysis,tag) in enumerate(items):
  pos=i%4;opts=wrong[:];opts.insert(pos,right)
  qs.append(q(id+':'+str(i+1),'Choose the best expression for blank '+str(i+1)+'.',opts,'ABCD'[pos],analysis,tag,sourceNumber=i+1))
 CLOZES.append(dict(materialId=id,title=title,text=text,kind='cloze',source='ChatGPT 原创训练文章；虚构研究情境',level='进阶',topic='science' if id=='cloze-warnings' else 'culture',questions=qs))

cloze('cloze-warnings','Warnings and Decisions',
'''A fictional laboratory tested a warning system for a bridge. Its first report [1] ______ on how accurately the sensors measured movement. The results looked impressive. [2] ______, the village council wanted to know what residents would do when a warning appeared. Accuracy was important, but it was not [3] ______ to guarantee a useful response.

The display used technical codes that engineers understood [4] ______. Residents, by contrast, could not always distinguish a request for further checking [5] ______ an instruction to leave. Some warnings caused unnecessary fear, [6] ______ others were ignored. The team realised that it had treated communication [7] ______ a minor addition to the design.

It therefore replaced the codes with explanations of the action required and the reason [8] ______ it. The revised display did not [9] ______ all uncertainty. Instead, it helped people recognise what was known and what still needed to be checked. The council also [10] ______ responsibility for making decisions, so that a warning did not simply leave everyone waiting for someone else.

The project taught the team to judge success in [11] ______ of the system’s purpose. A perfect measurement can have limited value if it is not [12] ______ to a decision. The public’s questions had not weakened the engineering work; they had [13] ______ an assumption that needed examination. The lesson was not to choose between technical quality and clear explanation, [14] ______ to understand why an effective design [15] ______ both.''',
 [('focused',['depended','insisted','objected'],'focus on意为侧重于，后接测量准确性这一报告重点。','动词搭配'),
 ('However',['Therefore','Similarly','Otherwise'],'前文精度结果很好，后文提出不同问题，转折用However。','语篇连接'),
 ('sufficient',['identical','irrelevant','reluctant'],'not sufficient to guarantee表示不足以保证。','形容词辨析'),
 ('readily',['rarely','accidentally','silently'],'与居民不理解作对照，工程师能轻易理解，readily。','语境推断'),
 ('from',['for','about','into'],'distinguish A from B。','介词搭配'),
 ('while',['because','unless','provided'],'两类警报遭遇不同反应，while表示对照。','逻辑关系'),
 ('as',['for','by','into'],'treat communication as an addition，把沟通视为附属。','动词搭配'),
 ('behind',['against','except','beyond'],'the reason behind an action，行动背后的原因。','语义搭配'),
 ('eliminate',['distribute','admire','translate'],'没有消除所有不确定性，eliminate符合宾语uncertainty。','词汇辨析'),
 ('clarified',['avoided','borrowed','postponed'],'明确由谁负责决策，与后面的等待他人行动相对。','语境推断'),
 ('terms',['advance','return','spite'],'in terms of表示依据、从……角度。','固定搭配'),
 ('connected',['opposed','limited','exposed'],'connected to a decision，与决策相联系。','语义搭配'),
 ('exposed',['confirmed','protected','concealed'],'公众提问揭示需检验的假设，exposed。','论证转折'),
 ('but',['and','or','nor'],'not to choose ... but to understand，not ... but ...。','关联结构'),
 ('requires',['rejects','separates','disguises'],'有效设计需要技术质量与清晰解释两者，requires。','主旨回扣')])

cloze('cloze-translators','A Translator’s Choice',
'''A fictional museum asked two translators to prepare a label for an unfamiliar object. One version kept the local name; the other [1] ______ it with a broad English term. The first was precise but difficult for new visitors. The second was easy to read, [2] ______ it removed a distinction that mattered to the exhibition.

At first, the disagreement seemed to be [3] ______ accuracy and simplicity. Yet the translators agreed that visitors needed both. What they had not [4] ______ was the label’s purpose. A description for specialists would differ [5] ______ one designed for children entering the gallery for the first time.

The team began by identifying what every visitor needed to know. It then offered additional detail through a link. This made it possible to keep the name [6] ______ forcing everyone to read a long explanation. Readers could decide how [7] ______ to continue.

The result did not provide a rule for every future translation. It provided a way to [8] ______ the right questions. Who would read the text? Which differences were [9] ______ to its purpose? What could be left for later? These questions made the team’s choices more [10] ______, even when no single answer was perfect.

The museum learned that translation is not [11] ______ a search for equivalent words. It involves decisions about context and attention. A shorter text is not automatically clearer, [12] ______ a longer one is not automatically more accurate. Good translation allows readers to understand [13] ______ the text matters. That requires selection, but selection need not mean [14] ______. The important thing is to explain the choices and keep them open [15] ______ revision.''',
 [('replaced',['confused','supplied','compared'],'replace A with B：用宽泛英文词替换原名。','动词搭配'),
 ('but',['so','since','unless'],'易读却丢失区别，转折but。','语篇连接'),
 ('between',['among','beyond','within'],'between accuracy and simplicity，两者之间。','介词搭配'),
 ('clarified',['ignored','translated','invented'],'还没明确标签用途，clarified。','语境推断'),
 ('from',['with','for','by'],'differ from，与……不同。','动词搭配'),
 ('without',['despite','during','against'],'保留原名而不迫使所有人读长说明，without doing。','逻辑关系'),
 ('far',['many','often','early'],'how far to continue表示阅读到多深、多远。','语境词义'),
 ('ask',['raise with','answer to','hear from'],'ask the right questions，提出恰当问题。','动词搭配'),
 ('relevant',['reluctant','remote','resistant'],'relevant to其目的相关。','形容词搭配'),
 ('transparent',['accidental','permanent','exclusive'],'使选择的理由更透明，不保证唯一或永久答案。','论证推断'),
 ('merely',['rarely','finally','previously'],'not merely，不仅仅是词语对应。','范围限定'),
 ('and',['because','unless','therefore'],'两个并列的否定概括，and连接；不是因果或条件。','并列关系'),
 ('why',['whether','when','whose'],'理解文本为何重要，why。','从句语义'),
 ('distortion',['attention','context','revision'],'选择不必意味着歪曲；distortion。','词汇辨析'),
 ('to',['for','at','by'],'open to revision，保持可修订。','固定搭配')])

ORDERS=[
 dict(materialId='order-archives',kind='ordering',title='From an archival silence to a research question',level='挑战',source='ChatGPT 原创语篇排序训练',questions=[dict(sourceId='order-archives:q1',kind='order',stem='Arrange paragraphs A–E into the most coherent passage. Write the five letters in order.',paragraphs={'A':'To examine that possibility, she compared the register with private invoices and letters. These documents recorded work that the public list had not been designed to include.','B':'The revised study therefore treated absence as a question to investigate, rather than as a conclusion already established by the record.','C':'A historian began with a register containing the names of the people officially responsible for a local trade. At first it appeared to show who had participated.','D':'Together, those additional sources showed why the original inference was too strong. A missing name did not necessarily mean that a person had played no part.','E':'She then noticed a difficulty: the register might identify the legal owner of a business while leaving the work of other household members unrecorded.'},accepted=['CEADB'],answer='CEADB',analysis='C引入研究与最初判断；E以then指出困难；A的that possibility承接遗漏可能性并开展核对；D总结新证据；B以therefore落到修订后的研究立场。',tag='语篇衔接',level='挑战')]),
 dict(materialId='order-design',kind='ordering',title='Redesigning a warning',level='进阶',source='ChatGPT 原创语篇排序训练',questions=[dict(sourceId='order-design:q1',kind='order',stem='Arrange paragraphs A–E into the most coherent passage. Write the five letters in order.',paragraphs={'A':'Those interviews revealed that residents did not know which action each code required. The problem was therefore not simply a lack of measurement.','B':'The team’s final report defined success as a combination of accurate detection, clear explanation and an agreed procedure for acting.','C':'A team installed a sensor that reported unusual movement in a village bridge. Laboratory tests had shown that it measured the movement accurately.','D':'It replaced the technical codes with instructions and checked the new display with residents before returning it to service.','E':'When several warnings were ignored, the engineers interviewed the people who used the crossing. They asked how the display had been understood.'},accepted=['CEADB'],answer='CEADB',analysis='C介绍设备与检测准确性；E叙述警报遭忽视并访谈；A的Those interviews承接访谈结果；D说明相应改造；B总结评价标准。',tag='语篇衔接',level='进阶')]),
]

WRITINGS=[]
writing_specs=[
 ('pku','Can close reading still matter in an age of instant summaries?',['界定close reading的具体价值，区分获取信息与理解表达。','用一个具体阅读细节作为证据。','承认摘要的便利，限定自己的主张。']),
 ('speit','Should engineers receive more education in the humanities?',['说明humanities在沟通、价值判断或问题定义中的作用。','承认专业技术训练与时间成本。','提出具体课程或项目安排，避免简单二选一。']),
 ('thu','When can a simple explanation become misleading?',['用具体例子说明简化与歪曲的区别。','讨论解释的受众、用途和边界。','提出既清楚又保留必要限定的做法。']),
 ('ruc','Is an open invitation enough to ensure fair participation?',['区分形式上的开放与实际参与能力。','说明一种具体障碍及其作用机制。','评价改进办法的收益、成本和适用条件。']),
 ('bfsu','Can translation preserve cultural difference while remaining accessible?',['明确文化差异与可理解性的具体含义。','用一个词语或展签场景展开。','说明译者如何按受众选择，不作绝对结论。']),
 ('zju','Should education prepare students for their first job or for future changes?',['承认眼前就业准备的价值。','解释适应能力与基础理解的关系。','提出理论与实践互相支持的办法。']),
]
for sid,prompt,guide in writing_specs:
 WRITINGS.append(dict(materialId='writing-'+sid,kind='writing',title='Writing',schoolIds=[sid],level='进阶',source='ChatGPT 原创训练题',questions=[dict(sourceId='writing-'+sid,kind='writing',stem=prompt+' Write about 200 words. Give a qualified position and support it with specific reasoning.',prompt=prompt,wordLimit=200,limitMode='approx',guide=guide,analysis='按原稿的任务完成、论证、结构、语法、词汇和格式评估；本题须人工或对话精批，网页不自动给出语义分。',tag='短议论文',level='进阶')]))

TRANSLATIONS=[]
for item in H['oralItems']:
 if item['type'] not in ['zh-en','en-zh']:continue
 TRANSLATIONS.append(dict(materialId='written-'+item['id'],kind='translation',title=item['title'].replace('中译英','Chinese to English').replace('英译中','English to Chinese'),source='ChatGPT 原创训练材料',schoolIds=ALL,level='进阶',questions=[dict(sourceId='written-'+item['id'],kind='translation',stem='Translate the following passage '+('into English.' if item['type']=='zh-en' else 'into Chinese.'),text=item['text'],reference=item['reference'],analysis='参考译文不代表唯一译法。先检查信息、逻辑关系和限定语，再检查术语与自然表达；本题不自动判断语义得分。',learningPoints=item['terms'],tag='笔译',level='进阶')]))

METHODS={
 '虚拟语气':['先确认说的是要求、愿望，还是与事实相反的条件。','确定时间指向，再选择(should) do、过去式或完成形式。'],
 '倒装':['定位触发倒装的否定词或Only状语。','区分主句与从句，检查助动词、时态及原形动词。'],
 '定语从句':['先找先行词，再判断关系词在从句中承担什么成分。','非限制性从句、介词后关系词及that/which的边界要分别核对。'],
 '非谓语':['确认谓语是否完整，再检查非谓语与逻辑主语的主动/被动关系。','同时检查动词或介词后固定接动名词、不定式的要求。'],
 '主谓一致':['先找真正主语的中心词。','隔开的介词短语不改变主语；并列或就近结构另按规则判断。'],
 '科学推理':['区分观测结果、解释模型与能推出的结论。','检查控制条件、因果关系和适用范围。'],
 '语篇衔接':['先找可独立引入主题的段落。','追踪代词、时间词、转折和总结词所指向的前文。'],
 'default':['先把所选项与题干、必要原文逐一对照。','用解析中的规则或证据检验选项，不仅凭词面熟悉感判断。'],
}

D=dict(version='2.1',topics={'literature':'文学与细读','argument':'论证与解释','science':'科学与工程','society':'社会与公共议题','education':'教育与学习','culture':'文化与翻译'},profiles=PROFILES,readings=READINGS,fills=FILLS,clozes=CLOZES,orders=ORDERS,writings=WRITINGS,translations=TRANSLATIONS,methods=METHODS,writingDimensions=[dict(name=n,max=m) for n,m in [('审题与内容完成度',20),('论证与逻辑',25),('结构与衔接',15),('语法与句法',20),('词汇与表达',15),('拼写、标点与格式',5)]],generationNote='学校默认配置、个人预设与本次调整分别保存；默认比例属于训练设计。题库数量有限，去重不足时明确提示，不自动关闭去重。',authorNote='新题与学习提示为ChatGPT命题；真实作家阅读材料另有作者与原文来源。')
if __name__=='__main__':
 (R/'public/workflows.json').write_text(json.dumps(D,ensure_ascii=False,indent=2)+'\n')
 print(f'{len(READINGS)} reading units, {len(FILLS)} grammar fills, {len(CLOZES)} cloze units, {len(ORDERS)} ordering tasks, {len(WRITINGS)} writing prompts, {len(TRANSLATIONS)} translation units')
