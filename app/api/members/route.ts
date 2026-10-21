import {env} from 'cloudflare:workers';
import {requireMember,requireAdmin,reply,fail,sameOrigin,authMode,clerkClient,isEnvAdmin} from '@/lib/auth';
import {card,roles,statuses} from '@/lib/profiles';
import {TEST_USERS} from '@/lib/test-users';
export const dynamic='force-dynamic';
async function list(r:Request){
 const me=await requireMember(r,env);const db=env.DB!;
 // Test users see only each other, real members never see test users.
 const rows=(await db.prepare(`SELECT * FROM profiles WHERE user ${me.tester?'':'NOT '}LIKE 'test:%' ${me.admin?'':"AND status='active'"} ORDER BY name COLLATE NOCASE`).all()).results as any[];
 const out:any={mode:authMode(env),members:rows.map(p=>card(p,me,isEnvAdmin(env,p.email)))};
 if(me.admin){
  // Participant names used in the imported archive, so the admin can link them to members.
  out.archiveNames=[...new Set((await db.prepare('SELECT data FROM historical').all()).results.flatMap((h:any)=>JSON.parse(h.data).samples.flatMap((p:any)=>(p.ratings||[]).map((v:any)=>v.name))))].filter(Boolean).sort();
  if(out.mode==='clerk'){const i=await clerkClient(env).invitations.getInvitationList({status:'pending'});out.invitations=i.data.map(x=>({id:x.id,email:x.emailAddress,created:x.createdAt}));}
 }
 return out;
}
export async function GET(r:Request){try{return reply(await list(r));}catch(e){return fail(e)}}
export async function POST(r:Request){try{
 if(!sameOrigin(r))return reply({error:'Ogiltig begäran.'},403);
 const b:any=await r.json();const db=env.DB!;
 // Test mode is managed with the admin's own identity, also from inside test mode.
 if(b.action==='test-setup'||b.action==='test-reset'){
  await requireAdmin(r,env,{ignoreTest:true});
  if(b.action==='test-setup')await db.batch(TEST_USERS.map(u=>db.prepare("INSERT OR IGNORE INTO profiles(user,name,email,created_at) VALUES(?,?,'',?)").bind(u.id,u.name,new Date().toISOString())));
  else{
   const own="SELECT id FROM tastings WHERE owner LIKE 'test:%'";
   await db.batch([db.prepare(`DELETE FROM ratings WHERE session IN (${own}) OR user LIKE 'test:%'`),db.prepare(`DELETE FROM members WHERE session IN (${own}) OR user LIKE 'test:%'`),db.prepare("DELETE FROM tastings WHERE owner LIKE 'test:%'"),db.prepare("DELETE FROM avatars WHERE user LIKE 'test:%'"),db.prepare("DELETE FROM shopping_items WHERE user LIKE 'test:%'"),db.prepare("DELETE FROM profiles WHERE user LIKE 'test:%'")]);
  }
  return reply({ok:true});
 }
 const me=await requireAdmin(r,env);
 if(b.action==='invite'||b.action==='revoke-invite'){
  if(authMode(env)!=='clerk')throw Error('Inbjudningar kräver Clerk-inloggning.');
  if(b.action==='invite'){
   const email=String(b.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Ange en giltig e-postadress.');
   try{await clerkClient(env).invitations.createInvitation({emailAddress:email,redirectUrl:new URL('/',r.url).toString(),notify:true});}catch(e:any){throw Error(e?.errors?.[0]?.longMessage||'Inbjudan kunde inte skickas.');}
  }else await clerkClient(env).invitations.revokeInvitation(String(b.id||''));
 }else if(b.action==='update'){
  const row:any=await db.prepare('SELECT * FROM profiles WHERE user=?').bind(String(b.user||'')).first();if(!row)throw Error('Medlemmen finns inte.');
  const role=b.role??row.role,status=b.status??row.status;
  if(!roles.includes(role)||!statuses.includes(status))throw Error('Ogiltig roll eller status.');
  if(row.user===me.id&&(status!=='active'||(role!=='admin'&&!me.envAdmin)))throw Error('Du kan inte ta bort din egen administratörsbehörighet.');
  const history=Array.isArray(b.historyNames)?JSON.stringify([...new Set(b.historyNames.map((x:any)=>String(x).slice(0,60)))].slice(0,10)):row.history_names;
  await db.prepare('UPDATE profiles SET role=?,status=?,history_names=? WHERE user=?').bind(role,status,history,row.user).run();
 }else throw Error('Okänd åtgärd.');
 return reply(await list(r));
}catch(e){return fail(e)}}
