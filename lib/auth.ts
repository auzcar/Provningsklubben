import {verifyToken,createClerkClient} from '@clerk/backend';
import {isTestUser} from '@/lib/test-users';
import {applyPending} from '@/lib/pending';
import {eveningOpenSql} from '@/lib/model';

// Server-side identity and club membership. Every API route calls requireMember();
// the client never decides who it is.
//
// AUTH_MODE=clerk: verify the Clerk session token (Authorization: Bearer or the
// __session cookie). Identity headers from the request are ignored.
// Any other value: the original Sites gateway mode, which trusts
// oai-authenticated-user-* headers. Only safe behind a gateway that strips
// client-supplied copies (Sites production, or the loopback-only dev mock).
export type AuthEnv={DB?:D1Database;AUTH_MODE?:string;CLERK_PUBLISHABLE_KEY?:string;CLERK_SECRET_KEY?:string;CLERK_JWT_KEY?:string;ADMIN_EMAILS?:string};
// tester: the real admin behind a test user (see lib/test-users.ts).
export type Member={id:string;name:string;email:string;role:string;admin:boolean;envAdmin:boolean;avatarVersion:number;tester?:string};
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

// X-Test-User asks to act as a test user. It is honoured only for a verified admin and only
// for test users, so it can never reach a real member's identity or grant admin rights.
export async function findMember(r:Request,env:AuthEnv,{ignoreTest=false}={}):Promise<Member|null>{
 const who=await identify(r,env);if(!who)return null;
 if(isTestUser(who.id))throw new AuthError('Ogiltig identitet.',403);
 const db=env.DB;if(!db)throw new AuthError('Databasen är inte tillgänglig.',500);
 let row:any=await db.prepare('SELECT * FROM profiles WHERE user=?').bind(who.id).first();
 if(!row){
  const d=await details(env,who);
  const created=await db.prepare('INSERT OR IGNORE INTO profiles(user,name,email,created_at) VALUES(?,?,?,?)').bind(who.id,d.name.slice(0,60),d.email,new Date().toISOString()).run();
  // A brand-new member with a verified email may have been prepared by the admin (lib/pending.ts).
  if(created.meta.changes)await applyPending(db,who.id,d.email);
  row=await db.prepare('SELECT * FROM profiles WHERE user=?').bind(who.id).first();
 }
 if(row.status!=='active')throw new AuthError('Ditt medlemskap är inaktiverat. Kontakta klubbens administratör.',403);
 const envAdmin=isEnvAdmin(env,row.email);
 const me={id:row.user,name:row.name,email:row.email,role:row.role,admin:envAdmin||row.role==='admin',envAdmin,avatarVersion:row.avatar_version};
 const test=ignoreTest?null:r.headers.get('x-test-user');if(!test)return me;
 if(!me.admin)throw new AuthError('Endast administratören kan använda testläget.',403);
 const t:any=isTestUser(test)?await db.prepare('SELECT * FROM profiles WHERE user=?').bind(test).first():null;if(!t)throw new AuthError('Testpersonen finns inte. Starta testläget igen.',403);
 return {id:t.user,name:t.name,email:'',role:'member',admin:false,envAdmin:false,avatarVersion:t.avatar_version,tester:me.id};
}

// While a tasting someone hosts or has joined is on, the server answers that tasting only, so the
// evening stays at the table on every device and browser. Routes the tasting itself needs opt in
// with {duringTasting:true}; /api/club then limits requests to the running tasting. A tasting left
// open from before yesterday (Swedish date) no longer locks anyone.
export const LOCKED='Provningen pågår. Resten av klubben öppnas när resultatet har avslöjats.';
export async function runningTastings(db:D1Database,user:string){
 const yesterday=new Date(Date.now()-864e5).toLocaleDateString('sv-SE',{timeZone:'Europe/Stockholm'});
 const rows=(await db.prepare("SELECT t.id FROM tastings t WHERE (t.status='active' OR (t.status='revealed' AND "+eveningOpenSql('t.data')+")) AND (t.date='' OR t.date>=?) AND (t.owner=? OR EXISTS(SELECT 1 FROM members m WHERE m.session=t.id AND m.user=?))").bind(yesterday,user,user).all()).results as any[];
 return rows.map(x=>String(x.id));
}
// Waiting room (settings key waiting_room): while an admin has it on, members who are not admins
// reach nothing but the waiting page, which shows that admin's photo. Test users are not held back.
export const WAITING='Klubben har inte öppnat ännu.';
export async function waitingRoom(db:D1Database){
 const w:any=await db.prepare("SELECT s.value host,p.name,p.avatar_version avatar FROM settings s LEFT JOIN profiles p ON p.user=s.value WHERE s.key='waiting_room'").first();
 return w?{host:String(w.host),name:String(w.name||''),avatar:Number(w.avatar||0)}:null;
}
export const waits=(m:Member)=>!m.admin&&!m.tester;
// waiting: the route serves the waiting page itself (session, the host's photo).
type Guard={ignoreTest?:boolean;duringTasting?:boolean;waiting?:boolean};
async function notInTasting(env:AuthEnv,m:Member,opts:Guard){
 if(!opts.waiting&&waits(m)&&env.DB&&await waitingRoom(env.DB))throw new AuthError(WAITING,403);
 if(!opts.duringTasting&&env.DB&&(await runningTastings(env.DB,m.id)).length)throw new AuthError(LOCKED,423);return m;
}
export async function requireMember(r:Request,env:AuthEnv,opts:Guard={}){const m=await findMember(r,env,opts);if(!m)throw new AuthError(SIGNED_OUT);return notInTasting(env,m,opts);}
export async function requireAdmin(r:Request,env:AuthEnv,opts:Guard={}){const m=await findMember(r,env,opts);if(!m)throw new AuthError(SIGNED_OUT);if(!m.admin)throw new AuthError('Endast administratören kan göra detta.',403);return notInTasting(env,m,opts);}

export function sameOrigin(r:Request){const o=r.headers.get('origin');return !o||o===new URL(r.url).origin;}
export function reply(data:any,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function fail(e:any){return reply({error:e?.message||'Något gick fel.'},e instanceof AuthError?e.status:400);}
