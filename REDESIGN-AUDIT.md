# Redesign Audit — babytracker-ai (2026-10-13)

**Competitors studied:** Huckleberry (hybrid dashboard: 4 primary grid cards + 4 compact rows; SweetSpot nap prediction; day view timeline; night mode), Nighp (night mode with red tint; WHO percentile growth charts; PDF pediatrician reports), Lullaby/Material-3 (calendar view, statistics ranges, per-child profiles).

## Visual gaps
1. **Flat stacked sections.** Current page is a vertical stack of labeled sections; Huckleberry's signature is the hybrid dashboard — big primary logging cards up top, compact secondary rows below. Ours buries the one-tap buttons in a form-like layout.
2. **Log buttons look like buttons, not Huckleberry tiles.** Big tap targets with icon + "last: 2h ago" beneath are the category pattern; ours are plain text buttons.
3. **Timeline not day-grouped.** Real trackers group the log by day ("Today", "Yesterday") — ours is a flat last-30 list.
4. **No dark/night mode.** Every competitor ships a night mode for 3 AM logging; Nighp even red-tints it to preserve night vision. Ours is blinding at night.
5. **Nunito-heavy headings look toy-like**; the palette lacks a calm nursery warmth.

## Functional / flow gaps
1. **No nap prediction.** Huckleberry's SweetSpot is the killer feature. We have avg feed interval and sleep assessment but nothing that says "next nap ≈ 2:30 PM". → add `nextNap()` from average wake windows over the last 7 days, shown as a prediction card.
2. **No growth visualization.** → add a lightweight weight-over-time bar/line chart (CSS/SVG, no deps) in the Growth section.
3. **No calendar/day view.** → day-grouped timeline covers the "browse a past day" need cheaply.

## Decisions
- Keep: all logging types, undo, retime/delete, tips bank, CSV export, visit summary, sleep assessment, weight-gain rate — preserved and restyled.
- Identity: "dawn nursery" — warm cream canvas, ink, terracotta accent, sage (sleep), soft blue (feed), butter (diaper). Sharp corners everywhere. Nunito headings retained but tightened.
- Dashboard: 4 big logging cards (Feed/Sleep/Diaper/Growth) with last-log timestamps + inline tap targets; prediction card; compact secondary rows (Week, Recent, Growth, Milestones, Tips).
- Night mode: red-tinted dark theme toggle in the header, persisted in localStorage.
