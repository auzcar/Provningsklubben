'use client';
import {useEffect,useState} from 'react';
import {Trophy,Frown,Flame,PiggyBank,Users,Heart,Gavel,Sparkles,Star,Coins,MessageSquareQuote} from 'lucide-react';
import {api} from '@/lib/client-api';
import {categoryOrder} from '@/lib/drink-categories';
import SbLink from './sb-link';
import {priceEffect,holm,globalPriceEffect,type PricedDrink,type PriceEffect} from '@/lib/stats-math';

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
 // Is expensive better? Compared within each tasting, see lib/stats-math.ts.
 const pricedRows:PricedDrink[]=drinks.filter((d:any)=>d.avg!=null).map((d:any)=>({group:d.sessionId,price:d.price,volume:d.volume,avg:d.avg,category:d.category}));
 const overall=priceEffect(pricedRows,5000);
 // Global comparison: price standardised within each type (beer and wine split by style).
 const typeOf=(d:any)=>(d.category==='Öl'||d.category==='Vin')&&d.subcategory?d.subcategory:d.category;
 const global=globalPriceEffect(drinks.filter((d:any)=>d.avg!=null).map((d:any)=>({session:d.sessionId,type:typeOf(d),price:d.price,volume:d.volume,avg:d.avg})));
 const catEffects=byCat.map(c=>({c:c.c,e:priceEffect(pricedRows.filter(r=>r.category===c.c))})).filter(x=>x.e&&x.e.df>=4) as {c:string;e:PriceEffect}[];
 const holmP=holm(catEffects.map(x=>x.e.p));
 const span=Math.min(4,Math.max(1,...catEffects.flatMap(x=>[Math.abs(x.e.low),Math.abs(x.e.high)])));
 const pos=(v:number)=>`${Math.max(0,Math.min(100,50+v/span*50))}%`;
 const pf=(p:number)=>p<0.001?'< 0,001':fmt(p,3);
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

   <section className="stat-card"><h2><Trophy size={20}/>Hall of fame</h2><ol className="fact-list">{top.map((d:any)=><li key={d.id}><span><b>{d.name} <SbLink drink={d}/></b><small>{d.session}</small></span><em>{fmt(d.avg)}</em></li>)}</ol></section>
   <section className="stat-card"><h2><Frown size={20}/>Sorgebarnen</h2><ol className="fact-list">{bottom.map((d:any)=><li key={d.id}><span><b>{d.name} <SbLink drink={d}/></b><small>{d.session}</small></span><em>{fmt(d.avg)}</em></li>)}</ol></section>
   <section className="stat-card"><h2><Flame size={20}/>Mest omstridda</h2><ol className="fact-list">{contested.map((d:any)=><li key={d.id}><span><b>{d.name} <SbLink drink={d}/></b><small>Från {fmt(Math.min(...d.scores))} till {fmt(Math.max(...d.scores))}</small></span><em>{fmt(d.spread)}</em></li>)}</ol></section>
   <section className="stat-card"><h2><PiggyBank size={20}/>Fynden</h2><p className="muted">Flest poäng per hundralapp, flaskor från 50 kr.</p><ol className="fact-list">{bargains.map((d:any)=><li key={d.id}><span><b>{d.name} <SbLink drink={d}/></b><small>{kr(d.price)} · snitt {fmt(d.avg)}</small></span><em>{fmt(d.value,2)}<small> p/100 kr</small></em></li>)}</ol></section>

   <section className="stat-card wide"><h2><Coins size={20}/>Är dyrare godare?</h2>
    {!overall?<p className="big-claim">För lite prisdata ännu.</p>:<>
    <p className="big-claim">{overall.p<0.05?(overall.slope>0?'Ja, lite grann.':'Tvärtom!'):'Inte så att det går att säga säkert.'} När ni jämför drycker i samma provning ger en dubbelt så dyr flaska i snitt <b>{overall.slope>=0?'+':''}{fmt(overall.slope,2)} poäng</b>.</p>
    <div className="effect-facts">
     <div><b>{fmt(overall.low,2)} till {fmt(overall.high,2)}</b><span>95 % konfidensintervall</span></div>
     <div><b>p = {pf(overall.p)}</b><span>t-test{overall.permP!=null?`, permutation p = ${pf(overall.permP)}`:''}</span></div>
     <div><b>r = {fmt(overall.r,2)}</b><span>partiell korrelation</span></div>
     <div><b>{overall.n} drycker</b><span>i {overall.groups} provningar</span></div>
    </div>
    {global&&<div className="global-effect"><h3 className="effect-title">Globalt, inom dryckestyp</h3>
     <p>Över alla {global.clusters} provningar: en flaska som är <b>en standardavvikelse dyrare än normalt för sin typ</b> får i snitt <b>{global.slope>=0?'+':''}{fmt(global.slope,2)} poäng</b> (95 % KI {fmt(global.low,2)} till {fmt(global.high,2)}, p = {pf(global.p)}). {global.p<0.05?'Det håller även över alla kvällar.':'Över alla kvällar är sambandet för osäkert för en säker slutsats.'}</p>
     <p className="muted fine">{global.n} drycker i {global.types} typer, klustrade standardfel per provning. Lager och IPA, rött och vitt vin och så vidare räknas som egna typer.</p>
    </div>}
    {catEffects.length>0&&<><h3 className="effect-title">Per kategori</h3><p className="muted fine">Poäng per dubblat pris med 95 % konfidensintervall. Strecket i mitten är noll, alltså inget samband.</p>
    <div className="forest" role="table" aria-label="Effekt av dubblat pris per kategori">{catEffects.map((x,i)=><div className="forest-row" role="row" key={x.c} title={`${x.c}: ${fmt(x.e.slope,2)} poäng per dubblat pris (95 % KI ${fmt(x.e.low,2)} till ${fmt(x.e.high,2)}), p = ${pf(x.e.p)}, Holm-justerat p = ${pf(holmP[i])}, ${x.e.n} drycker`}>
     <span role="cell" className="forest-label">{x.c}<small>{x.e.n} drycker</small></span>
     <span role="cell" className="forest-track"><span className="forest-zero"/><span className="forest-ci" style={{left:pos(x.e.low),right:`calc(100% - ${pos(x.e.high)})`}}/><span className={'forest-dot'+(holmP[i]<0.05?' sig':'')} style={{left:pos(x.e.slope)}}/></span>
     <span role="cell" className="forest-num">{x.e.slope>=0?'+':''}{fmt(x.e.slope,2)}<small>justerat p = {pf(holmP[i])}</small></span>
    </div>)}</div>
    <div className="forest-axis"><span>−{fmt(span,1)}</span><span>0</span><span>+{fmt(span,1)}</span></div></>}
    <details className="method"><summary>Hur räknar vi?</summary>
     <p>Priserna skiljer sig enormt mellan dryckestyper, så en cognac kan inte jämföras med en öl. Därför jämförs varje dryck bara med de andra dryckerna i samma provning: samma kväll, samma jury och nästan alltid samma typ. Det tar också bort skillnader i hur generösa olika kvällar var.</p>
     <p>Priset räknas per liter när volymen är känd och på en logaritmisk skala, så att ett steg alltid betyder att priset fördubblas. Pris och snittbetyg centreras inom varje provning, och betyget regresseras på priset (en så kallad fixed effects-modell). Samma flaska serverad på två sätt, till exempel ren och i G&amp;T, finns med en gång per servering.</p>
     <p>p-värdet kommer från ett t-test och kontrolleras med ett permutationstest där priserna blandas slumpvis inom varje provning, utan antagande om normalfördelning. Kategorierna testas var för sig, och deras p-värden är Holm-justerade för att flera test görs samtidigt. Ifylld prick betyder p &lt; 0,05 efter justering. Den globala jämförelsen standardiserar i stället priset inom varje dryckestyp (z-värde av log-literpris; saknad volym ersätts med typens medianvolym) och jämför betyget med typens snitt, så att alla provningar kan vägas samman. Eftersom drycker från samma kväll delar jury och humör är de inte oberoende, därför används klusterrobusta standardfel per provning (t-fördelning med antal provningar minus ett frihetsgrader). Typer med färre än fem prissatta drycker räknas inte. Drycker utan pris eller betyg och provningar med bara en prissatt dryck räknas inte.</p>
    </details></>}
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
