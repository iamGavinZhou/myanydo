import React, { useState } from 'react';
import { AppProvider, useApp } from './store.jsx';
import Sidebar from './components/Sidebar.jsx';
import MyDay from './views/MyDay.jsx';
import ThisWeek from './views/ThisWeek.jsx';
import AllTasks from './views/AllTasks.jsx';
import CalendarView from './views/CalendarView.jsx';
import Settings from './views/Settings.jsx';
import TaskEditor from './components/TaskEditor.jsx';

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { ready } = useApp();
  const [view, setView] = useState('day');
  const [collection, setCollection] = useState(null); // collection id filter
  const [tagFilter, setTagFilter] = useState(null);   // 'set:tag' filter or null
  const [editor, setEditor] = useState(null);         // {taskId} | {title, dueDate, collectionId}

  const openTask = (task) => setEditor({ taskId: task.id });
  const openNew = (opts) => setEditor({ ...(opts || {}) });

  if (!ready) {
    return <div className="boot"><div className="boot__mark">MyAnydo<span className="boot__dot">.</span></div></div>;
  }

  return (
    <div className="app">
      {/* invisible full-width drag strip so the window can be moved by its top
          edge despite the hidden native title bar */}
      <div className="titlestrip" />
      <Sidebar
        view={view}
        onView={setView}
        collection={collection}
        onCollection={setCollection}
        onTagClick={setTagFilter}
      />
      <main className="content">
        {view === 'day' && <MyDay onOpenTask={openTask} onEditNew={openNew} />}
        {view === 'week' && <ThisWeek onOpenTask={openTask} onEditNew={openNew} />}
        {view === 'all' && (
          <AllTasks
            onOpenTask={openTask}
            onEditNew={openNew}
            collection={collection}
            tagFilter={tagFilter}
            onTagFilter={setTagFilter}
          />
        )}
        {view === 'calendar' && <CalendarView onOpenTask={openTask} />}
        {view === 'settings' && <Settings />}
      </main>
      {editor && <TaskEditor editor={editor} onClose={() => setEditor(null)} />}
    </div>
  );
}
