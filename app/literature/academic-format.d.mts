export type Block={kind:string;text:string;level?:number;number?:string};
export type Token={kind:string;text?:string;top?:string;bottom?:string};
export function parseNote(source:string):{blocks:Block[];footnotes:{id:string;text:string}[]};
export function inlineNote(text:string):{kind:string;text:string}[];
export function formulaTokens(text:string):Token[];
