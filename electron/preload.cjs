const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  bootstrap: () => invoke('app:bootstrap'),
  createTask: (task) => invoke('tasks:create', task),
  updateTask: (id, patch) => invoke('tasks:update', id, patch),
  deleteTask: (id) => invoke('tasks:delete', id),
  reorderTasks: (orderedIds) => invoke('tasks:reorder', orderedIds),
  createCollection: (name) => invoke('collections:create', name),
  deleteCollection: (id) => invoke('collections:delete', id),
  createTagSet: (name) => invoke('tags:createSet', name),
  createTag: (setId, value) => invoke('tags:create', setId, value),
  updateTag: (id, value) => invoke('tags:update', id, value),
  deleteTag: (id) => invoke('tags:delete', id),
  setNickname: (name) => invoke('settings:nickname', name),
  setTheme: (theme) => invoke('settings:theme', theme),
  setAvatar: () => invoke('settings:avatar'),
  chooseDataDir: () => invoke('settings:dataDir'),
  fetchCalendar: (start, end, force) => invoke('calendar:fetch', { start, end, force }),
  setCalendarFilter: (names) => invoke('calendar:setFilter', names),
  onStoreReloaded: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('store:reloaded', handler);
    return () => ipcRenderer.removeListener('store:reloaded', handler);
  }
});
