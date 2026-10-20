import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {createDb,route} from './test-harness.mjs';
const env={...createDb(),ADMIN_EMAILS:'Boss@Club.test'};
const imp=await route('import',env),club=await route('club',env),members=await route('members',env),profile=await route('profile',env),avatar=await route('avatar',env),session=await route('session',env),history=await route('history',env);
const headers=(user,extra={})=>({...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@club.test'}:{}),'Content-Type':'application/json','Origin':'https://test.local',...extra});
const call=async(handler,user,path,body,status=200,extra)=>{const r=await handler[body?'POST':'GET'](new Request('https://test.local'+path,{method:body?'POST':'GET',headers:headers(user,extra),...(body?{body:JSON.stringify(body)}:{})}));const d=r.headers.get('content-type')?.includes('json')?await r.json():r;assert.equal(r.status,status,JSON.stringify(d));return d;};

// Gateway mode: profiles are created on first request; admin comes from ADMIN_EMAILS.
let s=await call(session,null,'/api/session');assert.equal(s.auth.mode,'gateway');assert.equal(s.me,null);
s=await call(session,'boss','/api/session');assert.equal(s.me.admin,true);assert.equal((await call(profile,'guest','/api/profile?user=boss')).profile.admin,true);
s=await call(session,'guest','/api/session');assert.equal(s.me.admin,false);assert.equal(s.me.name,'guest');
let list=await call(members,'guest','/api/members');assert.equal(list.members.length,2);assert.equal(list.members[0].email,undefined);assert.equal(list.archiveNames,undefined);
await call(members,'guest','/api/members',{action:'update',user:'guest',role:'admin'},403);
await call(members,'boss','/api/members',{action:'update',user:'boss',status:'removed'},400);
list=await call(members,'boss','/api/members');assert.equal(list.members.find(m=>m.id==='guest').email,'guest@club.test');
await call(members,'boss','/api/members',{action:'invite',email:'new@club.test'},400);

// Profiles show only revealed results. Own edits only.
await call(profile,'guest','/api/profile',{action:'update',name:'Gästen',bio:'Gillar rom'});
let t=await call(club,'boss','/api/club',{action:'create',title:'Romkväll'});
t=await call(club,'boss','/api/club',{action:'save',id:t.id,version:t.version,title:'Romkväll',date:'2026-10-01',plan:{theme:'',notes:'',budget:null,expected:[],samples:[{id:'r1',name:'Hemlig rom',number:1,type:'Rom'}]}});
t=await call(club,'boss','/api/club',{action:'start',id:t.id});
await call(club,'guest','/api/club',{action:'join',id:t.id,token:t.token,name:'Gästen'});
await call(club,'guest','/api/club',{action:'vote',id:t.id,sample:'r1',vote:{score:9,comment:'Toppen'}});
let p=await call(profile,'boss','/api/profile?user=guest');assert.equal(p.profile.name,'Gästen');assert.equal(p.profile.own,false);assert.equal(p.tastings.length,0);assert.equal(p.upcoming.length,0);assert.ok(!JSON.stringify(p).includes('Hemlig rom'));
p=await call(profile,'guest','/api/profile');assert.equal(p.upcoming.length,1);assert.ok(!JSON.stringify(p).includes('Hemlig rom'));
await call(club,'boss','/api/club',{action:'join',id:t.id,token:t.token,name:'Boss'});
await call(club,'boss','/api/club',{action:'vote',id:t.id,sample:'r1',vote:{score:7}});
await call(club,'boss','/api/club',{action:'reveal',id:t.id});
p=await call(profile,'boss','/api/profile?user=guest');assert.equal(p.tastings[0].samples[0].name,'Hemlig rom');assert.equal(p.tastings[0].samples[0].score,9);assert.equal(p.tastings[0].samples[0].average,8);assert.equal(p.stats.ratings,1);

// Historical archive names can be linked to a member by the admin.
env.sqlite.prepare('INSERT INTO historical(id,data) VALUES(?,?)').run('h1',JSON.stringify({id:'h1',title:'Gammal ölkväll',date:'2020-10-29',samples:[{id:'h1s1',name:'Grandiose',type:'Lager',average:8.4,ratings:[{name:'Gäst',score:8,comment:'Fin'},{name:'Annan',score:9}]}]}));
list=await call(members,'boss','/api/members');assert.deepEqual(list.archiveNames,['Annan','Gäst']);
await call(members,'boss','/api/members',{action:'update',user:'guest',historyNames:['Gäst']});
p=await call(profile,'guest','/api/profile');assert.equal(p.tastings.length,2);assert.equal(p.favorites[0].name,'Hemlig rom');assert.equal(p.tastings.find(x=>x.source==='archive').samples[0].score,8);
const archive=await call(history,'guest','/api/history');assert.equal(archive.sessions.length,2);

// Avatars: validated image bytes, served only to signed-in members.
const png='data:image/png;base64,'+Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1,2,3]).toString('base64');
await call(profile,'guest','/api/profile',{action:'avatar',image:'data:image/png;base64,'+Buffer.from('<svg/>').toString('base64')},400);
await call(profile,'guest','/api/profile',{action:'avatar',image:'data:image/svg+xml;base64,PHN2Zy8+'},400);
p=await call(profile,'guest','/api/profile',{action:'avatar',image:png});assert.equal(p.profile.avatar,1);
let img=await call(avatar,'boss','/api/avatar?user=guest');assert.equal(img.headers.get('content-type'),'image/png');assert.equal((await img.arrayBuffer()).byteLength,11);
await call(avatar,null,'/api/avatar?user=guest',undefined,401);

// Removed members lose access everywhere, including links they already have.
await call(members,'boss','/api/members',{action:'update',user:'guest',status:'removed'});
await call(club,'guest','/api/club',undefined,403);await call(profile,'guest','/api/profile',undefined,403);await call(history,'guest','/api/history',undefined,403);
await call(avatar,'boss','/api/avatar?user=guest',undefined,404);
list=await call(members,'boss','/api/members');assert.equal(list.members.find(m=>m.id==='guest').status,'removed');
await call(members,'boss','/api/members',{action:'update',user:'guest',status:'active'});await call(club,'guest','/api/club');

// Planning: participants are chosen among members, joined automatically, and share the cost.
let plan=await call(club,'boss','/api/club',{action:'create',title:'Whiskykväll'});assert.deepEqual(plan.plan.participants,['boss']);
plan=await call(club,'boss','/api/club',{action:'save',id:plan.id,version:plan.version,title:'Whiskykväll',date:'',plan:{...plan.plan,participants:['boss','guest','nobody'],samples:[{id:'w1',name:'Arran',price:549,number:1},{id:'w2',name:'Macallan',price:500,number:2}]}});
assert.equal(plan.cost.total,1049);assert.equal(plan.cost.people,3);assert.equal(plan.cost.perPerson,350);
assert.ok(!(await call(club,'guest','/api/club')).sessions.some(x=>x.id===plan.id));
plan=await call(club,'boss','/api/club',{action:'start',id:plan.id});assert.equal(plan.joined,true);assert.equal(plan.people.length,2);assert.equal(plan.cost.perPerson,525);
let mine=await call(club,'guest','/api/club?id='+plan.id);assert.equal(mine.joined,true);assert.equal(mine.cost.perPerson,525);assert.equal(mine.plan.samples[0].name,undefined);
await call(club,'guest','/api/club',{action:'delete',id:plan.id},400);
// Swish: the host's number reaches participants with their share; they mark themselves as paid.
await call(profile,'boss','/api/profile',{action:'update',name:'Boss',bio:'',swish:'12345'},400);
await call(profile,'boss','/api/profile',{action:'update',name:'Boss',bio:'',swish:'+46 70-123 45 67'});
assert.equal((await call(profile,'boss','/api/profile')).profile.swish,'0701234567');assert.equal((await call(profile,'guest','/api/profile?user=boss')).profile.swish,undefined);
let g=await call(club,'guest','/api/club?id='+plan.id);assert.deepEqual(g.pay,{to:'Boss',swish:'0701234567',amount:525,paid:false});
g=await call(club,'guest','/api/club',{action:'paid',id:plan.id,paid:true});assert.equal(g.pay.paid,true);assert.ok(g.people.every(x=>!('paid' in x)),'participants must not see payment flags');
let hostView=await call(club,'boss','/api/club?id='+plan.id);assert.equal(hostView.pay,undefined);assert.equal(hostView.hostSwish,'0701234567');assert.equal(hostView.people.find(x=>x.user==='guest').paid,1);
await call(club,'stranger','/api/club',{action:'paid',id:plan.id,paid:true},400);
await call(club,'guest','/api/club',{action:'serve',id:plan.id,sample:1},400);
await call(club,'boss','/api/club',{action:'serve',id:plan.id,sample:9},400);
await call(club,'boss','/api/club',{action:'serve',id:plan.id,sample:1});assert.equal((await call(club,'guest','/api/club?id='+plan.id)).plan.served,1);
await call(club,'guest','/api/club',{action:'vote',id:plan.id,sample:'w2',vote:{score:7,tags:['Rökig','Hackig','Rökig'],guess:'450'}});
assert.deepEqual((await call(club,'guest','/api/club?id='+plan.id)).mine.w2,{score:7,skip:false,comment:'',tags:['Rökig'],guess:450});
await call(club,'guest','/api/club',{action:'vote',id:plan.id,sample:'w2',vote:{score:7,guess:-5}},400);
await call(club,'guest','/api/club',{action:'vote',id:plan.id,sample:'w1',vote:{score:8}});
plan=await call(club,'boss','/api/club',{action:'remove-participant',id:plan.id,user:'guest'});assert.equal(plan.people.length,1);
assert.equal(env.sqlite.prepare("SELECT COUNT(*) n FROM ratings WHERE session=?").get(plan.id).n,0);
await call(club,'guest','/api/club?id='+plan.id,undefined,400);
await call(club,'boss','/api/club',{action:'delete',id:plan.id});
assert.equal(env.sqlite.prepare("SELECT COUNT(*) n FROM tastings WHERE id=?").get(plan.id).n,0);
await call(club,'boss','/api/club',{action:'delete',id:t.id},400);

// Admin import of the private Sites backup: inserts only missing rows, remaps tasting hosts.
const backup={format:1,tables:{historical:[{id:'h2',data:JSON.stringify({id:'h2',title:'Ginkväll',date:'2021-01-23',samples:[{id:'g1',name:'Hendricks',type:'Gin',average:7,ratings:[{name:'Gäst',score:7}]}]})},{id:'h1',data:JSON.stringify({id:'h1',title:'Ändrad',samples:[]})}],tastings:[{id:'t-old',owner:'sites_user',status:'draft',title:'Nästa',date:'',data:JSON.stringify({theme:'',notes:'',budget:null,expected:[],samples:[]}),token:'tok',version:3}],members:[],ratings:[]}};
await call(imp,'guest','/api/import',backup,403);
await call(imp,'boss','/api/import',{format:2},400);
let res=await call(imp,'boss','/api/import',backup);assert.equal(res.historical,1);assert.equal(res.tastings,1);assert.deepEqual(res.total,{historical:2,samples:1,ratings:1});
assert.equal(JSON.parse(env.sqlite.prepare("SELECT data FROM historical WHERE id='h1'").get().data).title,'Gammal ölkväll');
res=await call(imp,'boss','/api/import',backup);assert.equal(res.historical,0);assert.equal(res.tastings,0);
assert.equal((await call(club,'boss','/api/club?id=t-old')).host,true);
res=await call(imp,'boss','/api/import',[JSON.parse(backup.tables.historical[0].data)]);assert.equal(res.historical,0);
assert.equal((await call(history,'guest','/api/history')).sessions.filter(x=>x.title==='Ginkväll').length,1);

// Clerk mode: identity headers are ignored; only a valid session token for this origin counts.
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwtKey=publicKey.export({type:'spki',format:'pem'}).toString();
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const token=(claims={})=>{const now=Math.floor(Date.now()/1000);const body=b64({alg:'RS256',typ:'JWT',kid:'ins_test'})+'.'+b64({sub:'user_clerk',sid:'sess_1',iss:'https://clerk.test.local',azp:'https://test.local',iat:now-5,nbf:now-5,exp:now+60,...claims});return body+'.'+createSign('RSA-SHA256').update(body).sign(privateKey).toString('base64url');};
Object.assign(env,{AUTH_MODE:'clerk',CLERK_PUBLISHABLE_KEY:'pk_test_Y2xlcmsudGVzdC5sb2NhbCQ',CLERK_JWT_KEY:jwtKey});
env.sqlite.prepare("INSERT INTO profiles(user,name,email,created_at) VALUES('user_clerk','Clerk-medlem','boss@club.test','2026-10-19')").run();
s=await call(session,'boss','/api/session');assert.equal(s.auth.mode,'clerk');assert.equal(s.auth.publishableKey,'pk_test_Y2xlcmsudGVzdC5sb2NhbCQ');assert.equal(s.me,null);
await call(club,'boss','/api/club',undefined,401);
s=await call(session,null,'/api/session',undefined,200,{Authorization:'Bearer '+token()});assert.equal(s.me.id,'user_clerk');assert.equal(s.me.admin,true);
s=await call(session,null,'/api/session',undefined,200,{Cookie:'theme=x; __session='+token()});assert.equal(s.me.id,'user_clerk');
await call(club,null,'/api/club',undefined,401,{Authorization:'Bearer '+token({azp:'https://evil.test'})});
await call(club,null,'/api/club',undefined,401,{Authorization:'Bearer '+token({exp:Math.floor(Date.now()/1000)-120})});
await call(club,null,'/api/club',undefined,401,{Authorization:'Bearer '+token().slice(0,-4)+'AAAA'});
await call(club,null,'/api/club',undefined,200,{Authorization:'Bearer '+token()});
console.log('PASS: membership, admin rules, removal, profiles without premature disclosure, archive linking, avatar validation, participants, cost split, Swish, deletion, backup import, Clerk token verification.');
