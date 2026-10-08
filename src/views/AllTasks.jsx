import React, { useState } from 'react';
import dayjs from 'dayjs';
import { useApp } from '../store.jsx';
import { collectTags, byCreatedDesc, isOpen, isDone } from '../lib/grouping.js';
import TaskItem from '../components/TaskItem.jsx';
import QuickAdd from '../components/QuickAdd.jsx';
import Icon from '../components/Icon.jsx';

export default function AllTasks({ onOpenTask, onEditNew, collection, tagFilter, onTagFilter }) {
  const { tasks, collections, updateTask } = useApp();
  const [statusFilter, setStatusFilter] = useState('all'); // all | open | done

  const activeFilter = tagFilter || 'all';

  const scoped = collection
    ? tasks.filter(t => t.collectionId === collection)
    : tasks;

  const filtered = scoped.filter(t => {
    if (statusFilter === 'open' && !isOpen(t)) return false;
    if (statusFilter === 'done' && !isDone(t)) return false;
    if (activeFilter !== 'all' && !(t.tags || []).includes(activeFilter)) return false;
    return true;
  });

  const tagOptions = collectTags(scoped);
  const activeCollection = collections.find(c => c.id === collection);

  const toggle = (t) => updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' });

  const colGroups = [
    ...collections
      .map(col => ({ col, tasks: filtered.filter(t => t.collectionId === col.id).sort(byCreatedDesc) }))
      .filter(s => s.tasks.length > 0),
    ...(filtered.some(t => !t.collectionId) && !collection
      ? [{ col: { id: '__none__', name: 'No collection', color: '#B9AF9C' }, tasks: filtered.filter(t => !t.collectionId).sort(byCreatedDesc) }]
      : [])
  ];

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">
            {activeFilter !== 'all'
              ? <span className="allview-tagtitle"><span className="group__hash">#</span>{activeFilter}</span>
              : (activeCollection ? activeCollection.name : 'All My Tasks')}
          </h1>
          <p className="view__sub">
            {activeFilter !== 'all'
              ? 'Filtered by tag'
              : (activeCollection ? 'Collection' : `${tasks.filter(isOpen).length} open · ${tasks.length} total`)}
          </p>
        </div>
        <div className="view__filters">
          <div className="segmented">
            {[['all', 'All'], ['open', 'Open'], ['done', 'Done']].map(([id, label]) => (
              <button
                key={id}
                className={statusFilter === id ? 'is-on' : ''}
                onClick={() => setStatusFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <QuickAdd
        placeholder={activeCollection ? `Add to ${activeCollection.name}…` : 'Add a task…'}
        onAdd={(title) => onEditNew({ title, collectionId: collection || '' })}
      />

      {activeFilter !== 'all' && (
        <div className="tag-selector">
          <button className="tag-sel is-active" onClick={() => onTagFilter('all')}>
            #{activeFilter} ×
          </button>
        </div>
      )}

      {tagOptions.length > 0 && activeFilter === 'all' && (
        <div className="tag-selector">
          <button className="tag-sel is-active" onClick={() => onTagFilter('all')}>
            All tags
          </button>
          {tagOptions.map(({ tag, count }) => (
            <button
              key={tag}
              className="tag-sel"
              onClick={() => onTagFilter(tag)}
            >
              #{tag}
              <span className="tag-sel__n">{count}</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty">
          <Icon name="list" size={44} />
          <h3>Nothing here yet</h3>
          <p>Add your first task above.</p>
        </div>
      ) : (
        colGroups.map(({ col, tasks: list }) => (
          <section key={col.id} className="group">
            <h2 className="group__label">
              <span className="group__dot" style={{ background: col.color }} />
              {col.name}
              <span className="group__count">{list.length}</span>
            </h2>
            {list.map((t, i) => (
              <TaskItem key={t.id} task={t} collections={collections} onOpen={onOpenTask} onToggle={toggle} index={i} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}
