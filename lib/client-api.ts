import {authHeaders} from '@/lib/client-auth';
export async function api(path:string,body?:any){const r=await fetch(path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...await authHeaders()},body:body?JSON.stringify(body):undefined,cache:'no-store'});const d:any=await r.json();if(!r.ok||d.error)throw Error(d.error||'Något gick fel.');return d;}
