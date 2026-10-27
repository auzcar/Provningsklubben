'use client';
import {useState} from 'react';
import {CalendarPlus,Copy,RefreshCw,LoaderCircle,ArrowUpRight} from 'lucide-react';
import {api} from '@/lib/client-api';

// The member's personal calendar subscription (app/api/calendar). The address is secret: anyone
// with it sees when and where the member's tastings are, so it can be replaced.
export default function CalendarSubscribe(){
 const [url,setUrl]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [copied,setCopied]=useState(false);
 const run=async(fn:()=>Promise<any>)=>{setBusy(true);setError('');try{await fn();}catch(e:any){setError(e.message);}finally{setBusy(false);}};
 const load=()=>run(async()=>setUrl((await api('/api/calendar')).url));
 const reset=()=>{if(confirm('Byta kalenderlänk? Kalendrar som prenumererar på den gamla länken slutar uppdateras och behöver läggas till igen.'))run(async()=>setUrl((await api('/api/calendar',{action:'reset'})).url));};
 const copy=async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{}};
 const webcal=url.replace(/^https?:\/\//,'webcal://');
 return <section className="profile-section calendar-subscribe">
  <div className="eyebrow">KALENDER</div>
  <h2>Prenumerera på provningarna</h2>
  <p className="muted">Lägg till klubbens provningar i din kalender en gång. När värden ändrar datum, tid eller plats uppdateras händelsen av sig själv. Du får med provningar du är värd för, är inbjuden till eller har anslutit till.</p>
  {!url?<button className="secondary small" disabled={busy} onClick={load}>{busy?<LoaderCircle size={15} className="spin"/>:<CalendarPlus size={15}/>}Visa min kalenderlänk</button>:<>
   <div className="row wrap calendar-buttons">
    <a className="primary small" href={webcal}><CalendarPlus size={15}/>iPhone, Mac eller Outlook</a>
    <a className="secondary small" href={'https://calendar.google.com/calendar/r?cid='+encodeURIComponent(webcal)} target="_blank" rel="noreferrer">Google Kalender <ArrowUpRight size={14}/></a>
    <button className="secondary small" onClick={copy}><Copy size={14}/>{copied?'Kopierad!':'Kopiera länk'}</button>
   </div>
   <small className="muted">Kalenderappen hämtar ändringar själv med jämna mellanrum. Hur ofta bestämmer appen, oftast inom några timmar; Google Kalender kan ta upp till ett dygn. Länken är personlig, dela den inte.</small>
   <button className="text-button" disabled={busy} onClick={reset}><RefreshCw size={14}/>Byt länk</button>
  </>}
  {error&&<p className="inline-error">{error}</p>}
 </section>;
}
