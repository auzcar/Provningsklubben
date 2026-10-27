import {env} from 'cloudflare:workers';
import {validatePlan,validateSnacks,validateVote,costShare,revealDone,revealOrder,revealDoneSql} from '@/lib/model';
import {requireMember,requireAdmin,reply,fail,sameOrigin,runningTastings,AuthError,LOCKED} from '@/lib/auth';
import {isTestUser,TEST_USERS} from '@/lib/test-users';
import {stageOf,publicStage} from '@/lib/program';
export const dynamic='force-dynamic';
const db=()=>{if(!env.DB)throw Error('Databasen är inte tillgänglig.');return env.DB;};
async function detail(id:string,user:string){
 const s:any=await db().prepare('SELECT * FROM tastings WHERE id=?').bind(id).first();if(!s)throw Error('Provningen finns inte.');
 const host=s.owner===user;const member=await db().prepare('SELECT * FROM members WHERE session=? AND user=?').bind(id,user).first();// Any member may open a revealed tasting through its link: the results are in the archive anyway.
 // Test tastings stay within test mode.
 const plan=JSON.parse(s.data);const done=s.status==='revealed'&&revealDone(plan);
 if(!host&&!member&&!(done&&isTestUser(s.owner)===isTestUser(user)))throw Error('Anslut via provningens inbjudningslänk först.');const people=(await db().prepare('SELECT user,name,paid FROM members WHERE session=?').bind(id).all()).results;
 const mine=(await db().prepare('SELECT sample,data FROM ratings WHERE session=? AND user=?').bind(id,user).all()).results;
 const progress=(await db().prepare('SELECT user,COUNT(*) as completed FROM ratings WHERE session=? GROUP BY user').bind(id).all()).results;
 const rated=new Set(((await db().prepare('SELECT user,sample FROM ratings WHERE session=?').bind(id).all()).results as any[]).map(x=>x.user+'\u0000'+x.sample));const all0=(u:string,sid:string)=>rated.has(u+'\u0000'+sid);
 // During the host's reveal, participants get the results for the drinks shown so far only.
 const order:string[]=Array.isArray(plan.revealOrder)?plan.revealOrder:[];const at=Number(plan.revealAt)||0;
 const shown=new Set<string>(done||host?plan.samples.map((x:any)=>x.id):order.slice(0,at));
 const reveal=s.status==='revealed'&&order.length?{at,total:order.length,done,shown:host?order:order.slice(0,at)}:undefined;
 const all=s.status==='revealed'?((await db().prepare('SELECT r.sample,r.data,m.name FROM ratings r JOIN members m ON r.session=m.session AND r.user=m.user WHERE r.session=?').bind(id).all()).results as any[]).filter(r=>shown.has(r.sample)):[];
 // The host may correct anyone's rating while the tasting is on, so the host sees them all then.
 const ratingsForHost=host&&s.status==='active'?((await db().prepare('SELECT user,sample,data FROM ratings WHERE session=?').bind(id).all()).results as any[]).map(r=>({user:r.user,sample:r.sample,...JSON.parse(r.data)})):undefined;
 const headcount=s.status==='draft'?(plan.participants||[]).length:people.length;
 const owner:any=await db().prepare('SELECT name,swish FROM profiles WHERE user=?').bind(s.owner).first();
 const cost=costShare(plan.samples,headcount);
 // What is on the table, and who has not yet rated the drink there (the host waits for them).
 const stage=publicStage(plan);let waiting:string[]=[],waitingUsers:string[]=[];
 if(s.status==='active'&&stage.sample!=null){const sid=plan.samples[stage.sample].id;const w=(people as any[]).filter(p=>!all0(p.user,sid));waiting=w.map(p=>p.name);waitingUsers=w.map(p=>p.user);}
 // Participants pay the host by Swish; the host sees who has marked themselves as paid.
 const pay=member&&!host&&owner?.swish?{to:owner.name,swish:owner.swish,amount:cost.perPerson&&cost.perPerson>0?cost.perPerson:null,paid:!!(member as any).paid}:undefined;
 return {id:s.id,title:s.title,date:s.date,status:s.status,version:s.version,host,self:user,joined:!!member,cost,pay,stage,waiting,waitingUsers,reveal,ratings:ratingsForHost,hostSwish:host?owner?.swish||'':undefined,token:host?s.token:undefined,plan:host?plan:{theme:plan.theme,time:plan.time||'',endTime:plan.endTime||'',location:plan.location||'',participants:plan.participants||[],served:plan.served??null,samples:plan.samples.map((x:any)=>s.status==='revealed'&&shown.has(x.id)?x:{id:x.id,number:x.number})},people:host?people:people.map(({paid,...p}:any)=>p),progress,mine:Object.fromEntries(mine.map((v:any)=>[v.sample,JSON.parse(v.data)])),results:all.map((v:any)=>({...JSON.parse(v.data),sample:v.sample,name:v.name}))};
}
// During a running tasting only that tasting answers (lib/auth.ts); the list stays so the app can find it.
async function onlyRunning(user:string,id:any){const running=await runningTastings(db(),user);if(running.length&&!running.includes(String(id||'')))throw new AuthError(LOCKED,423);}
export async function GET(r:Request){try{const me=await requireMember(r,env,{duringTasting:true}),user=me.id;const id=new URL(r.url).searchParams.get('id');if(id)await onlyRunning(user,id);if(id)return reply(await detail(id,user));const rows=(await db().prepare("SELECT DISTINCT t.id,t.title,t.date,json_extract(t.data,'$.time') time,t.status,t.owner,CASE WHEN t.status='revealed' AND NOT "+revealDoneSql('t.data')+" THEN 1 ELSE 0 END revealing FROM tastings t LEFT JOIN members m ON t.id=m.session WHERE t.owner=? OR m.user=? ORDER BY t.date DESC").bind(user,user).all()).results;return reply({user,sessions:rows.map((s:any)=>({...s,host:s.owner===user,owner:undefined}))});}catch(e:any){return fail(e)}}
export async function POST(r:Request){try{
 if(!sameOrigin(r))return reply({error:'Ogiltig begäran.'},403);
 const me=await requireMember(r,env,{duringTasting:true}),user=me.id;const b:any=await r.json();let id=b.id;
 await onlyRunning(user,b.action==='create'||b.action==='simulate'?'':id);
 if(b.action==='simulate'){
 // Test mode: copy the admin's own real plan to a test tasting hosted by Testvärden, with the test
 // members invited, so the evening can be run through before anyone real is invited. The original
 // is not touched, and the copy is removed with the rest of the test data.
 const real=await requireAdmin(r,env,{ignoreTest:true});
 const src:any=await db().prepare('SELECT * FROM tastings WHERE id=?').bind(String(b.id||'')).first();
 if(!src||src.owner!==real.id)throw Error('Du kan bara provköra dina egna provningar.');
 const p=JSON.parse(src.data);delete p.served;
 const plan={...p,expected:[],participants:TEST_USERS.map(u=>u.id)};
 const now=new Date().toISOString();
 await db().batch(TEST_USERS.map(u=>db().prepare("INSERT OR IGNORE INTO profiles(user,name,email,created_at) VALUES(?,?,'',?)").bind(u.id,u.name,now)));
 id=crypto.randomUUID();
 await db().prepare("INSERT INTO tastings(id,owner,status,title,date,data,token,version) VALUES(?,'test:host','draft',?,?,?,?,1)").bind(id,('Test: '+src.title).slice(0,150),src.date,JSON.stringify(plan),crypto.randomUUID()+crypto.randomUUID()).run();
 return reply({id});}
 if(b.action==='create'){
 id=crypto.randomUUID();const plan={theme:'',notes:'',time:'',endTime:'',location:'',budget:null,expected:[],participants:[user],samples:[],snacks:[],snackReceipt:{total:null,note:''},program:[]};
 await db().prepare('INSERT INTO tastings(id,owner,status,title,date,data,token,version) VALUES(?,?,?,?,?,?,?,1)').bind(id,user,'draft',String(b.title||'Ny provning').slice(0,150),'',JSON.stringify(plan),crypto.randomUUID()+crypto.randomUUID()).run();return reply(await detail(id,user));}
 const s:any=await db().prepare('SELECT * FROM tastings WHERE id=?').bind(id).first();if(!s)throw Error('Provningen finns inte.');
 // Test tastings and real tastings never share people.
 const sameWorld=(u:string)=>isTestUser(u)===isTestUser(s.owner);
 if(b.action==='join'){
 if(!sameWorld(user))throw Error(isTestUser(user)?'Testpersoner kan bara delta i testprovningar.':'Det här är en testprovning.');
 if(s.status!=='active'||b.token!==s.token)throw Error('Inbjudan är ogiltig eller provningen är inte öppen.');
 const name=String(b.name||'').trim().slice(0,60);if(!name)throw Error('Ange ditt namn.');
 await db().prepare("INSERT INTO members(session,user,name) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM tastings WHERE id=? AND status='active') ON CONFLICT(session,user) DO UPDATE SET name=excluded.name").bind(id,user,name,id).run();return reply(await detail(id,user));}
 if(b.action==='delete'&&s.status==='revealed'){
 // Revealed tastings belong to the archive: only an admin may remove one, after typing its title.
 if(!me.admin)throw Error('Bara administratören kan ta bort en avslöjad provning.');
 if(String(b.confirm??'').trim()!==s.title.trim())throw Error('Namnet stämde inte. Inget togs bort.');
 await db().batch([db().prepare('DELETE FROM ratings WHERE session=?').bind(id),db().prepare('DELETE FROM members WHERE session=?').bind(id),db().prepare('DELETE FROM tastings WHERE id=?').bind(id)]);
 return reply({deleted:true});
 }
 const host=s.owner===user;const plan=JSON.parse(s.data);
 if(b.action==='vote'){
 const m=await db().prepare('SELECT user FROM members WHERE session=? AND user=?').bind(id,user).first();if(!m||s.status!=='active'||!plan.samples.some((x:any)=>x.id===b.sample))throw Error('Du kan inte betygsätta detta prov nu.');
 // Only the drink on the table can be rated. A drink served before someone joined can still get
 // their first rating, so a late arrival does not block the reveal; after that it is read-only.
 const st=stageOf(plan),at=plan.samples.findIndex((x:any)=>x.id===b.sample);
 if(at!==st.sample){const mine=await db().prepare('SELECT 1 FROM ratings WHERE session=? AND user=? AND sample=?').bind(id,user,b.sample).first();if(at>=st.reached||mine)throw Error(at>=st.reached?'Provet har inte ställts fram ännu.':'Betyget är låst. Bara provet på bordet kan ändras.');}
 const v=validateVote(b.vote);
 const result=await db().prepare("INSERT INTO ratings(session,user,sample,data) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM tastings WHERE id=? AND status='active') ON CONFLICT(session,user,sample) DO UPDATE SET data=excluded.data").bind(id,user,b.sample,JSON.stringify(v),id).run();if(!result.meta.changes)throw Error('Provningen har avslutats.');return reply({ok:true});}
 if(b.action==='paid'){
 const m=await db().prepare('SELECT user FROM members WHERE session=? AND user=?').bind(id,user).first();if(!m)throw Error('Du deltar inte i provningen.');
 await db().prepare('UPDATE members SET paid=? WHERE session=? AND user=?').bind(b.paid?1:0,id,user).run();return reply(await detail(id,user));}
 if(!host)throw Error('Endast värden kan göra detta.');
 if(b.action==='save'){
 if(s.status!=='draft')throw Error('Planeringen är låst under provningen.');const p=validatePlan(b.plan);// The host always takes part and rates.
 if(!p.participants.includes(s.owner))p.participants=[s.owner,...p.participants].slice(0,40);if(!(p.participants||[]).every(sameWorld))throw Error(isTestUser(user)?'Bjud bara in testpersoner till en testprovning.':'Testpersoner kan inte bjudas in till riktiga provningar.');const title=String(b.title||'').trim().slice(0,150);if(!title)throw Error('Ange en titel.');const date=String(b.date||'');if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Ogiltigt datum.');
 const out=await db().prepare("UPDATE tastings SET title=?,date=?,data=?,version=version+1 WHERE id=? AND status='draft' AND version=?").bind(title,date,JSON.stringify(p),id,b.version).run();if(!out.meta.changes)throw Error('Planeringen har ändrats i en annan flik. Öppna provningen igen.');
 }else if(b.action==='start'){
 if(s.status!=='draft'||!plan.samples.length)throw Error('Lägg till minst en dryck först.');
 await db().prepare("UPDATE tastings SET status='active',version=version+1 WHERE id=? AND status='draft'").bind(id).run();
 const ids=[...new Set<string>([s.owner,...(plan.participants||[])])];
 if(ids.length){const rows=(await db().prepare(`SELECT user,name FROM profiles WHERE status='active' AND user IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all()).results as any[];
  if(rows.length)await db().batch(rows.map(p=>db().prepare('INSERT OR IGNORE INTO members(session,user,name) VALUES(?,?,?)').bind(id,p.user,p.name)));}
 }else if(b.action==='reveal'){
 if(s.status!=='active')throw Error('Provningen är inte pågående.');
 const memberCount:any=await db().prepare('SELECT COUNT(*) as n FROM members WHERE session=?').bind(id).first();if(memberCount.n<plan.expected.length)throw Error('Alla planerade deltagare har inte anslutit ännu.');
 const votes=((await db().prepare('SELECT sample,data FROM ratings WHERE session=?').bind(id).all()).results as any[]).map(v=>({sample:v.sample,score:JSON.parse(v.data).score??null}));
 const out=await db().prepare("UPDATE tastings SET status='revealed',version=version+1,data=json_set(data,'$.revealOrder',json(?),'$.revealAt',0) WHERE id=? AND status='active' AND EXISTS(SELECT 1 FROM members WHERE session=?) AND NOT EXISTS(SELECT 1 FROM members m WHERE m.session=? AND (SELECT COUNT(*) FROM ratings r WHERE r.session=m.session AND r.user=m.user) < ?)").bind(JSON.stringify(revealOrder(plan.samples,votes)),id,id,id,plan.samples.length).run();if(!out.meta.changes)throw Error('Alla anslutna deltagare måste betygsätta eller avstå på samtliga prov först.');
  }else if(b.action==='snacks'){
 // The snack list is a grocery list: the host keeps ticking items and noting the receipt after the
 // tasting has opened, so it is saved on its own, outside the locked plan and its version.
 const {snacks,snackReceipt}=validateSnacks(b);
 await db().prepare("UPDATE tastings SET data=json_set(data,'$.snacks',json(?),'$.snackReceipt',json(?)) WHERE id=?").bind(JSON.stringify(snacks),JSON.stringify(snackReceipt),id).run();
 }else if(b.action==='reveal-next'||b.action==='reveal-all'){
 // Only the host moves the reveal on; everyone else follows. 'reveal-all' skips to the full results.
 if(s.status!=='revealed'||revealDone(plan))throw Error('Avslöjandet är redan klart.');
 const len=plan.revealOrder.length,at=Number(plan.revealAt)||0,to=b.action==='reveal-all'?len+1:at+1;
 const out=await db().prepare("UPDATE tastings SET data=json_set(data,'$.revealAt',?) WHERE id=? AND status='revealed' AND coalesce(json_extract(data,'$.revealAt'),0)=?").bind(to,id,at).run();
 if(!out.meta.changes)throw Error('Någon annan hann före. Försök igen.');
 }else if(b.action==='rate-for'){
 // The host corrects a participant's rating (a slip of the finger, or a second thought) on any drink
 // that has been served, as long as the tasting is on. Only the host can do this.
 if(s.status!=='active')throw Error('Betygen kan bara ändras medan provningen pågår.');
 const target=String(b.user||'');const m=await db().prepare('SELECT user FROM members WHERE session=? AND user=?').bind(id,target).first();if(!m)throw Error('Personen deltar inte i provningen.');
 const at=plan.samples.findIndex((x:any)=>x.id===b.sample);if(at<0||at>=stageOf(plan).reached)throw Error('Provet har inte ställts fram ännu.');
 const v=validateVote(b.vote);
 await db().prepare('INSERT INTO ratings(session,user,sample,data) VALUES(?,?,?,?) ON CONFLICT(session,user,sample) DO UPDATE SET data=excluded.data').bind(id,target,b.sample,JSON.stringify(v)).run();
 }else if(b.action==='next'){
 // The host moves to the next item of the evening. A drink must have every participant's rating
 // (or skip) before anything else is put out. plan.served keeps the latest drink for older clients.
 if(s.status!=='active')throw Error('Provningen är inte pågående.');
 const st=stageOf(plan);const to=st.step==null?0:st.step+1;if(to>=st.items.length)throw Error('Det finns inget mer att servera.');
 if(st.sample!=null){const missing:any=await db().prepare('SELECT COUNT(*) n FROM members m WHERE m.session=? AND NOT EXISTS(SELECT 1 FROM ratings r WHERE r.session=m.session AND r.user=m.user AND r.sample=?)').bind(id,plan.samples[st.sample].id).first();if(missing.n)throw Error('Alla har inte betygsatt prov '+(st.sample+1)+' ännu.');}
 const next=st.items[to];const served=next.kind==='drink'?plan.samples.findIndex((x:any)=>x.id===next.sample):(plan.served??null);
 const out=await db().prepare("UPDATE tastings SET data=json_set(data,'$.step',?,'$.served',?) WHERE id=? AND status='active' AND coalesce(json_extract(data,'$.step'),-1)=?").bind(to,served,id,st.step??-1).run();
 if(!out.meta.changes)throw Error('Någon annan hann före. Försök igen.');
 }else if(b.action==='test-fill'){
 // Test mode: random scores on the drink on the table for every other test participant who has not rated it.
 if(!isTestUser(s.owner)||s.status!=='active')throw Error('Fungerar bara i en pågående testprovning.');
 const people=(await db().prepare('SELECT user FROM members WHERE session=?').bind(id).all()).results as any[];
 const st=stageOf(plan);if(st.sample==null)throw Error('Ställ fram ett prov först.');const onTable=[plan.samples[st.sample]];
 const writes=people.filter(p=>p.user!==user).flatMap(p=>onTable.map((x:any)=>db().prepare('INSERT OR IGNORE INTO ratings(session,user,sample,data) VALUES(?,?,?,?)').bind(id,p.user,x.id,JSON.stringify({score:Math.round((4+Math.random()*5.5)*2)/2,skip:false,comment:'',tags:[],guess:null}))));
 if(writes.length)await db().batch(writes);
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
