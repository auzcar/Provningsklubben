'use client';
import {Gift,Shuffle,ArrowRight,Dices,Heart,Scale,Pencil} from 'lucide-react';
import {productImage} from '@/lib/model';

// Who takes which bottle home (lib/allocation.ts). The host starts it after the reveal and shows one
// person at a time; everyone else follows. Afterwards the host can swap bottles by hand.
const ordinal=(n:number)=>n===1?'Favoriten':n===2?'Näst bästa':n===3?'Tredje valet':n+':e valet';
export default function BottleShare({current,busy,onAction}:{current:any;busy:boolean;onAction:(action:string,extra?:any)=>void}){
 const a=current.allocation;const host=!!current.host;
 const name=(u:string)=>current.people.find((p:any)=>p.user===u)?.name||'Någon';
 const bottle=(id:string)=>current.plan.samples.find((s:any)=>s.id===id)||{id,name:'Okänd flaska'};
 const why=(i:any)=>{
  if(i.manual)return {icon:Pencil,text:'Ändrad av värden'};
  if(!i.contest)return {icon:Heart,text:ordinal(i.choice)+(i.round>1?', som var kvar':'')};
  const others=i.contest.claimants.filter((u:string)=>u!==i.user).map(name).join(' och ');
  const m=i.contest.margin!=null?i.contest.margin.toLocaleString('sv-SE',{maximumFractionDigits:2}):'';
  return i.contest.rule==='love'?{icon:Heart,text:`${ordinal(i.choice)}. Vann mot ${others}: gav den högst betyg jämfört med sitt eget snitt${m?` (${m} poäng mer)`:''}.`}
   :i.contest.rule==='loss'?{icon:Scale,text:`${ordinal(i.choice)}. Vann mot ${others}: hade mest att förlora på sitt näst bästa val${m?` (${m} poäng)`:''}.`}
   :{icon:Dices,text:`${ordinal(i.choice)}. Lottad mot ${others}, som gillade den precis lika mycket.`};
 };
 const Row=({i}:{i:any})=>{const b=bottle(i.sample);const w=why(i);return <div className="share-row">
  {b.image?<img src={productImage(b.image)} alt="" onError={e=>{e.currentTarget.style.display='none';}}/>:<Gift size={22}/>}
  <div><strong>{name(i.user)}</strong><span>tar hem <b>{b.name}</b> (prov {b.number})</span><small><w.icon size={12}/> {w.text}</small></div>
  {host&&a.done&&<select aria-label={'Byt flaska för '+name(i.user)} value={i.sample} disabled={busy} onChange={e=>onAction('allocate-set',{user:i.user,sample:e.target.value})}>{current.plan.samples.map((s:any)=><option key={s.id} value={s.id}>Prov {s.number}: {s.name}</option>)}</select>}
 </div>;};
 return <section className="bottle-share">
  <div className="eyebrow">VEM TAR HEM VAD?</div>
  <h2>Flaskorna</h2>
  {!a?<>
   <p className="muted">Var och en får i första hand sin favorit enligt betygen. Vill flera ha samma flaska går den till den som gav den högst betyg jämfört med sitt eget snitt, sedan till den som har mest att förlora, och till sist avgör lotten. De andra får sin bästa flaska som är kvar.</p>
   {host?<button className="primary" disabled={busy} onClick={()=>onAction('allocate')}><Gift size={16}/>Fördela flaskorna</button>:<p className="muted">Värden fördelar flaskorna när det är dags.</p>}
  </>:!a.done?<>
   {a.at===0?<p className="share-wait">{host?'Fördelningen är klar. Visa den en person i taget.':'Värden visar strax vem som tar hem vad.'}</p>:<div className="share-latest"><Row i={a.items[a.at-1]}/></div>}
   {a.at>1&&<div className="share-list">{a.items.slice(0,a.at-1).map((i:any)=><Row key={i.user} i={i}/>)}</div>}
   <small className="muted">{a.at} av {a.total} visade</small>
   {host&&<div className="row wrap"><button className="primary" disabled={busy} onClick={()=>onAction('allocate-next')}>Visa nästa <ArrowRight size={16}/></button><button className="text-button" disabled={busy} onClick={()=>onAction('allocate-all')}>Visa alla</button></div>}
  </>:<>
   <div className="share-list">{a.items.map((i:any)=><Row key={i.user} i={i}/>)}</div>
   {a.leftoverSamples.length>0&&<p className="muted">Över: {a.leftoverSamples.map((id:string)=>bottle(id).name).join(', ')}. Ni avgör själva vem som tar dem.</p>}
   {a.leftoverPeople.length>0&&<p className="muted">Flaskorna räckte inte till {a.leftoverPeople.map(name).join(', ')}. Ni avgör själva hur det löses.</p>}
   {host&&<button className="text-button" disabled={busy} onClick={()=>{if(confirm('Göra om hela fördelningen? Lottningar kan falla ut annorlunda, och dina ändringar försvinner.'))onAction('allocate');}}><Shuffle size={14}/>Gör om fördelningen</button>}
  </>}
 </section>;
}
