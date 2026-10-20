// Imports a full backup from the app itself (format 2, lib/backup.ts), the private
// backup from the Sites export (recovery-data.json, format 1) or a bare history.json.
// Only inserts rows that do not exist yet, so a repeated import never overwrites
// anything. Sites tastings get the importing admin as host, because Sites user ids
// cannot sign in here.
import {BACKUP_TABLES} from '@/lib/backup';
const text=(x:any)=>typeof x==='string';
function session(s:any){if(!s||!text(s.id)||!text(s.title)||!Array.isArray(s.samples))throw Error('Filen innehåller en ogiltig provning.');return s;}
export function parseBackup(input:any){
 if(Array.isArray(input))return {historical:input.map(session),tastings:[],members:[],ratings:[]};
 if(input?.format===1&&input.tables&&Array.isArray(input.tables.historical)){
  const t=input.tables,rows=(k:string)=>Array.isArray(t[k])?t[k]:[];
  return {historical:rows('historical').map((r:any)=>session(typeof r.data==='string'?JSON.parse(r.data):r.data)),tastings:rows('tastings'),members:rows('members'),ratings:rows('ratings')};
 }
 throw Error('Okänt filformat. Välj en säkerhetskopia från appen, recovery-data.json eller history.json.');
}
// Format 2 restores every table as it was, including owners and profiles. D1 caps the
// number of queries per request (50 on the free plan), so rows go in as JSON chunks of
// about 500 kB, one statement per chunk, instead of one statement per row.
const CHUNK=500_000;
async function importFull(db:D1Database,input:any){
 const out:Record<string,number>={};
 for(const [t,cols] of Object.entries(BACKUP_TABLES)){
  const rows=input.tables[t];if(rows!=null&&!Array.isArray(rows))throw Error('Filen är skadad.');
  const chunks:string[][]=[];let size=0;
  for(const r of rows||[]){const v=JSON.stringify(cols.map(c=>r?.[c]??null));if(!chunks.length||size+v.length>CHUNK){chunks.push([]);size=0;}chunks[chunks.length-1].push(v);size+=v.length+1;}
  const sql=`INSERT OR IGNORE INTO ${t}(${cols.join(',')}) SELECT ${cols.map((_,k)=>`json_extract(value,'$[${k}]')`).join(',')} FROM json_each(?)`;
  out[t]=chunks.length?(await db.batch(chunks.map(c=>db.prepare(sql).bind('['+c.join(',')+']')))).reduce((n,r:any)=>n+(r.meta?.changes||0),0):0;
 }
 return out;
}
export async function importBackup(db:D1Database,input:any,admin:string){
 if(input?.format===2&&input.tables)return {full:await importFull(db,input)};
 const b=parseBackup(input);
 for(const t of b.tastings)if(![t.id,t.status,t.title,t.date,t.data,t.token].every(text))throw Error('Filen innehåller en ogiltig provning.');
 for(const r of [...b.members,...b.ratings])if(!text(r.session)||!text(r.user))throw Error('Filen innehåller ogiltiga deltagare.');
 const run=async(stmts:D1PreparedStatement[])=>(await db.batch(stmts)).reduce((n,r:any)=>n+(r.meta?.changes||0),0);
 return {
  historical:await run(b.historical.map(s=>db.prepare('INSERT OR IGNORE INTO historical(id,data) VALUES(?,?)').bind(s.id,JSON.stringify(s)))),
  tastings:b.tastings.length?await run(b.tastings.map((t:any)=>db.prepare('INSERT OR IGNORE INTO tastings(id,owner,status,title,date,data,token,version) VALUES(?,?,?,?,?,?,?,?)').bind(t.id,admin,t.status,t.title,t.date,t.data,t.token,Number(t.version)||1))):0,
  members:b.members.length?await run(b.members.map((m:any)=>db.prepare('INSERT OR IGNORE INTO members(session,user,name) VALUES(?,?,?)').bind(m.session,m.user,String(m.name||'')))):0,
  ratings:b.ratings.length?await run(b.ratings.map((r:any)=>db.prepare('INSERT OR IGNORE INTO ratings(session,user,sample,data) VALUES(?,?,?,?)').bind(r.session,r.user,r.sample,r.data))):0,
  total:{historical:b.historical.length,samples:b.historical.reduce((n,s)=>n+s.samples.length,0),ratings:b.historical.reduce((n,s)=>n+s.samples.reduce((m:number,p:any)=>m+(p.ratings?.length||0),0),0)},
 };
}
