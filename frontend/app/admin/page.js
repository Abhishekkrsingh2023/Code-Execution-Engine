"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";

export default function AdminPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isModerator = user?.role === "moderator";

  const [activeTab, setActiveTab] = useState("problems"); // "problems" | "users" | "stats" | "audit"

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 1: Problems State
  // ───────────────────────────────────────────────────────────────────────────
  const [problems, setProblems] = useState([]);
  const [problemsLoading, setProblemsLoading] = useState(false);
  const [problemsTotal, setProblemsTotal] = useState(0);
  const [problemsPage, setProblemsPage] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProblem, setEditingProblem] = useState(null);

  // Problem creation form state
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
  // TAB 2: Users Management State (Admin only)
  // ───────────────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(0);
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 3: Stats State
  // ───────────────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 4: Audit Logs State (Admin only)
  // ───────────────────────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Fetch Problems
  const fetchProblems = useCallback(async () => {
    setProblemsLoading(true);
    try {
      const res = await api.get(
        `/api-v1/problems?skip=${problemsPage * 15}&limit=15`
      );
      setProblems(res?.problems || []);
      setProblemsTotal(res?.total || 0);
    } catch {
      // Handled
    } finally {
      setProblemsLoading(false);
    }
  }, [problemsPage]);

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
    } catch {
      // Handled
    } finally {
      setUsersLoading(false);
    }
  }, [isAdmin, usersPage, userRoleFilter, userStatusFilter, userSearch]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;
    setStatsLoading(true);
    try {
      const res = await api.get("/api-v1/admin/stats?days=30");
      setStats(res);
    } catch {
      // Handled
    } finally {
      setStatsLoading(false);
    }
  }, [isAdmin]);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    if (!isAdmin) return;
    setAuditLoading(true);
    try {
      const res = await api.get("/api-v1/admin/audit-logs?skip=0&limit=30");
      setAuditLogs(res?.logs || []);
    } catch {
      // Handled
    } finally {
      setAuditLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === "problems") fetchProblems();
    if (activeTab === "users" && isAdmin) fetchUsers();
    if (activeTab === "stats" && isAdmin) fetchStats();
    if (activeTab === "audit" && isAdmin) fetchAuditLogs();
  }, [activeTab, isAdmin, fetchProblems, fetchUsers, fetchStats, fetchAuditLogs]);

  // Handle Create or Update Problem
  const handleSaveProblem = async (e) => {
    e.preventDefault();
    setFormSaving(true);
    setFormError("");

    try {
      if (editingProblem) {
        // Edit existing problem
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
      } else {
        // Create full problem atomically
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
          (tc) => tc.input || tc.expected_output
        );
        const validSubmitCases = problemForm.submit_test_cases.filter(
          (tc) => tc.input || tc.expected_output
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
      }

      setShowCreateModal(false);
      setEditingProblem(null);
      fetchProblems();
    } catch (err) {
      setFormError(err.message || "Failed to save problem.");
    } finally {
      setFormSaving(false);
    }
  };

  // Delete Problem
  const handleDeleteProblem = async (id) => {
    if (!confirm(`Are you sure you want to delete Problem #${id}?`)) return;
    try {
      await api.delete(`/api-v1/problems/${id}`);
      fetchProblems();
    } catch (err) {
      alert(err.message || "Failed to delete problem.");
    }
  };

  // Change User Role (Admin only)
  const handleChangeUserRole = async (userId, newRole) => {
    try {
      await api.patch(`/api-v1/admin/users/${userId}/role`, { role: newRole });
      fetchUsers();
    } catch (err) {
      alert(err.message || "Failed to update user role.");
    }
  };

  // Change User Status (Admin only)
  const handleChangeUserStatus = async (userId, newStatus) => {
    try {
      await api.patch(`/api-v1/admin/users/${userId}/status`, {
        status: newStatus,
      });
      fetchUsers();
    } catch (err) {
      alert(err.message || "Failed to update user status.");
    }
  };

  // Delete User (Admin only)
  const handleDeleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.delete(`/api-v1/admin/users/${userId}`);
      fetchUsers();
    } catch (err) {
      alert(err.message || "Failed to delete user.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Administrative Console
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-900/60 text-blue-300 border border-blue-700/60">
              {user?.role}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {isAdmin
              ? "Comprehensive management of problems, users, execution telemetry, and audit logs."
              : "Manage problems, test cases, and starter templates."}
          </p>
        </div>

        {activeTab === "problems" && (
          <button
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
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all flex items-center space-x-2 shrink-0"
          >
            <span>+ Create Problem</span>
          </button>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-800 space-x-6">
        <button
          onClick={() => setActiveTab("problems")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "problems"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Problems ({problemsTotal})
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "users"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Users & Roles
            </button>

            <button
              onClick={() => setActiveTab("stats")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "stats"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Telemetry & Stats
            </button>

            <button
              onClick={() => setActiveTab("audit")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "audit"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Audit Logs
            </button>
          </>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: Problems Content */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "problems" && (
        <div className="bg-[#111622] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          {problemsLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-12 bg-slate-800/40 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : problems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#0e131d] text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-slate-800">
                    <th className="py-3 px-4 w-16">ID</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Difficulty</th>
                    <th className="py-3 px-4">Topic</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {problems.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400">{p.id}</td>
                      <td className="py-3 px-4 font-medium text-slate-100">
                        <a href={`/problems/${p.id}`} className="hover:underline">
                          {p.title}
                        </a>
                      </td>
                      <td className="py-3 px-4">
                        <span className="capitalize px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300">
                          {p.difficulty}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{p.topic || p.category}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          p.status === "published"
                            ? "bg-emerald-950/60 text-emerald-400"
                            : "bg-slate-800 text-slate-400"
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
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
                            setShowCreateModal(true);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProblem(p.id)}
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
              No problems found. Click "+ Create Problem" above to publish your first challenge!
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: Users Management (Admin Only) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "users" && isAdmin && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-[#111622] border border-slate-800 rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between">
            <input
              type="text"
              placeholder="Search user by username or email..."
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setUsersPage(0);
              }}
              className="bg-[#0b0f17] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[240px]"
            />

            <div className="flex items-center space-x-3">
              <select
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value);
                  setUsersPage(0);
                }}
                className="bg-[#0b0f17] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300"
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
                className="bg-[#0b0f17] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="bg-[#111622] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            {usersLoading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-12 bg-slate-800/40 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : users.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#0e131d] text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-slate-800">
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Score</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-200">
                          {u.username}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono">{u.email}</td>
                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            disabled={u.is_protected}
                            onChange={(e) => handleChangeUserRole(u.id, e.target.value)}
                            className="bg-[#0b0f17] border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 uppercase font-semibold disabled:opacity-50"
                          >
                            <option value="user">USER</option>
                            <option value="moderator">MODERATOR</option>
                            <option value="admin">ADMIN</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={u.status}
                            disabled={u.is_protected}
                            onChange={(e) => handleChangeUserStatus(u.id, e.target.value)}
                            className="bg-[#0b0f17] border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 uppercase font-semibold disabled:opacity-50"
                          >
                            <option value="active">ACTIVE</option>
                            <option value="inactive">INACTIVE</option>
                            <option value="suspended">SUSPENDED</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400">
                          {u.total_score}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            disabled={u.is_protected || u.id === user?.id}
                            className="px-2 py-1 rounded bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 font-medium disabled:opacity-30 disabled:cursor-not-allowed"
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
                No users found matching the query.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: Telemetry & Stats (Admin Only) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "stats" && isAdmin && (
        <div className="space-y-6">
          {statsLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Loading platform telemetry...
            </div>
          ) : stats ? (
            <>
              {/* Submission Execution Stats */}
              <div className="bg-[#111622] border border-slate-800 rounded-2xl p-6 shadow-md">
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4">
                  Code Submissions & Execution Telemetry (Last 30 Days)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-[#0b0f17] p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Total Submissions</div>
                    <div className="text-2xl font-black text-white font-mono mt-1">
                      {stats.submissions?.total_submissions || 0}
                    </div>
                  </div>
                  <div className="bg-[#0b0f17] p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Success Rate</div>
                    <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                      {stats.submissions?.success_rate?.toFixed(1) || 0}%
                    </div>
                  </div>
                  <div className="bg-[#0b0f17] p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Accepted</div>
                    <div className="text-2xl font-black text-emerald-300 font-mono mt-1">
                      {stats.submissions?.accepted || 0}
                    </div>
                  </div>
                  <div className="bg-[#0b0f17] p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Time Limit Exceeded</div>
                    <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                      {stats.submissions?.time_limit_exceeded || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Users & Problems Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#111622] border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4">
                    Users Overview
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Total Registered</span>
                      <span className="font-mono text-white font-bold">{stats.users?.total_users}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Active Accounts</span>
                      <span className="font-mono text-emerald-400">{stats.users?.by_status?.active || 0}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">New Registrations in Window</span>
                      <span className="font-mono text-blue-400">{stats.users?.new_registrations_in_period || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#111622] border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4">
                    Problems Distribution
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Total Problems</span>
                      <span className="font-mono text-white font-bold">{stats.problems?.total_problems}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Easy / Medium / Hard</span>
                      <span className="font-mono text-slate-200">
                        {stats.problems?.by_difficulty?.easy || 0} / {stats.problems?.by_difficulty?.medium || 0} / {stats.problems?.by_difficulty?.hard || 0}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Published Status</span>
                      <span className="font-mono text-emerald-400">{stats.problems?.by_status?.published || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              No telemetry data available.
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: Audit Logs (Admin Only) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "audit" && isAdmin && (
        <div className="bg-[#111622] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          {auditLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-10 bg-slate-800/40 rounded animate-pulse" />
              ))}
            </div>
          ) : auditLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#0e131d] text-slate-400 font-semibold text-xs uppercase tracking-wider border-b border-slate-800">
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Target</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-semibold text-blue-400">{log.action}</td>
                      <td className="py-3 px-4 text-slate-300">
                        {log.actor_username || log.actor_role || "system"}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {log.target_type}: {log.target_id}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.status === "success"
                            ? "bg-emerald-950/60 text-emerald-400"
                            : "bg-rose-950/60 text-rose-400"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              No audit records logged yet.
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Create / Edit Problem Modal */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111622] border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {editingProblem ? `Edit Problem #${editingProblem.id}` : "Create New Problem"}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProblem} className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-xl text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Problem Title
                  </label>
                  <input
                    type="text"
                    required
                    value={problemForm.title}
                    onChange={(e) => setProblemForm({ ...problemForm, title: e.target.value })}
                    placeholder="e.g. Invert Binary Tree"
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-slate-700 rounded-lg text-sm text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Difficulty
                  </label>
                  <select
                    value={problemForm.difficulty}
                    onChange={(e) => setProblemForm({ ...problemForm, difficulty: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-slate-700 rounded-lg text-sm text-slate-100"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Topic Tag
                  </label>
                  <input
                    type="text"
                    required
                    value={problemForm.topic}
                    onChange={(e) => setProblemForm({ ...problemForm, topic: e.target.value })}
                    placeholder="e.g. tree, array, dp"
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-slate-700 rounded-lg text-sm text-slate-100"
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
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-slate-700 rounded-lg text-sm text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Problem Description (Markdown / Text)
                </label>
                <textarea
                  required
                  rows={4}
                  value={problemForm.description}
                  onChange={(e) => setProblemForm({ ...problemForm, description: e.target.value })}
                  placeholder="Detailed problem statement and constraints..."
                  className="w-full px-3 py-2 bg-[#0b0f17] border border-slate-700 rounded-lg text-sm text-slate-100 resize-y"
                />
              </div>

              {/* Only show test cases and templates for full creation */}
              {!editingProblem && (
                <>
                  <div className="pt-4 border-t border-slate-800 space-y-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase">
                      Sample Run Test Case (Shown to Users)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-1">Sample Input</span>
                        <textarea
                          rows={2}
                          value={problemForm.run_test_cases[0]?.input || ""}
                          onChange={(e) =>
                            setProblemForm({
                              ...problemForm,
                              run_test_cases: [
                                {
                                  input: e.target.value,
                                  expected_output: problemForm.run_test_cases[0]?.expected_output || "",
                                },
                              ],
                            })
                          }
                          placeholder="e.g. 5\n1 2 3 4 5"
                          className="w-full px-3 py-1.5 bg-[#0b0f17] border border-slate-700 rounded-lg text-xs font-mono text-slate-200"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-1">Sample Expected Output</span>
                        <textarea
                          rows={2}
                          value={problemForm.run_test_cases[0]?.expected_output || ""}
                          onChange={(e) =>
                            setProblemForm({
                              ...problemForm,
                              run_test_cases: [
                                {
                                  input: problemForm.run_test_cases[0]?.input || "",
                                  expected_output: e.target.value,
                                },
                              ],
                            })
                          }
                          placeholder="e.g. 15"
                          className="w-full px-3 py-1.5 bg-[#0b0f17] border border-slate-700 rounded-lg text-xs font-mono text-slate-200"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase">
                      Official Submit Test Case (Hidden Judge)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-1">Judge Input</span>
                        <textarea
                          rows={2}
                          value={problemForm.submit_test_cases[0]?.input || ""}
                          onChange={(e) =>
                            setProblemForm({
                              ...problemForm,
                              submit_test_cases: [
                                {
                                  input: e.target.value,
                                  expected_output: problemForm.submit_test_cases[0]?.expected_output || "",
                                },
                              ],
                            })
                          }
                          placeholder="e.g. 10\n..."
                          className="w-full px-3 py-1.5 bg-[#0b0f17] border border-slate-700 rounded-lg text-xs font-mono text-slate-200"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-1">Judge Expected Output</span>
                        <textarea
                          rows={2}
                          value={problemForm.submit_test_cases[0]?.expected_output || ""}
                          onChange={(e) =>
                            setProblemForm({
                              ...problemForm,
                              submit_test_cases: [
                                {
                                  input: problemForm.submit_test_cases[0]?.input || "",
                                  expected_output: e.target.value,
                                },
                              ],
                            })
                          }
                          placeholder="e.g. 55"
                          className="w-full px-3 py-1.5 bg-[#0b0f17] border border-slate-700 rounded-lg text-xs font-mono text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {formSaving ? "Saving..." : editingProblem ? "Update Problem" : "Publish Problem"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
