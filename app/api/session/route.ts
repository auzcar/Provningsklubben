import {env} from 'cloudflare:workers';
import {authMode,findMember,reply,AuthError} from '@/lib/auth';
export const dynamic='force-dynamic';
// Public: tells the client which sign-in to use, and who is signed in.
export async function GET(r:Request){
 const mode=authMode(env);const auth={mode,publishableKey:mode==='clerk'?env.CLERK_PUBLISHABLE_KEY||'':''};
 try{const m=await findMember(r,env);return reply({auth,me:m&&{id:m.id,name:m.name,admin:m.admin,avatar:m.avatarVersion}});}
 catch(e:any){return reply({auth,me:null,error:e.message},e instanceof AuthError?e.status:500)}
}
