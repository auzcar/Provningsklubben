// Members prepared by the admin before their first sign-in (Medlemmar → Förbered medlem).
// When a new profile is created with the same verified email, the prepared name, archive
// names and photo are applied once and the preparation is removed.
export async function applyPending(db:D1Database,user:string,email:string){
 if(!email)return false;
 const p:any=await db.prepare('SELECT * FROM pending_profiles WHERE email=?').bind(email.toLowerCase()).first();if(!p)return false;
 const stmts=[db.prepare('UPDATE profiles SET name=?,history_names=? WHERE user=?').bind(p.name,p.history_names,user),db.prepare('DELETE FROM pending_profiles WHERE email=?').bind(p.email)];
 if(p.avatar)stmts.push(db.prepare('INSERT INTO avatars(user,mime,data) VALUES(?,?,?) ON CONFLICT(user) DO UPDATE SET mime=excluded.mime,data=excluded.data').bind(user,p.mime,p.avatar),db.prepare('UPDATE profiles SET avatar_version=avatar_version+1 WHERE user=?').bind(user));
 await db.batch(stmts);return true;
}
