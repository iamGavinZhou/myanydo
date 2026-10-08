import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const pexec = promisify(execFile);

/**
 * macOS Calendar access via JXA (osascript).
 *
 * Performance facts (measured):
 *   - Calendar.app's AppleScript bridge is effectively SERIAL: parallel
 *     osascript processes make it error out; per-calendar `whose` filters
 *     scan server-side, so cost scales with calendar size, not date range.
 *   - The only real speedups: (a) skip calendars via the user's filter,
 *     (b) locate calendars by index (batch name lookup, one Apple Event),
 *     (c) cache results.
 */

const TOTAL_TIMEOUT_MS = 90 * 1000;

function buildScript(wantedNames, startISO, endISO) {
  const wantedLit = JSON.stringify(wantedNames);
  return `(() => {
    const app = Application('Calendar');
    const wanted = ${wantedLit};
    // batch name lookup — one Apple Event round-trip
    const names = app.calendars.name();
    const out = [];
    const failed = [];
    for (let i = 0; i < names.length; i++) {
      const nm = String(names[i]);
      if (wanted.indexOf(nm) === -1) continue;
      const cal = app.calendars[i];
      try {
        const start = new Date('${startISO}');
        const end = new Date('${endISO}');
        const evs = cal.events.whose({
          _and: [
            { startDate: { _lessThan: end } },
            { endDate: { _greaterThan: start } }
          ]
        })();
        for (const ev of evs) {
          out.push({
            uid: String(ev.uid ? ev.uid() : ''),
            calendar: nm,
            title: String(ev.summary ? ev.summary() : ''),
            start: ev.startDate().toISOString(),
            end: ev.endDate().toISOString(),
            allDay: !!(ev.alldayEvent ? ev.alldayEvent() : false),
            location: String(ev.location ? ev.location() : '')
          });
        }
      } catch (e) { failed.push(nm); }
    }
    return JSON.stringify({ events: out, failed });
  })()`;
}

const listScript = `(() => {
  const names = Application('Calendar').calendars.name();
  return JSON.stringify(names.map(n => ({ name: String(n) })));
})()`;

async function runJxa(script, timeoutMs) {
  const { stdout } = await pexec('osascript', ['-l', 'JavaScript', '-e', script], {
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024
  });
  return JSON.parse(stdout || 'null');
}

const cache = new Map(); // key -> { at, data }
// calendar data doesn't need high freshness — cache for 3 hours;
// manual Sync always bypasses this TTL
const TTL_MS = 3 * 60 * 60 * 1000;

const calListCache = { at: 0, names: null };
const CAL_LIST_TTL_MS = 5 * 60 * 1000;

async function listCalendarsCached() {
  if (calListCache.names && Date.now() - calListCache.at < CAL_LIST_TTL_MS) {
    return calListCache.names;
  }
  const names = (await runJxa(listScript, 30 * 1000)) || [];
  calListCache.at = Date.now();
  calListCache.names = names;
  return names;
}

export async function listCalendars() {
  try {
    return { calendars: await listCalendarsCached() };
  } catch (err) {
    return { calendars: [], error: 'permission' };
  }
}

/**
 * Fetch events overlapping [startISO, endISO).
 * filter: null (all calendars) or array of calendar names to include.
 * Returns { events, durationMs, calendarsQueried, calendarsTotal, failed }.
 */
export async function fetchCalendarEvents({ start, end, force = false, filter = null }) {
  const key = `${start}|${end}|${(filter || []).slice().sort().join(',')}`;
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < TTL_MS) {
    return { ...hit.data, cached: true };
  }

  const t0 = Date.now();
  let allCals = [];
  try {
    allCals = await listCalendarsCached();
  } catch {
    return { events: [], error: 'permission', durationMs: Date.now() - t0 };
  }

  const wantedNames = Array.isArray(filter)
    ? allCals.map(c => c.name).filter(n => filter.includes(n))
    : allCals.map(c => c.name);

  let events = [];
  let failed = [];
  if (wantedNames.length > 0) {
    try {
      const r = await runJxa(buildScript(wantedNames, start, end), TOTAL_TIMEOUT_MS);
      events = (r && r.events) || [];
      failed = (r && r.failed) || [];
    } catch {
      // execFile timeout (90s) or Calendar.app error → report sync failure
      // instead of hanging the UI for minutes
      return {
        events: [],
        error: 'timeout',
        durationMs: Date.now() - t0,
        calendarsQueried: 0,
        calendarsTotal: allCals.length,
        failed: wantedNames
      };
    }
  }

  events.sort((a, b) => a.start.localeCompare(b.start));

  const data = {
    events,
    durationMs: Date.now() - t0,
    calendarsQueried: wantedNames.length,
    calendarsTotal: allCals.length,
    failed
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}
