def make_english():
    def q(i,stem,options,answer,analysis,tag,points=2,level=3):
        return dict(id=i,stem=stem,options=options,answer=answer,analysis=analysis,tag=tag,points=points,level=level)
    mc=[
    q(1,'No sooner _____ the revised figures than the committee requested another audit.',
      ['the analyst had presented','had the analyst presented','the analyst presented','did the analyst present'],'B',
      'No sooner 位于句首，主句使用部分倒装；与 than 引出的过去动作相配，先发生的动作使用过去完成时：had the analyst presented。D 的一般过去时不符合此处固定时态搭配。','倒装与时态'),
    q(2,'The proposal was rejected on the _____ that its projected savings had not been independently verified.',
      ['foundations','premises','motives','grounds'],'D',
      'on the grounds that 意为“理由是……”。premise 指推理前提，motive 指动机，foundation 指基础，均不构成这里的固定表达。','固定搭配'),
    q(3,'The new documents failed to _____ the two accounts; if anything, they made the contradiction more obvious.',
      ['reconcile','redeem','retrieve','reassure'],'A',
      'reconcile two accounts 使两种叙述相互吻合、调和矛盾。redeem 赎回／挽回；retrieve 取回；reassure 使人安心。后半句明确要求“消除叙述矛盾”这一语义。','近义词辨析'),
    q(4,'Such _____ the demand for the specialist course that an additional class had to be arranged.',
      ['were','did','was','had'],'C',
      'Such was the demand that... 为倒装结构，正常语序是 The demand was such that...。主语 demand 为单数，故用 was。','表语前置倒装'),
    q(5,'The validity of her conclusion hinges _____ whether the sample is representative of the wider population.',
      ['at','on','with','by'],'B',
      'hinge on/upon 意为“取决于”，后接名词或从句。这里强调结论能否成立取决于样本代表性。','动词介词搭配'),
    q(6,'The audit uncovered a striking _____ between the expenses claimed and the receipts actually submitted.',
      ['compliance','affinity','correspondence','discrepancy'],'D',
      'discrepancy between A and B 指二者不一致。correspondence 是相符／对应，affinity 是亲近／相似，compliance 是遵从，不合账目核查中所揭示的问题。','学术词汇'),
    q(7,'Had it not been for the laboratory assistant, the error _____ unnoticed until the report was published.',
      ['would remain','will have remained','would have remained','had remained'],'C',
      'Had it not been for... 相当于 If it had not been for...，表示与过去事实相反的条件；主句用 would have done。','虚拟条件句'),
    q(8,'Asked to support or oppose the measure, the spokesperson remained deliberately _____, leaving both interpretations open.',
      ['equivocal','meticulous','unanimous','categorical'],'A',
      'equivocal 意为模棱两可，与 leaving both interpretations open 呼应。categorical 是明确无保留的，语义相反；meticulous 一丝不苟；unanimous 一致同意的。','语境选词'),
    q(9,'It would be misleading to _____ the improvement solely to the new software when staffing levels also increased.',
      ['subscribe','ascribe','prescribe','transcribe'],'B',
      'ascribe A to B 将 A 归因于 B。subscribe to 订阅／赞同；prescribe 开药方／规定；transcribe 转录。solely 与 when 从句形成对单因解释的限制。','形近词与归因表达'),
    q(10,'Although attractive in principle, the scheme is _____ with practical difficulties.',
      ['endowed','liable','entitled','fraught'],'D',
      'be fraught with difficulties 充满困难。be endowed with 通常接天赋、资源等；be liable to 易于；be entitled to 有权获得，均不匹配本句结构与语义。','固定搭配'),
    q(11,'The manuscript, together with the accompanying notes, _____ delivered to the editor yesterday.',
      ['was','were','have been','are'],'A',
      '主语为单数 manuscript，together with 引出的附加成分不改变主语的数；yesterday 要求过去时，所以用 was。','主谓一致'),
    q(12,'His apology was so _____ that it sounded like a routine duty rather than an expression of regret.',
      ['peripheral','prospective','perfunctory','provisional'],'C',
      'perfunctory 指例行公事、敷衍的，与 routine duty 对应。peripheral 边缘的；prospective 预期的／未来的；provisional 临时的。','高阶形近词'),
    q(13,'At no time _____ the participants told that their individual responses would be made public.',
      ['had','did','was','were'],'D',
      '否定短语 At no time 前置须倒装。participants 为复数，被告知用被动语态 were told。had told 为主动，did told 结构不成立，was 数不一致。','否定倒装与被动'),
    q(14,'The essay draws a sharp _____ between accepting uncertainty and refusing to investigate.',
      ['distraction','distinction','distortion','distribution'],'B',
      'draw a distinction between A and B 为“区分 A 与 B”。其余分别指分心、扭曲和分配，不能表达作者划清概念边界的意思。','名词搭配'),
    q(15,'Given the absence of supporting data, the reviewers were understandably _____ of the claim.',
      ['sceptical','susceptible','perceptible','compatible'],'A',
      'be sceptical of 对……持怀疑态度，符合缺少数据的背景。susceptible to 易受……影响；perceptible 可察觉的；compatible with 相容的。','形近词与介词'),
    q(16,'What matters is not how many objections were raised, but _____ they were examined.',
      ['that thoroughly','how thorough','how thoroughly','however thorough'],'C',
      'not...but... 连接两个名词性从句，后者用 how thoroughly they were examined。“彻底地审查”需要副词 thoroughly 修饰 were examined。','平行结构与词性'),
    q(17,'Long accustomed to reliable supplies, the residents had begun to take clean water for _____.',
      ['assumed','confirmed','conceded','granted'],'D',
      'take something for granted 把某事视为理所当然，常隐含忽略其价值或脆弱性。这里“长期习惯稳定供应”正是语境提示。','习语'),
    q(18,'The restriction was imposed under the _____ of protecting consumers, although its actual purpose was to exclude competitors.',
      ['guise','image','shelter','status'],'A',
      'under the guise of 以……为幌子。although 从句揭示表面理由与实际目的不同，故 guise 最准确。其余不构成此处固定表达。','立场与固定表达'),
    q(19,'It is high time the agency _____ responsibility for checking the information it circulates.',
      ['takes','took','has taken','will take'],'B',
      'It is high time that... 后常用一般过去时表示“早该做某事了”的虚拟意味，故 took。这里不是叙述过去已承担的事实。','虚拟语气'),
    q(20,'Until independent teams reproduce the result, the conclusion must remain _____.',
      ['redundant','compulsory','tentative','irreversible'],'C',
      'tentative 暂定的、尚待证实的，与等待独立重复验证相呼应。redundant 多余的；compulsory 强制的；irreversible 不可逆的。','学术态度词')]
    cloze='''When a fictional city planted trees to reduce summer heat, the first official report described the project as an unqualified success. The average temperature recorded by its sensors had fallen. Yet the report soon [21] _____ criticism from residents who said their daily journeys remained as uncomfortable as before.

The disagreement did not necessarily mean that either side was dishonest. Most of the readings [22] _____ conditions in shaded public squares, while many residents spent the hottest part of the day waiting beside roads. The equipment had measured the places that were easiest to monitor [23] _____ the routes on which people were most at risk. A lower [24] _____ therefore concealed substantial differences in experience.

A second team asked volunteers to carry portable sensors during their ordinary journeys. The readings revealed which groups were most [25] _____ to heat. But the researchers also took [26] _____ of information that a thermometer could not supply: whether a bus shelter was accessible, whether a worker could alter a shift, and whether a shaded park required a long detour. Their [27] _____ success in collecting more data did not, by itself, settle how resources should be allocated.

Nor were the volunteers [28] _____ neutral measuring instruments. People willing to join the study had time and confidence that some vulnerable residents lacked. To [29] _____ a genuinely cooler journey from one that simply avoided the hottest hours, the team recorded departure times as well as temperatures. It also recruited through local care groups, reducing the risk of [30] _____ people who rarely attended public meetings.

The final report described benefits as [31] _____ distributed rather than universal. It named the residents for [32] _____ the improvements had been smallest and identified where further planting was needed. It also warned that rising rents might leave long-term tenants [33] _____ from the newly attractive neighbourhoods.

These qualifications made the report less triumphant but more useful. By making its assumptions [34] _____, the team allowed citizens to challenge its priorities. Measurement could inform a public decision; it could not [35] _____ for one. The next debate concerned not whether the city possessed a single favourable number, but whose lives that number described.'''
    cdata=[
    (21,['drew','withheld','resisted','escaped'],'A','draw criticism 招致批评。后接居民不满，不能用 escaped“逃过”或 resisted“抵制”。','动词搭配'),
    (22,['resembled','represented','replaced','restrained'],'B','读数代表的是有树荫的广场中的情况，represented 与后文沿路等车的处境形成抽样偏差对照；其余动词不能准确表达测量代表性。','语境与抽样'),
    (23,['as for','in case of','rather than','even if'],'C','rather than 连接“最容易监测的地点”与“人们最有风险的路线”，构成取舍对比。','逻辑连接'),
    (24,['boundary','forecast','maximum','average'],'D','第一段给出 average temperature，第二段指出平均数掩盖差异，故 average 前后照应。','篇章复现'),
    (25,['entitled','exposed','opposed','attached'],'B','be exposed to heat 暴露于高温。其他选项不能表达承受高温风险。','词组辨析'),
    (26,['control','advantage','possession','account'],'D','take account of 考虑、顾及。其后列出温度计无法提供的处境信息；其余搭配语义不合。','固定搭配'),
    (27,['apparent','reluctant','irrelevant','incapable'],'A','apparent success 表面上／看起来取得的成功，与“并不能因此决定资源分配”衔接。irrelevant 会否定数据本身的相关性，文中没有这一绝对判断。','评价词'),
    (28,['barely','lately','merely','nearly'],'C','not merely neutral measuring instruments 指志愿者不只是中性测量工具，他们的参与条件也影响样本。barely“几乎不”会改变强调的逻辑。','副词与语气'),
    (29,['discharge','distinguish','discourage','disguise'],'B','distinguish A from B 区分 A 与 B，这里区分真正降温与避开最热时段两种解释。','研究方法词汇'),
    (30,['overlooking','overtaking','overturning','overstating'],'A','overlook people 忽略某些人。招募渠道扩展到照护组织，是为了降低漏掉少参与公共会议者的风险。','形近词'),
    (31,['unanimously','accidentally','instantly','unevenly'],'D','unevenly distributed 分布不均，与 rather than universal 和后文“改善最小的群体”照应。','分配与篇章逻辑'),
    (32,['which','whose','whom','what'],'C','先行词是 residents，指人，介词 for 后用关系代词 whom。which 指物，whose 要接被修饰名词，what 不能引导此类定语从句。','定语从句'),
    (33,['excluded','displaced','enclosed','released'],'B','房租上涨可能迫使长期租户迁出，leave somebody displaced from... 意为使其失去原有居住位置。excluded 偏重被禁止进入，不准确表达由房租上升引起的搬离。','语境选词'),
    (34,['transparent','temporary','redundant','reluctant'],'A','使假设 transparent，即清楚可见、可审视，才能让公众质疑优先次序。','评价与治理词汇'),
    (35,['compensate','account','prepare','substitute'],'D','substitute for 替代。测量可为公共决策提供信息，却不能代替决策。compensate for 是补偿，不能表达工具与决定的关系。','结论句与搭配')]
    cqs=[q(i,'Choose the best word or phrase for blank '+str(i)+'.',o,a,e,t,1,3) for i,o,a,e,t in cdata]
    pa='''For years, the catalogue of a fictional canal museum told a reassuring story. The opening of the waterway, it explained, had transformed a collection of isolated settlements into a unified commercial community. Anyone able to provide a boat or a pair of strong arms could participate. The surviving toll books appeared to support this account: they recorded thousands of journeys and hundreds of traders, suggesting a society defined more by activity than by inherited status.

When the historian Clara Vale examined the same books, however, she noticed how narrowly they defined participation. The name beside a payment was usually that of a registered boat owner, although the work involved a much larger household. An owner's wife might negotiate a delivery; a daughter might maintain the accounts. Neither activity necessarily produced a separate entry. Earlier researchers had treated the public identity of a business as a transparent description of everyone who made it operate.

Vale began interviewing older residents whose families had worked on the canal. Several remembered women arranging contracts and settling disputes. These recollections complicated the catalogue's account, but they did not automatically establish a better one. Interviews recorded decades after an event can absorb family pride, later expectations and the desire to tell a coherent story. Vale therefore rejected the suggestion that oral testimony should simply replace the written archive. Different kinds of evidence could conceal different things.

An invoice found among a laundry business's papers offered a more specific connection. It listed payments made to a woman whose husband's name appeared in the toll register. A second document, carrying her signature, recorded her agreement to a delivery schedule. Neither document proved that women enjoyed equal authority throughout the canal economy. Together, however, they challenged the assumption that the absence of women's names from one official record demonstrated their absence from commercial decisions.

The museum eventually revised its catalogue. Its new account did not replace an uncomplicated story of opportunity with an equally uncomplicated story of exclusion. Instead, it asked which activities the toll books had been designed to record, which relationships they left outside their categories, and how those limits shaped later interpretation. The books remained valuable precisely because their silences could be investigated rather than filled with whatever a reader wished to find.

Vale's conclusion was deliberately modest. Historical research cannot recover every conversation or distribute recognition with perfect accuracy. But it can distinguish between saying that an activity has not been documented and saying that it never occurred. A silence in an archive is not an event that explains itself. Before treating it as evidence of social absence, a researcher must ask how it was produced.'''
    aqs=[
    q(36,'Which title best captures the central concern of the passage?',[
      'What the Records Leave Out','The Decline of Canal Transport','Why Written Evidence Must Be Abandoned','A Museum That Rejected Commercial History'],'A',
      '全文围绕记录的类别如何制造可见与不可见、如何解释档案沉默展开，A 最概括。B 非论题；C 与第 3、5 段保留书面档案价值相反；D 把修订解释误读成放弃商业史。','主旨与标题',3,4),
    q(37,'According to the passage, earlier researchers were most likely to assume that',[
      'oral accounts were always more reliable than invoices.',
      'household members performed identical kinds of work.',
      'the canal economy excluded all forms of inherited status.',
      'the registered public identity of a business adequately represented those who operated it.'],'D',
      '第 2 段最后一句明确指出早期研究者把企业公开登记身份当作其运作人员的透明描述，D 为同义改写。C 将第一段的比较性表述夸大为“全部排除”，A、B 无依据。','细节与推断',3,4),
    q(38,'Which finding would most directly weaken the claim that women had no authority over canal contracts?',[
      'A photograph of women watching boats leave the town.',
      'A verified agreement in which a woman independently settled the terms of a delivery.',
      'An increase in the total number of journeys entered in a toll book.',
      'A family story that an unnamed woman disliked the waterway.'],'B',
      'B 直接提供女性独立决定合同条款的证据，针对“没有合同决定权”的全称判断。A 仅显示在场，C 与女性权力无关，D 是情绪叙述且未经具体核实。','证据评价',3,4),
    q(39,'The sentence “A silence in an archive is not an event that explains itself” suggests that',[
      'all missing records were deliberately destroyed.',
      'historians should avoid conclusions based on any incomplete evidence.',
      'the absence of an entry requires investigation before it is treated as the absence of an activity.',
      'official documents reveal less than every personal memory does.'],'C',
      '末段紧接着要求追问沉默如何形成，C 精确表达“不见记载”与“不曾发生”的区别。A 无中生有，B 取消一切基于不完整证据的判断，D 把不同证据机械排序，均超出原文。','句意理解',3,4),
    q(40,'How does the author present Vale\'s approach to oral testimony?',[
      'As a complete replacement for official records.',
      'As useful but fallible evidence to be considered alongside other sources.',
      'As a means of proving that equal authority existed everywhere.',
      'As inherently deceptive because it was recorded late.'],'B',
      '第 3 段同时承认访谈的补充价值与记忆可能受家族自豪、后见期待影响，故 B。A、C 均被文章直接否定；D 将“可能有偏差”夸大为“本质上欺骗”。','作者态度',3,4)]
    pb='''A fictional design company wanted to understand why some employees rarely spoke during meetings. Its first response was to measure participation. For six weeks, a dashboard counted how often each person contributed and displayed the distribution within each team. Managers initially used the figures to identify meetings in which two or three people dominated the conversation. In that limited role, the dashboard made a familiar problem difficult to ignore.

Trouble began when the company announced a numerical target for every employee. A contribution was defined as any uninterrupted speaking turn lasting more than a few seconds. Some workers split a single observation into several turns; others repeated points that had already been accepted. Quieter employees discovered that asking a minor question could be safer than challenging a major assumption. The number of contributions rose, while several meetings became longer and no easier to follow.

The dashboard had not suddenly become inaccurate. It was counting speaking turns reasonably well. The difficulty was that the company had begun treating those turns as interchangeable units of influence. A brief objection that prevented an expensive mistake counted no more than a redundant summary. A thoughtful written response submitted after a meeting counted nothing. A measure that had begun as a diagnostic instrument had become a target, rewarding behaviour that satisfied the definition without necessarily serving the original purpose.

After reviewing the pilot, the company kept the dashboard but removed the individual quotas. Teams received short documents in advance, so that the meeting did not reward only those who could formulate an immediate response. The role of chair rotated, and employees could submit concerns in writing. A facilitator also noted whether objections received an answer, were postponed with a named owner, or simply disappeared from the discussion. These notes could not be reduced to one convenient score, but they made a distinction between being permitted to speak and being seriously heard.

Not everyone welcomed the change. Some managers argued that qualitative notes made comparison less straightforward. Others worried that employees would describe every disagreement as evidence of poor leadership. The revised system therefore stated its criteria openly and allowed teams to question the facilitator's interpretation. Transparency did not remove judgement; it made judgement available for examination. The company accepted that a system designed to uncover complexity would sometimes make an apparently simple performance comparison harder.

Three months later, meeting time had fallen in some teams and increased in others. The reviewers refused to call either change a success by itself. A shorter meeting could reflect better preparation, but it could also indicate that difficult objections had been suppressed. They instead examined decision records: Were disputed assumptions identified? Was responsibility for unresolved questions clear? Could an employee show what happened to a concern after raising it?

The pilot did not demonstrate that counting is useless. It demonstrated that a useful count can become a misleading verdict when the link between the two is left unexplained. The strongest evidence of improvement was not that everyone spoke equally often. It was that disagreement had become harder to ignore and easier to follow through.'''
    bqs=[
    q(41,'What was the central defect in using an individual speaking quota?',[
      'The software was unable to count speaking turns accurately.',
      'It prevented employees from asking any questions.',
      'It treated the frequency of speech as though it reliably measured meaningful influence.',
      'It gave written responses more weight than spoken objections.'],'C',
      '第 3 段区分“准确计数”和“有效衡量影响力”。C 正确。A 是文中明确排除的解释；B、D 与具体细节相反。','问题归因',3,4),
    q(42,'The examples in the second paragraph mainly illustrate',[
      'how people can adapt their behaviour to meet a metric without fulfilling its purpose.',
      'why numerical targets always decrease the amount of speech.',
      'that quieter workers lack the ability to identify important problems.',
      'that repeating an accepted point necessarily improves a decision.'],'A',
      '拆分发言、重复观点、提次要问题都是“满足定义而未实现初衷”的行为，A 概括其共同作用。其余项或与数据相反，或对个体能力作无依据的判断。','例证功能',3,3),
    q(43,'Which result would provide the strongest support for the revised system?',[
      'Every team held meetings of exactly the same length.',
      'The dashboard showed an identical number of turns for all employees.',
      'Managers no longer needed to exercise judgement.',
      'Decision records showed that substantive objections were addressed and unresolved issues assigned to someone.'],'D',
      '第 6、7 段将改进落在异议是否得到回应、未决问题是否有负责人和后续是否可追踪，D 直接对应。A、B 是文章拒绝单独采用的表面指标；C 不可能从透明化推出判断消失。','证据与指标',3,4),
    q(44,'Which inference about the dashboard is best supported?',[
      'It should be discarded whenever a qualitative judgement is possible.',
      'It can help reveal a problem, provided its limits and intended use remain clear.',
      'It became more statistically accurate after the quotas were removed.',
      'It can prove that all employees have equal influence.'],'B',
      '第一段承认识别少数人垄断发言的用途，最后一段否认“计数无用”，B 结合两处得到。A、D 过度；C 没有准确率变化的证据。','综合推断',3,4),
    q(45,'Which strategy is NOT mentioned as part of the revised system?',[
      'Providing documents before meetings.',
      'Rotating the person who chairs a meeting.',
      'Paying bonuses according to the number of speaking turns.',
      'Allowing employees to submit concerns in writing.'],'C',
      '第 4 段列出会前材料、轮流主持和书面提交意见，并未提出按发言次数发奖金。C 也与取消个人配额的方向相反。','否定细节',3,3)]
    pc='''A museum demonstration uses a long, lightly stretched rope to show a distinction that is easy to miss: a wave can travel without carrying each part of the material along with it. A small motor moves one end of the rope up and down. A visitor watching from a distance sees a succession of crests moving towards the far end and may imagine that the rope itself is flowing in the same direction.

A red ribbon tied to one point on the rope makes that interpretation difficult to maintain. As each crest passes, the ribbon moves mainly up and down around its original position. It does not follow the crest across the room. Neighbouring sections of rope pull on one another, passing the disturbance along. The travelling feature is therefore a pattern of displacement, while the material responds locally. Energy is transferred even though the marked point is not transported to the far end.

The demonstration becomes more revealing when the motor is made to oscillate twice as often. Provided the rope and its tension remain unchanged and the motions are small, the wave speed stays approximately the same. The crests are now closer together: more complete oscillations must fit into the distance covered in one second. Frequency describes how often a point oscillates; wavelength describes the distance between successive crests. Neither quantity, considered alone, tells a visitor the speed at which the disturbance travels.

To expose a common confusion, the museum places a light sensor beside the rope. A lamp flashes whenever a crest passes the sensor. Increasing the motor's frequency makes the lamp flash more often, which some visitors take as proof that the wave is moving faster. Yet the lamp counts arrivals at one place; it does not measure the time needed to cover a known distance. A second sensor, one metre farther along the rope, allows the demonstrator to compare the arrival times of the same crest. That delay provides a way to estimate speed.

At the far end, a soft absorbing attachment reduces the disturbance that returns towards the motor. Without sufficient absorption, a returning wave can overlap the outgoing one and make the simple moving pattern harder to identify. For the speed measurement, the demonstrator uses an isolated pulse and records its first arrival at each sensor, before a reflection can return. The equipment is elementary, but the sequence matters: observe a marked piece of material, change one condition, and then choose a measurement that answers the actual question. Counting more events is not the same as finding that each event travels faster.'''
    cqs2=[
    q(46,'What does the red ribbon chiefly demonstrate?',[
      'Every part of the rope is transported to the far end.',
      'The rope remains perfectly motionless while a wave passes.',
      'The motor creates a new piece of rope for each crest.',
      'A travelling disturbance can pass while a marked part of the material remains near its original position.'],'D',
      '第 2 段写红带主要在原位置上下运动，不跟随波峰横穿房间，D 准确区分扰动传播与介质局部运动。B 将“没有整体迁移”偷换为完全静止。','科学说明细节',3,3),
    q(47,'If the frequency is doubled under the conditions specified in the passage, the wavelength will be approximately',[
      'twice as long.','unchanged.','half as long.','four times as long.'],'C',
      '第 3 段给定波速近似不变，频率提高使波峰间距缩小；同一秒传播距离不变而完整振动数翻倍，波长约减半。无需使用课外公式也可推得。','变量关系推断',3,4),
    q(48,'Why is a single flashing lamp insufficient to establish that the wave has become faster?',[
      'It records how often crests arrive, rather than the travel time over a known distance.',
      'It changes the tension in the rope every time it flashes.',
      'It can detect only waves that carry material across the room.',
      'It prevents any crest from reaching the second sensor.'],'A',
      '第 4 段直接区分“某地点的到达次数”与“已知距离上的传播用时”，A 为同义表达。其余都给传感器增添了原文没有的作用。','因果解释',3,3),
    q(49,'For the two-sensor speed estimate, which procedure is most consistent with the passage?',[
      'Comparing any two flashes without checking which crest caused them.',
      'Timing the first arrival of the same isolated pulse at the two sensors.',
      'Measuring how far the red ribbon travels towards the end of the room.',
      'Waiting until reflected waves make the pattern difficult to identify.'],'B',
      '末段明确使用孤立脉冲，记录反射返回前在两传感器的首次到达；第 4 段还强调 the same crest。B 满足这些条件，A 忽略波峰身份，C、D 与方法相反。','步骤与实验控制',3,4),
    q(50,'Which detail cannot be determined from the passage?',[
      'The approximate separation of the two sensors.',
      'The principal direction in which the red ribbon moves.',
      'The exact material from which the rope is made.',
      'The purpose of the absorbing attachment.'],'C',
      'A 的“一米”见第 4 段；B 的“主要上下”见第 2 段；D 的“减少返回扰动”见第 5 段。全文没有给出绳的具体材质，故 C。','否定细节',3,3)]
    return dict(id='english-a',subject='英语',en='ENGLISH',title='英语模拟卷 A',subtitle='词汇语法 · 完形填空 · 阅读理解',duration=60,total=100,version='1.0',date='2026-10-24',intro='全卷 50 道单项选择题，每题只有一个正确答案。第 1—20 题每题 2 分；第 21—35 题每题 1 分；第 36—50 题每题 3 分。英文材料为命题原创；文中的城市项目、博物馆史学研究与公司试点为虚构情境，不影射真实研究，无需课外背景知识。',sections=[
      dict(id='en-mc',title='I. Vocabulary and Grammar',description='Questions 1–20. 2 points each, 40 points in total. Suggested time: 12 minutes.',blocks=[dict(title='',text='',questions=mc)]),
      dict(id='en-cloze',title='II. Cloze',description='Questions 21–35. 1 point each, 15 points in total. Suggested time: 13 minutes.',blocks=[dict(title='Measuring Who Benefits',source='Original passage · hypothetical urban study',text=cloze,questions=cqs)]),
      dict(id='en-reading',title='III. Reading Comprehension',description='Questions 36–50. 3 points each, 45 points in total. Suggested time: 35 minutes.',blocks=[dict(title='Passage A',source='Original passage · historical interpretation',text=pa,questions=aqs),dict(title='Passage B',source='Original passage · organisational analysis',text=pb,questions=bqs),dict(title='Passage C',source='Original passage · scientific explanation',text=pc,questions=cqs2)])])
