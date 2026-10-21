// Full database backup (format 2): every table, every column, as JSON. An admin can
// download it at any time, and with a BACKUPS KV binding the Worker also stores one every
// week (build/sites-worker.ts). Restore with Medlemmar → Importera historik, which only
// inserts missing rows and never overwrites (lib/import.ts).
export const BACKUP_TABLES={
 historical:['id','data'],
 tastings:['id','owner','status','title','date','data','token','version'],
 members:['session','user','name','paid'],
 ratings:['session','user','sample','data'],
 profiles:['user','name','email','role','status','bio','history_names','avatar_version','swish','created_at'],
 avatars:['user','mime','data'],
 shopping_items:['user','key','data','created_at'],
 pending_profiles:['email','name','history_names','mime','avatar','created_at'],
} as const;
export type Backup={format:2;created:string;tables:Record<string,Record<string,unknown>[]>};

// One D1 batch runs as a single transaction, so all tables come from the same moment.
export async function snapshot(db:D1Database):Promise<Backup>{
 const names=Object.keys(BACKUP_TABLES) as (keyof typeof BACKUP_TABLES)[];
 const res=await db.batch(names.map(t=>db.prepare(`SELECT ${BACKUP_TABLES[t].join(',')} FROM ${t}`)));
 return {format:2,created:new Date().toISOString(),tables:Object.fromEntries(names.map((t,i)=>[t,res[i].results as any[]]))};
}

// Weekly copies are kept for twelve weeks; D1 Time Travel covers the last days minute by minute.
const KEEP=12*7*24*3600;
export async function storeSnapshot(db:D1Database,kv:KVNamespace){
 const b=await snapshot(db);await kv.put('backup/'+b.created.slice(0,10)+'.json',JSON.stringify(b),{expirationTtl:KEEP});return b.created;
}
export async function listSnapshots(kv:KVNamespace){return (await kv.list({prefix:'backup/'})).keys.map(k=>k.name.slice(7,-5)).sort().reverse();}
