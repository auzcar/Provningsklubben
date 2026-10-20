// Statistics for "Är dyrare godare?". Verified against SciPy in scripts/test-stats.mjs.
//
// Prices differ hugely between drink types (a beer vs a cognac), so raw prices cannot be
// compared. Instead each drink is compared only with the drinks served in the same tasting
// (same evening, same jury, nearly always the same type): price and average score are
// centred within each tasting (fixed effects), and the score is regressed on log2 price.
// The slope reads "points per doubling of the price". Price is per litre when every
// drink in the tasting has a known volume.

function lnGamma(x:number):number{
 const c=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
 let y=x,tmp=x+5.5;tmp-=(x+0.5)*Math.log(tmp);let ser=1.000000000190015;for(const v of c)ser+=v/++y;
 return -tmp+Math.log(2.5066282746310005*ser/x);
}
function betacf(a:number,b:number,x:number){
 const MAXIT=300,EPS=3e-14,FPMIN=1e-300;let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap;if(Math.abs(d)<FPMIN)d=FPMIN;d=1/d;let h=d;
 for(let m=1;m<=MAXIT;m++){const m2=2*m;let aa=m*(b-m)*x/((qam+m2)*(a+m2));d=1+aa*d;if(Math.abs(d)<FPMIN)d=FPMIN;c=1+aa/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;h*=d*c;
  aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<FPMIN)d=FPMIN;c=1+aa/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<EPS)break;}
 return h;
}
/** Regularized incomplete beta I_x(a,b). */
export function ibeta(x:number,a:number,b:number){
 if(x<=0)return 0;if(x>=1)return 1;
 const bt=Math.exp(lnGamma(a+b)-lnGamma(a)-lnGamma(b)+a*Math.log(x)+b*Math.log(1-x));
 return x<(a+1)/(a+b+2)?bt*betacf(a,b,x)/a:1-bt*betacf(b,a,1-x)/b;
}
/** Two-sided p-value of Student's t. */
export function tPValue(t:number,df:number){return ibeta(df/(df+t*t),df/2,0.5);}
/** Two-sided critical value t such that P(|T|>t)=alpha. */
export function tCritical(df:number,alpha=0.05){let lo=0,hi=1000;for(let i=0;i<200;i++){const mid=(lo+hi)/2;if(tPValue(mid,df)>alpha)lo=mid;else hi=mid;}return (lo+hi)/2;}

export type PricedDrink={group:string;price:number;volume?:number|null;avg:number;category?:string};
export type PriceEffect={n:number;groups:number;df:number;slope:number;se:number;low:number;high:number;p:number;r:number;permP?:number};

// Centre log2(price) and score within each tasting group; groups with one drink carry no information.
function centre(drinks:PricedDrink[]){
 const groups=new Map<string,PricedDrink[]>();for(const d of drinks){if(!(d.price>0)||!Number.isFinite(d.avg))continue;const g=groups.get(d.group)||[];g.push(d);groups.set(d.group,g);}
 const x:number[]=[],y:number[]=[],gid:number[]=[];let k=0;
 for(const g of groups.values()){
  if(g.length<2)continue;const perLitre=g.every(d=>(d.volume||0)>0);
  const xs=g.map(d=>Math.log2(perLitre?d.price/(d.volume!/100):d.price)),ys=g.map(d=>d.avg);
  const mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
  xs.forEach((v,i)=>{x.push(v-mx);y.push(ys[i]-my);gid.push(k);});k++;
 }
 return {x,y,gid,groups:k};
}
// Small deterministic PRNG so the permutation p-value is stable between page loads.
function rng(seed:number){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}

/** Within-tasting regression of score on log2 price, with t-test, 95 % CI and an optional permutation p-value. */
export function priceEffect(drinks:PricedDrink[],permutations=0):PriceEffect|null{
 const {x,y,gid,groups}=centre(drinks);const n=x.length,df=n-groups-1;
 const sxx=x.reduce((a,v)=>a+v*v,0),syy=y.reduce((a,v)=>a+v*v,0),sxy=x.reduce((a,v,i)=>a+v*y[i],0);
 if(df<2||sxx===0||syy===0)return null;
 const slope=sxy/sxx,rss=y.reduce((a,v,i)=>a+(v-slope*x[i])**2,0),se=Math.sqrt(rss/df/sxx),t=slope/se,crit=tCritical(df);
 const out:PriceEffect={n,groups,df,slope,se,low:slope-crit*se,high:slope+crit*se,p:tPValue(t,df),r:sxy/Math.sqrt(sxx*syy)};
 if(permutations>0){
  // Shuffle prices within each tasting; counts how often chance alone gives a slope this large.
  const rand=rng(20261020),idx:number[][]=[];gid.forEach((g,i)=>{(idx[g]||=[]).push(i);});let hits=0;const xp=x.slice();
  for(let b=0;b<permutations;b++){for(const ii of idx){const vals=ii.map(i=>x[i]);for(let j=vals.length-1;j>0;j--){const r=Math.floor(rand()*(j+1));[vals[j],vals[r]]=[vals[r],vals[j]];}ii.forEach((i,j)=>{xp[i]=vals[j];});}
   const s=xp.reduce((a,v,i)=>a+v*y[i],0)/sxx;if(Math.abs(s)>=Math.abs(slope)-1e-12)hits++;}
  out.permP=(hits+1)/(permutations+1);
 }
 return out;
}
/** Holm–Bonferroni adjustment, keeps the input order. */
export function holm(ps:number[]){
 const order=ps.map((p,i)=>[p,i]).sort((a,b)=>a[0]-b[0]);const adj=new Array(ps.length);let run=0;
 order.forEach(([p,i],k)=>{run=Math.max(run,Math.min(1,(ps.length-k)*p));adj[i]=run;});return adj as number[];
}
