'use client';
import {Check,Smartphone} from 'lucide-react';
import {swishLink} from '@/lib/model';

export const formatSwish=(n:string)=>n.startsWith('123')?`${n.slice(0,3)} ${n.slice(3,6)} ${n.slice(6,8)} ${n.slice(8)}`:`${n.slice(0,3)}-${n.slice(3,6)} ${n.slice(6,8)} ${n.slice(8)}`;

// The participant's share: opens Swish with everything filled in, then they tick it off.
// Swish has no payment requests for private persons, so this is the closest thing.
export function SwishPay({current,onPaid,busy}:{current:any;onPaid:(paid:boolean)=>void;busy:boolean}){
 const pay=current.pay;if(!pay)return null;
 const message=current.title.slice(0,50);
 return <section className={'swish-card'+(pay.paid?' paid':'')}>
  <div><div className="eyebrow">DIN ANDEL</div><strong>{pay.amount!=null?`${pay.amount.toLocaleString('sv-SE')} kr`:'Belopp saknas'}</strong><span>till {pay.to} · {formatSwish(pay.swish)}</span></div>
  <div className="swish-actions">
   {!pay.paid&&<a className="primary swish-button" href={swishLink(pay.swish,pay.amount,message)}><Smartphone size={17}/>Swisha {pay.to.split(' ')[0]}</a>}
   <label className="check swish-check"><input type="checkbox" checked={pay.paid} disabled={busy} onChange={e=>onPaid(e.target.checked)}/>{pay.paid?<><Check size={14}/>Du har swishat</>:'Jag har swishat'}</label>
  </div>
  {!pay.paid&&<small className="muted">Öppnar Swish med belopp och meddelandet ”{message}”. Fungerar på telefonen.</small>}
 </section>;
}

// Host view: who has marked themselves as paid.
export function HostPayments({current,openProfile}:{current:any;openProfile:()=>void}){
 const guests=current.people.filter((p:any)=>p.user!==current.self);
 if(!current.hostSwish)return <p className="swish-hint">Lägg in ditt Swishnummer på <button className="text-button" onClick={openProfile}>din profil</button> så får deltagarna en Swish-knapp med sin andel.</p>;
 if(!guests.length)return null;
 return <div className="swish-host"><h3>Swish</h3>{guests.map((p:any)=><div className="summary-line" key={p.user}><span>{p.name}</span><b className={p.paid?'paid-yes':'paid-no'}>{p.paid?'Betalat':'Inte än'}</b></div>)}<small>{guests.filter((p:any)=>p.paid).length} av {guests.length} har swishat {current.cost.perPerson!=null?`${current.cost.perPerson} kr`:''} till {formatSwish(current.hostSwish)}.</small></div>;
}
