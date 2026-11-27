export type Kind="note-review"|"error-review"|"target-training"|"project"|"manual";
export type Candidate={id:string;kind:Kind;title:string;minutes:number;priority:number;sourceId:string;due:string|null};
export type Status="planned"|"done"|"partial"|"skipped";
export type Scheduled=Candidate&{reason:string;status:Status;breakBefore:number};
export function planDay(input:{date:string;budgetMinutes:number;candidates:Candidate[]}):{date:string;budgetMinutes:number;scheduledMinutes:number;breakMinutes:number;freeMinutes:number;tasks:Scheduled[];deferred:{id:string;reason:string}[];ruleVersion:string};
export function reviewNext(input:{date:string;level?:number;outcome:"again"|"hard"|"good"|"skip"}):{level:number;due:string|null;changed:boolean};
export function progress(tasks:{id:string;status:Status}[]):{planned:number;done:number;partial:number;skipped:number;total:number;completion:number|null};