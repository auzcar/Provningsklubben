import {env} from 'cloudflare:workers';
import {requireMember,fail} from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(r:Request){try{
 await requireMember(r,env);
 const a:any=await env.DB!.prepare("SELECT a.mime,a.data FROM avatars a JOIN profiles p ON p.user=a.user WHERE a.user=? AND p.status='active'").bind(new URL(r.url).searchParams.get('user')||'').first();
 if(!a)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 return new Response(Uint8Array.from(atob(a.data),c=>c.charCodeAt(0)),{headers:{'Content-Type':a.mime,'Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
}catch(e){return fail(e)}}
