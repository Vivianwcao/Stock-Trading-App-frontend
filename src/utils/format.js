export const fmtCAD = (n) => {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

// avg_bought_price is stored as negative in DB — always show absolute value
export const fmtPrice = (n, decimals = 4) => {
  if (n == null) return '—';
  return `$${Math.abs(n).toFixed(decimals)}`;
};

// units are negative for SELL — show absolute value; type label handles direction
export const fmtUnits = (n) => {
  if (n == null) return '—';
  return Math.abs(n).toLocaleString('en-CA', { maximumFractionDigits: 4 });
};

export const fmtPct = (n) => {
  if (n == null) return '—';
  return `${Number(n).toFixed(2)}%`;
};

export const fmtDate = (s) => {
  if (!s) return '—';
  return s.slice(0, 10); // YYYY-MM-DD
};

export const fmtBalance = (n) => {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
};
