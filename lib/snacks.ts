// Snacks for the evening as a grocery list, grouped by store section in the order you
// usually walk through a Swedish supermarket. The section is guessed from the name and
// the host can change it.
export const SECTIONS=[
 {key:'frukt',label:'Frukt & grönt'},
 {key:'brod',label:'Bröd'},
 {key:'chark',label:'Chark & deli'},
 {key:'ost',label:'Ost & mejeri'},
 {key:'skafferi',label:'Skafferi'},
 {key:'snacks',label:'Snacks & godis'},
 {key:'fryst',label:'Fryst'},
 {key:'dryck',label:'Dryck'},
 {key:'hushall',label:'Hushåll'},
 {key:'ovrigt',label:'Övrigt'},
] as const;
export type SectionKey=typeof SECTIONS[number]['key'];
export const sectionLabel=(k:string)=>SECTIONS.find(s=>s.key===k)?.label||'Övrigt';
export const isSection=(k:any):k is SectionKey=>SECTIONS.some(s=>s.key===k);

// Word stems per section, checked in this order (so "ostkex" lands under Skafferi via "kex"
// before "ost", and "chokladkaka" under Snacks & godis).
const RULES:[SectionKey,RegExp][]=[
 ['hushall',/servett|tandpet|plastglas|engångs|papper|folie|bakplåt|ljus\b|värmeljus|disk/],
 ['fryst',/\bis\b|isbit|glass|fryst|frys/],
 ['dryck',/vatten|kolsyr|läsk|tonic|juice|must|sodavatten|ramlösa|loka|cola|kaffe|\bte\b/],
 ['skafferi',/kex|knäck|kräcker|cracker|oliv|marmelad|sylt|honung|chutney|kapris|inlagd|pickles|senap|sardell|ansjovis|konserv|tapenade|hummus|pesto|krutong|kaviar/],
 ['snacks',/chips|nötter|nöt\b|mandel|mandlar|cashew|pistasch|jordnöt|popcorn|choklad|godis|praliné|lakrits|ostbåg|dipp|salta pinnar|snacks|tortilla/],
 ['ost',/(^|[^a-zåäö])ost|ost(ar|en|arna)?($|[^a-zåäö])|brie|chèvre|chevre|parmesan|cheddar|gorgonzola|manchego|halloumi|smör|grädd|crème|yoghurt|mjölk|keso|fraiche|fraîche/],
 ['chark',/salami|skinka|chark|korv|prosciutto|serrano|bresaola|lufttork|paté|pastej|rökt|lax|räkor|kyckling|kött|fisk|chorizo|deli/],
 ['brod',/bröd|baguette|ciabatta|focaccia|levain|tunnbröd|bagel|skorpor|grissini|kakor|bulle/],
 ['frukt',/druv|äpple|päron|fikon|dadl|bär|jordgubb|hallon|citron|lime|apelsin|melon|tomat|gurk|sallad|ört|basilika|persilja|rädis|morot|paprika|avokado|frukt|grönsak|lök|vitlök|svamp/],
];
export function guessSection(name:string):SectionKey{
 const n=name.toLowerCase();
 for(const [key,re] of RULES)if(re.test(n))return key;
 return 'ovrigt';
}
export const SNACK_IDEAS=['Chips','Salta nötter','Ost','Kex','Oliver','Mörk choklad','Charkuterier','Bröd','Vindruvor','Vatten','Is'];
