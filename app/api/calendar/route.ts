import {env} from 'cloudflare:workers';
import {requireMember,reply,fail,sameOrigin} from '@/lib/auth';
import {isTestUser} from '@/lib/test-users';
import {tastingFeed} from '@/lib/calendar';
export const dynamic='force-dynamic';
// Personal calendar subscription. Calendar apps cannot sign in, so the feed is reached with a
// secret token per member (table calendar_feeds), approved as an exception to sign-in. It shows
// only when and where the member's tastings are and who hosts them, never drinks or ratings.
//   GET ?feed=<token>  the iCalendar feed (no sign-in)
//   GET                the signed-in member's feed address, created on first use
//   POST {action:'reset'}  a new token; the old address stops working
const db=()=>{if(!env.DB)throw Error('Databasen är inte tillgänglig.');return env.DB;};
const newToken=()=>{const b=new Uint8Array(24);crypto.getRandomValues(b);return [...b].map(x=>x.toString(16).padStart(2,'0')).join('');};
const feedUrl=(r:Request,token:string)=>new URL(r.url).origin+'/api/calendar?feed='+token;

async function feed(r:Request,token:string){
 const notFound=()=>new Response('Kalenderlänken finns inte längre. Hämta en ny under din profil.',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 if(!/^[0-9a-f]{48}$/.test(token))return notFound();
 const owner:any=await db().prepare("SELECT f.user FROM calendar_feeds f JOIN profiles p ON p.user=f.user WHERE f.token=? AND p.status='active'").bind(token).first();
 if(!owner)return notFound();
 const user=owner.user as string;
 // Hosting, joined, or invited while the plan is a draft. Tastings from the last year onwards.
 const since=new Date(Date.now()-365*864e5).toISOString().slice(0,10);
 const rows=(await db().prepare(`SELECT t.id,t.title,t.date,t.data,t.version,t.owner,h.name host FROM tastings t LEFT JOIN profiles h ON h.user=t.owner
  WHERE t.date>=? AND (t.owner=? OR EXISTS(SELECT 1 FROM members m WHERE m.session=t.id AND m.user=?) OR EXISTS(SELECT 1 FROM json_each(t.data,'$.participants') WHERE value=?))
  ORDER BY t.date`).bind(since,user,user,user).all()).results as any[];
 const origin=new URL(r.url).origin;
 const events=rows.filter(t=>isTestUser(t.owner)===isTestUser(user)).map(t=>{const p=JSON.parse(t.data);
  return {t:{id:t.id,title:t.title,date:t.date,time:p.time||'',endTime:p.endTime||'',location:p.location||'',theme:p.theme||'',host:t.host||'',version:t.version},url:origin+'/provningar/'+encodeURIComponent(t.id)};});
 return new Response(tastingFeed(events),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="provningsklubben.ics"','Cache-Control':'private, max-age=300'}});
}
export async function GET(r:Request){try{
 const token=new URL(r.url).searchParams.get('feed');if(token!==null)return await feed(r,token);
 const me=await requireMember(r,env,{duringTasting:true});if(me.tester)throw Error('Kalenderprenumeration finns inte i testläget.');
 let row:any=await db().prepare('SELECT token FROM calendar_feeds WHERE user=?').bind(me.id).first();
 if(!row){await db().prepare('INSERT OR IGNORE INTO calendar_feeds(user,token,created_at) VALUES(?,?,?)').bind(me.id,newToken(),new Date().toISOString()).run();row=await db().prepare('SELECT token FROM calendar_feeds WHERE user=?').bind(me.id).first();}
 return reply({url:feedUrl(r,row.token)});
}catch(e){return fail(e)}}
export async function POST(r:Request){try{
 if(!sameOrigin(r))return reply({error:'Ogiltig begäran.'},403);
 const me=await requireMember(r,env,{duringTasting:true});if(me.tester)throw Error('Kalenderprenumeration finns inte i testläget.');
 const b:any=await r.json();if(b.action!=='reset')throw Error('Okänd åtgärd.');
 const token=newToken();
 await db().prepare('INSERT INTO calendar_feeds(user,token,created_at) VALUES(?,?,?) ON CONFLICT(user) DO UPDATE SET token=excluded.token,created_at=excluded.created_at').bind(me.id,token,new Date().toISOString()).run();
 return reply({url:feedUrl(r,token)});
}catch(e){return fail(e)}}
