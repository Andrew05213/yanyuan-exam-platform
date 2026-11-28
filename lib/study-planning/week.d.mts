import type {Source,DayPlan} from "./workspace";
export type Routine={id:string;title:string;subject:string;track:string;minutes:number;priority:number;days:number[]};
export function allocateWeek(input:{dates:string[];budgets:number[];existing:DayPlan[];sources:Source[];routines:Routine[];allowedKinds:string[];preferredTrack:string},make:(date:string,budget:number,selected:string[],manual:unknown[],pool:Source[])=>DayPlan):DayPlan[];
