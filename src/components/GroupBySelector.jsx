import React, { useState, useRef, useEffect } from 'react';
import Icon from './Icon.jsx';

/**
 * Inline "Group by tag set" toggle bar.
 * Collapsed: shows just the current selection. Click → expands to reveal
 * "None" + every tag set; picking one collapses it again.
 * value: null (no grouping) or a tag set name.
 */
export default function GroupBySelector({ sets, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!sets.length) return null;

  const pick = (name) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <div className={`groupby${open ? ' is-open' : ''}`} ref={ref}>
      <button className="groupby__current" onClick={() => setOpen(o => !o)}>
        <Icon name="tag" size={13} />
        <span className="groupby__label">Group by</span>
        <span className="groupby__value">{value || 'None'}</span>
        <span className="groupby__chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="groupby__menu" role="menu">
          <button
            className={`groupby__opt${value === null ? ' is-on' : ''}`}
            onClick={() => pick(null)}
          >
            <span className="groupby__optdot" />
            None
            <span className="groupby__optsub">manual order</span>
          </button>
          {sets.map(s => (
            <button
              key={s.id}
              className={`groupby__opt${value === s.name ? ' is-on' : ''}`}
              onClick={() => pick(s.name)}
            >
              <span className="groupby__optdot" />
              {s.name}
              <span className="groupby__optsub">{s.count || ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
