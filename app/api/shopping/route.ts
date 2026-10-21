import {env} from 'cloudflare:workers';
import {requireMember,reply,fail,sameOrigin} from '@/lib/auth';
export const dynamic='force-dynamic';
// The signed-in member's own shopping list (app/my-ratings.tsx). Nobody else can read or change it.
const MAX=200;
function clean(i:any){
 const key=String(i?.key||'').slice(0,120);if(!key)throw Error('Ogiltig dryck.');
 const article=String(i.article||'').trim();if(article&&!/^\d{1,12}$/.test(article))throw Error('Ogiltigt artikelnummer.');
 const productUrl=String(i.productUrl||'').trim();if(productUrl&&!/^https:\/\/www\.systembolaget\.se\//.test(productUrl))throw Error('Ogiltig länk.');
 const num=(v:any,max:number)=>v==null||v===''?null:Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=max?Number(v):null;
 return {key,data:JSON.stringify({key,name:String(i.name||'').slice(0,200),article,productUrl,price:num(i.price,100000),score:num(i.score,10)})};
}
async function list(db:D1Database,user:string){return {items:((await db.prepare('SELECT data FROM shopping_items WHERE user=? ORDER BY created_at').bind(user).all()).results as any[]).map(r=>JSON.parse(r.data))};}
export async function GET(r:Request){try{const me=await requireMember(r,env);return reply(await list(env.DB!,me.id));}catch(e){return fail(e)}}
export async function POST(r:Request){try{
 if(!sameOrigin(r))return reply({error:'Ogiltig begäran.'},403);
 const me=await requireMember(r,env),db=env.DB!,b:any=await r.json(),now=new Date().toISOString();
 if(b.action==='add'||b.action==='import'){
  const items=(b.action==='add'?[b.item]:Array.isArray(b.items)?b.items:[]).slice(0,MAX).map(clean);
  const have:any=await db.prepare('SELECT COUNT(*) n FROM shopping_items WHERE user=?').bind(me.id).first();
  if(have.n+items.length>MAX&&b.action==='add')throw Error(`Inköpslistan rymmer högst ${MAX} drycker.`);
  if(items.length)await db.batch(items.slice(0,Math.max(0,MAX-have.n)).map((i:any)=>db.prepare('INSERT OR IGNORE INTO shopping_items(user,key,data,created_at) VALUES(?,?,?,?)').bind(me.id,i.key,i.data,now)));
 }else if(b.action==='remove')await db.prepare('DELETE FROM shopping_items WHERE user=? AND key=?').bind(me.id,String(b.key||'')).run();
 else if(b.action==='clear')await db.prepare('DELETE FROM shopping_items WHERE user=?').bind(me.id).run();
 else throw Error('Okänd åtgärd.');
 return reply(await list(db,me.id));
}catch(e){return fail(e)}}
