import {ArrowUpRight} from 'lucide-react';
import {systembolagetUrl} from '@/lib/model';

// Small link to the drink at Systembolaget: product page if saved, else a search.
// Never used in tasting mode, where drinks must stay anonymous.
export default function SbLink({drink,label=false}:{drink:{productUrl?:string;article?:string;name?:string};label?:boolean}){
 const href=systembolagetUrl(drink);if(!href)return null;
 const text=drink.productUrl?'Visa på Systembolaget':'Sök på Systembolaget';
 return <a className={label?'text-button':'sb-inline'} href={href} target="_blank" rel="noreferrer" aria-label={label?undefined:`${text}: ${drink.name||'drycken'}`} title={text} onClick={e=>e.stopPropagation()}>{label&&text}<ArrowUpRight size={label?14:15}/></a>;
}
