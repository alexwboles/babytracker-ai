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

echo "--- smoke: $pass passed, $fail failed ---"
exit $((fail>0))
