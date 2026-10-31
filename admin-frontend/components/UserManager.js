"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export default function UserManager({ showToast, setConfirmDialog }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 15;

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Detail Drilldown Modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
    status: "active",
    is_email_verified: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("skip", page * limit);
      params.set("limit", limit);
      if (search.trim()) params.set("search", search.trim());
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await api.get(`/api-v1/admin/users?${params.toString()}`);
      setUsers(res?.users || []);
      setTotal(res?.total || 0);
    } catch (err) {
      showToast?.(err.message || "Failed to load user directory.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, roleFilter, statusFilter, showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openUserDetail = async (user) => {
    setShowDetailModal(true);
    setDetailLoading(true);
    setSelectedUser(user);
    try {
      const detail = await api.get(`/api-v1/admin/users/${user.id}`);
      setSelectedUser(detail);
    } catch (err) {
      showToast?.(err.message || "Failed to fetch detailed profile.", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      username: user.username || "",
      email: user.email || "",
      password: "",
      role: user.role || "user",
      status: user.status || "active",
      is_email_verified: !!user.is_email_verified,
    });
    setShowEditModal(true);
  };

  const handleSaveUserEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      const payload = {
        username: editForm.username,
        email: editForm.email,
        role: editForm.role,
        status: editForm.status,
        is_email_verified: editForm.is_email_verified,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      await api.patch(`/api-v1/admin/users/${editingUser.id}`, payload);
      showToast?.(`User '${editForm.username}' updated successfully.`, "success");
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      showToast?.(err.message || "Failed to update user profile.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/api-v1/admin/users/${userId}/role`, { role: newRole });
      showToast?.(`Role updated to ${newRole}.`, "success");
      fetchUsers();
    } catch (err) {
      showToast?.(err.message || "Failed to elevate/change role.", "error");
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      await api.patch(`/api-v1/admin/users/${userId}/status`, {
        status: newStatus,
      });
      showToast?.(`Status changed to ${newStatus}.`, "success");
      fetchUsers();
    } catch (err) {
      showToast?.(err.message || "Failed to update status.", "error");
    }
  };

  const handleDeleteUser = (user) => {
    if (user.is_protected) {
      showToast?.("Protected user accounts cannot be deleted.", "error");
      return;
    }

    setConfirmDialog?.({
      isOpen: true,
      title: "Delete User Account",
      message: `Permanently delete account '${user.username}' (ID #${user.id})? This will purge all associated profile and submission records.`,
      confirmText: "Delete Account",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/api-v1/admin/users/${user.id}`);
          showToast?.(`User '${user.username}' purged from database.`, "success");
          fetchUsers();
        } catch (err) {
          showToast?.(err.message || "Failed to delete user account.", "error");
        }
      },
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">User Governance & Access Control</h1>
          <p className="page-subtitle">
            Administer accounts, role privileges, account suspension, and audit histories across the platform.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <div className="search-input-wrap">
            <svg
              className="search-icon-svg"
              style={{ width: "16px", height: "16px" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by username, email, name..."
              className="form-input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>

          <select
            className="form-select"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="moderator">Moderator</option>
            <option value="user">Standard User</option>
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
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>

        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Showing <strong>{users.length}</strong> of <strong>{total}</strong> users
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Account Status</th>
              <th>Created</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem" }}>
                  <div style={{ color: "var(--text-muted)" }}>Loading user records...</div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem" }}>
                  <div style={{ color: "var(--text-dim)" }}>
                    No users found matching query.
                  </div>
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700, color: "var(--text-dim)" }}>
                    #{u.id}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <div
                        className="user-avatar-circle"
                        style={{
                          width: "28px",
                          height: "28px",
                          fontSize: "0.8rem",
                          background:
                            u.role === "admin"
                              ? "var(--color-admin-bg)"
                              : u.role === "moderator"
                              ? "var(--color-moderator-bg)"
                              : "rgba(255,255,255,0.08)",
                          color:
                            u.role === "admin"
                              ? "#c4b5fd"
                              : u.role === "moderator"
                              ? "#67e8f9"
                              : "#e2e8f0",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {(u.username || "U")[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#f8fafc" }}>
                          {u.username}
                          {u.is_protected && (
                            <span
                              style={{
                                marginLeft: "0.4rem",
                                fontSize: "0.7rem",
                                color: "#f59e0b",
                              }}
                              title="Protected System Account"
                            >
                              🛡️
                            </span>
                          )}
                        </div>
                        {u.name && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                            {u.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      {u.email}
                      {u.is_email_verified && (
                        <span
                          style={{
                            marginLeft: "0.35rem",
                            color: "var(--color-success)",
                            fontSize: "0.75rem",
                          }}
                          title="Email Verified"
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.775rem" }}
                      value={u.role}
                      disabled={u.is_protected}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.775rem" }}
                      value={u.status}
                      disabled={u.is_protected}
                      onChange={(e) => handleStatusChange(u.id, e.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="unverified">Unverified</option>
                    </select>
                  </td>
                  <td>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        gap: "0.4rem",
                        alignItems: "center",
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openUserDetail(u)}
                        title="View profile drilldown & submissions"
                      >
                        Inspect
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(u)}
                        title="Edit credentials & flags"
                      >
                        Edit
                      </button>
                      {!u.is_protected && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteUser(u)}
                          title="Purge user account"
                        >
                          Delete
                        </button>
                      )}
                    </div>
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

      {/* User Detail Drilldown Modal */}
      {showDetailModal && selectedUser && (
        <div
          className="modal-overlay"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <h2 className="modal-title">
                  User Profile: {selectedUser.username}
                </h2>
                <span
                  className={`badge ${
                    selectedUser.role === "admin"
                      ? "badge-admin"
                      : selectedUser.role === "moderator"
                      ? "badge-moderator"
                      : "badge-info"
                  }`}
                >
                  {selectedUser.role}
                </span>
                <span
                  className={`badge ${
                    selectedUser.status === "active"
                      ? "badge-success"
                      : "badge-danger"
                  }`}
                >
                  {selectedUser.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
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
              {detailLoading ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                  Loading profile telemetry...
                </div>
              ) : (
                <div>
                  {/* Account Metadata Cards */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "1rem",
                      marginBottom: "1.75rem",
                    }}
                  >
                    <div
                      style={{
                        background: "rgba(11, 14, 22, 0.6)",
                        padding: "1rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div className="form-label" style={{ fontSize: "0.7rem" }}>
                        Email Address
                      </div>
                      <div style={{ fontWeight: 600 }}>{selectedUser.email}</div>
                    </div>
                    <div
                      style={{
                        background: "rgba(11, 14, 22, 0.6)",
                        padding: "1rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div className="form-label" style={{ fontSize: "0.7rem" }}>
                        Registered On
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {selectedUser.created_at
                          ? new Date(selectedUser.created_at).toLocaleString()
                          : "N/A"}
                      </div>
                    </div>
                    <div
                      style={{
                        background: "rgba(11, 14, 22, 0.6)",
                        padding: "1rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div className="form-label" style={{ fontSize: "0.7rem" }}>
                        Protected Status
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {selectedUser.is_protected ? "Protected System Entity" : "Standard Account"}
                      </div>
                    </div>
                  </div>

                  {/* Recent Submissions */}
                  <div style={{ marginBottom: "2rem" }}>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                      Recent Executions & Submissions
                    </h3>
                    {selectedUser.recent_submissions?.length > 0 ? (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Submission ID</th>
                            <th>Status / Verdict</th>
                            <th>Score</th>
                            <th>Submitted At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedUser.recent_submissions.map((s, i) => (
                            <tr key={i}>
                              <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                                {s.id || s.submission_id || "N/A"}
                              </td>
                              <td>
                                <span
                                  className={`badge ${
                                    s.status === "completed" || s.status === "accepted"
                                      ? "badge-success"
                                      : "badge-danger"
                                  }`}
                                >
                                  {s.status}
                                </span>
                              </td>
                              <td>{s.score ?? 0}</td>
                              <td style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                                {s.created_at
                                  ? new Date(s.created_at).toLocaleString()
                                  : "N/A"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div
                        style={{
                          color: "var(--text-dim)",
                          fontSize: "0.85rem",
                          fontStyle: "italic",
                          padding: "1rem",
                          background: "rgba(11,14,22,0.4)",
                          borderRadius: "var(--radius-md)",
                        }}
                      >
                        No historical submissions found for this user.
                      </div>
                    )}
                  </div>

                  {/* Recent Audit Actions */}
                  <div>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.75rem" }}>
                      Recent Audit Events
                    </h3>
                    {selectedUser.recent_audit_actions?.length > 0 ? (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Action</th>
                            <th>Target</th>
                            <th>Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedUser.recent_audit_actions.map((act, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 600 }}>{act.action}</td>
                              <td>{act.target_type} #{act.target_id}</td>
                              <td style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                                {act.created_at
                                  ? new Date(act.created_at).toLocaleString()
                                  : "N/A"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div
                        style={{
                          color: "var(--text-dim)",
                          fontSize: "0.85rem",
                          fontStyle: "italic",
                          padding: "1rem",
                          background: "rgba(11,14,22,0.4)",
                          borderRadius: "var(--radius-md)",
                        }}
                      >
                        No audit events recorded for this account.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div
            className="modal-dialog modal-dialog-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSaveUserEdit} className="modal-form">
              <div className="modal-header">
                <h2 className="modal-title">
                  Edit User: {editingUser.username}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
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
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    style={{ width: "100%" }}
                    value={editForm.username}
                    onChange={(e) =>
                      setEditForm({ ...editForm, username: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    style={{ width: "100%" }}
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Reset Password (leave empty to keep unchanged)
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    style={{ width: "100%" }}
                    placeholder="New password..."
                    value={editForm.password}
                    onChange={(e) =>
                      setEditForm({ ...editForm, password: e.target.value })
                    }
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select
                      className="form-select"
                      style={{ width: "100%" }}
                      value={editForm.role}
                      disabled={editingUser.is_protected}
                      onChange={(e) =>
                        setEditForm({ ...editForm, role: e.target.value })
                      }
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Account Status</label>
                    <select
                      className="form-select"
                      style={{ width: "100%" }}
                      value={editForm.status}
                      disabled={editingUser.is_protected}
                      onChange={(e) =>
                        setEditForm({ ...editForm, status: e.target.value })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="unverified">Unverified</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: "1rem" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editForm.is_email_verified}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          is_email_verified: e.target.checked,
                        })
                      }
                    />
                    <span>Mark Email as Verified</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn btn-primary"
                >
                  {savingEdit ? "Saving..." : "Commit Updates"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
