'use client';
import {useState} from 'react';
import {ShoppingBasket,Copy,Share2,ArrowUpRight,Plus,X} from 'lucide-react';
import {systembolagetUrl,SNACK_IDEAS,type Sample,type Snack} from '@/lib/model';

const kr=(n:number)=>Math.round(n).toLocaleString('sv-SE')+' kr';
const sum=(a:{price:number|null}[])=>a.reduce((n,s)=>n+(Number(s.price)||0),0);
// The host's shopping list: what is left to buy, with links that open each bottle on
// Systembolaget (in the app on a phone), and a text version to copy or share.
// Systembolaget has no link that fills a whole list, so it goes bottle by bottle.
// Snacks and nibbles for the evening are a second list below; the host adds them while planning.
export default function ShoppingList({samples,snacks=[],onToggle,onSnacks}:{samples:Sample[];snacks?:Snack[];onToggle?:(id:string,bought:boolean)=>void;onSnacks?:(snacks:Snack[])=>void}){
 const [copied,setCopied]=useState(false);
 const [name,setName]=useState('');const [amount,setAmount]=useState('');const [price,setPrice]=useState('');
 const items=[...samples].sort((a,b)=>Number(a.purchased)-Number(b.purchased));const left=samples.filter(s=>!s.purchased);
 const nibbles=[...snacks].sort((a,b)=>Number(a.purchased)-Number(b.purchased));const snacksLeft=snacks.filter(s=>!s.purchased);
 const text=['Inköpslista Provningsklubben',
  ...(left.length?['','Drycker',...left.map(s=>`• ${s.name||'Namn saknas'}${s.article?` (art.nr ${s.article})`:''}${s.price!=null?` – ${kr(s.price)}`:''}${systembolagetUrl(s)?`\n  ${systembolagetUrl(s)}`:''}`)]:[]),
  ...(snacksLeft.length?['','Tilltugg',...snacksLeft.map(s=>`• ${s.name}${s.amount?` (${s.amount})`:''}${s.price!=null?` – ${kr(s.price)}`:''}`)]:[]),
  '',`Totalt: ${kr(sum(left)+sum(snacksLeft))}`].join('\n');
 const copy=async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{}};
 const share=async()=>{try{await navigator.share({title:'Inköpslista',text});}catch{}};
 const add=(n=name)=>{const v=n.trim();if(!v||!onSnacks||snacks.length>=60)return;const p=price.trim()===''?null:Number(price.replace(',','.'));
  onSnacks([...snacks,{id:crypto.randomUUID(),name:v.slice(0,120),amount:amount.trim().slice(0,60),price:p!=null&&Number.isFinite(p)&&p>=0?p:null,purchased:false}]);setName('');setAmount('');setPrice('');};
 const ideas=SNACK_IDEAS.filter(i=>!snacks.some(s=>s.name.toLowerCase()===i.toLowerCase()));
 if(!samples.length&&!snacks.length&&!onSnacks)return null;
 return <section className="summary-panel shopping"><div className="eyebrow">ATT HANDLA</div><h2><ShoppingBasket size={18}/>Inköpslista</h2>
  {samples.length>0&&<><h3 className="shopping-group">Drycker</h3><ul className="shopping-list">{items.map(s=><li key={s.id} className={s.purchased?'done':''}>
   <label><input type="checkbox" checked={!!s.purchased} disabled={!onToggle} onChange={e=>onToggle?.(s.id,e.target.checked)}/><span><b>{s.name||'Namn saknas'}</b><small>{[s.article&&'Art.nr '+s.article,s.price!=null&&kr(s.price)].filter(Boolean).join(' · ')}</small></span></label>
   {systembolagetUrl(s)&&<a className="sb-link" href={systembolagetUrl(s)} target="_blank" rel="noreferrer" aria-label={'Öppna '+(s.name||'drycken')+' på Systembolaget'}><ArrowUpRight size={16}/></a>}
  </li>)}</ul></>}
  <h3 className="shopping-group">Snacks och tilltugg</h3>
  {nibbles.length>0?<ul className="shopping-list">{nibbles.map(s=><li key={s.id} className={s.purchased?'done':''}>
   <label><input type="checkbox" checked={s.purchased} disabled={!onSnacks} onChange={e=>onSnacks?.(snacks.map(x=>x.id===s.id?{...x,purchased:e.target.checked}:x))}/><span><b>{s.name}</b>{(s.amount||s.price!=null)&&<small>{[s.amount,s.price!=null&&kr(s.price)].filter(Boolean).join(' · ')}</small>}</span></label>
   {onSnacks&&<button className="icon-button" aria-label={'Ta bort '+s.name} onClick={()=>onSnacks(snacks.filter(x=>x.id!==s.id))}><X size={15}/></button>}
  </li>)}</ul>:<small className="muted">{onSnacks?'Inget tilltugg tillagt än.':'Inget tilltugg planerat.'}</small>}
  {onSnacks&&<form className="snack-add" onSubmit={e=>{e.preventDefault();add();}}>
   <input value={name} onChange={e=>setName(e.target.value)} placeholder="Exempelvis salta mandlar" aria-label="Tilltugg" maxLength={120}/>
   <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Mängd" aria-label="Mängd" maxLength={60}/>
   <input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Pris" aria-label="Pris i kronor" inputMode="decimal"/>
   <button className="secondary small" type="submit" disabled={!name.trim()}><Plus size={14}/>Lägg till</button>
  </form>}
  {onSnacks&&ideas.length>0&&<div className="snack-ideas">{ideas.map(i=><button key={i} type="button" className="chip" onClick={()=>add(i)}><Plus size={12}/>{i}</button>)}</div>}
  <div className="summary-line"><span>Kvar att köpa</span><b>{left.length+snacksLeft.length} st · {kr(sum(left)+sum(snacksLeft))}</b></div>
  <div className="row"><button className="secondary small" onClick={copy}><Copy size={14}/>{copied?'Kopierad!':'Kopiera lista'}</button>{typeof navigator!=='undefined'&&'share' in navigator&&<button className="secondary small" onClick={share}><Share2 size={14}/>Dela</button>}</div>
  {samples.length>0&&<small className="muted">Pilen öppnar flaskan hos Systembolaget, i appen om du har den. Där kan du lägga den i en lista eller i varukorgen.</small>}
 </section>;
}
