export const admissionsSchools = [
  {id:'pku',name:'北京大学',notices:'https://bkzs.pku.edu.cn/zslb/bss/index.htm'},
  {id:'thu',name:'清华大学',notices:'https://www.admissions.tsinghua.edu.cn/gnxs/bss.htm'},
  {id:'fudan',name:'复旦大学',notices:'https://ao.fudan.edu.cn/'},
] as const;

export const admissionsPolicies = [
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
