import {env} from 'cloudflare:workers';
import {validatePlan,validateVote,visibleSamples,costShare} from '@/lib/model';
import {requireMember,reply,fail,sameOrigin} from '@/lib/auth';
export const dynamic='force-dynamic';
const uid=async(r:Request)=>(await requireMember(r,env)).id;
const db=()=>{if(!env.DB)throw Error('Databasen är inte tillgänglig.');return env.DB;};
async function detail(id:string,user:string){
 const s:any=await db().prepare('SELECT * FROM tastings WHERE id=?').bind(id).first();if(!s)throw Error('Provningen finns inte.');
 const host=s.owner===user;const member=await db().prepare('SELECT * FROM members WHERE session=? AND user=?').bind(id,user).first();if(!host&&!member)throw Error('Anslut via provningens inbjudningslänk först.');
 const plan=JSON.parse(s.data);const people=(await db().prepare('SELECT user,name FROM members WHERE session=?').bind(id).all()).results;
 const mine=(await db().prepare('SELECT sample,data FROM ratings WHERE session=? AND user=?').bind(id,user).all()).results;
 const progress=(await db().prepare('SELECT user,COUNT(*) as completed FROM ratings WHERE session=? GROUP BY user').bind(id).all()).results;
 const all=s.status==='revealed'?(await db().prepare('SELECT r.sample,r.data,m.name FROM ratings r JOIN members m ON r.session=m.session AND r.user=m.user WHERE r.session=?').bind(id).all()).results:[];
 const headcount=s.status==='draft'?(plan.participants||[]).length:people.length;
 return {id:s.id,title:s.title,date:s.date,status:s.status,version:s.version,host,self:user,joined:!!member,cost:costShare(plan.samples,headcount),token:host?s.token:undefined,plan:host?plan:{theme:plan.theme,participants:plan.participants||[],samples:visibleSamples(plan.samples,false,s.status==='revealed')},people,progress,mine:Object.fromEntries(mine.map((v:any)=>[v.sample,JSON.parse(v.data)])),results:all.map((v:any)=>({...JSON.parse(v.data),sample:v.sample,name:v.name}))};
}
export async function GET(r:Request){try{const user=await uid(r);const id=new URL(r.url).searchParams.get('id');if(id)return reply(await detail(id,user));const rows=(await db().prepare('SELECT DISTINCT t.id,t.title,t.date,t.status,t.owner FROM tastings t LEFT JOIN members m ON t.id=m.session WHERE t.owner=? OR m.user=? ORDER BY t.date DESC').bind(user,user).all()).results;return reply({user,sessions:rows.map((s:any)=>({...s,host:s.owner===user,owner:undefined}))});}catch(e:any){return fail(e)}}
export async function POST(r:Request){try{
 if(!sameOrigin(r))return reply({error:'Ogiltig begäran.'},403);
 const user=await uid(r);const b:any=await r.json();let id=b.id;
 if(b.action==='create'){
 id=crypto.randomUUID();const plan={theme:'',notes:'',budget:null,expected:[],participants:[user],samples:[]};
 await db().prepare('INSERT INTO tastings(id,owner,status,title,date,data,token,version) VALUES(?,?,?,?,?,?,?,1)').bind(id,user,'draft',String(b.title||'Ny provning').slice(0,150),'',JSON.stringify(plan),crypto.randomUUID()+crypto.randomUUID()).run();return reply(await detail(id,user));}
 const s:any=await db().prepare('SELECT * FROM tastings WHERE id=?').bind(id).first();if(!s)throw Error('Provningen finns inte.');
 if(b.action==='join'){
 if(s.status!=='active'||b.token!==s.token)throw Error('Inbjudan är ogiltig eller provningen är inte öppen.');
 const name=String(b.name||'').trim().slice(0,60);if(!name)throw Error('Ange ditt namn.');
 await db().prepare("INSERT INTO members(session,user,name) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM tastings WHERE id=? AND status='active') ON CONFLICT(session,user) DO UPDATE SET name=excluded.name").bind(id,user,name,id).run();return reply(await detail(id,user));}
 const host=s.owner===user;const plan=JSON.parse(s.data);
 if(b.action==='vote'){
 const m=await db().prepare('SELECT user FROM members WHERE session=? AND user=?').bind(id,user).first();if(!m||s.status!=='active'||!plan.samples.some((x:any)=>x.id===b.sample))throw Error('Du kan inte betygsätta detta prov nu.');
 const v=validateVote(b.vote);
 const result=await db().prepare("INSERT INTO ratings(session,user,sample,data) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM tastings WHERE id=? AND status='active') ON CONFLICT(session,user,sample) DO UPDATE SET data=excluded.data").bind(id,user,b.sample,JSON.stringify(v),id).run();if(!result.meta.changes)throw Error('Provningen har avslutats.');return reply({ok:true});}
 if(!host)throw Error('Endast värden kan göra detta.');
 if(b.action==='save'){
 if(s.status!=='draft')throw Error('Planeringen är låst under provningen.');const p=validatePlan(b.plan);const title=String(b.title||'').trim().slice(0,150);if(!title)throw Error('Ange en titel.');const date=String(b.date||'');if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Ogiltigt datum.');
 const out=await db().prepare("UPDATE tastings SET title=?,date=?,data=?,version=version+1 WHERE id=? AND status='draft' AND version=?").bind(title,date,JSON.stringify(p),id,b.version).run();if(!out.meta.changes)throw Error('Planeringen har ändrats i en annan flik. Öppna provningen igen.');
 }else if(b.action==='start'){
 if(s.status!=='draft'||!plan.samples.length)throw Error('Lägg till minst en dryck först.');
 await db().prepare("UPDATE tastings SET status='active',version=version+1 WHERE id=? AND status='draft'").bind(id).run();
 const ids=(plan.participants||[]) as string[];
 if(ids.length){const rows=(await db().prepare(`SELECT user,name FROM profiles WHERE status='active' AND user IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all()).results as any[];
  if(rows.length)await db().batch(rows.map(p=>db().prepare('INSERT OR IGNORE INTO members(session,user,name) VALUES(?,?,?)').bind(id,p.user,p.name)));}
 }else if(b.action==='reveal'){
 if(s.status!=='active')throw Error('Provningen är inte pågående.');
 const memberCount:any=await db().prepare('SELECT COUNT(*) as n FROM members WHERE session=?').bind(id).first();if(memberCount.n<plan.expected.length)throw Error('Alla planerade deltagare har inte anslutit ännu.');
 const out=await db().prepare("UPDATE tastings SET status='revealed',version=version+1 WHERE id=? AND status='active' AND EXISTS(SELECT 1 FROM members WHERE session=?) AND NOT EXISTS(SELECT 1 FROM members m WHERE m.session=? AND (SELECT COUNT(*) FROM ratings r WHERE r.session=m.session AND r.user=m.user) < ?)").bind(id,id,id,plan.samples.length).run();if(!out.meta.changes)throw Error('Alla anslutna deltagare måste betygsätta eller avstå på samtliga prov först.');
 }else if(b.action==='remove-participant'){
 // Someone who never showed up would otherwise block the reveal forever.
 if(s.status!=='active')throw Error('Provningen är inte pågående.');
 await db().batch([db().prepare('DELETE FROM ratings WHERE session=? AND user=?').bind(id,String(b.user||'')),db().prepare('DELETE FROM members WHERE session=? AND user=?').bind(id,String(b.user||''))]);
 }else if(b.action==='delete'){
 if(s.status==='revealed')throw Error('Avslöjade provningar finns kvar i arkivet och kan inte tas bort.');
 await db().batch([db().prepare('DELETE FROM ratings WHERE session=?').bind(id),db().prepare('DELETE FROM members WHERE session=?').bind(id),db().prepare("DELETE FROM tastings WHERE id=? AND status!='revealed'").bind(id)]);
 return reply({deleted:true});
 }else throw Error('Okänd åtgärd.');
 return reply(await detail(id,user));
 }catch(e:any){return fail(e)}}
