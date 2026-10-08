# MyAnydo

A local-first todo app for macOS — no account, no cloud, all data stays on your Mac.

![stack](https://img.shields.io/badge/Electron-React-Vite) ![macOS](https://img.shields.io/badge/platform-macOS-blue)

## Version history

### v1.0.0 — 2026-10-08

First official release. Everything below landed within this initial iteration cycle:

**Core views**
- **My Day** — vertical flat list with HTML5 drag-and-drop manual ordering (persisted as a task-level `order`); overdue & completed collapsible sections; minute-ticker auto rollover across midnight/week boundaries.
- **This Week** — 7 horizontal day cards (wheel/drag/arrow scrolling); tasks drag onto another day card to reschedule (due date updated & persisted); per-day lists sorted by creation time (newest first).
- **All My Tasks** — grouped by collection with status filters (All/Open/Done); sidebar tag click jumps here with tag filter applied.
- **My Calendar** — read-only sync of macOS Calendar.app via osascript/JXA; month grid with events + due tasks; day detail panel; Today button (resets month, selects today, scrolls it into view).

**Tasks & tags**
- Task: title, markdown notes (Write/Preview), subtasks, creation time, multiple tags, collection (user-chosen, never defaulted), status, due date.
- Tag format `{TAG_SET_NAME}:{TAG}` (e.g. `priority:low`); managed tag library in sidebar — 4 starter sets (Priority / Type / Status / Energy), sets add-only, tags add/rename/delete with **global propagation** to every task.
- My Day grouping by tag set: groups follow library order, newest-first inside, trailing `No {set}` group, manual drag order ignored while grouped, multi-tag tasks land in the first matching group (partition semantics).

**Sync & performance (calendar)**
- Positional calendar lookup (≈2× faster than naive per-name matching); 3-hour result cache (manual Sync bypasses); 90-second sync cap with explicit failure banner; live sync status line (duration / events / calendars); Calendars picker to exclude slow calendars.

**App shell**
- Settings: avatar & nickname, appearance (light / dark / system), configurable data directory (files migrate).
- macOS hidden title bar with full-width top drag strip; resizable window; modern squircle app icon (white base + vermilion check).

**Fixes along the way**
- `localeCompare` ICU collation mis-sorted same-second ISO timestamps → plain string compare.
- Subtask add was broken (function passed to object-patch `set`) → fixed + regression coverage.
- Tag grouping was per-tag instead of per-tag-set → redesigned per final spec.
- Today button didn't select today or scroll to it → fixed.

**Verification**: 7 unit tests + 5 smoke suites (functional / UI / drag-reorder / week-reschedule / today-button / calendar-sync) all green.

## Features

- **My Day** — today's tasks as a plain vertical list with manual drag-and-drop ordering. Optional tag grouping via the tag selector (`List` / `All tags` / pick one tag); inside a tag group tasks sort by creation time, newest first. Includes an overdue section.
- **This Week** — the current ISO week as horizontal day cards (Mon–Sun). Scroll with the wheel, the arrows, or drag the row; each card holds that day's tasks top-to-bottom with the same tag grouping options.
- **All My Tasks** — everything, grouped by collection, with status filters. Clicking a tag in the sidebar filters this view by that tag.
- **My Calendar** — reads your macOS Calendar.app (local + iCloud calendars) via `osascript`, shows a month grid with events and due tasks, re-syncs every 5 minutes.
- **Tasks** — title, markdown notes, subtasks, creation time, multiple tags, collection (user-chosen, never defaulted), status, due date.
- **Tags** — `set:tag` format (e.g. `priority:low`). Managed in the sidebar: tag sets (add only) contain tags (add/rename/delete). Deleting a tag removes it from every task; renaming updates every task. Ships with Priority / Type / Status / Energy starter sets.
- **Collections** — flat list in the sidebar; `Personal` is created by default. Tasks don't default to any collection — you choose when creating.
- **Settings** — avatar & nickname, appearance (light / dark / system), and a configurable data directory (files move with you).

## Data

Everything lives in plain files inside your data directory (default `~/Documents/MyAnydo`):

```
tasks.json        # all tasks (incl. manual order)
collections.json  # task collections
tags.json         # tag library (sets + tags)
settings.json     # nickname, theme, data dir pointer, avatar name
avatar.*          # profile picture
```

## Getting started (development)

```bash
npm install
npm run icon            # one-time: build build/icon.icns
npm run test:sort       # grouping/sorting unit tests
npm run dev             # start Vite dev server
VITE_DEV_SERVER_URL=http://localhost:5173 npm start   # launch Electron against dev server
```

Smoke tests (run against a live instance with `--remote-debugging-port=9333`):

```bash
node scripts/smoke-func.mjs   # data path, tag grouping, tag library CRUD
node scripts/smoke-ui.mjs     # subtasks, week cards, theme switch
node scripts/smoke-dnd.mjs    # drag reorder, sidebar tag management
```

## Build a double-click installer (dmg)

```bash
npm run dist      # vite build + electron-builder → release/MyAnydo-<version>-arm64.dmg
```

The dmg is unsigned. On first launch macOS may block it: right-click `MyAnydo.app` → **Open** → **Open** (or approve it in *System Settings → Privacy & Security*).

## Calendar permission & sync performance

The first time you open **My Calendar**, macOS asks to allow MyAnydo to control *Calendar*. Click **OK**. If you denied it, re-enable under *System Settings → Privacy & Security → Automation → MyAnydo → Calendar*, then press **Sync**.

Sync performance notes (measured on a real machine):

- Events come through Calendar.app's AppleScript bridge, which is inherently slow: a full sync over 10 calendars takes ~1 minute, dominated by the calendars that actually hold events (the date window barely matters — the system scans the calendar regardless).
- MyAnydo mitigates this with: positional calendar lookup (≈2× faster than naive), a 3-hour result cache (manual **Sync** always bypasses it), a 90-second sync cap that surfaces a clear failure banner instead of syncing forever, a live status line showing duration and event count, and a **Calendars** picker to exclude calendars you don't care about.
- If a sync takes abnormally long, restarting Calendar.app (`quit` + reopen) usually restores its responsiveness — repeated AppleScript load can degrade it.
- A native EventKit implementation would be near-instant, but requires a compiled helper binary and separate TCC permission; not currently included.
