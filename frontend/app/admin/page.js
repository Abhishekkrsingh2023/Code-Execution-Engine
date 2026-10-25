"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import AccessDenied from "@/components/AccessDenied";
import ConfirmModal from "@/components/ConfirmModal";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState("stats"); // "stats" | "users" | "audit" | "problems"

  // Notification Toast
  const [toast, setToast] = useState(null); // { type: "success" | "error", message: string }

  // Confirmation & Alert Modal State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    type: "warning",
    isAlert: false,
    onConfirm: () => {},
  });

  const showToast = (message, type = "success") => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 1: Platform Telemetry & Stats State
  // ───────────────────────────────────────────────────────────────────────────
  const [statsDays, setStatsDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [activityStats, setActivityStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 2: Users Management State (Admin only)
  // ───────────────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(0);
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // User Detail / Drilldown Modal
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  // Edit User Form in Modal
  const [userEditData, setUserEditData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  });
  const [userEditSaving, setUserEditSaving] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 3: Audit Logs State
  // ───────────────────────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditRoleFilter, setAuditRoleFilter] = useState("");
  const [auditStatusFilter, setAuditStatusFilter] = useState("");

  // Audit Detail Modal
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 4: Problems State
  // ───────────────────────────────────────────────────────────────────────────
  const [problems, setProblems] = useState([]);
  const [problemsLoading, setProblemsLoading] = useState(false);
  const [problemsTotal, setProblemsTotal] = useState(0);
  const [problemsPage, setProblemsPage] = useState(0);
  const [problemSearch, setProblemSearch] = useState("");
  const [problemDiffFilter, setProblemDiffFilter] = useState("");
  const [problemStatusFilter, setProblemStatusFilter] = useState("");

  // Quick Problem Create / Edit Modal
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [editingProblem, setEditingProblem] = useState(null);
  const [problemForm, setProblemForm] = useState({
    title: "",
    description: "",
    difficulty: "easy",
    category: "Algorithms",
    topic: "array",
    time_limit: 2.0,
    memory_limit: 256,
    status: "published",
    run_test_cases: [{ input: "", expected_output: "" }],
    submit_test_cases: [{ input: "", expected_output: "" }],
    python_template: "def solve():\n    pass\n",
    cpp_template: "#include <iostream>\nusing namespace std;\nint main() {\n    return 0;\n}\n",
  });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // ───────────────────────────────────────────────────────────────────────────
  // Fetch Functions
  // ───────────────────────────────────────────────────────────────────────────

  // Fetch Telemetry & Activity Stats
  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;
    setStatsLoading(true);
    try {
      const [statsRes, activityRes] = await Promise.all([
        api.get(`/api-v1/admin/stats?days=${statsDays}`),
        api.get("/api-v1/admin/stats/activity"),
      ]);
      setStats(statsRes);
      setActivityStats(activityRes);
    } catch (err) {
      showToast(err.message || "Failed to load telemetry data.", "error");
    } finally {
      setStatsLoading(false);
    }
  }, [isAdmin, statsDays]);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("skip", usersPage * 15);
      params.set("limit", 15);
      if (userRoleFilter) params.set("role", userRoleFilter);
      if (userStatusFilter) params.set("status", userStatusFilter);
      if (userSearch.trim()) params.set("search", userSearch.trim());

      const res = await api.get(`/api-v1/admin/users?${params.toString()}`);
      setUsers(res?.users || []);
      setUsersTotal(res?.total || 0);
    } catch (err) {
      showToast(err.message || "Failed to load users.", "error");
    } finally {
      setUsersLoading(false);
    }
  }, [isAdmin, usersPage, userRoleFilter, userStatusFilter, userSearch]);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    if (!isAdmin) return;
    setAuditLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("skip", auditPage * 20);
      params.set("limit", 20);
      if (auditActionFilter) params.set("action", auditActionFilter);
      if (auditRoleFilter) params.set("actor_role", auditRoleFilter);
      if (auditStatusFilter) params.set("status", auditStatusFilter);

      const res = await api.get(`/api-v1/admin/audit-logs?${params.toString()}`);
      setAuditLogs(res?.logs || []);
      setAuditTotal(res?.total || 0);
    } catch (err) {
      showToast(err.message || "Failed to load audit logs.", "error");
    } finally {
      setAuditLoading(false);
    }
  }, [isAdmin, auditPage, auditActionFilter, auditRoleFilter, auditStatusFilter]);

  // Fetch Problems
  const fetchProblems = useCallback(async () => {
    setProblemsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("skip", problemsPage * 15);
      params.set("limit", 15);
      if (problemDiffFilter) params.set("difficulty", problemDiffFilter);
      if (problemStatusFilter) params.set("status", problemStatusFilter);
      if (problemSearch.trim()) params.set("search", problemSearch.trim());

      const res = await api.get(`/api-v1/problems?${params.toString()}`);
      setProblems(res?.problems || []);
      setProblemsTotal(res?.total || 0);
    } catch (err) {
      showToast(err.message || "Failed to load problems.", "error");
    } finally {
      setProblemsLoading(false);
    }
  }, [problemsPage, problemDiffFilter, problemStatusFilter, problemSearch]);

  // Auto-fetch active tab
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!authLoading && isAdmin) {
        if (activeTab === "stats") fetchStats();
        if (activeTab === "users") fetchUsers();
        if (activeTab === "audit") fetchAuditLogs();
        if (activeTab === "problems") fetchProblems();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTab, isAdmin, authLoading, fetchStats, fetchUsers, fetchAuditLogs, fetchProblems]);

  // ───────────────────────────────────────────────────────────────────────────
  // User Actions: Role, Status, Details, Edit, Delete
  // ───────────────────────────────────────────────────────────────────────────
  const handleChangeUserRole = (targetUser, newRole) => {
    if (targetUser.id === user?.id) {
      setConfirmDialog({
        isOpen: true,
        title: "Action Prohibited",
        message: "Self-demotion prohibited: Administrators cannot modify their own role.",
        confirmText: "Understood",
        type: "warning",
        isAlert: true,
        onConfirm: () => {},
      });
      return;
    }
    if (targetUser.is_protected) {
      setConfirmDialog({
        isOpen: true,
        title: "Protected Account",
        message: "Protected Account: This system administrator account cannot have its role modified.",
        confirmText: "Understood",
        type: "warning",
        isAlert: true,
        onConfirm: () => {},
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Update User Role?",
      message: `Are you sure you want to promote/demote user "${targetUser.username}" from ${targetUser.role.toUpperCase()} to ${newRole.toUpperCase()}?`,
      confirmText: "Change Role",
      cancelText: "Cancel",
      type: "warning",
      isAlert: false,
      onConfirm: async () => {
        try {
          await api.patch(`/api-v1/admin/users/${targetUser.id}/role`, { role: newRole });
          showToast(`User "${targetUser.username}" role updated to ${newRole}.`);
          fetchUsers();
        } catch (err) {
          showToast(err.message || "Failed to update user role.", "error");
        }
      },
    });
  };

  const handleChangeUserStatus = (targetUser, newStatus) => {
    if (targetUser.id === user?.id) {
      setConfirmDialog({
        isOpen: true,
        title: "Action Prohibited",
        message: "Self-lockout prohibited: Administrators cannot modify their own status.",
        confirmText: "Understood",
        type: "warning",
        isAlert: true,
        onConfirm: () => {},
      });
      return;
    }
    if (targetUser.is_protected) {
      setConfirmDialog({
        isOpen: true,
        title: "Protected Account",
        message: "Protected Account: This account cannot be deactivated or suspended.",
        confirmText: "Understood",
        type: "warning",
        isAlert: true,
        onConfirm: () => {},
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Update Account Status?",
      message: `Are you sure you want to change status of "${targetUser.username}" to ${newStatus.toUpperCase()}?`,
      confirmText: "Update Status",
      cancelText: "Cancel",
      type: newStatus === "suspended" ? "danger" : "warning",
      isAlert: false,
      onConfirm: async () => {
        try {
          await api.patch(`/api-v1/admin/users/${targetUser.id}/status`, {
            status: newStatus,
          });
          showToast(`User "${targetUser.username}" status updated to ${newStatus}.`);
          fetchUsers();
        } catch (err) {
          showToast(err.message || "Failed to update user status.", "error");
        }
      },
    });
  };

  const handleOpenUserDetail = async (userId) => {
    setShowUserModal(true);
    setUserDetailLoading(true);
    setSelectedUserDetail(null);

    try {
      const res = await api.get(`/api-v1/admin/users/${userId}`);
      setSelectedUserDetail(res);
      setUserEditData({
        name: res.name || "",
        username: res.username || "",
        email: res.email || "",
        password: "",
      });
    } catch (err) {
      showToast(err.message || "Failed to load user profile.", "error");
    } finally {
      setUserDetailLoading(false);
    }
  };

  const handleSaveUserEdit = async (e) => {
    e.preventDefault();
    if (!selectedUserDetail) return;
    setUserEditSaving(true);

    try {
      const payload = {};
      if (userEditData.name.trim() !== (selectedUserDetail.name || "")) {
        payload.name = userEditData.name.trim();
      }
      if (userEditData.username.trim() !== selectedUserDetail.username) {
        payload.username = userEditData.username.trim();
      }
      if (userEditData.email.trim() !== selectedUserDetail.email) {
        payload.email = userEditData.email.trim();
      }
      if (userEditData.password.trim()) {
        payload.password = userEditData.password.trim();
      }

      if (Object.keys(payload).length === 0) {
        showToast("No changes detected.");
        setUserEditSaving(false);
        return;
      }

      await api.patch(`/api-v1/admin/users/${selectedUserDetail.id}`, payload);
      showToast(`User "${selectedUserDetail.username}" updated successfully.`);
      setShowUserModal(false);
      fetchUsers();
    } catch (err) {
      showToast(err.message || "Failed to update user.", "error");
    } finally {
      setUserEditSaving(false);
    }
  };

  const handleDeleteUser = (targetUser) => {
    if (targetUser.id === user?.id) {
      setConfirmDialog({
        isOpen: true,
        title: "Action Prohibited",
        message: "Self-deletion prohibited: Administrators cannot delete their own account.",
        confirmText: "Understood",
        type: "warning",
        isAlert: true,
        onConfirm: () => {},
      });
      return;
    }
    if (targetUser.is_protected) {
      setConfirmDialog({
        isOpen: true,
        title: "Protected Account",
        message: "Protected Account: This system administrator account cannot be deleted.",
        confirmText: "Understood",
        type: "warning",
        isAlert: true,
        onConfirm: () => {},
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Delete User Account?",
      message: `DANGER: Permanently delete account for "${targetUser.username}"?\nThis action cannot be undone and will erase user history.`,
      confirmText: "Delete Account",
      cancelText: "Cancel",
      type: "danger",
      isAlert: false,
      onConfirm: async () => {
        try {
          await api.delete(`/api-v1/admin/users/${targetUser.id}`);
          showToast(`User "${targetUser.username}" deleted successfully.`);
          fetchUsers();
        } catch (err) {
          showToast(err.message || "Failed to delete user.", "error");
        }
      },
    });
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Problem Actions
  // ───────────────────────────────────────────────────────────────────────────
  const handleSaveProblem = async (e) => {
    e.preventDefault();
    setFormSaving(true);
    setFormError("");

    try {
      if (editingProblem) {
        await api.patch(`/api-v1/problems/${editingProblem.id}`, {
          title: problemForm.title,
          description: problemForm.description,
          difficulty: problemForm.difficulty,
          category: problemForm.category,
          topic: problemForm.topic,
          time_limit: parseFloat(problemForm.time_limit),
          memory_limit: parseInt(problemForm.memory_limit, 10),
          status: problemForm.status,
        });
        showToast(`Problem #${editingProblem.id} updated.`);
      } else {
        const templates = [];
        if (problemForm.python_template) {
          templates.push({
            language: "python",
            boilerplate_code: problemForm.python_template,
          });
        }
        if (problemForm.cpp_template) {
          templates.push({
            language: "cpp",
            boilerplate_code: problemForm.cpp_template,
          });
        }

        const validRunCases = problemForm.run_test_cases.filter(
          (tc) => tc.input.trim() || tc.expected_output.trim()
        );
        const validSubmitCases = problemForm.submit_test_cases.filter(
          (tc) => tc.input.trim() || tc.expected_output.trim()
        );

        await api.post("/api-v1/problems/full", {
          title: problemForm.title,
          description: problemForm.description,
          difficulty: problemForm.difficulty,
          category: problemForm.category,
          topic: problemForm.topic,
          time_limit: parseFloat(problemForm.time_limit),
          memory_limit: parseInt(problemForm.memory_limit, 10),
          status: problemForm.status,
          run_test_cases: validRunCases,
          submit_test_cases: validSubmitCases,
          templates,
        });
        showToast(`Problem "${problemForm.title}" published.`);
      }

      setShowProblemModal(false);
      setEditingProblem(null);
      fetchProblems();
    } catch (err) {
      setFormError(err.message || "Failed to save problem.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteProblem = (id, title) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Problem?",
      message: `Are you sure you want to soft-delete problem #${id}: "${title}"?`,
      confirmText: "Delete Problem",
      cancelText: "Cancel",
      type: "danger",
      isAlert: false,
      onConfirm: async () => {
        try {
          await api.delete(`/api-v1/problems/${id}`);
          showToast(`Problem #${id} deleted.`);
          fetchProblems();
        } catch (err) {
          showToast(err.message || "Failed to delete problem.", "error");
        }
      },
    });
  };

  // ───────────────────────────────────────────────────────────────────────────
  // RBAC Enforcement Check
  // ───────────────────────────────────────────────────────────────────────────
  if (!authLoading && !isAdmin) {
    return <AccessDenied requiredRole="admin" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md text-xs font-medium transition-all ${
            toast.type === "error"
              ? "bg-rose-950/90 border-rose-700 text-rose-200"
              : "bg-emerald-950/90 border-emerald-700 text-emerald-200"
          }`}
        >
          <span>{toast.type === "error" ? "⚠️" : "✓"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-[#0a0d14] via-[#0d121f] to-[#0a0d14] border border-white/[0.08] rounded-2xl p-6 shadow-xl shadow-black/40">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Administrative Console
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-950 text-rose-300 border border-rose-700/60">
              ADMINISTRATOR
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-700/50">
              PLATFORM ROOT
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
            Global access control, user role elevation, execution telemetry, and immutable audit logging.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/moderator"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0e1322] hover:bg-[#131a30] text-indigo-300 border border-indigo-500/30 transition-all shadow-sm flex items-center gap-1.5"
          >
            <span>🎨</span>
            <span>Moderator Studio</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              if (activeTab === "stats") fetchStats();
              if (activeTab === "users") fetchUsers();
              if (activeTab === "audit") fetchAuditLogs();
              if (activeTab === "problems") fetchProblems();
            }}
            className="p-2 rounded-xl text-xs font-medium bg-[#0e1322] hover:bg-[#131a30] text-slate-300 border border-white/10 transition-colors"
            title="Refresh current data"
          >
            <svg
              className={`w-4 h-4 ${
                statsLoading || usersLoading || auditLoading || problemsLoading
                  ? "animate-spin text-indigo-400"
                  : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-white/[0.08] space-x-6 overflow-x-auto text-xs sm:text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("stats")}
          className={`pb-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === "stats"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>📊</span>
          <span>Telemetry & Stats</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`pb-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === "users"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>👥</span>
          <span>Users & RBAC ({usersTotal})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`pb-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === "audit"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>📜</span>
          <span>Audit Logs ({auditTotal})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("problems")}
          className={`pb-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === "problems"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>⚡</span>
          <span>Problem Repository ({problemsTotal})</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: Platform Telemetry & System Statistics */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          {/* Time Window Switcher */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-4 shadow-md">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Telemetry Window
              </h3>
              <p className="text-[11px] text-slate-400">
                Aggregated execution metrics, error rates, and user registration velocity.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setStatsDays(d)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    statsDays === d
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-[#080b13] text-slate-400 hover:text-white border border-white/10"
                  }`}
                >
                  Last {d} Days
                </button>
              ))}
            </div>
          </div>

          {statsLoading ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-8 h-8 mx-auto border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Loading platform telemetry...</p>
            </div>
          ) : stats ? (
            <>
              {/* Primary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-5 shadow-lg shadow-black/40">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Total Users
                  </div>
                  <div className="text-3xl font-black text-white font-mono mt-1">
                    {stats.users?.total_users || 0}
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1 font-mono">
                    <span>+{stats.users?.new_registrations_in_period || 0}</span>
                    <span className="text-slate-500 font-sans">in {statsDays}d window</span>
                  </div>
                </div>

                <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-5 shadow-lg shadow-black/40">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Code Submissions
                  </div>
                  <div className="text-3xl font-black text-white font-mono mt-1">
                    {stats.submissions?.total_submissions || 0}
                  </div>
                  <div className="text-[11px] text-indigo-400 mt-2 font-mono">
                    {statsDays}d window activity
                  </div>
                </div>

                <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-5 shadow-lg shadow-black/40">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Execution Success Rate
                  </div>
                  <div className="text-3xl font-black text-emerald-400 font-mono mt-1">
                    {stats.submissions?.success_rate?.toFixed(1) || 0}%
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2 font-mono">
                    {stats.submissions?.accepted || 0} accepted
                  </div>
                </div>

                <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-5 shadow-lg shadow-black/40">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Problems in Catalog
                  </div>
                  <div className="text-3xl font-black text-white font-mono mt-1">
                    {stats.problems?.total_problems || 0}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2 font-mono">
                    {stats.problems?.by_status?.published || 0} published
                  </div>
                </div>
              </div>

              {/* Execution Telemetry Breakdown */}
              <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-6 shadow-lg shadow-black/40 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Submissions Verdict & Error Distribution ({statsDays} Days)
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    Total: {stats.submissions?.total_submissions || 0}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-[#080b13] p-3 rounded-xl border border-emerald-900/40 text-center">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold block">
                      Accepted
                    </span>
                    <span className="text-xl font-bold font-mono text-white mt-1 block">
                      {stats.submissions?.accepted || 0}
                    </span>
                  </div>

                  <div className="bg-[#080b13] p-3 rounded-xl border border-rose-900/40 text-center">
                    <span className="text-[10px] text-rose-400 uppercase font-bold block">
                      Rejected (WA)
                    </span>
                    <span className="text-xl font-bold font-mono text-white mt-1 block">
                      {stats.submissions?.rejected || 0}
                    </span>
                  </div>

                  <div className="bg-[#080b13] p-3 rounded-xl border border-amber-900/40 text-center">
                    <span className="text-[10px] text-amber-400 uppercase font-bold block">
                      Time Limit (TLE)
                    </span>
                    <span className="text-xl font-bold font-mono text-white mt-1 block">
                      {stats.submissions?.time_limit_exceeded || 0}
                    </span>
                  </div>

                  <div className="bg-[#080b13] p-3 rounded-xl border border-cyan-900/40 text-center">
                    <span className="text-[10px] text-cyan-400 uppercase font-bold block">
                      Memory Limit (MLE)
                    </span>
                    <span className="text-xl font-bold font-mono text-white mt-1 block">
                      {stats.submissions?.memory_limit_exceeded || 0}
                    </span>
                  </div>

                  <div className="bg-[#080b13] p-3 rounded-xl border border-orange-900/40 text-center">
                    <span className="text-[10px] text-orange-400 uppercase font-bold block">
                      Compile Error
                    </span>
                    <span className="text-xl font-bold font-mono text-white mt-1 block">
                      {stats.submissions?.compilation_errors || 0}
                    </span>
                  </div>

                  <div className="bg-[#080b13] p-3 rounded-xl border border-purple-900/40 text-center">
                    <span className="text-[10px] text-purple-400 uppercase font-bold block">
                      Runtime Error
                    </span>
                    <span className="text-xl font-bold font-mono text-white mt-1 block">
                      {stats.submissions?.runtime_errors || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Users & Problems Breakdown Side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Users by Role and Status */}
                <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-6 shadow-lg shadow-black/40 space-y-4">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    User Accounts & Roles Distribution
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-2 border-b border-white/[0.06]">
                      <span className="text-slate-400">Standard Users</span>
                      <span className="font-mono text-white font-bold">
                        {stats.users?.by_role?.user || 0}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/[0.06]">
                      <span className="text-indigo-400 font-semibold">Moderators</span>
                      <span className="font-mono text-indigo-300 font-bold">
                        {stats.users?.by_role?.moderator || 0}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/[0.06]">
                      <span className="text-rose-400 font-semibold">Administrators</span>
                      <span className="font-mono text-rose-300 font-bold">
                        {stats.users?.by_role?.admin || 0}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">Account Status (Active / Suspended)</span>
                      <span className="font-mono text-slate-200">
                        <span className="text-emerald-400">{stats.users?.by_status?.active || 0} Active</span>
                        {" • "}
                        <span className="text-rose-400">{stats.users?.by_status?.suspended || 0} Suspended</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Problems Distribution */}
                <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-6 shadow-lg shadow-black/40 space-y-4">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Problems Breakdown
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-2 border-b border-white/[0.06]">
                      <span className="text-emerald-400">Easy Challenges</span>
                      <span className="font-mono text-white font-bold">
                        {stats.problems?.by_difficulty?.easy || 0}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/[0.06]">
                      <span className="text-amber-400">Medium Challenges</span>
                      <span className="font-mono text-white font-bold">
                        {stats.problems?.by_difficulty?.medium || 0}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/[0.06]">
                      <span className="text-rose-400">Hard Challenges</span>
                      <span className="font-mono text-white font-bold">
                        {stats.problems?.by_difficulty?.hard || 0}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">Publication Status</span>
                      <span className="font-mono text-slate-200">
                        <span className="text-emerald-400">{stats.problems?.by_status?.published || 0} Live</span>
                        {" • "}
                        <span className="text-amber-400">{stats.problems?.by_status?.draft || 0} Draft</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Stream */}
              {activityStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Recent Admin Actions */}
                  <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-5 shadow-lg space-y-3">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Recent Administrative Actions
                    </h3>
                    <div className="space-y-2">
                      {activityStats.recent_admin_actions?.length > 0 ? (
                        activityStats.recent_admin_actions.map((act, i) => (
                          <div
                            key={i}
                            className="p-2.5 bg-[#080b13] border border-white/[0.04] rounded-xl flex items-center justify-between text-xs"
                          >
                            <div className="space-y-0.5">
                              <span className="font-semibold text-indigo-400 block">
                                {act.action}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                by {act.actor_username || "system"} • {act.target_type}: {act.target_id}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">
                              {new Date(act.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 py-3 text-center">No recent admin actions.</p>
                      )}
                    </div>
                  </div>

                  {/* Recent Moderator Activity */}
                  <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-5 shadow-lg space-y-3">
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Recent Moderator Activity
                    </h3>
                    <div className="space-y-2">
                      {activityStats.recent_moderator_activity?.length > 0 ? (
                        activityStats.recent_moderator_activity.map((act, i) => (
                          <div
                            key={i}
                            className="p-2.5 bg-[#080b13] border border-white/[0.04] rounded-xl flex items-center justify-between text-xs"
                          >
                            <div className="space-y-0.5">
                              <span className="font-semibold text-purple-400 block">
                                {act.action}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                by {act.actor_username || "curator"} • {act.target_type}: {act.target_id}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">
                              {new Date(act.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 py-3 text-center">No recent moderator actions.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center text-xs text-slate-500">
              No telemetry available.
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: User Management & RBAC */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between shadow-lg shadow-black/40">
            <div className="flex-1 min-w-[240px] max-w-md">
              <input
                type="text"
                placeholder="Search user by username or email..."
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUsersPage(0);
                }}
                className="w-full bg-[#080b13] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center space-x-3">
              <select
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value);
                  setUsersPage(0);
                }}
                className="bg-[#080b13] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => {
                  setUserStatusFilter(e.target.value);
                  setUsersPage(0);
                }}
                className="bg-[#080b13] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl overflow-hidden shadow-lg shadow-black/40">
            {usersLoading ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : users.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#0d121f] text-slate-400 font-semibold text-[11px] uppercase tracking-wider border-b border-white/[0.08]">
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Email & Verification</th>
                      <th className="py-3 px-4">Role (RBAC)</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Metrics</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-xs">
                    {users.map((u) => {
                      const isSelf = u.id === user?.id;
                      const isLocked = u.is_protected || isSelf;

                      return (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {u.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                                  <span>{u.username}</span>
                                  {isSelf && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-indigo-900/60 text-indigo-300">
                                      You
                                    </span>
                                  )}
                                  {u.is_protected && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-900/60 text-amber-300" title="Protected System Account">
                                      Protected
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {new Date(u.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-mono text-slate-300 text-[11px]">{u.email}</div>
                            <span className={`text-[10px] font-medium ${
                              u.is_email_verified ? "text-emerald-400" : "text-amber-400"
                            }`}>
                              {u.is_email_verified ? "✓ Verified" : "⏳ Unverified"}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <select
                              value={u.role}
                              disabled={isLocked}
                              onChange={(e) => handleChangeUserRole(u, e.target.value)}
                              className="bg-[#0b0f17] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 uppercase font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <option value="user">USER</option>
                              <option value="moderator">MODERATOR</option>
                              <option value="admin">ADMIN</option>
                            </select>
                          </td>

                          <td className="py-3 px-4">
                            <select
                              value={u.status}
                              disabled={isLocked}
                              onChange={(e) => handleChangeUserStatus(u, e.target.value)}
                              className="bg-[#0b0f17] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 uppercase font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <option value="active">ACTIVE</option>
                              <option value="inactive">INACTIVE</option>
                              <option value="suspended">SUSPENDED</option>
                            </select>
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-[11px]">
                            <div className="text-emerald-400 font-bold">{u.total_score} pts</div>
                            <div className="text-[10px] text-slate-400">
                              {u.problems_solved} solved • {u.submissions_count} subs
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenUserDetail(u.id)}
                              className="px-2.5 py-1 rounded bg-[#0e1322] hover:bg-[#151c33] text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-medium transition-colors"
                            >
                              Drilldown
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              disabled={isLocked}
                              className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                No users found matching query.
              </div>
            )}

            {/* Pagination */}
            <div className="px-4 py-3 bg-[#0d121f] border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing {usersTotal > 0 ? usersPage * 15 + 1 : 0} to{" "}
                {Math.min((usersPage + 1) * 15, usersTotal)} of {usersTotal} users
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={usersPage === 0}
                  onClick={() => setUsersPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1 bg-[#080b13] border border-white/10 rounded-lg text-slate-200 disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={(usersPage + 1) * 15 >= usersTotal}
                  onClick={() => setUsersPage((p) => p + 1)}
                  className="px-3 py-1 bg-[#080b13] border border-white/10 rounded-lg text-slate-200 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: Audit Trail & Logs */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          {/* Audit Filters Bar */}
          <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between shadow-lg shadow-black/40">
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={auditActionFilter}
                onChange={(e) => {
                  setAuditActionFilter(e.target.value);
                  setAuditPage(0);
                }}
                className="bg-[#080b13] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Actions</option>
                <option value="user_role_change">user_role_change</option>
                <option value="user_status_change">user_status_change</option>
                <option value="user_delete">user_delete</option>
                <option value="problem_create">problem_create</option>
                <option value="problem_update">problem_update</option>
                <option value="problem_delete">problem_delete</option>
                <option value="security_violation">security_violation</option>
              </select>

              <select
                value={auditRoleFilter}
                onChange={(e) => {
                  setAuditRoleFilter(e.target.value);
                  setAuditPage(0);
                }}
                className="bg-[#080b13] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Actor Roles</option>
                <option value="admin">Admin</option>
                <option value="moderator">Moderator</option>
                <option value="user">User</option>
                <option value="system">System</option>
              </select>

              <select
                value={auditStatusFilter}
                onChange={(e) => {
                  setAuditStatusFilter(e.target.value);
                  setAuditPage(0);
                }}
                className="bg-[#080b13] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Outcomes</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </div>
          </div>

          {/* Audit Table */}
          <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl overflow-hidden shadow-lg shadow-black/40">
            {auditLoading ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="h-10 bg-white/[0.04] rounded animate-pulse" />
                ))}
              </div>
            ) : auditLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#0d121f] text-slate-400 font-semibold text-[11px] uppercase tracking-wider border-b border-white/[0.08]">
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Target Resource</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">IP Address</th>
                      <th className="py-3 px-4 text-right">Timestamp</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-xs font-mono">
                    {auditLogs.map((log) => {
                      const isViolation = log.action === "security_violation";

                      return (
                        <tr key={log.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isViolation
                                  ? "bg-rose-950/80 text-rose-300 border border-rose-800"
                                  : "bg-indigo-950/60 text-indigo-300 border border-indigo-800/40"
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-200">
                            {log.actor_username || "system"}
                            <span className="text-[10px] text-slate-500 uppercase block">
                              {log.actor_role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {log.target_type}: {log.target_id || "N/A"}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                log.status === "success"
                                  ? "bg-emerald-950/60 text-emerald-400"
                                  : "bg-rose-950/60 text-rose-400"
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {log.ip_address || "internal"}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500 text-[11px]">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAuditLog(log);
                                setShowAuditModal(true);
                              }}
                              className="px-2 py-1 rounded bg-[#0e1322] hover:bg-[#131a30] text-indigo-400 border border-indigo-500/30 text-[11px]"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                No audit records found.
              </div>
            )}

            {/* Pagination */}
            <div className="px-4 py-3 bg-[#0d121f] border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing {auditTotal > 0 ? auditPage * 20 + 1 : 0} to{" "}
                {Math.min((auditPage + 1) * 20, auditTotal)} of {auditTotal} logs
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={auditPage === 0}
                  onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1 bg-[#080b13] border border-white/10 rounded-lg text-slate-200 disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={(auditPage + 1) * 20 >= auditTotal}
                  onClick={() => setAuditPage((p) => p + 1)}
                  className="px-3 py-1 bg-[#080b13] border border-white/10 rounded-lg text-slate-200 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: Problem Repository */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "problems" && (
        <div className="space-y-4">
          <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between shadow-lg shadow-black/40">
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <input
                type="text"
                placeholder="Search problem..."
                value={problemSearch}
                onChange={(e) => {
                  setProblemSearch(e.target.value);
                  setProblemsPage(0);
                }}
                className="bg-[#080b13] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 min-w-[200px]"
              />

              <select
                value={problemDiffFilter}
                onChange={(e) => {
                  setProblemDiffFilter(e.target.value);
                  setProblemsPage(0);
                }}
                className="bg-[#080b13] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300"
              >
                <option value="">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>

              <select
                value={problemStatusFilter}
                onChange={(e) => {
                  setProblemStatusFilter(e.target.value);
                  setProblemsPage(0);
                }}
                className="bg-[#080b13] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300"
              >
                <option value="">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="unpublished">Unpublished</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/moderator"
                className="px-3.5 py-2 bg-[#0e1322] hover:bg-[#151c33] border border-indigo-500/40 text-indigo-300 rounded-xl text-xs font-semibold"
              >
                Launch Moderator Studio
              </Link>
              <button
                type="button"
                onClick={() => {
                  setEditingProblem(null);
                  setProblemForm({
                    title: "",
                    description: "",
                    difficulty: "easy",
                    category: "Algorithms",
                    topic: "array",
                    time_limit: 2.0,
                    memory_limit: 256,
                    status: "published",
                    run_test_cases: [{ input: "", expected_output: "" }],
                    submit_test_cases: [{ input: "", expected_output: "" }],
                    python_template: "def solve():\n    pass\n",
                    cpp_template: "#include <iostream>\nusing namespace std;\nint main() {\n    return 0;\n}\n",
                  });
                  setFormError("");
                  setShowProblemModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs font-semibold shadow-md"
              >
                + Create Problem
              </button>
            </div>
          </div>

          <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl overflow-hidden shadow-lg">
            {problemsLoading ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : problems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#0d121f] text-slate-400 font-semibold text-[11px] uppercase tracking-wider border-b border-white/[0.08]">
                      <th className="py-3 px-4 w-16">ID</th>
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">Difficulty</th>
                      <th className="py-3 px-4">Topic</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-xs">
                    {problems.map((p) => (
                      <tr key={p.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-mono text-slate-400">#{p.id}</td>
                        <td className="py-3 px-4 font-medium text-slate-100">
                          <Link href={`/problems/${p.id}`} className="hover:underline hover:text-indigo-400">
                            {p.title}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300">
                            {p.difficulty}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{p.topic || p.category}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                              p.status === "published"
                                ? "bg-emerald-950/60 text-emerald-400"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProblem(p);
                              setProblemForm({
                                title: p.title,
                                description: p.description,
                                difficulty: p.difficulty,
                                category: p.category,
                                topic: p.topic,
                                time_limit: p.time_limit,
                                memory_limit: p.memory_limit,
                                status: p.status,
                                run_test_cases: [],
                                submit_test_cases: [],
                                python_template: "",
                                cpp_template: "",
                              });
                              setShowProblemModal(true);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProblem(p.id, p.title)}
                            className="px-2.5 py-1 rounded bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                No problems found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: User Detail & Drilldown (GET /api-v1/admin/users/{id}) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0a0d14] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#0d121f]">
              <h3 className="text-base font-bold text-white">
                User Drilldown Profile
              </h3>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {userDetailLoading ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  Retrieving user telemetry and activity history...
                </div>
              ) : selectedUserDetail ? (
                <>
                  {/* User Profile Header */}
                  <div className="bg-[#080b13] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-extrabold text-lg flex items-center justify-center shadow-lg">
                        {selectedUserDetail.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white flex items-center gap-2">
                          <span>{selectedUserDetail.username}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                            {selectedUserDetail.role}
                          </span>
                        </h4>
                        <p className="text-xs text-slate-400 font-mono">
                          {selectedUserDetail.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${
                        selectedUserDetail.status === "active"
                          ? "bg-emerald-950 text-emerald-400"
                          : "bg-rose-950 text-rose-400"
                      }`}>
                        {selectedUserDetail.status}
                      </span>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#080b13] p-3 rounded-xl border border-white/[0.04] text-center">
                      <span className="text-[10px] text-slate-400 uppercase block">Submissions</span>
                      <span className="text-lg font-bold font-mono text-white mt-1 block">
                        {selectedUserDetail.submissions_count}
                      </span>
                    </div>
                    <div className="bg-[#080b13] p-3 rounded-xl border border-white/[0.04] text-center">
                      <span className="text-[10px] text-slate-400 uppercase block">Problems Authored</span>
                      <span className="text-lg font-bold font-mono text-white mt-1 block">
                        {selectedUserDetail.problems_created_count}
                      </span>
                    </div>
                    <div className="bg-[#080b13] p-3 rounded-xl border border-white/[0.04] text-center">
                      <span className="text-[10px] text-slate-400 uppercase block">Leaderboard Score</span>
                      <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
                        {selectedUserDetail.total_score} pts
                      </span>
                    </div>
                  </div>

                  {/* Recent Submissions */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Recent Submissions (Last 5)
                    </h5>
                    {selectedUserDetail.recent_submissions?.length > 0 ? (
                      <div className="divide-y divide-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden bg-[#080b13]">
                        {selectedUserDetail.recent_submissions.map((s, idx) => (
                          <div key={idx} className="p-2.5 flex items-center justify-between text-xs font-mono">
                            <div>
                              <span className="text-white font-semibold">Problem #{s.problem_id}</span>
                              <span className="text-slate-500 ml-2">({s.language})</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`uppercase font-bold text-[10px] ${
                                s.status === "completed" ? "text-emerald-400" : "text-amber-400"
                              }`}>
                                {s.status}
                              </span>
                              <span className="text-slate-500 text-[10px]">
                                {new Date(s.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No submissions on record.</p>
                    )}
                  </div>

                  {/* Recent Audit Actions */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Audit Trail Involving User
                    </h5>
                    {selectedUserDetail.recent_audit_actions?.length > 0 ? (
                      <div className="divide-y divide-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden bg-[#080b13]">
                        {selectedUserDetail.recent_audit_actions.map((act, idx) => (
                          <div key={idx} className="p-2.5 flex items-center justify-between text-xs font-mono">
                            <span className="text-indigo-400">{act.action}</span>
                            <span className="text-slate-500 text-[10px]">
                              {new Date(act.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No recent audit actions logged.</p>
                    )}
                  </div>

                  {/* Edit Form */}
                  <form onSubmit={handleSaveUserEdit} className="p-4 bg-[#080b13] border border-white/[0.06] rounded-xl space-y-3">
                    <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Update Account Details (Admin Override)
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">Display Name</span>
                        <input
                          type="text"
                          value={userEditData.name}
                          onChange={(e) => setUserEditData({ ...userEditData, name: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-[#0b0f17] border border-white/10 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">Username Handle</span>
                        <input
                          type="text"
                          value={userEditData.username}
                          onChange={(e) => setUserEditData({ ...userEditData, username: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-[#0b0f17] border border-white/10 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">Email Address</span>
                        <input
                          type="email"
                          value={userEditData.email}
                          onChange={(e) => setUserEditData({ ...userEditData, email: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-[#0b0f17] border border-white/10 rounded-lg text-xs text-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">Set New Password (optional)</span>
                        <input
                          type="password"
                          placeholder="Leave blank to preserve"
                          value={userEditData.password}
                          onChange={(e) => setUserEditData({ ...userEditData, password: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-[#0b0f17] border border-white/10 rounded-lg text-xs text-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={userEditSaving}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                      >
                        {userEditSaving ? "Updating..." : "Save Account Overrides"}
                      </button>
                    </div>
                  </form>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: Audit Log Inspector */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showAuditModal && selectedAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0a0d14] border border-white/10 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#0d121f]">
              <h3 className="text-base font-bold text-white">
                Audit Event Inspector
              </h3>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#080b13] p-3 rounded-xl border border-white/[0.06]">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Event Action</span>
                  <span className="font-semibold text-indigo-400">{selectedAuditLog.action}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Status</span>
                  <span className={`font-bold uppercase ${
                    selectedAuditLog.status === "success" ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {selectedAuditLog.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Actor Identity</span>
                  <span className="text-white">{selectedAuditLog.actor_username || "system"} ({selectedAuditLog.actor_role})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Client IP Address</span>
                  <span className="font-mono text-slate-300">{selectedAuditLog.ip_address || "internal"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-500 block uppercase">Target Resource</span>
                  <span className="font-mono text-slate-300">{selectedAuditLog.target_type}: {selectedAuditLog.target_id}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-500 block uppercase">Timestamp</span>
                  <span className="font-mono text-slate-400">{new Date(selectedAuditLog.created_at).toUTCString()}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-1">
                  Metadata & Event Payload (JSON)
                </span>
                <pre className="p-3 bg-[#080b13] border border-white/10 rounded-xl font-mono text-[11px] text-indigo-300 overflow-x-auto leading-relaxed">
                  {JSON.stringify(selectedAuditLog.details || {}, null, 2)}
                </pre>
              </div>

              {selectedAuditLog.error_message && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-xl text-xs">
                  <span className="font-bold block">Error:</span>
                  <span>{selectedAuditLog.error_message}</span>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-white/[0.08] flex justify-end bg-[#0d121f]">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-xs font-medium text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: Create / Edit Problem (Admin Quick Form) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showProblemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0a0d14] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#0d121f]">
              <h3 className="text-base font-bold text-white">
                {editingProblem ? `Edit Problem #${editingProblem.id}` : "Create Problem (Admin Quick)"}
              </h3>
              <button
                type="button"
                onClick={() => setShowProblemModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProblem} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-xl text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={problemForm.title}
                  onChange={(e) => setProblemForm({ ...problemForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Difficulty
                  </label>
                  <select
                    value={problemForm.difficulty}
                    onChange={(e) => setProblemForm({ ...problemForm, difficulty: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={problemForm.status}
                    onChange={(e) => setProblemForm({ ...problemForm, status: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="unpublished">Unpublished</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Topic
                  </label>
                  <input
                    type="text"
                    required
                    value={problemForm.topic}
                    onChange={(e) => setProblemForm({ ...problemForm, topic: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Time Limit (seconds)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10.0"
                    required
                    value={problemForm.time_limit}
                    onChange={(e) => setProblemForm({ ...problemForm, time_limit: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={5}
                  required
                  value={problemForm.description}
                  onChange={(e) => setProblemForm({ ...problemForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0b0f17] border border-white/10 rounded-xl text-xs text-white font-mono leading-relaxed resize-y"
                />
              </div>

              <div className="pt-4 border-t border-white/[0.08] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowProblemModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-xs font-semibold text-white shadow-md disabled:opacity-50"
                >
                  {formSaving ? "Saving..." : editingProblem ? "Update Problem" : "Publish Problem"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirmation & Alert Modal */}
      <ConfirmModal
        {...confirmDialog}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
