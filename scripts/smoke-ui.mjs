/**
 * UI interaction checks: subtask add (bug #1), This Week cards, theme picker.
 * Usage: node scripts/smoke-ui.mjs [port]
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
let evaluate = evalOn(ws);
const click = (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)})?.click() ?? false`);

/* ---- 1. subtask add via editor ---- */
const today = new Date().toISOString().slice(0, 10);
await evaluate(`(async () => {
  const b = await window.api.bootstrap();
  for (const t of b.tasks.filter(t => t.title === 'Subtask smoke task')) await window.api.deleteTask(t.id);
  return true;
})()`);
const taskId = await evaluate(`window.api.createTask({ title: 'Subtask smoke task', dueDate: ${JSON.stringify(today)}, collectionId: 'default' }).then(t => t.id)`);

// cold reload so the new task renders
await evaluate(`location.reload()`);
await sleep(1800);
ws.close();
ws = await connect();
evaluate = evalOn(ws);
await sleep(400);

await evaluate(`[...document.querySelectorAll('.task')].find(r => r.textContent.includes('Subtask smoke task'))?.click()`);
await sleep(500);
check('task editor drawer opens', await evaluate(`!!document.querySelector('.drawer')`));

// Enter path
await evaluate(`(() => {
  const input = [...document.querySelectorAll('.subtask--new input')][0];
  input.focus();
  document.execCommand('insertText', false, 'smoke subtask');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  return true;
})()`);
await sleep(600);
let subs = await evaluate(`[...document.querySelectorAll('.subtask input')].map(i => i.value).filter(v => v)`);
check('subtask row appears after Enter', subs.includes('smoke subtask'), JSON.stringify(subs));

// plus button path
await evaluate(`(() => {
  const input = [...document.querySelectorAll('.subtask--new input')][0];
  input.focus();
  document.execCommand('insertText', false, 'plus button subtask');
  document.querySelector('.subtask--new .subtask__check--plus').click();
  return true;
})()`);
await sleep(600);
subs = await evaluate(`[...document.querySelectorAll('.subtask input')].map(i => i.value).filter(v => v)`);
check('subtask row appears after + button click', subs.includes('plus button subtask'), JSON.stringify(subs));

// autosave persisted?
await sleep(800);
const persisted = await evaluate(`window.api.bootstrap().then(b => b.tasks.find(t => t.id === ${JSON.stringify(taskId)}).subtasks.length)`);
check('subtasks persisted (autosave)', persisted === 2, `count=${persisted}`);

// close drawer + cleanup
await evaluate(`[...document.querySelectorAll('.drawer__head .btn--ghost')].pop()?.click()`);
await sleep(400);
await evaluate(`window.api.deleteTask(${JSON.stringify(taskId)}).then(() => true)`);

/* ---- 2. This Week horizontal cards ---- */
await evaluate(`[...document.querySelectorAll('.navitem')].find(b => b.textContent.includes('This Week'))?.click()`);
await sleep(500);
check('week cards container', await evaluate(`!!document.querySelector('.weekcards')`));
const cardCount = await evaluate(`document.querySelectorAll('.weekcard').length`);
check('7 day cards', cardCount === 7, `cards=${cardCount}`);
check('week nav arrows', await evaluate(`document.querySelectorAll('.weeknav').length === 2`));

/* ---- 3. theme picker + dark mode ---- */
await evaluate(`document.querySelector('.sidebar__gear')?.click()`);
await sleep(500);
const opts = await evaluate(`[...document.querySelectorAll('.theme-opt')].map(b => b.textContent.trim())`);
check('theme picker has 3 options', opts.length === 3 && opts.join(',').includes('Dark'), JSON.stringify(opts));
check('settings has no "About tags" card',
  !(await evaluate(`[...document.querySelectorAll('.card__title')].some(t => t.textContent.includes('About tags'))`)));
check('no version footer card',
  !(await evaluate(`document.body.textContent.includes('Local-first todo app for macOS')`)));

await evaluate(`[...document.querySelectorAll('.theme-opt')].find(b => b.textContent.includes('Dark'))?.click()`);
await sleep(500);
check('dark theme applied', await evaluate(`document.documentElement.dataset.theme`) === 'dark');
const darkBg = await evaluate(`getComputedStyle(document.querySelector('.content')).backgroundColor`);
check('dark content background', darkBg === 'rgb(25, 28, 23)', darkBg);

await evaluate(`[...document.querySelectorAll('.theme-opt')].find(b => b.textContent.includes('System'))?.click()`);
await sleep(400);
const backTheme = await evaluate(`document.documentElement.dataset.theme`);
check('back to system theme', backTheme === 'dark' || backTheme === 'light', backTheme);

ws.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll UI checks passed ✔');
process.exit(failed ? 1 : 0);
