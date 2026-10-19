'use client';
import {useEffect,useRef,useState} from 'react';
import {Wine,LoaderCircle} from 'lucide-react';
import Club from './club';
import {authHeaders,loadClerk,setTokenSource} from '@/lib/client-auth';

export type Me={id:string;name:string;admin:boolean;avatar:number};
type State={phase:'loading'|'signin'|'blocked'|'ready'|'error';mode?:string;me?:Me|null;message?:string};

async function session():Promise<any>{const r=await fetch('/api/session',{headers:await authHeaders(),cache:'no-store'});return {status:r.status,...(await r.json() as object)};}

// Clerk mode: nothing loads until Clerk has signed the member in and the server
// accepts the token. Sign-up only works through an invitation link (Restricted mode in Clerk).
export default function AuthGate(){
 const [state,setState]=useState<State>({phase:'loading'});const [clerk,setClerk]=useState<any>(null);const mount=useRef<HTMLDivElement>(null);
 const check=async()=>{const s=await session();if(s.me)setState({phase:'ready',mode:s.auth.mode,me:s.me});else if(s.status===403)setState({phase:'blocked',mode:s.auth.mode,message:s.error});else if(s.auth.mode==='clerk')setState({phase:'signin',mode:'clerk'});else setState({phase:'ready',mode:s.auth.mode,me:null});};
 useEffect(()=>{(async()=>{
  const first=await session();
  if(first.auth.mode!=='clerk')return check();
  if(!first.auth.publishableKey)throw Error('Inloggningen är inte konfigurerad.');
  const c=await loadClerk(first.auth.publishableKey);setClerk(c);
  setTokenSource(async()=>c.session?(await c.session.getToken()):null);
  let signedIn=!!c.user;
  c.addListener(({user}:any)=>{const now=!!user;if(now!==signedIn){signedIn=now;check().catch(e=>setState({phase:'error',message:e.message}));}});
  await check();
 })().catch(e=>setState({phase:'error',message:e.message}));},[]);
 useEffect(()=>{
  const c=clerk,el=mount.current;if(state.phase!=='signin'||!c||!el)return;
  const ticket=new URLSearchParams(location.search).has('__clerk_ticket');
  if(ticket)c.mountSignUp(el,{signInUrl:'/',forceRedirectUrl:'/'});else c.mountSignIn(el,{signUpUrl:'/',forceRedirectUrl:location.pathname+location.search});
  return()=>{if(ticket)c.unmountSignUp(el);else c.unmountSignIn(el);};
 },[state.phase,clerk]);
 const signOut=state.mode==='clerk'&&clerk?()=>clerk.signOut({redirectUrl:'/'}):undefined;
 if(state.phase==='ready')return <Club me={state.me||null} signOut={signOut}/>;
 return <div className="gate"><div className="gate-card"><a href="/" className="brand"><span className="brand-mark"><Wine size={24}/></span><span>Provnings<br/><b>klubben.</b></span></a>
  {state.phase==='loading'&&<div className="loading"><LoaderCircle className="spin"/>Hämtar klubben…</div>}
  {state.phase==='signin'&&<><div className="eyebrow">ENDAST FÖR MEDLEMMAR</div><h1>Välkommen in</h1><p className="intro">Logga in med kontot du fick inbjudan till. Nya medlemmar bjuds in av klubbens administratör.</p><div ref={mount} className="clerk-mount"/></>}
  {state.phase==='blocked'&&<><h1>Ingen åtkomst</h1><p className="intro">{state.message}</p>{signOut&&<button className="secondary" onClick={signOut}>Logga ut</button>}</>}
  {state.phase==='error'&&<><h1>Något gick fel</h1><p className="intro">{state.message}</p><button className="secondary" onClick={()=>location.reload()}>Försök igen</button></>}
 </div></div>;
}
