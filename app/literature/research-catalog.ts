
/** Editorial study paths, not full-text archives or official admissions claims. */
export const researchLanguages = [
  {
    "id": "ja",
    "label": "日语",
    "native": "日本語",
    "region": "日本及日语文献",
    "tier": "core"
  },
  {
    "id": "de",
    "label": "德语",
    "native": "Deutsch",
    "region": "德国、奥地利、瑞士德语区",
    "tier": "core"
  },
  {
    "id": "en",
    "label": "英语",
    "native": "English",
    "region": "英国、美国及其他英语使用地区",
    "tier": "core"
  },
  {
    "id": "fr",
    "label": "法语",
    "native": "Français",
    "region": "法国及其他法语使用地区",
    "tier": "core"
  },
  {
    "id": "es",
    "label": "西班牙语",
    "native": "Español",
    "region": "西班牙与西语美洲",
    "tier": "core"
  },
  {
    "id": "ru",
    "label": "俄语",
    "native": "Русский",
    "region": "俄罗斯及俄语文献",
    "tier": "core"
  },
  {
    "id": "ar",
    "label": "阿拉伯语",
    "native": "العربية",
    "region": "阿拉伯语使用地区",
    "tier": "basic"
  },
  {
    "id": "ko",
    "label": "朝鲜语／韩语",
    "native": "한국어",
    "region": "朝鲜半岛及韩语文献",
    "tier": "basic"
  },
  {
    "id": "hi",
    "label": "印地语",
    "native": "हिन्दी",
    "region": "印度及印地语文献",
    "tier": "basic"
  },
  {
    "id": "he",
    "label": "希伯来语",
    "native": "עברית",
    "region": "希伯来语文献及相关地区",
    "tier": "basic"
  },
  {
    "id": "sa-pi",
    "label": "梵语与巴利语",
    "native": "संस्कृतम् / Pāli",
    "region": "南亚古典文献与佛教文献",
    "tier": "basic"
  },
  {
    "id": "ur",
    "label": "乌尔都语",
    "native": "اردو",
    "region": "南亚乌尔都语使用地区",
    "tier": "basic"
  }
] as const;
export const researchDisciplines = [
  {
    "id": "literature",
    "label": "文学"
  },
  {
    "id": "history",
    "label": "历史"
  },
  {
    "id": "thought",
    "label": "思想与哲学"
  },
  {
    "id": "society",
    "label": "社会与文化"
  },
  {
    "id": "politics",
    "label": "政治与经济"
  },
  {
    "id": "language",
    "label": "语言与翻译"
  },
  {
    "id": "foundation",
    "label": "基础知识"
  }
] as const;
export type ResearchCatalogItem={id:string;languageId:string;discipline:string;title:string;summary:string;question:string;keywords:string;version:string;sources:{name:string;url:string;kind:"discovery"}[]};
export const communityCatalog:ResearchCatalogItem[]=[
  {
    "id": "ja-literature",
    "languageId": "ja",
    "discipline": "literature",
    "title": "物哀与叙事视角",
    "summary": "从《源氏物语》《雪国》选读，分辨叙述者、人物感受和读者判断。",
    "question": "物哀是否可以独立于悲伤而存在？",
    "keywords": "物の哀れ、源氏物語、雪国",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "国文学研究资料馆数据库",
        "url": "https://www.nijl.ac.jp/en/db/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "ja-history",
    "languageId": "ja",
    "discipline": "history",
    "title": "明治维新与近代国家",
    "summary": "从幕末到明治，比较教育、行政改革与社会生活，避免把近代化归结为单一原因。",
    "question": "制度输入与本土调整如何同时发生？",
    "keywords": "明治維新、学制、近代国家",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "日本国立国会图书馆 NDL Search",
        "url": "https://ndlsearch.ndl.go.jp/en/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "ja-thought",
    "languageId": "ja",
    "discipline": "thought",
    "title": "禅宗与日本美学",
    "summary": "区分宗教实践、审美概念和现代解释，比较无常、空及侘寂。",
    "question": "如何避免用禅宗解释所有日本艺术？",
    "keywords": "禅、無常、わびさび",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "日本国立国会图书馆 NDL Search",
        "url": "https://ndlsearch.ndl.go.jp/en/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "ja-society",
    "languageId": "ja",
    "discipline": "society",
    "title": "家庭、人口与社会变迁",
    "summary": "分析家庭形式、老龄化及劳动参与，查证数据口径和年代。",
    "question": "人口结构变化与家庭制度之间有哪些中介因素？",
    "keywords": "少子高齢化、家族、労働",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "日本国立国会图书馆 NDL Search",
        "url": "https://ndlsearch.ndl.go.jp/en/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "ja-politics",
    "languageId": "ja",
    "discipline": "politics",
    "title": "战后产业与制度转型",
    "summary": "比较企业组织、产业政策与国际市场，区分历史阶段和因果关系。",
    "question": "怎样检验产业政策与经济增长的关系？",
    "keywords": "産業政策、企業、戦後経済",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "日本国立国会图书馆 NDL Search",
        "url": "https://ndlsearch.ndl.go.jp/en/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "ja-language",
    "languageId": "ja",
    "discipline": "language",
    "title": "日语敬语与翻译",
    "summary": "比较敬语、主语省略与语境中的社会关系，保留不同版本和语用条件。",
    "question": "中文翻译怎样呈现原文中的人际距离？",
    "keywords": "敬語、翻訳、語用論",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "日本国立国会图书馆 NDL Search",
        "url": "https://ndlsearch.ndl.go.jp/en/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "de-literature",
    "languageId": "de",
    "discipline": "literature",
    "title": "歌德与德语文学传统",
    "summary": "围绕《浮士德》及德语文学中的求知、主体性与伦理冲突；区分作品与时代。",
    "question": "浮士德式追求与伦理边界怎样并存？",
    "keywords": "Goethe, Faust, Aufklärung",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "German History in Documents and Images",
        "url": "https://germanhistorydocs.org/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "de-history",
    "languageId": "de",
    "discipline": "history",
    "title": "德意志统一与国家建构",
    "summary": "从十九世纪国家形成、联邦结构与区域差异比较史料。",
    "question": "政治统一是否意味着文化同质化？",
    "keywords": "Reichsgründung, Föderalismus",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "German History in Documents and Images",
        "url": "https://germanhistorydocs.org/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "de-thought",
    "languageId": "de",
    "discipline": "thought",
    "title": "康德与启蒙思想",
    "summary": "阅读启蒙相关文本，区分自主判断、公共理性和道德义务。",
    "question": "独立判断和公共规则如何协调？",
    "keywords": "Kant, Aufklärung, Vernunft",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "German History in Documents and Images",
        "url": "https://germanhistorydocs.org/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "de-society",
    "languageId": "de",
    "discipline": "society",
    "title": "德语区的社会制度与生活",
    "summary": "比较不同德语区的职业教育、家庭与文化制度，不把语言区域等同一个国家。",
    "question": "制度差异如何影响青年成长路径？",
    "keywords": "Berufsbildung, Gesellschaft, Schweiz, Österreich",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "German History in Documents and Images",
        "url": "https://germanhistorydocs.org/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "de-politics",
    "languageId": "de",
    "discipline": "politics",
    "title": "社会市场经济与欧洲合作",
    "summary": "区分市场竞争、社会保障与欧盟多层治理；用制度文本与历史材料核对。",
    "question": "社会市场经济如何协调效率与公平？",
    "keywords": "Soziale Marktwirtschaft, Europäische Union",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "German History in Documents and Images",
        "url": "https://germanhistorydocs.org/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "de-language",
    "languageId": "de",
    "discipline": "language",
    "title": "德语构词与概念翻译",
    "summary": "分析复合词、语序和哲学术语在中文译本中的选择。",
    "question": "同一德语概念为何可能出现多种中文译法？",
    "keywords": "Wortbildung, Übersetzung, Begriff",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "German History in Documents and Images",
        "url": "https://germanhistorydocs.org/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "en-literature",
    "languageId": "en",
    "discipline": "literature",
    "title": "莎士比亚与戏剧传统",
    "summary": "选择戏剧场景，分析独白、人物冲突与舞台表达。",
    "question": "独白怎样改变观众对人物动机的判断？",
    "keywords": "Shakespeare, soliloquy, theatre",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "英国图书馆馆藏",
        "url": "https://www.bl.uk/collection/explore-the-collection",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "en-history",
    "languageId": "en",
    "discipline": "history",
    "title": "工业革命与大西洋世界",
    "summary": "比较工业化、城市发展与劳动制度，关注地区差异。",
    "question": "技术革新与制度变化如何共同塑造社会？",
    "keywords": "Industrial Revolution, urbanisation, labour",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "英国图书馆馆藏",
        "url": "https://www.bl.uk/collection/explore-the-collection",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "en-thought",
    "languageId": "en",
    "discipline": "thought",
    "title": "自由主义与公共讨论",
    "summary": "比较自由、权利与公共利益的概念史，区分不同作者和时代。",
    "question": "个人自由与公共责任的界限如何论证？",
    "keywords": "liberty, rights, public reason",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "英国图书馆馆藏",
        "url": "https://www.bl.uk/collection/explore-the-collection",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "en-society",
    "languageId": "en",
    "discipline": "society",
    "title": "英语世界的教育与身份",
    "summary": "比较英国、美国及其他地区的教育、阶层与语言身份，不将英语使用者视为同一文化。",
    "question": "语言规范会怎样影响社会参与？",
    "keywords": "education, identity, class",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "英国图书馆馆藏",
        "url": "https://www.bl.uk/collection/explore-the-collection",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "en-politics",
    "languageId": "en",
    "discipline": "politics",
    "title": "议会制度与政治经济",
    "summary": "区分议会制、总统制和不同经济政策，核对制度文本。",
    "question": "制度结构如何影响公共政策的形成？",
    "keywords": "parliament, constitution, political economy",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "英国议会馆藏与文化遗产",
        "url": "https://www.parliament.uk/about/living-heritage/building/cultural-collections/parliaments-vision-and-purpose-for-collections/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "en-language",
    "languageId": "en",
    "discipline": "language",
    "title": "英语修辞与跨文化翻译",
    "summary": "比较语域、隐喻、含义和论证结构在中文译本中的呈现。",
    "question": "如何在忠实信息与保留修辞之间权衡？",
    "keywords": "rhetoric, register, translation",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "英国图书馆馆藏",
        "url": "https://www.bl.uk/collection/explore-the-collection",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "fr-literature",
    "languageId": "fr",
    "discipline": "literature",
    "title": "法国现实主义与小说叙事",
    "summary": "比较巴尔扎克、福楼拜作品中的社会观察和叙事距离。",
    "question": "小说的细节怎样形成社会批判？",
    "keywords": "Balzac, Flaubert, réalisme",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "法国国家图书馆 Gallica",
        "url": "https://gallica.bnf.fr/accueil/fr/html/accueil-fr",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "fr-history",
    "languageId": "fr",
    "discipline": "history",
    "title": "法国革命与公民概念",
    "summary": "区分革命阶段、政治制度与文本语境，辨析权利概念。",
    "question": "革命文本中的公民资格如何变化？",
    "keywords": "Révolution française, citoyenneté",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "法国国家图书馆 Gallica",
        "url": "https://gallica.bnf.fr/accueil/fr/html/accueil-fr",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "fr-thought",
    "languageId": "fr",
    "discipline": "thought",
    "title": "启蒙与存在主义",
    "summary": "区分启蒙思想的历史语境与二十世纪存在主义问题。",
    "question": "主体自由在两种思想传统中有何不同？",
    "keywords": "Lumières, existentialisme, liberté",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "法国国家图书馆 Gallica",
        "url": "https://gallica.bnf.fr/accueil/fr/html/accueil-fr",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "fr-society",
    "languageId": "fr",
    "discipline": "society",
    "title": "法语世界与文化多样性",
    "summary": "从法国及其他法语地区比较教育、语言政策和文化身份。",
    "question": "共同语言是否意味着共同文化认同？",
    "keywords": "francophonie, identité, éducation",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "法国国家图书馆 Gallica",
        "url": "https://gallica.bnf.fr/accueil/fr/html/accueil-fr",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "fr-politics",
    "languageId": "fr",
    "discipline": "politics",
    "title": "共和国制度与公共政策",
    "summary": "了解法国共和国制度、公共服务及政策讨论，区分历史和现行制度。",
    "question": "怎样比较公共服务的目标与执行效果？",
    "keywords": "République, service public",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "法国国家图书馆 Gallica",
        "url": "https://gallica.bnf.fr/accueil/fr/html/accueil-fr",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "fr-language",
    "languageId": "fr",
    "discipline": "language",
    "title": "法语语域与译本比较",
    "summary": "讨论礼貌、代词、句式与抽象术语在翻译中的变化。",
    "question": "法语 tu/vous 的区别如何在中文重建？",
    "keywords": "traduction, registre, politesse",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "法国国家图书馆 Gallica",
        "url": "https://gallica.bnf.fr/accueil/fr/html/accueil-fr",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "es-literature",
    "languageId": "es",
    "discipline": "literature",
    "title": "塞万提斯与现代小说",
    "summary": "从《堂吉诃德》中的叙事层次、反讽与阅读经验入手。",
    "question": "作品如何让读者质疑叙述的可靠性？",
    "keywords": "Cervantes, Don Quijote, ironía",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "塞万提斯虚拟图书馆",
        "url": "https://www.cervantesvirtual.com/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "es-history",
    "languageId": "es",
    "discipline": "history",
    "title": "西班牙与拉丁美洲的历史联系",
    "summary": "比较历史文献中的帝国、独立、地方制度和不同叙事。",
    "question": "同一历史事件为何会产生不同地区的记忆？",
    "keywords": "independencia, historia, América",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "西班牙国家图书馆 BNE Digital",
        "url": "https://www.bne.es/es/catalogos/bne-digital",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "es-thought",
    "languageId": "es",
    "discipline": "thought",
    "title": "身份、现代性与西语思想",
    "summary": "从西语作者的身份和现代化论述中区分时代、立场与论证。",
    "question": "何谓具有地方经验的现代性？",
    "keywords": "identidad, modernidad, pensamiento",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "塞万提斯虚拟图书馆",
        "url": "https://www.cervantesvirtual.com/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "es-society",
    "languageId": "es",
    "discipline": "society",
    "title": "西语美洲与文化多样性",
    "summary": "关注原住民语言、迁移和地域文化，不将拉美视为同质社会。",
    "question": "多语言社会如何维护文化多样性？",
    "keywords": "diversidad, lenguas indígenas, migración",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "塞万提斯虚拟图书馆",
        "url": "https://www.cervantesvirtual.com/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "es-politics",
    "languageId": "es",
    "discipline": "politics",
    "title": "地区合作与发展问题",
    "summary": "选择西班牙与一个拉美国家比较制度、贸易和发展指标，注明指标口径。",
    "question": "相似语言背景为何不必然带来相似发展路径？",
    "keywords": "integración regional, desarrollo",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "塞万提斯虚拟图书馆",
        "url": "https://www.cervantesvirtual.com/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "es-language",
    "languageId": "es",
    "discipline": "language",
    "title": "西班牙语地区变体与翻译",
    "summary": "比较用词、称呼和语体的区域差异，记录语料出处。",
    "question": "译者应保留地域色彩还是采用通用表达？",
    "keywords": "variación dialectal, traducción, voseo",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "塞万提斯虚拟图书馆",
        "url": "https://www.cervantesvirtual.com/",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "ru-literature",
    "languageId": "ru",
    "discipline": "literature",
    "title": "俄语现实主义与心理叙事",
    "summary": "比较托尔斯泰、陀思妥耶夫斯基作品中的社会生活与人物内心。",
    "question": "多重人物声音如何改变小说的伦理判断？",
    "keywords": "Толстой, Достоевский, реализм",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "俄罗斯国家电子图书馆（大学图书馆索引）",
        "url": "https://library.bmstu.ru/Resources/Details/NEB",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "ru-history",
    "languageId": "ru",
    "discipline": "history",
    "title": "俄罗斯近现代历史分期",
    "summary": "比较帝俄、苏联及后苏联时期的制度和社会变化，明确史料年代。",
    "question": "历史分期怎样影响对延续与断裂的判断？",
    "keywords": "история, реформы, общество",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "俄罗斯国家电子图书馆（大学图书馆索引）",
        "url": "https://library.bmstu.ru/Resources/Details/NEB",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "ru-thought",
    "languageId": "ru",
    "discipline": "thought",
    "title": "俄语思想中的个人与社会",
    "summary": "区分宗教哲学、文学思想和社会理论，重视概念来源。",
    "question": "个人责任与共同体之间的张力如何表达？",
    "keywords": "личность, общество, философия",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "俄罗斯国家电子图书馆（大学图书馆索引）",
        "url": "https://library.bmstu.ru/Resources/Details/NEB",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "ru-society",
    "languageId": "ru",
    "discipline": "society",
    "title": "俄罗斯及俄语地区的文化",
    "summary": "比较不同地区的语言使用、教育和文化机构，避免将俄语等同单一国籍。",
    "question": "共享语言如何与不同地方身份共存？",
    "keywords": "культура, образование, язык",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "俄罗斯国家电子图书馆（大学图书馆索引）",
        "url": "https://library.bmstu.ru/Resources/Details/NEB",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "ru-politics",
    "languageId": "ru",
    "discipline": "politics",
    "title": "制度转型与经济结构",
    "summary": "以明确年代的统计、法规和研究为证据，比较制度变化与产业结构。",
    "question": "如何区分转型过程的短期成本与长期变化？",
    "keywords": "экономика, институты, переход",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "俄罗斯国家电子图书馆（大学图书馆索引）",
        "url": "https://library.bmstu.ru/Resources/Details/NEB",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "ru-language",
    "languageId": "ru",
    "discipline": "language",
    "title": "俄语格系统与翻译",
    "summary": "观察格、体、语序及语境如何影响意义，比较译本中的表达。",
    "question": "动词体的意义在中文翻译中怎样保留？",
    "keywords": "вид глагола, падеж, перевод",
    "version": "2026-11-28.1",
    "sources": [
      {
        "name": "俄罗斯国家电子图书馆（大学图书馆索引）",
        "url": "https://library.bmstu.ru/Resources/Details/NEB",
        "kind": "discovery"
      }
    ]
  },
  {
    "id": "ar-foundation",
    "languageId": "ar",
    "discipline": "foundation",
    "title": "阿拉伯语基础与区域概况",
    "summary": "了解文字书写方向、现代标准阿拉伯语与地区口语的区别；阿拉伯语并不只属于一个国家。",
    "question": "区分语言、国家与宗教概念；核对地图、语言分布和可靠入门书目。",
    "keywords": "阿拉伯语 العربية",
    "version": "2026-11-28.1",
    "sources": []
  },
  {
    "id": "ko-foundation",
    "languageId": "ko",
    "discipline": "foundation",
    "title": "朝鲜语／韩语基础与半岛文化",
    "summary": "了解谚文、敬语与朝鲜半岛的历史地理；注意不同地区的语言称呼及用词差异。",
    "question": "比较基本语言结构与文化背景，注明来源和历史语境。",
    "keywords": "朝鲜语／韩语 한국어",
    "version": "2026-11-28.1",
    "sources": []
  },
  {
    "id": "hi-foundation",
    "languageId": "hi",
    "discipline": "foundation",
    "title": "印地语基础与印度多语言社会",
    "summary": "了解天城文、印地语的基本分布，以及印度多语言社会。",
    "question": "区分官方语言、地区语言和使用人口统计口径。",
    "keywords": "印地语 हिन्दी",
    "version": "2026-11-28.1",
    "sources": []
  },
  {
    "id": "he-foundation",
    "languageId": "he",
    "discipline": "foundation",
    "title": "希伯来语基础与文献传统",
    "summary": "了解文字书写方向、现代与古典希伯来语及不同文献背景。",
    "question": "区分历史文献、现代语言实践与区域政治概念。",
    "keywords": "希伯来语 עברית",
    "version": "2026-11-28.1",
    "sources": []
  },
  {
    "id": "sa-pi-foundation",
    "languageId": "sa-pi",
    "discipline": "foundation",
    "title": "梵语与巴利语基础",
    "summary": "了解两种古典语言的文献传统及语言关系，不将二者混同。",
    "question": "识别古典文献的语种、年代、译本和宗教思想背景。",
    "keywords": "梵语与巴利语 संस्कृतम् / Pāli",
    "version": "2026-11-28.1",
    "sources": []
  },
  {
    "id": "ur-foundation",
    "languageId": "ur",
    "discipline": "foundation",
    "title": "乌尔都语基础与南亚文化",
    "summary": "了解乌尔都语的书写传统、南亚语言生态及文学入门。",
    "question": "区分乌尔都语与印地语的口语联系、文字和正式语域。",
    "keywords": "乌尔都语 اردو",
    "version": "2026-11-28.1",
    "sources": []
  }
];
export const languageLabel=(id?:string|null)=>researchLanguages.find(x=>x.id===id)?.label||"未分类";
export const disciplineLabel=(id?:string|null)=>researchDisciplines.find(x=>x.id===id)?.label||"未分类";
export const catalogItem=(id?:string|null)=>communityCatalog.find(x=>x.id===id);
export function filterCatalog(language="",discipline="",query=""){
 const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return communityCatalog.filter(x=>(!language||x.languageId===language)&&(!discipline||x.discipline===discipline)&&terms.every(t=>[x.title,x.summary,x.question,x.keywords,languageLabel(x.languageId),disciplineLabel(x.discipline)].join(" ").toLowerCase().includes(t)));
}
export const catalogDescription=(item:ResearchCatalogItem)=>[item.summary,"研究问题："+item.question,"建议检索词："+item.keywords,"目录版本："+item.version,...item.sources.map(s=>"检索入口（非已核对原文）："+s.name+" "+s.url)].join("\n");
