// Compiles routes and lib/ to .sites-runtime/tests with an in-memory D1 so tests
// exercise the real imports. `cloudflare:workers` resolves to globalThis.testEnv.
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const out=path.resolve('.sites-runtime/tests');
const url=f=>pathToFileURL(path.join(out,f)).href;
export function createDb(){
 const db=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+file,'utf8'));
 class Statement{constructor(sql,params=[]){this.sql=sql;this.params=params;}bind(...params){return new Statement(this.sql,params)}async first(){return db.prepare(this.sql).get(...this.params)||null}async all(){return {results:db.prepare(this.sql).all(...this.params)}}async run(){const r=db.prepare(this.sql).run(...this.params);return {meta:{changes:Number(r.changes)}}}}
 return {sqlite:db,DB:{prepare:s=>new Statement(s),batch:async a=>{const r=[];for(const s of a)r.push(await s.run());return r;}}};
}
function compile(src,dest){
 const code=fs.readFileSync(src,'utf8').replace(/from\s+['"]cloudflare:workers['"]/g,`from '${url('env.mjs')}'`).replace(/from\s+['"]@\/lib\/([\w-]+)['"]/g,(_,m)=>`from '${url('lib/'+m+'.mjs')}'`);
 fs.mkdirSync(path.dirname(path.join(out,dest)),{recursive:true});
 fs.writeFileSync(path.join(out,dest),ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
}
let ready=false;
export async function route(name,env){
 globalThis.testEnv=env;
 if(!ready){
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'env.mjs'),'export const env=new Proxy({},{get:(_,k)=>globalThis.testEnv[k]});\n');
  for(const f of fs.readdirSync('lib').filter(f=>f.endsWith('.ts')&&!f.endsWith('.d.ts')))compile('lib/'+f,'lib/'+f.replace(/\.ts$/,'.mjs'));
  for(const d of fs.readdirSync('app/api'))compile(`app/api/${d}/route.ts`,`api/${d}.mjs`);
  ready=true;
 }
 return import(url(`api/${name}.mjs`));
}
