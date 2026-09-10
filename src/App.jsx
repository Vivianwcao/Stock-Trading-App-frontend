import { useState, useEffect, useMemo } from 'react';
import { api } from './api';
import { translations } from './i18n';
import Header from './components/Header';
import AccountTabs from './components/AccountTabs';

export default function App() {
  const [lang, setLang] = useState('en');
  const t = translations[lang];

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    Promise.all([loadAccounts(), loadTransactions()])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    // Trigger sync once on page load — backend enforces 4h cooldown
    triggerSync();
  }, []);

  const loadAccounts = async () => {
    const res = await api.getAccounts();
    if (res.status === 'success') setAccounts(res.data);
  };

  const loadTransactions = async () => {
    const res = await api.getTransactions();
    if (res.status === 'success') setTransactions(res.data);
  };

  const triggerSync = async () => {
    setSyncing(true);
    try {
      const res = await api.syncActivities();
      setSyncStatus(res);
      if (res.status === 'success') {
        // Reload after successful sync
        await loadTransactions();
      }
    } catch (e) {
      setSyncStatus({ status: 'fail', error: e.message });
    } finally {
      setSyncing(false);
    }
  };

  // Group: nickname -> symbol -> rows[] sorted by trade_date ascending
  const grouped = useMemo(() => {
    const g = {};
    for (const row of transactions) {
      const nick = row.nickname;
      const sym = row.symbol;
      if (!nick || !sym) continue;
      if (!g[nick]) g[nick] = {};
      if (!g[nick][sym]) g[nick][sym] = [];
      g[nick][sym].push(row);
    }
    for (const nick of Object.keys(g)) {
      for (const sym of Object.keys(g[nick])) {
        g[nick][sym].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
      }
    }
    return g;
  }, [transactions]);

  // Only open accounts with a nickname
  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.nickname && a.status === 'open'),
    [accounts]
  );

  return (
    <div className="app">
      <Header
        t={t}
        lang={lang}
        setLang={setLang}
        syncStatus={syncStatus}
        syncing={syncing}
        onSync={triggerSync}
      />
      <main className="main">
        {loading ? (
          <div className="status-msg">{t.loading}</div>
        ) : error ? (
          <div className="status-msg error">{error}</div>
        ) : (
          <AccountTabs t={t} accounts={activeAccounts} grouped={grouped} />
        )}
      </main>
    </div>
  );
}
