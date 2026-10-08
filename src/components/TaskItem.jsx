import React from 'react';
import dayjs from 'dayjs';
import TagChip from './TagChip.jsx';
import Icon from './Icon.jsx';

export default function TaskItem({ task, collections, onOpen, onToggle, index = 0, ...rest }) {
  const col = collections.find(c => c.id === task.collectionId);
  const done = task.status === 'done';
  const overdue = !done && task.dueDate && dayjs(task.dueDate).isBefore(dayjs(), 'day');
  const subs = task.subtasks || [];
  const subsDone = subs.filter(s => s.done).length;

  return (
    <div
      className={`task${done ? ' is-done' : ''}`}
      style={{ animationDelay: `${Math.min(index * 35, 420)}ms` }}
      onClick={() => onOpen(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(task); }}
      {...rest}
    >
      <button
        className={`task__check${done ? ' is-checked' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggle(task); }}
        aria-label={done ? 'Mark as open' : 'Mark as done'}
      >
        {done && <Icon name="check" size={12} />}
      </button>

      <div className="task__main">
        <div className="task__title">{task.title}</div>
        <div className="task__meta">
          {col && (
            <span className="task__meta-item">
              <span className="task__meta-dot" style={{ background: col.color }} />
              {col.name}
            </span>
          )}
          {task.dueDate && (
            <span className={`task__meta-item${overdue ? ' is-overdue' : ''}`}>
              <Icon name="clock" size={12} />
              {dayjs(task.dueDate).format('MMM D')}
            </span>
          )}
          {subs.length > 0 && (
            <span className="task__meta-item">
              <Icon name="sub" size={12} />
              {subsDone}/{subs.length}
            </span>
          )}
          {task.notes && (
            <span className="task__meta-item"><Icon name="note" size={12} /></span>
          )}
        </div>
      </div>

      {task.tags?.length > 0 && (
        <div className="task__tags">
          {task.tags.slice(0, 3).map(tag => <TagChip key={tag} tag={tag} small />)}
          {task.tags.length > 3 && <span className="task__tags-more">+{task.tags.length - 3}</span>}
        </div>
      )}
    </div>
  );
}
