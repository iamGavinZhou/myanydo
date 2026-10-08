/**
 * Render smoke test: connects to Electron's remote debugging port,
 * asserts key UI elements exist in the loaded page.
 * Usage: node scripts/smoke-render.mjs [port]
 */
const port = process.argv[2] || '9222';

const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = list.find(t => t.type === 'page');
if (!page) {
  console.error('FAIL: no page target found');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

function evaluate(expr) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e6);
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === id) {
        ws.removeEventListener('message', onMsg);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
  });
}

const checks = [
  ['app frame', "!!document.querySelector('.app')"],
  ['sidebar brand', "document.querySelector('.sidebar__brand')?.textContent?.startsWith('MyAnydo')"],
  ['nav: My Day', "!![...document.querySelectorAll('.navitem')].find(b => b.textContent.includes('My Day'))"],
  ['nav: This Week', "!![...document.querySelectorAll('.navitem')].find(b => b.textContent.includes('This Week'))"],
  ['nav: All My Tasks', "!![...document.querySelectorAll('.navitem')].find(b => b.textContent.includes('All My Tasks'))"],
  ['nav: My Calendar', "!![...document.querySelectorAll('.navitem')].find(b => b.textContent.includes('My Calendar'))"],
  ['view title', "document.querySelector('.view__title')?.textContent"],
  ['quick add', "!!document.querySelector('.quick-add input')"],
  ['default collection', "document.querySelector('.sidebar__cols')?.textContent.includes('Personal')"]
];

let failed = 0;
for (const [name, expr] of checks) {
  try {
    const r = await evaluate(expr);
    const val = r.value;
    const ok = val === true || (name === 'view title' && typeof val === 'string' && val.length > 0);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${typeof val === 'string' ? ` → "${val}"` : ''}`);
    if (!ok) failed++;
  } catch (e) {
    console.log(`FAIL  ${name} → ${e.message}`);
    failed++;
  }
}

ws.close();
process.exit(failed ? 1 : 0);
