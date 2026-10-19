import {verifyToken,createClerkClient} from '@clerk/backend';

// Server-side identity and club membership. Every API route calls requireMember();
// the client never decides who it is.
//
// AUTH_MODE=clerk: verify the Clerk session token (Authorization: Bearer or the
// __session cookie). Identity headers from the request are ignored.
// Any other value: the original Sites gateway mode, which trusts
// oai-authenticated-user-* headers. Only safe behind a gateway that strips
// client-supplied copies (Sites production, or the loopback-only dev mock).
export type AuthEnv={DB?:D1Database;AUTH_MODE?:string;CLERK_PUBLISHABLE_KEY?:string;CLERK_SECRET_KEY?:string;CLERK_JWT_KEY?:string;ADMIN_EMAILS?:string};
export type Member={id:string;name:string;email:string;role:string;admin:boolean;envAdmin:boolean;avatarVersion:number};
export class AuthError extends Error{status:number;constructor(message:string,status=401){super(message);this.status=status;}}
export const SIGNED_OUT='Logga in för att använda klubben.';

export function authMode(env:AuthEnv){return env.AUTH_MODE==='clerk'?'clerk':'gateway';}
export function clerkClient(env:AuthEnv){if(!env.CLERK_SECRET_KEY)throw Error('CLERK_SECRET_KEY saknas.');return createClerkClient({secretKey:env.CLERK_SECRET_KEY,publishableKey:env.CLERK_PUBLISHABLE_KEY});}
const adminEmails=(env:AuthEnv)=>(env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
export const isEnvAdmin=(env:AuthEnv,email:string)=>!!email&&adminEmails(env).includes(email.toLowerCase());

function bearer(r:Request){
 const h=r.headers.get('authorization');if(h?.startsWith('Bearer '))return h.slice(7).trim();
 const c=r.headers.get('cookie')||'';const m=c.match(/(?:^|;\s*)__session=([^;]+)/);return m?decodeURIComponent(m[1]):null;
}

async function identify(r:Request,env:AuthEnv):Promise<{id:string;email?:string;name?:string}|null>{
 if(authMode(env)==='clerk'){
  const token=bearer(r);if(!token)return null;
  if(!env.CLERK_SECRET_KEY&&!env.CLERK_JWT_KEY)throw new AuthError('Inloggningen är inte konfigurerad.',500);
  try{const p=await verifyToken(token,{jwtKey:env.CLERK_JWT_KEY||undefined,secretKey:env.CLERK_SECRET_KEY||undefined,authorizedParties:[new URL(r.url).origin]});return p.sub?{id:p.sub}:null;}catch{return null;}
 }
 const id=r.headers.get('oai-authenticated-user-id');if(!id)return null;
 const encoded=r.headers.get('oai-authenticated-user-full-name');let name:string|undefined;
 if(encoded&&r.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(encoded);}catch{}}
 return {id,email:r.headers.get('oai-authenticated-user-email')||'',name};
}

// Name and verified email for a first-time member, from the identity provider.
async function details(env:AuthEnv,who:{id:string;email?:string;name?:string}){
 if(authMode(env)!=='clerk')return {name:who.name||who.email?.split('@')[0]||'Medlem',email:who.email||''};
 const u=await clerkClient(env).users.getUser(who.id);
 const primary=u.emailAddresses.find(e=>e.id===u.primaryEmailAddressId);
 const email=primary?.verification?.status==='verified'?primary.emailAddress:'';
 return {name:[u.firstName,u.lastName].filter(Boolean).join(' ')||u.username||email.split('@')[0]||'Medlem',email};
}

export async function findMember(r:Request,env:AuthEnv):Promise<Member|null>{
 const who=await identify(r,env);if(!who)return null;
 const db=env.DB;if(!db)throw new AuthError('Databasen är inte tillgänglig.',500);
 let row:any=await db.prepare('SELECT * FROM profiles WHERE user=?').bind(who.id).first();
 if(!row){
  const d=await details(env,who);
  await db.prepare('INSERT OR IGNORE INTO profiles(user,name,email,created_at) VALUES(?,?,?,?)').bind(who.id,d.name.slice(0,60),d.email,new Date().toISOString()).run();
  row=await db.prepare('SELECT * FROM profiles WHERE user=?').bind(who.id).first();
 }
 if(row.status!=='active')throw new AuthError('Ditt medlemskap är inaktiverat. Kontakta klubbens administratör.',403);
 const envAdmin=isEnvAdmin(env,row.email);
 return {id:row.user,name:row.name,email:row.email,role:row.role,admin:envAdmin||row.role==='admin',envAdmin,avatarVersion:row.avatar_version};
}

export async function requireMember(r:Request,env:AuthEnv){const m=await findMember(r,env);if(!m)throw new AuthError(SIGNED_OUT);return m;}
export async function requireAdmin(r:Request,env:AuthEnv){const m=await requireMember(r,env);if(!m.admin)throw new AuthError('Endast administratören kan göra detta.',403);return m;}

export function sameOrigin(r:Request){const o=r.headers.get('origin');return !o||o===new URL(r.url).origin;}
export function reply(data:any,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function fail(e:any){return reply({error:e?.message||'Något gick fel.'},e instanceof AuthError?e.status:400);}
