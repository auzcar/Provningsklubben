export type Sample={id:string;name:string;article:string;type:string;price:number|null;volume:number|null;abv:number|null;number:number;purchased:boolean;serving:string;image?:string;taste?:string;country?:string;vintage?:string;source?:string;fetchedAt?:string;producer?:string;aroma?:string;color?:string;grapes?:string;sugar?:number|null;productUrl?:string};
export type Plan={theme:string;notes:string;budget:number|null;expected:string[];participants:string[];samples:Sample[]};
export type Vote={score:number|null;skip:boolean;comment:string;tags?:string[];guess?:number|null};
// Quick tasting words shown as chips in tasting mode; counted at the reveal.
export const TASTE_TAGS=['Fruktig','Rökig','Söt','Torr','Kryddig','Syrlig','Bitter','Blommig','Nötig','Ekig','Citrus','Mjuk'];
export function validatePlan(p:any):Plan{
 if(!p||!Array.isArray(p.samples)||p.samples.length>50)throw Error('Högst 50 drycker per provning.');
 const text=(x:any,n=2000)=>String(x??'').slice(0,n);
 const num=(x:any,max:number)=>{if(x==null||x==='')return null;const n=Number(x);if(!Number.isFinite(n)||n<0||n>max)throw Error('Kontrollera sifferfälten.');return n;};
 const samples=p.samples.map((s:any,i:number)=>({...s,id:text(s.id,80),name:text(s.name,200),article:text(s.article,20),type:text(s.type,200),price:num(s.price,100000),volume:num(s.volume,50000),abv:num(s.abv,100),number:i+1,purchased:!!s.purchased,serving:text(s.serving),image:/^https:\/\/product-cdn.systembolaget.se\//.test(s.image||'')?s.image:'',taste:text(s.taste),country:text(s.country,100),vintage:text(s.vintage,50),source:text(s.source,200),fetchedAt:text(s.fetchedAt,80)}));
 if(new Set(samples.map((s:Sample)=>s.id)).size!==samples.length||samples.some((s:Sample)=>!s.id||!s.name.trim()))throw Error('Varje dryck behöver ett namn och ett unikt id.');
 return {theme:text(p.theme,100),notes:text(p.notes,5000),budget:num(p.budget,100000),expected:Array.isArray(p.expected)?p.expected.map((x:any)=>text(x,60).trim()).filter(Boolean).slice(0,40):[],participants:Array.isArray(p.participants)?[...new Set<string>(p.participants.map((x:any)=>text(x,200)).filter(Boolean))].slice(0,40):[],samples};
}
// Swish numbers: private mobile (07…) or business (123…), stored as plain digits.
export function normalizeSwish(input:any){
 let d=String(input??'').replace(/[\s\-()]/g,'');if(!d)return '';
 if(d.startsWith('+46'))d='0'+d.slice(3);else if(d.startsWith('0046'))d='0'+d.slice(4);
 if(!/^(07\d{8}|123\d{7})$/.test(d))throw Error('Ange ett Swishnummer som 070-123 45 67 eller 123 456 78 90.');
 return d;
}
/** Opens the Swish app with payee, amount and message filled in; the payer only confirms. */
export function swishLink(number:string,amount:number|null,message:string){
 const data={version:1,payee:{value:number},...(amount?{amount:{value:amount}}:{}),message:{value:message.slice(0,50),editable:true}};
 return 'swish://payment?data='+encodeURIComponent(JSON.stringify(data));
}
// Even split of the known bottle prices, rounded up to whole kronor.
export function costShare(samples:Sample[],people:number){const total=samples.reduce((n,s)=>n+(Number(s.price)||0),0);return {total,people,perPerson:people>0?Math.ceil(total/people):null};
}
export function validateVote(v:any):Vote{const score=v?.skip?null:Number(v?.score);if(!v?.skip&&(v?.score==null||v?.score===''||!Number.isFinite(score)||score!<0||score!>10))throw Error('Ange ett betyg mellan 0 och 10.');
 const tags=Array.isArray(v.tags)?[...new Set<string>(v.tags.filter((t:any)=>TASTE_TAGS.includes(t)))]:[];
 const g=v.guess==null||v.guess===''?null:Number(v.guess);if(g!==null&&(!Number.isFinite(g)||g<0||g>100000))throw Error('Prisgissningen måste vara ett belopp i kronor.');
 return {score,skip:!!v.skip,comment:String(v.comment||'').slice(0,2000),tags,guess:g===null?null:Math.round(g)};}
// Systembolaget returns image urls without size or extension; the files are served as <url>_400.png.
export function productImage(url?:string){if(!url)return '';return /\.(png|jpe?g|webp)(\?|$)/i.test(url)?url:url+'_400.png';}
// Link to Systembolaget: the saved product page, else a search on article number or name.
// A plain https link lets the Systembolaget app take over where the phone supports it.
export function systembolagetUrl(p:{productUrl?:string;article?:string;name?:string}){
 if(p.productUrl?.startsWith('https://www.systembolaget.se/'))return p.productUrl;
 const q=String(p.article||'').trim()||String(p.name||'').trim();
 return q?'https://www.systembolaget.se/sok/?textQuery='+encodeURIComponent(q):'';
}
export function visibleSamples(samples:Sample[],host:boolean,revealed:boolean){return host||revealed?samples:samples.map(s=>({id:s.id,number:s.number}));}
