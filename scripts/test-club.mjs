import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const db=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+file,'utf8'));
class Statement{constructor(sql,params=[]){this.sql=sql;this.params=params;}bind(...params){return new Statement(this.sql,params)}async first(){return db.prepare(this.sql).get(...this.params)||null}async all(){return {results:db.prepare(this.sql).all(...this.params)}}async run(){const r=db.prepare(this.sql).run(...this.params);return {meta:{changes:Number(r.changes)}}}}
globalThis.testEnv={DB:{prepare:s=>new Statement(s),batch:async a=>Promise.all(a.map(s=>s.run()))}};
fs.mkdirSync('.sites-runtime/tests',{recursive:true});
const compile=(s)=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
fs.writeFileSync('.sites-runtime/tests/model.mjs',compile(fs.readFileSync('lib/model.ts','utf8')));
let code=fs.readFileSync('app/api/club/route.ts','utf8').replace("import {env} from 'cloudflare:workers';","const env=globalThis.testEnv;").replace("'@/lib/model'","'./model.mjs'");
fs.writeFileSync('.sites-runtime/tests/route.mjs',compile(code));
const {GET,POST}=await import('../.sites-runtime/tests/route.mjs');
const req=(user,body,id)=>new Request('https://test.local/api/club'+(id?'?id='+id:''),{method:body?'POST':'GET',headers:{...(user?{'oai-authenticated-user-id':user}:{}),'Content-Type':'application/json','Origin':'https://test.local'},...(body?{body:JSON.stringify(body)}:{})});
async function post(user,body,ok=true){const r=await POST(req(user,body));const d=await r.json();assert.equal(r.ok,ok,JSON.stringify(d));return d}
async function get(user,id,ok=true){const r=await GET(req(user,null,id));const d=await r.json();assert.equal(r.ok,ok,JSON.stringify(d));return d}
await get(null,null,false);
let s=await post('host',{action:'create',title:'Test'});const id=s.id;
await get('stranger',id,false);
s=await post('host',{action:'save',id,version:s.version,title:'Test',date:'2026-10-19',plan:{theme:'Rom',notes:'Secret notes',budget:200,expected:['Host','Guest'],samples:[{id:'s1',name:'Secret rum',article:'50901',number:1,price:100,volume:70,abv:40,type:'Rom',purchased:true,serving:'Secret serving'},{id:'s2',name:'Secret gin',number:2,price:100,volume:70,abv:40,type:'Gin',serving:''}]}});
await post('host',{action:'save',id,version:1,title:'Overwrite',date:'',plan:s.plan},false);
s=await post('host',{action:'start',id});
await post('guest',{action:'join',id,token:'wrong',name:'Guest'},false);
await post('host',{action:'join',id,token:s.token,name:'Host'});
const guest=await post('guest',{action:'join',id,token:s.token,name:'Guest'});
assert.equal(guest.joined,true);assert.equal(guest.plan.samples[0].name,undefined);assert.equal(guest.plan.notes,undefined);assert.equal(guest.token,undefined);assert.equal(guest.results.length,0);
await post('guest',{action:'reveal',id},false);
await post('host',{action:'reveal',id},false);
await post('guest',{action:'vote',id,sample:'s1',vote:{score:11}},false);
await post('guest',{action:'vote',id,sample:'wrong',vote:{score:7}},false);
await post('stranger',{action:'vote',id,sample:'s1',vote:{score:7}},false);
await post('guest',{action:'vote',id,sample:'s1',vote:{score:0,comment:'Zero is valid'}});
await post('guest',{action:'vote',id,sample:'s2',vote:{skip:true,comment:'Skipped'}});
let before=await get('host',id);assert.equal(before.results.length,0);assert.deepEqual(before.mine,{});
await post('host',{action:'reveal',id},false);
await post('host',{action:'vote',id,sample:'s1',vote:{score:8.12345}});
await post('host',{action:'vote',id,sample:'s2',vote:{score:6}});
s=await post('host',{action:'reveal',id});assert.equal(s.status,'revealed');assert.equal(s.results.length,4);
let after=await get('guest',id);assert.equal(after.plan.samples[0].name,'Secret rum');assert.equal(after.results.length,4);assert.equal(after.results.find(v=>v.name==='Guest'&&v.sample==='s1').score,0);
await post('guest',{action:'vote',id,sample:'s1',vote:{score:10}},false);
await post('guest2',{action:'join',id,token:before.token,name:'Late'},false);
await post('host',{action:'save',id,version:s.version,title:'Overwrite',date:'',plan:s.plan},false);
if(process.env.HISTORY_FILE){
const hist=JSON.parse(fs.readFileSync(process.env.HISTORY_FILE,'utf8'));assert.equal(hist.length,35);assert.equal(hist.flatMap(s=>s.samples).length,197);assert.equal(hist.flatMap(s=>s.samples).flatMap(p=>p.ratings).length,855);
const lager=hist.find(s=>s.title.includes('29/10 - 2020'));assert.equal(lager.samples.find(p=>p.name==='Grandiose').average,8.4);
const gin=hist.find(s=>s.title.includes('23/1 - 2021'));assert.equal(gin.samples.length,8);assert.deepEqual([...new Set(gin.samples.map(p=>p.serving))],['Rent','G&T']);
}
console.log('PASS: authorization, no premature disclosure, draft version conflicts, rating validation, zero/skip, reveal gating, locked results.');
