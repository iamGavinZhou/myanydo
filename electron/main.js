import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataStore } from './store.js';
import { fetchCalendarEvents } from './calendar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !!process.env.VITE_DEV_SERVER_URL;

let win = null;
let store = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1380,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#20241F',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.once('ready-to-show', () => win.show());
  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function sendReloaded() {
  if (win && !win.isDestroyed()) win.webContents.send('store:reloaded');
}

function registerIpc() {
  ipcMain.handle('app:bootstrap', () => store.bootstrap());

  ipcMain.handle('tasks:create', (_e, task) => store.createTask(task));
  ipcMain.handle('tasks:update', (_e, id, patch) => store.updateTask(id, patch));
  ipcMain.handle('tasks:delete', (_e, id) => store.deleteTask(id));

  ipcMain.handle('collections:create', (_e, name) => store.createCollection(name));
  ipcMain.handle('collections:delete', (_e, id) => {
    const ok = store.deleteCollection(id);
    return { ok, bootstrap: store.bootstrap() };
  });

  ipcMain.handle('tags:createSet', (_e, name) => store.createTagSet(name));
  ipcMain.handle('tags:create', (_e, setId, value) => store.createTagDef(setId, value));
  ipcMain.handle('tags:update', (_e, id, value) => store.updateTagDef(id, value));
  ipcMain.handle('tags:delete', (_e, id) => store.deleteTagDef(id));

  ipcMain.handle('tasks:reorder', (_e, orderedIds) => store.reorderTasks(orderedIds));

  ipcMain.handle('settings:nickname', (_e, name) => {
    store.setNickname(name);
    return store.publicSettings();
  });

  ipcMain.handle('settings:theme', (_e, theme) => {
    store.setTheme(theme);
    return store.publicSettings();
  });

  ipcMain.handle('settings:avatar', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Choose a profile picture',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile']
    });
    if (r.canceled || !r.filePaths.length) return { canceled: true };
    const dataUrl = store.setAvatar(r.filePaths[0]);
    return { canceled: false, avatarDataUrl: dataUrl };
  });

  ipcMain.handle('settings:dataDir', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Choose a folder for MyAnydo data',
      properties: ['openDirectory', 'createDirectory']
    });
    if (r.canceled || !r.filePaths.length) return { canceled: true };
    const moved = store.migrateTo(r.filePaths[0]);
    const data = store.bootstrap();
    if (moved) sendReloaded();
    return { canceled: false, moved, bootstrap: data };
  });

  ipcMain.handle('calendar:fetch', (_e, args) => {
    const filter = Array.isArray(store.settings.calendarFilter)
      ? store.settings.calendarFilter
      : null;
    return fetchCalendarEvents({ ...(args || {}), filter });
  });
  ipcMain.handle('calendar:setFilter', (_e, names) => {
    store.setCalendarFilter(names);
    return store.publicSettings();
  });
}

app.whenReady().then(() => {
  store = new DataStore(app.getPath('userData'));
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
