import history from '@/lib/history-seed';
import {drinkCategory} from '@/lib/drink-categories';
import {env} from 'cloudflare:workers';
import {requireMember,fail} from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(r:Request){try{await requireMember(r,env);}catch(e){return fail(e)}try{
 const count:any=await env.DB!.prepare('SELECT COUNT(*) as n FROM historical').first();
 if(count.n<history.length)await env.DB!.batch(history.map(s=>env.DB!.prepare('INSERT OR IGNORE INTO historical(id,data) VALUES(?,?)').bind(s.id,JSON.stringify(s))));
 // Repair the original importer treating the wine named Petter as a header.
 const repaired=history.find(s=>s.id==='history-1026519315');
 if(repaired)await env.DB!.prepare("UPDATE historical SET data=? WHERE id=? AND json_array_length(data,'$.samples')=0").bind(JSON.stringify(repaired),repaired.id).run();
 const stored=(await env.DB!.prepare('SELECT data FROM historical').all()).results.map((r:any)=>JSON.parse(r.data));
 const sessions=(await env.DB!.prepare("SELECT id,title,date,data FROM tastings WHERE status='revealed'").all()).results;
 const extra=await Promise.all(sessions.map(async(s:any)=>{const votes=(await env.DB!.prepare('SELECT r.sample,r.data,m.name FROM ratings r JOIN members m ON r.session=m.session AND r.user=m.user WHERE r.session=?').bind(s.id).all()).results;return {id:s.id,title:s.title,date:s.date,source:'',samples:JSON.parse(s.data).samples.map((p:any)=>{const ratings=votes.filter((v:any)=>v.sample===p.id).map((v:any)=>({name:v.name,...JSON.parse(v.data)}));const scores=ratings.filter((v:any)=>v.score!==null);return {...p,ratings,average:scores.length?scores.reduce((n:number,v:any)=>n+v.score,0)/scores.length:null}})}}));
 return Response.json({sessions:[...stored,...extra].map(s=>({...s,samples:s.samples.map((p:any)=>({...p,...drinkCategory({...p,session:s.title,sessionId:s.id})}))})),imported:{sessions:history.length,samples:history.reduce((n,s)=>n+s.samples.length,0)},notes:'Historiska betyg är oförändrade. Medelvärden är omräknade. Stavning, pris och volym är bevarade från källan och inte produktverifierade. Tomma namn och datum har inte gissats. Spel, mallar och äldre datumomröstning finns kvar i originalfilerna.'},{headers:{'Cache-Control':'no-store'}});
}catch{return Response.json({error:'Arkivet kunde inte hämtas. Försök igen.'},{status:500})}}
