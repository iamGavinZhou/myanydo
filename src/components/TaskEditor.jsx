import React, { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { marked } from 'marked';
import { useApp } from '../store.jsx';
import Icon from './Icon.jsx';
import TagChip from './TagChip.jsx';
import TagPicker from './TagPicker.jsx';

marked.setOptions({ breaks: true, gfm: true });

export default function TaskEditor({ editor, onClose }) {
  const { tasks, collections, createTask, updateTask, deleteTask } = useApp();
  const isNew = !editor.taskId;
  const existing = isNew ? null : tasks.find(t => t.id === editor.taskId);

  const [draft, setDraft] = useState(() => isNew
    ? {
        title: editor.title || '',
        notes: '', subtasks: [], tags: [],
        dueDate: editor.dueDate || null,
        collectionId: editor.collectionId || '',
        status: 'todo'
      }
    : { ...existing });
  const [showTags, setShowTags] = useState(false);
  const [preview, setPreview] = useState(false);
  const [subInput, setSubInput] = useState('');
  const [subDragId, setSubDragId] = useState(null);
  const [subOverId, setSubOverId] = useState(null);
  const first = useRef(true);

  // Esc closes
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Debounced autosave for existing tasks
  useEffect(() => {
    if (isNew || !existing) return;
    if (first.current) { first.current = false; return; }
    const timer = setTimeout(() => {
      updateTask(existing.id, {
        title: draft.title, notes: draft.notes, subtasks: draft.subtasks,
        tags: draft.tags, dueDate: draft.dueDate,
        collectionId: draft.collectionId || null, status: draft.status
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [draft, isNew, existing, updateTask]);

  if (!isNew && !existing) return null;

  const set = (patch) => setDraft(d => ({ ...d, ...patch }));
  const toggleTag = (tag) => setDraft(d => ({
    ...d,
    tags: d.tags.includes(tag) ? d.tags.filter(t => t !== tag) : [...d.tags, tag]
  }));
  const addSub = () => {
    const t = subInput.trim();
    if (!t) return;
    set({ subtasks: [...draft.subtasks, { id: crypto.randomUUID(), title: t, done: false }] });
    setSubInput('');
  };

  /* ---- subtask drag & drop reorder ---- */
  const resetSubDrag = () => { setSubDragId(null); setSubOverId(null); };

  const dropSubtask = () => {
    if (subDragId && subOverId && subDragId !== subOverId) {
      setDraft(d => {
        const from = d.subtasks.findIndex(s => s.id === subDragId);
        const to = d.subtasks.findIndex(s => s.id === subOverId);
        if (from === -1 || to === -1) return d;
        const next = [...d.subtasks];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return { ...d, subtasks: next };
      });
    }
    resetSubDrag();
  };

  const saveNew = async () => {
    if (!draft.title.trim()) return;
    const t = await createTask(draft);
    if (t) onClose();
  };

  const removeTask = async () => {
    if (isNew) return onClose();
    if (!window.confirm('Delete this task?')) return;
    await deleteTask(existing.id);
    onClose();
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Task editor">
        <header className="drawer__head">
          <button
            className={`task__check drawer__check${draft.status === 'done' ? ' is-checked' : ''}`}
            onClick={() => set({ status: draft.status === 'done' ? 'todo' : 'done' })}
            aria-label="Toggle done"
          >
            {draft.status === 'done' && <Icon name="check" size={12} />}
          </button>
          <span className="drawer__statustext">
            {draft.status === 'done' ? 'Done' : 'Open'}
          </span>
          <div className="drawer__actions">
            {!isNew && <button className="btn btn--ghost btn--sm" onClick={removeTask}><Icon name="trash" size={15} /></button>}
            <button className="btn btn--ghost btn--sm" onClick={onClose}><Icon name="x" size={16} /></button>
          </div>
        </header>

        <input
          className="drawer__title"
          value={draft.title}
          placeholder="Task title"
          autoFocus={isNew}
          onChange={(e) => set({ title: e.target.value })}
          onKeyDown={(e) => { if (isNew && e.key === 'Enter') saveNew(); }}
        />

        <div className="drawer__row">
          <label className="drawer__field">
            <span className="drawer__label"><Icon name="calendar" size={14} />Due date</span>
            <div className="drawer__due">
              <input
                type="date"
                value={draft.dueDate || ''}
                onChange={(e) => set({ dueDate: e.target.value || null })}
              />
              {draft.dueDate && (
                <button className="btn btn--ghost btn--sm" onClick={() => set({ dueDate: null })}>
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
          </label>

          <label className="drawer__field">
            <span className="drawer__label"><Icon name="folder" size={14} />Collection</span>
            <select
              value={draft.collectionId || ''}
              onChange={(e) => set({ collectionId: e.target.value || null })}
            >
              <option value="" disabled>Choose collection…</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>

        <div className="drawer__section">
          <span className="drawer__label"><Icon name="tag" size={14} />Tags</span>
          <div className="drawer__tags">
            {draft.tags.map(tag => <TagChip key={tag} tag={tag} onRemove={toggleTag} />)}
            <button className="tag-add" onClick={() => setShowTags(s => !s)}>
              <Icon name="plus" size={13} />
            </button>
            {showTags && (
              <TagPicker
                selected={draft.tags}
                onToggle={toggleTag}
                onClose={() => setShowTags(false)}
              />
            )}
          </div>
        </div>

        <div className="drawer__section drawer__section--grow">
          <div className="drawer__notesbar">
            <span className="drawer__label"><Icon name="note" size={14} />Notes · Markdown</span>
            <div className="drawer__segmented">
              <button className={preview ? '' : 'is-on'} onClick={() => setPreview(false)}>Write</button>
              <button className={preview ? 'is-on' : ''} onClick={() => setPreview(true)}>Preview</button>
            </div>
          </div>
          {preview ? (
            <div
              className="drawer__notes-preview md"
              dangerouslySetInnerHTML={{ __html: marked.parse(draft.notes || '_Nothing to preview_') }}
            />
          ) : (
            <textarea
              className="drawer__notes"
              value={draft.notes}
              placeholder="Add markdown notes… **bold**, `code`, - lists"
              onChange={(e) => set({ notes: e.target.value })}
            />
          )}
        </div>

        <div className="drawer__section">
          <span className="drawer__label"><Icon name="sub" size={14} />Subtasks</span>
          <div className="drawer__subs">
            {draft.subtasks.map((s, i) => (
              <div
                key={s.id}
                className="subtask"
                onDragOver={(e) => { e.preventDefault(); setSubOverId(s.id); }}
                onDrop={dropSubtask}
                data-dragging={subDragId === s.id ? '' : undefined}
                data-dragover={subOverId === s.id && subDragId !== s.id ? '' : undefined}
              >
                <span
                  className="subtask__grip"
                  draggable
                  onDragStart={(e) => {
                    setSubDragId(s.id);
                    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={resetSubDrag}
                  title="Drag to reorder"
                >
                  <Icon name="grip" size={13} />
                </span>
                <button
                  className={`subtask__check${s.done ? ' is-checked' : ''}`}
                  onClick={() => set({
                    subtasks: draft.subtasks.map((x, xi) => xi === i ? { ...x, done: !x.done } : x)
                  })}
                  aria-label="Toggle subtask"
                />
                <input
                  className={s.done ? 'is-done' : ''}
                  value={s.title}
                  onChange={(e) => set({
                    subtasks: draft.subtasks.map((x, xi) => xi === i ? { ...x, title: e.target.value } : x)
                  })}
                />
                <button
                  className="subtask__x"
                  onClick={() => set({ subtasks: draft.subtasks.filter((_, xi) => xi !== i) })}
                  aria-label="Remove subtask"
                >
                  <Icon name="x" size={13} />
                </button>
              </div>
            ))}
            <div className="subtask subtask--new">
              <button className="subtask__check subtask__check--plus" onClick={addSub} aria-label="Add subtask">
                <Icon name="plus" size={11} />
              </button>
              <input
                value={subInput}
                placeholder="Add subtask"
                onChange={(e) => setSubInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }}
              />
            </div>
          </div>
        </div>

        <footer className="drawer__foot">
          {isNew ? (
            <button className="btn btn--primary" onClick={saveNew} disabled={!draft.title.trim() || !draft.collectionId}>
              Add Task
            </button>
          ) : (
            <span className="drawer__created">
              Created {dayjs(existing.createdAt).format('MMM D, YYYY · HH:mm')}
              <span className="drawer__autosave">Auto-saved</span>
            </span>
          )}
        </footer>
      </aside>
    </>
  );
}
