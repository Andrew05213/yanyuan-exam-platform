import {storage} from "../../db/store";
import catalogData from "../../app/literature/paper-citations.json";
import {blank,type State,type Context,urlOf} from "./core.mjs";
type Db=ReturnType<typeof storage>;
// The URL itself is the stable catalog key; reordering a catalog does not change identity.
const catalog=Object.entries(catalogData).map(([url,rawCitation])=>({id:url,rawCitation,url:urlOf(url)}));
export async function readLibrary(db:Db,uid:string){const row=await db.prepare("SELECT version,payload FROM private_reference_libraries WHERE user_id=?").bind(uid).first<{version:string;payload:string}>();return {version:row?.version??null,state:row?JSON.parse(row.payload) as State:blank()};}
export async function referenceContext(db:Db,uid:string){
 const [notes,projects]=await Promise.all([
 db.prepare("SELECT id,title FROM entries WHERE user_id=? AND folder='active' ORDER BY updated_at DESC,id LIMIT 501").bind(uid).all<Context["notes"][number]>(),
 db.prepare("SELECT id,json_extract(payload,'$.title') AS title FROM research_projects WHERE owner_id=? AND status='active' ORDER BY updated_at DESC,id LIMIT 201").bind(uid).all<Context["projects"][number]>()
 ]);
 return {context:{catalog,notes:notes.results.slice(0,500),projects:projects.results.slice(0,200)} as Context,limits:{notes:notes.results.length>500,projects:projects.results.length>200}};
}
