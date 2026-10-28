/**
 * Task drawer header hit-area checks (v1.1.1 fix):
 *   - drawer declares -webkit-app-region: no-drag (escapes the window drag strip)
 *   - status / delete / close buttons are >= 40px tall
 *   - clicking near the TOP edge of each button (the previously dead zone)
 *     actually triggers it
 * Note: CDP clicks can't reproduce OS-level drag-region swallowing, so the
 * no-drag assertion is the guard for the root cause.
 * Usage: node scripts/smoke-drawer-hit.mjs [port]
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
const today = new Date().toISOString().slice(0, 10);
const TITLE = 'Drawer hit-area smoke task';

let ws = await connect();
let evaluate = evalOn(ws);

await evaluate(`(async () => {
  const b = await window.api.bootstrap();
  for (const t of b.tasks.filter(t => t.title === ${JSON.stringify(TITLE)})) await window.api.deleteTask(t.id);
  return true;
})()`);
const taskId = await evaluate(`window.api.createTask({ title: ${JSON.stringify(TITLE)}, dueDate: ${JSON.stringify(today)}, collectionId: 'default' }).then(t => t.id)`);

await evaluate(`location.reload()`);
await sleep(1700);
ws.close();
ws = await connect();
evaluate = evalOn(ws);
await sleep(500);

const openEditor = async () => {
  await evaluate(`[...document.querySelectorAll('.task')].find(r => r.textContent.includes(${JSON.stringify(TITLE)}))?.click()`);
  await sleep(500);
};

await openEditor();
check('drawer opens', await evaluate(`!!document.querySelector('.drawer')`));

check('drawer is no-drag (escapes window drag strip)',
  await evaluate(`getComputedStyle(document.querySelector('.drawer')).webkitAppRegion === 'no-drag'`));

const sizes = await evaluate(`(() => {
  const s = document.querySelector('.drawer__status').getBoundingClientRect();
  const btns = [...document.querySelectorAll('.drawer__iconbtn')].map(b => b.getBoundingClientRect());
  return { status: { w: s.width, h: s.height }, icons: btns.map(r => ({ w: r.width, h: r.height })) };
})()`);
check('status toggle >= 40px tall', sizes.status.h >= 40, JSON.stringify(sizes.status));
check('delete & close are >= 40x40', sizes.icons.length === 2 && sizes.icons.every(r => r.w >= 40 && r.h >= 40), JSON.stringify(sizes.icons));

// helper: dispatch a real-ish click at (x, y) on whatever element is there
const clickAt = (selector, fy) => evaluate(`(() => {
  const btn = document.querySelector(${JSON.stringify(selector)});
  const r = btn.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height * ${fy};
  const el = document.elementFromPoint(x, y);
  if (!el || !(btn === el || btn.contains(el))) return 'miss:' + (el ? el.className : 'none');
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
  return 'hit';
})()`);

// status toggle: click near TOP edge
let r = await clickAt('.drawer__status', 0.12);
await sleep(300);
check('status toggle: top-edge click hits', r === 'hit', r);
check('status flipped to done', await evaluate(`document.querySelector('.drawer__status').classList.contains('is-done')`));
await sleep(700);
check('done persisted (autosave)', await evaluate(`window.api.bootstrap().then(b => b.tasks.find(t => t.id === ${JSON.stringify(taskId)}).status)`) === 'done');

// close button: click near TOP edge
r = await clickAt('.drawer__iconbtn:not(.drawer__iconbtn--danger)', 0.12);
await sleep(400);
check('close: top-edge click hits', r === 'hit', r);
check('drawer closed', !(await evaluate(`!!document.querySelector('.drawer')`)));

// delete button: reopen (task is in Completed section now), stub confirm, top-edge click
await openEditor();
await evaluate(`(() => { window.__origConfirm = window.confirm; window.confirm = () => true; return true; })()`);
r = await clickAt('.drawer__iconbtn--danger', 0.12);
await sleep(500);
await evaluate(`(() => { window.confirm = window.__origConfirm; return true; })()`);
check('delete: top-edge click hits', r === 'hit', r);
const stillThere = await evaluate(`window.api.bootstrap().then(b => !!b.tasks.find(t => t.id === ${JSON.stringify(taskId)}))`);
check('task deleted', stillThere === false);

if (stillThere) await evaluate(`window.api.deleteTask(${JSON.stringify(taskId)}).then(() => true)`);

ws.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll drawer hit-area checks passed ✔');
process.exit(failed ? 1 : 0);
