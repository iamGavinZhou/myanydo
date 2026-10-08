import React, { useState } from 'react';
import Icon from './Icon.jsx';

export default function QuickAdd({ placeholder, onAdd }) {
  const [title, setTitle] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t);
    setTitle('');
  };

  return (
    <form className="quick-add" onSubmit={submit}>
      <span className="quick-add__plus"><Icon name="plus" size={16} /></span>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder || 'Add a task…'}
        aria-label="Add a task"
      />
    </form>
  );
}
