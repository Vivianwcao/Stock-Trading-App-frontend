import { useState } from "react";

export default function PasswordGate({ authError, loading, onUnlock }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim() || loading) return;
    onUnlock(value);
  };

  return (
    <div className="password-gate">
      <div className="password-gate-box">
        <span className="password-gate-title">Stock Tracker</span>
        <form onSubmit={handleSubmit} className="password-gate-form">
          <input
            className="password-gate-input"
            type="password"
            placeholder="Password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            disabled={loading}
          />
          {authError && (
            <span className="password-gate-error">{authError}</span>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!value.trim() || loading}>
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
