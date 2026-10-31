"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export default function AuditLogs({ showToast }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Inspect Modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("skip", page * limit);
      params.set("limit", limit);
      if (actionFilter) params.set("action", actionFilter);
      if (roleFilter) params.set("actor_role", roleFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await api.get(`/api-v1/admin/audit-logs?${params.toString()}`);
      setLogs(res?.logs || []);
      setTotal(res?.total || 0);
    } catch (err) {
      showToast?.(err.message || "Failed to load audit trail.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, limit, actionFilter, roleFilter, statusFilter, showToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">System Audit Trail & Security Logs</h1>
          <p className="page-subtitle">
            Immutable tracking of all privileged administrator and moderator operations, role modifications, and system events.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Filter by action name..."
            className="form-input"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(0);
            }}
          />

          <select
            className="form-select"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All Actor Roles</option>
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
            <option value="system">System</option>
          </select>

          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All Statuses</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>

        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Showing <strong>{logs.length}</strong> of <strong>{total}</strong> logged actions
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Log ID</th>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target Resource</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Inspect</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem" }}>
                  <div style={{ color: "var(--text-muted)" }}>Loading audit records...</div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem" }}>
                  <div style={{ color: "var(--text-dim)" }}>
                    No audit records match the selected parameters.
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontFamily: "monospace", color: "var(--text-dim)" }}>
                    #{log.id}
                  </td>
                  <td style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString()
                      : "N/A"}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span
                        className={`badge ${
                          log.actor_role === "admin"
                            ? "badge-admin"
                            : log.actor_role === "moderator"
                            ? "badge-moderator"
                            : "badge-info"
                        }`}
                      >
                        {log.actor_role || "User"}
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                        #{log.actor_id}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: "#f1f5f9" }}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.825rem" }}>
                      {log.target_type} #{log.target_id || "N/A"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        log.status === "success"
                          ? "badge-success"
                          : "badge-danger"
                      }`}
                    >
                      {log.status || "success"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSelectedLog(log);
                        setShowModal(true);
                      }}
                    >
                      Inspect Payload
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="pagination-bar">
          <div>
            Page <strong>{page + 1}</strong> of{" "}
            <strong>{Math.max(1, Math.ceil(total / limit))}</strong>
          </div>
          <div className="pagination-controls">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={(page + 1) * limit >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Inspect Modal */}
      {showModal && selectedLog && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                Audit Event #{selectedLog.id}: {selectedLog.action}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
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
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                }}
              >
                <div
                  style={{
                    background: "rgba(11, 14, 22, 0.6)",
                    padding: "0.85rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div className="form-label" style={{ fontSize: "0.7rem" }}>
                    Actor
                  </div>
                  <div>
                    {selectedLog.actor_role} (User ID #{selectedLog.actor_id})
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(11, 14, 22, 0.6)",
                    padding: "0.85rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div className="form-label" style={{ fontSize: "0.7rem" }}>
                    Target
                  </div>
                  <div>
                    {selectedLog.target_type} #{selectedLog.target_id || "N/A"}
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(11, 14, 22, 0.6)",
                    padding: "0.85rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div className="form-label" style={{ fontSize: "0.7rem" }}>
                    Status & Outcome
                  </div>
                  <div>
                    <span
                      className={`badge ${
                        selectedLog.status === "success"
                          ? "badge-success"
                          : "badge-danger"
                      }`}
                    >
                      {selectedLog.status || "success"}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(11, 14, 22, 0.6)",
                    padding: "0.85rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div className="form-label" style={{ fontSize: "0.7rem" }}>
                    Timestamp
                  </div>
                  <div>
                    {selectedLog.created_at
                      ? new Date(selectedLog.created_at).toLocaleString()
                      : "N/A"}
                  </div>
                </div>
              </div>

              <div>
                <label className="form-label">Event Payload & Metadata</label>
                <pre
                  style={{
                    background: "#080b12",
                    padding: "1.25rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-medium)",
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                    color: "#a5b4fc",
                    overflowX: "auto",
                    maxHeight: "300px",
                  }}
                >
                  {JSON.stringify(
                    selectedLog.details ||
                      selectedLog.payload ||
                      selectedLog.extra || {
                        action: selectedLog.action,
                        actor_id: selectedLog.actor_id,
                        target_id: selectedLog.target_id,
                        status: selectedLog.status,
                      },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
