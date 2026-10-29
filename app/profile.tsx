'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,Trash2,Pencil,LoaderCircle,ChevronRight,Star,CalendarDays,LogOut} from 'lucide-react';
import {api} from '@/lib/client-api';
import {authHeaders} from '@/lib/client-auth';
import type {Me} from './auth-gate';
import SbLink from './sb-link';
import MyRatings from './my-ratings';
import CalendarSubscribe from './calendar-subscribe';

const fmt=(n:any,d=2)=>n==null?'–':Number(n).toLocaleString('sv-SE',{maximumFractionDigits:d});
const statusName:any={draft:'Planering',active:'Pågår',revealed:'Avslöjad'};

// Avatar images need the auth header, so they are fetched as blobs and cached per version.
const cache=new Map<string,Promise<string|null>>();
function avatarUrl(user:string,version:number){
 const key=user+':'+version;
 if(!cache.has(key))cache.set(key,(async()=>{const r=await fetch('/api/avatar?user='+encodeURIComponent(user)+'&v='+version,{headers:await authHeaders()});return r.ok?URL.createObjectURL(await r.blob()):null;})().catch(()=>null));
 return cache.get(key)!;
}
export function Avatar({user,version,name,size=44}:{user:string;version:number;name:string;size?:number}){
 const key=user+':'+version;const [loaded,setLoaded]=useState<{key:string;src:string|null}>({key:'',src:null});
 useEffect(()=>{let live=true;if(version)avatarUrl(user,version).then(src=>{if(live)setLoaded({key:user+':'+version,src});});return()=>{live=false;};},[user,version]);
 const src=version&&loaded.key===key?loaded.src:null;
 const initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase()||'?';
 return <span className="avatar" style={{width:size,height:size,fontSize:size*.38}} aria-hidden="true">{src?<img src={src} alt=""/>:initials}</span>;
}

// Crop to a square and shrink in the browser so uploads stay small.
export async function resize(file:File){
 if(!file.type.startsWith('image/'))throw Error('Välj en bildfil.');
 const bitmap=await createImageBitmap(file);const side=Math.min(bitmap.width,bitmap.height),out=320;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=out;
 canvas.getContext('2d')!.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,out,out);
 return canvas.toDataURL('image/jpeg',.85);
}

export function Profile({user,me,openTasting,onSaved,signOut}:{user:string;me:Me;openTasting:(id:string)=>void;onSaved:(p:any)=>void;signOut?:()=>void}){
 const [data,setData]=useState<any>(null);const [error,setError]=useState('');const [editing,setEditing]=useState(false);const [name,setName]=useState('');const [bio,setBio]=useState('');const [swish,setSwish]=useState('');const [busy,setBusy]=useState(false);const [expanded,setExpanded]=useState('');const file=useRef<HTMLInputElement>(null);
 useEffect(()=>{api('/api/profile?user='+encodeURIComponent(user)).then(setData).catch(e=>setError(e.message));},[user]);
 const save=async(body:any)=>{setBusy(true);setError('');try{const d=await api('/api/profile',body);setData(d);setEditing(false);onSaved(d.profile);}catch(e:any){setError(e.message);}finally{setBusy(false);}};
 const upload=async(f?:File)=>{if(!f)return;try{await save({action:'avatar',image:await resize(f)});}catch(e:any){setError(e.message);}finally{if(file.current)file.current.value='';}};
 if(error&&!data)return <div className="empty"><h3>{error}</h3></div>;
 if(!data)return <div className="loading"><LoaderCircle className="spin"/>Hämtar profilen…</div>;
 const p=data.profile;
 return <>
  <section className="profile-head">
   <div className="profile-photo"><Avatar user={p.id} version={p.avatar} name={p.name} size={112}/>{p.own&&<div className="row photo-actions"><button className="text-button" disabled={busy} onClick={()=>file.current?.click()}><Camera size={14}/>{p.avatar?'Byt bild':'Lägg till bild'}</button>{p.avatar>0&&<button className="text-button" disabled={busy} onClick={()=>save({action:'remove-avatar'})}><Trash2 size={14}/>Ta bort</button>}<input ref={file} type="file" accept="image/*" hidden onChange={e=>upload(e.target.files?.[0])}/></div>}</div>
   <div className="profile-text">
    <div className="eyebrow">{p.admin?'ADMINISTRATÖR':'MEDLEM'}{p.own?' · DIN PROFIL':''}</div>
    {editing?<div className="profile-edit"><label className="field"><span>Namn</span><input value={name} maxLength={60} onChange={e=>setName(e.target.value)}/></label><label className="field"><span>Om mig</span><textarea rows={3} maxLength={600} value={bio} placeholder="Favoritdrycker, smakpreferenser…" onChange={e=>setBio(e.target.value)}/></label><label className="field"><span>Swishnummer</span><input inputMode="tel" value={swish} placeholder="070-123 45 67" onChange={e=>setSwish(e.target.value)}/><small className="muted">Visas bara för deltagarna i provningar där du är värd, så att de kan swisha sin andel.</small></label><div className="row"><button className="primary small" disabled={busy} onClick={()=>save({action:'update',name,bio,swish})}>Spara</button><button className="secondary small" onClick={()=>setEditing(false)}>Avbryt</button></div></div>
    :<><h1>{p.name}</h1>{p.bio?<p className="intro">{p.bio}</p>:p.own&&<p className="intro">Berätta gärna lite om din smak.</p>}{p.own&&<div className="row"><button className="text-button" onClick={()=>{setName(p.name);setBio(p.bio);setSwish(p.swish||'');setEditing(true);}}><Pencil size={14}/>Redigera profil</button>{signOut&&!me.tester&&<button className="text-button" onClick={signOut}><LogOut size={14}/>Logga ut</button>}</div>}</>}
    {error&&<p className="inline-error">{error}</p>}
   </div>
  </section>
  <section className="stats"><div><span className="stat-number">{data.stats.tastings}</span><p>provningar</p></div><div><span className="stat-number">{data.stats.ratings}</span><p>betygsatta drycker</p></div><div><span className="stat-number">{fmt(data.stats.average,1)}</span><p>snittbetyg</p></div></section>
  {p.own&&!me.tester&&<CalendarSubscribe/>}
  {data.upcoming.length>0&&<section className="profile-section"><div className="section-head"><div><div className="eyebrow">PÅ GÅNG</div><h2>Dina kommande provningar</h2></div></div><div className="session-grid">{data.upcoming.map((s:any)=><button className="session-card" key={s.id} onClick={()=>openTasting(s.id)}><span className={'badge '+s.status}>{statusName[s.status]}</span><h3>{s.title}</h3><p><CalendarDays size={15}/>{s.date||'Datum inte bestämt'}</p></button>)}</div><p className="muted fine">Betyg från pågående provningar syns först när provningen avslöjas.</p></section>}
  {data.favorites.length>0&&<section className="profile-section"><div className="eyebrow">HÖGST BETYG</div><h2>Favoriter</h2><div className="favorites">{data.favorites.map((f:any,i:number)=><div className="favorite" key={f.id+i}><Star size={15}/><div><strong>{f.name||'Namn saknas'}</strong><small>{f.session}</small></div><span className="rating-pill">{fmt(f.score)}</span><SbLink drink={f}/></div>)}</div></section>}
  <MyRatings tastings={data.tastings} own={p.own} viewer={me.id}/>
  <section className="profile-section"><div className="eyebrow">TIDIGARE PROVNINGAR</div><h2>Provningar och betyg</h2>
   {data.tastings.length?<div className="archive-table">{data.tastings.map((t:any)=><article className="archive-row" key={t.id}><button className="table-row" aria-expanded={expanded===t.id} onClick={()=>setExpanded(expanded===t.id?'':t.id)}><div><strong>{t.title}</strong><small>{t.date||'Datum saknas'} · {t.source==='archive'?'Ur arkivet':t.host?'Värd':'Deltagare'}</small></div><span>{t.samples.filter((x:any)=>x.rated).length} betyg</span><span className="rating-pill">{fmt(avg(t.samples))}</span><ChevronRight size={17}/></button>
    {expanded===t.id&&<div className="detail">{t.source==='app'&&p.own&&<button className="text-button" onClick={()=>openTasting(t.id)}>Öppna provningen <ChevronRight size={14}/></button>}<div className="ratings-grid">{t.samples.map((x:any)=><div className="person-score" key={x.id}><span>{x.number?'Prov '+x.number+' · ':''}{x.name||'Namn saknas'}</span><strong>{!x.rated?'–':x.skip?'Avstår':fmt(x.score)}</strong><small className="muted">Gruppen {fmt(x.average)}</small>{x.comment&&<p>{x.comment}</p>}<SbLink drink={x} label/></div>)}</div></div>}</article>)}</div>
   :<div className="empty"><h3>Inga avslöjade provningar ännu.</h3><p>{p.own?'Dina betyg samlas här när provningar avslöjas.':'Betygen visas när medlemmen deltagit i en avslöjad provning.'}{me.admin&&!p.historyNames.length?' Koppla medlemmens namn i arkivet under Medlemmar för att visa äldre betyg.':''}</p></div>}
  </section>
 </>;
}
const avg=(samples:any[])=>{const s=samples.filter(x=>x.rated&&x.score!=null).map(x=>x.score);return s.length?s.reduce((a,b)=>a+b,0)/s.length:null;};
