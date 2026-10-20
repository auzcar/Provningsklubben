import {drinkCategory} from '@/lib/drink-categories';
import type {Member} from '@/lib/auth';

// Profile pages only show ratings from revealed tastings and the imported archive,
// the same data every member can already see in the archive. Blind tastings stay hidden.
export const roles=['admin','member'];
export const statuses=['active','removed'];
export function names(raw:string){try{const a=JSON.parse(raw);return Array.isArray(a)?a.map(String):[];}catch{return [];}}
export function card(row:any,viewer:Member,envAdmin=false){return {id:row.user,name:row.name,bio:row.bio,role:row.role,admin:envAdmin||row.role==='admin',avatar:row.avatar_version||0,historyNames:names(row.history_names),...(viewer.admin?{email:row.email,status:row.status,envAdmin}:{})};}
const average=(scores:number[])=>scores.length?scores.reduce((n,s)=>n+s,0)/scores.length:null;

export async function profileData(db:D1Database,id:string,viewer:Member,adminEmail:(email:string)=>boolean=()=>false){
 const row:any=await db.prepare('SELECT * FROM profiles WHERE user=?').bind(id).first();
 if(!row||(row.status!=='active'&&!viewer.admin))throw Error('Medlemmen finns inte.');
 const own=id===viewer.id;
 const joined=(await db.prepare('SELECT t.id,t.title,t.date,t.status,t.owner,t.data FROM tastings t JOIN members m ON m.session=t.id WHERE m.user=? ORDER BY t.date DESC').bind(id).all()).results as any[];
 const tastings=[];
 for(const t of joined.filter(t=>t.status==='revealed')){
  const votes=(await db.prepare('SELECT user,sample,data FROM ratings WHERE session=?').bind(t.id).all()).results.map((v:any)=>({...v,...JSON.parse(v.data)}));
  const samples=JSON.parse(t.data).samples.map((p:any)=>{const mine=votes.find((v:any)=>v.sample===p.id&&v.user===id);return {id:p.id,number:p.number,name:p.name,type:p.type,serving:p.serving,article:p.article||'',productUrl:p.productUrl||'',price:p.price??null,volume:p.volume??null,image:p.image||'',...drinkCategory({...p,session:t.title,sessionId:t.id}),score:mine?.score??null,skip:!!mine?.skip,comment:mine?.comment||'',rated:!!mine,average:average(votes.filter((v:any)=>v.sample===p.id&&v.score!=null).map((v:any)=>v.score))};});
  tastings.push({id:t.id,title:t.title,date:t.date,source:'app',host:t.owner===id,samples});
 }
 const aliases=names(row.history_names);
 if(aliases.length){
  for(const h of (await db.prepare('SELECT data FROM historical').all()).results.map((r:any)=>JSON.parse(r.data))){
   const samples=h.samples.map((p:any)=>{const mine=(p.ratings||[]).find((v:any)=>aliases.includes(v.name));return mine&&{id:p.id,number:p.number,name:p.name,type:p.type,serving:p.serving,article:p.article||'',productUrl:p.productUrl||'',price:p.price??null,volume:p.volume??null,image:p.image||'',...drinkCategory({...p,session:h.title,sessionId:h.id}),score:mine.score??null,skip:!!mine.skip,comment:mine.comment||'',rated:true,average:p.average??null};}).filter(Boolean);
   if(samples.length)tastings.push({id:h.id,title:h.title,date:h.date||'',source:'archive',host:false,samples});
  }
 }
 tastings.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 const rated=tastings.flatMap(t=>t.samples.filter((p:any)=>p.rated&&p.score!=null).map((p:any)=>({...p,session:t.title})));
 const favorites=[...rated].sort((a:any,b:any)=>b.score-a.score).slice(0,5);
 return {
  // The Swish number is only shown to its owner here; participants get it through their tasting.
  profile:{...card(row,viewer,adminEmail(row.email)),own,...(own?{swish:row.swish||''}:{})},
  stats:{tastings:tastings.length,ratings:rated.length,average:average(rated.map((p:any)=>p.score)),hosted:joined.filter(t=>t.owner===id).length},
  favorites,
  tastings,
  upcoming:own?joined.filter(t=>t.status!=='revealed').map(t=>({id:t.id,title:t.title,date:t.date,status:t.status})):[],
 };
}

// Avatars are resized in the browser; the server only accepts small JPEG/PNG/WebP images.
const magic:Record<string,number[]>={'image/jpeg':[0xff,0xd8,0xff],'image/png':[0x89,0x50,0x4e,0x47],'image/webp':[0x52,0x49,0x46,0x46]};
export const MAX_AVATAR_BYTES=300_000;
export function parseAvatar(dataUrl:any){
 const m=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl||''));if(!m)throw Error('Bilden måste vara JPEG, PNG eller WebP.');
 let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0));}catch{throw Error('Bilden kunde inte läsas.');}
 if(bytes.length>MAX_AVATAR_BYTES)throw Error('Bilden är för stor.');
 if(!magic[m[1]].every((b,i)=>bytes[i]===b)||(m[1]==='image/webp'&&String.fromCharCode(...bytes.slice(8,12))!=='WEBP'))throw Error('Filen är inte en giltig bild.');
 return {mime:m[1],data:m[2],bytes};
}
