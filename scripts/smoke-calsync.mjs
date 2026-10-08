/**
 * Calendar sync speed test: measures all-calendar sync vs filtered sync.
 * Usage: node scripts/smoke-calsync.mjs [port]
 */
const port = process.argv[2] || '9333';

async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = list.find(t => t.type === 'page');
  if (!page) throw new Error('no page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  return ws;
}

const evalOn = (ws) => (expr) => new Promise((resolve, reject) => {
  const id = Math.floor(Math.random() * 1e6);
  const onMsg = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id === id) {
      ws.removeEventListener('message', onMsg);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result.result.value);
    }
  };
  ws.addEventListener('message', onMsg);
  ws.send(JSON.stringify({
    id, method: 'Runtime.evaluate',
    params: { expression: expr, awaitPromise: true, returnByValue: true }
  }));
});

let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` ${extra}` : ''}`);
  if (!ok) failed++;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let ws = await connect();
const evaluate = evalOn(ws);

// direct API timing (bypasses UI): all calendars vs filtered
const all = await evaluate(`(async () => {
  const t0 = performance.now();
  const r = await window.api.fetchCalendar(new Date(Date.now() - 7 * 864e5).toISOString(), new Date(Date.now() + 35 * 864e5).toISOString(), true);
  return { ms: Math.round(performance.now() - t0), events: r.events.length, queried: r.calendarsQueried, total: r.calendarsTotal, failed: r.failed };
})()`);
check('all-calendar sync completes', all.events >= 0, JSON.stringify(all));
console.log(`  → all calendars: ${(all.ms / 1000).toFixed(1)}s, ${all.events} events, ${all.queried}/${all.total} calendars`);

// filter to the calendars that actually have events (or first 2 names)
const names = await evaluate(`window.api.fetchCalendar(new Date(Date.now() - 7 * 864e5).toISOString(), new Date(Date.now() + 35 * 864e5).toISOString(), false).then(r => [...new Set(r.events.map(e => e.calendar))])`);
const keep = names.length > 0 ? names : ['个人'];
await evaluate(`window.api.setCalendarFilter(${JSON.stringify(keep)})`);
const filtered = await evaluate(`(async () => {
  const t0 = performance.now();
  const r = await window.api.fetchCalendar(new Date(Date.now() - 7 * 864e5).toISOString(), new Date(Date.now() + 35 * 864e5).toISOString(), true);
  return { ms: Math.round(performance.now() - t0), events: r.events.length, queried: r.calendarsQueried, total: r.calendarsTotal };
})()`);
check('filtered sync faster than all-calendar sync', filtered.ms < all.ms, `${(filtered.ms / 1000).toFixed(1)}s vs ${(all.ms / 1000).toFixed(1)}s`);
check('filtered sync keeps the same events', filtered.events === all.events, `${filtered.events} vs ${all.events}`);

// reset filter to all
await evaluate(`window.api.setCalendarFilter(null)`);
check('filter reset to all', await evaluate(`window.api.bootstrap().then(b => b.settings.calendarFilter)`) === null);

ws.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll calendar sync checks passed ✔');
process.exit(failed ? 1 : 0);
