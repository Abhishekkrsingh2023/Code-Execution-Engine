"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-48 bg-[#0b0f17] rounded-lg animate-pulse" />,
});

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();

  // Section 1: Edit Details State
  const [profileForm, setProfileForm] = useState({
    name: "",
    username: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });

  // Section 2: Submissions State
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      setProfileForm((prev) => ({
        ...prev,
        name: user.name || "",
        username: user.username || "",
        email: user.email || "",
      }));
    }, 0);
    return () => clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    let ignore = false;

    async function initSubmissions() {
      // 1. Check local session submissions
      let list = [];
      try {
        const localSubs = JSON.parse(
          localStorage.getItem("code_zero_my_submissions") || "[]"
        );
        if (Array.isArray(localSubs)) {
          list = localSubs;
        }
      } catch {}

      // 2. If user is admin, also check GET /api-v1/admin/users/{user_id} for backend submissions
      if (user?.role === "admin" && user?.id) {
        try {
          const adminDetail = await api.get(`/api-v1/admin/users/${user.id}`);
          if (adminDetail?.recent_submissions?.length > 0) {
            // Merge avoiding duplicates by id
            const existingIds = new Set(list.map((s) => s.id));
            adminDetail.recent_submissions.forEach((rs) => {
              if (!existingIds.has(rs.id)) {
                list.push({
                  id: rs.id,
                  problem_id: rs.problem_id,
                  problem_title: `Problem #${rs.problem_id}`,
                  language: rs.language,
                  status: rs.status,
                  score: rs.score || 0,
                  max_score: 100,
                  time_taken: 0,
                  created_at: rs.created_at,
                  code: "// Code retrieval from database pending backend route",
                  results: [],
                });
              }
            });
          }
        } catch {}
      }

      if (!ignore) {
        setSubmissions(list);
      }
    }

    initSubmissions();

    return () => {
      ignore = true;
    };
  }, [user]);

  // Handle Edit Details & Change Password
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg({ type: "", text: "" });

    if (
      profileForm.newPassword &&
      profileForm.newPassword !== profileForm.confirmPassword
    ) {
      setProfileMsg({
        type: "error",
        text: "New passwords do not match.",
      });
      setProfileSaving(false);
      return;
    }

    if (profileForm.newPassword && profileForm.newPassword.length < 6) {
      setProfileMsg({
        type: "error",
        text: "New password must be at least 6 characters.",
      });
      setProfileSaving(false);
      return;
    }

    try {
      const payload = {};
      if (profileForm.name !== (user?.name || "")) {
        payload.name = profileForm.name || null;
      }
      if (profileForm.username !== user?.username) {
        payload.username = profileForm.username;
      }
      if (profileForm.newPassword) {
        payload.password = profileForm.newPassword;
        if (profileForm.currentPassword) {
          payload.current_password = profileForm.currentPassword;
        }
      }

      if (Object.keys(payload).length > 0) {
        await api.patch("/api-v1/users/me", payload);
        await refreshUser();
        setProfileForm((prev) => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        }));
        setProfileMsg({
          type: "success",
          text: "Profile updated successfully!",
        });
      } else {
        setProfileMsg({
          type: "info",
          text: "No changes detected.",
        });
      }
    } catch (err) {
      setProfileMsg({
        type: "error",
        text: err.message || "Failed to update profile details.",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const statusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "accepted":
        return "bg-emerald-950/60 border-emerald-700 text-emerald-300";
      case "failed":
      case "wrong_answer":
        return "bg-rose-950/60 border-rose-700 text-rose-300";
      case "tle":
      case "time_limit_exceeded":
        return "bg-amber-950/60 border-amber-700 text-amber-300";
      default:
        return "bg-slate-800 border-slate-700 text-slate-300";
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white relative overflow-x-hidden">
      {/* Background ambient lighting glows */}
      <div
        className="fixed top-0 right-0 w-[550px] h-[500px] bg-indigo-600/[0.1] rounded-full blur-[140px] pointer-events-none -z-10 transform translate-x-1/4 -translate-y-1/4"
        aria-hidden="true"
      />
      <div
        className="fixed top-1/2 left-0 w-[500px] h-[500px] bg-purple-600/[0.08] rounded-full blur-[140px] pointer-events-none -z-10 transform -translate-x-1/3"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 flex-1">
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-950/30 text-[11px] font-semibold text-indigo-300 mb-2 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span>Developer Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Account & Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage your platform credentials, inspect your competitive standings, and review submission history.
          </p>
        </div>

        {/* SECTION 1: Edit Details & Password */}
        <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-lg shadow-black/40 hover:border-white/[0.12] transition-colors">
          <div className="border-b border-white/[0.08] pb-3 mb-5">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <span>Profile Details & Security</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Update your display name, username handle, or change your account password.
            </p>
          </div>

          {profileMsg.text && (
            <div
              className={`mb-5 p-3.5 rounded-xl text-xs sm:text-sm border ${
                profileMsg.type === "success"
                  ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                  : profileMsg.type === "error"
                  ? "bg-rose-950/40 border-rose-800 text-rose-300"
                  : "bg-indigo-950/40 border-indigo-800 text-indigo-300"
              }`}
            >
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              <div>
                <label
                  htmlFor="profile_name"
                  className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1"
                >
                  Full Name
                </label>
                <input
                  id="profile_name"
                  type="text"
                  placeholder="e.g. Alice Smith"
                  value={profileForm.name}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2 bg-[#080b13] border border-white/10 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors shadow-inner"
                />
              </div>

              <div>
                <label
                  htmlFor="profile_username"
                  className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1"
                >
                  Username Handle
                </label>
                <input
                  id="profile_username"
                  type="text"
                  required
                  value={profileForm.username}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, username: e.target.value })
                  }
                  className="w-full px-3.5 py-2 bg-[#080b13] border border-white/10 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors shadow-inner"
                />
              </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="profile_email"
                  className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
                >
                  Email Address
                </label>
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                  Read Only
                </span>
              </div>
              <input
                id="profile_email"
                type="email"
                disabled
                readOnly
                value={profileForm.email}
                className="w-full px-3.5 py-2.5 bg-[#0b0f17]/50 border border-slate-800 rounded-xl text-sm text-slate-400 cursor-not-allowed select-none focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Email address is permanently linked to your account and cannot be modified.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              Change Password
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="current_password"
                  className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1"
                >
                  Current Password
                </label>
                <input
                  id="current_password"
                  type="password"
                  placeholder="Leave blank if unchanged"
                  value={profileForm.currentPassword}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      currentPassword: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2 bg-[#0b0f17] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="new_password"
                  className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1"
                >
                  New Password
                </label>
                <input
                  id="new_password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={profileForm.newPassword}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      newPassword: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2 bg-[#0b0f17] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm_new_password"
                  className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirm_new_password"
                  type="password"
                  placeholder="Confirm new password"
                  value={profileForm.confirmPassword}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2 bg-[#0b0f17] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={profileSaving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs sm:text-sm transition-all shadow-md shadow-indigo-600/30 active:scale-98 disabled:opacity-50"
            >
              {profileSaving ? "Saving Changes..." : "Save Details"}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: Activity & Performance */}
      <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-lg shadow-black/40 hover:border-white/[0.12] transition-colors">
        <div className="border-b border-white/[0.08] pb-3 mb-5">
          <h2 className="text-base font-bold text-white">
            Activity & Performance
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Summary of your verified problem solutions, accumulated points, and submissions.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-[#080b13] border border-white/[0.08] rounded-xl p-4 shadow-sm">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
              Problems Solved
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {user?.problems_solved || 0}
            </div>
          </div>

          <div className="bg-[#080b13] border border-white/[0.08] rounded-xl p-4 shadow-sm">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
              Total Score
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {Number(user?.total_score || 0).toFixed(1)}
            </div>
          </div>

          <div className="bg-[#080b13] border border-white/[0.08] rounded-xl p-4 shadow-sm">
            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
              Recorded Submissions
            </div>
            <div className="text-2xl font-black text-indigo-400 font-mono">
              {submissions.length}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: My Submissions */}
      <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-lg shadow-black/40 hover:border-white/[0.12] transition-colors">
        <div className="border-b border-white/[0.08] pb-3 mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">My Submissions</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical submissions with execution status, runtime, score, and source code inspection.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono bg-white/[0.04] px-2.5 py-0.5 rounded-lg border border-white/10">
            {submissions.length} Recorded
          </span>
        </div>

        {submissions.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-[#0d121f] text-slate-400 font-semibold text-[11px] uppercase tracking-wider border-b border-white/[0.08]">
                  <th className="py-3 px-4">Problem</th>
                  <th className="py-3 px-4">Language</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Score</th>
                  <th className="py-3 px-4 text-right">Time</th>
                  <th className="py-3 px-4 text-right">Date</th>
                  <th className="py-3 px-4 text-right w-20">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-xs">
                {submissions.map((sub, idx) => (
                  <tr
                    key={sub.id || idx}
                    className="hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-slate-200">
                      {sub.problem_title || `Problem #${sub.problem_id}`}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 uppercase">
                      {sub.language}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${statusBadge(
                          sub.status
                        )}`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-400 font-semibold">
                      {sub.score} / {sub.max_score || 100}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {sub.time_taken ? `${sub.time_taken}s` : "--"}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">
                      {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : "--"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedSubmission(sub)}
                        className="px-2.5 py-1 rounded-md bg-[#0e1322] hover:bg-[#141b2c] border border-white/10 text-indigo-400 hover:text-indigo-300 text-xs font-semibold transition-colors shadow-xs"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs bg-[#080b13] rounded-xl border border-white/[0.06]">
            No submissions recorded in this session. Head to the Problems tab and submit your code to see history here!
          </div>
        )}
      </div>

      {/* Submission Inspection Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0d14] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Submission Details
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  ID: {selectedSubmission.id} • Language: {selectedSubmission.language}
                </p>
              </div>

              <button
                onClick={() => setSelectedSubmission(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex items-center space-x-4 text-xs font-mono">
                <span className={`px-2.5 py-0.5 rounded border ${statusBadge(selectedSubmission.status)}`}>
                  {selectedSubmission.status}
                </span>
                <span className="text-slate-400">
                  Score: <strong className="text-emerald-400">{selectedSubmission.score}</strong> / {selectedSubmission.max_score}
                </span>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Submitted Source Code
                </div>
                <div className="h-64 rounded-xl overflow-hidden border border-white/[0.08]">
                  <MonacoEditor
                    height="100%"
                    language={selectedSubmission.language === "cpp" ? "cpp" : selectedSubmission.language === "c" ? "c" : selectedSubmission.language === "java" ? "java" : "python"}
                    theme="vs-dark"
                    value={selectedSubmission.code || ""}
                    options={{
                      readOnly: true,
                      fontSize: 12,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>
              </div>

              {selectedSubmission.results?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Test Results
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedSubmission.results.map((r, i) => (
                      <div
                        key={i}
                        className="bg-[#080b13] border border-white/[0.08] p-2 rounded-lg text-xs flex justify-between"
                      >
                        <span className="font-mono text-slate-300">
                          #{r.test_case || i + 1}
                        </span>
                        <span className={`px-1.5 rounded text-[10px] ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-white/[0.08] bg-[#0d121f] flex justify-end">
              <button
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-1.5 rounded-lg bg-[#0e1322] hover:bg-[#141b2c] border border-white/10 text-xs font-medium text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
