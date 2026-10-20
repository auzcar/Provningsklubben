'use client';
import {useEffect,useState} from 'react';
import {Download,DatabaseBackup} from 'lucide-react';
import {api} from '@/lib/client-api';
import {authHeaders} from '@/lib/client-auth';

// Admin: download a full backup now, or one of the weekly automatic ones (lib/backup.ts).
async function download(date?:string){
 const r=await fetch('/api/backup'+(date?'?date='+date:''),{headers:await authHeaders(),cache:'no-store'});
 if(!r.ok)throw Error(((await r.json().catch(()=>({}))) as any).error||'Säkerhetskopian kunde inte hämtas.');
 const a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download=`provningsklubben-${date||new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
}
export default function BackupPanel(){
 const [info,setInfo]=useState<{automatic:boolean;dates:string[]}|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{api('/api/backup?list=1').then(setInfo).catch(e=>setError(e.message));},[]);
 const get=async(date?:string)=>{setBusy(true);setError('');try{await download(date);}catch(e:any){setError(e.message);}finally{setBusy(false);}};
 return <section className="panel"><div className="eyebrow">ADMINISTRATION</div><h2>Säkerhetskopior</h2>
  <p className="muted fine">En säkerhetskopia innehåller hela databasen: provningar, betyg, medlemmar, profiler och arkivet. Spara den på ett privat ställe, inte i Git eller i en delad mapp. Den läses tillbaka med Importera nedan, och befintliga rader skrivs aldrig över.</p>
  <button className="primary small" disabled={busy} onClick={()=>get()}><Download size={15}/>Ladda ner säkerhetskopia</button>
  {info?.automatic?<><h3>Automatiska, varje vecka</h3>{info.dates.length?<div className="row wrap">{info.dates.map(d=><button key={d} className="text-button" disabled={busy} onClick={()=>get(d)}><DatabaseBackup size={14}/>{d}</button>)}</div>:<p className="muted fine">Den första tas inom en vecka.</p>}<p className="muted fine">Sparas i tolv veckor.</p></>
   :info&&<p className="muted fine">Automatiska veckokopior är inte påslagna ännu.</p>}
  {error&&<p className="inline-error">{error}</p>}
 </section>;
}
