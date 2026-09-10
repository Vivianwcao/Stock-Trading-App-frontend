export default function Header({ t, lang, setLang, syncStatus, syncing, onSync }) {
  const renderSyncMsg = () => {
    if (syncing) return <span className="sync-msg syncing">{t.syncing}</span>;
    if (!syncStatus) return null;
    if (syncStatus.status === 'success')
      return <span className="sync-msg ok">{t.syncSuccess}</span>;
    if (syncStatus.status === 'cooldown') {
      const { hours: h = 0, minutes: m = 0, seconds: s = 0 } = syncStatus.data || {};
      return <span className="sync-msg cooldown">{t.syncCooldown(h, m, s)}</span>;
    }
    if (syncStatus.status === 'fail')
      return <span className="sync-msg fail">{syncStatus.error}</span>;
    return null;
  };

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="app-title">{t.title}</h1>
        <div className="sync-area">
          <button className="btn btn-primary" onClick={onSync} disabled={syncing}>
            {syncing ? t.syncing : t.syncActivities}
          </button>
          {renderSyncMsg()}
        </div>
      </div>
      <div className="header-right">
        <button
          className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
          onClick={() => setLang('en')}
        >
          EN
        </button>
        <span className="lang-sep">|</span>
        <button
          className={`lang-btn ${lang === 'zh' ? 'active' : ''}`}
          onClick={() => setLang('zh')}
        >
          中文
        </button>
      </div>
    </header>
  );
}
