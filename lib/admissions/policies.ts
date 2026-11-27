import catalog from '../../public/schools.json';

import national from '../../content/admissions-national.json';
import directories from '../../content/admissions-directories.json';

const cities:Record<string,string>={pku:'北京',thu:'北京',ruc:'北京',bfsu:'北京',speit:'上海',fudan:'上海',sisu:'上海',whu:'武汉',nju:'南京',zju:'杭州'};
const trainingSchools=catalog.schools.map(s=>({
  id:s.id,name:s.name,city:cities[s.id],
  notices:directories[s.id as keyof typeof directories],
  source:s.id==='bfsu'?'https://joinus.bfsu.edu.cn/info/1033/10524.htm':s.sourceUrl,sourceLabel:s.id==='bfsu'?'北外2026年官方简章':s.sourceLabel,referenceYear:s.languagePolicy.year,
  reviewed:s.languagePolicy.checkedAt,referenceNote:s.languagePolicy.note,
  historicalLanguages:[] as string[],trainingLanguages:s.languageIds.map(id=>catalog.languages[id as keyof typeof catalog.languages].label),
  training:catalog.oralItems.filter(item=>item.schoolIds.includes(s.id)).map(({id,title,type})=>({id,title,type})),
}));
export const admissionsSchools=[...trainingSchools,...national.map(s=>({
  ...s,notices:s.source,sourceLabel:s.detail?'2026年校方或阳光高考资料':'阳光高考2026年报名院校目录',
  referenceYear:2026,reviewed:'2026-11-27',referenceNote:s.detail?'参阅该校年度资料核对专业、报名条件、费用与考核。':'该校在2026年平台报名目录中。外语保送专业、资格和报名窗口仍待逐项核验。',
  historicalLanguages:s.historicalLanguages??[],trainingLanguages:[] as string[],training:[] as typeof trainingSchools[number]['training'],
}))];
export const admissionsPolicies = [
  {schoolId:'gdufs',year:2026,channel:'foreign-language-recommended',review:'verified',
    source:'https://xxgk.gdufs.edu.cn/info/1165/3316.htm',registrationCloses:'2026-01-14T00:00+08:00',registration:'2026-01-01 至 2026-01-13',
    eligibleLanguages:['法语','西班牙语','俄语','德语','日语','葡萄牙语','意大利语','越南语','泰语','朝鲜语'],
    condition:'前七个语种设国际贸易双学士项目，越南语、泰语、朝鲜语设法学双学士项目。可选专业受应试语种限制，另须核对公示资格。'},
  {schoolId:'pku',year:2026,channel:'foreign-language-recommended',review:'verified',
    source:'https://bkzs.pku.edu.cn/tzgg/d24d1f3ac99d4263bd2ab51442a7a7a8.htm',
    registrationCloses:'2026-01-09T00:00+08:00',registration:'2025-12-30 至 2026-01-08 24:00',
    eligibleLanguages:['阿拉伯语','日语','朝鲜语','泰语','德语','西班牙语','俄语','印尼语','法语','乌尔都语','葡萄牙语'],
    condition:'外国语中学推荐保送资格、当年高考报名条件。部分专业只招第一志愿，材料有独立寄达截止时间。'},
  {schoolId:'thu',year:2026,channel:'foreign-language-recommended',review:'verified',
    source:'https://www.admissions.tsinghua.edu.cn/info/1006/2129.htm',
    registrationCloses:'2026-01-05T00:00+08:00',registration:'2025-12-24 至 2026-01-04',eligibleLanguages:['日语'],
    condition:'教育部规定的具备推荐资格外国语中学优秀应届生。录取专业为日语，学校系统另行通知具体考核时间。'},
  {schoolId:'fudan',year:2026,channel:'foreign-language-recommended',review:'verified',
    source:'https://ao.fudan.edu.cn/aa/b5/c36330a764597/page.htm',
    registrationCloses:'2026-01-13T00:00+08:00',registration:'2026-01-01 至 2026-01-12',eligibleLanguages:['俄语','德语','法语','西班牙语','日语','朝鲜语'],
    condition:'外国语中学推荐保送资格、当年高考报名资格。零起点班和高起点班条件不同，高起点班需对应外语语种。'},
] as const;
