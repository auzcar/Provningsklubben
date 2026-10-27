// The evening's running order: every drink in tasting order, with snacks, a meal, breaks or
// anything else placed between them. Drinks keep fixed slots that follow the tasting order
// (the samples list), so reordering drinks anywhere keeps the program consistent; notes and
// paired snacks travel with the drink.
export type ProgramKind='drink'|'snack'|'meal'|'break'|'other';
export type ProgramItem={id:string;kind:ProgramKind;sample?:string;title:string;time:string;notes:string;snacks:string[]};
export const KINDS:{kind:Exclude<ProgramKind,'drink'>;label:string;title:string;minutes:number}[]=[
 {kind:'snack',label:'Tilltugg',title:'Tilltugg',minutes:5},
 {kind:'meal',label:'Måltid',title:'Middag',minutes:60},
 {kind:'break',label:'Paus',title:'Paus',minutes:10},
 {kind:'other',label:'Annat',title:'',minutes:10},
];
export const DRINK_MINUTES=15;
export const kindLabel=(k:ProgramKind)=>k==='drink'?'Prov':KINDS.find(x=>x.kind===k)?.label||'Annat';
const isKind=(k:any):k is ProgramKind=>k==='drink'||KINDS.some(x=>x.kind===k);

export function normalizeProgram(items:any,samples:{id:string}[],snackIds:string[]):ProgramItem[]{
 const text=(x:any,n:number)=>String(x??'').slice(0,n);
 const known=new Set(snackIds),ids=new Set(samples.map(s=>s.id)),seen=new Set<string>(),drinks=new Map<string,ProgramItem>();
 const list:ProgramItem[]=[];
 for(const x of Array.isArray(items)?items.slice(0,200):[]){
  if(!x||!isKind(x.kind))continue;
  const time=text(x.time,5).trim();
  const item:ProgramItem={id:text(x.id,80)||crypto.randomUUID(),kind:x.kind,title:text(x.title,120),time:/^([01]\d|2[0-3]):[0-5]\d$/.test(time)?time:'',notes:text(x.notes,1000),snacks:[...new Set<string>((Array.isArray(x.snacks)?x.snacks:[]).map(String))].filter(id=>known.has(id))};
  if(x.kind==='drink'){const s=String(x.sample||'');if(!ids.has(s)||seen.has(s))continue;seen.add(s);item.sample=s;item.title='';drinks.set(s,item);}
  list.push(item);
 }
 for(const s of samples)if(!seen.has(s.id)){const item:ProgramItem={id:'drink-'+s.id,kind:'drink',sample:s.id,title:'',time:'',notes:'',snacks:[]};drinks.set(s.id,item);list.push(item);}
 // The k-th drink slot holds the k-th sample.
 let k=0;return list.map(it=>it.kind==='drink'?drinks.get(samples[k++].id)!:it);
}
// Moving an item in the program; when two drinks pass each other the tasting order follows.
export function moveItem<S extends {id:string}>(program:ProgramItem[],samples:S[],index:number,dir:number){
 const to=index+dir;if(to<0||to>=program.length)return {program,samples};
 const p=[...program];[p[index],p[to]]=[p[to],p[index]];
 const order=p.filter(it=>it.kind==='drink').map(it=>it.sample);
 const byId=new Map(samples.map(s=>[s.id,s]));
 return {program:p,samples:order.map(id=>byId.get(id!)!).filter(Boolean)};
}
// Suggested clock times from the start time, with a typical length per kind of item.
export function suggestTimes(program:ProgramItem[],start:string){
 if(!/^\d{2}:\d{2}$/.test(start))return program;
 let t=Number(start.slice(0,2))*60+Number(start.slice(3,5));
 return program.map(it=>{const time=`${String(Math.floor(t/60)%24).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;t+=it.kind==='drink'?DRINK_MINUTES:KINDS.find(x=>x.kind===it.kind)!.minutes;return {...it,time};});
}
