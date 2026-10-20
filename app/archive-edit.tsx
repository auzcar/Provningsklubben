'use client';
import {useState} from 'react';
import {Pencil,Search,Check,X} from 'lucide-react';
import {api} from '@/lib/client-api';

// Admin: correct or complete a drink in the archive. Scores are never changed.
export default function ArchiveEdit({p,onSaved}:{p:any;onSaved:()=>void}){
 const blank=()=>({name:p.name||'',type:p.type||'',article:p.article||'',price:p.price??'',volume:p.volume??''});
 const [open,setOpen]=useState(false);const [f,setF]=useState<any>(blank);const [extra,setExtra]=useState<any>({});const [busy,setBusy]=useState(false);const [msg,setMsg]=useState('');
 const set=(k:string)=>(e:any)=>setF({...f,[k]:e.target.value});
 const fetchSb=async()=>{setBusy(true);setMsg('');try{const d=await api('/api/product?q='+encodeURIComponent(f.article));const x=d.products[0];
  setF({name:x.name||f.name,type:x.type||f.type,article:x.article||f.article,price:x.price??f.price,volume:x.volume??f.volume});
  setExtra({abv:x.abv,producer:x.producer,country:x.country,vintage:x.vintage,productUrl:x.productUrl,image:x.image});setMsg('Hämtat. Kontrollera och spara. Priset är dagens pris, inte det ni betalade.');}catch(e:any){setMsg(e.message);}finally{setBusy(false);}};
 const save=async()=>{setBusy(true);setMsg('');try{await api('/api/history',{action:'edit',session:p.sessionId,sample:p.id,fields:{...extra,...f}});setOpen(false);onSaved();}catch(e:any){setMsg(e.message);}finally{setBusy(false);}};
 if(!open)return <button className="text-button" onClick={()=>{setF(blank());setExtra({});setOpen(true);}}><Pencil size={14}/>Redigera uppgifter</button>;
 return <div className="archive-edit">
  <div className="form-grid">
   <label className="field"><span>Namn</span><input value={f.name} onChange={set('name')}/></label>
   <label className="field"><span>Typ</span><input value={f.type} onChange={set('type')}/></label>
   <label className="field"><span>Artikelnummer</span><div className="row"><input inputMode="numeric" value={f.article} onChange={set('article')}/><button className="secondary small" disabled={busy||!f.article} onClick={fetchSb}><Search size={14}/>Hämta</button></div></label>
   <label className="field"><span>Pris (kr)</span><input inputMode="decimal" value={f.price} onChange={set('price')}/></label>
   <label className="field"><span>Volym (cl)</span><input inputMode="decimal" value={f.volume} onChange={set('volume')}/></label>
  </div>
  {msg&&<p className="muted fine">{msg}</p>}
  <div className="row"><button className="primary small" disabled={busy} onClick={save}><Check size={14}/>Spara</button><button className="secondary small" onClick={()=>setOpen(false)}><X size={14}/>Avbryt</button></div>
 </div>;
}
