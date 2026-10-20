// Checks lib/stats-math.ts against reference values computed with SciPy 1.18 (synthetic data).
import assert from 'node:assert/strict';
import {route} from './test-harness.mjs';
await route('club',{});// compiles lib/ into .sites-runtime/tests
const m=await import('../.sites-runtime/tests/lib/stats-math.mjs');
const close=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
close(m.tPValue(2.3551516463587694,128),0.02003517254226827);
close(m.tPValue(1,5),0.3632174676491229);close(m.tPValue(3.5,10),0.00572650542988521);close(m.tPValue(0.2,3),0.854270329246279);
close(m.tCritical(4),2.7764451051977934,1e-6);close(m.tCritical(10),2.228138851986274,1e-6);close(m.tCritical(128),1.978670849837835,1e-6);
const rows=[[0,100.1,9.56],[0,85.9,8.5],[0,77.7,8.35],[0,103.4,10.42],[0,76.1,8.63],[1,151.2,9.61],[1,126,8.44],[1,118.4,9.7],[1,67.5,8.37],[1,54.8,7.56],[2,76,8.34],[2,89.5,8.86],[2,149.1,8.86],[2,64.8,7.98],[2,137.3,9.04],[3,102.8,8.06],[3,118.1,7.89],[3,240.1,8.41],[3,158.2,9.46],[3,132.4,8.54]].map(([s,price,avg])=>({group:'s'+s,price,volume:70,avg,category:s<2?'Whisky':'Rom'}));
const all=m.priceEffect(rows,2000);
close(all.slope,1.0059581025900197);close(all.se,0.2936538771695908);assert.equal(all.df,15);close(all.p,0.0037547860332455734);close(all.r,0.6625259832722306);close(all.low,0.3800496795450291,1e-5);close(all.high,1.6318665256350102,1e-5);
assert.ok(all.permP>0&&all.permP<0.02,'permutation p '+all.permP);
const w=m.priceEffect(rows.filter(r=>r.category==='Whisky'));close(w.slope,1.4442817987672556);close(w.p,0.01837456760076464);close(w.low,0.3274859696504109,1e-5);
assert.equal(m.priceEffect(rows.slice(0,1)),null);
assert.deepEqual(m.holm([0.01,0.04,0.03]).map(v=>+v.toFixed(4)),[0.03,0.06,0.06]);
console.log('PASS: t distribution, critical values, within-tasting price effect, CI, permutation and Holm match SciPy.');
