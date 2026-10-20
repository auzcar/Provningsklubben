'use client';
import {useEffect,useState} from 'react';
import {Trophy,Frown,Flame,PiggyBank,Users,Heart,Gavel,Sparkles,Star,Coins,MessageSquareQuote} from 'lucide-react';
import {api} from '@/lib/client-api';
import {categoryOrder} from '@/lib/drink-categories';
import SbLink from './sb-link';
import {holm,globalPriceEffect,type TypedDrink,type GlobalEffect} from '@/lib/stats-math';

const fmt=(n:any,d=1)=>n==null||!Number.isFinite(n)?'–':Number(n).toLocaleString('sv-SE',{minimumFractionDigits:d,maximumFractionDigits:d});
const kr=(n:number)=>Math.round(n).toLocaleString('sv-SE')+' kr';
const mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const pct=(f:number)=>Math.round((f-1)*100)+' %';
const pf=(p:number)=>p<0.001?'< 0,001':fmt(p,3);
type Effect={slope:number;low:number;high:number;p:number;n:number};
type ForestRow={c:string;sub:string;e:Effect;adj?:number};
// Forest plot: the pooled estimate as a diamond spanning its 95 % CI, then one line per group.
// Intervals wider than the axis end in an arrow.
function Forest({unit,label,total,rows}:{unit:string;label:string;total:ForestRow;rows:ForestRow[]}){
 const all=[total,...rows];const raw=Math.max(...all.flatMap(r=>[Math.abs(r.e.low),Math.abs(r.e.high)]));
 const span=Math.min(4,[0.5,1,1.5,2,3,4].find(v=>v>=raw)??4);
 const at=(v:number)=>Math.max(0,Math.min(100,50+v/span*50));
 const line=(r:ForestRow,isTotal:boolean)=>{const sig=(r.adj??r.e.p)<0.05;return <div className={'forest-row'+(isTotal?' total':'')} role="row" key={r.c} title={`${r.c}: ${fmt(r.e.slope,2)} ${unit} (95 % KI ${fmt(r.e.low,2)} till ${fmt(r.e.high,2)}), p = ${pf(r.e.p)}${r.adj!=null?`, Holm-justerat p = ${pf(r.adj)}`:''}, ${r.e.n} drycker`}>
  <span role="cell" className="forest-label">{r.c}<small>{r.sub}</small></span>
  <span role="cell" className="forest-track"><span className="forest-tick" style={{left:'25%'}}/><span className="forest-tick" style={{left:'75%'}}/><span className="forest-zero"/>
   {isTotal?<span className={'forest-diamond'+(sig?' sig':'')} style={{left:at(r.e.low)+'%',width:at(r.e.high)-at(r.e.low)+'%'}}/>:<>
   <span className={'forest-ci'+(r.e.low<-span?' cut-left':'')+(r.e.high>span?' cut-right':'')} style={{left:at(r.e.low)+'%',width:at(r.e.high)-at(r.e.low)+'%'}}/>
   <span className={'forest-dot'+(sig?' sig':'')} style={{left:at(r.e.slope)+'%',width:6+Math.sqrt(r.e.n)*1.6,height:6+Math.sqrt(r.e.n)*1.6}}/></>}
  </span>
  <span role="cell" className="forest-num">{r.e.slope>=0?'+':''}{fmt(r.e.slope,2)}<small>{r.adj!=null?'justerat ':''}p = {pf(r.adj??r.e.p)}</small></span>
 </div>;};
 return <figure className="forest-figure"><figcaption className="muted fine">{unit[0].toUpperCase()+unit.slice(1)}, med 95 % konfidensintervall. Strecket i mitten är noll, alltså inget samband. Ifylld markör betyder p &lt; 0,05{rows.some(r=>r.adj!=null)?' (per grupp efter Holm-justering)':''}, och större prick betyder fler drycker.</figcaption>
  <div className="forest" role="table" aria-label={label}>{line(total,true)}{rows.map(r=>line(r,false))}</div>
  <div className="forest-axis"><span>−{fmt(span,1)}</span><span>0</span><span>+{fmt(span,1)}</span></div>
  <div className="forest-hint"><span>← lägre betyg</span><span>högre betyg →</span></div>
 </figure>;
}
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
 // Global comparison: price standardised within each type (beer and wine split by style).
 const typeOf=(d:any)=>(d.category==='Öl'||d.category==='Vin')&&d.subcategory?d.subcategory:d.category;
 const typedRows:TypedDrink[]=drinks.filter((d:any)=>d.avg!=null).map((d:any)=>({session:d.sessionId,type:typeOf(d),price:d.price,volume:d.volume,avg:d.avg}));
 const global=globalPriceEffect(typedRows);
 // Per type the same model on one type at a time; types from one or two tastings get ordinary standard errors.
 const typeEffects=[...new Set(typedRows.map(r=>r.type))].map(t=>({c:t,e:globalPriceEffect(typedRows.filter(r=>r.type===t),5,true)})).filter(x=>x.e).sort((a,b)=>b.e!.n-a.e!.n) as {c:string;e:GlobalEffect}[];
 const typeHolm=holm(typeEffects.map(x=>x.e.p));
 // In kronor: one SD step as a price factor, typical across types, with the most tasted type as example.
 const sds=(global?.scales||[]).map(t=>t.sd).sort((a,b)=>a-b);const typical=sds.length?2**sds[sds.length>>1]:1;
 const example=(['Whisky','Rom','Gin','Cognac'].map(t=>typeEffects.find(x=>x.c===t)).find(Boolean)||typeEffects[0])?.e.scales[0];
 const fewTypes=[...new Set(typedRows.map(r=>r.type))].filter(t=>!typeEffects.some(x=>x.c===t)).sort((a,b)=>a.localeCompare(b,'sv'));
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
    {!global?<p className="big-claim">För lite prisdata ännu.</p>:<>
    <p className="big-claim">{global.p<0.05?(global.slope>0?'Ja, lite grann.':'Tvärtom!'):'Inte så att det går att säga säkert.'} En flaska som kostar <b>{pct(typical)} mer än vad som är normalt för sin typ</b> får i snitt <b>{global.slope>=0?'+':''}{fmt(global.slope,2)} poäng</b> jämfört med typens snitt{example&&<>, till exempel en {example.type.toLocaleLowerCase('sv')} för {kr(example.median*2**example.sd)} i stället för {kr(example.median)}</>}.</p>
    <div className="effect-facts">
     <div><b>{fmt(global.low,2)} till {fmt(global.high,2)}</b><span>95 % konfidensintervall</span></div>
     <div><b>p = {pf(global.p)}</b><span>klustrade standardfel per provning</span></div>
     <div><b>r = {fmt(global.r,2)}</b><span>partiell korrelation</span></div>
     <div><b>{global.n} drycker</b><span>i {global.types} typer, {global.clusters} provningar</span></div>
    </div>
    <Forest unit="poäng per standardavvikelse i pris inom typen" label="Effekt av pris inom dryckestyp" total={{c:'Alla typer',sub:`${global.types} typer · ${pct(typical)} dyrare`,e:global}} rows={typeEffects.map((x,i)=>({c:x.c,sub:`${x.e.n} drycker · ${kr(x.e.scales[0].median)} → ${kr(x.e.scales[0].median*2**x.e.scales[0].sd)}`,e:x.e,adj:typeHolm[i]}))}/>
    <p className="muted fine">Under varje typ står vad en standardavvikelse betyder i kronor: från typens medianpris till en flaska som är en standardavvikelse dyrare. Prisskillnaden mellan billigt och dyrt är olika stor i olika typer, därför jämförs varje typ på sin egen skala. {fewTypes.length>0&&`För få prissatta drycker (under fem) för att räknas: ${fewTypes.join(', ')}.`}</p>
    <details className="method"><summary>Hur räknar vi?</summary>
     <p>Priserna skiljer sig enormt mellan dryckestyper, så en cognac kan inte jämföras med en öl i kronor. Därför standardiseras priset inom varje dryckestyp: whisky mot whisky, cognac mot cognac, lager mot lager. Typerna är kategorierna, men öl och vin delas upp per stil (lager, IPA, rött, vitt och så vidare). En dyr lager och en dyr cognac hamnar därmed på samma skala.</p>
     <p>Priset räknas per liter (saknad volym ersätts med typens medianvolym) och på en logaritmisk skala, och görs om till ett z-värde inom typen: hur många standardavvikelser dyrare eller billigare än typens snitt flaskan är. Betyget jämförs med typens snitt, och betyget regresseras på z-värdet.</p>
     <p>Drycker från samma kväll delar jury och humör och är inte oberoende, därför används klusterrobusta standardfel per provning (t-fördelning med antal provningar minus ett frihetsgrader). Typer med färre än fem prissatta drycker räknas inte. En typ som bara provats under en eller två kvällar kan inte klustras och får i diagrammet vanliga standardfel. Typernas p-värden är Holm-justerade för att flera test görs samtidigt; ifylld markör betyder p &lt; 0,05.</p>
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
