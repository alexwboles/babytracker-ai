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

echo "--- smoke: $pass passed, $fail failed ---"
exit $((fail>0))
