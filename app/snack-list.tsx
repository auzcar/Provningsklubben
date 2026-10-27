'use client';
import {useEffect,useState} from 'react';
import {Copy,Share2,Plus,X,Receipt,ShoppingCart} from 'lucide-react';
import {SECTIONS,SNACK_IDEAS,guessSection,sectionLabel} from '@/lib/snacks';
import type {Snack,SnackReceipt} from '@/lib/model';

const kr=(n:number)=>n.toLocaleString('sv-SE',{maximumFractionDigits:2})+' kr';
// The host's grocery list for snacks: grouped by store section in walking order, ticked off
// while shopping. Without onChange the list is read-only.
export default function SnackList({snacks,receipt,people,onChange}:{snacks:Snack[];receipt:SnackReceipt;people:number;onChange?:(snacks:Snack[],receipt:SnackReceipt)=>void}){
 const [name,setName]=useState('');const [amount,setAmount]=useState('');const [copied,setCopied]=useState(false);
 const [total,setTotal]=useState(receipt.total==null?'':String(receipt.total));const [note,setNote]=useState(receipt.note);
 useEffect(()=>{setTotal(receipt.total==null?'':String(receipt.total));setNote(receipt.note);},[receipt.total,receipt.note]);
 const set=(x:Snack[])=>onChange?.(x,receipt);
 const add=(n=name)=>{const v=n.trim();if(!v||snacks.length>=80)return;set([...snacks,{id:crypto.randomUUID(),name:v.slice(0,120),amount:n===name?amount.trim().slice(0,60):'',section:guessSection(v),purchased:false}]);if(n===name){setName('');setAmount('');}};
 const groups=SECTIONS.map(s=>({...s,items:snacks.filter(x=>x.section===s.key).sort((a,b)=>Number(a.purchased)-Number(b.purchased))})).filter(g=>g.items.length);
 const left=snacks.filter(s=>!s.purchased);
 const text=['Handlingslista tilltugg',...SECTIONS.flatMap(s=>{const items=left.filter(x=>x.section===s.key);return items.length?['',s.label.toUpperCase(),...items.map(x=>`☐ ${x.name}${x.amount?` – ${x.amount}`:''}`)]:[];})].join('\n');
 const copy=async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{}};
 const share=async()=>{try{await navigator.share({title:'Handlingslista',text});}catch{}};
 const ideas=SNACK_IDEAS.filter(i=>!snacks.some(s=>s.name.toLowerCase()===i.toLowerCase()));
 const saveReceipt=()=>{const t=total.trim().replace(/\s/g,'').replace(',','.');const n=t===''?null:Number(t);if(n!==null&&(!Number.isFinite(n)||n<0))return;if(n===receipt.total&&note.trim()===receipt.note)return;onChange?.(snacks,{total:n,note:note.trim().slice(0,300)});};
 return <>
  <section className="panel snack-panel">
   <div className="section-head"><div><div className="eyebrow">HANDLINGSLISTA</div><h2>Tilltugg</h2></div><span className="count">{left.length?`${left.length} kvar att handla`:snacks.length?'Allt handlat':''}</span></div>
   {onChange&&<form className="snack-add" onSubmit={e=>{e.preventDefault();add();}}>
    <input value={name} onChange={e=>setName(e.target.value)} placeholder="Exempelvis lagrad getost" aria-label="Vara" maxLength={120}/>
    <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Mängd, t.ex. 2 påsar" aria-label="Mängd" maxLength={60}/>
    <button className="primary small" type="submit" disabled={!name.trim()}><Plus size={15}/>Lägg till</button>
   </form>}
   {onChange&&ideas.length>0&&<div className="snack-ideas" aria-label="Förslag">{ideas.map(i=><button key={i} type="button" className="chip" onClick={()=>add(i)}><Plus size={12}/>{i}</button>)}</div>}
   {groups.length?groups.map(g=><div className="snack-section" key={g.key}><h3>{g.label}</h3><ul className="shopping-list">{g.items.map(s=><li key={s.id} className={s.purchased?'done':''}>
    <label><input type="checkbox" checked={s.purchased} disabled={!onChange} onChange={e=>set(snacks.map(x=>x.id===s.id?{...x,purchased:e.target.checked}:x))}/><span><b>{s.name}</b>{s.amount&&<small>{s.amount}</small>}</span></label>
    {onChange&&<select className="section-select" aria-label={'Avdelning för '+s.name} value={s.section} onChange={e=>set(snacks.map(x=>x.id===s.id?{...x,section:e.target.value}:x))}>{SECTIONS.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}</select>}
    {onChange&&<button className="icon-button" aria-label={'Ta bort '+s.name} onClick={()=>set(snacks.filter(x=>x.id!==s.id))}><X size={15}/></button>}
   </li>)}</ul></div>):<div className="empty compact"><ShoppingCart/><p>Lägg till det som ska ätas under kvällen. Varorna sorteras efter avdelning i butiken.</p></div>}
   {snacks.length>0&&<div className="row wrap snack-actions"><button className="secondary small" onClick={copy} disabled={!left.length}><Copy size={14}/>{copied?'Kopierad!':'Kopiera lista'}</button>{typeof navigator!=='undefined'&&'share' in navigator&&<button className="secondary small" onClick={share} disabled={!left.length}><Share2 size={14}/>Dela</button>}{onChange&&snacks.some(s=>s.purchased)&&<button className="text-button" onClick={()=>set(snacks.map(s=>({...s,purchased:false})))}>Avbocka alla</button>}</div>}
  </section>
  <section className="panel receipt-panel">
   <div className="section-head"><h2><Receipt size={18}/> Kvitto</h2></div>
   <p className="muted">Tilltuggen delas inte automatiskt. Skriv in kvittots summa här så att den inte tappas bort, och dela den sedan via Swish.</p>
   <div className="form-grid">
    <label className="field"><span>Totalt på kvittot (kr)</span><input inputMode="decimal" value={total} disabled={!onChange} onChange={e=>setTotal(e.target.value)} onBlur={saveReceipt} placeholder="0"/></label>
    <label className="field"><span>Anteckning</span><input value={note} disabled={!onChange} onChange={e=>setNote(e.target.value)} onBlur={saveReceipt} placeholder="Exempelvis ICA, betalt av värden" maxLength={300}/></label>
   </div>
   {receipt.total!=null&&people>0&&<small className="muted">{kr(receipt.total)} delat på {people} blir ungefär {kr(Math.ceil(receipt.total/people))} per person.</small>}
  </section>
 </>;
}
