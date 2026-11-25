"use client";
import {useState,useEffect,type ReactNode} from "react";
import {ResearchAssistant} from "./research-assistant";
type Member={id:string;role:string;state:string;muteUntil:string|null;reason:string;revision:number};
type Appeal={id:string;memberId?:string;memberRevision:number;body?:string;status:string;resolution?:string;createdAt:string};
type Access={role:string;state:string;read:boolean;write:boolean;moderate:boolean;member:Member|null;appeals:Appeal[]};
type Invite={id:string;expiresAt:string;usedAt:string|null;revokedAt:string|null};
type Log={id:string;action:string;targetId:string;reason:string;createdAt:string};
type Manage={members:Member[];nextOffset:number|null;appeals:Appeal[];invites:Invite[];logs:Log[]};
async function api<T>(query="",body?:unknown):Promise<T>{
 const r=await fetch("/api/literature/governance"+query,{cache:"no-store",credentials:"same-origin",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const data:unknown=await r.json();
 if(!r.ok){const error=data&&typeof data==="object"&&"error" in data?data.error:undefined;throw Error(typeof error==="string"&&error?error:"治理操作暂不可用。");}
 return data as T;
}
const message=(e:unknown)=>e instanceof Error?e.message:"操作失败。";
const label=(state:string)=>({active:"有效",suspended:"访问暂停",revoked:"资格撤销","not-invited":"尚未获准",member:"社区成员",moderator:"社区管理员",admin:"系统管理员",student:"学习用户",pending:"待处理",accepted:"复核接受",dismissed:"复核驳回"} as Record<string,string>)[state]||state;
function Management({access,refresh}:{access:Access;refresh:()=>Promise<void>}){
 const [data,setData]=useState<Manage|null>(null),[offset,setOffset]=useState(0),[days,setDays]=useState("7"),[code,setCode]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 async function load(o=offset){try{setData(await api<Manage>("?manage=1&offset="+o));setOffset(o);}catch(e){setError(message(e));}}
 async function act(body:Record<string,unknown>){if(busy)return;setBusy(true);setError("");setNotice("");setCode("");try{const result=await api<{code?:string}>("",body);if(result.code)setCode(result.code);setNotice(body.action==="resolveAppeal"&&body.decision==="accepted"?"申诉复核完成；如需恢复权限，请单独执行恢复。":"操作已记录。");await load();await refresh();}catch(e){setError(message(e));}finally{setBusy(false);}}
 function member(m:Member,decision:string){const why=window.prompt("请填写处理依据（不含私人信息）");if(!why?.trim())return;const d=decision==="mute"?Number(window.prompt("禁言天数（1–30）","7")):undefined;if(decision==="mute"&&(!Number.isInteger(d)||!d||d<1||d>30))return;void act({action:"member",id:m.id,revision:m.revision,decision,reason:why,days:d});}
 function resolve(a:Appeal,decision:string){const why=window.prompt("请输入复核结论与原因");if(why?.trim())void act({action:"resolveAppeal",id:a.id,decision,reason:why});}
 return <details className="community-panel governance-manager"><summary>社区治理中心</summary><p>仅管理站内研究社区，不读取用户私人学习内容。处理决定需要人工复核。</p><button type="button" className="primary" disabled={busy} onClick={()=>void load(0)}>读取治理数据</button>
 {access.role==="admin"&&<><p><a href="/auth/governance">中国版网关：注册邀请与账号管理（仅网关管理员）</a></p><div className="community-controls"><label>社区邀请码有效期（天）<input type="number" min={1} max={30} value={days} onChange={e=>setDays(e.target.value)}/></label><button disabled={busy} type="button" className="primary" onClick={()=>void act({action:"createInvite",days:Number(days)})}>生成单次社区邀请</button></div>{code&&<p className="governance-code">仅本次显示：<code>{code}</code>。请通过可信渠道交付，不公开转发。</p>}</>}
 {data&&<><h3>成员管理</h3>{data.members.map(m=><article className="governance-row" key={m.id}><strong>成员 {m.id.slice(0,8)} · {label(m.role)} · {label(m.state)}</strong><small>禁言至：{m.muteUntil||"无"} · 依据：{m.reason||"无"}</small>{m.id!==access.member?.id&&(access.role==="admin"||m.role==="member")&&<div className="community-controls">{["mute","suspend","revoke","restore",...(access.role==="admin"?[m.role==="moderator"?"demote":"promote"]:[])].map((d)=><button disabled={busy} type="button" key={d} onClick={()=>member(m,d)}>{({mute:"禁言",suspend:"暂停访问",revoke:"撤销资格",restore:"恢复权限",promote:"任命审核员",demote:"撤销审核员"} as Record<string,string>)[d]}</button>)}</div>}</article>)}<div className="community-controls"><button disabled={busy||offset===0} onClick={()=>void load(Math.max(0,offset-50))}>上一页</button><button disabled={busy||data.nextOffset===null} onClick={()=>data.nextOffset!==null&&void load(data.nextOffset)}>下一页</button></div>
 <h3>权限申诉</h3>{data.appeals.length===0&&<p>暂无待处理申诉。</p>}{data.appeals.map(a=><article className="governance-row" key={a.id}><small>成员 {a.memberId?.slice(0,8)} · {a.createdAt}</small><p>{a.body}</p><div className="community-controls"><button disabled={busy} onClick={()=>resolve(a,"accepted")}>接受复核</button><button disabled={busy} onClick={()=>resolve(a,"dismissed")}>驳回</button></div></article>)}
 {access.role==="admin"&&<><h3>近期社区邀请</h3>{data.invites.map(i=><article key={i.id} className="governance-row"><span>{i.id.slice(0,8)} · {i.usedAt?"已使用":i.revokedAt?"已撤销":i.expiresAt<=new Date().toISOString()?"已过期":"有效"} · {i.expiresAt}</span>{!i.usedAt&&!i.revokedAt&&<button disabled={busy} onClick={()=>{const why=window.prompt("撤销原因");if(why?.trim())void act({action:"revokeInvite",id:i.id,reason:why});}}>撤销</button>}</article>)}<h3>近期治理日志</h3>{data.logs.map(l=><article key={l.id} className="governance-row"><span>{l.action} · {l.targetId.slice(0,8)} · {l.createdAt}</span><small>{l.reason}</small></article>)}</>}
 </>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</details>;
}
export function GovernanceGate({children}:{children:ReactNode}){
 const [access,setAccess]=useState<Access|null>(null),[error,setError]=useState(""),[code,setCode]=useState(""),[why,setWhy]=useState(""),[busy,setBusy]=useState(false);
 async function refresh(){try{setAccess(await api<Access>());setError("");}catch(e){setAccess(null);setError(message(e));}}
 useEffect(()=>{void refresh();},[]);
 async function send(action:string){setBusy(true);setError("");try{await api("",action==="redeem"?{action,code:code.trim()}:{action,reason:why});setCode("");setWhy("");await refresh();}catch(e){setError(message(e));}finally{setBusy(false);}}
 return <section className="research-community"><div className="community-panel governance-status"><h2>研究社区 · 成员权限</h2>{access?<><p>{label(access.role)} · {label(access.state)}{access.read&&!access.write?" · 发布权限暂停":""}</p>{access.member?.reason&&<p>最近处理依据：{access.member.reason}</p>}{access.member?.muteUntil&&<p>禁言截止：{access.member.muteUntil}</p>}</>:<p>正在核验资格；未核验前不显示共享内容。</p>}<button type="button" className="text-button" onClick={()=>void refresh()}>刷新权限</button>
 {access?.role==="student"&&<form onSubmit={e=>{e.preventDefault();void send("redeem");}}><p>学习账号不自动加入研究社区。请输入管理员提供的单次社区邀请码。</p><label>社区邀请码<input required maxLength={64} minLength={64} autoComplete="off" value={code} onChange={e=>setCode(e.target.value)}/></label><button className="primary" disabled={busy}>验证并加入</button></form>}
 {access?.member&&!access.write&&<form onSubmit={e=>{e.preventDefault();void send("appeal");}}><label>权限申诉（请勿填写私人信息）<textarea required rows={3} maxLength={500} value={why} onChange={e=>setWhy(e.target.value)}/></label><button className="primary" disabled={busy}>提交人工复核</button></form>}
 {access?.appeals.map(a=><p key={a.id}>申诉 · {label(a.status)}{a.resolution?" · "+a.resolution:""}</p>)}
 {error&&<p role="alert">{error}</p>}<p className="muted">私人笔记、个人备考与私人 AI 助手独立于社区权限。</p></div>
 {access?.moderate&&<Management access={access} refresh={refresh}/>}
 {access?.read?children:<ResearchAssistant key="private-only" privateOnly/>}
 </section>;
}
