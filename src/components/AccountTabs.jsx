import { useState } from 'react';
import { fmtBalance } from '../utils/format';
import StockPanel from './StockPanel';

export default function AccountTabs({ t, accounts, grouped }) {
  const [activeNick, setActiveNick] = useState(() => accounts[0]?.nickname || null);

  if (!accounts.length) return <div className="status-msg">{t.noData}</div>;

  const activeAccount = accounts.find((a) => a.nickname === activeNick);
  const symbols = grouped[activeNick] || {};

  return (
    <div className="account-section">
      {/* Account tabs */}
      <div className="account-tabs">
        {accounts.map((acc) => (
          <button
            key={acc.id}
            className={`account-tab ${acc.nickname === activeNick ? 'active' : ''}`}
            onClick={() => setActiveNick(acc.nickname)}
          >
            <span className="tab-nickname">{acc.nickname}</span>
            <span className="tab-type">{acc.account_type.replace('_', ' ').toUpperCase()}</span>
            <span className="tab-balance">{fmtBalance(acc.balance)}</span>
          </button>
        ))}
      </div>

      {/* Account info bar */}
      {activeAccount && (
        <div className="account-info-bar">
          <span>
            {t.wsAccount}:{' '}
            <strong>{activeAccount.wealth_simple_account_id || '—'}</strong>
          </span>
          <span>
            {t.balance}: <strong>{fmtBalance(activeAccount.balance)}</strong>
          </span>
        </div>
      )}

      {/* Stock panel for selected account */}
      <StockPanel
        t={t}
        nickname={activeNick}
        accountId={activeAccount?.id}
        symbols={symbols}
      />
    </div>
  );
}
