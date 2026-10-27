// Who takes which bottle home, from the blind ratings. Everyone aims for their favourite among
// the bottles still left; a bottle wanted by several goes to, in order:
//   1. the one who rated it furthest above their own average (generous raters do not win by default),
//   2. the one who would lose most by taking their next best bottle instead,
//   3. a draw.
// The others move on to their next best bottle, round by round. "Avstår" and a missing rating count
// as the lowest. If bottles and people do not add up, the leftovers are listed and the club decides.
export type Rating={user:string;sample:string;score:number|null};
export type Person={user:string;name:string};
export type Contest={sample:string;claimants:string[];winner:string;rule:'love'|'loss'|'draw';margin:number|null};
export type Assignment={user:string;sample:string;round:number;choice:number;contest:Contest|null};
export type Allocation={items:Assignment[];leftoverSamples:string[];leftoverPeople:string[]};

const LOW=-1e6;
export function allocate(people:Person[],samples:{id:string}[],ratings:Rating[],random:()=>number=Math.random):Allocation{
 const score=(u:string,s:string)=>{const r=ratings.find(x=>x.user===u&&x.sample===s);return r?.score==null?LOW:r.score;};
 const mean=(u:string)=>{const v=ratings.filter(x=>x.user===u&&x.score!=null).map(x=>x.score as number);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0;};
 const avg=new Map(people.map(p=>[p.user,mean(p.user)]));
 // A person's bottles from best to worst; equal scores keep the tasting order.
 const ranked=(u:string,left:string[])=>[...left].sort((a,b)=>score(u,b)-score(u,a)||samples.findIndex(s=>s.id===a)-samples.findIndex(s=>s.id===b));
 let left=samples.map(s=>s.id),waiting=people.map(p=>p.user);const items:Assignment[]=[];
 for(let round=1;waiting.length&&left.length;round++){
  const wants=new Map<string,string[]>();
  for(const u of waiting){const top=ranked(u,left)[0];wants.set(top,[...(wants.get(top)||[]),u]);}
  const won:string[]=[];
  for(const [sample,claimants] of wants){
   const choiceOf=(u:string)=>ranked(u,samples.map(s=>s.id)).indexOf(sample)+1;
   if(claimants.length===1){items.push({user:claimants[0],sample,round,choice:choiceOf(claimants[0]),contest:null});won.push(claimants[0]);continue;}
   const love=(u:string)=>score(u,sample)===LOW?LOW:score(u,sample)-avg.get(u)!;
   const loss=(u:string)=>{const next=ranked(u,left.filter(x=>x!==sample))[0];const a=score(u,sample),b=next==null?LOW:score(u,next);return a===LOW?0:a-(b===LOW?0:b);};
   const close=(a:number,b:number)=>Math.abs(a-b)<1e-9;
   let pool=[...claimants],rule:Contest['rule']='love',margin:number|null=null;
   const best=Math.max(...pool.map(love));const byLove=pool.filter(u=>close(love(u),best));
   if(byLove.length===1){const second=Math.max(...pool.filter(u=>u!==byLove[0]).map(love));margin=best-second;pool=byLove;}
   else{pool=byLove;rule='loss';const top=Math.max(...pool.map(loss));const byLoss=pool.filter(u=>close(loss(u),top));
    if(byLoss.length===1){const second=Math.max(...pool.filter(u=>u!==byLoss[0]).map(loss));margin=top-second;pool=byLoss;}
    else{rule='draw';pool=[byLoss[Math.floor(random()*byLoss.length)]];}}
   const winner=pool[0];
   items.push({user:winner,sample,round,choice:choiceOf(winner),contest:{sample,claimants,winner,rule,margin:margin==null?null:Math.round(margin*100)/100}});won.push(winner);
  }
  waiting=waiting.filter(u=>!won.includes(u));left=left.filter(s=>!items.some(i=>i.sample===s));
 }
 return {items,leftoverSamples:left,leftoverPeople:waiting};
}
