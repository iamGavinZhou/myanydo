/**
 * Checks: My Day drag reorder, sidebar tag library UI + tag click filtering.
 * Usage: node scripts/smoke-dnd.mjs [port]
 */
const port = process.argv[2] || '9333';

const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = list.find(t => t.type === 'page');
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
  ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
});

let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` ${extra}` : ''}`);
  if (!ok) failed++;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);

/* ---- drag & drop reorder ---- */
await evaluate(`(async () => {
  const b = await window.api.bootstrap();
  for (const t of b.tasks.filter(t => t.title.startsWith('Drag '))) await window.api.deleteTask(t.id);
  await window.api.createTask({ title: 'Drag A', dueDate: ${JSON.stringify(today)}, collectionId: 'default', order: 0 });
  await window.api.createTask({ title: 'Drag B', dueDate: ${JSON.stringify(today)}, collectionId: 'default', order: 1 });
  return true;
})()`);
await evaluate(`location.reload()`);
await sleep(1700);
ws.close();
{
  const l2 = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws2 = new WebSocket(l2.find(x => x.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws2.onopen = r);
  const ev = (expr) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e6);
    const onMsg = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === id) { ws2.removeEventListener('message', onMsg); m.error ? reject(new Error(m.error.message)) : resolve(m.result.result.value); }
    };
    ws2.addEventListener('message', onMsg);
    ws2.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
  });

  await sleep(400);
  const idxBefore = await ev(`(() => {
    const titles = [...document.querySelectorAll('.task__title')].map(e => e.textContent);
    return { a: titles.indexOf('Drag A'), b: titles.indexOf('Drag B') };
  })()`);
  check('flat order before drag', idxBefore.a !== -1 && idxBefore.b !== -1 && idxBefore.a < idxBefore.b, JSON.stringify(idxBefore));

  // simulate HTML5 DnD step-by-step (real drags have async gaps between events;
  // dispatching them in one synchronous block would run drop with stale state)
  await ev(`[...document.querySelectorAll('.task')].find(r => r.textContent.includes('Drag B')).dispatchEvent(new DragEvent('dragstart', { bubbles: true }))`);
  await sleep(250);
  await ev(`[...document.querySelectorAll('.task')].find(r => r.textContent.includes('Drag A')).dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }))`);
  await sleep(250);
  await ev(`[...document.querySelectorAll('.task')].find(r => r.textContent.includes('Drag A')).dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }))`);
  await ev(`[...document.querySelectorAll('.task')].find(r => r.textContent.includes('Drag B')).dispatchEvent(new DragEvent('dragend', { bubbles: true }))`);
  await sleep(500);
  const idxAfter = await ev(`(() => {
    const titles = [...document.querySelectorAll('.task__title')].map(e => e.textContent);
    return { a: titles.indexOf('Drag A'), b: titles.indexOf('Drag B') };
  })()`);
  check('drag reorder: B moved before A', idxAfter.b !== -1 && idxAfter.a !== -1 && idxAfter.b < idxAfter.a, JSON.stringify(idxAfter));
  const persisted = await ev(`window.api.bootstrap().then(b => {
    const a = b.tasks.find(t => t.title === 'Drag A');
    const bb = b.tasks.find(t => t.title === 'Drag B');
    return { a: a.order, b: bb.order };
  })`);
  check('manual order persisted', persisted.b < persisted.a, JSON.stringify(persisted));

  await ev(`(async () => {
    const b = await window.api.bootstrap();
    for (const t of b.tasks.filter(t => t.title.startsWith('Drag '))) await window.api.deleteTask(t.id);
    return true;
  })()`);

  /* ---- sidebar tag library UI ---- */
  const sets = await ev(`[...document.querySelectorAll('.tagset__name')].map(e => e.textContent)`);
  check('sidebar shows 4 tag sets', sets.length === 4, JSON.stringify(sets));

  // expand Priority
  await ev(`[...document.querySelectorAll('.tagset__head')].find(h => h.textContent.includes('Priority'))?.click()`);
  await sleep(300);
  const tags = await ev(`(() => {
    const set = [...document.querySelectorAll('.tagset')].find(s => s.textContent.includes('Priority'));
    return [...set.querySelectorAll('.tagset__value')].map(e => e.textContent);
  })()`);
  check('Priority set expands to 3 tags', tags.length === 3 && tags.includes('high') && tags.includes('low'), JSON.stringify(tags));

  // click tag "high" → All Tasks filtered
  await ev(`(() => {
    const set = [...document.querySelectorAll('.tagset')].find(s => s.textContent.includes('Priority'));
    const tag = [...set.querySelectorAll('.tagset__tag')].find(t => t.textContent.trim() === 'high');
    tag.click();
    return true;
  })()`);
  await sleep(500);
  const viewTitle = await ev(`document.querySelector('.view__title')?.textContent`);
  check('clicking tag opens filtered All Tasks', (viewTitle || '').includes('Priority:high'), `"${viewTitle}"`);

  ws2.close();
}

console.log(failed ? `\n${failed} FAILED` : '\nAll DnD/tag-library checks passed ✔');
process.exit(failed ? 1 : 0);
