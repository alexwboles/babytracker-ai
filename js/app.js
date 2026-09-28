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
    $("sleepbtn").textContent = os
      ? "End nap (started " + fmtTime(os.data.start) + ")"
      : "Start nap";
  }

  function renderSummary() {
    const key = dayKey(Date.now());
    const s = dailySummary(state.entries, key);
    const lastFeed = s.lastFeed ? timeAgo(s.lastFeed) : "—";
    $("sumgrid").innerHTML =
      card(s.feeds + " feeds", s.oz ? s.oz + " oz bottle" : "last " + lastFeed) +
      card(s.sleepMin + " min", "asleep today") +
      card(s.diapers + " diapers", s.wet + " wet · " + s.dirty + " dirty");
  }
  function card(big, small) {
    return "<div class='stat'><div class='b'>" + esc(big) +
      "</div><div class='s'>" + esc(small) + "</div></div>";
  }

  function renderLog() {
    const items = state.entries.slice().sort((a, b) => b.ts - a.ts).slice(0, 30);
    if (!items.length) {
      $("loglist").innerHTML = "<p class='muted'>No logs yet — tap a button above to record the first one.</p>";
      return;
    }
    $("loglist").innerHTML = items.map(e => {
      let what = "";
      if (e.type === "feed") what = esc(feedLabel(e));
      else if (e.type === "sleep") what = "Nap " + fmtTime(e.data.start) +
        (e.data.end ? " → " + fmtTime(e.data.end) : " · in progress…");
      else if (e.type === "diaper") what = "Diaper · " + esc(e.data.kind);
      else if (e.type === "growth") what = "Growth · " +
        (e.data.weightLb != null ? esc(e.data.weightLb) + " lb " : "") +
        (e.data.heightIn != null ? esc(e.data.heightIn) + " in" : "");
      return "<div class='lrow'><span>" + what + "</span>" +
        "<span class='muted small'>" + fmtTime(e.ts) + " · " + timeAgo(e.ts) + "</span>" +
        "<button class='del' data-id='" + e.id + "'>✕</button></div>";
    }).join("");
    $("loglist").querySelectorAll(".del").forEach(b => b.addEventListener("click", () => {
      state.entries = state.entries.filter(e => e.id !== b.dataset.id);
      save(state); render();
    }));
  }

  function renderGrowth() {
    const trend = growthTrend(state.entries);
    $("growthlist").innerHTML = trend.length ? trend.slice().reverse().map(g =>
      "<div class='lrow'><span>" + esc(g.date) + " · " +
      (g.weightLb != null ? esc(g.weightLb) + " lb" : "—") + " · " +
      (g.heightIn != null ? esc(g.heightIn) + " in" : "—") +
      (g.dWeight != null ? " <span class='muted small'>(" + (g.dWeight >= 0 ? "+" : "") + g.dWeight + " lb)</span>" : "") +
      (g.note ? " · " + esc(g.note) : "") + "</span></div>"
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
