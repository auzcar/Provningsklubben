'use client';
import {useState} from 'react';
import {GlassWater,Cookie,UtensilsCrossed,Coffee,Sparkles,Plus,Trash2,Clock,X,WandSparkles} from 'lucide-react';
import {KINDS,kindLabel,normalizeProgram,moveItem,suggestTimes,type ProgramItem,type ProgramKind} from '@/lib/program';
import type {Sample,Snack} from '@/lib/model';

const ICON:Record<ProgramKind,any>={drink:GlassWater,snack:Cookie,meal:UtensilsCrossed,break:Coffee,other:Sparkles};
const HINT:Record<ProgramKind,string>={drink:'Servering, temperatur, glas…',snack:'Vad läggs fram?',meal:'Vad serveras? Vilken dryck passar till?',break:'',other:'Vad händer?'};
// The running order of the evening (lib/program.ts). Only the host sees it; without onChange it is read-only.
export default function EveningProgram({samples,snacks,program,start,onChange}:{samples:Sample[];snacks:Snack[];program:any;start:string;onChange?:(program:ProgramItem[],samples?:Sample[])=>void}){
 const items=normalizeProgram(program,samples,snacks.map(s=>s.id));
 const [open,setOpen]=useState('');
 const byId=new Map(samples.map(s=>[s.id,s]));const snackName=new Map(snacks.map(s=>[s.id,s.name]));
 const edit=(id:string,patch:Partial<ProgramItem>)=>onChange?.(items.map(it=>it.id===id?{...it,...patch}:it));
 const move=(i:number,dir:number)=>{const r=moveItem(items,samples,i,dir);onChange?.(r.program,r.samples.length===samples.length?r.samples.map((s,n)=>({...s,number:n+1})):undefined);};
 const add=(kind:Exclude<ProgramKind,'drink'>)=>{const id=crypto.randomUUID();onChange?.([...items,{id,kind,title:KINDS.find(k=>k.kind===kind)!.title,time:'',notes:'',snacks:[]}]);setOpen(id);};
 const placed=new Set(items.flatMap(it=>it.snacks));
 return <section className="panel program">
  <div className="section-head"><div><div className="eyebrow">KÖRSCHEMA</div><h2>Kvällens upplägg</h2></div>
   {onChange&&<button className="text-button" disabled={!start||!items.length} title={start?'':'Ange när provningen börjar under Översikt'} onClick={()=>{if(!items.some(it=>it.time)||confirm('Ersätta alla tider med förslag utifrån starttiden '+start+'?'))onChange(suggestTimes(items,start));}}><WandSparkles size={15}/>Föreslå tider</button>}</div>
  <p className="muted">Dryckerna ligger i provordning. Lägg in tilltugg, måltid och pauser där de passar och flytta med pilarna. Flyttar du en dryck förbi en annan ändras provordningen.</p>
  {items.length?<ol className="timeline">{items.map((it,i)=>{const Icon=ICON[it.kind];const s=it.sample?byId.get(it.sample):undefined;const expanded=open===it.id;
   return <li key={it.id} className={'program-item '+it.kind}>
    <div className="program-time">{onChange?<input type="time" aria-label="Klockslag" value={it.time} onChange={e=>edit(it.id,{time:e.target.value})}/>:<span>{it.time||'–'}</span>}</div>
    <span className="program-dot"><Icon size={15}/></span>
    <div className="program-body">
     <div className="row between"><button className="program-title" onClick={()=>setOpen(expanded?'':it.id)} aria-expanded={expanded}>
      {it.kind==='drink'?<><b>Prov {String(s?.number??'').padStart(2,'0')}</b> {s?.name}</>:<><small>{kindLabel(it.kind)}</small> <b>{it.title||kindLabel(it.kind)}</b></>}
     </button>
     {onChange&&<span className="row program-actions"><button aria-label="Flytta upp" disabled={i===0} onClick={()=>move(i,-1)}>↑</button><button aria-label="Flytta ned" disabled={i===items.length-1} onClick={()=>move(i,1)}>↓</button>{it.kind!=='drink'&&<button aria-label={'Ta bort '+(it.title||kindLabel(it.kind))} onClick={()=>onChange(items.filter(x=>x.id!==it.id))}><Trash2 size={14}/></button>}</span>}</div>
     {(it.notes||it.snacks.length>0)&&!expanded&&<p className="program-notes">{it.snacks.map(id=>snackName.get(id)).filter(Boolean).join(', ')}{it.notes&&it.snacks.length?' · ':''}{it.notes}</p>}
     {expanded&&<div className="program-edit">
      {it.kind!=='drink'&&<label className="field"><span>Rubrik</span><input value={it.title} disabled={!onChange} placeholder={kindLabel(it.kind)} onChange={e=>edit(it.id,{title:e.target.value})} maxLength={120}/></label>}
      <label className="field"><span>Anteckningar</span><textarea rows={2} value={it.notes} disabled={!onChange} placeholder={HINT[it.kind]} onChange={e=>edit(it.id,{notes:e.target.value})} maxLength={1000}/></label>
      <div className="field"><span>Tilltugg här</span>{snacks.length?<div className="snack-ideas">{snacks.map(sn=>{const on=it.snacks.includes(sn.id);return <button key={sn.id} type="button" disabled={!onChange} className={'chip'+(on?' on':'')+(!on&&placed.has(sn.id)?' elsewhere':'')} onClick={()=>edit(it.id,{snacks:on?it.snacks.filter(x=>x!==sn.id):[...it.snacks,sn.id]})}>{on?<X size={12}/>:<Plus size={12}/>}{sn.name}</button>;})}</div>:<small className="muted">Lägg till tilltugg under fliken Tilltugg först.</small>}</div>
      <button className="text-button" onClick={()=>setOpen('')}>Klar</button>
     </div>}
    </div>
   </li>;})}</ol>:<div className="empty compact"><Clock/><p>Lägg till drycker eller en första punkt för att bygga kvällen.</p></div>}
  {onChange&&<div className="row wrap program-add"><span className="muted">Lägg till:</span>{KINDS.map(k=>{const Icon=ICON[k.kind];return <button key={k.kind} className="secondary small" onClick={()=>add(k.kind)}><Icon size={14}/>{k.label}</button>;})}</div>}
  {snacks.some(s=>!placed.has(s.id))&&<small className="muted">Ej placerat i schemat: {snacks.filter(s=>!placed.has(s.id)).map(s=>s.name).join(', ')}.</small>}
 </section>;
}
