"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const PAGE_SIZE = 15;

export default function ProblemsPage() {
  const { user } = useAuth();
  const [problems, setProblems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [topic, setTopic] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Solved problem IDs tracked in client state / local storage
  const [solvedIds, setSolvedIds] = useState(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("code_zero_solved_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("skip", page * PAGE_SIZE);
      params.set("limit", PAGE_SIZE);

      if (search.trim()) params.set("search", search.trim());
      if (difficulty) params.set("difficulty", difficulty);
      if (topic) params.set("topic", topic);

      const res = await api.get(`/api-v1/problems?${params.toString()}`);
      setProblems(res?.problems || []);
      setTotal(res?.total || 0);
    } catch (err) {
      setError(err.message || "Failed to retrieve problem list.");
    } finally {
      setLoading(false);
    }
  }, [page, search, difficulty, topic]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      await fetchProblems();
    }
    load();
    return () => {
      ignore = true;
    };
  }, [fetchProblems]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    fetchProblems();
  };

  const difficultyBadge = (diff) => {
    switch (diff?.toLowerCase()) {
      case "easy":
        return "text-emerald-400 bg-emerald-950/40 border-emerald-800/50";
      case "medium":
        return "text-amber-400 bg-amber-950/40 border-amber-800/50";
      case "hard":
        return "text-rose-400 bg-rose-950/40 border-rose-800/50";
      default:
        return "text-slate-400 bg-slate-800/40 border-slate-700/50";
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-950/30 text-[11px] font-semibold text-indigo-300 mb-2 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span>Algorithmic Archive</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Problems
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Browse and solve algorithmic challenges across data structures, math, and systems.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-300 bg-[#0a0d14] px-3.5 py-1.5 rounded-xl border border-white/[0.08] shadow-md shadow-black/30">
            <span className="text-slate-400">Total Challenges:</span>
            <span className="font-bold text-white font-mono">{total}</span>
          </div>
        </div>

        {/* Filter and Search Bar Card */}
        <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl p-3.5 sm:p-4 mb-5 shadow-lg shadow-black/40 hover:border-white/[0.14] transition-colors flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <form
            onSubmit={handleSearchSubmit}
            className="relative flex-1 min-w-[240px]"
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search problems by title, topic..."
              className="w-full pl-9 pr-4 py-2 bg-[#080b13] border border-white/10 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors shadow-inner"
            />
            <svg
              className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none"
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
          </form>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Difficulty Filter */}
            <select
              value={difficulty}
              onChange={(e) => {
                setDifficulty(e.target.value);
                setPage(0);
              }}
              className="bg-[#080b13] border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            >
              <option value="">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>

            {/* Reset Filters */}
            {(search || difficulty || topic) && (
              <button
                onClick={() => {
                  setSearch("");
                  setDifficulty("");
                  setTopic("");
                  setPage(0);
                }}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs sm:text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchProblems}
              className="px-3 py-1 bg-rose-900/60 hover:bg-rose-900 rounded-lg text-xs text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Problems Table Card */}
        <div className="bg-[#0a0d14] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl shadow-black/40 hover:border-white/[0.12] transition-colors">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="h-11 bg-white/[0.03] rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : problems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-[#0d121f]">
                    <th className="py-3 px-4 w-16 text-center">Status</th>
                    <th className="py-3 px-4 w-16">#</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Difficulty</th>
                    <th className="py-3 px-4">Topic / Tag</th>
                    <th className="py-3 px-4 text-right">Time Limit</th>
                    <th className="py-3 px-4 text-right w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs sm:text-sm">
                  {problems.map((prob) => {
                    const isSolved = solvedIds.has(prob.id);

                    return (
                      <tr
                        key={prob.id}
                        className="hover:bg-white/[0.03] transition-colors group"
                      >
                        {/* Solved Status */}
                        <td className="py-3 px-4 text-center">
                          {isSolved ? (
                            <span
                              title="Solved"
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold"
                            >
                              ✓
                            </span>
                          ) : (
                            <span
                              title="Unsolved"
                              className="inline-block w-2 h-2 rounded-full bg-slate-700"
                            />
                          )}
                        </td>

                        {/* ID */}
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">
                          {prob.id}
                        </td>

                        {/* Title */}
                        <td className="py-3 px-4 font-medium text-slate-100 group-hover:text-indigo-400 transition-colors">
                          <Link
                            href={`/problems/${prob.id}`}
                            className="hover:underline"
                          >
                            {prob.title}
                          </Link>
                        </td>

                        {/* Difficulty Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${difficultyBadge(
                              prob.difficulty
                            )}`}
                          >
                            {prob.difficulty || "Easy"}
                          </span>
                        </td>

                        {/* Topic / Category */}
                        <td className="py-3 px-4">
                          <span className="text-xs px-2 py-0.5 rounded-md bg-[#111628] border border-white/[0.06] text-slate-300 font-medium">
                            {prob.topic || prob.category || "Algorithms"}
                          </span>
                        </td>

                        {/* Time Limit */}
                        <td className="py-3 px-4 text-right font-mono text-xs text-slate-400">
                          {prob.time_limit || "1.0"}s
                        </td>

                        {/* Solve link */}
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/problems/${prob.id}`}
                            className="inline-block px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition-all shadow-sm shadow-indigo-600/30 active:scale-98"
                          >
                            Solve
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 mx-auto mb-3">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-200 mb-1">
                No problems found
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No challenges matched your search filters. Try adjusting your query or resetting the filters.
              </p>
            </div>
          )}

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="p-3.5 border-t border-white/[0.08] bg-[#0d121f]/50 flex items-center justify-between text-xs text-slate-400">
              <div>
                Page <span className="text-white font-semibold">{page + 1}</span> of{" "}
                <span className="text-white font-semibold">{totalPages}</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1 rounded-lg bg-[#0e1322] hover:bg-[#141b2c] border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded-lg bg-[#0e1322] hover:bg-[#141b2c] border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
