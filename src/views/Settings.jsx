import React, { useState } from 'react';
import { useApp } from '../store.jsx';
import Icon from '../components/Icon.jsx';

export default function Settings() {
  const { settings, setNickname, setAvatar, chooseDataDir, setTheme } = useApp();
  const [nick, setNick] = useState(settings.nickname || 'Me');
  const [moved, setMoved] = useState(false);

  const saveNick = () => {
    const n = nick.trim();
    if (n && n !== settings.nickname) setNickname(n);
  };

  const changeDir = async () => {
    const r = await chooseDataDir();
    if (!r.canceled) setMoved(true);
  };

  const theme = settings.theme || 'system';

  return (
    <div className="view view--narrow">
      <header className="view__head">
        <div>
          <h1 className="view__title">Settings</h1>
          <p className="view__sub">Profile, appearance & local data</p>
        </div>
      </header>

      <section className="card">
        <h2 className="card__title"><Icon name="user" size={16} /> Profile</h2>
        <div className="card__row">
          {settings.avatarDataUrl
            ? <img src={settings.avatarDataUrl} alt="Avatar" className="settings-avatar" />
            : <span className="settings-avatar settings-avatar--ph">
                {(settings.nickname || 'Me').slice(0, 1).toUpperCase()}
              </span>}
          <div className="card__col">
            <button className="btn btn--ghost" onClick={setAvatar}>Upload photo…</button>
            <input
              className="settings-nick"
              value={nick}
              placeholder="Nickname"
              onChange={(e) => setNick(e.target.value)}
              onBlur={saveNick}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }}
            />
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card__title"><Icon name="sun2" size={16} /> Appearance</h2>
        <p className="card__desc">Choose how MyAnydo looks.</p>
        <div className="theme-picker">
          {[
            ['light', 'sun2', 'Light'],
            ['dark', 'moon', 'Dark'],
            ['system', 'gear', 'System']
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={`theme-opt${theme === id ? ' is-on' : ''}`}
              onClick={() => setTheme(id)}
            >
              <Icon name={icon} size={20} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="card__title"><Icon name="folder" size={16} /> Data location</h2>
        <p className="card__desc">
          All MyAnydo data is stored on this Mac as plain files — no account, no cloud sync.
        </p>
        <div className="card__row">
          <code className="settings-dir">{settings.dataDir}</code>
          <button className="btn btn--ghost" onClick={changeDir}>Change…</button>
        </div>
        {moved && <p className="card__ok">Data moved to the new location.</p>}
        <p className="card__desc card__desc--sm">
          Files: <code>tasks.json</code>, <code>collections.json</code>, <code>tags.json</code>, <code>settings.json</code>
        </p>
      </section>
    </div>
  );
}
