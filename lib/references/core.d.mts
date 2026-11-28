export type Reference={id:string;kind:string;title:string;authors:string[];year:string;venue:string;volume:string;issue:string;pages:string;publisher:string;doi:string;url:string;language:string;tags:string[];status:string;annotation:string;noteIds:string[];projectIds:string[];origin:string;rawCitation:string;catalogKey:string|null;revision:number;createdAt:string;updatedAt:string};
export type State={items:Reference[]};export type Context={catalog:{id:string;rawCitation:string;url:string}[];notes:{id:string;title:string}[];projects:{id:string;title:string}[]};
export const kinds:string[],statuses:string[];
export function blank():State;export function doiOf(v:unknown):string;export function urlOf(v:unknown):string;
export function mutate(s:State,b:unknown,c:Context,id:string,now:string):State;
export function query(s:State,c:Context,q?:{q?:string;kind?:string;status?:string;tag?:string;offset?:number;mode?:string;id?:string}):any;
export function citation(r:Reference,format:string):string;
