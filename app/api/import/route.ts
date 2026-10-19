import {env} from 'cloudflare:workers';
import {requireAdmin,reply,fail,sameOrigin} from '@/lib/auth';
import {importBackup} from '@/lib/import';
export const dynamic='force-dynamic';
export async function POST(r:Request){try{
 if(!sameOrigin(r))return reply({error:'Ogiltig begäran.'},403);
 const me=await requireAdmin(r,env);
 let body:any;try{body=await r.json();}catch{throw Error('Filen kunde inte läsas som JSON.');}
 return reply(await importBackup(env.DB!,body,me.id));
}catch(e){return fail(e)}}
