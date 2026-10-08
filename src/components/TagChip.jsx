import React from 'react';
import { tagColors } from '../lib/tags.js';

export default function TagChip({ tag, onRemove, small }) {
  const c = tagColors(tag);
  return (
    <span
      className={`tag-chip${small ? ' tag-chip--sm' : ''}`}
      style={{ background: c.bg, color: c.fg }}
      title={tag}
    >
      <span className="tag-chip__dot" style={{ background: c.dot }} />
      {tag}
      {onRemove && (
        <button
          className="tag-chip__x"
          onClick={(e) => { e.stopPropagation(); onRemove(tag); }}
          aria-label={`Remove ${tag}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
