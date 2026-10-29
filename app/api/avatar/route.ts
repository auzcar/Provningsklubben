import {env} from 'cloudflare:workers';
import {requireMember,fail,waits,waitingRoom,AuthError,WAITING} from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(r:Request){try{
 const m=await requireMember(r,env,{duringTasting:true,waiting:true}),user=new URL(r.url).searchParams.get('user')||'';
 // In the waiting room only the photo of the admin who opened it is shown.
 if(waits(m)){const w=await waitingRoom(env.DB!);if(w&&w.host!==user)throw new AuthError(WAITING,403);}
 const a:any=await env.DB!.prepare("SELECT a.mime,a.data FROM avatars a JOIN profiles p ON p.user=a.user WHERE a.user=? AND p.status='active'").bind(user).first();
 if(!a)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
 return new Response(Uint8Array.from(atob(a.data),c=>c.charCodeAt(0)),{headers:{'Content-Type':a.mime,'Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
}catch(e){return fail(e)}}
