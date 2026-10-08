/**
 * Functional smoke test (real data path):
 *   1. create tagged tasks through the IPC store (persisted to disk)
 *   2. reload the page so the renderer bootstraps like a cold start
 *   3. assert flat My Day list, group-by-tag-set grouping, createdAt desc
 *   4. tag library CRUD + global delete
 * Usage: node scripts/smoke-func.mjs [port]
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
const cleanupTitles = ['Older tagged task', 'Newer tagged task'];

let ws = await connect();
let evaluate = evalOn(ws);

await evaluate(`(async () => {
  const b = await window.api.bootstrap();
  for (const t of b.tasks.filter(t => ${JSON.stringify(cleanupTitles)}.includes(t.title))) {
    await window.api.deleteTask(t.id);
  }
  return true;
})()`);

// 1. create tasks: older carries low+work, newer carries high
await evaluate(`window.api.createTask(${JSON.stringify({
  title: 'Older tagged task', dueDate: today,
  tags: ['Priority:low', 'Scene:work'], collectionId: 'default',
  subtasks: [{ id: crypto.randomUUID(), title: 'sub one', done: false }],
  notes: '**markdown** note'
})})`);
await sleep(150);
await evaluate(`window.api.createTask(${JSON.stringify({
  title: 'Newer tagged task', dueDate: today,
  tags: ['Priority:high'], collectionId: 'default', subtasks: [], notes: ''
})})`);
await sleep(150);
// a same-tag second task to check desc order inside a group
await evaluate(`window.api.createTask(${JSON.stringify({
  title: 'Even newer high task', dueDate: today,
  tags: ['Priority:high'], collectionId: 'default', subtasks: [], notes: ''
})})`);

// 2. cold-start reload
await evaluate(`location.reload()`);
await sleep(1800);
ws.close();
ws = await connect();
evaluate = evalOn(ws);
await sleep(400);

// 3. default view = flat list (no grouping)
const rows = await evaluate(`[...document.querySelectorAll('.task__title')].map(e => e.textContent)`);
check('default: flat list shows all three tasks',
  rows.includes('Older tagged task') && rows.includes('Newer tagged task') && rows.includes('Even newer high task'),
  JSON.stringify(rows));
const headers0 = await evaluate(`[...document.querySelectorAll('.group__label')].length`);
check('default: no group headers', headers0 === 0, `headers=${headers0}`);
check('groupby selector collapsed by default',
  await evaluate(`!!document.querySelector('.groupby__current') && !document.querySelector('.groupby__menu')`));
check('groupby shows "None"',
  (await evaluate(`document.querySelector('.groupby__value')?.textContent`)) === 'None');

// 4. open selector, pick the Priority set
await evaluate(`document.querySelector('.groupby__current')?.click()`);
await sleep(300);
const menuOpts = await evaluate(`[...document.querySelectorAll('.groupby__opt')].map(b => b.textContent.trim())`);
check('menu lists None + 4 sets',
  menuOpts.length === 5 && menuOpts.some(o => o.includes('Priority')), JSON.stringify(menuOpts));

await evaluate(`[...document.querySelectorAll('.groupby__opt')].find(b => b.textContent.includes('Priority'))?.click()`);
await sleep(400);
check('selector collapsed after pick, shows Priority',
  (await evaluate(`document.querySelector('.groupby__value')?.textContent`)) === 'Priority'
  && await evaluate(`!document.querySelector('.groupby__menu')`));

// groups: high / low / nice-to-have / No Priority (library order)
const labels = await evaluate(`[...document.querySelectorAll('.group__label')].map(e => e.textContent)`);
check('groups follow tag library order (high, low, nice-to-have, No Priority)',
  labels.length === 4 && labels[0].includes('high') && labels[1].includes('low')
  && labels[2].includes('nice-to-have') && labels[3].includes('No Priority'),
  JSON.stringify(labels));

const highTasks = await evaluate(`(() => {
  const g = [...document.querySelectorAll('.group')][0];
  return [...g.querySelectorAll('.task__title')].map(e => e.textContent);
})()`);
check('high group: createdAt desc',
  highTasks[0] === 'Even newer high task' && highTasks[1] === 'Newer tagged task', JSON.stringify(highTasks));

const lowTasks = await evaluate(`(() => {
  const g = [...document.querySelectorAll('.group')][1];
  return [...g.querySelectorAll('.task__title')].map(e => e.textContent);
})()`);
check('low group holds the older task', lowTasks.includes('Older tagged task'), JSON.stringify(lowTasks));

// manual drag disabled in grouped mode
check('drag disabled while grouped',
  await evaluate(`![...document.querySelectorAll('.task')].some(t => t.getAttribute('draggable') === 'true')`));

// back to flat: drag re-enabled
await evaluate(`document.querySelector('.groupby__current')?.click()`);
await sleep(250);
await evaluate(`[...document.querySelectorAll('.groupby__opt')].find(b => b.textContent.trim().startsWith('None'))?.click()`);
await sleep(400);
check('flat mode restores draggable',
  await evaluate(`[...document.querySelectorAll('.task')].some(t => t.getAttribute('draggable') === 'true')`));

// 5. tag library: defaults + global delete
const lib = await evaluate(`window.api.bootstrap().then(b => b.tags)`);
const prioSet = lib.sets.find(s => s.name === 'Priority');
check('default tag library (4 sets)', lib.sets.length === 4, JSON.stringify(lib.sets.map(s => s.name)));
check('default Priority tags', prioSet && lib.tags.filter(t => t.setId === prioSet.id).length === 3,
  JSON.stringify(lib.tags.filter(t => t.setId === prioSet?.id).map(t => t.value)));

const made = await evaluate(`window.api.createTag(${JSON.stringify(prioSet.id)}, 'zz-temp').then(r => r.tag)`);
check('create tag in library', made === 'Priority:zz-temp', made);
await evaluate(`(async () => {
  const b = await window.api.bootstrap();
  const t = b.tasks.find(t => t.title === 'Older tagged task');
  if (t) await window.api.updateTask(t.id, { tags: [...t.tags, ${JSON.stringify(made)}] });
  return true;
})()`);
const del = await evaluate(`(async () => {
  const b = await window.api.bootstrap();
  const d = b.tags.tags.find(x => x.value === 'zz-temp');
  const r = await window.api.deleteTag(d.id);
  const after = await window.api.bootstrap();
  const task = after.tasks.find(t => t.title === 'Older tagged task');
  return { r, stillUsed: task ? task.tags.includes(${JSON.stringify(made)}) : null };
})()`);
check('delete tag removes it from tasks globally',
  del.r.ok === true && del.stillUsed === false, JSON.stringify(del));

// 6. cleanup
await evaluate(`(async () => {
  const b = await window.api.bootstrap();
  for (const t of b.tasks.filter(t => ${JSON.stringify(cleanupTitles)}.includes(t.title) || t.title === 'Even newer high task')) {
    await window.api.deleteTask(t.id);
  }
  return true;
})()`);

ws.close();
console.log(failed ? `\n${failed} FAILED` : '\nAll functional checks passed ✔');
process.exit(failed ? 1 : 0);
