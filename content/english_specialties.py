"""Original practice prompts for the English sections with no prior inventory."""

def specialties():
    material = (
        "For several months, the residents of Oak Street had complained that the bus stop was hard to find. "
        "The transport office planned to install a taller sign. [1]\n\n"
        "A group of students tried the route with older residents on a rainy afternoon. [2] "
        "Many passengers could see the sign from the café but did not know which side of the road their bus would use.\n\n"
        "The students suggested putting a route map in the café window and adding arrows at the crossing. [3] "
        "The office tested these changes for one week.\n\n"
        "[4] Volunteers counted how often newcomers stopped to ask for directions. "
        "After the changes, the questions became less frequent.\n\n"
        "[5] Before deciding what to build, designers should watch how people use the service."
    )
    choices = {
        "A": "They found a problem that extra height would not solve.",
        "B": "The result pointed to a broader lesson.",
        "C": "Several cafés had stopped selling hot drinks.",
        "D": "The students asked the office to try a cheaper solution first.",
        "E": "Both suggestions could be tested without rebuilding the stop.",
        "F": "They measured the effect with a simple observation.",
        "G": "The bus drivers changed to a new uniform in April.",
    }
    yield ("en-seven-oak", "gap-seven", "cet6", "Finding the bus stop", "原创训练材料", material, {
        "kind":"order", "stem":"Choose five sentences (A–G) for gaps [1]–[5]. Enter the five letters in order. Two options are extra.",
        "paragraphs":choices, "accepted":["DAEFB"], "tag":"段落衔接",
        "analysis":"[1] D 承接加高站牌的方案，引出先观察；[2] A 概括亲身测试发现，后句解释；[3] E 回指两项建议；[4] F 引出计数方法；[5] B 归纳经验，引出设计原则。C、G偏离论述。"
    })
    yield ("en-lit-austen", "literary", "cet6", "Austen and the novel", "Jane Austen, Pride and Prejudice (1813), chapter 1", "", {
        "kind":"mc", "stem":"In which novel do the Bennets learn that Netherfield Park has been let?",
        "options":["Emma","Pride and Prejudice","Persuasion","Mansfield Park"], "answer":"B",
        "tag":"英国小说", "analysis":"《傲慢与偏见》开篇，班纳特太太向丈夫谈起尼日斐花园的新租客。"
    })
    yield ("en-lit-dickens", "literary", "cet6", "A Dickens narrator", "Charles Dickens, Great Expectations (1860–1861), chapter 1", "", {
        "kind":"mc", "stem":"Which narrator explains that his childhood pronunciation turned his name into 'Pip'?",
        "options":["David Copperfield","Oliver Twist","Pip","Esther Summerson"], "answer":"C",
        "tag":"英国小说", "analysis":"《远大前程》第一章由主人公皮普回顾自己的名字以及绰号由来。"
    })
    yield ("en-edit-agreement", "correction", "cet6", "Subject–verb agreement", "原创训练材料", "", {
        "kind":"fill", "stem":"Replace the one incorrect word: The list of suggested readings are on the noticeboard.",
        "accepted":["is"], "tag":"主谓一致", "analysis":"将 are 改成 is。中心主语是单数 list，of suggested readings 是修饰语。"
    })
    yield ("en-edit-preposition", "correction", "tem4", "Prepositions in context", "原创训练材料", "", {
        "kind":"fill", "stem":"Replace the one incorrect word: We agreed with a date for the next meeting.",
        "accepted":["on","upon"], "tag":"动词与介词", "analysis":"约定日期用 agree on/upon a date。agree with 常搭配人、观点或判断。"
    })
    yield ("en-essay-feedback", "writing", "cet6", "Feedback before the final draft", "原创训练材料", "", {
        "kind":"writing", "stem":"Write about 200 words. Should schools give students time to revise a piece of work after receiving feedback? State your position, consider one objection, and use a specific example.",
        "reference":"",
        "analysis":"明确主张，解释反馈如何改变一次具体修改。回应一个真实的反对意见，例如教师的工作量，并说明你的方案在什么条件下可行。",
        "tag":"论证与反驳"
    })
    yield ("en-culture-matariki", "literary", "cet6", "Matariki in Aotearoa New Zealand", "Te Ara – The Encyclopedia of New Zealand, Matariki (The Māori New Year)", "", {
        "kind":"mc", "stem":"In Māori culture, which occasion is associated with the seasonal rising of the star cluster known as Matariki?",
        "options":["The Māori New Year","Waitangi Day","Anzac Day","King's Birthday"], "answer":"A",
        "tag":"新西兰文化", "analysis":"Matariki 是与毛利新年相关的星团。它在特定季节重新出现，是许多毛利社群纪念这一时节的标志。"
    })
