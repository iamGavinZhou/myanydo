import React, { useState } from 'react';
import dayjs from 'dayjs';
import { useApp } from '../store.jsx';
import { isOpen } from '../lib/grouping.js';
import Icon from './Icon.jsx';

export default function Sidebar({ view, onView, collection, onCollection, onTagClick }) {
  const {
    tasks, collections, tags, settings,
    createCollection, deleteCollection,
    createTagSet, createTag, updateTag, deleteTag
  } = useApp();

  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState('');

  const [addingSet, setAddingSet] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [expandedSets, setExpandedSets] = useState(() => new Set());
  const [addingTagIn, setAddingTagIn] = useState(null);
  const [newTagValue, setNewTagValue] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');

  const today = dayjs().format('YYYY-MM-DD');
  const weekStart = dayjs().startOf('isoWeek');
  const weekEnd = weekStart.add(7, 'day');
  const openTasks = tasks.filter(isOpen);

  const counts = {
    day: openTasks.filter(t => t.dueDate === today).length,
    week: openTasks.filter(t => t.dueDate && dayjs(t.dueDate).isBefore(weekEnd) && !dayjs(t.dueDate).isBefore(weekStart)).length,
    all: openTasks.length
  };

  const navItems = [
    { id: 'day', icon: 'sun', label: 'My Day', count: counts.day },
    { id: 'week', icon: 'week', label: 'This Week', count: counts.week },
    { id: 'all', icon: 'list', label: 'All My Tasks', count: counts.all },
    { id: 'calendar', icon: 'calendar', label: 'My Calendar', count: null }
  ];

  const onNav = (id) => {
    onCollection(null);
    onTagClick(null);
    onView(id);
  };

  /* ---- collections ---- */
  const submitCollection = async (e) => {
    e.preventDefault();
    const name = newColName.trim();
    if (name) await createCollection(name);
    setNewColName('');
    setAddingCol(false);
  };
  const removeCollection = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Delete this collection? Its tasks become uncategorized.')) {
      await deleteCollection(id);
      if (collection === id) onCollection(null);
    }
  };

  /* ---- tag library ---- */
  const toggleSet = (id) => setExpandedSets(p => {
    const n = new Set(p);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const submitSet = async (e) => {
    e.preventDefault();
    const name = newSetName.trim();
    if (!name) { setAddingSet(false); return; }
    const r = await createTagSet(name);
    if (r.set) {
      setExpandedSets(p => new Set([...p, r.set.id]));
      setNewSetName('');
      setAddingSet(false);
      setError('');
    } else {
      setError(r.error || 'Failed');
    }
  };

  const startAddTag = (e, setId) => {
    e.stopPropagation();
    setAddingTagIn(setId);
    setNewTagValue('');
    setExpandedSets(p => new Set([...p, setId]));
  };

  const submitTag = async (e, setId) => {
    e.preventDefault();
    const value = newTagValue.trim();
    if (!value) { setAddingTagIn(null); return; }
    const r = await createTag(setId, value);
    if (r.def) {
      setNewTagValue('');
      setAddingTagIn(null);
      setError('');
    } else {
      setError(r.error || 'Failed');
    }
  };

  const startEdit = (e, def) => {
    e.stopPropagation();
    setEditingTag(def.id);
    setEditValue(def.value);
  };

  const submitEdit = async (e, def) => {
    e.preventDefault();
    const value = editValue.trim();
    setEditingTag(null);
    if (!value || value === def.value) return;
    const r = await updateTag(def.id, value);
    if (r.error) setError(r.error);
  };

  const removeTag = async (e, def) => {
    e.stopPropagation();
    const set = tags.sets.find(s => s.id === def.setId);
    const n = tasks.filter(t => (t.tags || []).includes(`${set?.name}:${def.value}`)).length;
    const msg = n > 0
      ? `Delete tag "${set?.name}:${def.value}"? It will be removed from ${n} task${n > 1 ? 's' : ''}.`
      : `Delete tag "${set?.name}:${def.value}"?`;
    if (window.confirm(msg)) {
      const r = await deleteTag(def.id);
      if (r.error) setError(r.error);
    }
  };

  const tagName = (set, def) => `${set.name}:${def.value}`;

  return (
    <nav className="sidebar">
      <div className="sidebar__brand drag">MyAnydo<span className="sidebar__dot">.</span></div>

      <div className="sidebar__nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`navitem${view === item.id ? ' is-active' : ''}`}
            onClick={() => onNav(item.id)}
          >
            <Icon name={item.icon} size={17} />
            <span>{item.label}</span>
            {item.count != null && item.count > 0 && <span className="navitem__count">{item.count}</span>}
          </button>
        ))}
      </div>

      <div className="sidebar__section">
        <div className="sidebar__sectionhead">
          <span>Collections</span>
          <button className="navitem__add" onClick={() => setAddingCol(a => !a)} aria-label="New collection">
            <Icon name="plus" size={14} />
          </button>
        </div>
        {addingCol && (
          <form className="sidebar__addform" onSubmit={submitCollection}>
            <input
              autoFocus
              placeholder="Collection name"
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              onBlur={() => { if (!newColName.trim()) setAddingCol(false); }}
            />
          </form>
        )}
        <div className="sidebar__cols">
          {collections.map(c => {
            const n = openTasks.filter(t => t.collectionId === c.id).length;
            return (
              <div
                key={c.id}
                className={`navitem navitem--col${view === 'all' && collection === c.id ? ' is-active' : ''}`}
                onClick={() => { onTagClick(null); onCollection(c.id); onView('all'); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') { onTagClick(null); onCollection(c.id); onView('all'); } }}
              >
                <span className="navitem__coldot" style={{ background: c.color }} />
                <span className="navitem__colname">{c.name}</span>
                {n > 0 && <span className="navitem__count">{n}</span>}
                {c.id !== 'default' && (
                  <button className="navitem__del" onClick={(e) => removeCollection(e, c.id)} aria-label={`Delete ${c.name}`}>
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="sidebar__sectionhead sidebar__sectionhead--tags">
          <span>Tags</span>
          <button className="navitem__add" onClick={() => { setAddingSet(a => !a); setError(''); }} aria-label="New tag set">
            <Icon name="plus" size={14} />
          </button>
        </div>
        {addingSet && (
          <form className="sidebar__addform" onSubmit={submitSet}>
            <input
              autoFocus
              placeholder="Tag set name (e.g. Priority)"
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              onBlur={() => { if (!newSetName.trim()) setAddingSet(false); }}
            />
          </form>
        )}

        {error && <div className="sidebar__err">{error}</div>}

        <div className="sidebar__tags">
          {tags.sets.map(set => {
            const defs = tags.tags.filter(d => d.setId === set.id);
            const expanded = expandedSets.has(set.id);
            return (
              <div key={set.id} className="tagset">
                <div
                  className={`tagset__head${expanded ? ' is-open' : ''}`}
                  onClick={() => toggleSet(set.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') toggleSet(set.id); }}
                >
                  <span className="tagset__chev">{expanded ? '▾' : '▸'}</span>
                  <span className="tagset__name">{set.name}</span>
                  <button className="tagset__add" onClick={(e) => startAddTag(e, set.id)} aria-label={`New tag in ${set.name}`}>
                    <Icon name="plus" size={12} />
                  </button>
                </div>
                {expanded && (
                  <div className="tagset__tags">
                    {defs.map(def => editingTag === def.id ? (
                      <form key={def.id} className="tagset__editform" onSubmit={(e) => submitEdit(e, def)}>
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={(e) => submitEdit(e, def)}
                          onKeyDown={(e) => { if (e.key === 'Escape') setEditingTag(null); }}
                        />
                      </form>
                    ) : (
                      <div
                        key={def.id}
                        className="tagset__tag"
                        onClick={() => { onCollection(null); onTagClick(tagName(set, def)); onView('all'); }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') { onCollection(null); onTagClick(tagName(set, def)); onView('all'); } }}
                      >
                        <span className="tagset__dot" />
                        <span className="tagset__value">{def.value}</span>
                        <button className="tagset__op" onClick={(e) => startEdit(e, def)} aria-label="Rename tag">
                          <Icon name="note" size={11} />
                        </button>
                        <button className="tagset__op" onClick={(e) => removeTag(e, def)} aria-label="Delete tag">
                          <Icon name="trash" size={11} />
                        </button>
                      </div>
                    ))}
                    {addingTagIn === set.id ? (
                      <form className="tagset__editform" onSubmit={(e) => submitTag(e, set.id)}>
                        <input
                          autoFocus
                          placeholder="New tag"
                          value={newTagValue}
                          onChange={(e) => setNewTagValue(e.target.value)}
                          onBlur={() => { if (!newTagValue.trim()) setAddingTagIn(null); }}
                        />
                      </form>
                    ) : null}
                    {defs.length === 0 && addingTagIn !== set.id && (
                      <button className="tagset__empty" onClick={(e) => startAddTag(e, set.id)}>
                        <Icon name="plus" size={11} /> Add tag
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar__profile">
        <button className="sidebar__profilebtn" onClick={() => onView('settings')}>
          {settings.avatarDataUrl
            ? <img src={settings.avatarDataUrl} alt="" className="sidebar__avatar" />
            : <span className="sidebar__avatar sidebar__avatar--ph">
                {(settings.nickname || 'Me').slice(0, 1).toUpperCase()}
              </span>}
          <span className="sidebar__nick">{settings.nickname || 'Me'}</span>
        </button>
        <button className="sidebar__gear" onClick={() => onView('settings')} aria-label="Settings">
          <Icon name="gear" size={17} />
        </button>
      </div>
    </nav>
  );
}
