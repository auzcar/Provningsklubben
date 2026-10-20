'use client';
import {useEffect,useState} from 'react';
import {Trophy,Frown,Flame,PiggyBank,Users,Heart,Gavel,Sparkles,Star,Coins,MessageSquareQuote} from 'lucide-react';
import {api} from '@/lib/client-api';
import {categoryOrder} from '@/lib/drink-categories';
import SbLink from './sb-link';
import {holm,stepEffects,pool,type TypedDrink} from '@/lib/stats-math';

const fmt=(n:any,d=1)=>n==null||!Number.isFinite(n)?'–':Number(n).toLocaleString('sv-SE',{minimumFractionDigits:d,maximumFractionDigits:d});
const kr=(n:number)=>Math.round(n).toLocaleString('sv-SE')+' kr';
const mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const pf=(p:number)=>p<0.001?'< 0,001':fmt(p,3);
const signed=(v:number)=>(v>=0?'+':'')+fmt(v,2);
type ForestRow={c:string;sub:string;unit:string;slope:number;low:number;high:number;p:number;n:number;title:string};
// Forest plot: the pooled estimate as a diamond spanning its 95 % CI, then one line per type.
// Intervals wider than the axis end in an arrow.
function Forest({label,total,rows}:{label:string;total:ForestRow;rows:ForestRow[]}){
 const raw=Math.max(...[total,...rows].flatMap(r=>[Math.abs(r.low),Math.abs(r.high)]));
 const span=Math.min(3,[0.5,1,1.5,2,3].find(v=>v>=raw)??3);
 const at=(v:number)=>Math.max(0,Math.min(100,50+v/span*50));
 const line=(r:ForestRow,isTotal:boolean)=><div className={'forest-row'+(isTotal?' total':'')} role="row" key={r.c} title={r.title}>
  <span role="cell" className="forest-label">{r.c}<small>{r.sub}</small></span>
  <span role="cell" className="forest-track"><span className="forest-tick" style={{left:'25%'}}/><span className="forest-tick" style={{left:'75%'}}/><span className="forest-zero"/>
   {isTotal?<span className={'forest-diamond'+(r.p<0.05?' sig':'')} style={{left:at(r.low)+'%',width:at(r.high)-at(r.low)+'%'}}/>:<>
   <span className={'forest-ci'+(r.low<-span?' cut-left':'')+(r.high>span?' cut-right':'')} style={{left:at(r.low)+'%',width:at(r.high)-at(r.low)+'%'}}/>
   <span className={'forest-dot'+(r.p<0.05?' sig':'')} style={{left:at(r.slope)+'%',width:6+Math.sqrt(r.n)*1.6,height:6+Math.sqrt(r.n)*1.6}}/></>}
  </span>
  <span role="cell" className="forest-num">{signed(r.slope)}<small>{r.unit}</small></span>
 </div>;
 return <figure className="forest-figure">
  <div className="forest" role="table" aria-label={label}>{line(total,true)}{rows.map(r=>line(r,false))}</div>
  <div className="forest-axis"><span>−{fmt(span,1)}</span><span>0</span><span>+{fmt(span,1)}</span></div>
  <div className="forest-hint"><span>← sämre betyg</span><span>bättre betyg →</span></div>
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
 // Is expensive better? Per drink type in kronor steps that fit the type, see lib/stats-math.ts.
 const typeOf=(d:any)=>(d.category==='Öl'||d.category==='Vin')&&d.subcategory?d.subcategory:d.category;
 const typedRows:TypedDrink[]=drinks.filter((d:any)=>d.avg!=null).map((d:any)=>({session:d.sessionId,type:typeOf(d),price:d.price,volume:d.volume,avg:d.avg}));
 const steps=stepEffects(typedRows).sort((a,b)=>b.slope-a.slope);
 const stepHolm=holm(steps.map(e=>e.p));const pooled=pool(steps);
 const best=steps[0],worst=steps[steps.length-1];
 const fewTypes=[...new Set(typedRows.filter(r=>r.price>0).map(r=>r.type))].filter(t=>!steps.some(e=>e.type===t)).sort((a,b)=>a.localeCompare(b,'sv'));
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
    {!pooled?<p className="big-claim">För lite prisdata ännu.</p>:<>
    <p className="big-claim">{pooled.p<0.05?(pooled.mean>0?'Ja, lite grann.':'Tvärtom!'):'Inte så att det går att säga säkert.'} Lägger man ungefär en femtedel mer på flaskan blir betyget i snitt <b>{signed(pooled.mean)} poäng</b>.</p>
    {best.slope>0&&worst.slope<0&&<div className="price-duel">
     <div><span className="eyebrow">VÄRT PENGARNA</span><b>{best.type}</b><span>{signed(best.slope)} poäng per +{best.step} kr</span></div>
     <div><span className="eyebrow">SPARA SLANTARNA</span><b>{worst.type}</b><span>{signed(worst.slope)} poäng per +{worst.step} kr</span></div>
    </div>}
    <Forest label="Betyg per prissteg och dryckestyp" total={{c:'Alla typer',sub:`${pooled.k} typer`,unit:'per femtedel',slope:pooled.mean,low:pooled.low,high:pooled.high,p:pooled.p,n:0,title:`Vägt snitt av ${pooled.k} typer: ${signed(pooled.mean)} poäng per prissteg (95 % KI ${fmt(pooled.low,2)} till ${fmt(pooled.high,2)}), p = ${pf(pooled.p)}`}}
     rows={steps.map((e,i)=>({c:e.type,sub:`${Math.round(e.min).toLocaleString('sv-SE')}–${kr(e.max)}`,unit:`per +${e.step} kr`,slope:e.slope,low:e.low,high:e.high,p:e.p,n:e.n,title:`${e.type}: ${signed(e.slope)} poäng per +${e.step} kr (95 % KI ${fmt(e.low,2)} till ${fmt(e.high,2)}), p = ${pf(e.p)}, Holm-justerat p = ${pf(stepHolm[i])}, ${e.n} drycker från ${e.clusters} ${e.clusters===1?'provning':'provningar'}`}))}/>
    <p className="muted fine">Varje typ mäts i egna prissteg, ungefär en femtedel av typens vanliga pris: 5 kr för öl, 20 kr för vin, 100 kr för sprit. Strecken är 95 % konfidensintervall och ifylld prick betyder p &lt; 0,05. Med {steps.length} typer kan någon enstaka träff vara slump. {fewTypes.length>0&&`För få prissatta drycker för att räknas: ${fewTypes.join(', ')}.`}</p>
    <details className="method"><summary>Hur räknar vi?</summary>
     <p>Varje dryckestyp räknas för sig, eftersom en cognac inte kan jämföras med en öl i kronor. Typerna är kategorierna, men öl och vin delas upp per stil (lager, IPA, rött, vitt och så vidare). Priset räknas om till typens vanliga flaskstorlek, och prissteget är typens medianpris delat med fem, avrundat till 5, 10, 20, 50, 100 eller 200 kr. Snittbetyget regresseras sedan linjärt på priset inom typen.</p>
     <p>Drycker från samma kväll delar jury och humör och är inte oberoende. För typer som provats under minst tre kvällar används därför klusterrobusta standardfel per provning (t-fördelning med antal provningar minus ett frihetsgrader), annars vanliga standardfel. Typer med färre än fem prissatta drycker räknas inte.</p>
     <p>"Alla typer" är ett vägt snitt av typernas skattningar (random effects, DerSimonian–Laird), där säkra skattningar väger tyngre. Eftersom stegen är ungefär en femtedel av typens pris kan de vägas ihop. Holm-justerade p-värden, som tar hänsyn till att {steps.length} typer testas samtidigt, visas när man pekar på en rad.</p>
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
