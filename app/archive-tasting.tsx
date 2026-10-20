'use client';
import {useState} from 'react';
import {ArrowLeft,Trophy,ChevronDown} from 'lucide-react';
import {productImage} from '@/lib/model';
import SbLink from './sb-link';

const fmt=(n:any,d=1)=>n==null?'–':Number(n).toLocaleString('sv-SE',{maximumFractionDigits:d});
const kr=(n:any)=>n==null?null:Math.round(n).toLocaleString('sv-SE')+' kr';
const avg=(p:any)=>{const s=(p.ratings||[]).filter((v:any)=>v.score!=null&&!v.skip).map((v:any)=>v.score as number);return s.length?s.reduce((a:number,b:number)=>a+b,0)/s.length:p.average??null;};
export const ranked=(s:any)=>s.samples.map((p:any)=>({...p,avg:avg(p)})).sort((a:any,b:any)=>(b.avg??-1)-(a.avg??-1));

// A past tasting from the archive, read-only: the drinks ranked by the group's average,
// with everyone's scores and comments.
export default function ArchiveTasting({s,onBack}:{s:any;onBack:()=>void}){
 const rows=ranked(s);const [open,setOpen]=useState<string>('');
 const people=new Set(rows.flatMap((p:any)=>(p.ratings||[]).map((v:any)=>v.name))).size;
 return <>
  <button className="text-button back" onClick={onBack}><ArrowLeft size={16}/>Till provningar</button>
  <div><span className="badge revealed">Avslöjad</span></div><h1>{s.title}</h1>
  <p className="intro">{[s.date||'Datum saknas',`${rows.length} drycker`,people?`${people} provare`:'',s.source?'Ur arkivet':''].filter(Boolean).join(' · ')}</p>
  <section className="result-list">{rows.map((p:any,i:number)=><article className="result-card" key={p.id}>
   <button className="row between result-head archive-head" aria-expanded={open===p.id} onClick={()=>setOpen(open===p.id?'':p.id)}>
    <div className="row"><span className="rank">{i===0&&p.avg!=null?<Trophy size={18}/>:i+1}</span>{p.image&&<img className="archive-thumb" src={productImage(p.image)} alt="" onError={e=>{e.currentTarget.style.display='none';}}/>}<div><h3>{p.name||'Namn saknas'} <SbLink drink={p}/></h3><p>{[p.subcategory||p.type||p.category,kr(p.price),p.serving].filter(Boolean).join(' · ')}</p></div></div>
    <strong className="result-score">{fmt(p.avg)}<small>/ 10</small><ChevronDown size={16} className={open===p.id?'flip':''}/></strong>
   </button>
   {open===p.id&&<div className="ratings-grid">{(p.ratings||[]).map((v:any,j:number)=><div className="person-score" key={j}><span>{v.name}</span><strong>{v.skip?'Avstår':fmt(v.score)}</strong>{v.comment&&<p>{v.comment}</p>}</div>)}{!(p.ratings||[]).length&&<p className="muted">Inga enskilda betyg sparade.</p>}</div>}
  </article>)}</section>
 </>;
}
