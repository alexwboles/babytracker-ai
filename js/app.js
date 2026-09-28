/* BabyTracker AI — UI glue. State in localStorage under `babytracker.v1`. */
"use strict";
(function () {
  const KEY = "babytracker.v1";
  const $ = id => document.getElementById(id);

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      return s && Array.isArray(s.entries) ? s : { entries: [], tipCat: "general" };
    } catch (e) { return { entries: [], tipCat: "general" }; }
  }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  let state = load();

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const ICONS = {
    feed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.7s6.5 7 6.5 11.3a6.5 6.5 0 0 1-13 0C5.5 9.7 12 2.7 12 2.7z"/></svg>',
    sleep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    diaper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/></svg>',
    growth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>'
  };

  function addEntry(type, data) {
    state.entries.push({ id: newId(), type, ts: Date.now(), data: data || {} });
    save(state); render();
  }

  function feedLabel(e) {
    const k = e.data.kind;
    if (k === "bottle") return "Bottle" + (e.data.oz ? " · " + e.data.oz + " oz" : "");
    if (k === "breast-left") return "Breast · left";
    if (k === "breast-right") return "Breast · right";
    return "Feed";
  }

  function render() {
    renderSummary();
    renderLog();
    renderGrowth();
    renderTips();
    const os = openSleep(state.entries);
    $("sleepbtn").innerHTML = os
      ? '<span class="lb">End nap</span><span class="ls">started ' + esc(fmtTime(os.data.start)) + "</span>"
      : '<span class="lb">Start nap</span><span class="ls">tap to begin</span>';
  }

  function renderSummary() {
    const key = dayKey(Date.now());
    const s = dailySummary(state.entries, key);
    const lastFeed = s.lastFeed ? timeAgo(s.lastFeed) : null;
    const os = openSleep(state.entries);
    $("sumgrid").innerHTML =
      '<div class="now-big">' +
        '<div><div class="ago">' + esc(lastFeed || "—") + '</div>' +
        '<div class="ago-lab">' + (lastFeed ? "since last feed" : "no feeds logged today yet") + "</div></div>" +
        (os ? '<span class="nap-chip"><span class="dot"></span>Nap in progress · ' + esc(fmtTime(os.data.start)) + "</span>" : "") +
      "</div>" +
      '<div class="now-stats">' +
        stat(s.feeds, "feeds") +
        stat(s.oz ? s.oz + " oz" : "—", "bottled") +
        stat(s.sleepMin + " min", "asleep") +
        stat(s.diapers, "diapers") +
      "</div>";
  }
  function stat(big, small) {
    return '<div class="now-stat"><b>' + esc(String(big)) + "</b><span>" + esc(small) + "</span></div>";
  }

  function renderLog() {
    const items = state.entries.slice().sort((a, b) => b.ts - a.ts).slice(0, 30);
    if (!items.length) {
      $("loglist").innerHTML = "<p class='muted'>No logs yet — tap a button above to record the first one.</p>";
      return;
    }
    $("loglist").innerHTML = items.map(e => {
      let what = "", icon = ICONS.growth;
      if (e.type === "feed") { what = esc(feedLabel(e)); icon = ICONS.feed; }
      else if (e.type === "sleep") {
        what = "Nap " + fmtTime(e.data.start) + (e.data.end ? " → " + fmtTime(e.data.end) : " · in progress…");
        icon = ICONS.sleep;
      }
      else if (e.type === "diaper") { what = "Diaper · " + esc(e.data.kind); icon = ICONS.diaper; }
      else if (e.type === "growth") {
        what = "Growth · " +
          (e.data.weightLb != null ? esc(e.data.weightLb) + " lb " : "") +
          (e.data.heightIn != null ? esc(e.data.heightIn) + " in" : "");
        icon = ICONS.growth;
      }
      return "<div class='trow'><span class='tdot " + e.type + "'>" + icon + "</span>" +
        "<span><span class='twhat'>" + what + "</span><br>" +
        "<span class='twhen'>" + fmtTime(e.ts) + " · " + timeAgo(e.ts) + "</span></span>" +
        "<button class='del' data-id='" + e.id + "' aria-label='Delete entry'>✕</button></div>";
    }).join("");
    $("loglist").querySelectorAll(".del").forEach(b => b.addEventListener("click", () => {
      state.entries = state.entries.filter(e => e.id !== b.dataset.id);
      save(state); render();
    }));
  }

  function renderGrowth() {
    const trend = growthTrend(state.entries);
    $("growthlist").innerHTML = trend.length ? trend.slice().reverse().map(g =>
      "<div class='gcard'><span class='gdate'>" + esc(g.date) + "</span>" +
      (g.weightLb != null ? "<span class='gnum'>" + esc(g.weightLb) + " <small>lb</small></span>" : "") +
      (g.heightIn != null ? "<span class='gnum'>" + esc(g.heightIn) + " <small>in</small></span>" : "") +
      (g.dWeight != null ? "<span class='gdelta'>" + (g.dWeight >= 0 ? "+" : "") + g.dWeight + " lb</span>" : "") +
      (g.dHeight != null ? "<span class='gdelta'>" + (g.dHeight >= 0 ? "+" : "") + g.dHeight + " in</span>" : "") +
      (g.note ? "<span class='gnote'>" + esc(g.note) + "</span>" : "") +
      "</div>"
    ).join("") : "<p class='muted'>No measurements yet. Log weight and height at checkups to see the trend.</p>";
  }

  function renderTips() {
    const list = tipsFor(state.tipCat);
    document.querySelectorAll(".tipcat").forEach(b =>
      b.classList.toggle("active", b.dataset.cat === state.tipCat));
    $("tipslist").innerHTML = list.map(t =>
      "<div class='tipcard'>" + esc(t.t) + "</div>").join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-feed]").forEach(b => b.addEventListener("click", () => {
      const kind = b.dataset.feed;
      const oz = kind === "bottle" ? Number($("oz").value) || 0 : 0;
      addEntry("feed", { kind, oz });
    }));
    const bumpOz = d => {
      const cur = Number($("oz").value) || 0;
      $("oz").value = Math.max(0, Math.round((cur + d) * 2) / 2);
    };
    $("ozup").addEventListener("click", () => bumpOz(0.5));
    $("ozdown").addEventListener("click", () => bumpOz(-0.5));
    $("sleepbtn").addEventListener("click", () => {
      const os = openSleep(state.entries);
      if (os) { os.data.end = Date.now(); save(state); render(); }
      else addEntry("sleep", { start: Date.now(), end: null });
    });
    document.querySelectorAll("[data-diaper]").forEach(b => b.addEventListener("click", () => {
      addEntry("diaper", { kind: b.dataset.diaper });
    }));
    $("gadd").addEventListener("click", () => {
      const w = $("gw").value.trim(), h = $("gh").value.trim();
      if (!w && !h) return;
      addEntry("growth", {
        weightLb: w ? Number(w) : null,
        heightIn: h ? Number(h) : null,
        note: $("gnote").value.trim()
      });
      $("gw").value = ""; $("gh").value = ""; $("gnote").value = "";
    });
    document.querySelectorAll(".tipcat").forEach(b => b.addEventListener("click", () => {
      state.tipCat = b.dataset.cat; save(state); renderTips();
    }));
    $("reset").addEventListener("click", () => {
      if (confirm("Clear all baby logs on this device?")) {
        state = { entries: [], tipCat: "general" }; save(state); render();
      }
    });
    render();
  });
})();
