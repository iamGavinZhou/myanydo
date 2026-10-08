import assert from 'node:assert/strict';
import { groupByTagSet, tagDefsForSet, byCreatedDesc, byManualOrderThenCreated } from '../src/lib/grouping.js';

const T = (id, createdAt, tags, status = 'todo') => ({
  id, createdAt, tags, status, title: `t-${id}`
});

// tag library fixture: set "Priority" with tags in library order
const SETS = [{ id: 's1', name: 'Priority' }, { id: 's2', name: 'Scene' }];
const DEFS = [
  { id: 'd1', setId: 's1', value: 'high' },
  { id: 'd2', setId: 's1', value: 'low' },
  { id: 'd3', setId: 's1', value: 'nice-to-have' },
  { id: 'd4', setId: 's2', value: 'work' }
];

let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log(`  PASS  ${name}`);
};

console.log('MyAnydo grouping tests');

check('groupByTagSet: groups follow tag library order', () => {
  const tasks = [
    T('a', '2026-10-08T10:00:00Z', ['Priority:low', 'Scene:work']),
    T('b', '2026-10-08T11:00:00Z', ['Priority:high']),
    T('c', '2026-10-08T12:00:00Z', ['Priority:low'])
  ];
  const g = groupByTagSet(tasks, 'Priority', tagDefsForSet(SETS, DEFS, 'Priority'));
  // all tasks carry a Priority tag → no "No Priority" group
  assert.deepEqual(g.map(x => x.label), ['high', 'low', 'nice-to-have']);
  assert.deepEqual(g[0].tasks.map(t => t.id), ['b']);
  assert.deepEqual(g[1].tasks.map(t => t.id), ['c', 'a']); // createdAt desc
  assert.deepEqual(g[2].tasks, []);
});

check('groupByTagSet: task with no tag of the set lands in "No {set}"', () => {
  const tasks = [
    T('a', '2026-10-08T10:00:00Z', []),
    T('b', '2026-10-08T10:00:00Z', ['Scene:work']),
    T('c', '2026-10-08T10:00:00Z', ['Priority:high'])
  ];
  const g = groupByTagSet(tasks, 'Priority', tagDefsForSet(SETS, DEFS, 'Priority'));
  assert.equal(g[g.length - 1].label, 'No Priority');
  assert.deepEqual(g[g.length - 1].tasks.map(t => t.id), ['a', 'b']); // equal createdAt → stable
});

check('groupByTagSet: multiple tags of the same set → first library match wins', () => {
  const tasks = [T('a', '2026-10-08T10:00:00Z', ['Priority:low', 'Priority:high'])];
  const g = groupByTagSet(tasks, 'Priority', tagDefsForSet(SETS, DEFS, 'Priority'));
  assert.deepEqual(g[0].tasks.map(t => t.id), ['a']); // high (library order)
  assert.deepEqual(g[1].tasks.map(t => t.id), []);    // low — no duplicate
  assert.equal(g.length, 3);                          // no "No Priority" group
});

check('groupByTagSet: ignores manual order, sorts createdAt desc inside groups', () => {
  const tasks = [
    T('old', '2026-10-06T10:00:00Z', ['Priority:high'], 'todo'),
    T('new', '2026-10-08T10:00:00Z', ['Priority:high'], 'todo')
  ];
  tasks[0].order = 0; // manual order would put "old" first — must be ignored
  const g = groupByTagSet(tasks, 'Priority', tagDefsForSet(SETS, DEFS, 'Priority'));
  assert.deepEqual(g[0].tasks.map(t => t.id), ['new', 'old']);
});

check('tagDefsForSet preserves library order and attaches set name', () => {
  const defs = tagDefsForSet(SETS, DEFS, 'Priority');
  assert.deepEqual(defs.map(d => d.value), ['high', 'low', 'nice-to-have']);
  assert.ok(defs.every(d => d.setName === 'Priority'));
  assert.deepEqual(tagDefsForSet(SETS, DEFS, 'Nope'), []);
});

check('byCreatedDesc: same-second timestamps order by milliseconds (localeCompare regression)', () => {
  const tasks = [
    T('ms100', '2026-10-08T10:00:00.100Z', []),
    T('ms900', '2026-10-08T10:00:00.900Z', [])
  ];
  assert.deepEqual([...tasks].sort(byCreatedDesc).map(t => t.id), ['ms900', 'ms100']);
});

check('byManualOrderThenCreated: dragged tasks first, rest newest-first', () => {
  const tasks = [
    T('old', '2026-10-06T10:00:00Z', []),
    T('new', '2026-10-08T10:00:00Z', []),
    T('mid', '2026-10-07T10:00:00Z', [])
  ];
  tasks[2].order = 0; // "mid" dragged to top
  assert.deepEqual([...tasks].sort(byManualOrderThenCreated).map(t => t.id), ['mid', 'new', 'old']);
});

console.log(`\n${passed} tests passed ✔`);
