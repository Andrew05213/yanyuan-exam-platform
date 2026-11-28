export type Node={id:string;kind:string;title:string;version:string;source:string;detail:string;href:string};
export type State={concepts:{id:string;title:string;description:string;revision:number;createdAt:string;updatedAt:string}[];links:{id:string;from:string;to:string;relation:string;note:string;fromVersion:string;toVersion:string;createdAt:string;updatedAt:string;suggestion:boolean;suggestionId:string|null}[];dismissed:string[]};
export type Input={resources:{id:string;title:string;author:string;era:string;theme:string;version:string}[];notes:{id:string;title:string;workId:string|null;tags:string|null;discipline:string|null;revision:number}[];projects:{id:string;title:string;revision:number;noteIds:string[]}[];weaknesses:{subject:string;tag:string;uniqueWrong:number;lastSeen:string}[];references?:{id:string;title:string;revision:number;authors:string[];year:string;tags:string[];noteIds:string[];projectIds:string[]}[]};
export const types:string[],relations:string[],derivedRelations:string[];
export function blank():State;
export function key(kind:string,...parts:string[]):string;
export function graph(input:Input,state:State):any;
export function pageGraph(g:ReturnType<typeof graph>,query?:{q?:string;kind?:string;offset?:number;focus?:string;relation?:string;edgeOffset?:number;suggestionOffset?:number}):any;
export function mutate(state:State,g:ReturnType<typeof graph>,body:unknown,newId:string,now:string):State;
