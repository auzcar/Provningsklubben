import {env} from 'cloudflare:workers';
import {requireMember,reply,fail,sameOrigin,isEnvAdmin} from '@/lib/auth';
import {profileData,parseAvatar} from '@/lib/profiles';
export const dynamic='force-dynamic';
export async function GET(r:Request){try{
 const me=await requireMember(r,env);
 return reply(await profileData(env.DB!,new URL(r.url).searchParams.get('user')||me.id,me,e=>isEnvAdmin(env,e)));
}catch(e){return fail(e)}}
// Members edit only their own profile. Admin changes go through /api/members.
export async function POST(r:Request){try{
 if(!sameOrigin(r))return reply({error:'Ogiltig begäran.'},403);
 const me=await requireMember(r,env);const b:any=await r.json();const db=env.DB!;
 if(b.action==='update'){
  const name=String(b.name||'').trim().slice(0,60);if(!name)throw Error('Ange ditt namn.');
  await db.prepare('UPDATE profiles SET name=?,bio=? WHERE user=?').bind(name,String(b.bio||'').trim().slice(0,600),me.id).run();
 }else if(b.action==='avatar'){
  const a=parseAvatar(b.image);
  await db.batch([db.prepare('INSERT INTO avatars(user,mime,data) VALUES(?,?,?) ON CONFLICT(user) DO UPDATE SET mime=excluded.mime,data=excluded.data').bind(me.id,a.mime,a.data),db.prepare('UPDATE profiles SET avatar_version=avatar_version+1 WHERE user=?').bind(me.id)]);
 }else if(b.action==='remove-avatar'){
  await db.batch([db.prepare('DELETE FROM avatars WHERE user=?').bind(me.id),db.prepare('UPDATE profiles SET avatar_version=0 WHERE user=?').bind(me.id)]);
 }else throw Error('Okänd åtgärd.');
 return reply(await profileData(db,me.id,me,e=>isEnvAdmin(env,e)));
}catch(e){return fail(e)}}
