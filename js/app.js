/* BabyTracker AI — UI glue. State in localStorage under `babytracker.v1`. */
"use strict";
(function () {
  const KEY = "babytracker.v1";
  const $ = id => document.getElementById(id);

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.entries)) {
        if (typeof s.dob !== "string") s.dob = "";
        if (typeof s.tipCat !== "string") s.tipCat = "general";
        if (typeof s.night !== "boolean") s.night = false;
        return s;
      }
      return { entries: [], tipCat: "general", dob: "", night: false };
    } catch (e) { return { entries: [], tipCat: "general", dob: "", night: false }; }
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
    growth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
    milestone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21l1.4-6.8-5.1-4.7 6.9-.8z"/></svg>'
  };

  function addEntry(type, data) {
    state.entries.push({ id: newId(), type, ts: Date.now(), data: data || {} });
    save(state); render();
  }

  /** Remove the most recent entry (the 3 AM fat-finger fix). */
  function undoLast() {
    if (!state.entries.length) return null;
    const last = state.entries.slice().sort((a, b) => b.ts - a.ts)[0];
    state.entries = state.entries.filter(e => e.id !== last.id);
    save(state); render();
    return last;
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
    renderPredict();
    renderLast();
    renderWeek();
    renderLog();
    renderGrowth();
    renderMilestones();
    renderTips();
    renderSideHint();
    applyNight();
    const os = openSleep(state.entries);
    $("sleepbtn").innerHTML = os
      ? '<span class="lb">End nap</span><span class="ls">started ' + esc(fmtTime(os.data.start)) + "</span>"
      : '<span class="lb">Start nap</span><span class="ls">tap to begin</span>';
    const dob = $("dob");
    if (dob && dob.value !== (state.dob || "")) dob.value = state.dob || "";
  }

  function fmtInterval(mins) {
    if (mins == null) return "—";
    const h = Math.floor(mins / 60), m = mins % 60;
    return h ? h + "h " + m + "m" : m + "m";
  }

  function renderSummary() {
    const key = dayKey(Date.now());
    const s = dailySummary(state.entries, key);
    const lastFeed = s.lastFeed ? timeAgo(s.lastFeed) : null;
    const os = openSleep(state.entries);
    const avgIv = avgFeedInterval(state.entries, key);
    const stretch = longestSleepStretch(state.entries, Date.now());
    const sa = sleepAssessment(state.entries, state.dob, Date.now());
    const saChip = sa.norm
      ? '<span class="sa-chip ' + sa.status + '" title="' + esc(sa.note) + '">Sleep: ' +
        esc(fmtInterval(sa.sleepMin)) + " · " + esc(sa.note) + "</span>"
      : '<span class="sa-chip none">Add birth date for a sleep assessment</span>';
    $("sumgrid").innerHTML =
      '<div class="now-big">' +
        '<div><div class="ago">' + esc(lastFeed || "—") + '</div>' +
        '<div class="ago-lab">' + (lastFeed ? "since last feed" : "no feeds logged today yet") + "</div></div>" +
        (os ? '<span class="nap-chip"><span class="dot"></span>Nap in progress · ' + esc(fmtTime(os.data.start)) + "</span>" : "") +
      "</div>" +
      '<div class="sa-row">' + saChip + "</div>" +
      '<div class="now-stats">' +
        stat(s.feeds, "feeds") +
        stat(avgIv != null ? fmtInterval(avgIv) : "—", "avg between feeds") +
        stat(s.oz ? s.oz + " oz" : "—", "bottled") +
        stat(s.sleepMin + " min", "asleep") +
        stat(s.diapers, "diapers") +
        stat(stretch ? fmtInterval(stretch.mins) : "—", "longest stretch · 7d") +
      "</div>";
  }

  function renderWeek() {
    const days = weeklySummary(state.entries);
    $("weekstrip").innerHTML = days.map(d =>
      "<div class='wday" + (d.today ? " today" : "") + "'>" +
      "<span class='wd'>" + esc(d.label) + "</span>" +
      "<span class='wv'><b>" + d.feeds + "</b> feeds</span>" +
      "<span class='wv'><b>" + d.sleepMin + "</b> min sleep</span>" +
      "<span class='wv'><b>" + d.diapers + "</b> diapers</span>" +
      "</div>").join("");
  }

  function renderSideHint() {
    const el = $("sidehint");
    if (!el) return;
    const side = lastBreastSide(state.entries);
    el.textContent = side
      ? "Last nursed: " + (side === "breast-left" ? "left" : "right") +
        " — consider the " + (side === "breast-left" ? "right" : "left") + " side next"
      : "";
  }
  function stat(big, small) {
    return '<div class="now-stat"><b>' + esc(String(big)) + "</b><span>" + esc(small) + "</span></div>";
  }

  function dayLabel(key, now) {
    if (key === dayKey(now)) return "Today";
    if (key === dayKey(now - 86400000)) return "Yesterday";
    return key;
  }

  function rowHtml(e) {
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
    else if (e.type === "milestone") {
      what = "Milestone · " + esc(e.data.text || "");
      icon = ICONS.milestone;
    }
    return "<div class='trow'><span class='tdot " + e.type + "'>" + icon + "</span>" +
      "<span><span class='twhat'>" + what + "</span><br>" +
      "<span class='twhen'>" + fmtTime(e.ts) + " · " + timeAgo(e.ts) + "</span></span>" +
      "<button class='adj' data-id='" + e.id + "' aria-label='Adjust time'>Adjust</button>" +
      "<button class='del' data-id='" + e.id + "' aria-label='Delete entry'>✕</button></div>";
  }

  function renderLog() {
    const now = Date.now();
    const items = state.entries.slice().sort((a, b) => b.ts - a.ts).slice(0, 30);
    if (!items.length) {
      $("loglist").innerHTML = "<p class='muted'>No logs yet — tap a button above to record the first one.</p>";
      return;
    }
    const groups = {};
    items.forEach(e => { const k = dayKey(e.ts); (groups[k] = groups[k] || []).push(e); });
    const keys = Object.keys(groups).sort().reverse();
    $("loglist").innerHTML = keys.map(k =>
      "<div class='daygroup'><p class='dayhead'>" + esc(dayLabel(k, now)) + "</p>" +
      groups[k].map(rowHtml).join("") + "</div>").join("");
    $("loglist").querySelectorAll(".del").forEach(b => b.addEventListener("click", () => {
      state.entries = state.entries.filter(e => e.id !== b.dataset.id);
      save(state); render();
    }));
    $("loglist").querySelectorAll(".adj").forEach(b => b.addEventListener("click", () => {
      openTimeAdjust(b);
    }));
  }

  /** "Last logged" times under each dashboard tile. */
  function renderLast() {
    const now = Date.now();
    const latest = type => {
      const es = state.entries.filter(e => e.type === type);
      return es.length ? es.reduce((a, b) => (a.ts > b.ts ? a : b)).ts : null;
    };
    const set = (id, ts) => {
      const n = $(id);
      if (n) n.textContent = ts ? "last " + timeAgo(ts, now) : "nothing logged yet";
    };
    const os = openSleep(state.entries);
    set("last-feed", latest("feed"));
    set("last-sleep", os ? os.data.start : latest("sleep"));
    set("last-diaper", latest("diaper"));
    set("last-growth", latest("growth"));
  }

  /** SweetSpot-style next-nap prediction from wake windows. */
  function renderPredict() {
    const host = $("sweetspot");
    if (!host) return;
    const ico = ICONS.sleep;
    const p = nextNap(state.entries, Date.now());
    if (!p) {
      host.innerHTML = '<span class="p-ico">' + ico + "</span><div><h3>Next nap</h3><p>Log two or more naps and we'll start predicting the next sleep window.</p></div>";
      return;
    }
    if (p.napping) {
      host.innerHTML = '<span class="p-ico">' + ico + "</span><div><h3>Next nap</h3><div class='p-time'>Napping now</div><p>Usual wake window is " + fmtInterval(p.windowMin) + " — the next window starts after this nap.</p></div>";
      return;
    }
    host.innerHTML = '<span class="p-ico">' + ico + "</span><div><h3>Next nap window</h3><div class='p-time'>" +
      esc(fmtTime(p.eta)) + "</div><p>Usual wake window " + fmtInterval(p.windowMin) + " · based on " + p.basis + " recent wake window" + (p.basis === 1 ? "" : "s") + ".</p></div>";
  }

  /** Simple SVG weight-trend chart, no dependencies. */
  function renderGrowthChart() {
    const host = $("growthchart");
    if (!host) return;
    const trend = growthTrend(state.entries).filter(g => g.weightLb != null);
    if (trend.length < 2) { host.innerHTML = ""; return; }
    const W = 560, H = 150, P = 30;
    const ws = trend.map(g => g.weightLb);
    const min = Math.min.apply(null, ws), max = Math.max.apply(null, ws);
    const span = Math.max(0.5, max - min);
    const pts = trend.map((g, i) => {
      const x = P + (i / (trend.length - 1)) * (W - 2 * P);
      const y = H - P - ((g.weightLb - min) / span) * (H - 2 * P);
      return [x, y, g];
    });
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    host.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Weight trend chart">' +
      '<path d="' + line + '" fill="none" stroke="#a8565e" stroke-width="3"/>' +
      pts.map(p => '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5" fill="#a8565e"><title>' +
        esc(p[2].date + " · " + p[2].weightLb + " lb") + "</title></circle>").join("") +
      '<text x="' + P + '" y="16" font-size="12" fill="currentColor">' + max + " lb</text>" +
      '<text x="' + P + '" y="' + (H - 10) + '" font-size="12" fill="currentColor">' + min + " lb</text></svg>";
  }

  function applyNight() {
    document.body.classList.toggle("night", !!state.night);
    const b = $("nightmode");
    if (b) b.setAttribute("aria-pressed", state.night ? "true" : "false");
  }

  function openTimeAdjust(btn) {
    const id = btn.dataset.id;
    const entry = state.entries.find(e => e.id === id);
    if (!entry) return;
    const row = btn.closest(".trow");
    btn.remove();
    const input = document.createElement("input");
    input.type = "datetime-local";
    input.className = "timefix";
    input.setAttribute("aria-label", "New date and time");
    const d = new Date(entry.ts);
    input.value = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
    input.addEventListener("change", () => {
      const v = new Date(input.value).getTime();
      if (retimeEntry(state.entries, id, v)) save(state);
      render();
    });
    input.addEventListener("keydown", ev => {
      if (ev.key === "Escape") render();
    });
    row.appendChild(input);
    input.focus();
  }

  function renderGrowth() {
    renderGrowthChart();
    const trend = growthTrend(state.entries);
    const gain = weightGainRate(state.entries);
    const gainHtml = gain
      ? "<div class='gainline'><b>" + (gain.ozPerDay >= 0 ? "+" : "") + gain.ozPerDay +
        " oz/day</b> weight gain <span class='muted'>(" + esc(gain.from.date) + " → " + esc(gain.to.date) +
        ", " + gain.days + " days apart) · pediatricians often look for ~0.5–1 oz/day in early infancy — ask yours what's right for your baby</span></div>"
      : "";
    $("growthlist").innerHTML = gainHtml + (trend.length ? trend.slice().reverse().map(g =>
      "<div class='gcard'><span class='gdate'>" + esc(g.date) + "</span>" +
      (g.weightLb != null ? "<span class='gnum'>" + esc(g.weightLb) + " <small>lb</small></span>" : "") +
      (g.heightIn != null ? "<span class='gnum'>" + esc(g.heightIn) + " <small>in</small></span>" : "") +
      (g.dWeight != null ? "<span class='gdelta'>" + (g.dWeight >= 0 ? "+" : "") + g.dWeight + " lb</span>" : "") +
      (g.dHeight != null ? "<span class='gdelta'>" + (g.dHeight >= 0 ? "+" : "") + g.dHeight + " in</span>" : "") +
      (g.note ? "<span class='gnote'>" + esc(g.note) + "</span>" : "") +
      "</div>"
    ).join("") : "<p class='muted'>No measurements yet. Log weight and height at checkups to see the trend.</p>");
  }

  function renderMilestones() {
    const host = $("milestonelist");
    if (!host) return;
    const list = milestones(state.entries).slice().reverse();
    host.innerHTML = list.length ? list.map(e => {
      const age = state.dob ? ageAt(state.dob, e.ts) : "";
      return "<div class='mcard'><span class='mstar'>" + ICONS.milestone + "</span>" +
        "<div><div class='mtext'>" + esc(e.data.text || "") + "</div>" +
        "<div class='mwhen'>" + esc(fmtTime(e.ts)) + " · " + esc(timeAgo(e.ts)) +
        (age ? " · age " + esc(age) : "") + "</div></div>" +
        "<button class='del' data-mdel='" + e.id + "' aria-label='Delete milestone'>✕</button></div>";
    }).join("") : "<p class='muted'>No milestones yet — log the firsts as they happen.</p>";
    host.querySelectorAll("[data-mdel]").forEach(b => b.addEventListener("click", () => {
      state.entries = state.entries.filter(e => e.id !== b.dataset.mdel);
      save(state); render();
    }));
  }

  function renderVisit() {
    const v = visitSummary(state.entries, state.dob);
    const sa = sleepAssessment(state.entries, state.dob, v.generatedAt);
    const gain = weightGainRate(state.entries);
    const host = $("visitsummary");
    if (!host) return;
    const gRow = g =>
      "<li>" + esc(g.date) + " — " +
      [g.weightLb != null ? esc(g.weightLb) + " lb" : "",
       g.heightIn != null ? esc(g.heightIn) + " in" : "",
       g.note ? esc(g.note) : ""].filter(Boolean).join(" · ") + "</li>";
    const mRow = e =>
      "<li>" + esc(dayKey(e.ts)) + (state.dob ? " (age " + esc(ageAt(state.dob, e.ts)) + ")" : "") +
      " — " + esc(e.data.text || "") + "</li>";
    host.innerHTML =
      "<h1>Baby visit summary</h1>" +
      "<p class='vsub'>" + esc(new Date(v.generatedAt).toLocaleDateString()) +
      (v.age ? " · age " + esc(v.age) : "") + "</p>" +
      "<h2>Last 7 days</h2>" +
      "<ul class='vlist'>" +
      "<li><b>" + v.totals.feeds + "</b> feeds" +
      (v.avgInterval != null ? " (avg " + esc(fmtInterval(v.avgInterval)) + " apart)" : "") + "</li>" +
      "<li><b>" + v.totals.oz + " oz</b> bottled</li>" +
      "<li><b>" + v.totals.sleepMin + " min</b> asleep</li>" +
      "<li><b>" + v.totals.diapers + "</b> diapers</li>" +
      (v.stretch ? "<li>longest sleep stretch: <b>" + esc(fmtInterval(v.stretch.mins)) + "</b></li>" : "") +
      (sa.norm ? "<li>today's sleep: <b>" + esc(fmtInterval(sa.sleepMin)) + "</b> — " + esc(sa.note) + "</li>" : "") +
      "</ul>" +
      "<h2>Growth</h2>" +
      (gain ? "<p><b>" + (gain.ozPerDay >= 0 ? "+" : "") + gain.ozPerDay +
        " oz/day</b> weight gain since " + esc(gain.from.date) + ".</p>" : "") +
      (v.growth.length ? "<ul class='vlist'>" + v.growth.map(gRow).join("") + "</ul>"
        : "<p class='muted'>No measurements logged.</p>") +
      "<h2>Milestones</h2>" +
      (v.milestones.length ? "<ul class='vlist'>" + v.milestones.map(mRow).join("") + "</ul>"
        : "<p class='muted'>None logged.</p>") +
      "<p class='vfoot'>Logbook summary — not medical advice. Generated locally by BabyTracker AI.</p>";
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
        state = { entries: [], tipCat: "general", dob: "" }; save(state); render();
      }
    });
    const madd = $("madd");
    if (madd) madd.addEventListener("click", () => {
      const t = $("mtext").value.trim();
      if (!t) return;
      addEntry("milestone", { text: t });
      $("mtext").value = "";
    });
    const dob = $("dob");
    if (dob) dob.addEventListener("change", () => {
      state.dob = /^\d{4}-\d{2}-\d{2}$/.test(dob.value) ? dob.value : "";
      save(state); render();
    });
    const nm = $("nightmode");
    if (nm) nm.addEventListener("click", () => {
      state.night = !state.night;
      save(state); applyNight();
    });
    const undo = $("undo");
    if (undo) undo.addEventListener("click", () => {
      const last = undoLast();
      if (!last) return;
      const orig = undo.textContent;
      undo.textContent = "Undone ✓";
      setTimeout(() => { undo.textContent = orig; }, 1400);
    });
    const visitbtn = $("visitbtn");
    if (visitbtn) visitbtn.addEventListener("click", () => {
      renderVisit();
      window.print();
    });
    $("export").addEventListener("click", () => {
      const blob = new Blob([entriesToCSV(state.entries)], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "babytracker-log.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    render();
  });
})();
