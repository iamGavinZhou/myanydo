import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }) {
  const [tasks, setTasks] = useState([]);
  const [collections, setCollections] = useState([]);
  const [tags, setTags] = useState({ sets: [], tags: [] });
  const [settings, setSettings] = useState({
    nickname: 'Me', avatarDataUrl: null, dataDir: '', theme: 'system'
  });
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const b = await window.api.bootstrap();
    setTasks(b.tasks || []);
    setCollections(b.collections || []);
    setTags(b.tags || { sets: [], tags: [] });
    setSettings(b.settings || {});
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    const off = window.api.onStoreReloaded(() => refresh());
    return off;
  }, [refresh]);

  /* ---- theme: apply resolved theme to <html data-theme> ---- */
  const theme = settings.theme || 'system';
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    if (theme === 'system') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  /* ---- tasks ---- */
  const createTask = useCallback(async (input) => {
    const task = await window.api.createTask(input);
    setTasks(p => [task, ...p]);
    return task;
  }, []);

  const updateTask = useCallback(async (id, patch) => {
    setTasks(p => p.map(t => (t.id === id ? { ...t, ...patch } : t)));
    await window.api.updateTask(id, patch);
  }, []);

  const deleteTask = useCallback(async (id) => {
    setTasks(p => p.filter(t => t.id !== id));
    await window.api.deleteTask(id);
  }, []);

  const reorderTasks = useCallback(async (orderedIds) => {
    setTasks(p => {
      const rank = new Map(orderedIds.map((id, i) => [id, i]));
      return p.map(t => (rank.has(t.id) ? { ...t, order: rank.get(t.id) } : t));
    });
    await window.api.reorderTasks(orderedIds);
  }, []);

  /* ---- collections ---- */
  const createCollection = useCallback(async (name) => {
    const col = await window.api.createCollection(name);
    if (col) setCollections(p => [...p, col]);
    return col;
  }, []);

  const deleteCollection = useCallback(async (id) => {
    const r = await window.api.deleteCollection(id);
    if (r && r.ok) {
      setTasks(r.bootstrap.tasks || []);
      setCollections(r.bootstrap.collections || []);
    }
    return r;
  }, []);

  /* ---- tag library ---- */
  const createTagSet = useCallback(async (name) => {
    const r = await window.api.createTagSet(name);
    if (r.set) setTags(prev => ({ ...prev, sets: [...prev.sets, r.set] }));
    return r;
  }, []);

  const createTag = useCallback(async (setId, value) => {
    const r = await window.api.createTag(setId, value);
    if (r.def) setTags(prev => ({ ...prev, tags: [...prev.tags, r.def] }));
    return r;
  }, []);

  const updateTag = useCallback(async (id, value) => {
    const r = await window.api.updateTag(id, value);
    if (r.def) {
      const renamedFrom = r.renamedFrom;
      const renamedTo = r.tag;
      setTags(prev => ({ ...prev, tags: prev.tags.map(d => (d.id === id ? r.def : d)) }));
      if (renamedFrom && renamedTo) {
        setTasks(p => p.map(t => ({
          ...t,
          tags: (t.tags || []).map(x => (x === renamedFrom ? renamedTo : x))
        })));
      }
    }
    return r;
  }, []);

  const deleteTag = useCallback(async (id) => {
    const def = tags.tags.find(d => d.id === id);
    const set = tags.sets.find(s => s.id === def?.setId);
    const str = def && set ? `${set.name}:${def.value}` : null;
    const r = await window.api.deleteTag(id);
    if (r.ok) {
      setTags(prev => ({ ...prev, tags: prev.tags.filter(d => d.id !== id) }));
      if (str) {
        setTasks(p => p.map(t => ({ ...t, tags: (t.tags || []).filter(x => x !== str) })));
      }
    }
    return r;
  }, [tags]);

  /* ---- settings ---- */
  const setNickname = useCallback(async (name) => {
    const s = await window.api.setNickname(name);
    setSettings(p => ({ ...p, ...s }));
  }, []);

  const setTheme = useCallback(async (t) => {
    const s = await window.api.setTheme(t);
    setSettings(p => ({ ...p, ...s }));
  }, []);

  const setCalendarFilter = useCallback(async (names) => {
    const s = await window.api.setCalendarFilter(names);
    setSettings(p => ({ ...p, ...s }));
  }, []);

  const setAvatar = useCallback(async () => {
    const r = await window.api.setAvatar();
    if (!r.canceled) setSettings(p => ({ ...p, avatarDataUrl: r.avatarDataUrl }));
  }, []);

  const chooseDataDir = useCallback(async () => {
    const r = await window.api.chooseDataDir();
    if (!r.canceled) {
      setTasks(r.bootstrap.tasks || []);
      setCollections(r.bootstrap.collections || []);
      setTags(r.bootstrap.tags || { sets: [], tags: [] });
      setSettings(r.bootstrap.settings || {});
    }
    return r;
  }, []);

  return (
    <AppCtx.Provider value={{
      ready, tasks, collections, tags, settings,
      refresh, createTask, updateTask, deleteTask, reorderTasks,
      createCollection, deleteCollection,
      createTagSet, createTag, updateTag, deleteTag,
      setNickname, setTheme, setCalendarFilter, setAvatar, chooseDataDir
    }}>
      {children}
    </AppCtx.Provider>
  );
}
