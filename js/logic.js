/* BabyTracker AI — core logic: quick logs, daily summaries, growth log.
   Pure functions; browser-safe. Node tests require this file.
   Entry: { id, type, ts (ms), data }
   types: feed | sleep | diaper | growth
   - feed data: { kind: 'breast-left'|'breast-right'|'bottle', oz }
   - sleep data: { start: ms, end: ms|null }  (end null = in progress)
   - diaper data: { kind: 'wet'|'dirty'|'both' }
   - growth data: { weightLb, heightIn, note }
*/
"use strict";

function pad(n) { return String(n).padStart(2, "0"); }

/** Local YYYY-MM-DD for a timestamp. */
function dayKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

/** "25 min ago", "2 h ago", "3 d ago". nowTs defaults to Date.now(). */
function timeAgo(ts, nowTs) {
  const mins = Math.max(0, Math.round(((nowTs || Date.now()) - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  const h = Math.floor(mins / 60);
  if (h < 24) return h + " h ago";
  return Math.floor(h / 24) + " d ago";
}

/** Format ms timestamp as local "h:mm AM/PM". */
function fmtTime(ts) {
  const d = new Date(ts);
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + ":" + pad(d.getMinutes()) + " " + ap;
}

/**
 * Daily summary for a day key: feeds, bottle oz, sleep minutes (closed naps
 * overlapping the day), diaper counts, last feed timestamp.
 */
function dailySummary(entries, key) {
  const day = entries.filter(e => dayKey(e.ts) === key);
  const feeds = day.filter(e => e.type === "feed");
  const oz = feeds.reduce((s, e) => s + (Number(e.data.oz) || 0), 0);
  let sleepMin = 0;
  day.filter(e => e.type === "sleep" && e.data.end).forEach(e => {
    sleepMin += Math.max(0, Math.round((e.data.end - e.data.start) / 60000));
  });
  const diapers = day.filter(e => e.type === "diaper");
  const wet = diapers.filter(e => e.data.kind === "wet" || e.data.kind === "both").length;
  const dirty = diapers.filter(e => e.data.kind === "dirty" || e.data.kind === "both").length;
  const lastFeed = feeds.length ? Math.max.apply(null, feeds.map(e => e.ts)) : null;
  return { feeds: feeds.length, oz, sleepMin, wet, dirty, diapers: diapers.length, lastFeed };
}

/** Most recent open (no end) sleep entry, or null. */
function openSleep(entries) {
  const open = entries.filter(e => e.type === "sleep" && !e.data.end);
  return open.length ? open[open.length - 1] : null;
}

/** Growth entries sorted oldest-first with per-entry deltas. */
function growthTrend(entries) {
  return entries
    .filter(e => e.type === "growth")
    .sort((a, b) => a.ts - b.ts)
    .map((e, i, arr) => {
      const prev = arr[i - 1];
      return {
        ts: e.ts, date: dayKey(e.ts),
        weightLb: e.data.weightLb, heightIn: e.data.heightIn, note: e.data.note || "",
        dWeight: prev && e.data.weightLb != null && prev.data.weightLb != null
          ? +(e.data.weightLb - prev.data.weightLb).toFixed(2) : null,
        dHeight: prev && e.data.heightIn != null && prev.data.heightIn != null
          ? +(e.data.heightIn - prev.data.heightIn).toFixed(1) : null
      };
    });
}

/** Simple id generator (timestamp + random). */
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { dayKey, timeAgo, fmtTime, dailySummary, openSleep, growthTrend, newId, pad };
}
