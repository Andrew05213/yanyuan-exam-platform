const encoder=new TextEncoder();
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const decode=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
export function encryptionReady(value:unknown):value is string{
 if(typeof value!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(value))return false;
 try{return decode(value).length===32;}catch{return false;}
}
async function masterKey(secret:string){
 if(!encryptionReady(secret))throw Error('服务器密钥存储尚未初始化。');
 return crypto.subtle.importKey('raw',decode(secret),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function encryptProviderKey(value:string,providerId:string,secret:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('ai-provider:'+providerId)},await masterKey(secret),encoder.encode(value));
 return JSON.stringify({v:1,iv:encode(iv),data:encode(new Uint8Array(ciphertext))});
}
// Server-side integration helper only; never return this result from an API route.
export async function decryptProviderKey(value:string,providerId:string,secret:string){
 try{const envelope=JSON.parse(value);if(envelope.v!==1)throw Error();const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(envelope.iv),additionalData:encoder.encode('ai-provider:'+providerId)},await masterKey(secret),decode(envelope.data));return new TextDecoder().decode(bytes);}catch{throw Error('服务端密钥无法解密，请核对加密配置。');}
}

