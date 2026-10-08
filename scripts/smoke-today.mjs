/**
 * Today button checks: reset month, select today, scroll into view.
 * Usage: node scripts/smoke-today.mjs [port]
 */
const port = process.argv[2] || '9333';

const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = list.find(t => t.type === 'page');
if (!page) { console.error('FAIL: no page target'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

const evaluate = (expr) => new Promise((resolve, reject) => {
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

await evaluate(`[...document.querySelectorAll('.navitem')].find(b => b.textContent.includes('My Calendar'))?.click()`);
await sleep(2000);

// 1. select an out-month cell (moves selectedDay away from today)
await evaluate(`(() => {
  const cells = [...document.querySelectorAll('.cal__cell')];
  cells.find(c => c.className.includes('is-out'))?.click();
  return true;
})()`);
await sleep(300);
const selBefore = await evaluate(`document.querySelector('.caldetail__head')?.textContent`);
console.log('  (pre) selected day:', selBefore);

// 2. click Today
await evaluate(`[...document.querySelectorAll('.view__filters .btn')].find(b => b.textContent.trim() === 'Today')?.click()`);
await sleep(700);

const today = new Date();
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const expect = `${months[today.getMonth()]} ${today.getDate()}`;

const selAfter = await evaluate(`document.querySelector('.caldetail__head')?.textContent`);
check('Today selects today (detail header)', (selAfter || '').includes(expect), `"${selAfter}"`);

check('today cell carries both is-today and is-sel',
  await evaluate(`!!document.querySelector('.cal__cell.is-today.is-sel')`));

const monthAfter = await evaluate(`document.querySelector('.view__sub')?.textContent`);
check('month reset to current', (monthAfter || '').includes(months[today.getMonth()]), `"${monthAfter}"`);

check('today cell scrolled into view',
  await evaluate(`(() => {
    const el = document.querySelector('.cal__cell.is-today');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
  })()`));

ws.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll Today-button checks passed ✔');
process.exit(failed ? 1 : 0);
