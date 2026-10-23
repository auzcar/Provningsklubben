'use client';
import {useState} from 'react';
import {Trophy,ChevronRight} from 'lucide-react';
import {categoryOrder} from '@/lib/drink-categories';
import {productImage} from '@/lib/model';
import SbLink from './sb-link';

const fmt=(n:number)=>n.toLocaleString('sv-SE',{maximumFractionDigits:1});
// Home page: the club's best-rated drinks of all time, by the group's average.
// Needs at least two scores so a single enthusiast doesn't top the list.
export default function HomeToplist({rows,openSession}:{rows:any[];openSession:(id:string)=>void}){
 const [cat,setCat]=useState('');
 const scored=rows.map(p=>{const s=(p.ratings||[]).filter((v:any)=>v.score!=null&&!v.skip).map((v:any)=>v.score as number);return {...p,n:s.length,avg:s.length?s.reduce((a:number,b:number)=>a+b,0)/s.length:null};}).filter(p=>p.n>=2&&p.name&&p.avg!=null);
 const cats=categoryOrder.filter(c=>scored.filter(p=>p.category===c).length>=3).slice(0,6);
 const top=scored.filter(p=>!cat||p.category===cat).sort((a,b)=>b.avg-a.avg||b.n-a.n).slice(0,5);
 if(!top.length)return null;
 return <section className="home-toplist"><div className="section-head"><div><div className="eyebrow">GENOM TIDERNA</div><h2>Topplistan</h2></div></div>
  <div className="chip-row" role="group" aria-label="Dryckesgrupp"><button className={'chip'+(!cat?' on':'')} onClick={()=>setCat('')}>Alla</button>{cats.map(c=><button key={c} className={'chip'+(cat===c?' on':'')} onClick={()=>setCat(c)}>{c}</button>)}</div>
  <ol className="toplist">{top.map((p,i)=><li key={p.sessionId+p.id}>
   <span className={'toplist-rank r'+(i+1)}>{i===0?<Trophy size={18}/>:i+1}</span>
   {p.image?<img src={productImage(p.image)} alt="" onError={e=>{e.currentTarget.style.display='none';}}/>:<span className="toplist-noimg"/>}
   <button className="toplist-main" onClick={()=>openSession(p.sessionId)}><b>{p.name}</b><small>{[...new Set([p.subcategory||p.category,p.session].filter(Boolean))].join(' · ')}</small></button>
   <SbLink drink={p}/>
   <span className="toplist-score">{fmt(p.avg)}<small>{p.n} betyg</small></span>
   <ChevronRight size={16} className="toplist-go" aria-hidden="true"/>
  </li>)}</ol>
 </section>;
}
