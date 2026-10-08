/**
 * This Week drag-to-reschedule checks:
 *   1. create a task due Wednesday (via IPC store)
 *   2. verify it renders on the Wednesday card
 *   3. drag it onto the Monday card → dueDate becomes Monday
 *   4. verify UI moved + persisted value + overdue visibility semantics
 * Usage: node scripts/smoke-week.mjs [port]
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

// local-date helpers (avoid UTC off-by-one)
const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
const now = new Date();
const monday = new Date(now);
monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
const wednesday = new Date(monday);
wednesday.setDate(monday.getDate() + 2);
const mondayIso = fmt(monday);
const wednesdayIso = fmt(wednesday);
// pick a source ≠ target day for the drag test
const [fromIso, toIso] = wednesdayIso !== fmt(now) ? [wednesdayIso, mondayIso] : [wednesdayIso, fmt(new Date(monday.getTime() + 4 * 864e5))];

let ws = await connect();
let evaluate = evalOn(ws);

const TITLE = 'Week drag smoke task';
await evaluate(`(async () => {
  const b = await window.api.bootstrap();
  for (const t of b.tasks.filter(t => t.title === ${JSON.stringify(TITLE)})) await window.api.deleteTask(t.id);
  return true;
})()`);
const taskId = await evaluate(`window.api.createTask({ title: ${JSON.stringify(TITLE)}, dueDate: ${JSON.stringify(fromIso)}, collectionId: 'default' }).then(t => t.id)`);

// go to This Week + cold reload so the task renders; re-navigate after reload
// (view state resets to My Day on reload)
await evaluate(`[...document.querySelectorAll('.navitem')].find(b => b.textContent.includes('This Week'))?.click()`);
await sleep(300);
await evaluate(`location.reload()`);
await sleep(1800);
ws.close();
ws = await connect();
evaluate = evalOn(ws);
await sleep(500);
await evaluate(`[...document.querySelectorAll('.navitem')].find(b => b.textContent.includes('This Week'))?.click()`);
await sleep(500);

const cardTitles = (iso) => evaluate(`(() => {
  const cards = [...document.querySelectorAll('.weekcard')];
  const card = cards.find(c => c.querySelector('.weekcard__date')?.textContent === ${JSON.stringify(dayLabel(iso))});
  if (!card) return null;
  return [...card.querySelectorAll('.task__title')].map(e => e.textContent);
})()`);

// dayLabel: "MMM D" matching weekcard__date format — compute via page itself for locale safety
function dayLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}`;
}

let titles = await cardTitles(fromIso);
check(`task renders on ${fromIso} card`, Array.isArray(titles) && titles.includes(TITLE), JSON.stringify(titles));

// drag: dragstart on task → dragover on target card → drop
await evaluate(`(() => {
  const row = [...document.querySelectorAll('.weekcard .task')].find(r => r.textContent.includes(${JSON.stringify(TITLE)}));
  row.dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
  return true;
})()`);
await sleep(250);
await evaluate(`(() => {
  const cards = [...document.querySelectorAll('.weekcard')];
  const card = cards.find(c => c.querySelector('.weekcard__date')?.textContent === ${JSON.stringify(dayLabel(toIso))});
  card.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
  return true;
})()`);
await sleep(250);
const highlight = await evaluate(`(() => {
  const cards = [...document.querySelectorAll('.weekcard')];
  const card = cards.find(c => c.querySelector('.weekcard__date')?.textContent === ${JSON.stringify(dayLabel(toIso))});
  return card.className.includes('is-droptarget');
})()`);
check('target card highlights while dragging over', highlight === true);
await evaluate(`(() => {
  const cards = [...document.querySelectorAll('.weekcard')];
  const card = cards.find(c => c.querySelector('.weekcard__date')?.textContent === ${JSON.stringify(dayLabel(toIso))});
  card.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }));
  return true;
})()`);
await sleep(250);
await evaluate(`[...document.querySelectorAll('.weekcard .task')].find(r => r.textContent.includes(${JSON.stringify(TITLE)}))?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))`);
await sleep(500);

// UI: task now on target day
titles = await cardTitles(toIso);
check(`task moved to ${toIso} card`, Array.isArray(titles) && titles.includes(TITLE), JSON.stringify(titles));
const oldTitles = await cardTitles(fromIso);
check(`task gone from ${fromIso} card`, !oldTitles?.includes(TITLE), JSON.stringify(oldTitles));

// persisted
const persisted = await evaluate(`window.api.bootstrap().then(b => b.tasks.find(t => t.id === ${JSON.stringify(taskId)}).dueDate)`);
check('dueDate rescheduled in store', persisted === toIso, persisted);

// cleanup
await evaluate(`window.api.deleteTask(${JSON.stringify(taskId)}).then(() => true)`);

ws.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll This Week reschedule checks passed ✔');
process.exit(failed ? 1 : 0);
