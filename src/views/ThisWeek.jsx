import React, { useState, useRef, useEffect } from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useApp } from '../store.jsx';
import { byCreatedDesc, isOpen } from '../lib/grouping.js';
import TaskItem from '../components/TaskItem.jsx';
import QuickAdd from '../components/QuickAdd.jsx';
import Icon from '../components/Icon.jsx';

dayjs.extend(isoWeek);

export default function ThisWeek({ onOpenTask, onEditNew }) {
  const { tasks, collections, updateTask } = useApp();
  const scroller = useRef(null);

  // Minute ticker: the week (and "today" highlight) rolls over by itself even
  // when this view stays open across midnight / the week boundary.
  const [now, setNow] = useState(() => dayjs());
  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const weekStart = now.startOf('isoWeek');
  const days = Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
  const today = now.format('YYYY-MM-DD');

  const weekTasks = tasks.filter(
    t => t.dueDate && dayjs(t.dueDate).isBefore(weekStart.add(7, 'day')) && !dayjs(t.dueDate).isBefore(weekStart)
  );

  const toggle = (t) => updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' });

  /* ---- drag a task onto a day card → reschedule its due date ---- */
  const [dragTaskId, setDragTaskId] = useState(null);
  const [overDay, setOverDay] = useState(null);
  const resetDrag = () => { setDragTaskId(null); setOverDay(null); };

  const dropOnDay = (iso) => {
    const task = tasks.find(t => t.id === dragTaskId);
    if (task && task.dueDate !== iso) updateTask(task.id, { dueDate: iso });
    resetDrag();
  };

  const taskDnd = (t) => ({
    draggable: true,
    onDragStart: (e) => {
      setDragTaskId(t.id);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd: resetDrag,
    'data-dragging': dragTaskId === t.id ? '' : undefined
  });

  /* vertical wheel → horizontal scroll; also support drag-to-scroll */
  const onWheel = (e) => {
    const el = scroller.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };
  const [grab, setGrab] = useState(null);
  useEffect(() => {
    if (!grab) return;
    const move = (e) => {
      const el = scroller.current;
      if (el) el.scrollLeft = grab.left - (e.clientX - grab.x);
    };
    const up = () => setGrab(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [grab]);

  return (
    <div className="view view--wide">
      <header className="view__head">
        <div>
          <h1 className="view__title">This Week</h1>
          <p className="view__sub">
            {weekStart.format('MMM D')} – {weekStart.add(6, 'day').format('MMM D')} · drag a task onto another day to reschedule
          </p>
        </div>
        <div className="view__stats">
          <span className="stat-chip">{weekTasks.filter(isOpen).length} open</span>
        </div>
      </header>

      <QuickAdd
        placeholder="Add a task to today…"
        onAdd={(title) => onEditNew({ title, dueDate: today })}
      />

      <div className="weekcards-row">
        <button
          className="weeknav weeknav--left"
          onClick={() => scroller.current?.scrollBy({ left: -320, behavior: 'smooth' })}
          aria-label="Scroll left"
        ><Icon name="left" size={16} /></button>
        <div
          ref={scroller}
          className="weekcards"
          onWheel={onWheel}
          onMouseDown={(e) => {
            if (e.target.closest('.task, button, input')) return;
            setGrab({ x: e.clientX, left: scroller.current?.scrollLeft || 0 });
          }}
          style={{ cursor: grab ? 'grabbing' : undefined }}
        >
          {days.map(day => {
            const iso = day.format('YYYY-MM-DD');
            const dayOpen = weekTasks
              .filter(t => t.dueDate === iso && isOpen(t))
              .sort(byCreatedDesc);
            const dayDone = weekTasks.filter(t => t.dueDate === iso && t.status === 'done');
            const isToday = iso === today;
            const isPast = day.isBefore(now, 'day');

            return (
              <section
                key={iso}
                className={`weekcard${isToday ? ' is-today' : ''}${isPast ? ' is-past' : ''}${dragTaskId && overDay === iso ? ' is-droptarget' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setOverDay(iso); }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setOverDay(cur => (cur === iso ? null : cur));
                  }
                }}
                onDrop={(e) => { e.preventDefault(); dropOnDay(iso); }}
              >
                <header className="weekcard__head">
                  <h2>{day.format('dddd')}</h2>
                  <span className="weekcard__date">{day.format('MMM D')}</span>
                  {isToday && <span className="weekcard__today">Today</span>}
                </header>
                <div className="weekcard__list">
                  {dayOpen.length + dayDone.length === 0 ? (
                    <p className="weekcard__empty">{dragTaskId ? 'Drop here to reschedule' : 'No tasks planned'}</p>
                  ) : (
                    <>
                      {dayOpen.map((t, i) => (
                        <TaskItem
                          key={t.id}
                          task={t}
                          collections={collections}
                          onOpen={onOpenTask}
                          onToggle={toggle}
                          index={i}
                          {...taskDnd(t)}
                        />
                      ))}
                      {dayDone.map((t, i) => (
                        <TaskItem
                          key={t.id}
                          task={t}
                          collections={collections}
                          onOpen={onOpenTask}
                          onToggle={toggle}
                          index={i}
                          {...taskDnd(t)}
                        />
                      ))}
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>
        <button
          className="weeknav weeknav--right"
          onClick={() => scroller.current?.scrollBy({ left: 320, behavior: 'smooth' })}
          aria-label="Scroll right"
        ><Icon name="right" size={16} /></button>
      </div>
    </div>
  );
}
