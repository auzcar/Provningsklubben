'use client';
import {useEffect,useState} from 'react';
import {Mail,LoaderCircle,X,ShieldCheck,UserX,UserCheck,Link2,ChevronRight,Upload} from 'lucide-react';
import {api} from '@/lib/client-api';
import {Avatar} from './profile';
import type {Me} from './auth-gate';
import {TestModePanel} from './test-mode';
import BackupPanel from './backup-panel';

export default function Members({me,openProfile}:{me:Me;openProfile:(id:string)=>void}){
 const [data,setData]=useState<any>(null);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [email,setEmail]=useState('');const [busy,setBusy]=useState(false);const [linking,setLinking]=useState<any>(null);
 useEffect(()=>{api('/api/members').then(setData).catch(e=>setError(e.message));},[]);
 const run=async(body:any,done='')=>{setBusy(true);setError('');setNotice('');try{setData(await api('/api/members',body));setNotice(done);return true;}catch(e:any){setError(e.message);return false;}finally{setBusy(false);}};
 if(!data)return error?<div className="empty"><h3>{error}</h3></div>:<div className="loading"><LoaderCircle className="spin"/>Hämtar medlemmar…</div>;
 const active=data.members.filter((m:any)=>m.status!=='removed'),removed=data.members.filter((m:any)=>m.status==='removed');
 const taken=new Set(data.members.filter((m:any)=>m.id!==linking?.id).flatMap((m:any)=>m.historyNames));
 return <>
  <div className="eyebrow">VILKA SOM SITTER VID BORDET</div><h1>Medlemmar</h1><p className="intro">Klubben är stängd. Bara inbjudna medlemmar kan logga in och se provningar och betyg.</p>
  {error&&<p className="inline-error" role="alert">{error}</p>}{notice&&<p className="muted" role="status">{notice}</p>}
  {me.admin&&<section className="panel"><div className="section-head"><div><div className="eyebrow">ADMINISTRATION</div><h2>Bjud in en medlem</h2></div></div>
   {data.mode==='clerk'?<><form className="row invite-form" onSubmit={async e=>{e.preventDefault();if(await run({action:'invite',email},'Inbjudan skickad till '+email+'.'))setEmail('');}}><input type="email" required placeholder="namn@exempel.se" aria-label="E-postadress" value={email} onChange={e=>setEmail(e.target.value)}/><button className="primary" disabled={busy}><Mail size={16}/>Skicka inbjudan</button></form><p className="muted fine">Mottagaren får ett mejl med en personlig länk för att skapa sitt konto. Den som inte är inbjuden kan inte registrera sig.</p>
    {data.invitations?.length>0&&<div className="invites"><h3>Väntande inbjudningar</h3>{data.invitations.map((i:any)=><div className="row between invite" key={i.id}><span>{i.email}</span><button className="text-button" disabled={busy} onClick={()=>run({action:'revoke-invite',id:i.id},'Inbjudan återkallad.')}><X size={14}/>Återkalla</button></div>)}</div>}</>
   :<p className="muted">Inbjudningar hanteras av den nuvarande inloggningstjänsten. Med Clerk-inloggning (AUTH_MODE=clerk) skickar du inbjudningar här.</p>}
  </section>}
  <div className="member-grid">{active.map((m:any)=><article className="member-card" key={m.id}>
   <button className="member-main" onClick={()=>openProfile(m.id)}><Avatar user={m.id} version={m.avatar} name={m.name} size={52}/><span className="member-name"><strong>{m.name}</strong><small>{m.admin?'Administratör':'Medlem'}{m.id===me.id?' · du':''}</small>{me.admin&&m.email&&<small>{m.email}</small>}</span><ChevronRight size={16}/></button>
   {me.admin&&<div className="member-admin">
    <button className="text-button" disabled={busy} onClick={()=>setLinking({...m,selected:[...m.historyNames]})}><Link2 size={14}/>{m.historyNames.length?'Arkivnamn: '+m.historyNames.join(', '):'Koppla arkivnamn'}</button>
    {m.id!==me.id&&!m.envAdmin&&<button className="text-button" disabled={busy} onClick={()=>run({action:'update',user:m.id,role:m.role==='admin'?'member':'admin'},m.name+(m.role==='admin'?' är nu medlem.':' är nu administratör.'))}><ShieldCheck size={14}/>{m.role==='admin'?'Ta bort admin':'Gör till admin'}</button>}
    {m.id!==me.id&&<button className="text-button danger" disabled={busy} onClick={()=>confirm(`Inaktivera ${m.name}? Personen kan inte längre logga in i klubben.`)&&run({action:'update',user:m.id,status:'removed'},m.name+' är inaktiverad.')}><UserX size={14}/>Inaktivera</button>}
   </div>}
  </article>)}</div>
  {me.admin&&<BackupPanel/>}
  {me.admin&&<TestModePanel/>}
  {me.admin&&<section className="panel"><div className="eyebrow">ADMINISTRATION</div><h2>Importera historik</h2><p className="muted fine">Välj en säkerhetskopia från appen, eller <b>recovery-data.json</b> eller <b>history.json</b> från den ursprungliga exporten. Filen skickas direkt till klubbens databas. Befintliga provningar skrivs aldrig över, så importen kan köras igen utan risk.</p><label className="secondary file-button"><Upload size={16}/>{busy?'Importerar…':'Välj fil'}<input type="file" accept=".json,application/json" hidden disabled={busy} onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;setBusy(true);setError('');setNotice('');try{let json:any;try{json=JSON.parse(await f.text());}catch{throw Error('Filen är inte giltig JSON.');}const d=await api('/api/import',json);setNotice(d.full?`Klart: ${d.full.tastings} provningar, ${d.full.ratings} betyg, ${d.full.profiles} medlemmar och ${d.full.historical} arkivprovningar lades tillbaka. Det som redan fanns rördes inte.`:`Klart: ${d.historical} nya provningar i arkivet (filen innehöll ${d.total.historical} provningar, ${d.total.samples} drycker och ${d.total.ratings} betyg)${d.tastings?`, ${d.tastings} pågående provning med dig som värd`:''}. Koppla nu arkivnamnen till medlemmarna.`);setData(await api('/api/members'));}catch(err:any){setError(err.message);}finally{setBusy(false);}}}/></label></section>}
  {me.admin&&removed.length>0&&<section className="profile-section"><h3>Inaktiverade</h3>{removed.map((m:any)=><div className="row between invite" key={m.id}><span>{m.name} {m.email&&<small className="muted">{m.email}</small>}</span><button className="text-button" disabled={busy} onClick={()=>run({action:'update',user:m.id,status:'active'},m.name+' är aktiv igen.')}><UserCheck size={14}/>Återaktivera</button></div>)}</section>}
  {linking&&<div className="modal-backdrop" onClick={()=>setLinking(null)}><div className="modal" role="dialog" aria-modal="true" aria-label="Koppla arkivnamn" onClick={e=>e.stopPropagation()}><button className="close" aria-label="Stäng" onClick={()=>setLinking(null)}><X/></button><div className="eyebrow">ARKIVET</div><h2>{linking.name}</h2><p>Välj de namn medlemmen har i den importerade historiken. Deras gamla betyg visas då på profilen.</p>
   <div className="name-list">{data.archiveNames.map((n:string)=><label className="check" key={n}><input type="checkbox" disabled={taken.has(n)} checked={linking.selected.includes(n)} onChange={e=>setLinking({...linking,selected:e.target.checked?[...linking.selected,n]:linking.selected.filter((x:string)=>x!==n)})}/>{n}{taken.has(n)&&<small className="muted"> (kopplat till annan medlem)</small>}</label>)}{!data.archiveNames.length&&<p className="muted">Arkivet innehåller inga namn ännu.</p>}</div>
   <button className="primary full" disabled={busy} onClick={async()=>{if(await run({action:'update',user:linking.id,historyNames:linking.selected},'Arkivnamn sparade.'))setLinking(null);}}>Spara</button></div></div>}
 </>;
}
