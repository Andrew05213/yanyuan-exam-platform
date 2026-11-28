import type {Run} from "../deep-research/contract";import type {Evidence} from "../research-assistant-contract";
export type Report={title:string;subtitle:string;metadata:string[];sections:{heading:string;paragraphs:string[]}[]};
export function report(run:Run,evidence:Evidence[],options:{mode:"reviewed"|"draft";includePlan:boolean;projectTitle:string}):Report;
export function markdown(r:Report):string;
export function printHtml(r:Report):string;
export function docx(r:Report):Uint8Array;
