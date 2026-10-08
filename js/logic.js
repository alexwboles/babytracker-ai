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

function csvCell(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Export every entry as CSV: id, timestamp, date, time, type, detail. Oldest first. */
function entriesToCSV(entries) {
  const rows = [["id", "timestamp", "date", "time", "type", "detail"]];
  (entries || []).slice().sort((a, b) => a.ts - b.ts).forEach(e => {
    let detail = "";
    if (e.type === "feed") {
      detail = e.data.kind === "bottle" ? "bottle " + (e.data.oz || 0) + "oz" : e.data.kind;
    } else if (e.type === "sleep") {
      detail = "nap " + fmtTime(e.data.start) + " → " + (e.data.end ? fmtTime(e.data.end) : "in progress");
    } else if (e.type === "diaper") {
      detail = e.data.kind;
    } else if (e.type === "growth") {
      detail = [
        e.data.weightLb != null ? e.data.weightLb + " lb" : "",
        e.data.heightIn != null ? e.data.heightIn + " in" : "",
        e.data.note || ""
      ].filter(Boolean).join(" ");
    }
    rows.push([e.id, e.ts, dayKey(e.ts), fmtTime(e.ts), e.type, detail]);
  });
  return rows.map(r => r.map(csvCell).join(",")).join("\n");
}

/** Minutes between consecutive feeds on a day key (sorted oldest-first). */
function feedIntervals(entries, key) {
  const day = (entries || [])
    .filter(e => e.type === "feed" && dayKey(e.ts) === key)
    .sort((a, b) => a.ts - b.ts);
  const out = [];
  for (let i = 1; i < day.length; i++) {
    out.push(Math.max(0, Math.round((day[i].ts - day[i - 1].ts) / 60000)));
  }
  return out;
}

/** Average minutes between feeds on a day key; null if fewer than 2 feeds. */
function avgFeedInterval(entries, key) {
  const iv = feedIntervals(entries, key);
  if (!iv.length) return null;
  return Math.round(iv.reduce((s, v) => s + v, 0) / iv.length);
}

/** Kind of the most recent breast feed: 'breast-left' | 'breast-right' | null. */
function lastBreastSide(entries) {
  const feeds = (entries || []).filter(e =>
    e.type === "feed" && (e.data.kind === "breast-left" || e.data.kind === "breast-right"));
  return feeds.length ? feeds[feeds.length - 1].data.kind : null;
}

/** Last 7 days ending on endTs (default now): per-day totals for the week strip. */
function weeklySummary(entries, endTs) {
  const end = new Date(endTs == null ? Date.now() : endTs);
  end.setHours(0, 0, 0, 0);
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86400000);
    const key = dayKey(d.getTime());
    const s = dailySummary(entries || [], key);
    days.push({
      key,
      label: names[d.getDay()] + " " + (d.getMonth() + 1) + "/" + d.getDate(),
      today: i === 0,
      feeds: s.feeds, oz: s.oz, sleepMin: s.sleepMin, diapers: s.diapers
    });
  }
  return days;
}

/** Change an entry's timestamp (backdate a late log). Returns true if updated.
 *  For naps the whole window shifts so the duration is preserved. */
function retimeEntry(entries, id, newTs) {
  if (!isFinite(newTs)) return false;
  const e = (entries || []).find(x => x.id === id);
  if (!e) return false;
  const t = Number(newTs);
  if (e.type === "sleep" && e.data.start) {
    const delta = t - e.data.start;
    e.data.start = t;
    if (e.data.end) e.data.end = e.data.end + delta;
  }
  e.ts = t;
  return true;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { dayKey, timeAgo, fmtTime, dailySummary, openSleep, growthTrend,
    newId, pad, entriesToCSV, feedIntervals, avgFeedInterval, lastBreastSide,
    weeklySummary, retimeEntry };
}
