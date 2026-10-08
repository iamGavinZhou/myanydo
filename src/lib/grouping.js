/**
 * Pure grouping & sorting helpers. Tag format is "{TAG_SET_NAME}:{TAG}".
 * All functions are deterministic and unit-testable (scripts/test-sort.mjs).
 */

export function byCreatedDesc(a, b) {
  // plain string compare — localeCompare's ICU collation treats digits
  // numerically and can mis-order ISO timestamps in the same second
  const x = String(b.createdAt);
  const y = String(a.createdAt);
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Flat My Day order: manually dragged tasks first (by `order` asc),
 * untouched tasks after, newest first.
 */
export function byManualOrderThenCreated(a, b) {
  const oa = a.order ?? Infinity;
  const ob = b.order ?? Infinity;
  if (oa !== ob) return oa - ob;
  return byCreatedDesc(a, b);
}

/** Unique tags across tasks with counts, sorted alphabetically. */
export function collectTags(tasks) {
  const m = new Map();
  for (const t of tasks) {
    for (const tag of t.tags || []) m.set(tag, (m.get(tag) || 0) + 1);
  }
  return [...m.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * Group tasks by a tag SET (e.g. Priority) — one group per tag in that set.
 *
 * - Group order follows the tag library order for that set.
 * - Each group holds tasks carrying "{setName}:{value}", sorted by createdAt desc.
 * - A task with several tags of the same set lands in the first matching group.
 * - Tasks carrying no tag of this set go to a trailing "No {setName}" group.
 * - Manual drag order is ignored in this mode.
 */
export function groupByTagSet(tasks, setName, tagDefs) {
  if (!setName) return [];
  const defs = tagDefs.filter(d => d.setName === setName);
  const prefix = `${setName}:`;

  // assign each task to the FIRST (library-order) tag of this set it carries —
  // grouping is a partition, so a task never appears in two groups
  const groups = defs.map(def => ({ key: def.id, label: def.value, tasks: [] }));
  const rest = [];
  const indexByValue = new Map(defs.map((def, i) => [`${setName}:${def.value}`, i]));

  for (const t of tasks) {
    let placed = false;
    // library order wins: check defs in library order, not the task's tag order
    for (const [tag, idx] of indexByValue) {
      if ((t.tags || []).includes(tag)) {
        groups[idx].tasks.push(t);
        placed = true;
        break;
      }
    }
    if (!placed) rest.push(t);
  }

  for (const g of groups) g.tasks.sort(byCreatedDesc);
  if (rest.length) {
    groups.push({ key: `__no_${setName}`, label: `No ${setName}`, tasks: [...rest].sort(byCreatedDesc) });
  }
  return groups;
}

/** Tag defs flattened with their set name, preserving library order. */
export function tagDefsForSet(tagSets, tagTags, setName) {
  const set = tagSets.find(s => s.name === setName);
  if (!set) return [];
  return tagTags
    .filter(d => d.setId === set.id)
    .map(d => ({ ...d, setName: set.name }));
}

export const isOpen = (t) => t.status !== 'done';
export const isDone = (t) => t.status === 'done';
