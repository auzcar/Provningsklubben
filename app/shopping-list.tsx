'use client';
import {useState} from 'react';
import {ShoppingBasket,Copy,Share2,ArrowUpRight} from 'lucide-react';
import {systembolagetUrl,type Sample} from '@/lib/model';

const kr=(n:number)=>Math.round(n).toLocaleString('sv-SE')+' kr';
// The host's shopping list: what is left to buy, with links that open each bottle on
// Systembolaget (in the app on a phone), and a text version to copy or share.
// Systembolaget has no link that fills a whole list, so it goes bottle by bottle.
export default function ShoppingList({samples,onToggle}:{samples:Sample[];onToggle?:(id:string,bought:boolean)=>void}){
 const [copied,setCopied]=useState(false);
 const items=[...samples].sort((a,b)=>Number(a.purchased)-Number(b.purchased));const left=samples.filter(s=>!s.purchased);
 const text=['Inköpslista Provningsklubben',...left.map(s=>`• ${s.name||'Namn saknas'}${s.article?` (art.nr ${s.article})`:''}${s.price!=null?` – ${kr(s.price)}`:''}${systembolagetUrl(s)?`\n  ${systembolagetUrl(s)}`:''}`),`Totalt: ${kr(left.reduce((n,s)=>n+(Number(s.price)||0),0))}`].join('\n');
 const copy=async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{}};
 const share=async()=>{try{await navigator.share({title:'Inköpslista',text});}catch{}};
 if(!samples.length)return null;
 return <section className="summary-panel shopping"><div className="eyebrow">ATT HANDLA</div><h2><ShoppingBasket size={18}/>Inköpslista</h2>
  <ul className="shopping-list">{items.map(s=><li key={s.id} className={s.purchased?'done':''}>
   <label><input type="checkbox" checked={!!s.purchased} disabled={!onToggle} onChange={e=>onToggle?.(s.id,e.target.checked)}/><span><b>{s.name||'Namn saknas'}</b><small>{[s.article&&'Art.nr '+s.article,s.price!=null&&kr(s.price)].filter(Boolean).join(' · ')}</small></span></label>
   {systembolagetUrl(s)&&<a className="sb-link" href={systembolagetUrl(s)} target="_blank" rel="noreferrer" aria-label={'Öppna '+(s.name||'drycken')+' på Systembolaget'}><ArrowUpRight size={16}/></a>}
  </li>)}</ul>
  <div className="summary-line"><span>Kvar att köpa</span><b>{left.length} st · {kr(left.reduce((n,s)=>n+(Number(s.price)||0),0))}</b></div>
  <div className="row"><button className="secondary small" onClick={copy}><Copy size={14}/>{copied?'Kopierad!':'Kopiera lista'}</button>{typeof navigator!=='undefined'&&'share' in navigator&&<button className="secondary small" onClick={share}><Share2 size={14}/>Dela</button>}</div>
  <small className="muted">Pilen öppnar flaskan hos Systembolaget, i appen om du har den. Där kan du lägga den i en lista eller i varukorgen.</small>
 </section>;
}
