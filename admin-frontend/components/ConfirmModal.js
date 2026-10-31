"use client";

export default function ConfirmModal({ dialog, onClose }) {
  if (!dialog || !dialog.isOpen) return null;

  const isDanger = dialog.type === "danger";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog modal-dialog-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                background: isDanger
                  ? "var(--color-danger-bg)"
                  : "var(--color-warning-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isDanger ? "var(--color-danger)" : "var(--color-warning)",
              }}
            >
              <svg
                style={{ width: "20px", height: "20px" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="modal-title" style={{ fontSize: "1.1rem" }}>
              {dialog.title || "Confirm Action"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              cursor: "pointer",
              fontSize: "1.2rem",
            }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.9rem",
              lineHeight: 1.6,
            }}
          >
            {dialog.message}
          </p>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            {dialog.cancelText || "Cancel"}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${isDanger ? "btn-danger" : "btn-primary"}`}
            onClick={() => {
              dialog.onConfirm?.();
              onClose();
            }}
          >
            {dialog.confirmText || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
