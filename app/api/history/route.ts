import history from '@/lib/history-seed';
import {drinkCategory} from '@/lib/drink-categories';
import {env} from 'cloudflare:workers';
import {revealDoneSql} from '@/lib/model';
import {requireMember,requireAdmin,fail,reply,sameOrigin} from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(r:Request){let tester=false;try{tester=!!(await requireMember(r,env)).tester;}catch(e){return fail(e)}try{
 const count:any=await env.DB!.prepare('SELECT COUNT(*) as n FROM historical').first();
 if(count.n<history.length)await env.DB!.batch(history.map(s=>env.DB!.prepare('INSERT OR IGNORE INTO historical(id,data) VALUES(?,?)').bind(s.id,JSON.stringify(s))));
 // Repair the original importer treating the wine named Petter as a header.
 const repaired=history.find(s=>s.id==='history-1026519315');
 if(repaired)await env.DB!.prepare("UPDATE historical SET data=? WHERE id=? AND json_array_length(data,'$.samples')=0").bind(JSON.stringify(repaired),repaired.id).run();
 const stored=(await env.DB!.prepare('SELECT data FROM historical').all()).results.map((r:any)=>JSON.parse(r.data));
 // Test tastings only show up for test users, never in the real archive or statistics.
 const sessions=(await env.DB!.prepare(`SELECT id,title,date,data FROM tastings WHERE status='revealed' AND ${revealDoneSql()} ${tester?'':"AND owner NOT LIKE 'test:%'"}`).all()).results;
 const extra=await Promise.all(sessions.map(async(s:any)=>{const votes=(await env.DB!.prepare('SELECT r.sample,r.data,m.name FROM ratings r JOIN members m ON r.session=m.session AND r.user=m.user WHERE r.session=?').bind(s.id).all()).results;return {id:s.id,title:s.title,date:s.date,source:'',samples:JSON.parse(s.data).samples.map((p:any)=>{const ratings=votes.filter((v:any)=>v.sample===p.id).map((v:any)=>({name:v.name,...JSON.parse(v.data)}));const scores=ratings.filter((v:any)=>v.score!==null);return {...p,ratings,average:scores.length?scores.reduce((n:number,v:any)=>n+v.score,0)/scores.length:null}})}}));
 return Response.json({sessions:[...stored,...extra].map(s=>({...s,samples:s.samples.map((p:any)=>({...p,...drinkCategory({...p,session:s.title,sessionId:s.id})}))})),imported:{sessions:history.length,samples:history.reduce((n,s)=>n+s.samples.length,0)},notes:'Historiska betyg är oförändrade. Medelvärden är omräknade. Stavning, pris och volym är bevarade från källan och inte produktverifierade. Tomma namn och datum har inte gissats. Spel, mallar och äldre datumomröstning finns kvar i originalfilerna.'},{headers:{'Cache-Control':'no-store'}});
}catch{return Response.json({error:'Arkivet kunde inte hämtas. Försök igen.'},{status:500})}}

// Admin: fill in or correct a drink in the archive (name, type, price, volume, article and
// Systembolaget data). Works for imported history and revealed tastings; scores are never touched.
const FIELDS=['name','type','article','producer','country','vintage','productUrl','image','price','volume','abv'] as const;
function clean(f:any){
 const out:Record<string,any>={};
 for(const k of FIELDS){if(!(k in (f||{})))continue;const v=f[k];
  if(k==='price'||k==='volume'||k==='abv'){if(v==null||v===''){out[k]=null;continue;}const n=Number(v);if(!Number.isFinite(n)||n<0||n>100000)throw Error('Kontrollera sifferfälten.');out[k]=n;}
  else if(k==='article'){const a=String(v??'').trim();if(a&&!/^\d{1,12}$/.test(a))throw Error('Artikelnumret får bara innehålla siffror.');out[k]=a;}
  else if(k==='productUrl'||k==='image'){const u=String(v??'').trim();if(u&&!/^https:\/\/(www\.systembolaget\.se|product-cdn\.systembolaget\.se)\//.test(u))throw Error('Ogiltig länk.');out[k]=u;}
  else out[k]=String(v??'').trim().slice(0,200);}
 return out;
}
export async function POST(r:Request){try{
 if(!sameOrigin(r))return Response.json({error:'Ogiltig begäran.'},{status:403});
 await requireAdmin(r,env);const b:any=await r.json();if(b.action!=='edit')throw Error('Okänd åtgärd.');
 const fields=clean(b.fields),session=String(b.session||''),sample=String(b.sample||''),db=env.DB!;
 const patch=(data:any)=>{const p=data.samples?.find((x:any)=>x.id===sample);if(!p)throw Error('Drycken finns inte.');Object.assign(p,fields);return JSON.stringify(data);};
 const h:any=await db.prepare('SELECT data FROM historical WHERE id=?').bind(session).first();
 if(h)await db.prepare('UPDATE historical SET data=? WHERE id=?').bind(patch(JSON.parse(h.data)),session).run();
 else{const t:any=await db.prepare("SELECT data FROM tastings WHERE id=? AND status='revealed'").bind(session).first();if(!t)throw Error('Provningen finns inte i arkivet.');await db.prepare('UPDATE tastings SET data=? WHERE id=?').bind(patch(JSON.parse(t.data)),session).run();}
 return reply({ok:true});
}catch(e){return fail(e)}}
