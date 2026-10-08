import React, { useState } from 'react';
import { useApp } from '../store.jsx';
import Icon from './Icon.jsx';

/** Popover to pick/create tags for a task, backed by the tag library. */
export default function TagPicker({ selected, onToggle, onClose }) {
  const { tags, createTagSet, createTag } = useApp();
  const [newSet, setNewSet] = useState('');
  const [newVal, setNewVal] = useState('');
  const [error, setError] = useState('');

  const sets = tags.sets || [];

  const addNew = async () => {
    const setName = newSet.trim();
    const value = newVal.trim();
    if (!setName || !value) return;
    let set = sets.find(s => s.name.toLowerCase() === setName.toLowerCase());
    try {
      if (!set) {
        const sr = await createTagSet(setName);
        if (sr.error) { setError(sr.error); return; }
        set = sr.set;
      }
      const r = await createTag(set.id, value);
      if (r.error) { setError(r.error); return; }
      if (!selected.includes(r.tag)) onToggle(r.tag);
      setNewSet('');
      setNewVal('');
      setError('');
    } catch {
      setError('Failed to create tag');
    }
  };

  return (
    <>
      <div className="tagpicker-backdrop" onClick={onClose} />
      <div className="tagpicker">
        <div className="tagpicker__title">Tags — set:tag</div>
        {sets.length === 0 && <div className="tagpicker__empty">No tag sets yet. Create one below.</div>}
        {sets.map(set => {
          const defs = (tags.tags || []).filter(d => d.setId === set.id);
          if (defs.length === 0) return null;
          return (
            <div key={set.id} className="tagpicker__set">
              <div className="tagpicker__setname">{set.name}</div>
              <div className="tagpicker__settags">
                {defs.map(def => {
                  const tag = `${set.name}:${def.value}`;
                  return (
                    <button
                      key={def.id}
                      className={`tagpicker__opt${selected.includes(tag) ? ' is-on' : ''}`}
                      onClick={() => onToggle(tag)}
                    >
                      {selected.includes(tag) && <Icon name="check" size={11} />}
                      {def.value}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="tagpicker__create">
          <div className="tagpicker__title">New tag</div>
          <div className="tagpicker__newrow">
            <input
              placeholder="set"
              value={newSet}
              list="tag-set-list"
              onChange={(e) => setNewSet(e.target.value)}
            />
            <datalist id="tag-set-list">
              {sets.map(s => <option key={s.id} value={s.name} />)}
            </datalist>
            <span className="tagpicker__colon">:</span>
            <input
              placeholder="tag"
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNew(); } }}
            />
            <button
              className="btn btn--sm"
              onClick={addNew}
              disabled={!newSet.trim() || !newVal.trim()}
            >
              <Icon name="plus" size={13} />
            </button>
          </div>
          {error && <div className="tagpicker__err">{error}</div>}
          <div className="tagpicker__hint">Unknown set names create a new tag set</div>
        </div>
      </div>
    </>
  );
}
