import React, { useState } from 'react';
import dayjs from 'dayjs';
import { useApp } from '../store.jsx';
import { groupByTagSet, tagDefsForSet, byManualOrderThenCreated, isOpen, isDone } from '../lib/grouping.js';
import TaskItem from '../components/TaskItem.jsx';
import GroupBySelector from '../components/GroupBySelector.jsx';
import QuickAdd from '../components/QuickAdd.jsx';
import Icon from '../components/Icon.jsx';

export default function MyDay({ onOpenTask, onEditNew }) {
  const { tasks, collections, tags, updateTask, reorderTasks } = useApp();
  const today = dayjs().format('YYYY-MM-DD');
  const [groupBy, setGroupBy] = useState(null); // null | tag set name
  const [showDone, setShowDone] = useState(true);
  const [showOverdue, setShowOverdue] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const due = tasks.filter(t => t.dueDate === today);
  const openDue = due.filter(isOpen);
  const doneDue = due.filter(isDone);
  const overdue = tasks.filter(t => isOpen(t) && t.dueDate && dayjs(t.dueDate).isBefore(dayjs(), 'day'));

  const flatTasks = [...openDue].sort(byManualOrderThenCreated);
  const groups = groupBy
    ? groupByTagSet(openDue, groupBy, tagDefsForSet(tags.sets, tags.tags, groupBy))
    : [];

  const toggle = (t) => updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' });

  /* ---- drag & drop manual ordering (flat mode only) ---- */
  const canDrag = groupBy == null;
  const resetDrag = () => { setDragId(null); setOverId(null); };

  const handleDrop = () => {
    if (canDrag && dragId && overId && dragId !== overId) {
      const from = flatTasks.findIndex(t => t.id === dragId);
      const to = flatTasks.findIndex(t => t.id === overId);
      if (from !== -1 && to !== -1) {
        const next = [...flatTasks];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        reorderTasks(next.map(t => t.id));
      }
    }
    resetDrag();
  };

  const dndProps = (t) => canDrag ? {
    draggable: true,
    onDragStart: () => setDragId(t.id),
    onDragEnd: resetDrag,
    onDragOver: (e) => { e.preventDefault(); setOverId(t.id); },
    onDrop: handleDrop,
    'data-dragging': dragId === t.id ? '' : undefined,
    'data-dragover': overId === t.id && dragId !== t.id ? '' : undefined
  } : {};

  const setOptions = (tags.sets || []).map(s => ({
    id: s.id,
    name: s.name,
    count: (tags.tags || []).filter(d => d.setId === s.id).length
  }));

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">My Day</h1>
          <p className="view__sub">{dayjs().format('dddd, MMMM D')}</p>
        </div>
        <div className="view__stats">
          {openDue.length > 0 && <span className="stat-chip">{openDue.length} open</span>}
          {overdue.length > 0 && <span className="stat-chip stat-chip--warn">{overdue.length} overdue</span>}
        </div>
      </header>

      <QuickAdd
        placeholder="Add a task to today…"
        onAdd={(title) => onEditNew({ title, dueDate: today })}
      />

      {overdue.length > 0 && (
        <section className={`overdue${showOverdue ? '' : ' is-closed'}`}>
          <button className="overdue__head" onClick={() => setShowOverdue(s => !s)}>
            <Icon name="clock" size={14} />
            Overdue · {overdue.length}
            <span className="overdue__chev">{showOverdue ? '−' : '+'}</span>
          </button>
          {showOverdue && overdue.map((t, i) => (
            <TaskItem key={t.id} task={t} collections={collections} onOpen={onOpenTask} onToggle={toggle} index={i} />
          ))}
        </section>
      )}

      <GroupBySelector sets={setOptions} value={groupBy} onChange={setGroupBy} />

      {openDue.length === 0 && overdue.length === 0 ? (
        <div className="empty">
          <Icon name="sun2" size={44} />
          <h3>A clear day</h3>
          <p>Plan something great, or just enjoy the calm.</p>
        </div>
      ) : groupBy ? (
        groups.map(g => (
          <section key={g.key} className="group">
            <h2 className="group__label">
              <span className="group__hash">#</span>{g.label}
              <span className="group__count">{g.tasks.length}</span>
            </h2>
            {g.tasks.length === 0 ? (
              <p className="group__empty">—</p>
            ) : g.tasks.map((t, i) => (
              <TaskItem key={t.id} task={t} collections={collections} onOpen={onOpenTask} onToggle={toggle} index={i} />
            ))}
          </section>
        ))
      ) : (
        <section className="group">
          {canDrag && flatTasks.length > 1 && (
            <p className="drag-hint"><Icon name="sub" size={13} /> Drag tasks to reorder</p>
          )}
          {flatTasks.map((t, i) => (
            <TaskItem
              key={t.id}
              task={t}
              collections={collections}
              onOpen={onOpenTask}
              onToggle={toggle}
              index={i}
              {...dndProps(t)}
            />
          ))}
        </section>
      )}

      {doneDue.length > 0 && (
        <section className="completed">
          <button className="completed__head" onClick={() => setShowDone(s => !s)}>
            <Icon name="check" size={14} />
            Completed · {doneDue.length}
            <span className="overdue__chev">{showDone ? '−' : '+'}</span>
          </button>
          {showDone && doneDue.map((t, i) => (
            <TaskItem key={t.id} task={t} collections={collections} onOpen={onOpenTask} onToggle={toggle} index={i} />
          ))}
        </section>
      )}
    </div>
  );
}
