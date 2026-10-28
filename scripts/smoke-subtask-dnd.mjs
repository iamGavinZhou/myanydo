/**
 * Subtask drag-to-reorder checks:
 *   1. create a task with 3 subtasks
 *   2. open editor, drag subtask #1 onto subtask #3 (step-by-step events)
 *   3. assert UI order changed + persisted via autosave
 *   4. assert subtask inputs remain editable (not draggable rows)
 * Usage: node scripts/smoke-subtask-dnd.mjs [port]
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
const TITLE = 'Subtask DnD smoke task';

let ws = await connect();
let evaluate = evalOn(ws);

await evaluate(`(async () => {
  const b = await window.api.bootstrap();
  for (const t of b.tasks.filter(t => t.title === ${JSON.stringify(TITLE)})) await window.api.deleteTask(t.id);
  return true;
})()`);
const taskId = await evaluate(`window.api.createTask({
  title: ${JSON.stringify(TITLE)}, dueDate: ${JSON.stringify(today)}, collectionId: 'default',
  subtasks: [
    { id: crypto.randomUUID(), title: 'sub one', done: false },
    { id: crypto.randomUUID(), title: 'sub two', done: false },
    { id: crypto.randomUUID(), title: 'sub three', done: false }
  ]
}).then(t => t.id)`);

// go to My Day + cold reload so the task renders
await evaluate(`location.reload()`);
await sleep(1700);
ws.close();
ws = await connect();
evaluate = evalOn(ws);
await sleep(500);

// open the editor
await evaluate(`[...document.querySelectorAll('.task')].find(r => r.textContent.includes(${JSON.stringify(TITLE)}))?.click()`);
await sleep(600);
check('editor opens', await evaluate(`!!document.querySelector('.drawer')`));

const subValues = () => evaluate(
  `[...document.querySelectorAll('.drawer__subs .subtask:not(.subtask--new) input')].map(i => i.value)`
);
let vals = await subValues();
check('3 subtasks render in order', JSON.stringify(vals) === JSON.stringify(['sub one', 'sub two', 'sub three']), JSON.stringify(vals));

check('grip handles present & draggable (rows are not)',
  await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.drawer__subs .subtask:not(.subtask--new)')];
    if (rows.length !== 3) return false;
    const grips = rows.map(r => r.querySelector('.subtask__grip'));
    return grips.every(g => g && g.getAttribute('draggable') === 'true')
      && rows.every(r => r.getAttribute('draggable') !== 'true');
  })()`));

// drag subtask #1 onto subtask #3 — step by step (like smoke-dnd)
await evaluate(`(() => {
  const rows = [...document.querySelectorAll('.drawer__subs .subtask:not(.subtask--new)')];
  rows[0].querySelector('.subtask__grip').dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
  return true;
})()`);
await sleep(250);
await evaluate(`(() => {
  const rows = [...document.querySelectorAll('.drawer__subs .subtask:not(.subtask--new)')];
  rows[2].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
  return true;
})()`);
await sleep(250);
check('target row highlights while dragging over',
  await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.drawer__subs .subtask:not(.subtask--new)')];
    return rows[2].dataset.dragover !== undefined;
  })()`));
await evaluate(`(() => {
  const rows = [...document.querySelectorAll('.drawer__subs .subtask:not(.subtask--new)')];
  rows[2].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }));
  rows[0].querySelector('.subtask__grip').dispatchEvent(new DragEvent('dragend', { bubbles: true }));
  return true;
})()`);
await sleep(500);

vals = await subValues();
check('subtask moved to last position', JSON.stringify(vals) === JSON.stringify(['sub two', 'sub three', 'sub one']), JSON.stringify(vals));

// autosave persisted?
await sleep(800);
const persisted = await evaluate(`window.api.bootstrap().then(b => {
  const t = b.tasks.find(x => x.id === ${JSON.stringify(taskId)});
  return t.subtasks.map(s => s.title);
})`);
check('reorder persisted via autosave',
  JSON.stringify(persisted) === JSON.stringify(['sub two', 'sub three', 'sub one']), JSON.stringify(persisted));

// input still editable (focus + type)
check('subtask input still editable',
  await evaluate(`(() => {
    const input = [...document.querySelectorAll('.drawer__subs .subtask:not(.subtask--new) input')][0];
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    document.execCommand('insertText', false, '!');
    return input.value.endsWith('!');
  })()`));

// cleanup
await evaluate(`[...document.querySelectorAll('.drawer__head .drawer__iconbtn')].pop()?.click()`);
await sleep(300);
await evaluate(`window.api.deleteTask(${JSON.stringify(taskId)}).then(() => true)`);

ws.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll subtask DnD checks passed ✔');
process.exit(failed ? 1 : 0);
