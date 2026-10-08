import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useApp } from '../store.jsx';
import Icon from '../components/Icon.jsx';
import TaskItem from '../components/TaskItem.jsx';

dayjs.extend(isoWeek);

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarView({ onOpenTask }) {
  const { tasks, collections, updateTask, settings, setCalendarFilter } = useApp();
  const [month, setMonth] = useState(() => dayjs().startOf('month'));
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncInfo, setSyncInfo] = useState(null); // {durationMs, calendarsQueried, calendarsTotal, cached}
  const [selectedDay, setSelectedDay] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [showTasks, setShowTasks] = useState(true);
  const [calMenu, setCalMenu] = useState(false);
  const calMenuRef = useRef(null);

  const gridStart = useMemo(() => month.startOf('isoWeek'), [month]);
  const gridEnd = useMemo(() => gridStart.add(42, 'day'), [gridStart]);
  const todayIso = dayjs().format('YYYY-MM-DD');

  const filter = settings.calendarFilter; // null = all, array = allowlist

  const load = useCallback(async (force) => {
    setLoading(true);
    const r = await window.api.fetchCalendar(
      gridStart.toISOString(),
      gridEnd.toISOString(),
      !!force
    );
    setEvents(r.events || []);
    setError(r.error ? (r.error === 'permission' ? 'permission' : r.error) : null);
    if (!r.error) {
      setSyncInfo({
        durationMs: r.durationMs,
        calendarsQueried: r.calendarsQueried,
        calendarsTotal: r.calendarsTotal,
        failed: r.failed,
        cached: r.cached
      });
    }
    setLoading(false);
  }, [gridStart, gridEnd]);

  useEffect(() => { load(false); }, [load]);

  // re-sync (bypassing cache) whenever the calendar filter changes
  const filterKey = Array.isArray(filter) ? filter.slice().sort().join('|') : 'all';
  useEffect(() => { load(true); }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // periodic refresh while the view is open — respects the 30-min cache TTL
  // (passing force=false lets fresh cache short-circuit; manual Sync forces)
  useEffect(() => {
    const t = setInterval(() => load(false), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  // close calendar menu on outside click
  useEffect(() => {
    if (!calMenu) return;
    const onDoc = (e) => { if (!calMenuRef.current?.contains(e.target)) setCalMenu(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [calMenu]);

  const calendarNames = useMemo(() => {
    const names = new Set(events.map(ev => ev.calendar));
    return [...names].sort();
  }, [events]);

  /** Today button: jump to the current month, select today, scroll to its cell. */
  const goToday = () => {
    setMonth(dayjs().startOf('month'));
    setSelectedDay(todayIso);
    // wait for re-render, then bring the today cell into view
    setTimeout(() => {
      document.querySelector('.cal__cell.is-today')
        ?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }, 120);
  };

  const eventsByDay = useMemo(() => {
    const m = new Map();
    for (const ev of events) {
      const key = dayjs(ev.start).format('YYYY-MM-DD');
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(ev);
    }
    return m;
  }, [events]);

  const tasksByDay = useMemo(() => {
    const m = new Map();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      if (!m.has(t.dueDate)) m.set(t.dueDate, []);
      m.get(t.dueDate).push(t);
    }
    return m;
  }, [tasks]);

  const cells = useMemo(
    () => Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day')),
    [gridStart]
  );

  const toggle = (t) => updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' });
  const dayEvents = (eventsByDay.get(selectedDay) || []).sort((a, b) => a.start.localeCompare(b.start));
  const dayTasks = (tasksByDay.get(selectedDay) || []).sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));

  return (
    <div className="view view--wide">
      <header className="view__head">
        <div>
          <h1 className="view__title">My Calendar</h1>
          <p className="view__sub">{month.format('MMMM YYYY')}</p>
        </div>
        <div className="view__filters">
          <label className="cal-toggle">
            <input type="checkbox" checked={showTasks} onChange={(e) => setShowTasks(e.target.checked)} />
            Show tasks
          </label>
          <div className="calpicker" ref={calMenuRef}>
            <button className="calpicker__btn" onClick={() => setCalMenu(o => !o)}>
              <Icon name="calendar" size={14} />
              Calendars
              {Array.isArray(filter) && <span className="calpicker__n">{filter.length}</span>}
              <span className="calpicker__chev">{calMenu ? '▾' : '▸'}</span>
            </button>
            {calMenu && (
              <div className="calpicker__menu">
                <p className="calpicker__hint">Uncheck a calendar to skip it while syncing — big speed win.</p>
                <button
                  className={`calpicker__opt${!Array.isArray(filter) ? ' is-on' : ''}`}
                  onClick={() => { setCalendarFilter(null); }}
                >
                  All calendars
                </button>
                {calendarNames.map(name => (
                  <label key={name} className="calpicker__opt">
                    <input
                      type="checkbox"
                      checked={!Array.isArray(filter) || filter.includes(name)}
                      onChange={(e) => {
                        const all = calendarNames;
                        const next = e.target.checked
                          ? [...new Set([...(filter || []), name])]
                          : (filter || all).filter(n => n !== name);
                        setCalendarFilter(next.length === all.length ? null : next);
                      }}
                    />
                    <span className="calbadge">{name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn--ghost btn--sm" onClick={goToday}>
            Today
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setMonth(m => m.subtract(1, 'month'))} aria-label="Previous month">
            <Icon name="left" size={16} />
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setMonth(m => m.add(1, 'month'))} aria-label="Next month">
            <Icon name="right" size={16} />
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => load(true)} disabled={loading}>
            <Icon name="refresh" size={15} /> {loading ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      </header>

      {error === 'permission' && (
        <div className="banner banner--warn">
          <Icon name="calendar" size={16} />
          <span>
            MyAnydo needs permission to read your macOS calendars. Allow it in
            <strong> System Settings → Privacy &amp; Security → Automation → MyAnydo → Calendar</strong>,
            then press Sync.
          </span>
        </div>
      )}
      {error === 'timeout' && (
        <div className="banner banner--warn">
          <Icon name="clock" size={16} />
          <span>
            Sync failed — it took longer than 90 seconds. Press Sync to retry,
            or use the <strong>Calendars</strong> picker to exclude slow calendars.
          </span>
        </div>
      )}

      {error === 'error' && (
        <div className="banner banner--warn">
          <Icon name="refresh" size={16} />
          <span>Could not read Calendar.app. Make sure Calendar is set up, then press Sync.</span>
        </div>
      )}

      {syncInfo && !loading && (
        <div className="syncinfo">
          {syncInfo.cached
            ? <span>cached · {events.length} events</span>
            : <span>Synced {events.length} events from {syncInfo.calendarsQueried}/{syncInfo.calendarsTotal} calendars in {(syncInfo.durationMs / 1000).toFixed(1)}s</span>}
          {syncInfo.failed?.length > 0 && (
            <span className="syncinfo__warn"> · skipped: {syncInfo.failed.join(', ')}</span>
          )}
        </div>
      )}
      {loading && (
        <div className="syncinfo"><span className="syncinfo__spin" /> syncing{Array.isArray(filter) ? ` ${filter.length} calendar${filter.length === 1 ? '' : 's'}…` : '…'}</div>
      )}

      <div className="cal">
        <div className="cal__weekdays">
          {WEEKDAYS.map(d => <div key={d} className="cal__wd">{d}</div>)}
        </div>
        <div className="cal__grid">
          {cells.map(day => {
            const iso = day.format('YYYY-MM-DD');
            const inMonth = day.month() === month.month();
            const isToday = iso === todayIso;
            const isSel = iso === selectedDay;
            const evs = eventsByDay.get(iso) || [];
            const tks = showTasks ? (tasksByDay.get(iso) || []) : [];
            return (
              <button
                key={iso}
                className={`cal__cell${inMonth ? '' : ' is-out'}${isToday ? ' is-today' : ''}${isSel ? ' is-sel' : ''}`}
                onClick={() => setSelectedDay(iso)}
              >
                <span className="cal__daynum">{day.date()}</span>
                <div className="cal__pills">
                  {evs.slice(0, 3).map(ev => (
                    <span key={ev.uid + ev.start} className="cal__ev" title={ev.title}>
                      {!ev.allDay && <em>{dayjs(ev.start).format('H:mm')}</em>} {ev.title}
                    </span>
                  ))}
                  {tks.slice(0, 2).map(t => (
                    <span key={t.id} className={`cal__tk${t.status === 'done' ? ' is-done' : ''}`} title={t.title}>
                      {t.title}
                    </span>
                  ))}
                  {evs.length + tks.length > 5 && (
                    <span className="cal__more">+{evs.length + tks.length - 5} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <section className="caldetail">
        <div className="caldetail__col">
          <h2 className="caldetail__head">
            <Icon name="calendar" size={15} />
            {dayjs(selectedDay).format('dddd, MMMM D')}
          </h2>
          {dayEvents.length === 0 ? (
            <p className="caldetail__empty">No calendar events</p>
          ) : dayEvents.map(ev => (
            <div key={ev.uid + ev.start} className="caldetail__ev">
              <div className="caldetail__evtime">
                {ev.allDay ? 'All day' : `${dayjs(ev.start).format('H:mm')}–${dayjs(ev.end).format('H:mm')}`}
              </div>
              <div className="caldetail__evbody">
                <div className="caldetail__evtitle">{ev.title}</div>
                <div className="caldetail__evmeta">
                  <span className="calbadge">{ev.calendar}</span>
                  {ev.location && <span>{ev.location}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="caldetail__col">
          <h2 className="caldetail__head">
            <Icon name="list" size={15} />
            Tasks due this day
          </h2>
          {dayTasks.length === 0 ? (
            <p className="caldetail__empty">No tasks due</p>
          ) : dayTasks.map((t, i) => (
            <TaskItem key={t.id} task={t} collections={collections} onOpen={onOpenTask} onToggle={toggle} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
