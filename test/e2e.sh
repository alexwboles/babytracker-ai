#!/usr/bin/env bash
# BabyTracker AI e2e tests — 7 flows exercising real logic in Node. Exit non-zero on failure.
set -u
cd "$(dirname "$0")/.."
pass=0; fail=0
flow() { # $1 = description, $2 = node script
  if node -e "$2" >/dev/null 2>&1; then echo "PASS: $1"; pass=$((pass+1));
  else echo "FAIL: $1"; fail=$((fail+1)); fi
}

flow "timeAgo buckets: minutes, hours, days" "
  const L=require('./js/logic.js');
  const now=new Date(2026,8,28,12,0,0).getTime();
  if(L.timeAgo(now-25*60000,now)!=='25 min ago') throw new Error('min');
  if(L.timeAgo(now-2*3600000,now)!=='2 h ago') throw new Error('hour');
  if(L.timeAgo(now-3*86400000,now)!=='3 d ago') throw new Error('day');
  if(L.timeAgo(now,now)!=='just now') throw new Error('now');
"

flow "openSleep finds in-progress nap only" "
  const L=require('./js/logic.js');
  const base=new Date(2026,8,28,8,0,0).getTime();
  const es=[
    {type:'sleep',ts:base-7200000,data:{start:base-7200000,end:base-3600000}},
    {type:'sleep',ts:base,data:{start:base,end:null}}
  ];
  const o=L.openSleep(es);
  if(!o||o.data.start!==base) throw new Error('wrong open nap');
  if(L.openSleep(es.slice(0,1))!==null) throw new Error('should be null');
"

flow "sleep minutes only count closed naps" "
  const L=require('./js/logic.js');
  const base=new Date(2026,8,28,8,0,0).getTime();
  const es=[
    {type:'sleep',ts:base,data:{start:base,end:base+3600000}},
    {type:'sleep',ts:base+7200000,data:{start:base+7200000,end:null}}
  ];
  const s=L.dailySummary(es,L.dayKey(base));
  if(s.sleepMin!==60) throw new Error('sleepMin='+s.sleepMin);
"

flow "lastFeed picks the latest feed" "
  const L=require('./js/logic.js');
  const base=new Date(2026,8,28,8,0,0).getTime();
  const es=[
    {type:'feed',ts:base,data:{kind:'bottle',oz:3}},
    {type:'feed',ts:base+5400000,data:{kind:'breast-right',oz:0}}
  ];
  const s=L.dailySummary(es,L.dayKey(base));
  if(s.lastFeed!==base+5400000) throw new Error('lastFeed wrong');
"

flow "growthTrend sorts and computes deltas" "
  const L=require('./js/logic.js');
  const b1=new Date(2026,6,28).getTime(), b2=new Date(2026,8,28).getTime();
  const tr=L.growthTrend([
    {type:'growth',ts:b2,data:{weightLb:12.5,heightIn:24}},
    {type:'growth',ts:b1,data:{weightLb:9.0,heightIn:21.5}}
  ]);
  if(tr.length!==2) throw new Error('len');
  if(tr[0].date!=='2026-07-28') throw new Error('sort: '+tr[0].date);
  if(tr[1].dWeight!==3.5) throw new Error('dWeight='+tr[1].dWeight);
  if(tr[1].dHeight!==2.5) throw new Error('dHeight='+tr[1].dHeight);
  if(tr[0].dWeight!==null) throw new Error('first delta should be null');
"

flow "tipsFor filters by category" "
  const b=require('./js/tipsbank.js');
  const f=b.tipsFor('sleep');
  if(f.length!==5) throw new Error('sleep tips='+f.length);
  if(!f.every(t=>t.cat==='sleep')) throw new Error('leak');
  if(b.tipsFor(null).length!==24) throw new Error('all');
"

flow "entries on other days excluded from summary" "
  const L=require('./js/logic.js');
  const d1=new Date(2026,8,28,8,0,0).getTime();
  const d2=new Date(2026,8,27,8,0,0).getTime();
  const es=[
    {type:'feed',ts:d1,data:{kind:'bottle',oz:4}},
    {type:'feed',ts:d2,data:{kind:'bottle',oz:4}}
  ];
  const s=L.dailySummary(es,L.dayKey(d1));
  if(s.feeds!==1) throw new Error('feeds='+s.feeds);
"

echo "--- e2e: $pass passed, $fail failed ---"
exit $((fail>0))
