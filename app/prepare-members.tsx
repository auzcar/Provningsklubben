'use client';
import {useRef,useState} from 'react';
import {Camera,UserPlus,Trash2,Pencil,Mail,MailCheck} from 'lucide-react';
import PhotoCrop from './photo-crop';

// Admin: prepare a friend's profile (name, archive names, photo) before they ever sign in.
// It is applied automatically the first time someone signs in with that verified email.
export default function PrepareMembers({data,run,busy}:{data:any;run:(body:any,done?:string)=>Promise<boolean>;busy:boolean}){
 const blank={email:'',previous:'',name:'',historyNames:[] as string[],photo:'',image:'',keepPhoto:false};
 const [f,setF]=useState(blank);const [err,setErr]=useState('');const [crop,setCrop]=useState<Blob|null>(null);const file=useRef<HTMLInputElement>(null);
 const prepared:any[]=data.prepared||[];
 // Emails with a pending Clerk invitation, so a prepared member is invited only once.
 const invited=new Set<string>((data.invitations||[]).map((i:any)=>String(i.email).toLowerCase()));
 const taken=new Set<string>([...data.members.flatMap((m:any)=>m.historyNames||[]),...prepared.filter(p=>p.email!==(f.previous||f.email)).flatMap((p:any)=>p.historyNames)]);
 const pick=(x?:File)=>{if(file.current)file.current.value='';if(!x)return;if(!x.type.startsWith('image/'))return setErr('Välj en bildfil.');setErr('');setCrop(x);};
 const save=async()=>{if(await run({action:'prepare',email:f.email,previous:f.previous||undefined,name:f.name,historyNames:f.historyNames,image:f.image||undefined,keepPhoto:f.keepPhoto},`${f.name} är förberedd.`))setF(blank);};
 return <section className="panel"><div className="eyebrow">ADMINISTRATION</div><h2>Förbered medlemmar</h2>
  <p className="muted fine">Lägg in namn, bild och namn i arkivet i förväg. Inget skickas till personen förrän du trycker Bjud in. När hen loggar in första gången med samma e-postadress kopplas allt automatiskt till profilen, så att deras gamla betyg och bild finns där direkt.</p>
  <div className="prepare-form">
   <button type="button" className="prepare-photo" onClick={()=>file.current?.click()} aria-label="Välj bild">{f.photo?<img src={f.photo} alt=""/>:<Camera size={22}/>}</button>
   <input ref={file} type="file" accept="image/*" hidden onChange={e=>pick(e.target.files?.[0])}/>
   <div className="prepare-fields">
    <label className="field"><span>E-post</span><input type="email" value={f.email} placeholder="kompis@exempel.se" onChange={e=>setF({...f,email:e.target.value})}/></label>
    <label className="field"><span>Namn</span><input value={f.name} maxLength={60} onChange={e=>setF({...f,name:e.target.value})}/></label>
   </div>
  </div>
  {data.archiveNames?.length>0&&<><span className="muted fine">Namn i arkivet</span><div className="chip-row">{data.archiveNames.map((n:string)=>{const on=f.historyNames.includes(n);return <button type="button" key={n} disabled={taken.has(n)&&!on} className={'chip'+(on?' on':'')} title={taken.has(n)&&!on?'Kopplat till någon annan':undefined} onClick={()=>setF({...f,historyNames:on?f.historyNames.filter(x=>x!==n):[...f.historyNames,n]})}>{n}</button>;})}</div></>}
  <div className="row"><button className="primary small" disabled={busy||!f.email||!f.name} onClick={save}><UserPlus size={15}/>Spara förberedelse</button>{f.email&&<button className="text-button" onClick={()=>setF(blank)}>Rensa</button>}</div>
  {err&&<p className="inline-error">{err}</p>}
  {crop&&<PhotoCrop source={crop} onCancel={()=>setCrop(null)} onDone={image=>{setF({...f,image,photo:image,keepPhoto:false});setCrop(null);}}/>}
  {prepared.length>0&&<ul className="prepared-list">{prepared.map(p=><li key={p.email}>
   <span className="avatar" style={{width:40,height:40}}>{p.photo?<img src={p.photo} alt=""/>:p.name.slice(0,1)}</span>
   <span><b>{p.name}</b><small>{p.email}{p.historyNames.length?' · '+p.historyNames.join(', '):''}</small></span>
   {data.mode==='clerk'&&(invited.has(p.email)?<span className="muted fine prepared-invited"><MailCheck size={14}/>Inbjuden</span>
    :<button className="text-button" disabled={busy} onClick={()=>run({action:'invite',email:p.email},'Inbjudan skickad till '+p.name+'.')}><Mail size={14}/>Bjud in</button>)}
   <button className="icon-button" aria-label={'Ändra '+p.name} onClick={()=>setF({email:p.email,previous:p.email,name:p.name,historyNames:p.historyNames,photo:p.photo,image:'',keepPhoto:!!p.photo})}><Pencil size={14}/></button>
   <button className="icon-button" aria-label={'Ta bort förberedelsen för '+p.name} onClick={()=>confirm(`Ta bort förberedelsen för ${p.name}?`)&&run({action:'unprepare',email:p.email},'Förberedelsen är borttagen.')}><Trash2 size={14}/></button>
  </li>)}</ul>}
 </section>;
}
