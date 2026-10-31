"use client";

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  return (
    <div className="toast-container">
      <div className={`toast toast-${toast.type || "info"}`}>
        {toast.type === "success" && (
          <svg
            style={{ width: "20px", height: "20px", color: "var(--color-success)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
        {toast.type === "error" && (
          <svg
            style={{ width: "20px", height: "20px", color: "var(--color-danger)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
        {toast.type === "info" && (
          <svg
            style={{ width: "20px", height: "20px", color: "var(--color-info)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
        <div style={{ flex: 1 }}>{toast.message}</div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              cursor: "pointer",
              padding: "2px",
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
