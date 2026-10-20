import {env} from 'cloudflare:workers';
import {requireAdmin,reply,fail} from '@/lib/auth';
import {snapshot,listSnapshots} from '@/lib/backup';
export const dynamic='force-dynamic';
// Admin only. GET: a fresh full backup as a download. ?list=1: stored weekly backups. ?date=YYYY-MM-DD: one of them.
export async function GET(r:Request){try{
 await requireAdmin(r,env);const q=new URL(r.url).searchParams;const kv=(env as any).BACKUPS as KVNamespace|undefined;
 if(q.has('list'))return reply({automatic:!!kv,dates:kv?await listSnapshots(kv):[]});
 const date=q.get('date');let body:string;
 if(date){if(!kv||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Säkerhetskopian finns inte.');const v=await kv.get('backup/'+date+'.json');if(!v)throw Error('Säkerhetskopian finns inte.');body=v;}
 else body=JSON.stringify(await snapshot(env.DB!));
 return new Response(body,{headers:{'Content-Type':'application/json','Content-Disposition':`attachment; filename="provningsklubben-${date||new Date().toISOString().slice(0,10)}.json"`,'Cache-Control':'no-store'}});
}catch(e){return fail(e)}}
