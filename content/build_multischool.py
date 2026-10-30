"""Authored training material. School policies, user reports and training design
are kept separate. No generated prompt is labelled an official past question.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
ALL = ['pku','speit','thu','ruc','bfsu','zju']
JP = ['pku','thu','ruc','bfsu']
SCHOOLS = [
 dict(id='pku',name='北京大学',track='日语',short='北大',region='日本',color='#9c3f4d',subjects=['语文','数学','英语'],tagline='读懂文本，也说清自己的判断。',focus=['英语读文','日本国别','综合面试'],writtenNote='语数英科目据2026简章；原有模拟卷A据你上传的预测样卷编制。',oralOfficial='2026简章列明英语朗读、理解、表达，综合素质考察及专业外语模拟发音等。',oralTraining='英语读文采用真实作家公有领域英文节选；日本国别题按你的目标增设。',sourceUrl='https://bkzs.pku.edu.cn/tzgg/d24d1f3ac99d4263bd2ab51442a7a7a8.htm',sourceLabel='北大2026官方招生简章',writtenMinutes={'语文':60,'数学':60,'英语':60},oralRecipe=['reading','japan','personal'],profileFocus='文学、思想与跨文化解释',userFormat='英语读文与日语类国别问题（你指定的训练模块）'),
 dict(id='speit',name='上海交通大学',track='巴院 · 法语',short='交大巴院',region='法国',color='#435f78',subjects=['数学','英语'],tagline='在两种语言之间，把意思准确交付。',focus=['中英口译','即兴演讲','法国国别'],writtenNote='数外笔试参照2026招生简章公开转载；本专区按英语选考方向训练。具体题型仍需样卷校准。',oralOfficial='2026公开招生信息列外语能力测试与综合面试；英语选考方向的外语能力测试使用英语。',oralTraining='中译英、英译中、自我介绍、即兴演讲按你提供的巴院题型设置；法国国别为补充训练。',sourceUrl='https://admissions.sjtu.edu.cn/newDetails?contentsID=3810000004162',secondaryUrl='https://gaokao.eol.cn/shang_hai/dongtai/202601/t20260108_2714825.shtml',sourceLabel='交大2026官方简章入口（正文动态加载）',writtenMinutes={'数学':60,'英语':60},oralRecipe=['zh-en','en-zh','speech','france','personal'],profileFocus='工程沟通、科技伦理与中法交流',userFormat='中译英、英译中、即兴演讲（你提供的备考题型，非官方真题认定）'),
 dict(id='thu',name='清华大学',track='日语',short='清华',region='日本',color='#70618d',subjects=['语文','数学','英语'],tagline='用证据思考，让表达经得起追问。',focus=['英语表达','日本国别','综合面试'],writtenNote='2026简章确认初试语数英；当前组卷为通用能力训练，尚无清华样卷细节校准。',oralOfficial='2026简章列综合面试和英语口语测试，未公开全部题型及国别题占比。',oralTraining='增设读文、论证与日本国别；强调文理交叉、研究方法和反例。',sourceUrl='https://www.join-tsinghua.edu.cn/info/1006/2129.htm',sourceLabel='清华2026官方招生简章',writtenMinutes={'语文':60,'数学':60,'英语':60},oralRecipe=['reading','speech','japan','personal'],profileFocus='文理交叉、方法意识与技术社会',userFormat='学校风格训练配置；不是已核实的固定口试流程'),
 dict(id='ruc',name='中国人民大学',track='日语',short='人大',region='日本',color='#8c604b',subjects=['语文','数学','英语'],tagline='把文化问题放回社会与制度之中。',focus=['英语读文','日本社会','公共议题'],writtenNote='2026简章Ⅰ组为语数英；当前按英语考生申请日语的训练方向设置。',oralOfficial='2026简章Ⅰ组面试使用英语，包括外语朗读、理解、表达及综合素质考察等。',oralTraining='日本国别题增加社会调查、公共政策及涉外法治视角；这些为训练设计。',sourceUrl='https://gaokao.chsi.com.cn/zzbm/xxgk/detailXx.action?xxId=f9wk8206dn2ycg65',secondaryUrl='https://10002.gaokao.haedu.cn/policy/brochure/2025/1230/78623.html',sourceLabel='人大2026简章（阳光高考发布）',writtenMinutes={'语文':60,'数学':60,'英语':60},oralRecipe=['reading','japan','speech','personal'],profileFocus='社会科学、公共议题与规则意识',userFormat='日语专业Ⅰ组英语口试训练；国别追问为原创'),
 dict(id='bfsu',name='北京外国语大学',track='日语',short='北外',region='日本',color='#4e7c75',subjects=['语文','英语'],tagline='准确理解语言，也准确理解他人。',focus=['英语表达','日本文化','跨文化传播'],writtenNote='2026简章列语文、英语各200分、150分钟；本版短卷分值与限时是训练设置，不等同全真校考。',oralOfficial='2026简章列口试面试约10分钟/人、满分20分；细目未在该简章充分展开。',oralTraining='增设朗读、释义、文化阐释和译者选择，针对日语学习方向训练。',sourceUrl='https://10030.gaokao.haedu.cn/policy/brochure/2025/1225/78617.html',sourceLabel='北外2026简章（河南省阳光高考平台转载）',writtenMinutes={'语文':150,'英语':150},oralRecipe=['reading','japan','personal'],profileFocus='语言细读、翻译选择与国际传播',userFormat='公开口试要求之外的题型为专项拓展'),
 dict(id='zju',name='浙江大学',track='德语',short='浙大',region='德国',color='#3e708c',subjects=['数学','英语'],tagline='从语言进入德国，从比较理解问题。',focus=['英语表达','德国国别','学科交叉'],writtenNote='2026简章笔试数学100分、英语100分，两科合计120分钟；本版单科短卷为专项训练。',oralOfficial='2026简章列外语能力考查与综合能力考查，未公布所有面试题型。',oralTraining='围绕德国文化、教育与中德科技合作增设国别题；零起点申请方向主要练习中英表达。',sourceUrl='https://zdzsc.zju.edu.cn/2025/1212/c87242a3118365/page.htm',sourceLabel='浙大2026官方招生简章',writtenMinutes={'数学':60,'英语':60},oralRecipe=['reading','germany','speech','personal'],profileFocus='德国研究、教育比较与科技合作',userFormat='德语方向国别训练；不假定必须用德语作答'),
]

ORAL=[]
def add(id,schools,type,title,prompt,guide,followups,level='进阶',text='',reference='',source=None,language='中文 / English',prep=45,answer=120,terms=None):
    ORAL.append(dict(id=id,schoolIds=schools,type=type,title=title,prompt=prompt,guide=guide,followups=followups,level=level,text=text,reference=reference,source=source or {'label':'ChatGPT 原创训练材料','kind':'原创命题'},language=language,prepSeconds=prep,answerSeconds=answer,terms=terms or [],version='2.0'))

READINGS=[
 ('bacon-study','Francis Bacon · Of Studies','Studies and experience',
 '''Studies serve for delight, for ornament, and for ability. Their chief use for delight, is in privateness and retiring; for ornament, is in discourse; and for ability, is in the judgment and disposition of business. For expert men can execute, and perhaps judge of particulars, one by one; but the general counsels, and the plots and marshalling of affairs, come best from those that are learned.

To spend too much time in studies is sloth; to use them too much for ornament, is affectation; to make judgment wholly by their rules, is the humour of a scholar. They perfect nature, and are perfected by experience: for natural abilities are like natural plants, that need proyning by study; and studies themselves do give forth directions too much at large, except they be bounded in by experience.

Crafty men contemn studies, simple men admire them, and wise men use them, for they teach not their own use; but that is a wisdom without them, and above them, won by observation. Read not to contradict and confute; nor to believe and take for granted; nor to find talk and discourse; but to weigh and consider.''',
 ['Summarise the relationship between study and experience.','Explain the comparison between natural abilities and plants.','Does learning for examinations necessarily conflict with Bacon’s ideal?'],
 ['先归纳读书的三种用途，再说经验如何限制抽象规则。','解释植物需要修剪的比喻：天资需要训练，学问需要实践校正。','对考试作条件分析：训练可以促进理解，也可能退化为炫示或机械套用。'],
 'Bacon regards study as a source of pleasure, expression and practical judgment. Yet learning needs experience to guide its use. The image of pruning suggests that education should cultivate ability rather than simply add information. Examinations can support that goal if they reward careful understanding, but they become less useful when students only memorise rules.',
 ['ornament：这里指谈吐上的修饰','disposition：事务的安排、处置','affectation：做作、装模作样','proyning：pruning的旧拼法，修剪','confute：驳倒']),
 ('bacon-reading','Francis Bacon · Of Studies','Reading, conversation and writing',
 '''Some books are to be tasted, others to be swallowed, and some few to be chewed and digested; that is, some books are to be read only in parts; others to be read, but not curiously; and some few to be read wholly, and with diligence and attention. Some books also may be read by deputy, and extracts made of them by others; but that would be only in the less important arguments, and the meaner sort of books; else distilled books are like common distilled waters, flashy things.

Reading maketh a full man; conference a ready man; and writing an exact man. And therefore, if a man write little, he had need have a great memory; if he confer little, he had need have a present wit: and if he read little, he had need have much cunning, to seem to know that he doth not. Histories make men wise; poets witty; the mathematics subtile; natural philosophy deep; moral grave; logic and rhetoric able to contend.''',
 ['What different modes of reading does Bacon recommend?','Paraphrase “writing an exact man” in modern English.','Can an AI-generated summary replace reading the original work?'],
 ['概括浏览、通读、细读，说明选择取决于文本的重要程度。','exact强调准确和严密；writing迫使思想明确，而非只指书写字迹。','结合deputy的历史语境谈辅助摘要的用途，并提出必须回看原文的条件。'],
 'Bacon argues that different books require different kinds of attention. Reading broadens knowledge, conversation develops responsiveness, and writing improves precision. A summary may help us identify a book’s main concerns, but it can flatten the reasoning or style that makes an important work worth reading closely.',
 ['curiously：此处为仔细地','by deputy：由他人代读','flashy：此旧义为淡而无味','conference：交谈、讨论','subtile：subtle的旧拼法']),
 ('mill-errors','John Stuart Mill · On Liberty, Chapter II','Why judgment needs correction',
 '''Why is it, then, that there is on the whole a preponderance among mankind of rational opinions and rational conduct? If there really is this preponderance—which there must be, unless human affairs are, and have always been, in an almost desperate state—it is owing to a quality of the human mind, the source of everything respectable in man either as an intellectual or as a moral being, namely, that his errors are corrigible. He is capable of rectifying his mistakes, by discussion and experience.

Not by experience alone. There must be discussion, to show how experience is to be interpreted. Wrong opinions and practices gradually yield to fact and argument: but facts and arguments, to produce any effect on the mind, must be brought before it. Very few facts are able to tell their own story, without comments to bring out their meaning.

The whole strength and value, then, of human judgment, depending on the one property, that it can be set right when it is wrong, reliance can be placed on it only when the means of setting it right are kept constantly at hand. In the case of any person whose judgment is really deserving of confidence, how has it become so? Because he has kept his mind open to criticism of his opinions and conduct.''',
 ['Why is discussion needed in addition to experience?','Explain “facts are able to tell their own story” in context.','Describe a fair way to test an opinion you strongly hold.'],
 ['指出核心是可纠错性，而不是相信人类天然不会犯错。','经验需要解释；“事实不会自己说话”不是否认事实，而是提示论证与解释。','提出可证伪标准、反面证据、修正条件，给出具体例子。'],
 'Mill traces reliable judgment to our ability to correct mistakes. Experience matters, but discussion helps us interpret what experience actually shows. Confidence should therefore depend on openness to criticism. To test a belief fairly, I would state what evidence could change my mind and actively look for that evidence.',
 ['preponderance：占优势、较大比重','corrigible：可纠正的','rectify：纠正','yield to：向……让步','reliance：信赖']),
 ('mill-tree','John Stuart Mill · On Liberty, Chapter III','A person as a tree',
 '''Human nature is not a machine to be built after a model, and set to do exactly the work prescribed for it, but a tree, which requires to grow and develop itself on all sides, according to the tendency of the inward forces which make it a living thing.

It will probably be conceded that it is desirable people should exercise their understandings, and that an intelligent following of custom, or even occasionally an intelligent deviation from custom, is better than a blind and simply mechanical adhesion to it.

To a certain extent it is admitted, that our understanding should be our own: but there is not the same willingness to admit that our desires and impulses should be our own likewise; or that to possess impulses of our own, and of any strength, is anything but a peril and a snare.

Yet desires and impulses are as much a part of a perfect human being, as beliefs and restraints: and strong impulses are only perilous when not properly balanced; when one set of aims and inclinations is developed into strength, while others, which ought to co-exist with them, remain weak and inactive. It is not because men's desires are strong that they act ill; it is because their consciences are weak. There is no natural connection between strong impulses and a weak conscience.''',
 ['Explain the contrast between a machine and a tree.','Does Mill oppose every form of custom or discipline?','How could a school encourage individuality while maintaining common rules?'],
 ['机器比喻外在定型，树比喻内在生长及多面发展。','用intelligent following证明并非反对一切传统；分清机械遵循和有意识选择。','提出底线规则与自主空间的边界，讨论伤害他人或资源冲突的反例。'],
 'The tree represents a person’s capacity to develop from within, whereas the machine represents a fixed external design. Mill does not reject custom automatically; he values understanding why one follows it. Schools could combine common rules protecting others with genuine choices about reading, projects and interests.',
 ['prescribed：规定的','concede：承认','deviation：偏离','adhesion：依附、遵循','restraint：约束']),
 ('thoreau-life','Henry David Thoreau · Walden','Living deliberately',
 '''I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived. I did not wish to live what was not life, living is so dear; nor did I wish to practise resignation, unless it was quite necessary.

I wanted to live deep and suck out all the marrow of life, to live so sturdily and Spartan-like as to put to rout all that was not life, to cut a broad swath and shave close, to drive life into a corner, and reduce it to its lowest terms, and, if it proved to be mean, why then to get the whole and genuine meanness of it, and publish its meanness to the world; or if it were sublime, to know it by experience, and be able to give a true account of it in my next excursion.''',
 ['What does “live deliberately” mean in this passage?','Identify one physical metaphor and explain its effect.','Must a person leave society to live deliberately?'],
 ['强调有意识地检验生活的基本需要和价值，而不只是慢生活。','可分析marrow、swath或lowest terms，使抽象追求具体、有力度。','区分作者个人实验与普遍规则，给出城市生活中可实行的小型实验。'],
 'Thoreau wants to examine life directly instead of following habits without reflection. The metaphor of marrow suggests reaching what is most essential and nourishing. His retreat is one method of inquiry, not necessarily a rule for everyone. A person in a city might pursue the same aim by reconsidering commitments and testing which activities matter most.',
 ['deliberately：有意识地、审慎地','front：直面','resignation：听任、顺从','marrow：骨髓；精髓','sublime：崇高的']),
]
for id,author,title,text,questions,guide,ref,terms in READINGS:
    url='https://en.wikisource.org/wiki/The_Essays_of_Francis_Bacon/L_Of_Studies' if id.startswith('bacon') else 'https://www.gutenberg.org/cache/epub/34901/pg34901-images.html' if id.startswith('mill') else 'https://www.gutenberg.org/cache/epub/205/pg205-images.html'
    add('read-'+id,ALL,'reading',title,'Read the passage aloud, then answer the questions in English.\n'+'\n'.join(str(i+1)+'. '+q for i,q in enumerate(questions)),guide,['Which exact words in the passage support your interpretation?','What is the strongest objection to your final answer?'],text=text,reference=ref,source={'label':author+' · 公有领域英文节选','url':url,'kind':'真实作家原文','note':'连续节选；去除页码与注释编号，保留旧式用词。题目、释义及参考回答为本网站原创训练内容。'},language='English',prep=180,answer=240,terms=terms)

JAPAN=[
 ('mono','“物哀”是一种消极的悲观主义吗？',['从对事物易逝的感受说明概念，不简单译成“悲伤”。','选樱花、文学或日常器物中的一例分析具体表达。','讨论审美感受与行动伦理之间的距离，避免用单一概念概括所有日本人。'],['“侘寂”和“物哀”能否互换？','如果作品并不悲伤，仍可能有物哀吗？'],'进阶'),
 ('bushido','怎样讨论武士道的变化，而不把它视为永恒不变的民族性？',['先区分不同时期的武士实践、思想整理和近代叙述。','比较忠诚的对象、社会制度及个人选择。','用具体文本或人物限定论点，并承认反例。'],['文学形象能否直接作为历史证据？','如何解释同一概念在不同时代被不同群体使用？'],'挑战'),
 ('borrow','日本吸收外来文化，能说明其文化缺乏原创性吗？',['区分移植、选择、改造和再输出。','可从文字、佛教、建筑或现代技术选择一条具体链条。','解释本土环境如何改变输入内容，不用“照搬”概括复杂过程。'],['中国文化中有怎样的类似过程？','你会采用什么标准判断文化创新？'],'基础'),
 ('group','如何评价“日本重集体、中国重人情”这样的比较？',['先指出比较单位过大与证据要求。','区分家庭、学校、企业等场景及世代差异。','把文化解释与制度激励、经济条件放在一起检验。'],['你怎样设计一个小型调查验证这一说法？','个人经历能支持多大的结论？'],'进阶'),
 ('narrative','从鲁迅与芥川龙之介中各选一篇作品，谈“看客”的相似与差异。',['先交代所选文本和叙事视角。','比较人物怎样被他人的目光塑造，不停留在主题标签。','说明社会处境与叙述讽刺如何造成差别。'],['《鼻子》的结尾为什么不是简单的大团圆？','作者与叙述者的态度一定相同吗？'],'进阶'),
 ('garden','日本庭园中的“留白”与中国山水画中的“留白”有什么可比之处？',['明确空间安排和观看方式，而不是只说“含蓄”。','分析一个视线、路径或构图细节。','指出媒介和使用场景不同，避免把两者等同。'],['没有看过实物时，你会怎样限制自己的判断？','留白能否被滥用成文化营销标签？'],'基础'),
 ('modern','怎样理解近代化与西化之间的关系？请用日本的例子回答。',['先定义制度、技术、生活方式等不同层面。','选择一个具体领域解释借鉴与选择。','讨论进步、代价与不同群体的处境，避免把结果说成历史必然。'],['如何防止用今天的价值简单审判过去？','有没有现代化而不完全西化的例子？'],'挑战'),
 ('animation','动漫可以成为严肃的日本研究材料吗？',['区分研究对象与学术论证。','可从劳动、家庭、技术想象或文化产业设问。','提出文本分析之外需要的受众、生产或历史证据。'],['流行程度等于社会代表性吗？','你会如何把“我喜欢”改成可研究的问题？'],'基础'),
 ('aging','如果研究日本的老龄化，你会优先问哪些问题？',['分清人口结构、养老制度、地区差异和个人经验。','提出可核实的研究问题，而不是背诵未经核实的数据。','比较社会照护、就业和技术方案的收益与限制。'],['机器人能解决哪些照护任务，不能解决哪些？','中日比较需要控制哪些变量？'],'进阶'),
 ('dialect','标准语推广与地方方言保护是否必然冲突？',['分析教育、迁移和公共服务中的共同语言需求。','讨论家庭、媒体、戏剧对地方语言的作用。','提出兼容方案，并说明成本和谁来承担。'],['方言保护是否只需要制作词典？','你家乡的经验能怎样帮助理解日本？'],'基础'),
 ('zen','怎样向不了解佛教的人解释禅宗影响，同时避免神秘化？',['把宗教实践、哲学解释与现代审美包装分开。','选择具体文本、活动或空间进行说明。','承认日本文化的多种来源，避免“所有美学都来自禅”的推论。'],['不能被言说是否意味着不能讨论？','商业品牌使用“禅”时还保留了什么？'],'挑战'),
 ('haiku','如何向英语听众解释俳句的魅力，而不只介绍字数？',['从季节感、意象并置或切断后的联想入手。','使用一个你读过且能核对的例子。','讨论翻译后形式与阅读经验的得失。'],['音节与日语的拍可以直接等同吗？','文化注释越多，译诗越好吗？'],'进阶'),
 ('museums','日本博物馆如何向国际游客解释复杂历史？',['分清事实陈述、材料选择和解释立场。','讨论多语种标牌、文物来源和缺席的声音。','提出一种让争议可见且可核查的展陈方法。'],['中立是否意味着各方观点各占一半？','遇到无法当场核实的说法你怎样回应？'],'进阶'),
 ('tea','茶道是一种固定仪式，还是会变化的文化实践？',['区分规范、身体训练与不同流派。','比较传统传承、现代生活与旅游展示。','讨论形式如何产生意义，同时保留对排他性和成本的反思。'],['简化仪式一定是文化退化吗？','你会如何给外国朋友介绍中国茶文化？'],'基础'),
 ('translation','把日语的“和”译成 harmony 会失去什么？',['说明词义依赖具体语境，先确定句子和对象。','讨论协调、秩序、冲突管理等可能含义。','给出直译、释译或注释的选择，并说明受众。'],['如果“和”压抑了少数人的意见，应该如何评价？','何时应该保留原词？'],'挑战'),
 ('research','如何检验“日本年轻人不愿承担风险”这一概括？',['明确风险的类型、时间范围与比较群体。','把问卷态度与实际行为区分。','考虑就业环境、财富约束与样本选择，提出可反驳的假设。'],['什么证据会让你放弃原来的解释？','为什么国家平均值可能掩盖重要差异？'],'挑战'),
]
for id,title,guide,follow,level in JAPAN:
    add('jp-'+id,JP,'japan',title,'用中文作答；第二轮可改用英语。给出一个可核查例子，再讨论论点的适用范围。',guide,follow,level,reference='参考思路：'+'；'.join(guide)+'。开放题接受其他有证据、能回应反例的论证。')

FRANCE=[
 ('language','怎样理解法语作为文化语言与工程工作语言的双重角色？',['从精准交流、跨国团队和文化语境三个层面展开。','举出技术术语、合同或用户沟通中的具体困难。','说明英语便利性与学习法语的增量价值。'],['翻译软件能替代什么？','你准备怎样同时维持语言与数理训练？']),
 ('food','法国饮食文化与中国饮食文化应该怎样比较？',['比较共同进餐、地域差异、技艺传承与社交场景。','避免将法餐等同高档餐厅，或把中国菜视作单一体系。','选择一个具体场景提出异同与解释。'],['旅游者看到的饮食文化有什么偏差？','保护传统是否意味着菜单不能变化？']),
 ('secular','如何向中国听众解释法国“世俗性”问题的复杂性？',['先区分国家制度、公共机构与个人信仰。','指出原则、历史形成与现实争议不能混为一谈。','不背诵未经核实的法律条文；用问题和证据限定判断。'],['不同社会的公共空间能否使用同一套规则？','平等规则为什么可能产生不同影响？']),
 ('museum','博物馆应如何处理有争议的文物来源？',['说明来源研究、合法取得与伦理正当性并非同一问题。','讨论归还、借展、共同研究等方案及相关方。','提出透明披露证据与持续协商的程序。'],['公众利益与原属地诉求如何兼顾？','归还文物是否意味着停止国际展览？']),
 ('nuclear','讨论法国能源经验时，为什么不能直接复制到中国？',['从资源条件、基础设施、成本与治理能力限定比较。','区分低碳目标与具体技术路径。','要求核实时间和数据后再评价政策成效。'],['安全、成本和减排应怎样权衡？','工程师与公众发生分歧时如何沟通？']),
 ('cinema','电影如何影响外国人对一个国家的想象？',['分析叙事选择、类型传统和发行市场。','指出作品不等于社会全貌。','提出通过多种作品和现实资料交叉验证印象。'],['观众熟悉的国家形象为什么更容易传播？','给你喜欢的电影提出一个有力批评。']),
 ('engineering','中法工程团队出现沟通分歧，你会先调查什么？',['先查术语、任务目标、职责和时间安排。','不要将一切分歧归因于民族性。','提出共同记录、复述确认和升级协商的办法。'],['对方认为你的复述是在质疑能力，怎么办？','怎样判断问题来自语言而非技术？']),
 ('heritage','巴黎式城市遗产保护与现代交通需求如何协调？',['识别居民、游客、商户和通勤者的需求。','比较步行、公共交通、建筑用途与无障碍。','用可逆试点和效果评估代替抽象地赞美或否定保护。'],['限制汽车是否对所有群体公平？','怎样评价一个看起来很美但不宜居的街区？']),
 ('philosophy','“我不同意你，但愿意听你说完”为什么仍然不够？',['区分容忍表达与认真理解论证。','讨论倾听、证据标准和回应对方最强论点。','说明反对某种主张与否定其提出者的区别。'],['对方持续散布错误事实时如何处理？','你在一次真实讨论中改变过观点吗？']),
 ('learning','为什么申请巴院，而不选择纯语言或纯工程路径？',['解释你真正愿意持续学习的问题，而不是只列学校名气。','用数理、戏剧或跨文化沟通的经历证明适配。','承认课程压力，提出具体补足计划。'],['如果必须长期学习困难的理科课程，你如何判断是否坚持？','如果未来不做翻译，语言学习还有什么价值？']),
 ('technology','工程方案“可以实现”是否等于“值得实现”？',['区分技术可行性、经济成本与社会价值。','考虑使用者、非使用者和长期外部影响。','提出早期公众参与及停止项目的条件。'],['工程师应该对误用承担多大责任？','预算有限时你会优先满足谁的需求？']),
 ('education','精英教育怎样兼顾卓越与机会公平？',['把选拔、培养和资源分配分开分析。','讨论奖助、桥梁课程、评价多样性等措施。','指出任何单一指标都有局限，需要检查实际效果。'],['统一考试一定最公平吗？','如何避免帮扶政策降低期待或制造标签？']),
]
for id,title,guide,follow in FRANCE:
    add('fr-'+id,['speit'],'france',title,'用中文作答，再用英语概括立场。国别与综合素质拓展题，不认定为学校真题。',guide,follow,level='挑战' if id in ['secular','nuclear','philosophy'] else '进阶',reference='参考思路：'+'；'.join(guide)+'。')

GERMANY=[
 ('dual','德国职业教育的“双元”思路可以怎样启发中国教育？',['先说明学校学习与企业实践协作的基本问题。','讨论训练质量、企业责任和学生选择。','比较制度条件，避免把某一经验当万能答案。'],['过早分流可能带来什么代价？','企业需求变化后，学生怎样保持转换能力？']),
 ('language','你为什么想学德语，而不只依靠英语了解德国？',['用具体读物、文化或研究兴趣说明动机。','解释原语材料、概念和社会语境的价值。','给出一年可实行的学习计划。'],['如果入门后发现语法枯燥，怎样坚持？','原文阅读是否保证理解正确？']),
 ('goethe','阅读歌德等经典，对今天的高中生有什么意义？',['选择你实际读过、能够说明的具体篇章。','分析人物处境或表达方式与当下问题的联系。','保留历史距离，避免把作品当作直接的人生处方。'],['如果没有读过原文，你如何说明自己的阅读边界？','经典的地位是否可以受到质疑？']),
 ('memory','一个社会应该怎样面对艰难的历史记忆？',['区分事实教育、纪念仪式和现实责任。','讨论档案、博物馆、亲历者与世代传递。','避免把历史责任简化为对今天每个个体的相同道德判决。'],['遗忘与宽恕有什么区别？','纪念活动形式化时应怎样改进？']),
 ('energy','评价能源转型时，应同时观察哪些指标？',['同时考虑排放、供能可靠性、成本和分配影响。','明确时间范围、基准与替代方案。','不使用未经核实的德国最新数据。'],['短期排放上升能否说明长期政策失败？','谁承担转型成本才算公平？']),
 ('industry','“德国制造”应被理解为一种民族性格吗？',['先分析标准、培训、供应链与企业组织。','承认行业、企业和时期之间的差异。','区分品牌叙事与可检验的质量指标。'],['一个成功企业能代表一个国家吗？','如何解释同一国家不同产品质量的差别？']),
 ('translation','一个德语复合词没有简洁的中文对应词，应该怎样翻译？',['先弄清语境中的概念边界和语用功能。','比较拆解释译、借用术语、保留原词加注释。','根据受众和使用目的选择，不把字数少当作唯一标准。'],['如果面向法律文本与文学文本，方法有什么不同？','怎样确认你没有误解这个词？']),
 ('federal','地方差异为什么是国别研究的重要内容？',['区分国家层面的共同制度与地区生活经验。','从教育、产业、方言或城市历史选择一个维度。','提出避免以一座城市代表整个德国的方法。'],['你会怎样设计比较研究的样本？','中国的地区差异能否作为直接解释？']),
 ('music','音乐为何既可能是跨语言的，也深受文化语境影响？',['区分声音感受、形式习惯与历史意义。','选择一首实际听过的作品谈具体细节。','讨论演出场景、教育和听众经验的作用。'],['听不懂作品背景还能欣赏吗？','把所有理解都交给专家会失去什么？']),
 ('environment','怎样向德国同龄人解释中国的城市变化？',['选择熟悉的杭州街区或乡村变化，给出具体观察。','同时讨论便利、环境、社区关系和代价。','避免只做成就展示，也避免以偏概全。'],['对方的负面印象有真实依据时你怎样回应？','你会用什么资料补充个人体验？']),
 ('research','学习德语与学习光电等技术学科能怎样相互促进？',['分别说明语言能力与技术判断能解决什么问题。','举出标准、技术文献、项目沟通或产业研究的交叉场景。','提出分阶段训练，避免以“复合型”口号替代能力。'],['你如何证明自己不是两边都浅尝辄止？','你愿意长期钻研哪一个具体问题？']),
 ('rules','遵守规则与批评规则能否同时成立？',['区分规则目的、程序正当性和具体结果。','举例说明通过合法程序提出改进。','分析紧急情境、错误规则和个人责任的边界。'],['服从能否免除责任？','你曾经怎样处理过一条不合理的班级规定？']),
]
for id,title,guide,follow in GERMANY:
    add('de-'+id,['zju'],'germany',title,'用中文或英语回答，不要求预先掌握德语。提出比较维度，并说明证据的边界。',guide,follow,reference='参考思路：'+'；'.join(guide)+'。')

SCHOOL_SPECIFIC={
 'pku': [('reading-life','讲一段阅读怎样改变了你理解他人的方式。','从具体句子或叙事视角讲起，说明原来的判断、文本中的阻力和修正。'),('science-humanities','化学竞赛与文学阅读在你身上如何相互影响？','用一次发现或误判说明两种方法的作用，避免“都训练思维”的空泛答案。'),('stage','你扮演屈原或导演戏剧的经验怎样帮助你理解日本文学？','讲舞台行动、人物立场与语境，不把作品归结为情绪表演。')],
 'thu': [('evidence','如果你最喜欢的文化解释与数据冲突，你会怎么办？','区分解释、测量和数据质量，提出修改观点的明确条件。'),('failure','介绍一次你经过复盘后改变方法的失败。','用目标、行动、反馈、修正和再验证组织，承认仍未解决的问题。'),('language-ai','机器翻译迅速发展，大学为什么还应培养语言专业学生？','从问题定义、语境判断、责任和原创研究展开，同时承认工具能替代的工作。')],
 'ruc': [('survey','如果调查同学对日本的印象，你会如何设计问卷？','控制诱导性表述、样本代表性和测量维度，区分知识与态度。'),('law','语言专业学生如何参与涉外法治研究而不越过专业边界？','解释语言证据、制度语境和跨学科合作，承认不能仅靠语言能力作法律结论。'),('policy','一项文化传播项目很受欢迎，就一定成功吗？','先定义目标人群与效果，区分接触量、理解和长期态度变化。')],
 'bfsu': [('ambiguity','介绍一次你发现同一句话存在两种合理理解的经历。','明确语言形式、上下文与受众预设，再说明如何减少误解。'),('untranslatable','你认为有完全不可翻译的词吗？','区分词对词对应与语篇层面的意义传递，用例子展示补偿方法。'),('china-story','向不了解杭州的日本同龄人介绍你的家乡，你会选择什么？','从具体生活场景出发，解释文化背景，并准备回应可能的误解。')],
 'speit': [('team','Tell us about a disagreement you helped resolve in a team.','具体说明各方目标、你采取的沟通和最终可检验的结果，不编造自己的贡献。'),('math-language','How would you balance demanding mathematics courses with language learning?','提出可执行时间分配、反馈和求助机制，说明学习动力与取舍。'),('technology-work','Describe a technical idea to someone with no scientific background.','用准确的类比解释原理、用途和局限，并检查听众理解。')],
 'zju': [('motivation','为什么选择德语方向？请把兴趣落实到一个具体问题。','用真实阅读或观察提出问题，说明还不知道什么，以及怎样开始研究。'),('compare','比较中德教育时，你最想避免哪一种误区？','先限定制度层级与人群，区分价值判断与因果解释。'),('interdiscipline','如果跨学科学习比预想困难，你会怎样重新安排目标？','用阶段目标、能力短板和可逆选择回答，不只表态“坚持”。')],
}
for school,rows in SCHOOL_SPECIFIC.items():
    for id,title,core in rows:
        add(school+'-'+id,[school],'personal',title,'以真实经历作答；可先用中文整理，再用英语完成两分钟回答。',[core,'交代具体情境、自己的行动和可以核查的结果。','说明局限、反思及下一步，不背诵泛泛的优秀品质。'],['请举出一个细节支持你的说法。','如果重新做一次，你会改变什么？'],reference='可用结构：具体情境 → 自己的选择 → 结果与证据 → 反思和下一步。核心提示：'+core)

for s in SCHOOLS:
    add(s['id']+'-self-introduction',[s['id']],'personal','Self-introduction · '+s['short'],
        'Introduce yourself in English and explain why this course suits you. Connect one academic experience and one experience beyond the classroom to a question you would like to explore at university.',
        ['用一条清晰主线连接学习兴趣、实际经历与申请动机，避免只列获奖清单。','可从化学学习、写作或戏剧经历中选真实细节，说明自己如何思考和改变。','以一个希望继续研究的问题结尾，并说明当前能力边界。'],
        ['Which experience best supports the main claim in your introduction?','What do you still need to learn before you can explore that question seriously?'],
        language='English',answer=180 if s['id']=='pku' else 120,
        reference='Suggested structure: a focused opening → one academic example → one contrasting experience → why the course connects them → an honest question for future study. School emphasis for this training: '+s['profileFocus']+'。经历与成绩应以本人真实情况为准。')

SPEECHES=[
 ('ai-learning','Should students use AI when learning a foreign language?',['承认反馈和练习的便利；把自主表达、核实和反思设为条件。','举一个先独立完成再用工具比较的方案。','讨论依赖、错误与学习者差异，避免绝对禁用或完全放任。']),
 ('practical','Should university education be more practical?',['把practical解释为解决真实问题，而非只训练眼前技能。','讨论基础理论如何支持长期适应。','以项目、实习和通识课程的组合回应两者张力。']),
 ('recycle','Should recycling be mandatory for every household?',['区分公共目标与执行成本。','主张清晰规则、便利设施及过渡支持。','考虑老人、租客和地区差异，讨论教育与处罚的比例。']),
 ('heritage','Can tourism help preserve cultural traditions?',['承认收入、关注和传承机会。','分析表演化、社区失语和收益分配。','提出由社区参与决策、评价实际传承的条件。']),
 ('mistakes','Is making mistakes essential to learning?',['区分可控学习错误与会伤害他人的高风险错误。','用一次真实修正过程作例子。','强调及时反馈与复盘，不能把重复错误浪漫化。']),
 ('expert','Should experts have the final say on public issues?',['区分技术事实、价值选择与民主参与。','解释专家证据的必要性及其不确定性。','提出公开理由、利益披露和可修正的决策程序。']),
 ('city','Should cities prioritise residents over tourists?',['明确住房、公共空间和交通等场景。','承认旅游收益，并讨论居民承受的成本。','提出容量管理与社区参与的具体措施。']),
 ('translation','Can translation ever be completely faithful?',['定义忠实涉及意义、语气、功能和形式。','用习语或文学意象展示无法同时最大化的目标。','主张公开选择、服务受众，同时守住事实准确。']),
 ('competition','Does competition improve education?',['区分适度激励与高风险排名。','讨论合作、反馈和不同起点。','提出同时奖励进步、协作和深度学习的评价办法。']),
 ('slow','Is doing things more slowly always better?',['区分需要深思与需要快速响应的任务。','用阅读或紧急情况说明条件差异。','讨论如何选择节奏，而不把速度本身道德化。']),
 ('technology','Should engineers be responsible for how their inventions are used?',['区分可预见后果与完全不可控制的误用。','讨论设计防护、测试和透明沟通。','说明企业、使用者和监管者的共同责任。']),
 ('languages','Will learning smaller languages remain valuable?',['区分交流人数与文化、研究、专业场景价值。','承认工具降低部分成本。','把学习选择与兴趣、区域知识及可持续投入联系。']),
]
for id,title,guide in SPEECHES:
    add('speech-'+id,ALL,'speech',title,'Prepare for 45 seconds, then speak for about two and a half minutes. Give a qualified position, one concrete example and a response to an objection.',guide,['What is the strongest argument against your position?','Under what circumstances would you change your view?'],answer=150,language='English',reference='Suggested structure: a qualified position (20 seconds) → reason and example (60 seconds) → objection and limitation (45 seconds) → practical proposal (25 seconds).\n本题思路：'+'；'.join(guide))

TRANSLATIONS=[
 ('lab','实验室开放日',
 '我们希望这次实验室开放日能够让中学生看到，科学研究并不总是从一个漂亮的答案开始。很多时候，研究者先发现原来的解释无法说明某个现象，再重新设计实验。参观者不仅可以观察仪器，也可以询问失败的数据为何仍然值得保留。判断一项研究的价值，不能只看结果是否符合预期，还要看方法是否可靠、问题是否因此变得更加清楚。',
 'We hope this laboratory open day will show secondary school students that scientific research does not always begin with an elegant answer. Researchers often start by discovering that an existing explanation cannot account for a particular phenomenon, and then redesign their experiments. Visitors can not only observe the equipment but also ask why data from unsuccessful attempts are still worth keeping. The value of a study should be judged not simply by whether its results meet expectations, but also by whether its methods are reliable and its research question becomes clearer.',
 ['实验室开放日：laboratory open day','说明现象：account for a phenomenon','符合预期：meet expectations']),
 ('heritage','传统技艺与年轻人',
 '让传统技艺重新进入年轻人的生活，未必意味着把每一种产品都做得更时髦。如果学习过程仍然昂贵，工作机会仍然有限，短期的网络热度就很难变成稳定的传承。博物馆、学校和社区可以共同提供入门课程，让学习者先理解材料与工序，再尝试新的设计。真正值得关注的，不只是有多少人看过一段视频，而是有多少人愿意继续学习，以及手艺人能否获得合理的报酬。',
 'Bringing traditional crafts back into young people’s lives does not necessarily mean making every product more fashionable. If training remains expensive and job opportunities limited, short-lived online popularity is unlikely to lead to sustained transmission. Museums, schools and communities can jointly offer introductory courses, enabling learners to understand materials and processes before experimenting with new designs. What matters is not merely how many people watch a video, but how many choose to keep learning and whether craftspeople receive fair pay.',
 ['传统技艺：traditional crafts','传承：transmission','合理报酬：fair pay']),
 ('team','国际工程合作',
 '在国际工程项目中，语言能力的作用不仅是把一个词换成另一个词。来自不同背景的成员，可能对同一个截止日期、质量标准或风险提示有不同的理解。为了减少误会，团队应当共同记录关键决定，明确责任，并请各方复述自己的理解。发现分歧后，首先需要确认问题来自技术判断、工作安排还是语言表达，而不是立即把它解释成某一种文化的特点。',
 'In international engineering projects, language skills involve more than replacing one word with another. Team members from different backgrounds may interpret the same deadline, quality standard or risk warning differently. To reduce misunderstandings, teams should keep a shared record of key decisions, clarify responsibilities and ask participants to restate their understanding. When a disagreement arises, the first step is to determine whether it concerns technical judgment, working arrangements or wording, rather than immediately attributing it to a particular culture.',
 ['截止日期：deadline','复述理解：restate one’s understanding','归因于：attribute ... to ...']),
 ('city','城市更新中的居民',
 '一条老街经过整修后可能吸引更多游客，但这并不自动意味着原来的居民生活得更好。租金上涨、日常商店减少或公共空间被占用，都可能改变社区的关系。评估城市更新时，除了计算新增的收入，还应该听取长期居住者的意见，观察他们能否继续方便地生活。保护一座城市的记忆，既包括保存建筑，也包括让普通人的生活有延续下去的空间。',
 'Renovating an old street may attract more visitors, but this does not automatically mean that its original residents are better off. Rising rents, fewer everyday shops and the occupation of public space can all reshape community relationships. Urban renewal should be assessed not only by the additional revenue it generates, but also by listening to long-term residents and examining whether they can continue to live conveniently. Preserving a city’s memory involves both conserving its buildings and leaving room for ordinary lives to continue.',
 ['城市更新：urban renewal','长期居民：long-term residents','延续：continue / sustain']),
 ('education','学习与提问',
 '跨学科学习的困难，有时不在于学生知道得太少，而在于不同学科使用证据的方式并不相同。文学研究可以从一个词语的细微差别提出问题，实验科学则需要考虑测量与重复验证。两种方法都要求严谨，但严谨并不总是表现为同一种形式。大学教育可以帮助学生认识这些差异，并学会在进入一个新领域时，先询问什么样的证据能够支持自己的判断。',
 'The difficulty of interdisciplinary learning sometimes lies not in how little students know, but in the different ways disciplines use evidence. Literary studies may begin with a subtle difference between words, while experimental science must consider measurement and replication. Both require rigour, although rigour does not always take the same form. University education can help students recognise these differences and learn, when entering a new field, to ask what kind of evidence would support their judgment.',
 ['跨学科学习：interdisciplinary learning','重复验证：replication','严谨：rigour']),
 ('climate','气候信息的沟通',
 '向公众解释环境风险时，只给出一个平均值往往不够。同样的变化可能对不同地区、职业和年龄群体产生不同影响。如果信息过于技术化，人们可能无法理解；如果为了吸引注意而夸大结论，又可能损害信任。有效的沟通应当说明目前知道什么、仍有哪些不确定性，以及个人和公共机构分别能够采取什么行动。承认不确定性，并不意味着否认采取行动的必要。',
 'When environmental risks are explained to the public, an average figure is often not enough. The same change can affect regions, occupations and age groups differently. Information that is too technical may be difficult to understand, while exaggerating conclusions to attract attention can undermine trust. Effective communication should explain what is currently known, what remains uncertain, and what individuals and public institutions can each do. Acknowledging uncertainty does not mean denying the need for action.',
 ['平均值：an average figure','损害信任：undermine trust','不确定性：uncertainty']),
 ('museum','博物馆的多语种展签',
 '一块好的多语种展签，不应假定每位参观者都了解展品背后的历史。直接翻译专有名词，有时只能让文字显得完整，却不能帮助理解。策展人和译者需要共同决定，哪些背景必须说明，哪些细节可以放在延伸阅读中。篇幅有限时，最重要的不是把所有信息塞进去，而是让观众知道自己正在看什么、它为什么重要，以及可以到哪里进一步核实。',
 'A good multilingual museum label should not assume that every visitor knows the history behind an object. Directly translating proper names may make a text appear complete without making it understandable. Curators and translators need to decide together which background information is essential and which details can be left for further reading. When space is limited, the priority is not to squeeze in every fact, but to help visitors understand what they are looking at, why it matters and where they can verify the information.',
 ['展签：museum label','策展人：curator','延伸阅读：further reading']),
 ('mobility','交换学习的意义',
 '海外交换的价值，并不只取决于去过多少地方。如果学生始终只与来自同一背景的人交往，新的环境也可能只是旧习惯的延伸。学校可以鼓励交换生参加本地项目，与不同专业的同学合作，并定期记录自己的误解与修正。真正的跨文化能力不是记住一张礼仪清单，而是在不熟悉的情境中，能够耐心询问、核实自己的假设，并尊重他人解释自身经历的权利。',
 'The value of an overseas exchange does not depend only on how many places a student visits. If students interact exclusively with people from the same background, a new setting may simply extend old habits. Universities can encourage exchange students to join local projects, work with peers from other disciplines and regularly record their misunderstandings and corrections. Intercultural competence is not a checklist of etiquette. It is the ability to ask patient questions in unfamiliar situations, test one’s assumptions and respect other people’s right to explain their own experience.',
 ['海外交换：overseas exchange','核实假设：test one’s assumptions','跨文化能力：intercultural competence']),
]
for id,title,zh,en,terms in TRANSLATIONS:
    for direction in ['zh-en','en-zh']:
        text,ref=(zh,en) if direction=='zh-en' else (en,zh)
        add(direction+'-'+id,['speit'],direction,title+(' · 中译英' if direction=='zh-en' else ' · 英译中'),'先默读或听取原文，再完整口译。保留逻辑关系、限定语和信息层次；练习模式可显示原文，模拟模式可在作答阶段遮盖原文。',['先切分意群，建立主题、转折、条件及结论的结构。','信息完整优先，不漏译限定语；允许为自然表达调整语序。','完成后对照参考译文，记录漏译、逻辑、搭配与术语问题。'],['请用一句话概括原文的核心意思。','哪一个限定语最容易在口译时丢失？'],text=text,reference=ref,language='中文 → English' if direction=='zh-en' else 'English → 中文',prep=60,answer=150,terms=terms)

# Extra written questions supplement the versioned original three-subject bank.
EXTRA=[]
def mc(id,subject,stem,options,key,analysis,tag,level='进阶'):
    EXTRA.append(dict(id=id,subject=subject,stem=stem,options=options,answer=key,analysis=analysis,tag=tag,level=level,source='ChatGPT 原创训练题；非官方真题'))

MATH=[
 ('m01','正实数 a,b 满足 a+b=6，则 a²b 的最大值为多少？',['24','27','32','36'],'C','令 b=6−a，f(a)=a²(6−a)，0<a<6。f′(a)=3a(4−a)，在a=4时取得最大值32。','函数与不等式'),
 ('m02','关于 x 的方程 x²−2tx+t+2=0 有两个不同实根，则 t 的取值范围是？',['t<−1 或 t>2','t≤−1 或 t≥2','−1<t<2','t<−2 或 t>1'],'A','判别式为4(t²−t−2)=4(t−2)(t+1)>0，故t<−1或t>2。','参数与方程'),
 ('m03','将5本不同的书分给3名不同的同学，每人至少1本，共有多少种方法？',['120','150','180','243'],'B','由容斥原理，3⁵−C(3,1)2⁵+C(3,2)1⁵=243−96+3=150。','排列组合'),
 ('m04','抛掷一枚均匀硬币4次，已知至少出现一次正面，则恰好出现两次正面的概率为？',['3/8','2/5','3/5','2/7'],'B','排除全部反面的1种，条件样本空间有15种；恰好两正有C(4,2)=6种，概率6/15=2/5。','条件概率'),
 ('m05','复数 z 满足 (1+i)z=2−i，则 |z|² 等于？',['3/2','2','5/2','5'],'C','由模的乘法，|1+i|²|z|²=|2−i|²=5，故|z|²=5/2。','复数'),
 ('m06','若 α、β 是 x²−3x+1=0 的两根，则 α³+β³ 等于？',['9','12','15','18'],'D','α+β=3，αβ=1，立方和=(α+β)³−3αβ(α+β)=27−9=18。','韦达定理'),
 ('m07','函数 f(x)=ln x−x/2（x>0）的最大值为？',['ln2−1','1−ln2','−1/2','0'],'A','f′(x)=1/x−1/2，在x=2处由正变负，最大值ln2−1。','导数极值'),
 ('m08','数列 a₁=1，aₙ₊₁=2aₙ+1，则 a₈ 等于？',['127','128','255','256'],'C','设bₙ=aₙ+1，则b₁=2，bₙ₊₁=2bₙ，故aₙ=2ⁿ−1，a₈=255。','递推数列'),
 ('m09','从1,2,…,10中随机选两个不同的数，其和为奇数的概率为？',['1/2','5/9','4/9','2/3'],'B','共有C(10,2)=45种等可能选法；一奇一偶有5×5=25种，概率5/9。','古典概率'),
 ('m10','直线 y=x+k 与圆 x²+y²=8 相切，则 |k| 等于？',['2','2√2','4','4√2'],'C','圆心到x−y+k=0的距离为|k|/√2，等于半径2√2，故|k|=4。','解析几何'),
 ('m11','向量 a、b 满足 |a|=2，|b|=3，a·b=3，则 |a−b|² 等于？',['5','7','9','13'],'B','|a−b|²=|a|²+|b|²−2a·b=4+9−6=7。','平面向量'),
 ('m12','函数 y=sin x+√3 cos x 的最小正周期与最大值分别为？',['π，2','2π，√3','2π，2','π，√3'],'C','化为2sin(x+π/3)，周期2π，最大值2。','三角函数'),
 ('m13','整数 x、y 满足 x≥0，y≥0，x+y≤4，共有多少对有序解？',['10','12','15','20'],'C','按x=0,1,2,3,4分别有5,4,3,2,1个y，共15对。','整数计数'),
 ('m14','若 f(x)=x³−3x，则 f(x)=k 有三个不同实根的充要条件为？',['−2<k<2','−2≤k≤2','k>2','k<−2'],'A','f′(x)=3(x²−1)，极大值f(−1)=2，极小值f(1)=−2；水平线在两者之间时有3个不同交点。','函数零点'),
 ('m15','已知 0<a<1，则不等式 logₐ(x−1)>2 的解集为？',['x>1+a²','1<x<1+a²','x<1+a²','0<x<a²'],'B','先有x>1；底数小于1，对数递减，故x−1<a²，合并为1<x<1+a²。','对数不等式'),
 ('m16','在正六边形6个顶点中任选3点构成三角形，其中等边三角形有几个？',['1','2','3','6'],'B','正六边形内接圆上等边三角形的顶点需每隔一个顶点取点，只有奇数号与偶数号两组。','几何计数'),
 ('m17','若随机变量 X 的分布为 P(X=0)=1/4，P(X=1)=1/2，P(X=2)=1/4，则 Var(X) 为？',['1/4','1/2','3/4','1'],'B','E(X)=1，E(X²)=1/2+1=3/2，因此方差3/2−1=1/2。','概率分布'),
 ('m18','实数 x 满足 |x−1|+|x+1|=4，则 x² 的值为？',['1','2','3','4'],'D','当−1≤x≤1时左边为2；区间外左边为2|x|，故|x|=2，x²=4。','绝对值'),
 ('m19','等差数列前 n 项和 Sₙ=n²+2n，则第10项为？',['19','20','21','22'],'C','aₙ=Sₙ−Sₙ₋₁=2n+1，故a₁₀=21。','数列求和'),
 ('m20','对所有实数 x，x²−2ax+4≥0 恒成立，则 a 的取值范围为？',['−2<a<2','−2≤a≤2','a≤4','a≥−4'],'B','配方为(x−a)²+4−a²，最小值4−a²≥0，故|a|≤2。','恒成立问题'),
]
for id,stem,opts,key,analysis,tag in MATH:
    mc(id,'数学',stem,opts,key,analysis,tag,level='基础' if id in ['m05','m06','m08','m11','m12','m18','m19'] else '进阶')

ENGLISH=[
 ('e01','Only after the results were checked ____ the team announce its conclusion.',['did','had','was','has'],'A','Only+状语置于句首，主句部分倒装；announce用原形，故助动词为did。','倒装'),
 ('e02','The proposal requires that each participant ____ a written summary.',['submits','submit','submitted','has submitted'],'B','require后的宾语从句用虚拟语气(should)+动词原形，should可省。','虚拟语气'),
 ('e03','There is little point in ____ the same claim without new evidence.',['repeat','to repeat','repeating','repeated'],'C','there is little point in doing sth中in是介词，后接动名词。','非谓语'),
 ('e04','No sooner had the interview begun ____ the candidate was asked to defend an assumption.',['when','than','that','as'],'B','no sooner ... than ... 为固定搭配，句首no sooner触发倒装。','关联结构'),
 ('e05','The study distinguishes a correlation ____ a causal relationship.',['to','by','from','with'],'C','distinguish A from B：将A与B区分。','动词搭配'),
 ('e06','The editor rejected the argument, not because it was unpopular, ____ because it lacked evidence.',['and','yet','so','but'],'D','not because ... but because ...：不是因为……而是因为……。','逻辑连接'),
 ('e07','The collection includes several letters, none of ____ has been published before.',['which','them','that','what'],'A','逗号后非限制性定语从句，none of which作主语；none of them需另有连词或独立句标点。','定语从句'),
 ('e08','I would rather you ____ the original passage before reading the commentary.',['read','will read','have read','are reading'],'A','would rather sb did sth表示对现在或将来的愿望；read的过去式拼写与原形相同。','虚拟语气'),
 ('e09','The more carefully we define the question, ____ it becomes to test the answer.',['easier','the easier','the easiest','more easily'],'B','the+比较级，the+比较级：越……越……。','比较结构'),
 ('e10','Her account is consistent ____ the evidence collected independently.',['for','to','with','at'],'C','be consistent with：与……一致。','形容词搭配'),
 ('e11','Had I known the text was incomplete, I ____ a different passage.',['choose','will choose','would choose','would have chosen'],'D','Had I known=If I had known，过去事实相反，主句would have done。','虚拟语气'),
 ('e12','What matters is not the number of facts remembered ____ the ability to connect them.',['but','and','or','nor'],'A','not A but B：重要的是B，非A；并列the number与the ability。','并列结构'),
 ('e13','The results should be interpreted with ____, since the sample was small.',['precision','caution','permission','admiration'],'B','样本量小需要谨慎解释：with caution。precision为精确，不是这里强调的态度。','语境词汇'),
 ('e14','The lecturer asked us to ____ an example that did not fit our theory.',['account for','take after','put off','bring up with'],'A','account for解释、说明；结合不符合理论的例子，选解释。','短语辨析'),
 ('e15','____ the two versions share a theme, their narrative perspectives differ.',['Despite','Although','Because of','In spite'],'B','空格后为完整从句，需要although；despite与because of后通常接名词性结构。','让步从句'),
 ('e16','This is the first time the team ____ its records available to the public.',['makes','made','has made','had made'],'C','This is the first time ...从句通常用现在完成时，强调截至现在的第一次。','时态'),
 ('e17','The problem is too complex ____ by a single statistic.',['to explain','to be explained','explaining','being explained'],'B','problem与explain为被动关系，too ... to be done。','非谓语'),
 ('e18','Neither the findings nor the method ____ convincing.',['seem','are','is','have been'],'C','neither ... nor ...主谓一致就近，method单数，选is。','主谓一致'),
 ('e19','An explanation is useful only if it can be ____ against evidence.',['tested','celebrated','translated','possessed'],'A','test an explanation against evidence：用证据检验解释。','学术词汇'),
 ('e20','He spoke as if he ____ the event himself, though he had only read about it.',['witnesses','has witnessed','had witnessed','will witness'],'C','as if后对过去事实作相反假设，用过去完成时。','虚拟语气'),
 ('e21','The museum revised the label to make it ____ to visitors unfamiliar with the period.',['accessible','accidental','exclusive','resistant'],'A','accessible to此处表示易理解的；语境是帮助不了解背景的游客。','语境词汇'),
 ('e22','The claim rests on an assumption ____ has yet to be examined.',['what','who','that','where'],'C','先行词assumption，关系词在从句中作主语，选that。','定语从句'),
 ('e23','It was the context, rather than the individual words, ____ changed my interpretation.',['what','that','where','how'],'B','强调句It was ... that ...；rather than不改变强调结构。','强调句'),
 ('e24','The two accounts differ ____ the importance they assign to personal choice.',['in','from','with','for'],'A','differ in+方面；differ from+比较对象。','介词搭配'),
 ('e25','The evidence does not ____ the possibility of another explanation.',['rule out','carry on','look after','take in'],'A','rule out排除；证据不能排除另一种解释。','短语辨析'),
 ('e26','____ carefully, the figures reveal a more complicated pattern.',['Examining','Examined','To examine','Having examining'],'B','figures与examine为被动关系，过去分词短语作条件或方式状语。','分词结构'),
 ('e27','A translator must decide which details are ____ to the purpose of the text.',['relevant','reluctant','redundant','remote'],'A','relevant to与……相关；本句强调翻译目的对细节选择的作用。','形近词'),
 ('e28','She avoided ____ a conclusion until she had compared all the sources.',['draw','to draw','drawing','drawn'],'C','avoid doing sth固定用法。','动词搭配'),
 ('e29','The discussion would have been more useful if everyone ____ the passage beforehand.',['reads','would read','has read','had read'],'D','过去反事实条件句if+had done，主句would have done。','虚拟语气'),
 ('e30','The policy benefits some groups, ____ it imposes additional costs on others.',['while','despite','therefore','because of'],'A','空格后为完整从句，while表示对照。despite和because of是介词结构；therefore不能只用逗号连接两个独立句。','逻辑连接'),
]
for id,stem,opts,key,analysis,tag in ENGLISH:
    mc(id,'英语',stem,opts,key,analysis,tag,level='挑战' if id in ['e08','e11','e20','e23','e26','e29'] else '基础' if id in ['e03','e05','e09','e10','e28'] else '进阶')

DATA=dict(version='2.0',updated='2026-10-25',policyYear=2026,targetYear=2027,
          policyNote='2027备考，先以已核对的2026公开要求作为参考；2027考试要求待当年简章更新。学校科目、题型材料与本站训练设计分别标注。',
          generationNote='从已收录题库按条件抽题组卷；不会实时调用AI生成新文章。试卷快照可保存至私人云端档案，题库数量与重复情况如实显示。',
          schools=SCHOOLS,types={'reading':'英语读文','zh-en':'中译英口译','en-zh':'英译中口译','speech':'即兴演讲','japan':'日本国别','france':'法国国别','germany':'德国国别','personal':'综合面试'},
          oralItems=ORAL,writtenExtra=EXTRA,
          rubric=[{'name':'内容与任务完成','max':30,'hint':'准确回应问题，关键信息完整，有证据或具体例子。'},{'name':'语言准确与自然','max':25,'hint':'词义、语法、术语准确；表达符合语境。'},{'name':'组织与论证','max':20,'hint':'结构清楚，衔接自然，能说明条件和反例。'},{'name':'流利度与语音','max':15,'hint':'节奏稳定、意群清晰、发音可理解；须依据实际口头表现评分。'},{'name':'互动与反思','max':10,'hint':'能理解追问、承认不确定性并作出修正。'}])

if __name__=='__main__':
    path=ROOT/'public'/'schools.json'
    path.write_text(json.dumps(DATA,ensure_ascii=False,indent=2)+'\n')
    print(f'{len(SCHOOLS)} schools, {len(ORAL)} oral tasks, {len(EXTRA)} supplementary written questions → {path}')
