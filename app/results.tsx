'use client';
import {Trophy,Flame,Handshake,PiggyBank,Target,Heart,Gavel,Sparkles,ArrowUpRight} from 'lucide-react';
import {productImage,systembolagetUrl} from '@/lib/model';

const fmt=(n:any,d=1)=>n==null?'–':Number(n).toLocaleString('sv-SE',{minimumFractionDigits:d,maximumFractionDigits:d});
const kr=(n:any)=>n==null?'–':Math.round(n).toLocaleString('sv-SE')+' kr';
const mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;

// The reveal: a podium and a handful of awards meant to start conversations.
export default function Results({current}:{current:any}){
 const rows=current.plan.samples.map((s:any)=>{
  const ratings=current.results.filter((v:any)=>v.sample===s.id);
  const scores=ratings.filter((v:any)=>v.score!=null).map((v:any)=>v.score as number);
  const tags:Record<string,number>={};for(const v of ratings)for(const t of v.tags||[])tags[t]=(tags[t]||0)+1;
  const guesses=ratings.filter((v:any)=>v.guess!=null).map((v:any)=>v.guess as number);
  return {...s,ratings,scores,average:mean(scores),spread:scores.length>1?Math.max(...scores)-Math.min(...scores):null,tags:Object.entries(tags).sort((a,b)=>b[1]-a[1]),guessAvg:mean(guesses)};
 }).sort((a:any,b:any)=>(b.average??-1)-(a.average??-1));
 const scored=rows.filter((r:any)=>r.average!=null);
 const contested=scored.filter((r:any)=>r.spread!=null).sort((a:any,b:any)=>b.spread-a.spread);
 const bargain=scored.filter((r:any)=>r.price>0).map((r:any)=>({...r,value:r.average/r.price*100})).sort((a:any,b:any)=>b.value-a.value)[0];
 const people=[...new Set<string>(current.results.map((v:any)=>v.name))].map(name=>{
  const mine=current.results.filter((v:any)=>v.name===name);
  const given=mine.filter((v:any)=>v.score!=null).map((v:any)=>v.score);
  const errors=mine.map((v:any)=>{const s=rows.find((r:any)=>r.id===v.sample);return v.guess!=null&&s?.price>0?Math.abs(v.guess-s.price)/s.price:null;}).filter((x:any)=>x!=null);
  return {name,avg:mean(given),count:given.length,guessError:mean(errors as number[]),guesses:errors.length};
 });
 const raters=people.filter(p=>p.count>=2).sort((a,b)=>b.avg!-a.avg!);
 const guesser=people.filter(p=>p.guesses>0).sort((a,b)=>a.guessError!-b.guessError!)[0];
 const topTag=rows.flatMap((r:any)=>r.tags.map(([t,n]:any)=>({t,n,r}))).sort((a:any,b:any)=>b.n-a.n)[0];
 const awards=[
  contested[0]&&{icon:Flame,title:'Mest omstridd',who:contested[0].name,text:`${fmt(contested[0].spread)} poäng mellan högsta och lägsta betyg. Vem hade rätt?`},
  contested.length>1&&{icon:Handshake,title:'Mest överens',who:contested[contested.length-1].name,text:`Bara ${fmt(contested[contested.length-1].spread)} poäng skilde.`},
  bargain&&{icon:PiggyBank,title:'Kvällens fynd',who:bargain.name,text:`${fmt(bargain.value,2)} poäng per hundralapp (${kr(bargain.price)}).`},
  guesser&&{icon:Target,title:'Bästa prisgissaren',who:guesser.name,text:`I snitt ${Math.round(guesser.guessError!*100)} % från rätt pris.`},
  raters.length>1&&{icon:Heart,title:'Snällast i juryn',who:raters[0].name,text:`Gav i snitt ${fmt(raters[0].avg)}.`},
  raters.length>1&&{icon:Gavel,title:'Strängast i juryn',who:raters[raters.length-1].name,text:`Gav i snitt ${fmt(raters[raters.length-1].avg)}.`},
  topTag&&{icon:Sparkles,title:'Kvällens ord',who:`”${topTag.t}”`,text:`${topTag.n} av er tyckte så om ${topTag.r.name}.`},
 ].filter(Boolean) as any[];
 const podium=[scored[1],scored[0],scored[2]].map((r,i)=>r&&{...r,place:[2,1,3][i]});

 return <div className="results">
  <div className="results-intro"><div className="eyebrow">NU VET VI VAD SOM FANNS I GLASEN</div><h2>Kvällens resultat</h2><p>Betygen är låsta. Dags att diskutera.</p></div>
  {scored.length>0&&<section className="podium" aria-label="Prispall">{podium.map((r:any)=>r&&<div key={r.id} className={'podium-step p'+r.place}>
   {r.image?<img src={productImage(r.image)} alt="" onError={e=>{e.currentTarget.style.display='none';}}/>:<Trophy size={r.place===1?34:26}/>}
   <strong>{r.name}</strong><span className="podium-score">{fmt(r.average)}</span>
   <div className="podium-block"><b>{r.place}</b><small>Prov {r.number}</small></div>
  </div>)}</section>}
  {awards.length>0&&<section className="awards"><h3>Kvällens utmärkelser</h3><div className="award-grid">{awards.map(a=><article className="award" key={a.title}><a.icon size={20}/><div><span>{a.title}</span><strong>{a.who}</strong><p>{a.text}</p></div></article>)}</div></section>}
  <section className="result-list">{rows.map((p:any,i:number)=><article className="result-card" key={p.id}>
   <div className="row between result-head"><div className="row"><span className="rank">{i+1}</span><div><small>PROV {p.number}</small><h3>{p.name}</h3><p>{[p.type,p.price!=null?kr(p.price):'Pris saknas'].filter(Boolean).join(' · ')}</p></div></div><strong className="result-score">{fmt(p.average)}<small>/ 10</small></strong></div>
   {(p.tags.length>0||p.guessAvg!=null)&&<div className="result-extras">{p.tags.slice(0,4).map(([t,n]:any)=><span className="tag-count" key={t}>{t} <b>{n}</b></span>)}{p.guessAvg!=null&&<span className="guess-line">Ni gissade i snitt {kr(p.guessAvg)}{p.price!=null?`, rätt pris ${kr(p.price)}`:''}</span>}</div>}
   <div className="ratings-grid">{p.ratings.map((v:any,j:number)=><div className="person-score" key={j}><span>{v.name}</span><strong>{v.skip?'Avstår':fmt(v.score)}</strong>{v.comment&&<p>{v.comment}</p>}</div>)}</div>
   {systembolagetUrl(p)&&<a className="text-button" href={systembolagetUrl(p)} target="_blank" rel="noreferrer">{p.productUrl?'Visa på Systembolaget':'Sök på Systembolaget'} <ArrowUpRight size={14}/></a>}
  </article>)}</section>
 </div>;
}
