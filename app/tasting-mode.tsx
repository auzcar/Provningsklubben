'use client';
import {useEffect,useRef,useState} from 'react';
import {X,ChevronLeft,ChevronRight,Check,Eye,EyeOff,Users,Copy,UserMinus,LoaderCircle,MessageCircle,RefreshCw,ArrowRight} from 'lucide-react';
import {api} from '@/lib/client-api';
import {TASTE_TAGS} from '@/lib/model';
import {Avatar} from './profile';

type Vote={score:number|null;skip:boolean;comment:string;tags:string[];guess:number|null};
type Draft=Vote&{state:'saved'|'pending'|'error'|'empty';message?:string};
const fmt=(n:any,d=1)=>n==null?'–':Number(n).toLocaleString('sv-SE',{minimumFractionDigits:d,maximumFractionDigits:d});
const done=(v?:Draft)=>!!v&&v.state!=='empty'&&(v.skip||v.score!=null);
const buzz=()=>{try{navigator.vibrate?.(12);}catch{}};
// Conversation starters: the evening is about the people at the table, not the phones.
const PROMPTS=['Vad påminner doften om? Alla säger ett ord samtidigt.','Gissa land eller region innan ni jämför.','Vem vid bordet tror du gillar det här mest?','Vilken mat skulle passa till det här?','Beskriv smaken som en låt eller en film.','Dyrt eller billigt? Peka upp eller ner samtidigt.','Vilket tidigare prov liknar det mest?','Om drycken var en person vid bordet, vem då?','Första klunken mot andra: blev det bättre?','Vad skulle du själv betala för en flaska?','Vem har den mest överraskande anteckningen? Läs högt.','Skulle du köpa den här till en fest eller en tisdag?'];

// Full-screen blind tasting: one glass at a time, autosave, and the table in view.
// The host scores too; the drink's identity only shows while the reveal button is held.
export default function TastingMode({current,onExit,onReveal,canReveal,revealHint,onCopyLink,onRemove,onServe,busy}:{current:any;onExit:()=>void;onReveal:()=>void;canReveal:boolean;revealHint:string;onCopyLink:()=>void;onRemove:(user:string,name:string)=>void;onServe:(index:number)=>void;busy:boolean}){
 const samples=current.plan.samples as any[];
 const [index,setIndex]=useState(()=>{const i=samples.findIndex(s=>!current.mine[s.id]);return i<0?samples.length:i;});
 const [votes,setVotes]=useState<Record<string,Draft>>(()=>Object.fromEntries(samples.map(s=>{const v=current.mine[s.id];return [s.id,v?{tags:[],guess:null,...v,state:'saved'}:{score:null,skip:false,comment:'',tags:[],guess:null,state:'empty'}];})));
 const [peek,setPeek]=useState(false);const [panel,setPanel]=useState(false);const [prompt,setPrompt]=useState(0);const [avatars,setAvatars]=useState<Record<string,number>>({});
 const timers=useRef<Record<string,any>>({});const queue=useRef(Promise.resolve());
 const sample=samples[index];const vote=sample&&votes[sample.id];
 const completed=samples.filter(s=>done(votes[s.id])).length;
 const served:number|null=current.plan.served??null;
 const [seenServed,setSeenServed]=useState(served);

 useEffect(()=>{let lock:any;(navigator as any).wakeLock?.request('screen').then((l:any)=>{lock=l;}).catch(()=>{});const hide=()=>setPeek(false);document.addEventListener('visibilitychange',hide);return()=>{lock?.release?.().catch?.(()=>{});document.removeEventListener('visibilitychange',hide);};},[]);
 useEffect(()=>{api('/api/members').then(d=>setAvatars(Object.fromEntries(d.members.map((m:any)=>[m.id,m.avatar])))).catch(()=>{});},[]);
 useEffect(()=>{if(served!==seenServed&&served!=null&&!current.host)buzz();},[served,seenServed,current.host]);

 const save=(id:string,v:Draft)=>{
  if(!v.skip&&v.score==null)return;
  queue.current=queue.current.then(async()=>{try{await api('/api/club',{action:'vote',id:current.id,sample:id,vote:{score:v.score,skip:v.skip,comment:v.comment,tags:v.tags,guess:v.guess}});setVotes(x=>x[id]===v?{...x,[id]:{...v,state:'saved'}}:x);}catch(e:any){setVotes(x=>({...x,[id]:{...x[id],state:'error',message:e.message}}));}});
 };
 const update=(patch:Partial<Vote>)=>{
  const id=sample.id;const next:Draft={...votes[id],...patch,state:'pending'};
  setVotes(x=>({...x,[id]:next}));clearTimeout(timers.current[id]);timers.current[id]=setTimeout(()=>save(id,next),600);
 };
 const go=(i:number)=>{if(sample&&vote?.state==='pending'){clearTimeout(timers.current[sample.id]);save(sample.id,vote);}setPeek(false);setIndex(Math.max(0,Math.min(samples.length,i)));};
 const nudge=(d:number)=>{buzz();update({skip:false,score:Math.round(Math.min(10,Math.max(0,(vote.score??7)+d))*10)/10});};
 const toggleTag=(t:string)=>{buzz();update({tags:vote.tags.includes(t)?vote.tags.filter((x:string)=>x!==t):[...vote.tags,t]});};
 const people=current.people as any[];
 const progress=(u:string)=>current.progress.find((x:any)=>x.user===u)?.completed||0;
 const showServed=!current.host&&served!=null&&served!==index&&served!==seenServed;

 return <div className="tasting-mode" role="dialog" aria-modal="true" aria-label={'Provningsläge: '+current.title}>
  <header className="tm-head">
   <button className="tm-icon" aria-label="Lämna provningsläget" onClick={()=>{go(index);onExit();}}><X size={20}/></button>
   <div className="tm-title"><span>{current.title}</span><small>{index<samples.length?`Prov ${index+1} av ${samples.length}`:'Alla prov'}</small></div>
   {current.host?<button className="tm-icon brass" aria-label="Värdpanel" onClick={()=>setPanel(true)}><Users size={20}/></button>:<span className="tm-icon ghost"/>}
  </header>

  <section className="tm-table" aria-label="Vid bordet">
   {people.map(p=>{const n=progress(p.user),pct=Math.round(n/Math.max(1,samples.length)*100);return <div className="tm-guest" key={p.user} title={`${p.name}: ${n} av ${samples.length}`}>
    <span className="tm-ring" style={{background:`conic-gradient(var(--brass) ${pct}%, var(--ring-rest) 0)`}}><Avatar user={p.user} version={avatars[p.user]||0} name={p.name} size={34}/></span>
    <small>{p.user===current.self?'Du':p.name.split(' ')[0]}</small>
   </div>;})}
  </section>

  <nav className="tm-dots" aria-label="Prov">{samples.map((s,i)=><button key={s.id} aria-label={`Prov ${i+1}${done(votes[s.id])?', betygsatt':''}${served===i?', på bordet':''}`} aria-current={i===index} className={(done(votes[s.id])?'done ':'')+(i===index?'here ':'')+(served===i?'served':'')} onClick={()=>go(i)}/>)}</nav>

  {showServed&&<button className="tm-served" onClick={()=>{setSeenServed(served);go(served!);}}><span>Värden har ställt fram <b>prov {served!+1}</b></span><span className="row">Gå dit <ArrowRight size={16}/></span></button>}

  {sample?<main className="tm-label"><div className="tm-label-inner">
   <div className="tm-label-top">
    <div><div className="tm-kicker">Prov nummer</div><div className="tm-number">{String(sample.number).padStart(2,'0')}</div></div>
    <div className="tm-seal" aria-hidden="true">HEMLIG<br/><i>dryck</i></div>
   </div>
   {current.host&&<div className="tm-host-row">
    <button className="tm-peek" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);setPeek(true);}} onPointerUp={()=>setPeek(false)} onPointerCancel={()=>setPeek(false)} onBlur={()=>setPeek(false)} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();setPeek(true);}}} onKeyUp={()=>setPeek(false)} onContextMenu={e=>e.preventDefault()}>{peek?<EyeOff size={15}/>:<Eye size={15}/>}{peek?'Släpp för att dölja':'Håll in: vad ska serveras?'}</button>
    {served===index?<span className="tm-on-table"><Check size={14}/>På bordet</span>:<button className="tm-serve" onClick={()=>onServe(index)}>Ställ fram för alla</button>}
   </div>}
   {peek&&<div className="tm-secret" aria-live="polite"><strong>{sample.name}</strong><span>{[sample.type,sample.serving].filter(Boolean).join(' · ')}</span></div>}

   <div className="tm-prompt"><MessageCircle size={16}/><p>{PROMPTS[(index*5+prompt)%PROMPTS.length]}</p><button aria-label="Ny samtalsfråga" onClick={()=>setPrompt(p=>p+1)}><RefreshCw size={14}/></button></div>

   <div className="tm-score-row">
    <button className="tm-step" aria-label="Sänk 0,1" disabled={vote.skip} onClick={()=>nudge(-0.1)}>−</button>
    <div className="tm-score" aria-live="polite">{vote.skip?<span className="tm-skip">Avstår</span>:<><b>{fmt(vote.score)}</b><small>av tio möjliga</small></>}</div>
    <button className="tm-step" aria-label="Höj 0,1" disabled={vote.skip} onClick={()=>nudge(0.1)}>+</button>
   </div>
   <div className="tm-quick">{[4,5,6,7,8,9].map(n=><button key={n} disabled={vote.skip} aria-pressed={vote.score===n} onClick={()=>{buzz();update({score:n,skip:false});}}>{n}</button>)}</div>
   <input className="tm-range" type="range" min={0} max={10} step={0.1} aria-label="Finjustera betyget" value={vote.score??7} disabled={vote.skip} onChange={e=>update({score:Number(e.target.value),skip:false})}/>

   <div className="tm-kicker">Smaken i ett ord</div>
   <div className="tm-tags">{TASTE_TAGS.map(t=><button key={t} aria-pressed={vote.tags.includes(t)} onClick={()=>toggleTag(t)}>{t}</button>)}</div>

   <label className="tm-guess"><span className="tm-kicker">Gissa flaskans pris</span><span className="row"><input type="number" inputMode="numeric" min={0} placeholder="–" value={vote.guess??''} onChange={e=>update({guess:e.target.value===''?null:Number(e.target.value)})}/>kr</span></label>

   <label className="tm-note"><span className="tm-kicker">Smakanteckning</span><textarea rows={2} value={vote.comment} placeholder="Doft, smak, eftersmak…" onChange={e=>update({comment:e.target.value.slice(0,2000)})}/></label>
   <div className="row between tm-meta"><label className="tm-toggle"><input type="checkbox" checked={vote.skip} onChange={e=>update({skip:e.target.checked})}/>Jag avstår</label><span className={'tm-state is-'+vote.state}>{vote.state==='saved'?<><Check size={13}/>Sparat</>:vote.state==='pending'?'Sparar…':vote.state==='error'?vote.message:'Inte betygsatt'}</span></div>
  </div></main>
  :<main className="tm-cheers">
   <div className={'tm-glasses'+(completed===samples.length?' clink':'')} aria-hidden="true">
    <svg viewBox="0 0 64 80" width="64" height="80"><path d="M14 6h36l-3 26a15 15 0 0 1-30 0z" fill="#8c2433" stroke="#d9b46a" strokeWidth="2"/><path d="M32 47v24M20 73h24" stroke="#d9b46a" strokeWidth="2" strokeLinecap="round"/></svg>
    <svg viewBox="0 0 64 80" width="64" height="80"><path d="M14 6h36l-3 26a15 15 0 0 1-30 0z" fill="#c49a4a" stroke="#d9b46a" strokeWidth="2"/><path d="M32 47v24M20 73h24" stroke="#d9b46a" strokeWidth="2" strokeLinecap="round"/></svg>
   </div>
   <h2>{completed===samples.length?'Skål!':'Nästan där'}</h2>
   <p>{completed===samples.length?'Du har betygsatt alla prov. Lägg ifrån dig telefonen och snacka med bordet. Resultatet avslöjas tillsammans.':`Du har betygsatt ${completed} av ${samples.length} prov.`}</p>
   {completed===samples.length&&<div className="tm-prompt dark"><MessageCircle size={16}/><p>Medan ni väntar: vilket prov tror ni vinner, och vem har gett lägst betyg?</p></div>}
   {completed<samples.length&&<button className="tm-cta" onClick={()=>go(samples.findIndex(s=>!done(votes[s.id])))}>Till nästa obesvarade</button>}
   {current.host&&<button className="tm-cta" onClick={()=>setPanel(true)}><Users size={17}/>Värdpanelen</button>}
  </main>}

  <footer className="tm-foot">
   <button className="tm-nav" disabled={index===0} onClick={()=>go(index-1)}><ChevronLeft size={18}/>Föregående</button>
   {index<samples.length&&<button className="tm-nav next" onClick={()=>go(index+1)}>{index===samples.length-1?'Klar':'Nästa prov'}<ChevronRight size={18}/></button>}
  </footer>

  {panel&&current.host&&<div className="tm-sheet-backdrop" onClick={()=>setPanel(false)}><section className="tm-sheet" onClick={e=>e.stopPropagation()} aria-label="Värdpanel">
   <div className="row between"><h2>Värdpanel</h2><button className="tm-icon dark" aria-label="Stäng" onClick={()=>setPanel(false)}><X size={18}/></button></div>
   <h3>Vem är klar?</h3>
   {people.map(p=><div className="summary-line" key={p.user}><span>{p.name}</span><span className="row"><b>{progress(p.user)}/{samples.length}</b>{p.user!==current.self&&<button className="text-button danger" disabled={busy} aria-label={'Ta bort '+p.name} onClick={()=>onRemove(p.user,p.name)}><UserMinus size={14}/></button>}</span></div>)}
   {!people.length&&<p className="muted">Ingen deltar ännu.</p>}
   <button className="secondary full" onClick={onCopyLink}><Copy size={16}/>Kopiera länk för fler deltagare</button>
   <p className="muted fine">{revealHint}</p>
   <button className="primary full" disabled={busy||!canReveal} onClick={onReveal}>{busy?<LoaderCircle size={17} className="spin"/>:<Eye size={17}/>}Avsluta & avslöja allt</button>
  </section></div>}
 </div>;
}
