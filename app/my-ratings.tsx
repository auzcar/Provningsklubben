'use client';
import {useEffect,useMemo,useState} from 'react';
import {Plus,Check,X,Copy,Share2,ShoppingBasket,Trash2,ArrowUpRight} from 'lucide-react';
import {categoryOrder} from '@/lib/drink-categories';
import {systembolagetUrl} from '@/lib/model';
import SbLink from './sb-link';

const fmt=(n:any,d=1)=>n==null?'–':Number(n).toLocaleString('sv-SE',{maximumFractionDigits:d});
const kr=(n:number)=>Math.round(n).toLocaleString('sv-SE')+' kr';
type Item={key:string;name:string;article:string;productUrl:string;price:number|null;score:number|null};
// One list per signed-in member, so people sharing a browser (or test persons) keep their own.
const listKey=(viewer:string)=>'shopping-list:'+viewer;
const load=(key:string):Item[]=>{try{return JSON.parse(localStorage.getItem(key)||'[]');}catch{return [];}};

// Every rating on a profile, filterable by drink group and style, with links to Systembolaget
// and a personal shopping list kept in this browser.
export default function MyRatings({tastings,own,viewer}:{tastings:any[];own:boolean;viewer:string}){
 const all=useMemo(()=>tastings.flatMap(t=>t.samples.filter((p:any)=>p.rated&&!p.skip&&p.score!=null&&p.name).map((p:any)=>({...p,session:t.title,date:t.date,key:t.id+':'+p.id}))),[tastings]);
 const [cat,setCat]=useState('');const [sub,setSub]=useState('');const [sort,setSort]=useState('score');const [min,setMin]=useState('');const [from,setFrom]=useState('');const [to,setTo]=useState('');const [list,setList]=useState<Item[]>([]);const [copied,setCopied]=useState(false);const [more,setMore]=useState(false);
 const key=listKey(viewer);
 useEffect(()=>setList(load(key)),[key]);
 const save=(l:Item[])=>{setList(l);try{localStorage.setItem(key,JSON.stringify(l));}catch{}};
 const cats=categoryOrder.map(c=>({c,n:all.filter((p:any)=>p.category===c).length})).filter(x=>x.n>0);
 const subs=cat?[...new Set<string>(all.filter((p:any)=>p.category===cat&&p.subcategory).map((p:any)=>p.subcategory))].sort((a,b)=>a.localeCompare(b,'sv')):[];
 // Price filter and price sorts leave out drinks without a known price; those always go last.
 // The filter compares whole kronor, the same rounded price the list shows.
 const priced=(p:any)=>p.price>0;
 const byPrice=(dir:number)=>(a:any,b:any)=>priced(a)&&priced(b)?dir*(a.price-b.price):Number(priced(b))-Number(priced(a));
 const sorts:Record<string,(a:any,b:any)=>number>={score:(a,b)=>b.score-a.score,cheap:byPrice(1),dear:byPrice(-1),value:(a,b)=>priced(a)&&priced(b)?b.score/b.price-a.score/a.price:Number(priced(b))-Number(priced(a)),recent:(a,b)=>(b.date||'').localeCompare(a.date||''),name:(a,b)=>a.name.localeCompare(b.name,'sv')};
 const shown=all.filter((p:any)=>(!cat||p.category===cat)&&(!sub||p.subcategory===sub)&&(!min||p.score>=Number(min))&&(!from||priced(p)&&Math.round(p.price)>=Number(from))&&(!to||priced(p)&&Math.round(p.price)<=Number(to))).sort(sorts[sort]);
 const inList=(k:string)=>list.some(i=>i.key===k);
 const toggle=(p:any)=>save(inList(p.key)?list.filter(i=>i.key!==p.key):[...list,{key:p.key,name:p.name,article:p.article||'',productUrl:p.productUrl||'',price:p.price??null,score:p.score}]);
 const text=['Inköpslista',...list.map(i=>`• ${i.name}${i.article?` (art.nr ${i.article})`:''}${systembolagetUrl(i)?`\n  ${systembolagetUrl(i)}`:''}`)].join('\n');
 const total=list.reduce((n,i)=>n+(i.price||0),0);
 if(!all.length)return null;
 return <section className="profile-section my-ratings"><div className="eyebrow">ALLA BETYG</div><h2>{own?'Mina betyg':'Betyg'} <small className="muted">{all.length} st</small></h2>
  <div className="chip-row" role="group" aria-label="Dryckesgrupp"><button className={'chip'+(!cat?' on':'')} onClick={()=>{setCat('');setSub('');}}>Alla <b>{all.length}</b></button>{cats.map(x=><button key={x.c} className={'chip'+(cat===x.c?' on':'')} onClick={()=>{setCat(x.c);setSub('');}}>{x.c} <b>{x.n}</b></button>)}</div>
  {subs.length>0&&<div className="chip-row sub" role="group" aria-label="Stil"><button className={'chip'+(!sub?' on':'')} onClick={()=>setSub('')}>Alla stilar</button>{subs.map(s=><button key={s} className={'chip'+(sub===s?' on':'')} onClick={()=>setSub(s)}>{s}</button>)}</div>}
  <div className="row wrap my-ratings-tools"><select aria-label="Sortering" value={sort} onChange={e=>setSort(e.target.value)}><option value="score">Högst betyg först</option><option value="cheap">Billigast först</option><option value="dear">Dyrast först</option><option value="value">Mest betyg för pengarna</option><option value="recent">Senaste först</option><option value="name">Namn A–Ö</option></select><select aria-label="Lägsta betyg" value={min} onChange={e=>setMin(e.target.value)}><option value="">Alla betyg</option>{[6,7,8,9].map(n=><option key={n} value={n}>Minst {n}</option>)}</select><span className="price-range"><input aria-label="Lägsta pris" inputMode="numeric" placeholder="Från kr" value={from} onChange={e=>setFrom(e.target.value.replace(/\D/g,''))}/>–<input aria-label="Högsta pris" inputMode="numeric" placeholder="Till kr" value={to} onChange={e=>setTo(e.target.value.replace(/\D/g,''))}/></span><span className="muted fine">{shown.length} visas</span></div>
  {list.length>0&&<div className="summary-panel shopping my-list"><div className="eyebrow">ATT HANDLA</div><h2><ShoppingBasket size={18}/>Min inköpslista</h2>
   <ul className="shopping-list">{list.map(i=><li key={i.key}><span><b>{i.name}</b><small>{[i.article&&'Art.nr '+i.article,i.price!=null&&kr(i.price)+' när ni provade'].filter(Boolean).join(' · ')}</small></span>{systembolagetUrl(i)&&<a className="sb-link" href={systembolagetUrl(i)} target="_blank" rel="noreferrer" aria-label={'Öppna '+i.name+' på Systembolaget'}><ArrowUpRight size={16}/></a>}<button className="icon-button" aria-label={'Ta bort '+i.name} onClick={()=>save(list.filter(x=>x.key!==i.key))}><X size={14}/></button></li>)}</ul>
   {total>0&&<div className="summary-line"><span>Ungefär</span><b>{kr(total)}</b></div>}
   <div className="row wrap"><button className="secondary small" onClick={async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{}}}><Copy size={14}/>{copied?'Kopierad!':'Kopiera'}</button>{typeof navigator!=='undefined'&&'share' in navigator&&<button className="secondary small" onClick={()=>navigator.share({title:'Inköpslista',text}).catch(()=>{})}><Share2 size={14}/>Dela</button>}<button className="text-button" onClick={()=>save([])}><Trash2 size={14}/>Töm</button></div>
   <small className="muted">Systembolaget tar inte emot färdiga listor från andra sidor. Tryck på pilen vid varje flaska, så öppnas den hos Systembolaget (i appen om du har den), och lägg den i din lista eller varukorg där. Listan sparas för dig i den här webbläsaren.</small>
  </div>}
  <ul className="rating-list">{(more?shown:shown.slice(0,15)).map((p:any)=><li key={p.key}>
   <span className="rating-pill">{fmt(p.score)}</span>
   <span className="rating-main"><b>{p.name} <SbLink drink={p}/></b><small>{[p.subcategory||p.category,p.session].filter(Boolean).join(' · ')}{p.average!=null&&` · gruppen ${fmt(p.average)}`}</small></span>
   <span className="rating-price">{priced(p)?kr(p.price):'–'}</span>
   <button className={'icon-button'+(inList(p.key)?' on':'')} aria-label={inList(p.key)?'Ta bort från inköpslistan':'Lägg i inköpslistan'} title={inList(p.key)?'I inköpslistan':'Lägg i inköpslistan'} onClick={()=>toggle(p)}>{inList(p.key)?<Check size={16}/>:<Plus size={16}/>}</button>
  </li>)}</ul>
  {!more&&shown.length>15&&<button className="text-button" onClick={()=>setMore(true)}>Visa alla {shown.length}</button>}
 </section>;
}
