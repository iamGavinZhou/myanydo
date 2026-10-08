import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const COLLECTION_COLORS = ['#E4572E', '#7C9A82', '#3E6C8E', '#D9A441', '#A26769', '#6B7A8F', '#B0845A'];

const DEFAULT_TAG_SETS = [
  { id: 'set-priority', name: 'Priority' },
  { id: 'set-type', name: 'Type' },
  { id: 'set-status', name: 'Status' },
  { id: 'set-energy', name: 'Energy' }
];

const DEFAULT_TAG_VALUES = {
  'set-priority': ['high', 'low', 'nice-to-have'],
  'set-type': ['开发', '文档', '测试', '会议'],
  'set-status': ['待确认', '处理中', '阻塞中', '已延期'],
  'set-energy': ['短平快', '深度', '碎片']
};

export class DataStore {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
    this.dataDir = this.resolveDir();
    this.tasks = this.readJson('tasks.json', []);
    const cols = this.readJson('collections.json', null);
    if (cols && Array.isArray(cols) && cols.length > 0) {
      this.collections = cols;
    } else {
      this.collections = [{
        id: 'default',
        name: 'Personal',
        color: COLLECTION_COLORS[0],
        createdAt: new Date().toISOString()
      }];
      this.saveCollections();
    }
    const s = this.readJson('settings.json', null);
    this.settings = s && typeof s === 'object' ? s : {};
    if (!this.settings.nickname) this.settings.nickname = 'Me';
    if (!['light', 'dark', 'system'].includes(this.settings.theme)) this.settings.theme = 'system';
    this.initTagLibrary();
  }

  pointerFile() {
    return path.join(this.userDataPath, 'datapath.json');
  }

  resolveDir() {
    try {
      const raw = fs.readFileSync(this.pointerFile(), 'utf8');
      const p = JSON.parse(raw);
      if (p && p.dataDir && fs.existsSync(p.dataDir)) return p.dataDir;
    } catch { /* fall through to default */ }
    const def = path.join(os.homedir(), 'Documents', 'MyAnydo');
    fs.mkdirSync(def, { recursive: true });
    return def;
  }

  readJson(name, fallback) {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.dataDir, name), 'utf8'));
    } catch {
      return fallback;
    }
  }

  writeJson(name, data) {
    const file = path.join(this.dataDir, name);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  }

  saveTasks() { this.writeJson('tasks.json', this.tasks); }
  saveCollections() { this.writeJson('collections.json', this.collections); }
  saveSettings() { this.writeJson('settings.json', this.settings); }
  saveTags() { this.writeJson('tags.json', { sets: this.tagSets, tags: this.tagDefs }); }

  /* ---------------- task library ---------------- */

  initTagLibrary() {
    const saved = this.readJson('tags.json', null);
    if (saved && Array.isArray(saved.sets) && Array.isArray(saved.tags)) {
      this.tagSets = saved.sets;
      this.tagDefs = saved.tags;
      return;
    }
    this.tagSets = DEFAULT_TAG_SETS.map(s => ({ ...s }));
    this.tagDefs = [];
    for (const set of this.tagSets) {
      for (const value of DEFAULT_TAG_VALUES[set.id] || []) {
        this.tagDefs.push({ id: crypto.randomUUID(), setId: set.id, value });
      }
    }
    this.saveTags();
  }

  tagString(setName, value) {
    return `${setName}:${value}`;
  }

  findSetFor(def) {
    return this.tagSets.find(s => s.id === def.setId);
  }

  createTagSet(name) {
    const clean = String(name || '').trim();
    if (!clean) return { error: 'Name is required' };
    if (this.tagSets.some(s => s.name.toLowerCase() === clean.toLowerCase())) {
      return { error: 'Tag set already exists' };
    }
    const set = { id: crypto.randomUUID(), name: clean };
    this.tagSets.push(set);
    this.saveTags();
    return { set };
  }

  createTagDef(setId, value) {
    const clean = String(value || '').trim();
    const set = this.tagSets.find(s => s.id === setId);
    if (!set) return { error: 'Tag set not found' };
    if (!clean) return { error: 'Value is required' };
    if (this.tagDefs.some(d => d.setId === setId && d.value.toLowerCase() === clean.toLowerCase())) {
      return { error: 'Tag already exists in this set' };
    }
    const def = { id: crypto.randomUUID(), setId, value: clean };
    this.tagDefs.push(def);
    this.saveTags();
    return { def, tag: this.tagString(set.name, clean) };
  }

  /** Rename a tag value globally: library + every task that carries it. */
  updateTagDef(id, value) {
    const clean = String(value || '').trim();
    const def = this.tagDefs.find(d => d.id === id);
    if (!def) return { error: 'Tag not found' };
    if (!clean) return { error: 'Value is required' };
    const set = this.findSetFor(def);
    const oldStr = this.tagString(set.name, def.value);
    const newStr = this.tagString(set.name, clean);
    if (this.tagDefs.some(d => d.id !== id && d.setId === def.setId && d.value.toLowerCase() === clean.toLowerCase())) {
      return { error: 'Tag already exists in this set' };
    }
    def.value = clean;
    let touched = 0;
    for (const t of this.tasks) {
      if (Array.isArray(t.tags) && t.tags.includes(oldStr)) {
        t.tags = t.tags.map(x => (x === oldStr ? newStr : x));
        touched++;
      }
    }
    this.saveTags();
    if (touched > 0) this.saveTasks();
    return { def, tag: newStr, renamedFrom: oldStr, tasksTouched: touched };
  }

  /** Delete a tag globally: library + remove from every task. */
  deleteTagDef(id) {
    const idx = this.tagDefs.findIndex(d => d.id === id);
    if (idx === -1) return { error: 'Tag not found' };
    const def = this.tagDefs[idx];
    const set = this.findSetFor(def);
    const str = this.tagString(set.name, def.value);
    this.tagDefs.splice(idx, 1);
    let touched = 0;
    for (const t of this.tasks) {
      if (Array.isArray(t.tags) && t.tags.includes(str)) {
        t.tags = t.tags.filter(x => x !== str);
        touched++;
      }
    }
    this.saveTags();
    if (touched > 0) this.saveTasks();
    return { ok: true, tasksTouched: touched };
  }

  /* ---------------- tasks ---------------- */

  createTask(input) {
    const now = new Date().toISOString();
    const task = {
      id: crypto.randomUUID(),
      title: String(input.title || '').trim(),
      notes: input.notes || '',
      subtasks: Array.isArray(input.subtasks) ? input.subtasks : [],
      tags: Array.isArray(input.tags) ? input.tags.filter(t => typeof t === 'string') : [],
      dueDate: input.dueDate || null,
      collectionId: input.collectionId || null,
      status: input.status === 'done' ? 'done' : 'todo',
      order: typeof input.order === 'number' ? input.order : null,
      createdAt: now,
      updatedAt: now
    };
    this.tasks.push(task);
    this.saveTasks();
    return task;
  }

  updateTask(id, patch) {
    const idx = this.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const allowed = ['title', 'notes', 'subtasks', 'tags', 'dueDate', 'collectionId', 'status', 'order'];
    const next = { ...this.tasks[idx] };
    for (const k of allowed) {
      if (k in patch) next[k] = patch[k];
    }
    next.updatedAt = new Date().toISOString();
    this.tasks[idx] = next;
    this.saveTasks();
    return next;
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveTasks();
    return true;
  }

  /** Persist a manual ordering: orderedIds[0] appears first. */
  reorderTasks(orderedIds) {
    if (!Array.isArray(orderedIds)) return { error: 'Invalid input' };
    const rank = new Map(orderedIds.map((id, i) => [id, i]));
    for (const t of this.tasks) {
      if (rank.has(t.id)) {
        if (t.order !== rank.get(t.id)) {
          t.order = rank.get(t.id);
        }
      }
    }
    this.saveTasks();
    return { ok: true };
  }

  /* ---------------- collections ---------------- */

  createCollection(name) {
    const clean = String(name || '').trim();
    if (!clean) return null;
    const col = {
      id: crypto.randomUUID(),
      name: clean,
      color: COLLECTION_COLORS[this.collections.length % COLLECTION_COLORS.length],
      createdAt: new Date().toISOString()
    };
    this.collections.push(col);
    this.saveCollections();
    return col;
  }

  deleteCollection(id) {
    if (id === 'default') return false;
    this.collections = this.collections.filter(c => c.id !== id);
    for (const t of this.tasks) {
      if (t.collectionId === id) t.collectionId = null;
    }
    this.saveCollections();
    this.saveTasks();
    return true;
  }

  /* ---------------- settings ---------------- */

  setNickname(n) {
    this.settings.nickname = String(n || '').trim() || 'Me';
    this.saveSettings();
    return this.settings.nickname;
  }

  setTheme(theme) {
    this.settings.theme = ['light', 'dark', 'system'].includes(theme) ? theme : 'system';
    this.saveSettings();
    return this.settings.theme;
  }

  /** Calendar filter: null = sync every calendar; array = only these names. */
  setCalendarFilter(names) {
    if (names === null || names === undefined) {
      this.settings.calendarFilter = null;
    } else if (Array.isArray(names)) {
      this.settings.calendarFilter = names.filter(n => typeof n === 'string');
    }
    this.saveSettings();
    return this.settings.calendarFilter;
  }

  setAvatar(srcPath) {
    const ext = path.extname(srcPath).toLowerCase() || '.png';
    const target = path.join(this.dataDir, 'avatar' + (/\.(png|jpg|jpeg|gif|webp)$/i.test(ext) ? ext : '.png'));
    fs.copyFileSync(srcPath, target);
    this.settings.avatarFile = path.basename(target);
    this.saveSettings();
    return this.avatarDataUrl();
  }

  avatarDataUrl() {
    if (!this.settings.avatarFile) return null;
    try {
      const file = path.join(this.dataDir, this.settings.avatarFile);
      const buf = fs.readFileSync(file);
      const ext = path.extname(file).toLowerCase();
      const mime = ext === '.png' ? 'image/png'
        : ext === '.gif' ? 'image/gif'
        : ext === '.webp' ? 'image/webp'
        : 'image/jpeg';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  }

  /** Move all data files to a new directory and point the app at it. */
  migrateTo(newDir) {
    if (!newDir || newDir === this.dataDir) return false;
    fs.mkdirSync(newDir, { recursive: true });
    const filesToMove = ['tasks.json', 'collections.json', 'settings.json', 'tags.json'];
    const avatar = this.settings.avatarFile;
    if (avatar) filesToMove.push(avatar);
    for (const name of filesToMove) {
      const src = path.join(this.dataDir, name);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(newDir, name));
      }
    }
    fs.writeFileSync(this.pointerFile(), JSON.stringify({ dataDir: newDir }, null, 2));
    this.dataDir = newDir;
    this.tasks = this.readJson('tasks.json', []);
    this.collections = this.readJson('collections.json', null) || this.collections;
    this.settings = this.readJson('settings.json', null) || this.settings;
    this.initTagLibrary();
    return true;
  }

  publicSettings() {
    return {
      nickname: this.settings.nickname,
      theme: this.settings.theme,
      calendarFilter: Array.isArray(this.settings.calendarFilter) ? this.settings.calendarFilter : null,
      dataDir: this.dataDir,
      avatarDataUrl: this.avatarDataUrl()
    };
  }

  bootstrap() {
    return {
      tasks: this.tasks,
      collections: this.collections,
      tags: { sets: this.tagSets, tags: this.tagDefs },
      settings: this.publicSettings()
    };
  }
}
