#!/usr/bin/env bash
# BabyTracker AI smoke tests — 12 checks. Exit non-zero on first failure.
set -u
cd "$(dirname "$0")/.."
pass=0; fail=0
check() { # $1 = description, rest = command
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "PASS: $desc"; pass=$((pass+1));
  else echo "FAIL: $desc"; fail=$((fail+1)); fi
}

check "index.html exists" test -f index.html
check "css/style.css exists" test -f css/style.css
check "js/tipsbank.js exists" test -f js/tipsbank.js
check "js/logic.js exists" test -f js/logic.js
check "js/app.js exists" test -f js/app.js
check "tipsbank.js syntax valid" node --check js/tipsbank.js
check "logic.js syntax valid" node --check js/logic.js
check "app.js syntax valid" node --check js/app.js
check "24 tips in bank across 5 categories" node -e "
  const b=require('./js/tipsbank.js');
  if(b.TIPS.length!==24) throw new Error('got '+b.TIPS.length);
  if(b.TIP_CATS.length!==5) throw new Error('cats='+b.TIP_CATS.length);"
check "every tip has category and text" node -e "
  const b=require('./js/tipsbank.js');
  for (const t of b.TIPS) { if(!t.cat||!t.t) throw new Error('bad tip'); }"
check "disclaimer present in index.html" grep -q "not medical advice" index.html
check "dailySummary math: 2 feeds 1 nap 3 diapers" node -e "
  const L=require('./js/logic.js');
  const base=new Date(2026,8,28,8,0,0).getTime();
  const es=[
    {type:'feed',ts:base,data:{kind:'bottle',oz:4}},
    {type:'feed',ts:base+3600000,data:{kind:'breast-left',oz:0}},
    {type:'sleep',ts:base,data:{start:base,end:base+5400000}},
    {type:'diaper',ts:base,data:{kind:'wet'}},
    {type:'diaper',ts:base,data:{kind:'dirty'}},
    {type:'diaper',ts:base,data:{kind:'both'}}
  ];
  const s=L.dailySummary(es,L.dayKey(base));
  if(s.feeds!==2||s.oz!==4||s.sleepMin!==90||s.diapers!==3||s.wet!==2||s.dirty!==2)
    throw new Error(JSON.stringify(s));"
check "entriesToCSV exports all entry types with a header" node -e "
  const L=require('./js/logic.js');
  const base=new Date(2026,8,28,8,0,0).getTime();
  const es=[
    {id:'e1',type:'feed',ts:base,data:{kind:'bottle',oz:4}},
    {id:'e2',type:'sleep',ts:base,data:{start:base,end:base+3600000}},
    {id:'e3',type:'diaper',ts:base,data:{kind:'wet'}},
    {id:'e4',type:'growth',ts:base,data:{weightLb:12.4,heightIn:24,note:'checkup'}}
  ];
  const lines=L.entriesToCSV(es).split('\n');
  if(lines.length!==5) throw new Error('lines='+lines.length);
  if(!lines[0].startsWith('id,timestamp,date,time,type,detail')) throw new Error('header');
  if(!lines[1].includes('bottle 4oz')) throw new Error('feed: '+lines[1]);
  if(!lines[4].includes('12.4 lb')) throw new Error('growth: '+lines[4]);"
check "avgFeedInterval measures time between feeds" node -e "
  const L=require('./js/logic.js');
  const base=new Date(2026,8,28,8,0,0).getTime();
  const es=[
    {type:'feed',ts:base,data:{kind:'bottle',oz:4}},
    {type:'feed',ts:base+120*60000,data:{kind:'bottle',oz:4}},
    {type:'feed',ts:base+300*60000,data:{kind:'bottle',oz:4}}
  ];
  if(L.avgFeedInterval(es,L.dayKey(base))!==150) throw new Error('avg');
  if(L.avgFeedInterval(es.slice(0,1),L.dayKey(base))!==null) throw new Error('single feed should be null');"
check "lastBreastSide tracks the most recent nursing side" node -e "
  const L=require('./js/logic.js');
  const es=[
    {type:'feed',ts:1,data:{kind:'breast-left'}},
    {type:'feed',ts:2,data:{kind:'bottle',oz:4}},
    {type:'feed',ts:3,data:{kind:'breast-right'}}
  ];
  if(L.lastBreastSide(es)!=='breast-right') throw new Error('side');
  if(L.lastBreastSide([])!==null) throw new Error('empty');"
check "weeklySummary returns 7 day buckets ending today" node -e "
  const L=require('./js/logic.js');
  const end=new Date(2026,8,28,18,0,0).getTime();
  const es=[{type:'feed',ts:end,data:{kind:'bottle',oz:4}}];
  const wk=L.weeklySummary(es,end);
  if(wk.length!==7) throw new Error('len='+wk.length);
  if(!wk[6].today||wk[6].feeds!==1) throw new Error('last day should be today with 1 feed');
  if(wk[0].feeds!==0) throw new Error('first day should be empty');"
check "retimeEntry moves a timestamp and shifts naps" node -e "
  const L=require('./js/logic.js');
  const base=new Date(2026,8,28,8,0,0).getTime();
  const es=[
    {id:'a',type:'feed',ts:base,data:{kind:'bottle',oz:4}},
    {id:'b',type:'sleep',ts:base,data:{start:base,end:base+3600000}}
  ];
  const later=base+7200000;
  if(!L.retimeEntry(es,'a',later)) throw new Error('no update');
  if(es[0].ts!==later) throw new Error('ts not moved');
  L.retimeEntry(es,'b',later);
  if(es[1].data.start!==later||es[1].data.end!==later+3600000) throw new Error('nap not shifted');
  if(L.retimeEntry(es,'zzz',later)) throw new Error('unknown id should fail');
  if(L.retimeEntry(es,'a',NaN)) throw new Error('NaN should fail');"
check "index.html wires the new controls" node -e "
  const fs=require('fs'), h=fs.readFileSync('index.html','utf8');
  for (const id of ['weekstrip','sidehint','export']) if(!h.includes('id=\"'+id+'\"')) throw new Error('missing '+id);
  const a=fs.readFileSync('js/app.js','utf8');
  if(!a.includes('weeklySummary(state.entries)')) throw new Error('week not rendered');
  if(!a.includes('lastBreastSide(state.entries)')) throw new Error('side hint not rendered');"
check "longestSleepStretch finds the longest closed nap in the last 7 days" node -e "
  const L=require('./js/logic.js');
  const base=new Date(2026,9,12,12,0,0).getTime();
  const es=[
    {type:'sleep',ts:base-86400000,data:{start:base-86400000,end:base-86400000+3600000}},
    {type:'sleep',ts:base-7200000,data:{start:base-7200000,end:base-1800000}},
    {type:'sleep',ts:base-600000,data:{start:base-600000,end:null}},
    {type:'sleep',ts:base-10*86400000,data:{start:base-10*86400000,end:base-10*86400000+7200000}}
  ];
  const s=L.longestSleepStretch(es,base);
  if(!s||s.mins!==90) throw new Error('expected 90, got '+JSON.stringify(s));
  if(L.longestSleepStretch([],base)!==null) throw new Error('empty should be null');"
check "ageAt renders human ages from a birth date" node -e "
  const L=require('./js/logic.js');
  if(L.ageAt('2026-10-01','2026-10-12T12:00:00')!=='11 d') throw new Error('days: '+L.ageAt('2026-10-01','2026-10-12T12:00:00'));
  if(L.ageAt('2026-08-01','2026-10-12T12:00:00')!=='2 mo 11 d') throw new Error('months: '+L.ageAt('2026-08-01','2026-10-12T12:00:00'));
  if(L.ageAt('2025-08-12','2026-10-12T12:00:00')!=='1 y 2 mo') throw new Error('years: '+L.ageAt('2025-08-12','2026-10-12T12:00:00'));
  if(L.ageAt('','2026-10-12T12:00:00')!=='') throw new Error('empty dob');
  if(L.ageAt('2026-10-12','2026-10-01T12:00:00')!=='') throw new Error('future birth');"
check "milestones are listed oldest-first and exported in CSV" node -e "
  const L=require('./js/logic.js');
  const es=[
    {id:'m2',type:'milestone',ts:2000,data:{text:'Rolled over'}},
    {id:'m1',type:'milestone',ts:1000,data:{text:'First smile'}},
    {id:'f1',type:'feed',ts:1500,data:{kind:'bottle',oz:4}}
  ];
  const ms=L.milestones(es);
  if(ms.length!==2||ms[0].id!=='m1') throw new Error('order wrong');
  const csv=L.entriesToCSV(es);
  if(!csv.includes('milestone: First smile')) throw new Error('milestone missing from CSV');"
check "index.html wires milestones, birth date, and visit summary" node -e "
  const fs=require('fs'), h=fs.readFileSync('index.html','utf8');
  for (const id of ['mtext','madd','milestonelist','dob','visitbtn','visitsummary']) if(!h.includes('id=\"'+id+'\"')) throw new Error('missing '+id);
  const a=fs.readFileSync('js/app.js','utf8');
  for (const fn of ['renderMilestones','renderVisit','visitSummary(','longestSleepStretch(']) if(!a.includes(fn)) throw new Error('missing '+fn);"
check "sleepNorms picks the range by age" node -e "
  const L=require('./js/logic.js');
  const n1=L.sleepNorms('2026-09-01','2026-10-13T12:00:00');
  if(!n1||n1.minH!==14||n1.maxH!==17) throw new Error('newborn: '+JSON.stringify(n1));
  const n2=L.sleepNorms('2026-02-01','2026-10-13T12:00:00');
  if(!n2||n2.minH!==12||n2.maxH!==16) throw new Error('infant: '+JSON.stringify(n2));
  const n3=L.sleepNorms('2025-01-01','2026-10-13T12:00:00');
  if(!n3||n3.minH!==11||n3.maxH!==14) throw new Error('toddler: '+JSON.stringify(n3));
  if(L.sleepNorms('','2026-10-13')!==null) throw new Error('no dob should be null');
  if(L.sleepNorms('2026-10-13','2026-10-01')!==null) throw new Error('future dob should be null');"
check "sleepAssessment compares today against the norm" node -e "
  const L=require('./js/logic.js');
  const day='2026-10-13';
  const mk=(mins)=>{ const t=new Date(day+'T12:00:00').getTime(); return {id:'s'+mins,type:'sleep',ts:t,data:{start:t,end:t+mins*60000}}; };
  const low=L.sleepAssessment([mk(300)],'2026-09-01',day+'T23:00:00');
  if(low.status!=='low'||low.norm.minH!==14) throw new Error('low: '+JSON.stringify(low));
  if(!/below/.test(low.note)) throw new Error('note: '+low.note);
  const ok=L.sleepAssessment([mk(900)],'2026-09-01',day+'T23:00:00');
  if(ok.status!=='ok') throw new Error('ok: '+ok.status);
  const none=L.sleepAssessment([mk(900)],'',day+'T23:00:00');
  if(none.status!==null) throw new Error('no dob -> null status');"
check "weightGainRate computes oz/day between weigh-ins" node -e "
  const L=require('./js/logic.js');
  const g=(lb,date)=>({id:date,type:'growth',ts:new Date(date+'T12:00:00').getTime(),data:{weightLb:lb}});
  const r=L.weightGainRate([g(8,'2026-10-01'),g(8.5,'2026-10-11')]);
  if(!r) throw new Error('null');
  if(r.days!==10) throw new Error('days='+r.days);
  if(r.ozPerDay!==0.8) throw new Error('ozPerDay='+r.ozPerDay);
  if(L.weightGainRate([g(8,'2026-10-01')])!==null) throw new Error('single measurement should be null');
  if(L.weightGainRate([])!==null) throw new Error('empty should be null');"
check "index.html has the undo button" node -e "
  const fs=require('fs'), h=fs.readFileSync('index.html','utf8');
  if(!h.includes('id=\"undo\"')) throw new Error('missing undo');"
check "app.js wires undo, sleep assessment, weight gain" node -e "
  const fs=require('fs'), a=fs.readFileSync('js/app.js','utf8');
  for (const s of ['undoLast','sleepAssessment','weightGainRate','sa-chip','gainline']) if(!a.includes(s)) throw new Error('missing '+s);"

echo "--- smoke: $pass passed, $fail failed ---"
exit $((fail>0))
