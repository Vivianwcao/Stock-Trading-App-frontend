export const fmtCAD = (n) => {
  if (n == null) return "-";
  const s = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(n);
  // thin space (U+2009) between $ and digits for legibility
  return s.replace(/\$(?=[\d\-])/, "$ ");
};

export const fmtPrice = (n, decimals = 4) => {
  if (n == null) return "-";
  return `$ ${Number(n).toFixed(decimals)}`;
};

export const fmtUnits = (n) => {
  if (n == null) return "-";
  return Number(n).toLocaleString("en-CA", {
    maximumFractionDigits: 4,
    useGrouping: false,
  });
};

export const fmtPct = (n) => {
  if (n == null) return "-";
  return `${Number(n).toFixed(2)}%`;
};

export const fmtDate = (s) => {
  if (!s) return "-";
  return s.slice(0, 10); // YYYY-MM-DD
};

// Format an ISO timestamp in America/Vancouver timezone, appending " PT"
export const fmtVancouver = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "-";
  return (
    d.toLocaleString("en-CA", {
      timeZone: "America/Vancouver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " PT"
  );
};

export const fmtBalance = (n) => {
  if (n == null) return "-";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: false,
  }).format(n);
};
