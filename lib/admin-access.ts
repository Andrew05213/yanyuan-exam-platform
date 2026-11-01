import {env} from 'cloudflare:workers';
import defaults from '../config/admin-allowlist.json';
import {principal,AccessError} from './user-access';

const list=(value:unknown)=>typeof value==='string'?value.split(/[,\n]/).map(x=>x.trim()).filter(Boolean):[];
export function isAdmin(request:Request){
 const id=request.headers.get('oai-authenticated-user-id');
 if(!id)return false;
 const settings=env as unknown as Record<string,unknown>;
 const email=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
 // LAN self-registration does not verify email ownership; defaults never bootstrap LAN admins.
 const emails=settings.ADMIN_EMAILS===undefined?(request.headers.get('x-yanyuan-lan')==='1'?[]:defaults.emails):list(settings.ADMIN_EMAILS);
 return list(settings.ADMIN_USER_IDS).includes(id)||!!email&&emails.some(x=>x.toLowerCase()===email);
}
export function adminPrincipal(request:Request){
 const user=principal(request);
 if(!isAdmin(request))throw new AccessError('仅管理员可访问后台。',403);
 return user;
}
export function adminDb(){
 if(!env.DB)throw new AccessError('后台数据库尚未就绪。',503);
 return env.DB;
}
export async function rememberUser(request:Request,id:string){
 const email=request.headers.get('oai-authenticated-user-email')?.trim().slice(0,300)||null;
 let name=request.headers.get('oai-authenticated-user-full-name');
 if(name&&request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(name);}catch{name=null;}}
 await adminDb().prepare('INSERT INTO site_users(id,email,display_name,last_seen_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=COALESCE(excluded.email,site_users.email),display_name=COALESCE(excluded.display_name,site_users.display_name),last_seen_at=excluded.last_seen_at').bind(id,email,name?.replace(/[\r\n\u0000]/g,'').slice(0,120)||null,new Date().toISOString()).run();
}
