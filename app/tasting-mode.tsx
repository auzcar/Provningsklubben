'use client';
import {useEffect,useRef,useState} from 'react';
import {X,ChevronLeft,ChevronRight,Check,Eye,EyeOff,LockKeyhole,Users,Copy,UserMinus,LoaderCircle} from 'lucide-react';
import {api} from '@/lib/client-api';

type Vote={score:number|null;skip:boolean;comment:string};
type Draft=Vote&{state:'saved'|'pending'|'error'|'empty';message?:string};
const fmt=(n:any,d=1)=>n==null?'–':Number(n).toLocaleString('sv-SE',{minimumFractionDigits:d,maximumFractionDigits:d});
const done=(v?:Draft)=>!!v&&v.state!=='empty'&&(v.skip||v.score!=null);

// Full-screen blind tasting: one glass at a time, large controls, autosave.
// The host scores too; the drink's identity only shows while the reveal button is held.
export default function TastingMode({current,onExit,onReveal,canReveal,revealHint,onCopyLink,onRemove,busy}:{current:any;onExit:()=>void;onReveal:()=>void;canReveal:boolean;revealHint:string;onCopyLink:()=>void;onRemove:(user:string,name:string)=>void;busy:boolean}){
 const samples=current.plan.samples as any[];
 const [index,setIndex]=useState(()=>{const i=samples.findIndex(s=>!current.mine[s.id]);return i<0?samples.length:i;});
 const [votes,setVotes]=useState<Record<string,Draft>>(()=>Object.fromEntries(samples.map(s=>{const v=current.mine[s.id];return [s.id,v?{...v,state:'saved'}:{score:null,skip:false,comment:'',state:'empty'}];})));
 const [peek,setPeek]=useState(false);const [panel,setPanel]=useState(false);
 const timers=useRef<Record<string,any>>({});const queue=useRef(Promise.resolve());
 const sample=samples[index];const vote=sample&&votes[sample.id];
 const completed=samples.filter(s=>done(votes[s.id])).length;

 // Keep the screen awake while tasting, and hide the drink whenever the tab is hidden.
 useEffect(()=>{let lock:any;(navigator as any).wakeLock?.request('screen').then((l:any)=>{lock=l;}).catch(()=>{});const hide=()=>setPeek(false);document.addEventListener('visibilitychange',hide);return()=>{lock?.release?.().catch?.(()=>{});document.removeEventListener('visibilitychange',hide);};},[]);
 useEffect(()=>setPeek(false),[index]);

 const save=(id:string,v:Draft)=>{
  if(!v.skip&&v.score==null)return;
  queue.current=queue.current.then(async()=>{try{await api('/api/club',{action:'vote',id:current.id,sample:id,vote:{score:v.score,skip:v.skip,comment:v.comment}});setVotes(x=>x[id]===v?{...x,[id]:{...v,state:'saved'}}:x);}catch(e:any){setVotes(x=>({...x,[id]:{...x[id],state:'error',message:e.message}}));}});
 };
 const update=(patch:Partial<Vote>)=>{
  const id=sample.id;const next:Draft={...votes[id],...patch,state:'pending'};
  setVotes(x=>({...x,[id]:next}));clearTimeout(timers.current[id]);timers.current[id]=setTimeout(()=>save(id,next),600);
 };
 const go=(i:number)=>{if(sample&&vote?.state==='pending'){clearTimeout(timers.current[sample.id]);save(sample.id,vote);}setIndex(Math.max(0,Math.min(samples.length,i)));};
 const nudge=(d:number)=>update({skip:false,score:Math.round(Math.min(10,Math.max(0,(vote.score??5)+d))*10)/10});

 return <div className="tasting-mode" role="dialog" aria-modal="true" aria-label={'Provningsläge: '+current.title}>
  <header className="tm-head">
   <button className="tm-icon" aria-label="Lämna provningsläget" onClick={()=>{go(index);onExit();}}><X size={20}/></button>
   <div className="tm-title"><span>{current.title}</span><small>{index<samples.length?`Prov ${index+1} av ${samples.length}`:'Alla prov'}</small></div>
   {current.host?<button className="tm-icon" aria-label="Värdpanel" onClick={()=>setPanel(true)}><Users size={20}/></button>:<span className="tm-icon"/>}
  </header>
  <nav className="tm-dots" aria-label="Prov">{samples.map((s,i)=><button key={s.id} aria-label={`Prov ${i+1}${done(votes[s.id])?', betygsatt':''}`} aria-current={i===index} className={(done(votes[s.id])?'done ':'')+(i===index?'here':'')} onClick={()=>go(i)}>{i+1}</button>)}<button aria-label="Sammanfattning" aria-current={index===samples.length} className={index===samples.length?'here':''} onClick={()=>go(samples.length)}><Check size={13}/></button></nav>

  {sample?<main className="tm-body">
   <div className="tm-number">{String(sample.number).padStart(2,'0')}</div>
   {current.host&&<div className="tm-peek">
    <button className="tm-peek-button" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);setPeek(true);}} onPointerUp={()=>setPeek(false)} onPointerCancel={()=>setPeek(false)} onBlur={()=>setPeek(false)} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();setPeek(true);}}} onKeyUp={()=>setPeek(false)} onContextMenu={e=>e.preventDefault()}>{peek?<EyeOff size={16}/>:<Eye size={16}/>}{peek?'Släpp för att dölja':'Håll in för att se vad du ska servera'}</button>
    {peek&&<div className="tm-secret" aria-live="polite"><strong>{sample.name}</strong><span>{[sample.type,sample.serving].filter(Boolean).join(' · ')}</span></div>}
   </div>}
   <div className="tm-score" aria-live="polite">{vote.skip?<span className="tm-skip-label">Avstår</span>:<>{fmt(vote.score)}<small>/ 10</small></>}</div>
   <div className="tm-slider">
    <button className="tm-step" aria-label="Sänk 0,1" disabled={vote.skip} onClick={()=>nudge(-0.1)}>−</button>
    <input type="range" min={0} max={10} step={0.1} aria-label="Ditt betyg" value={vote.score??5} disabled={vote.skip} className={vote.score==null?'unset':''} onChange={e=>update({score:Number(e.target.value),skip:false})}/>
    <button className="tm-step" aria-label="Höj 0,1" disabled={vote.skip} onClick={()=>nudge(0.1)}>+</button>
   </div>
   <div className="tm-quick">{[4,5,6,7,8,9].map(n=><button key={n} disabled={vote.skip} className={vote.score===n?'on':''} onClick={()=>update({score:n,skip:false})}>{n}</button>)}</div>
   <textarea className="tm-comment" rows={3} value={vote.comment} placeholder="Doft, smak, eftersmak…" aria-label="Din kommentar" onChange={e=>update({comment:e.target.value.slice(0,2000)})}/>
   <div className="row between tm-meta"><label className="tm-toggle"><input type="checkbox" checked={vote.skip} onChange={e=>update({skip:e.target.checked})}/>Jag avstår</label><span className={'tm-state is-'+vote.state}>{vote.state==='saved'?<><Check size={13}/>Sparat</>:vote.state==='pending'?'Sparar…':vote.state==='error'?vote.message:'Inte betygsatt'}</span></div>
  </main>
  :<main className="tm-body tm-summary">
   <LockKeyhole size={34}/>
   <h2>{completed===samples.length?'Du är klar!':'Nästan klar'}</h2>
   <p>Du har betygsatt {completed} av {samples.length} prov. Alla drycker och betyg avslöjas tillsammans när värden avslutar.</p>
   {completed<samples.length&&<button className="cream-button" onClick={()=>go(samples.findIndex(s=>!done(votes[s.id])))}>Gå till nästa obesvarade</button>}
   {current.host&&<button className="cream-button" onClick={()=>setPanel(true)}><Users size={17}/>Öppna värdpanelen</button>}
  </main>}

  <footer className="tm-foot">
   <button className="tm-nav" disabled={index===0} onClick={()=>go(index-1)}><ChevronLeft size={18}/>Föregående</button>
   {index<samples.length&&<button className="tm-nav primary-nav" onClick={()=>go(index+1)}>{index===samples.length-1?'Klar':'Nästa'}<ChevronRight size={18}/></button>}
  </footer>

  {panel&&current.host&&<div className="tm-sheet-backdrop" onClick={()=>setPanel(false)}><section className="tm-sheet" onClick={e=>e.stopPropagation()} aria-label="Värdpanel">
   <div className="row between"><h2>Värdpanel</h2><button className="tm-icon dark" aria-label="Stäng" onClick={()=>setPanel(false)}><X size={18}/></button></div>
   <h3>Vem är klar?</h3>
   {current.people.map((p:any)=>{const n=current.progress.find((x:any)=>x.user===p.user)?.completed||0;return <div className="summary-line" key={p.user}><span>{p.name}</span><span className="row"><b>{n}/{samples.length}</b>{p.user!==current.self&&<button className="text-button danger" disabled={busy} aria-label={'Ta bort '+p.name} onClick={()=>onRemove(p.user,p.name)}><UserMinus size={14}/></button>}</span></div>;})}
   {!current.people.length&&<p className="muted">Ingen deltar ännu.</p>}
   <button className="secondary full" onClick={onCopyLink}><Copy size={16}/>Kopiera länk för fler deltagare</button>
   <p className="muted fine">{revealHint}</p>
   <button className="primary full" disabled={busy||!canReveal} onClick={onReveal}>{busy?<LoaderCircle size={17} className="spin"/>:<Eye size={17}/>}Avsluta & avslöja allt</button>
  </section></div>}
 </div>;
}
