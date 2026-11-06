"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export default function ContestManager({ showToast, setConfirmDialog }) {
  const [contests, setContests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 15;

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
  const [selectedContest, setSelectedContest] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    status: "upcoming",
    penalty_minutes: 20,
  });

  // Problem Management Sub-Modal State
  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [managingContest, setManagingContest] = useState(null);
  const [contestProblems, setContestProblems] = useState([]);
  const [availableProblems, setAvailableProblems] = useState([]);
  const [probSearch, setProbSearch] = useState("");
  const [selectedProbId, setSelectedProbId] = useState("");
  const [assignPoints, setAssignPoints] = useState(100);

  // Leaderboard / Submissions Sub-Modal State
  const [viewModalType, setViewModalType] = useState(null); // "leaderboard" | "submissions" | "participants"
  const [viewContest, setViewContest] = useState(null);
  const [modalData, setModalData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchContests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("skip", page * limit);
      params.set("limit", limit);
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);

      const res = await api.get(`/api-v1/contests?${params.toString()}`);
      setContests(res?.contests || []);
      setTotal(res?.total || 0);
    } catch (err) {
      showToast?.(err.message || "Failed to retrieve contest list.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, showToast]);

  useEffect(() => {
    fetchContests();
  }, [fetchContests]);

  // Format date helper for datetime-local input
  const toLocalISO = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openCreateModal = () => {
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000); // 1 hr from now
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hrs duration

    setFormData({
      title: "",
      description: "",
      start_time: toLocalISO(start),
      end_time: toLocalISO(end),
      status: "upcoming",
      penalty_minutes: 20,
    });
    setModalMode("create");
    setSelectedContest(null);
    setShowModal(true);
  };

  const openEditModal = (c) => {
    setFormData({
      title: c.title,
      description: c.description || "",
      start_time: toLocalISO(c.start_time),
      end_time: toLocalISO(c.end_time),
      status: c.stored_status || c.status,
      penalty_minutes: c.penalty_minutes,
    });
    setModalMode("edit");
    setSelectedContest(c);
    setShowModal(true);
  };

  const handleSaveContest = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast?.("Contest title is required.", "error");
      return;
    }
    const start = new Date(formData.start_time);
    const end = new Date(formData.end_time);
    if (end <= start) {
      showToast?.("Contest end time must be after start time.", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: formData.status,
        penalty_minutes: parseInt(formData.penalty_minutes, 10) || 20,
      };

      if (modalMode === "create") {
        await api.post("/api-v1/contests", payload);
        showToast?.("Contest created and scheduled successfully!", "success");
      } else {
        await api.patch(`/api-v1/contests/${selectedContest.id}`, payload);
        showToast?.("Contest updated successfully!", "success");
      }
      setShowModal(false);
      fetchContests();
    } catch (err) {
      showToast?.(err.message || "Failed to save contest.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContest = (c) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete Contest: ${c.title}`,
      message: `Are you sure you want to delete this contest? All participant records and contest problem assignments will be permanently removed.`,
      confirmText: "Delete Contest",
      type: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/api-v1/contests/${c.id}`);
          showToast?.(`Contest '${c.title}' has been deleted.`, "success");
          fetchContests();
        } catch (err) {
          showToast?.(err.message || "Failed to delete contest.", "error");
        }
      },
    });
  };

  // Open problem management sub-modal
  const openProblemManager = async (c) => {
    setManagingContest(c);
    setProblemModalOpen(true);
    try {
      const [contestRes, allProbsRes] = await Promise.all([
        api.get(`/api-v1/contests/${c.id}`),
        api.get("/api-v1/problems?limit=100"),
      ]);
      setContestProblems(contestRes?.problems || []);
      setAvailableProblems(allProbsRes?.problems || []);
    } catch (err) {
      showToast?.("Failed to load contest problems", "error");
    }
  };

  const handleAssignProblem = async () => {
    if (!selectedProbId) {
      showToast?.("Please choose a problem to assign.", "warning");
      return;
    }
    try {
      await api.post(`/api-v1/contests/${managingContest.id}/problems`, {
        problem_id: parseInt(selectedProbId, 10),
        points: parseFloat(assignPoints) || 100.0,
      });
      showToast?.("Problem assigned to contest!", "success");
      const res = await api.get(`/api-v1/contests/${managingContest.id}`);
      setContestProblems(res?.problems || []);
      setSelectedProbId("");
      fetchContests();
    } catch (err) {
      showToast?.(err.message || "Failed to assign problem.", "error");
    }
  };

  const handleRemoveProblem = async (probId) => {
    try {
      await api.delete(`/api-v1/contests/${managingContest.id}/problems/${probId}`);
      showToast?.("Problem removed from contest.", "success");
      const res = await api.get(`/api-v1/contests/${managingContest.id}`);
      setContestProblems(res?.problems || []);
      fetchContests();
    } catch (err) {
      showToast?.(err.message || "Failed to remove problem.", "error");
    }
  };

  // Open Leaderboard / Submissions / Participants inspection modal
  const openViewModal = async (c, type) => {
    setViewContest(c);
    setViewModalType(type);
    setModalLoading(true);
    setModalData([]);

    try {
      if (type === "leaderboard") {
        const res = await api.get(`/api-v1/contests/${c.id}/leaderboard?limit=100`);
        setModalData(res);
      } else if (type === "submissions") {
        const res = await api.get(`/api-v1/contests/${c.id}/submissions?limit=100`);
        setModalData(res?.submissions || []);
      } else if (type === "participants") {
        const res = await api.get(`/api-v1/contests/${c.id}/participants?limit=100`);
        setModalData(res || []);
      }
    } catch (err) {
      showToast?.(`Failed to retrieve ${type}.`, "error");
    } finally {
      setModalLoading(false);
    }
  };

  const statusBadgeClass = (st) => {
    switch (st?.toLowerCase()) {
      case "active":
        return "badge-active";
      case "upcoming":
        return "badge-pending";
      case "completed":
        return "badge-suspended";
      case "draft":
        return "badge-moderator";
      case "cancelled":
        return "badge-danger";
      default:
        return "badge";
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="admin-page-content">
      {/* Header Bar */}
      <div className="section-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-main)" }}>
            Contest Management & Tournaments
          </h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
            Create, schedule, configure problem sets, and monitor live leaderboards for coding competitions.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="btn btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <svg style={{ width: "16px", height: "16px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Schedule Contest
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar" style={{ display: "flex", gap: "1rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search by contest title or description..."
          className="form-input"
          style={{ flex: 1, minWidth: "240px", fontSize: "0.85rem" }}
        />

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="form-select"
          style={{ width: "180px", fontSize: "0.85rem" }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="upcoming">Upcoming</option>
          <option value="active">Active Now</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Contests Table */}
      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Loading contest directory...
          </div>
        ) : contests.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            No contests found matching criteria. Click &quot;Schedule Contest&quot; to create one.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Schedule</th>
                <th>Duration & Penalty</th>
                <th>Problems</th>
                <th>Participants</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contests.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{c.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.description || "No description provided."}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${statusBadgeClass(c.status)}`}>
                      {c.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-main)" }}>
                      {new Date(c.start_time).toLocaleDateString()} {new Date(c.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      to {new Date(c.end_time).toLocaleDateString()} {new Date(c.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: "0.8rem" }}>{Math.round(c.duration_seconds / 60)} mins</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>+{c.penalty_minutes}m penalty / wrong</div>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => openProblemManager(c)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                    >
                      {c.problem_count} Problems ⚙
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => openViewModal(c, "participants")}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                    >
                      {c.participant_count} Registered
                    </button>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => openViewModal(c, "leaderboard")}
                        className="btn btn-secondary btn-sm"
                        title="View Leaderboard"
                      >
                        🏆 Board
                      </button>
                      <button
                        type="button"
                        onClick={() => openViewModal(c, "submissions")}
                        className="btn btn-secondary btn-sm"
                        title="View Submissions"
                      >
                        Submissions
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(c)}
                        className="btn btn-secondary btn-sm"
                        title="Edit Settings"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContest(c)}
                        className="btn btn-danger btn-sm"
                        title="Delete Contest"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          <span>Page {page + 1} of {totalPages} ({total} contests)</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="btn btn-secondary btn-sm"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="btn btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* CREATE / EDIT CONTEST MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal-dialog"
            style={{ maxWidth: "580px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">
                {modalMode === "create" ? "Schedule New Contest" : "Edit Contest Settings"}
              </h3>
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

            <form onSubmit={handleSaveContest} className="modal-form">
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className="form-group">
                  <label className="form-label">Contest Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Weekly Algorithm Cup #42"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Tournament Rules</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide details about format, scoring, and rules..."
                    className="form-textarea"
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Start Time (Local) *</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Time (Local) *</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Contest Lifecycle Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="form-select"
                    >
                      <option value="draft">Draft (Hidden from public)</option>
                      <option value="upcoming">Upcoming (Visible, open registration)</option>
                      <option value="active">Active (Live competition)</option>
                      <option value="completed">Completed (Archived leaderboard)</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Wrong Attempt Penalty (Minutes)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.penalty_minutes}
                      onChange={(e) => setFormData({ ...formData, penalty_minutes: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? "Saving..." : modalMode === "create" ? "Schedule Contest" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROBLEM MANAGEMENT SUB-MODAL */}
      {problemModalOpen && managingContest && (
        <div className="modal-overlay" onClick={() => setProblemModalOpen(false)}>
          <div
            className="modal-dialog modal-dialog-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">
                  Manage Problems for: {managingContest.title}
                </h3>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  Assign problems from problem catalog and configure score weights.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setProblemModalOpen(false)}
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

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              {/* Problem Assignment Bar */}
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ fontSize: "0.75rem" }}>Select Problem from Catalog</label>
                  <select
                    value={selectedProbId}
                    onChange={(e) => setSelectedProbId(e.target.value)}
                    className="form-select"
                    style={{ fontSize: "0.85rem" }}
                  >
                    <option value="">-- Choose Problem --</option>
                    {availableProblems
                      .filter((ap) => !contestProblems.some((cp) => cp.problem_id === ap.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.id} - {p.title} ({p.difficulty})
                        </option>
                      ))}
                  </select>
                </div>

                <div style={{ width: "120px" }}>
                  <label className="form-label" style={{ fontSize: "0.75rem" }}>Points</label>
                  <input
                    type="number"
                    min={1}
                    value={assignPoints}
                    onChange={(e) => setAssignPoints(e.target.value)}
                    className="form-input"
                    style={{ fontSize: "0.85rem" }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAssignProblem}
                  className="btn btn-primary"
                  style={{ fontSize: "0.85rem", padding: "0.55rem 1.15rem", whiteSpace: "nowrap" }}
                >
                  + Add to Contest
                </button>
              </div>

              {/* Assigned Problems List */}
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                Assigned Contest Problems ({contestProblems.length})
              </div>

              {contestProblems.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-dim)", padding: "2rem", fontSize: "0.85rem" }}>
                  No problems assigned yet. Select from the dropdown above to add problems.
                </div>
              ) : (
                <table className="data-table" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "50px" }}>Order</th>
                      <th>Problem Title</th>
                      <th>Difficulty</th>
                      <th>Points</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contestProblems.map((cp, idx) => (
                      <tr key={cp.id}>
                        <td style={{ fontWeight: 700, color: "var(--accent-primary)" }}>
                          {String.fromCharCode(65 + idx)}
                        </td>
                        <td style={{ fontWeight: 600 }}>{cp.title}</td>
                        <td>
                          <span className={`badge badge-${cp.difficulty?.toLowerCase()}`}>
                            {cp.difficulty}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{cp.points} pts</td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveProblem(cp.problem_id)}
                            className="btn btn-danger btn-sm"
                            style={{ fontSize: "0.75rem" }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setProblemModalOpen(false)} className="btn btn-secondary">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT DATA MODAL (Leaderboard, Submissions, Participants) */}
      {viewModalType && viewContest && (
        <div className="modal-overlay" onClick={() => setViewModalType(null)}>
          <div
            className="modal-dialog modal-dialog-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ textTransform: "capitalize" }}>
                  Contest {viewModalType}: {viewContest.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewModalType(null)}
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

            <div className="modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              {modalLoading ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                  Loading {viewModalType}...
                </div>
              ) : viewModalType === "leaderboard" ? (
                <div>
                  {modalData?.winner && (
                    <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "0.8rem 1rem", borderRadius: "var(--radius-md)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.8rem" }}>
                      <span style={{ fontSize: "1.5rem" }}>🏆</span>
                      <div>
                        <div style={{ fontSize: "0.8rem", color: "var(--color-warning)", fontWeight: 700 }}>Contest Winner</div>
                        <div style={{ fontWeight: 700, color: "#fff" }}>{modalData.winner.username} ({modalData.winner.score} pts, {modalData.winner.problems_solved} solved)</div>
                      </div>
                    </div>
                  )}

                  {modalData?.leaderboard?.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-dim)" }}>No leaderboard entries yet.</div>
                  ) : (
                    <table className="data-table" style={{ fontSize: "0.8rem" }}>
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Participant</th>
                          <th style={{ textAlign: "right" }}>Total Score</th>
                          <th style={{ textAlign: "center" }}>Solved</th>
                          <th style={{ textAlign: "right" }}>Penalty Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalData?.leaderboard?.map((entry) => (
                          <tr key={entry.user_id}>
                            <td style={{ fontWeight: 700 }}>#{entry.rank}</td>
                            <td style={{ fontWeight: 600 }}>{entry.username}</td>
                            <td style={{ textAlign: "right", fontWeight: 700, color: "var(--accent-primary)" }}>{entry.score}</td>
                            <td style={{ textAlign: "center" }}>{entry.problems_solved}</td>
                            <td style={{ textAlign: "right" }}>{entry.penalty_seconds}s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : viewModalType === "submissions" ? (
                modalData.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-dim)" }}>No submissions recorded for this contest.</div>
                ) : (
                  <table className="data-table" style={{ fontSize: "0.8rem" }}>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Problem</th>
                        <th>Verdict</th>
                        <th>Score</th>
                        <th>Lang</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalData.map((s) => (
                        <tr key={s.id}>
                          <td>{s.username || "Anonymous"}</td>
                          <td>{s.problem_name || `#${s.problem_id}`}</td>
                          <td>
                            <span className={`badge ${s.status === "accepted" ? "badge-active" : "badge-danger"}`}>
                              {s.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{s.score} / {s.max_score}</td>
                          <td style={{ textTransform: "uppercase", fontSize: "0.75rem" }}>{s.language}</td>
                          <td style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{new Date(s.created_at).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : viewModalType === "participants" ? (
                modalData.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-dim)" }}>No registered participants yet.</div>
                ) : (
                  <table className="data-table" style={{ fontSize: "0.8rem" }}>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Name</th>
                        <th>Score</th>
                        <th>Problems Solved</th>
                        <th>Registered Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalData.map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600 }}>{p.username}</td>
                          <td>{p.name || "-"}</td>
                          <td style={{ fontWeight: 700, color: "var(--accent-primary)" }}>{p.score}</td>
                          <td>{p.problems_solved}</td>
                          <td style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{new Date(p.registered_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : null}
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setViewModalType(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

