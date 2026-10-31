"use client";

import { useAuth } from "@/lib/AuthContext";

export default function AccessDenied({ onReturn, requiredRole = "admin" }) {
  const { user } = useAuth();

  return (
    <div
      className="glass-panel"
      style={{
        maxWidth: "600px",
        margin: "4rem auto",
        padding: "3rem 2rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "rgba(239, 68, 68, 0.15)",
          color: "var(--color-danger)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.5rem",
        }}
      >
        <svg
          style={{ width: "28px", height: "28px" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>

      <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.75rem" }}>
        Elevated Privileges Required
      </h2>

      <p
        style={{
          color: "var(--text-muted)",
          fontSize: "0.925rem",
          lineHeight: 1.6,
          marginBottom: "1.5rem",
        }}
      >
        Your current role is{" "}
        <strong style={{ color: "#67e8f9" }}>{user?.role || "moderator"}</strong>.
        This section requires full{" "}
        <strong style={{ color: "#c4b5fd" }}>{requiredRole}</strong> authorization.
      </p>

      {onReturn && (
        <button
          type="button"
          onClick={onReturn}
          className="btn btn-primary"
        >
          Return to Permitted Operations
        </button>
      )}
    </div>
  );
}
