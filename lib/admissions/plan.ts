import {scorePair,eligibility,examConflict,pathState,RULE_VERSION} from './core.mjs';
import {admissionsPolicies,admissionsSchools} from './policies';
import {AccessError} from '../user-access';

const schoolIds=new Set<string>(admissionsSchools.map(s=>s.id));
export const admissionsLanguages=[...new Set([...admissionsPolicies.flatMap(p=>p.eligibleLanguages),...admissionsSchools.flatMap(s=>s.trainingLanguages)])];
const shanghaiNow=()=>new Date(Date.now()+8*3600000);
export const admissionsYear=()=>shanghaiNow().getUTCFullYear();
export const defaultAdmissionsYear=()=>admissionsYear()+(shanghaiNow().getUTCMonth()>=6?1:0);
type Qualification='confirmed'|'pending'|'denied';
type Check='yes'|'no'|'unknown';
type Exam={schoolId:string;start:string;end:string;location:string;from:string;travelMinutes:number|null};
export type AdmissionPlan={year:number;language:string;qualification:Qualification;examRegistration:Check;schoolIds:string[];exams:Exam[];profile?: (number|null)[][];evidence?: string[][];city?:string;trainingFocus?:string;field?:string;preferredSchool?:string};

function invalid():never{throw new AccessError('请检查年份、报考条件与考试日程。',400);}
const dateTime=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
function parseTime(value:string){
  if(!dateTime.test(value))return NaN;
  const instant=Date.parse(value+'+08:00');
  return Number.isFinite(instant)&&new Date(instant+8*3600000).toISOString().slice(0,16)===value?instant:NaN;
}

export function admissionPlan(value:unknown):AdmissionPlan{
  const b=value as Partial<AdmissionPlan>|null;
  if(!b||typeof b!=='object'||!Number.isInteger(b.year)||b.year!<2020||b.year!>admissionsYear()+3||
    typeof b.language!=='string'||(b.language!==''&&!admissionsLanguages.includes(b.language as typeof admissionsLanguages[number]))||
    !['confirmed','pending','denied'].includes(b.qualification??'')||!['yes','no','unknown'].includes(b.examRegistration??'')||
    !Array.isArray(b.schoolIds)||!b.schoolIds.length||b.schoolIds.length>schoolIds.size||
    new Set(b.schoolIds).size!==b.schoolIds.length||b.schoolIds.some(id=>!schoolIds.has(id))||
    !Array.isArray(b.exams)||b.exams.length>12)invalid();
  const exams=b.exams.map(e=>{
    if(!e||!b.schoolIds!.includes(e.schoolId)||typeof e.start!=='string'||typeof e.end!=='string'||
      !(parseTime(e.end)>parseTime(e.start))||typeof e.location!=='string'||e.location.trim().length>80||
      typeof e.from!=='string'||e.from.trim().length>80||
      (e.travelMinutes!==null&&(!Number.isInteger(e.travelMinutes)||e.travelMinutes<0||e.travelMinutes>10080))||
      (e.travelMinutes!==null&&!e.from.trim()))invalid();
    return {schoolId:e.schoolId,start:e.start,end:e.end,location:e.location.trim(),from:e.from.trim(),travelMinutes:e.travelMinutes};
  });
  const profile=b.profile;
  if(profile!==undefined&&(!Array.isArray(profile)||profile.length!==10||profile.some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(v=>v!==null&&(!Number.isInteger(v)||v<0||v>3)))))invalid();
  if(b.evidence!==undefined&&(!profile||!Array.isArray(b.evidence)||b.evidence.length!==10||b.evidence.some(row=>!Array.isArray(row)||row.length!==2||row.some(g=>!['E1','E2','E3'].includes(g)))))invalid();
  if(b.city!==undefined && b.city!=='' && !admissionsSchools.some(s=>s.city===b.city))invalid();
  if(b.trainingFocus!==undefined && b.trainingFocus!=='' && !['reading','speech','personal','zh-en','en-zh'].includes(b.trainingFocus))invalid();
  if(b.field!==undefined&&!['','法学','经贸','工程'].includes(b.field))invalid();
  if(b.preferredSchool!==undefined&&b.preferredSchool!==''&&!b.schoolIds.includes(b.preferredSchool))invalid();
  return {field:b.field||'',preferredSchool:b.preferredSchool||'',city:b.city||'',trainingFocus:b.trainingFocus||'',...(b.evidence?{evidence:b.evidence}:{}),year:b.year!,language:b.language,qualification:b.qualification!,examRegistration:b.examRegistration!,schoolIds:b.schoolIds,exams,...(profile===undefined?{}:{profile:profile.map(pair=>[...pair])})};
}

export function assessAdmissions(plan:AdmissionPlan,now=Date.now()){
  const results=admissionsSchools.filter(s=>plan.schoolIds.includes(s.id)).map(school=>{
    const policy=admissionsPolicies.find(p=>p.schoolId===school.id&&p.year===plan.year);
    const reference=policy??admissionsPolicies.find(p=>p.schoolId===school.id);
    const current=policy&&Date.parse(policy.registrationCloses)>now?policy:undefined;
    const status=eligibility({qualification:plan.qualification,year:plan.year,program:current,
      language:plan.language,hardChecks:[plan.examRegistration]});
    const cityMatch=plan.city?school.city===plan.city:null;
    const languageMatch=plan.language?(reference?reference.eligibleLanguages.some(language=>language===plan.language):(school.historicalLanguages.length?school.historicalLanguages:school.trainingLanguages).includes(plan.language)):null;
    const program=school.programs.find(p=>p.field===plan.field&&(!plan.language||p.language===plan.language));
    const reasons=[program?('历史培养项目：'+program.label):null,cityMatch?'符合城市偏好':null,languageMatch?(reference||school.historicalLanguages.length?'参考简章列有意向语种':'站内有意向语种训练'):null].filter(Boolean);
    const type=plan.trainingFocus||(plan.profile?.[0]?.some(v=>v!==null&&v<=1)?'reading':'personal');
    const task=school.training.find(t=>t.type===type)??school.training[0];
    const {training,...details}=school;
    return {...details,status,policy:reference??null,historical:!!reference&&!current,reasons,firstChoice:school.id===plan.preferredSchool,task,hasSchoolHub:!school.id.startsWith('national-')&&school.id!=='gdufs'};

  });
  const priority:Record<string,number>={eligible:0,conditional:1,excluded:2};
  results.sort((a,b)=>priority[a.status]-priority[b.status]||Number(b.firstChoice)-Number(a.firstChoice)||b.reasons.length-a.reasons.length);
  const scores=plan.profile?.map((pair,i)=>scorePair(pair.map((level,j)=>level===null?null:{level,grade:plan.evidence?.[i]?.[j]??'E1',evidenceId:i+'-'+j})));
  const normalized=plan.exams.map(exam=>({...exam,start:parseTime(exam.start),end:parseTime(exam.end),transferMs:exam.travelMinutes===null?null:exam.travelMinutes*60000}));
  const conflicts=normalized.flatMap((exam,i)=>normalized.slice(i+1).map((other,j)=>({
    first:i,second:i+1+j,status:examConflict(exam,other),
  })));
  return {results,scores,conflicts,path:pathState(plan.qualification),ruleVersion:RULE_VERSION};
}
