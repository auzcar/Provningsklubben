import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createDb,route} from './test-harness.mjs';
const env=createDb();
const {GET,POST}=await route('club',env);
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
// Snacks: a grocery list grouped by store section, not part of the cost split, editable after opening.
{let t=await post('host',{action:'create',title:'Tilltugg'});const tid=t.id;assert.deepEqual(t.plan.snacks,[]);assert.deepEqual(t.plan.snackReceipt,{total:null,note:''});
 t=await post('host',{action:'save',id:tid,version:t.version,title:'Tilltugg',date:'',plan:{...t.plan,samples:[{id:'b1',name:'Öl',price:30}],snacks:[{id:'n1',name:'Chips',amount:'2 påsar',purchased:true},{id:'n2',name:'Lagrad getost',section:'bogus'},{id:'n3',name:'Is',section:'ovrigt'},{id:'',name:'Utan id'},{id:'n4',name:'   '}],snackReceipt:{total:'249.5',note:'ICA'}}});
 assert.deepEqual(t.plan.snacks.map(x=>[x.id,x.section,x.purchased]),[['n1','snacks',true],['n2','ost',false],['n3','ovrigt',false]]);
 assert.deepEqual(t.plan.snackReceipt,{total:249.5,note:'ICA'});assert.equal(t.cost.total,30);
 await post('host',{action:'save',id:tid,version:t.version,title:'Tilltugg',date:'',plan:{...t.plan,snackReceipt:{total:-5}}},false);
 t=await post('host',{action:'start',id:tid});const v=t.version;
 const g=await post('guest',{action:'join',id:tid,token:t.token,name:'Guest'});assert.equal(g.plan.snacks,undefined);assert.equal(g.plan.snackReceipt,undefined);
 await post('guest',{action:'snacks',id:tid,snacks:[]},false);
 t=await post('host',{action:'snacks',id:tid,snacks:[{id:'n9',name:'Vindruvor'}],snackReceipt:{total:100,note:''}});
 assert.deepEqual(t.plan.snacks,[{id:'n9',name:'Vindruvor',amount:'',section:'frukt',purchased:false}]);assert.equal(t.plan.snackReceipt.total,100);assert.equal(t.version,v);assert.equal(t.plan.samples[0].name,'Öl');
 await post('host',{action:'delete',id:tid});}
console.log('Snacks test passed');
// Time and place: validated, visible to participants, and written to the calendar file.
{let t=await post('host',{action:'create',title:'Tid'});const tid=t.id;
 await post('host',{action:'save',id:tid,version:t.version,title:'Tid',date:'2026-11-14',plan:{...t.plan,time:'7pm'}},false);
 t=await post('host',{action:'save',id:tid,version:t.version,title:'Tid',date:'2026-11-14',plan:{...t.plan,time:'19:00',endTime:'01:30',location:'Hemma hos Kim',samples:[{id:'z',name:'Rom'}],participants:['host','guest']}});
 assert.equal(t.plan.time,'19:00');const list=await get('host');assert.equal(list.sessions.find(x=>x.id===tid).time,'19:00');
 t=await post('host',{action:'start',id:tid});const g=await post('guest',{action:'join',id:tid,token:t.token,name:'Guest'});
 assert.deepEqual([g.plan.time,g.plan.endTime,g.plan.location],['19:00','01:30','Hemma hos Kim']);
 const {tastingIcs}=await import('../.sites-runtime/tests/lib/calendar.mjs');
 const ics=tastingIcs({id:tid,title:'Tid, med komma',date:'2026-11-14',time:'19:00',endTime:'01:30',location:'Hemma hos Kim',version:3},'https://x/');
 assert.match(ics,/DTSTART;TZID=Europe\/Stockholm:20261114T190000/);assert.match(ics,/DTEND;TZID=Europe\/Stockholm:20261115T013000/);
 assert.match(ics,/BEGIN:VTIMEZONE/);assert.match(ics,/SEQUENCE:3/);assert.match(ics,/SUMMARY:Provningsklubben: Tid\\, med komma/);
 const allDay=tastingIcs({id:'a',title:'A',date:'2026-12-31'},'https://x/');assert.match(allDay,/DTSTART;VALUE=DATE:20261231/);assert.match(allDay,/DTEND;VALUE=DATE:20270101/);assert.doesNotMatch(allDay,/VTIMEZONE/);
 assert.match(tastingIcs({id:'b',title:'B',date:'2026-07-01',time:'23:00'},'u'),/DTEND;TZID=Europe\/Stockholm:20260702T020000/);
 assert.ok(ics.split('\r\n').every(l=>new TextEncoder().encode(l).length<=75));
 await post('host',{action:'delete',id:tid});}
console.log('Time test passed');
// The evening program: drinks follow the tasting order, other items stay where they were put.
{const P=await import('../.sites-runtime/tests/lib/program.mjs');
 let t=await post('host',{action:'create',title:'Upplägg'});const tid=t.id;
 const samples=[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}];
 t=await post('host',{action:'save',id:tid,version:t.version,title:'Upplägg',date:'',plan:{...t.plan,samples,snacks:[{id:'s1',name:'Ost'}],
  program:[{id:'w',kind:'other',title:'Välkomstdrink',time:'18:30'},{id:'pa',kind:'drink',sample:'a',notes:'Rumstempererad',snacks:['s1','gone']},{id:'m',kind:'meal',title:'Middag',notes:'Lamm',time:'25:00'},{id:'x',kind:'drink',sample:'zzz'},{id:'pb',kind:'drink',sample:'b'},{id:'pb2',kind:'drink',sample:'b'},{id:'bad',kind:'party'}]}});
 assert.deepEqual(t.plan.program.map(x=>[x.kind,x.sample||x.title]),[['other','Välkomstdrink'],['drink','a'],['meal','Middag'],['drink','b'],['drink','c']]);
 assert.deepEqual(t.plan.program[1].snacks,['s1']);assert.equal(t.plan.program[2].time,'');
 // Reordering the drinks keeps the meal in its place and the notes with their drink.
 t=await post('host',{action:'save',id:tid,version:t.version,title:'Upplägg',date:'',plan:{...t.plan,samples:[samples[2],samples[0],samples[1]]}});
 assert.deepEqual(t.plan.program.map(x=>x.sample||x.title),['Välkomstdrink','c','Middag','a','b']);assert.equal(t.plan.program[3].notes,'Rumstempererad');
 const mv=P.moveItem(t.plan.program,t.plan.samples,3,-1);assert.deepEqual(mv.program.map(x=>x.sample||x.title),['Välkomstdrink','c','a','Middag','b']);assert.deepEqual(mv.samples.map(s=>s.id),['c','a','b']);
 const sw=P.moveItem(mv.program,mv.samples,1,1);assert.deepEqual(sw.samples.map(s=>s.id),['a','c','b']);
 assert.deepEqual(P.suggestTimes(t.plan.program,'23:30').map(x=>x.time),['23:30','23:40','23:55','00:55','01:10']);
 // Older plans without a program get one from the drinks.
 assert.deepEqual(P.normalizeProgram(undefined,samples,[]).map(x=>x.sample),['a','b','c']);}
console.log('Program test passed');
// Calendar subscription: a secret per-member feed with the tastings they host, joined or are invited to.
{const cal=await route('calendar',env);
 const creq=(user,body,qs='')=>new Request('https://test.local/api/calendar'+qs,{method:body?'POST':'GET',headers:{...(user?{'oai-authenticated-user-id':user}:{}),'Content-Type':'application/json','Origin':'https://test.local'},...(body?{body:JSON.stringify(body)}:{})});
 const ics=async url=>{const r=await cal.GET(new Request(url));return {status:r.status,type:r.headers.get('content-type'),text:await r.text()};};
 assert.equal((await cal.GET(creq(null))).status,401);
 let t=await post('host',{action:'create',title:'Kalenderkväll'});const tid=t.id;
 t=await post('host',{action:'save',id:tid,version:t.version,title:'Kalenderkväll',date:'2099-03-01',plan:{...t.plan,time:'19:00',location:'Hos Kim',samples:[{id:'q',name:'Hemlig whisky'}],participants:['host','invitee']}});
 await get('invitee',null);// first sign-in creates the profile
 const url=(await (await cal.GET(creq('invitee'))).json()).url;assert.match(url,/^https:\/\/test\.local\/api\/calendar\?feed=[0-9a-f]{48}$/);
 assert.equal((await (await cal.GET(creq('invitee'))).json()).url,url);
 let f=await ics(url);assert.equal(f.status,200);assert.match(f.type,/text\/calendar/);assert.match(f.text,/SUMMARY:Provningsklubben: Kalenderkväll/);
 assert.match(f.text,/DTSTART;TZID=Europe\/Stockholm:20990301T190000/);assert.match(f.text,/LOCATION:Hos Kim/);assert.doesNotMatch(f.text,/Hemlig/);
 // The host moves the evening; the same address now gives the new time.
 t=await post('host',{action:'save',id:tid,version:t.version,title:'Kalenderkväll',date:'2099-03-02',plan:{...t.plan,time:'18:00'}});
 f=await ics(url);assert.match(f.text,/DTSTART;TZID=Europe\/Stockholm:20990302T180000/);
 await get('outsider',null);const other=(await (await cal.GET(creq('outsider'))).json()).url;assert.doesNotMatch((await ics(other)).text,/Kalenderkväll/);
 assert.equal((await ics('https://test.local/api/calendar?feed='+'0'.repeat(48))).status,404);assert.equal((await ics('https://test.local/api/calendar?feed=x')).status,404);
 assert.equal((await cal.POST(creq('invitee',{action:'reset'}))).status,200);assert.equal((await ics(url)).status,404);
 const r=await cal.POST(new Request('https://test.local/api/calendar',{method:'POST',headers:{'oai-authenticated-user-id':'invitee','Origin':'https://evil.example','Content-Type':'application/json'},body:'{"action":"reset"}'}));assert.equal(r.status,403);}
console.log('Calendar test passed');
// The host always takes part and rates, even if left out of the participant list.
{let t=await post('host',{action:'create',title:'Värd deltar'});const tid=t.id;
 t=await post('host',{action:'save',id:tid,version:t.version,title:'Värd deltar',date:'',plan:{...t.plan,participants:['guest'],samples:[{id:'v',name:'X'}]}});
 assert.deepEqual(t.plan.participants,['host','guest']);
 t=await post('host',{action:'start',id:tid});assert.equal(t.joined,true);assert.deepEqual(t.people.map(p=>p.user).sort(),['guest','host']);
 // While it runs, the server answers only this tasting for the people in it, on any device.
 const other=await post('stranger2',{action:'create',title:'Annan'});
 for(const u of ['host','guest']){
  await get(u,other.id,false);await post(u,{action:'create',title:'Ny'},false);
  const prof=await route('profile',env);assert.equal((await prof.GET(new Request('https://test.local/api/profile?user='+u,{headers:{'oai-authenticated-user-id':u}}))).status,423);
  const hist=await route('history',env);assert.equal((await hist.GET(new Request('https://test.local/api/history',{headers:{'oai-authenticated-user-id':u}}))).status,423);
  assert.equal((await get(u,tid)).id,tid);assert.ok((await get(u,null)).sessions.some(x=>x.id===tid));
  const mem=await route('members',env);assert.equal((await mem.GET(new Request('https://test.local/api/members',{headers:{'oai-authenticated-user-id':u}}))).status,200);}
 await post('guest',{action:'vote',id:tid,sample:'v',vote:{score:7}});await post('host',{action:'vote',id:tid,sample:'v',vote:{score:8}});
 // Someone outside the tasting is not affected, and after the reveal everyone is free again.
 const hist=await route('history',env);assert.equal((await hist.GET(new Request('https://test.local/api/history',{headers:{'oai-authenticated-user-id':'stranger2'}}))).status,200);
 t=await post('host',{action:'reveal',id:tid});assert.equal(t.status,'revealed');
 assert.equal((await hist.GET(new Request('https://test.local/api/history',{headers:{'oai-authenticated-user-id':'guest'}}))).status,200);
 await post('host',{action:'create',title:'Fri igen'});
 // A tasting left open since an earlier day no longer locks.
 let old=await post('host',{action:'create',title:'Gammal'});old=await post('host',{action:'save',id:old.id,version:old.version,title:'Gammal',date:'2020-01-01',plan:{...old.plan,samples:[{id:'o',name:'O'}]}});
 await post('host',{action:'start',id:old.id});await post('host',{action:'create',title:'Fortfarande fri'});}
// Test mode: an admin copies their own real plan to a test tasting with the test members invited.
{const adminEnv=env;adminEnv.ADMIN_EMAILS='boss@test.local';
 const areq=body=>new Request('https://test.local/api/club',{method:'POST',headers:{'oai-authenticated-user-id':'boss','oai-authenticated-user-email':'boss@test.local','Content-Type':'application/json','Origin':'https://test.local'},body:JSON.stringify(body)});
 const call=async(body,ok=true)=>{const r=await POST(areq(body));const d=await r.json();assert.equal(r.ok,ok,JSON.stringify(d));return d;};
 let t=await call({action:'create',title:'Första skarpa'});const src=t.id;
 t=await call({action:'save',id:src,version:t.version,title:'Första skarpa',date:'2026-11-14',plan:{...t.plan,time:'19:00',samples:[{id:'r1',name:'Rom 1'},{id:'r2',name:'Rom 2'}],snacks:[{id:'n',name:'Ost'}],program:[{id:'m',kind:'meal',title:'Middag'}],participants:['boss']}});
 const sim=await call({action:'simulate',id:src});
 const greq=(user,id)=>new Request('https://test.local/api/club?id='+id,{headers:{'oai-authenticated-user-id':'boss','oai-authenticated-user-email':'boss@test.local','X-Test-User':user}});
 const copy=await (await GET(greq('test:host',sim.id))).json();
 assert.equal(copy.title,'Test: Första skarpa');assert.equal(copy.host,true);assert.equal(copy.status,'draft');assert.equal(copy.plan.time,'19:00');
 assert.deepEqual(copy.plan.samples.map(s=>s.name),['Rom 1','Rom 2']);assert.equal(copy.plan.snacks[0].name,'Ost');assert.deepEqual(copy.plan.participants,['test:host','test:1','test:2','test:3']);
 const orig=await call({action:'save',id:src,version:t.version,title:'Första skarpa',date:'2026-11-14',plan:t.plan});assert.equal(orig.title,'Första skarpa');
 await post('host',{action:'simulate',id:src},false);// not an admin
 const other=await post('host',{action:'create',title:'Någon annans'});await call({action:'simulate',id:other.id},false);}
console.log('Host and simulation tests passed');
