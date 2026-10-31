"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export default function DashboardStats({ showToast }) {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [problemStats, setProblemStats] = useState(null);
  const [subStats, setSubStats] = useState(null);
  const [activityStats, setActivityStats] = useState(null);

  const fetchAllStats = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, uStats, pStats, sStats, aStats] = await Promise.all([
        api.get(`/api-v1/admin/stats?days=${days}`).catch(() => null),
        api.get(`/api-v1/admin/stats/users?days=${days}`).catch(() => null),
        api.get("/api-v1/admin/stats/problems").catch(() => null),
        api.get(`/api-v1/admin/stats/submissions?days=${days}`).catch(() => null),
        api.get("/api-v1/admin/stats/activity").catch(() => null),
      ]);

      setStats(statsRes);
      setUserStats(uStats);
      setProblemStats(pStats);
      setSubStats(sStats);
      setActivityStats(aStats);
    } catch (err) {
      showToast?.(err.message || "Failed to load platform statistics.", "error");
    } finally {
      setLoading(false);
    }
  }, [days, showToast]);

  useEffect(() => {
    fetchAllStats();
  }, [fetchAllStats]);

  // Derived values
  const totalUsers = userStats?.total_users ?? stats?.users?.total ?? 0;
  const totalProblems = problemStats?.total_problems ?? stats?.problems?.total ?? 0;
  const totalSubmissions = subStats?.total_submissions ?? stats?.submissions?.total ?? 0;
  const successRate = subStats?.success_rate ?? stats?.submissions?.success_rate ?? 0;

  return (
    <div>
      {/* Header Bar with Time Range Filters */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Telemetry & Performance</h1>
          <p className="page-subtitle">
            Real-time infrastructure health, user demographics, problem metrics, and execution activity.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--bg-card)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-medium)",
              padding: "0.25rem",
            }}
          >
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                style={{
                  padding: "0.35rem 0.85rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  transition: "all var(--transition-fast)",
                  background: days === d ? "var(--accent-primary)" : "transparent",
                  color: days === d ? "#ffffff" : "var(--text-muted)",
                }}
              >
                {d} Days
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchAllStats}
            disabled={loading}
          >
            <svg
              style={{
                width: "14px",
                height: "14px",
                animation: loading ? "spin 1s linear infinite" : "none",
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="stats-grid">
        {/* Total Users */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Registered Accounts</span>
            <div
              className="stat-icon"
              style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
          </div>
          <div className="stat-value">{totalUsers.toLocaleString()}</div>
          <div className="stat-subtext">
            {userStats?.new_registrations_in_period ?? 0} new in last {days} days
          </div>
        </div>

        {/* Total Problems */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Problem Catalog</span>
            <div
              className="stat-icon"
              style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
          <div className="stat-value">{totalProblems.toLocaleString()}</div>
          <div className="stat-subtext">
            {problemStats?.by_status?.published ?? 0} published & active
          </div>
        </div>

        {/* Total Submissions */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Submissions Executed</span>
            <div
              className="stat-icon"
              style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}
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
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </div>
          <div className="stat-value">{totalSubmissions.toLocaleString()}</div>
          <div className="stat-subtext">
            {subStats?.accepted ?? 0} accepted solutions
          </div>
        </div>

        {/* Success Rate */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">System Acceptance Rate</span>
            <div
              className="stat-icon"
              style={{ background: "rgba(139, 92, 246, 0.15)", color: "#a78bfa" }}
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <div className="stat-value">{Number(successRate).toFixed(1)}%</div>
          <div className="stat-subtext">Across all execution targets</div>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {/* Submissions Breakdown */}
        <div className="glass-panel" style={{ padding: "1.75rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.25rem" }}>
            Execution Verdict Distribution ({days}d)
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              {
                label: "Accepted (AC)",
                count: subStats?.accepted ?? 0,
                color: "var(--color-success)",
              },
              {
                label: "Wrong Answer (WA)",
                count: subStats?.rejected ?? 0,
                color: "var(--color-danger)",
              },
              {
                label: "Time Limit Exceeded (TLE)",
                count: subStats?.time_limit_exceeded ?? 0,
                color: "var(--color-warning)",
              },
              {
                label: "Compilation Errors",
                count: subStats?.compilation_errors ?? 0,
                color: "#f472b6",
              },
              {
                label: "Runtime Errors",
                count: subStats?.runtime_errors ?? 0,
                color: "#fb923c",
              },
            ].map((item) => {
              const total = totalSubmissions || 1;
              const pct = Math.min(100, Math.round((item.count / total) * 100));
              return (
                <div key={item.label}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.85rem",
                      marginBottom: "0.35rem",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>{item.label}</span>
                    <span style={{ fontWeight: 600 }}>
                      {item.count.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: "6px",
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: "var(--radius-full)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: item.color,
                        borderRadius: "var(--radius-full)",
                        transition: "width 0.4s ease-out",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Problem Distribution */}
        <div className="glass-panel" style={{ padding: "1.75rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.25rem" }}>
            Problem Demographics by Difficulty
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "1rem",
              marginBottom: "1.75rem",
            }}
          >
            {[
              {
                diff: "Easy",
                count: problemStats?.by_difficulty?.easy ?? 0,
                badge: "badge-easy",
                color: "#34d399",
              },
              {
                diff: "Medium",
                count: problemStats?.by_difficulty?.medium ?? 0,
                badge: "badge-medium",
                color: "#fbbf24",
              },
              {
                diff: "Hard",
                count: problemStats?.by_difficulty?.hard ?? 0,
                badge: "badge-hard",
                color: "#f87171",
              },
            ].map((d) => (
              <div
                key={d.diff}
                style={{
                  background: "rgba(11, 14, 22, 0.6)",
                  padding: "1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  textAlign: "center",
                }}
              >
                <span className={`badge ${d.badge}`}>{d.diff}</span>
                <div
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: 700,
                    color: d.color,
                    marginTop: "0.5rem",
                  }}
                >
                  {d.count}
                </div>
              </div>
            ))}
          </div>

          <h3
            style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-dim)",
              marginBottom: "0.75rem",
            }}
          >
            Lifecycle Status
          </h3>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <span className="badge badge-published">
              Published: {problemStats?.by_status?.published ?? 0}
            </span>
            <span className="badge badge-draft">
              Draft: {problemStats?.by_status?.draft ?? 0}
            </span>
            <span className="badge badge-archived">
              Archived: {problemStats?.by_status?.archived ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* User Governance Overview & Recent Activity */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {/* Users Breakdown */}
        <div className="glass-panel" style={{ padding: "1.75rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.25rem" }}>
            User Roles & Status Overview
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            <div
              style={{
                background: "rgba(11, 14, 22, 0.5)",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  marginBottom: "0.5rem",
                }}
              >
                Roles
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="badge badge-admin">Admin</span>
                  <strong>{userStats?.by_role?.admin ?? 0}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="badge badge-moderator">Moderator</span>
                  <strong>{userStats?.by_role?.moderator ?? 0}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="badge badge-info">Standard User</span>
                  <strong>{userStats?.by_role?.user ?? 0}</strong>
                </div>
              </div>
            </div>

            <div
              style={{
                background: "rgba(11, 14, 22, 0.5)",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  marginBottom: "0.5rem",
                }}
              >
                Account Health
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="badge badge-active">Active</span>
                  <strong>{userStats?.by_status?.active ?? 0}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="badge badge-unverified">Unverified</span>
                  <strong>{userStats?.by_status?.unverified ?? 0}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="badge badge-suspended">Suspended</span>
                  <strong>{userStats?.by_status?.suspended ?? 0}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Admin & Moderator Activity */}
        <div className="glass-panel" style={{ padding: "1.75rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.25rem" }}>
            Recent Administrative Actions
          </h2>

          <div
            style={{
              maxHeight: "260px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {activityStats?.recent_admin_actions?.length > 0 ? (
              activityStats.recent_admin_actions.map((act, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(11, 14, 22, 0.5)",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "0.825rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: "#cbd5e1" }}>
                      {act.action || "Audit Event"}
                    </span>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                      Target: {act.target_type || "System"} #{act.target_id || "N/A"}
                    </div>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    {act.created_at ? new Date(act.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
              ))
            ) : (
              <div
                style={{
                  color: "var(--text-dim)",
                  fontSize: "0.875rem",
                  fontStyle: "italic",
                  padding: "1rem",
                  textAlign: "center",
                }}
              >
                No recent administrative events logged.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
