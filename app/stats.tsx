'use client';
import {useEffect,useState} from 'react';
import {Trophy,Frown,Flame,PiggyBank,Users,Heart,Gavel,Sparkles,Star,Coins,MessageSquareQuote} from 'lucide-react';
import {api} from '@/lib/client-api';
import {categoryOrder} from '@/lib/drink-categories';

const fmt=(n:any,d=1)=>n==null||!Number.isFinite(n)?'–':Number(n).toLocaleString('sv-SE',{minimumFractionDigits:d,maximumFractionDigits:d});
const kr=(n:number)=>Math.round(n).toLocaleString('sv-SE')+' kr';
const mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const STOP=new Set('och att det som en är på för med av till den har inte men lite mer mycket så från var om kan ett jag du vi de ingen sig smakar smak luktar eftersmak typ än bra nästan'.split(' '));

// Fun facts computed from the whole archive: imported history plus revealed tastings.
export default function Stats({archive}:{archive:any}){
 const [aliases,setAliases]=useState<Record<string,string>>({});
 // Archive names linked to a member (Seb, Sebbe, Sebastian…) count as one person.
 useEffect(()=>{api('/api/members').then(d=>{const m:Record<string,string>={};for(const p of d.members){m[p.name]=p.name;for(const n of p.historyNames||[])m[n]=p.name;}setAliases(m);}).catch(()=>{});},[]);
 if(!archive)return <div className="loading">Räknar…</div>;
 const who=(n:string)=>aliases[n]||n;
 const drinks=archive.sessions.flatMap((s:any)=>s.samples.map((p:any)=>{
  const ratings=(p.ratings||[]).map((v:any)=>({...v,name:who(v.name)}));const scores=ratings.filter((v:any)=>v.score!=null&&!v.skip).map((v:any)=>v.score as number);
  return {...p,session:s.title,sessionId:s.id,ratings,scores,avg:mean(scores),spread:scores.length>1?Math.max(...scores)-Math.min(...scores):null};
 }));
 const rated=drinks.filter((d:any)=>d.scores.length>=2&&d.name);
 const allScores=drinks.flatMap((d:any)=>d.scores);
 const priced=drinks.filter((d:any)=>d.price>0);
 const byCat=categoryOrder.map(c=>{const ds=drinks.filter((d:any)=>d.category===c);return {c,count:ds.length,avg:mean(ds.flatMap((d:any)=>d.scores))};}).filter(x=>x.count>0).sort((a,b)=>b.count-a.count);
 const top=[...rated].sort((a,b)=>b.avg-a.avg).slice(0,5);const bottom=[...rated].sort((a,b)=>a.avg-b.avg).slice(0,3);
 const contested=[...rated].sort((a,b)=>b.spread-a.spread).slice(0,3);
 const bargains=priced.filter((d:any)=>d.price>=50&&d.avg!=null&&d.scores.length>=2).map((d:any)=>({...d,value:d.avg/d.price*100})).sort((a:any,b:any)=>b.value-a.value).slice(0,3);
 // Is expensive better? Pearson correlation between price and average score.
 const pairs=priced.filter((d:any)=>d.avg!=null).map((d:any)=>[d.price,d.avg]);
 const corr=(()=>{if(pairs.length<5)return null;const mx=mean(pairs.map((p:any)=>p[0]))!,my=mean(pairs.map((p:any)=>p[1]))!;let sxy=0,sxx=0,syy=0;for(const [x,y] of pairs){sxy+=(x-mx)*(y-my);sxx+=(x-mx)**2;syy+=(y-my)**2;}return sxx&&syy?sxy/Math.sqrt(sxx*syy):null;})();
 const buckets=[['Under 100 kr',0,100],['100–299 kr',100,300],['300–499 kr',300,500],['500 kr och uppåt',500,Infinity]].map(([label,lo,hi]:any)=>{const ds=priced.filter((d:any)=>d.price>=lo&&d.price<hi&&d.avg!=null);return {label,count:ds.length,avg:mean(ds.map((d:any)=>d.avg))};}).filter(b=>b.count>0);
 const names=[...new Set<string>(drinks.flatMap((d:any)=>d.ratings.map((v:any)=>v.name)))];
 const people=names.map(n=>{
  const mine:{score:number;cat:string;sessionId:string}[]=drinks.flatMap((d:any)=>d.ratings.filter((v:any)=>v.name===n&&v.score!=null&&!v.skip).map((v:any)=>({score:v.score,cat:d.category,sessionId:d.sessionId})));
  const cats=categoryOrder.map(c=>({c,avg:mean(mine.filter(m=>m.cat===c).map(m=>m.score)),n:mine.filter(m=>m.cat===c).length})).filter(x=>x.n>=6).sort((a,b)=>b.avg!-a.avg!);
  return {name:n,count:mine.length,evenings:new Set(mine.map(m=>m.sessionId)).size,avg:mean(mine.map(m=>m.score)),max:mine.length?Math.max(...mine.map(m=>m.score)):null,tens:mine.filter(m=>m.score>=10).length,fav:cats[0]?.c};
 }).filter(p=>p.count>=5).sort((a,b)=>b.count-a.count);
 // Awards only count regulars, so a one-off guest does not top the jury.
 const regulars=people.filter(p=>p.count>=20);
 const jury=[...regulars].sort((a,b)=>b.avg!-a.avg!);
 // Taste twins: the regulars whose scores on the same drinks differ least (at least 15 shared).
 const twins:any[]=[];
 for(let i=0;i<regulars.length;i++)for(let j=i+1;j<regulars.length;j++){const a=regulars[i].name,b=regulars[j].name;const diffs=drinks.map((d:any)=>{const x=d.ratings.find((v:any)=>v.name===a&&v.score!=null),y=d.ratings.find((v:any)=>v.name===b&&v.score!=null);return x&&y?Math.abs(x.score-y.score):null;}).filter((x:any)=>x!=null) as number[];if(diffs.length>=15)twins.push({a,b,diff:mean(diffs),n:diffs.length});}
 twins.sort((x,y)=>x.diff-y.diff);
 const nameWords=new Set([...names,...Object.keys(aliases)].flatMap(n=>n.toLocaleLowerCase('sv').split(/\s+/)));
 const words:Record<string,number>={};for(const d of drinks)for(const t of [d.comment,...d.ratings.map((v:any)=>v.comment)])for(const w of String(t||'').toLocaleLowerCase('sv').match(/[a-zåäöé]{4,}/g)||[])if(!STOP.has(w)&&!nameWords.has(w))words[w]=(words[w]||0)+1;
 const topWords=Object.entries(words).sort((a,b)=>b[1]-a[1]).slice(0,10);
 const spent=priced.reduce((n:number,d:any)=>n+d.price,0);
 const maxCat=Math.max(...byCat.map(c=>c.count));

 return <div className="stats-page">
  <div className="eyebrow">KLUBBEN I SIFFROR</div><h1>Statistik & fun facts</h1><p className="intro">Allt från arkivet och era avslöjade provningar. Smeknamn som är kopplade till en medlem räknas som samma person.</p>
  <section className="stat-tiles">
   <div><b>{archive.sessions.length}</b><span>provningar</span></div>
   <div><b>{drinks.length}</b><span>drycker & serveringar</span></div>
   <div><b>{allScores.length}</b><span>betyg</span></div>
   <div><b>{fmt(mean(allScores))}</b><span>klubbens snittbetyg</span></div>
   <div><b>{kr(spent)}</b><span>i kända flaskpriser</span></div>
   <div><b>{names.length}</b><span>personer har satt betyg</span></div>
  </section>

  <div className="stats-grid">
   <section className="stat-card wide"><h2>Vad dricker vi?</h2><p className="muted">Antal drycker per kategori och kategorins snittbetyg.</p>
    <div className="bar-chart" role="table" aria-label="Drycker per kategori">{byCat.map(c=><div className="bar-row" role="row" key={c.c} title={`${c.c}: ${c.count} drycker, snittbetyg ${fmt(c.avg)}`}><span role="cell" className="bar-label">{c.c}</span><span role="cell" className="bar-track"><span className="bar" style={{width:`${c.count/maxCat*100}%`}}/></span><span role="cell" className="bar-value">{c.count}</span><span role="cell" className="bar-avg">{fmt(c.avg)}</span></div>)}</div>
   </section>

   <section className="stat-card"><h2><Trophy size={20}/>Hall of fame</h2><ol className="fact-list">{top.map((d:any)=><li key={d.id}><span><b>{d.name}</b><small>{d.session}</small></span><em>{fmt(d.avg)}</em></li>)}</ol></section>
   <section className="stat-card"><h2><Frown size={20}/>Sorgebarnen</h2><ol className="fact-list">{bottom.map((d:any)=><li key={d.id}><span><b>{d.name}</b><small>{d.session}</small></span><em>{fmt(d.avg)}</em></li>)}</ol></section>
   <section className="stat-card"><h2><Flame size={20}/>Mest omstridda</h2><ol className="fact-list">{contested.map((d:any)=><li key={d.id}><span><b>{d.name}</b><small>Från {fmt(Math.min(...d.scores))} till {fmt(Math.max(...d.scores))}</small></span><em>{fmt(d.spread)}</em></li>)}</ol></section>
   <section className="stat-card"><h2><PiggyBank size={20}/>Fynden</h2><p className="muted">Flest poäng per hundralapp, flaskor från 50 kr.</p><ol className="fact-list">{bargains.map((d:any)=><li key={d.id}><span><b>{d.name}</b><small>{kr(d.price)} · snitt {fmt(d.avg)}</small></span><em>{fmt(d.value,2)}<small> p/100 kr</small></em></li>)}</ol></section>

   <section className="stat-card wide"><h2><Coins size={20}/>Är dyrare godare?</h2>
    <p className="big-claim">{corr==null?'För lite prisdata ännu.':Math.abs(corr)<0.15?<>Nej, knappt alls. Sambandet mellan pris och betyg är <b>{fmt(corr,2)}</b>.</>:corr>0?<>Lite grann. Sambandet mellan pris och betyg är <b>{fmt(corr,2)}</b>.</>:<>Tvärtom! Sambandet mellan pris och betyg är <b>{fmt(corr,2)}</b>.</>}</p>
    <div className="bar-chart" role="table" aria-label="Snittbetyg per prisklass">{buckets.map(b=><div className="bar-row" role="row" key={b.label} title={`${b.label}: snittbetyg ${fmt(b.avg)} (${b.count} drycker)`}><span role="cell" className="bar-label">{b.label}</span><span role="cell" className="bar-track"><span className="bar" style={{width:`${(b.avg||0)*10}%`}}/></span><span role="cell" className="bar-value">{fmt(b.avg)}</span><span role="cell" className="bar-avg">{b.count} st</span></div>)}</div>
    <p className="muted fine">Snittbetyg per prisklass. Sambandet går från −1 till 1, där 0 betyder att priset inte säger något om betyget.</p>
   </section>

   <section className="stat-card wide"><h2><Users size={20}/>Juryn</h2>
    <div className="table-scroll"><table className="jury"><thead><tr><th>Namn</th><th>Kvällar</th><th>Betyg</th><th>Snitt</th><th>Högsta</th><th>Favoritkategori</th></tr></thead><tbody>{people.map(p=><tr key={p.name}><td>{p.name}</td><td>{p.evenings}</td><td>{p.count}</td><td>{fmt(p.avg)}</td><td>{fmt(p.max)}{p.tens>0?` (${p.tens}×10)`:''}</td><td>{p.fav||'–'}</td></tr>)}</tbody></table></div>
   </section>
   {jury.length>1&&<section className="stat-card"><h2><Heart size={20}/>Snällast</h2><p className="big-claim"><b>{jury[0].name}</b> ger i snitt {fmt(jury[0].avg)}.</p><h2><Gavel size={20}/>Strängast</h2><p className="big-claim"><b>{jury[jury.length-1].name}</b> ger i snitt {fmt(jury[jury.length-1].avg)}.</p></section>}
   {twins.length>0&&<section className="stat-card"><h2><Sparkles size={20}/>Smaktvillingar</h2><p className="big-claim"><b>{twins[0].a}</b> och <b>{twins[0].b}</b> skiljer bara {fmt(twins[0].diff)} poäng i snitt på {twins[0].n} drycker.</p><h2><Star size={20}/>Motpoler</h2><p className="big-claim"><b>{twins[twins.length-1].a}</b> och <b>{twins[twins.length-1].b}</b> skiljer {fmt(twins[twins.length-1].diff)} poäng i snitt.</p></section>}
   {topWords.length>0&&<section className="stat-card"><h2><MessageSquareQuote size={20}/>Klubbens ordförråd</h2><p className="muted">Vanligaste orden i era smakanteckningar.</p><div className="word-cloud">{topWords.map(([w,n],i)=><span key={w} style={{fontSize:`${22-i*1.2}px`}} title={`${n} gånger`}>{w}</span>)}</div></section>}
  </div>
 </div>;
}
