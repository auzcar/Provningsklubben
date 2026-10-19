/** Display taxonomy only. Original type, serving and ratings are never rewritten. */
export const categoryOrder=['Öl','Vin','Whisky','Rom','Gin','Tequila','Cognac','Calvados','Punsch','Cider','Tonic','Drinkar','Alkoläsk','Övrigt'];
export const beerGroupOrder=['Lager & pilsner','Ale','IPA & APA','Veteöl','Stout & porter','Suröl','Bocköl','Okänd ölstil'];
function categoryOf(text:string):string|null{
 const t=text.toLocaleLowerCase('sv');
 if(/tonic/.test(t))return 'Tonic';
 if(/alkol[äö]sk/.test(t))return 'Alkoläsk';
 if(/drink|cocktail/.test(t))return 'Drinkar';
 if(/whisk[ye]|single malt|blended|bourbon/.test(t))return 'Whisky';
 if(/calvados/.test(t))return 'Calvados';
 if(/cognac|konjak/.test(t))return 'Cognac';
 if(/tequila|mezcal/.test(t))return 'Tequila';
 if(/punsch/.test(t))return 'Punsch';
 if(/cider/.test(t))return 'Cider';
 if(/\brom\b|\brum\b|sockerrör/.test(t))return 'Rom';
 if(/\bgin\b/.test(t))return 'Gin';
 if(/vin|bubbel|mousserande|rosé|cava|champagne|crémant|cremant|prosecco/.test(t))return 'Vin';
 if(/öl|lager|pilsner|\bipa\b|\bapa\b|\bale\b|stout|porter|bock|weisse/.test(t))return 'Öl';
 return null;
}
export function drinkCategory(sample:{type?:string;session?:string;serving?:string;sessionId?:string}){
 const t=(sample.type||'').toLocaleLowerCase('sv');
 const context=(sample.session||'').toLocaleLowerCase('sv');
 // Imported sheets mix origin, grapes and ingredients into the type column.
 const category=sample.sessionId?.startsWith('history-')?(categoryOf(context)||categoryOf(t)||'Övrigt'):(categoryOf(t)||categoryOf(context)||'Övrigt');
 let subcategory='';
 if(category==='Öl'){
 if(/ipa|\bapa\b/.test(t))subcategory='IPA & APA';
 else if(/suröl|berliner|gose|lambic/.test(t))subcategory='Suröl';
 else if(/vete|weiss|wheat/.test(t))subcategory='Veteöl';
 else if(/stout|porter/.test(t))subcategory='Stout & porter';
 else if(/bock/.test(t))subcategory='Bocköl';
 else if(/lager|pilsner|mellanmörk/.test(t))subcategory='Lager & pilsner';
 else if(/ale/.test(t))subcategory='Ale';
 else subcategory='Okänd ölstil';
 }else if(category==='Vin'){
 const combined=t+' '+context;
 if(/bubbel|mousserande|cava|champagne|crémant|cremant|prosecco/.test(combined))subcategory='Mousserande vin';
 else if(/rosé/.test(combined))subcategory='Rosévin';
 else if(/vitt|vitvin|chardonnay|riesling|pinot gris|sauvignon blanc/.test(combined))subcategory='Vitt vin';
 else if(/rött|röda|rödvin|pinot noir|barbera|merlot|montepulciano|cabernet/.test(combined))subcategory='Rött vin';
 }else if(category==='Whisky'){
 if(/single malt|maltwhisky/.test(t))subcategory='Single malt';else if(/blended/.test(t))subcategory='Blended';else if(/bourbon/.test(t))subcategory='Bourbon';
 }else if(category==='Rom'){
 if(/mörk/.test(t))subcategory='Mörk rom';else if(/ljus|vit rom/.test(t))subcategory='Ljus rom';
 }
 return {category,subcategory};
}
