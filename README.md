# BabyTracker AI

**One-tap baby care logging for tired parents.** Record feeds, naps, and diapers in seconds, see today's summary at a glance, track growth measurements over time, and browse a gentle soothing-tips library — all running 100% locally in your browser.

## The problem

New parents run on fragmented sleep and can't remember when the last feed was, which side they nursed on, or how many wet diapers today. BabyTracker AI replaces the 3 AM mental math:

1. **CSV export** — download the full log for pediatrician visits or your own records.
2. **Average feed interval** — today's average time between feeds, on the dashboard.
3. **7-day week strip** — per-day feeds, sleep, and diaper totals for the last week.
4. **Nursing side hint** — shows the last breast side and suggests alternating.
5. **Adjust entry time** — backdate any log entry (naps shift as a whole, preserving duration).
1. **Quick-log buttons** — breast (left/right), bottle with ounces, nap start/stop, wet/dirty diapers — one tap, timestamped automatically
2. **Today dashboard** — feed count, bottle ounces, nap minutes, diaper totals, and "last feed: 25 min ago" at a glance
3. **Recent log** — last 30 entries with delete, so mistakes are fixable
4. **Growth tracker** — log weight/height at checkups; see trends with per-visit deltas
5. **Soothing-tips library** — 24 gentle, practical tips across feeding, sleep, fussy, diaper, and general
6. **Optional AI polish** — paste your own OpenAI API key for personalized tip summaries (never required)

> **Gentle note:** BabyTracker AI is a logbook, not medical advice. Percentiles, feeding concerns, and "is this normal?" questions belong with your pediatrician — this app just keeps the numbers handy for those visits.

## How to run

No build step, no server, no account. Just open `index.html` in any browser — or serve it statically:

```bash
npx serve .        # or: python3 -m http.server 8080
```

Your data lives in `localStorage` under `babytracker.v1`. Nothing ever leaves your device.

## How it works

Entries are `{ type, ts, data }` records. `dailySummary()` rolls a day's entries into feeds, bottle ounces, closed-nap minutes, and diaper counts (a "both" diaper counts as one wet + one dirty). Sleep entries stay open (`end: null`) until you tap "End nap". `growthTrend()` sorts measurements oldest-first and computes per-visit deltas.

## Tests

```bash
bash test/smoke.sh   # 12 checks: files, syntax, tips bank integrity, summary math
bash test/e2e.sh     # 7 flows: time buckets, open-nap handling, sleep math, growth deltas, tips filter, day isolation
```

## Pricing vision (future)

Free forever for one child. A paid tier could add multi-child profiles, pediatrician-ready PDF reports, and partner sync — but the core stays free and local-first, always.

## License

MIT — do whatever you want with it.
