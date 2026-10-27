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
// Nothing can be rated before the host puts it on the table, and the host steps one item at a time.
await post('guest',{action:'vote',id,sample:'s1',vote:{score:7}},false);
await post('guest',{action:'next',id},false);
s=await post('host',{action:'next',id});assert.deepEqual([s.stage.step,s.stage.sample,s.stage.reached],[0,0,1]);assert.deepEqual(s.waiting.sort(),['Guest','Host']);
await post('guest',{action:'vote',id,sample:'s1',vote:{score:0,comment:'Zero is valid'}});
await post('guest',{action:'vote',id,sample:'s2',vote:{skip:true}},false);
let before=await get('host',id);assert.equal(before.results.length,0);assert.deepEqual(before.mine,{});assert.deepEqual(before.waiting,['Host']);
assert.equal((await get('guest',id)).plan.served,0);
// The host cannot serve the next drink until everyone has rated the one on the table.
await post('host',{action:'next',id},false);
await post('host',{action:'reveal',id},false);
await post('host',{action:'vote',id,sample:'s1',vote:{score:8.12345}});
s=await post('host',{action:'next',id});assert.equal(s.stage.sample,1);assert.equal(s.plan.served,1);
// Earlier ratings are locked once the next drink is out.
await post('guest',{action:'vote',id,sample:'s1',vote:{score:9}},false);
await post('guest',{action:'vote',id,sample:'s2',vote:{skip:true,comment:'Skipped'}});
await post('host',{action:'vote',id,sample:'s2',vote:{score:6}});
await post('host',{action:'next',id},false);
s=await post('host',{action:'reveal',id});assert.equal(s.status,'revealed');assert.equal(s.results.length,4);
// The host plays the reveal from last place to the winner; participants only get what has been shown.
assert.deepEqual(s.reveal,{at:0,total:2,done:false,shown:['s1','s2']});
let after=await get('guest',id);assert.deepEqual(after.reveal,{at:0,total:2,done:false,shown:[]});assert.equal(after.results.length,0);assert.equal(after.plan.samples[0].name,undefined);
await post('guest',{action:'reveal-next',id},false);
const histRoute=await route('history',env);const guestHist=async()=>(await histRoute.GET(new Request('https://test.local/api/history',{headers:{'oai-authenticated-user-id':'guest'}}))).status;
assert.ok(!(await (await histRoute.GET(new Request('https://test.local/api/history',{headers:{'oai-authenticated-user-id':'stranger3'}}))).json()).sessions.some(x=>x.id===id));
await get('stranger3',id,false);
await post('host',{action:'reveal-next',id});after=await get('guest',id);assert.deepEqual(after.reveal.shown,['s1']);assert.equal(after.plan.samples[0].name,'Secret rum');assert.equal(after.plan.samples[1].name,undefined);assert.ok(after.results.every(v=>v.sample==='s1'));
await post('host',{action:'reveal-next',id});await post('host',{action:'reveal-next',id});
after=await get('guest',id);assert.equal(after.reveal.done,true);assert.equal(after.plan.samples[1].name,'Secret gin');assert.equal(after.results.length,4);assert.equal(after.results.find(v=>v.name==='Guest'&&v.sample==='s1').score,0);
assert.equal(await guestHist(),200);await post('host',{action:'reveal-next',id},false);
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
 await post('host',{action:'next',id:tid}); await post('guest',{action:'vote',id:tid,sample:'v',vote:{score:7}});await post('host',{action:'vote',id:tid,sample:'v',vote:{score:8}});
 // Someone outside the tasting is not affected, and after the reveal everyone is free again.
 const hist=await route('history',env);assert.equal((await hist.GET(new Request('https://test.local/api/history',{headers:{'oai-authenticated-user-id':'stranger2'}}))).status,200);
 t=await post('host',{action:'reveal',id:tid});assert.equal(t.status,'revealed');await post('host',{action:'reveal-all',id:tid});await post('host',{action:'finish',id:tid});
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
// Stepping through the evening: snacks and meals between the drinks, what participants may see,
// a late arrival, and test mode's random scores for the others.
{let t=await post('host',{action:'create',title:'Steg'});const tid=t.id;
 t=await post('host',{action:'save',id:tid,version:t.version,title:'Steg',date:'',plan:{...t.plan,participants:['host','guest'],samples:[{id:'d1',name:'Hemlig 1'},{id:'d2',name:'Hemlig 2'}],snacks:[{id:'c',name:'Mörk choklad'}],
  program:[{id:'w',kind:'snack',title:'Choklad till rommen',snacks:['c'],notes:'Värdens anteckning'},{id:'p1',kind:'drink',sample:'d1'},{id:'m',kind:'meal',title:'Middag'},{id:'p2',kind:'drink',sample:'d2'}]}});
 t=await post('host',{action:'start',id:tid});
 let g=await get('guest',tid);assert.equal(g.stage.step,null);assert.equal(g.stage.total,4);
 await post('host',{action:'next',id:tid});g=await get('guest',tid);
 assert.deepEqual([g.stage.kind,g.stage.title,g.stage.sample],['snack','Tilltugg',null]);assert.ok(!JSON.stringify(g).includes('choklad')&&!JSON.stringify(g).includes('anteckning'));
 await post('guest',{action:'vote',id:tid,sample:'d1',vote:{score:7}},false);
 await post('host',{action:'next',id:tid});await post('guest',{action:'vote',id:tid,sample:'d1',vote:{score:7}});await post('host',{action:'vote',id:tid,sample:'d1',vote:{score:6}});
 t=await post('host',{action:'next',id:tid});g=await get('guest',tid);assert.deepEqual([g.stage.kind,g.stage.title,g.stage.reached,g.plan.served],['meal','Middag',1,0]);
 // A late arrival may still give a first rating to a drink already served, but not change it afterwards.
 await get('late',null);await post('late',{action:'join',id:tid,token:t.token,name:'Sen'});
 await post('late',{action:'vote',id:tid,sample:'d1',vote:{score:5}});await post('late',{action:'vote',id:tid,sample:'d1',vote:{score:6}},false);
 await post('late',{action:'vote',id:tid,sample:'d2',vote:{score:5}},false);
 t=await post('host',{action:'next',id:tid});assert.equal(t.stage.last,true);assert.equal(t.waiting.length,3);
 await post('host',{action:'next',id:tid},false);
 for(const u of ['host','guest','late'])await post(u,{action:'vote',id:tid,sample:'d2',vote:{score:8}});
 // Correcting ratings: only the host, only served drinks, only while the tasting is on.
 assert.ok(t.ratings.some(r=>r.user==='late'&&r.sample==='d1'&&r.score===5));assert.equal((await get('guest',tid)).ratings,undefined);
 await post('guest',{action:'rate-for',id:tid,user:'late',sample:'d1',vote:{score:9}},false);
 t=await post('host',{action:'rate-for',id:tid,user:'late',sample:'d1',vote:{score:9}});assert.equal(t.ratings.find(r=>r.user==='late'&&r.sample==='d1').score,9);
 await post('host',{action:'rate-for',id:tid,user:'nobody',sample:'d1',vote:{score:9}},false);
 t=await post('host',{action:'reveal',id:tid});assert.equal(t.status,'revealed');assert.equal(t.ratings,undefined);
 await post('host',{action:'rate-for',id:tid,user:'late',sample:'d1',vote:{score:1}},false);
 // Everyone at the table stays in the reveal until the host has shown it all.
 const hist=await route('history',env);const status=async u=>(await hist.GET(new Request('https://test.local/api/history',{headers:{'oai-authenticated-user-id':u}}))).status;
 assert.equal(await status('late'),423);assert.ok((await get('late',null)).sessions.find(x=>x.id===tid).revealing);
 // After the reveal the evening stays in tasting mode (bottles) until the host ends it.
 await post('host',{action:'reveal-all',id:tid});assert.equal(await status('late'),423);assert.equal((await get('late',tid)).finished,false);
 await post('late',{action:'finish',id:tid},false);
 await post('host',{action:'finish',id:tid});assert.equal(await status('late'),200);assert.ok(!(await get('late',null)).sessions.find(x=>x.id===tid).revealing);assert.equal((await get('late',tid)).finished,true);}
console.log('Step test passed');
// Bottles to take home: favourite first; clashes by love above own average, then loss, then a draw.
{const {allocate}=await import('../.sites-runtime/tests/lib/allocation.mjs');
 const P=[{user:'a',name:'A'},{user:'b',name:'B'},{user:'c',name:'C'}],S=[{id:'x'},{id:'y'},{id:'z'}];
 const r=(u,x,y,z)=>[['x',x],['y',y],['z',z]].map(([s,v])=>({user:u,sample:s,score:v}));
 // Everyone loves x. A gives 9 but rates everything high; B gives 8 against a low average and wins it.
 let out=allocate(P,S,[...r('a',9,8.5,8.5),...r('b',8,4,5),...r('c',7,6,3)]);
 const got=u=>out.items.find(i=>i.user===u).sample;
 // Then A and C both want y; C rated it above their average, A below, so A gets z.
 assert.deepEqual([got('a'),got('b'),got('c')],['z','x','y']);
 assert.equal(out.items.find(i=>i.user==='b').contest.rule,'love');assert.deepEqual(out.leftoverSamples,[]);assert.deepEqual(out.leftoverPeople,[]);
 // Same love: the one who would lose most by settling for the next bottle wins.
 // Both rate x 1 point above their average 7; A's next best is 7, B's 7.5, so A loses more.
 out=allocate(P.slice(0,2),S,[...r('a',8,6,7),...r('b',8,7.5,5.5)]);
 assert.equal(out.items.find(i=>i.sample==='x').user,'a');assert.equal(out.items.find(i=>i.sample==='x').contest.rule,'loss');
 // Identical ratings: a draw, and "avstår" counts as the lowest.
 const same=[{user:'a',sample:'x',score:7},{user:'a',sample:'y',score:null},{user:'b',sample:'x',score:7},{user:'b',sample:'y',score:null}];
 assert.equal(allocate(P.slice(0,2),S.slice(0,2),same,()=>0).items.find(i=>i.sample==='x').contest.rule,'draw');
 assert.equal(allocate(P.slice(0,2),S.slice(0,2),same,()=>0).items.find(i=>i.sample==='x').user,'a');
 assert.equal(allocate(P.slice(0,2),S.slice(0,2),same,()=>0.99).items.find(i=>i.sample==='x').user,'b');
 // Uneven numbers: leftovers are listed, nobody gets two.
 out=allocate(P,S.slice(0,2),[...r('a',9,1,0),...r('b',8,2,0),...r('c',1,9,0)]);assert.deepEqual(out.leftoverPeople,['b']);
 out=allocate(P.slice(0,1),S,r('a',1,9,2));assert.equal(out.items[0].sample,'y');assert.deepEqual(out.leftoverSamples.sort(),['x','z']);
 // Through the API: only the host, only after the full reveal, shown one person at a time.
 let t=await post('host',{action:'create',title:'Flaskor'});const tid=t.id;
 t=await post('host',{action:'save',id:tid,version:t.version,title:'Flaskor',date:'',plan:{...t.plan,participants:['host','guest'],samples:[{id:'f1',name:'Rom A'},{id:'f2',name:'Rom B'}]}});
 t=await post('host',{action:'start',id:tid});
 for(const [n,sid] of [[0,'f1'],[1,'f2']]){await post('host',{action:'next',id:tid});await post('host',{action:'vote',id:tid,sample:sid,vote:{score:sid==='f1'?9:5}});await post('guest',{action:'vote',id:tid,sample:sid,vote:{score:sid==='f1'?6:8}});}
 await post('host',{action:'allocate',id:tid},false);
 t=await post('host',{action:'reveal',id:tid});await post('host',{action:'allocate',id:tid},false);
 await post('host',{action:'reveal-all',id:tid});
 await post('guest',{action:'allocate',id:tid},false);
 t=await post('host',{action:'allocate',id:tid});assert.equal(t.allocation.total,2);assert.equal(t.allocation.items.length,2);
 let g=await get('guest',tid);assert.equal(g.allocation.items.length,0);assert.equal(g.allocation.done,false);
 await post('guest',{action:'allocate-next',id:tid},false);
 await post('host',{action:'allocate-next',id:tid});g=await get('guest',tid);assert.equal(g.allocation.items.length,1);
 t=await post('host',{action:'allocate-all',id:tid});g=await get('guest',tid);assert.equal(g.allocation.done,true);
 assert.equal(g.allocation.items.find(i=>i.user==='host').sample,'f1');assert.equal(g.allocation.items.find(i=>i.user==='guest').sample,'f2');
 // The host can swap afterwards.
 t=await post('host',{action:'allocate-set',id:tid,user:'host',sample:'f2'});assert.equal(t.allocation.items.find(i=>i.user==='guest').sample,'f1');assert.ok(t.allocation.items.every(i=>i.manual));}
console.log('Allocation test passed');
