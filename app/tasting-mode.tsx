'use client';
import {useEffect,useRef,useState} from 'react';
import {X,ChevronLeft,Check,Eye,EyeOff,Users,Copy,UserMinus,LoaderCircle,MessageCircle,RefreshCw,ArrowRight,ClipboardList,Lock,Hourglass,UtensilsCrossed,Cookie,Coffee,Sparkles,GlassWater} from 'lucide-react';
import {api} from '@/lib/client-api';
import {TASTE_TAGS,productImage} from '@/lib/model';
import {normalizeProgram,kindLabel} from '@/lib/program';
import {Avatar} from './profile';
import {SwishPay} from './swish';

type Vote={score:number|null;skip:boolean;comment:string;tags:string[];guess:number|null};
type Draft=Vote&{state:'saved'|'pending'|'error'|'empty';message?:string};
const fmt=(n:any,d=1)=>n==null?'–':Number(n).toLocaleString('sv-SE',{minimumFractionDigits:d,maximumFractionDigits:d});
const done=(v?:Draft)=>!!v&&v.state!=='empty'&&(v.skip||v.score!=null);
const buzz=()=>{try{navigator.vibrate?.(12);}catch{}};
const pad=(n:number)=>String(n).padStart(2,'0');
const KIND_ICON:any={drink:GlassWater,snack:Cookie,meal:UtensilsCrossed,break:Coffee,other:Sparkles};
// Conversation starters: the evening is about the people at the table, not the phones.
const PROMPTS=['Vad påminner doften om? Alla säger ett ord samtidigt.','Gissa land eller region innan ni jämför.','Vem vid bordet tror du gillar det här mest?','Vilken mat skulle passa till det här?','Beskriv smaken som en låt eller en film.','Dyrt eller billigt? Peka upp eller ner samtidigt.','Vilket tidigare prov liknar det mest?','Om drycken var en person vid bordet, vem då?','Första klunken mot andra: blev det bättre?','Vad skulle du själv betala för en flaska?','Vem har den mest överraskande anteckningen? Läs högt.','Skulle du köpa den här till en fest eller en tisdag?'];

// Full-screen blind tasting, centred on what is on the table. The host steps through the evening
// (current.stage, see lib/program.ts): a drink, snacks, a meal or a break. Only the drink on the
// table can be rated; earlier drinks can be opened read-only for reference, later ones are locked.
// The host rates too and moves on only when everyone has rated the drink on the table. The drink's
// identity shows to the host only while a button is held. While a tasting is on, everyone is held
// here (locked) until the reveal, except for the host's option to cancel the tasting.
export default function TastingMode({current,onExit,onReveal,canReveal,revealHint,onCopyLink,onRemove,onNext,onPaid,busy,locked=false,onCancel}:{current:any;locked?:boolean;onCancel?:()=>void;onPaid:(paid:boolean)=>void;onExit:()=>void;onReveal:()=>void;canReveal:boolean;revealHint:string;onCopyLink:()=>void;onRemove:(user:string,name:string)=>void;onNext:()=>void;busy:boolean}){
 const samples=current.plan.samples as any[];
 const stage=current.stage||{step:null,total:samples.length,reached:0,sample:null,last:false,kind:null,title:''};
 const onTable:number|null=stage.sample;const reached:number=stage.reached;
 const [viewing,setViewing]=useState<number|null>(null);
 const [votes,setVotes]=useState<Record<string,Draft>>(()=>Object.fromEntries(samples.map(s=>{const v=current.mine[s.id];return [s.id,v?{tags:[],guess:null,...v,state:'saved'}:{score:null,skip:false,comment:'',tags:[],guess:null,state:'empty'}];})));
 const [peek,setPeek]=useState(false);const [panel,setPanel]=useState(false);const [prompt,setPrompt]=useState(0);const [avatars,setAvatars]=useState<Record<string,number>>({});
 const [plan,setPlan]=useState(false);const [planPeek,setPlanPeek]=useState(false);
 const timers=useRef<Record<string,any>>({});const queue=useRef(Promise.resolve());
 const shown=viewing??onTable;const sample=shown==null?null:samples[shown];const vote=sample&&votes[sample.id];
 // The drink on the table is open; an earlier one only if this person has never rated it (late arrival).
 const editable=!!sample&&(shown===onTable||!current.mine[sample.id]);
 const completed=samples.filter(s=>done(votes[s.id])).length;
 const people=current.people as any[];
 const progress=(u:string)=>current.progress.find((x:any)=>x.user===u)?.completed||0;
 const waiting:string[]=current.waiting||[];
 // Host only: the full running order, with snacks and notes.
 const snacks=(current.plan.snacks||[]) as any[];const snackName=new Map(snacks.map(x=>[x.id,x.name]));
 const program=current.host?normalizeProgram(current.plan.program,samples,snacks.map(x=>x.id)):[];
 const nowItem=current.host&&stage.step!=null?program[stage.step]:null;const nextItem=current.host?program[stage.step==null?0:stage.step+1]:null;
 const itemLabel=(it:any)=>it.kind==='drink'?'Prov '+pad(samples.findIndex(x=>x.id===it.sample)+1):(it.title||kindLabel(it.kind));
 const itemSnacks=(it:any)=>(it?.snacks||[]).map((id:string)=>snackName.get(id)).filter(Boolean) as string[];

 useEffect(()=>{let lock:any;(navigator as any).wakeLock?.request('screen').then((l:any)=>{lock=l;}).catch(()=>{});const hide=()=>{setPeek(false);setPlanPeek(false);};document.addEventListener('visibilitychange',hide);return()=>{lock?.release?.().catch?.(()=>{});document.removeEventListener('visibilitychange',hide);};},[]);
 useEffect(()=>{api('/api/members').then(d=>setAvatars(Object.fromEntries(d.members.map((m:any)=>[m.id,m.avatar])))).catch(()=>{});},[]);
 // Something new on the table: everyone is brought back to it.
 const firstStep=useRef(stage.step);
 useEffect(()=>{if(stage.step===firstStep.current)return;firstStep.current=stage.step;flush();setViewing(null);setPeek(false);if(!current.host)buzz();},[stage.step]);

 const save=(id:string,v:Draft)=>{
  if(!v.skip&&v.score==null)return;
  queue.current=queue.current.then(async()=>{try{await api('/api/club',{action:'vote',id:current.id,sample:id,vote:{score:v.score,skip:v.skip,comment:v.comment,tags:v.tags,guess:v.guess}});setVotes(x=>x[id]===v?{...x,[id]:{...v,state:'saved'}}:x);}catch(e:any){setVotes(x=>({...x,[id]:{...x[id],state:'error',message:e.message}}));}});
 };
 const flush=()=>{for(const s of samples){const v=votes[s.id];if(v?.state==='pending'){clearTimeout(timers.current[s.id]);save(s.id,v);}}};
 const update=(patch:Partial<Vote>)=>{
  if(!sample||!editable)return;const id=sample.id;const next:Draft={...votes[id],...patch,state:'pending'};
  setVotes(x=>({...x,[id]:next}));clearTimeout(timers.current[id]);timers.current[id]=setTimeout(()=>save(id,next),600);
 };
 const view=(i:number|null)=>{flush();setPeek(false);setViewing(i===onTable?null:i);};
 const nudge=(d:number)=>{buzz();update({skip:false,score:Math.round(Math.min(10,Math.max(0,(vote!.score??7)+d))*10)/10});};
 const toggleTag=(t:string)=>{buzz();update({tags:vote!.tags.includes(t)?vote!.tags.filter((x:string)=>x!==t):[...vote!.tags,t]});};
 const holdProps=(set:(b:boolean)=>void)=>({onPointerDown:(e:any)=>{e.currentTarget.setPointerCapture(e.pointerId);set(true);},onPointerUp:()=>set(false),onPointerCancel:()=>set(false),onBlur:()=>set(false),onKeyDown:(e:any)=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();set(true);}},onKeyUp:()=>set(false),onContextMenu:(e:any)=>e.preventDefault()});
 const allServed=reached===samples.length;const finished=allServed&&completed===samples.length;
 const NowIcon=KIND_ICON[stage.kind||'drink'];
 const subtitle=stage.step==null?'Strax börjar det':onTable!=null?`Prov ${onTable+1} av ${samples.length} på bordet`:stage.title||'';
 const canNext=!!nextItem&&!(onTable!=null&&waiting.length>0);
 const cheers=viewing==null&&stage.last&&finished;

 return <div className="tasting-mode" role="dialog" aria-modal="true" aria-label={'Provningsläge: '+current.title}>
  <header className="tm-head">
   {locked?<span className="tm-icon ghost"/>:<button className="tm-icon" aria-label="Lämna provningsläget" onClick={()=>{flush();onExit();}}><X size={20}/></button>}
   <div className="tm-title"><span>{current.title}</span><small>{subtitle}</small></div>
   {current.host?<span className="row tm-host-icons"><button className="tm-icon brass" aria-label="Kvällens upplägg" onClick={()=>setPlan(true)}><ClipboardList size={20}/></button><button className="tm-icon brass" aria-label="Värdpanel" onClick={()=>setPanel(true)}><Users size={20}/></button></span>:<span className="tm-icon ghost"/>}
  </header>

  <section className="tm-table" aria-label="Vid bordet">
   {people.map(p=>{const n=progress(p.user),pct=Math.round(n/Math.max(1,samples.length)*100);const behind=onTable!=null&&waiting.includes(p.name);return <div className={'tm-guest'+(behind?' behind':'')} key={p.user} title={`${p.name}: ${n} av ${samples.length}`}>
    <span className="tm-ring" style={{background:`conic-gradient(var(--brass) ${pct}%, var(--ring-rest) 0)`}}><Avatar user={p.user} version={avatars[p.user]||0} name={p.name} size={34}/></span>
    <small>{p.user===current.self?'Du':p.name.split(' ')[0]}</small>
   </div>;})}
  </section>

  <nav className="tm-dots" aria-label="Prov">{samples.map((s,i)=>{const open=i<reached;return <button key={s.id} disabled={!open} aria-label={`Prov ${i+1}${done(votes[s.id])?', betygsatt':''}${onTable===i?', på bordet':''}${open?'':', inte serverat än'}`} aria-current={i===shown} className={(done(votes[s.id])?'done ':'')+(i===shown?'here ':'')+(onTable===i?'served ':'')+(open?'':'locked')} onClick={()=>view(i)}/>;})}</nav>

  {viewing!=null&&<button className="tm-served" onClick={()=>view(null)}><span>Du tittar på <b>prov {viewing+1}</b>. {onTable!=null?<>På bordet står prov {onTable+1}.</>:stage.title?<>På bordet: {stage.title}.</>:null}</span><span className="row">Till bordet <ArrowRight size={16}/></span></button>}

  {sample&&!cheers?<main className="tm-label"><div className="tm-label-inner">
   <div className="tm-label-top">
    <div><div className="tm-kicker">{shown===onTable?'På bordet nu':'Tidigare prov'}</div><div className="tm-number">{pad(sample.number)}</div></div>
    <div className="tm-seal" aria-hidden="true">HEMLIG<br/><i>dryck</i></div>
   </div>
   {current.host&&shown===onTable&&<div className="tm-host-row">
    <button className="tm-peek" {...holdProps(setPeek)}>{peek?<EyeOff size={15}/>:<Eye size={15}/>}{peek?'Släpp för att dölja':'Håll in: vad ska serveras?'}</button>
   </div>}
   {current.host&&peek&&<div className="tm-secret" aria-live="polite">
    {sample.image&&<img src={productImage(sample.image)} alt="" onError={e=>{e.currentTarget.style.display='none';}}/>}
    <div><strong>{sample.name}</strong><span>{[sample.type,sample.serving].filter(Boolean).join(' · ')}</span>
    {nowItem?.kind==='drink'&&itemSnacks(nowItem).length>0&&<span>Tilltugg: {itemSnacks(nowItem).join(', ')}</span>}
    {nowItem?.kind==='drink'&&nowItem.notes&&<span>{nowItem.notes}</span>}</div>
   </div>}

   {editable?<>
    {shown===onTable&&<div className="tm-prompt"><MessageCircle size={16}/><p>{PROMPTS[(shown*5+prompt)%PROMPTS.length]}</p><button aria-label="Ny samtalsfråga" onClick={()=>setPrompt(p=>p+1)}><RefreshCw size={14}/></button></div>}
    {shown!==onTable&&<p className="tm-latenote">Du hann inte betygsätta det här provet när det stod framme. Gör det nu, sedan låses betyget.</p>}
    <div className="tm-score-row">
     <button className="tm-step" aria-label="Sänk 0,1" disabled={vote!.skip} onClick={()=>nudge(-0.1)}>−</button>
     <div className="tm-score" aria-live="polite">{vote!.skip?<span className="tm-skip">Avstår</span>:<><b>{fmt(vote!.score)}</b><small>av tio möjliga</small></>}</div>
     <button className="tm-step" aria-label="Höj 0,1" disabled={vote!.skip} onClick={()=>nudge(0.1)}>+</button>
    </div>
    <div className="tm-quick">{[4,5,6,7,8,9].map(n=><button key={n} disabled={vote!.skip} aria-pressed={vote!.score===n} onClick={()=>{buzz();update({score:n,skip:false});}}>{n}</button>)}</div>
    <input className="tm-range" type="range" min={0} max={10} step={0.1} aria-label="Finjustera betyget" value={vote!.score??7} disabled={vote!.skip} onChange={e=>update({score:Number(e.target.value),skip:false})}/>
    <div className="tm-kicker">Smaken i ett ord</div>
    <div className="tm-tags">{TASTE_TAGS.map(t=><button key={t} aria-pressed={vote!.tags.includes(t)} onClick={()=>toggleTag(t)}>{t}</button>)}</div>
    <label className="tm-guess"><span className="tm-kicker">Gissa flaskans pris</span><span className="row"><input type="number" inputMode="numeric" min={0} placeholder="–" value={vote!.guess??''} onChange={e=>update({guess:e.target.value===''?null:Number(e.target.value)})}/>kr</span></label>
    <label className="tm-note"><span className="tm-kicker">Smakanteckning</span><textarea rows={2} value={vote!.comment} placeholder="Doft, smak, eftersmak…" onChange={e=>update({comment:e.target.value.slice(0,2000)})}/></label>
    <div className="row between tm-meta"><label className="tm-toggle"><input type="checkbox" checked={vote!.skip} onChange={e=>update({skip:e.target.checked})}/>Jag avstår</label>
     <span className={'tm-state is-'+vote!.state}>{vote!.state==='saved'?<><Check size={13}/>Sparat</>:vote!.state==='pending'?'Sparar…':vote!.state==='error'?vote!.message:'Inte betygsatt'}</span></div>
   </>:<div className="tm-readonly">
    <div className="tm-kicker"><Lock size={12}/> Ditt betyg, låst</div>
    <div className="tm-score"><b>{vote!.skip?'Avstod':fmt(vote!.score)}</b>{!vote!.skip&&<small>av tio möjliga</small>}</div>
    {vote!.tags.length>0&&<div className="tm-tags readonly">{vote!.tags.map(t=><span key={t}>{t}</span>)}</div>}
    {vote!.guess!=null&&<p>Prisgissning: {vote!.guess} kr</p>}
    {vote!.comment&&<blockquote>{vote!.comment}</blockquote>}
   </div>}
  </div></main>
  :<main className="tm-cheers">
   {stage.step==null?<>
    <Hourglass size={40} className="tm-wait"/>
    <h2>Strax börjar det</h2>
    <p>{current.host?'Ställ fram det första när alla sitter vid bordet.':'Värden ställer snart fram det första. Häng kvar, det här uppdateras av sig själv.'}</p>
   </>:cheers?<>
    <div className="tm-glasses clink" aria-hidden="true">
     <svg viewBox="0 0 64 80" width="64" height="80"><path d="M14 6h36l-3 26a15 15 0 0 1-30 0z" fill="#8c2433" stroke="#d9b46a" strokeWidth="2"/><path d="M32 47v24M20 73h24" stroke="#d9b46a" strokeWidth="2" strokeLinecap="round"/></svg>
     <svg viewBox="0 0 64 80" width="64" height="80"><path d="M14 6h36l-3 26a15 15 0 0 1-30 0z" fill="#c49a4a" stroke="#d9b46a" strokeWidth="2"/><path d="M32 47v24M20 73h24" stroke="#d9b46a" strokeWidth="2" strokeLinecap="round"/></svg>
    </div>
    <h2>Skål!</h2>
    <p>Alla prov är betygsatta. Lägg ifrån dig telefonen och snacka med bordet. Resultatet avslöjas tillsammans.</p>
    <div className="tm-prompt dark"><MessageCircle size={16}/><p>Medan ni väntar: vilket prov tror ni vinner, och vem har gett lägst betyg?</p></div>
    <SwishPay current={current} onPaid={onPaid} busy={busy}/>
   </>:<>
    <span className="tm-now-icon"><NowIcon size={34}/></span>
    <div className="tm-kicker">På bordet nu</div>
    <h2>{stage.title}</h2>
    {current.host&&nowItem&&itemSnacks(nowItem).length>0&&<p className="tm-host-only">Ställ fram: {itemSnacks(nowItem).join(', ')}</p>}
    {current.host&&nowItem?.notes&&<p className="tm-host-only">{nowItem.notes}</p>}
    <p>{reached?'Tidigare prov kan du öppna med prickarna ovanför, för att jämföra.':''}</p>
   </>}
  </main>}

  <footer className="tm-foot">
   {current.host?<div className="tm-step-bar">
    {nextItem?<>
     {onTable!=null&&waiting.length>0&&<small>Väntar på betyg från {waiting.join(', ')}</small>}
     <button className="tm-nav next" disabled={busy||!canNext} onClick={()=>{flush();onNext();}}>{busy?<LoaderCircle size={17} className="spin"/>:null}{stage.step==null?'Ställ fram':'Servera nästa'}: {itemLabel(nextItem)}<ArrowRight size={18}/></button>
    </>:<>
     <small>Allt är serverat.{canReveal?'':' '+revealHint}</small>
     <button className="tm-nav next" disabled={busy||!canReveal} onClick={onReveal}><Eye size={17}/>Avsluta & avslöja allt</button>
    </>}
   </div>:viewing!=null?<button className="tm-nav" onClick={()=>view(null)}><ChevronLeft size={18}/>Tillbaka till bordet</button>:<small className="tm-foot-note">{onTable!=null?(done(votes[samples[onTable].id])?(stage.last?'Klart! Värden avslöjar resultatet när alla är klara.':'Klart. Värden ställer fram nästa när alla har betygsatt.'):'Betygsätt provet på bordet.'):stage.step==null?'':'Njut. Nästa prov kommer när värden ställer fram det.'}</small>}
  </footer>

  {plan&&current.host&&<div className="tm-sheet-backdrop" onClick={()=>{setPlan(false);setPlanPeek(false);}}>
   <section className="tm-sheet tm-program" onClick={e=>e.stopPropagation()} aria-label="Kvällens upplägg">
    <div className="row between"><h2>Kvällens upplägg</h2><button className="tm-icon dark" aria-label="Stäng" onClick={()=>{setPlan(false);setPlanPeek(false);}}><X size={18}/></button></div>
    <button className="tm-peek" {...holdProps(setPlanPeek)}>{planPeek?<EyeOff size={15}/>:<Eye size={15}/>}{planPeek?'Släpp för att dölja':'Håll in: visa dryckerna'}</button>
    <ol className="tm-run">{program.map((it,i)=>{const s=it.kind==='drink'?samples.find(x=>x.id===it.sample):null;const sn=itemSnacks(it);const now=stage.step;
     return <li key={it.id} className={(i===now?'now ':now!=null&&i===now+1||now==null&&i===0?'next ':now!=null&&i<now?'past ':'')+it.kind}>
      <span className="tm-run-time">{it.time||''}</span>
      <div><div className="row between"><b>{itemLabel(it)}{it.kind!=='drink'&&<small> · {kindLabel(it.kind)}</small>}</b>{i===now?<span className="tm-run-tag">På bordet</span>:(now!=null&&i===now+1)||(now==null&&i===0)?<span className="tm-run-tag soft">Härnäst</span>:null}</div>
       {s&&planPeek&&<p className="tm-run-secret">{s.name}{s.serving?' · '+s.serving:''}</p>}
       {sn.length>0&&<p>Tilltugg: {sn.join(', ')}</p>}
       {it.notes&&(it.kind!=='drink'||planPeek)&&<p>{it.notes}</p>}
      </div>
     </li>;})}</ol>
    {!program.some(it=>it.kind!=='drink')&&<p className="muted fine">Inget mer än dryckerna är planerat. Upplägget görs under Planering → Upplägg innan provningen öppnas.</p>}
   </section>
  </div>}

  {panel&&current.host&&<div className="tm-sheet-backdrop" onClick={()=>setPanel(false)}>
   <section className="tm-sheet" onClick={e=>e.stopPropagation()} aria-label="Värdpanel">
    <div className="row between"><h2>Värdpanel</h2><button className="tm-icon dark" aria-label="Stäng" onClick={()=>setPanel(false)}><X size={18}/></button></div>
    <h3>Vem är klar?</h3>
    {people.map(p=><div className="summary-line" key={p.user}><span>{p.name}{onTable!=null&&waiting.includes(p.name)?' · betygsätter':''}</span><span className="row"><b>{progress(p.user)}/{samples.length}</b>{p.user!==current.self&&<button className="text-button danger" disabled={busy} aria-label={'Ta bort '+p.name} onClick={()=>onRemove(p.user,p.name)}><UserMinus size={14}/></button>}</span></div>)}
    {!people.length&&<p className="muted">Ingen deltar ännu.</p>}
    <button className="secondary full" onClick={onCopyLink}><Copy size={16}/>Kopiera länk för fler deltagare</button>
    <p className="muted fine">{revealHint}</p>
    <button className="primary full" disabled={busy||!canReveal} onClick={onReveal}>{busy?<LoaderCircle size={17} className="spin"/>:<Eye size={17}/>}Avsluta & avslöja allt</button>
    {onCancel&&<button className="text-button danger full" disabled={busy} onClick={onCancel}>Avbryt och ta bort provningen</button>}
   </section>
  </div>}
 </div>;
}
