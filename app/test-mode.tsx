'use client';
import {FlaskConical,Dice5,X,ExternalLink,Trash2} from 'lucide-react';
import {api} from '@/lib/client-api';
import {TEST_USERS} from '@/lib/test-users';
import {setTestUser,testUser} from '@/lib/client-auth';

// Admin test mode: use the app as made-up members. Each browser tab keeps its own
// test person, so the host and participants can sit side by side on one screen.
const switchTo=(id:string|null)=>{setTestUser(id);location.reload();};
const openTab=(id:string)=>window.open(location.origin+'/?testas='+encodeURIComponent(id),'_blank');
const reset=async()=>{if(!confirm('Ta bort alla testpersoner och testprovningar?'))return;await api('/api/members',{action:'test-reset'});switchTo(null);};

export function TestBar({current,onFill}:{current:any;onFill:()=>void}){
 const id=testUser();
 return <div className="test-bar" role="region" aria-label="Testläge">
  <FlaskConical size={16}/><b>Testläge</b><span className="test-bar-label">Du ser appen som</span>
  <select aria-label="Testperson" value={id||''} onChange={e=>switchTo(e.target.value)}>{TEST_USERS.map(u=><option key={u.id} value={u.id}>{u.name}{u.id==='test:host'?' (värd)':''}</option>)}</select>
  <span className="test-bar-tabs">Öppna i ny flik: {TEST_USERS.filter(u=>u.id!==id).map(u=><button key={u.id} className="text-button" onClick={()=>openTab(u.id)}>{u.name.split(' ')[0]}<ExternalLink size={12}/></button>)}</span>
  {current?.host&&current.status==='active'&&<button className="text-button" onClick={onFill}><Dice5 size={14}/>Slumpa betyg på provet åt de andra</button>}
  <button className="text-button test-bar-reset" onClick={reset}><Trash2 size={14}/>Rensa testdata</button>
  <button className="text-button" onClick={()=>switchTo(null)}><X size={14}/>Avsluta</button>
 </div>;
}

export function TestModePanel(){
 const start=async()=>{await api('/api/members',{action:'test-setup'});switchTo('test:host');};
 return <section className="panel"><div className="eyebrow">ADMINISTRATION</div><h2>Testläge</h2>
  <p className="muted fine">Prova appen som värd och deltagare utan fler enheter. Du får en testvärd och tre testdeltagare och kan växla mellan dem, eller öppna var och en i en egen flik. Testpersonerna syns bara i testläget, och deras provningar hamnar aldrig i arkivet eller statistiken. Som testperson ser du appen som en vanlig medlem, utan administration.</p>
  <div className="row"><button className="primary small" onClick={start}><FlaskConical size={15}/>Starta testläget</button><button className="secondary small" onClick={reset}><Trash2 size={15}/>Rensa testdata</button></div>
 </section>;
}
