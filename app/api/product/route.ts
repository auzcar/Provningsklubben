import {env} from 'cloudflare:workers';
import {requireMember,fail} from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(r:Request){
 try{await requireMember(r,env);}catch(e){return fail(e)}
 let q=new URL(r.url).searchParams.get('q')?.trim()||'';
 if(q.startsWith('https://')){try{const u=new URL(q);if(u.hostname!=='www.systembolaget.se'&&u.hostname!=='systembolaget.se')throw Error();q=u.pathname.match(/-(\d+)\/?$/)?.[1]||'';}catch{q='';}}
 if(!/^\d{1,9}$/.test(q))return Response.json({error:'Ange artikelnummer eller en produktlänk från Systembolaget.'},{status:400});
 const ids=[...new Set([q,q+'01',q+'02',q+'03',q+'15',q+'12'])];
 const found=await Promise.all(ids.map(async id=>{
 let p:any=null,source='',productUrl='';
 try{const res=await fetch('https://www.systembolaget.se/produkt/ovrigt/dryck-'+id+'/',{signal:AbortSignal.timeout(7000)});if(res.ok){const html=await res.text();const match=html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);if(match){const page=JSON.parse(match[1])?.props?.pageProps;p=Object.values(page?.fallback||{}).find((v:any)=>v&&String(v.productNumber)===id);if(p){source='Systembolagets produktsida';productUrl=page.seo?.canonical||res.url;}}}}catch{}
 if(!p){try{const res=await fetch('https://susbolaget.emrik.org/v1/product/'+id,{signal:AbortSignal.timeout(5000)});if(res.ok){p=await res.json();source='Systembolaget-data via susbolaget.emrik.org (inofficiell reservkälla)';}}catch{}}
 if(!p||(String(p.productNumber)!==q&&String(p.productNumberShort)!==q))return null;
 return {name:[p.productNameBold,p.productNameThin].filter(Boolean).join(' '),article:p.productNumber,type:p.customCategoryTitle||p.categoryLevel2||'',price:p.priceInclVat??p.price??null,volume:p.volume?Number(p.volume)/10:null,abv:p.alcoholPercentage??null,country:p.country||'',producer:p.producerName||'',vintage:p.vintage?String(p.vintage):'',grapes:Array.isArray(p.grapes)?p.grapes.map((v:any)=>typeof v==='string'?v:v.description||v.name||'').filter(Boolean).join(', '):'',taste:p.taste||'',aroma:p.aroma||'',color:p.color||'',sugar:p.sugarContentGramPer100ml??null,image:p.images?.[0]?.imageUrl||'',serving:p.usage||'',source,productUrl,fetchedAt:new Date().toISOString(),discontinued:!!p.isDiscontinued};
 }));
 const products=found.filter(Boolean);return Response.json({products,...(!products.length?{error:'Ingen träff. Prova fullständigt artikelnummer eller fyll i manuellt. Datakällorna kan också vara tillfälligt otillgängliga.'}:{})},{headers:{'Cache-Control':'private, max-age=300'}});
}
